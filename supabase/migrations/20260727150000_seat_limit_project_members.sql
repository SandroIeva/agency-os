-- Closes a hole in the seat count.
--
-- accept_project_invitation() adds people to `project_members` only — it never
-- touches `org_members`. So counting seats from org_members alone let someone
-- hand out unlimited project invitations without ever consuming a seat. A seat
-- is "a person with access to this account's workspaces", regardless of which
-- door they came through.

create or replace function public.account_seats_used(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct uid)::integer from (
    select m.user_id as uid
    from public.org_members m
    join public.organizations o on o.id = m.org_id
    where o.created_by = p_owner
    union
    select pm.user_id
    from public.project_members pm
    join public.projects p on p.id = pm.project_id
    join public.organizations o on o.id = p.org_id
    where o.created_by = p_owner
  ) s;
$$;

-- Does this person already occupy a seat on the account (either way in)?
create or replace function public.account_has_seat(p_owner uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members m
    join public.organizations o on o.id = m.org_id
    where o.created_by = p_owner and m.user_id = p_user
  ) or exists (
    select 1 from public.project_members pm
    join public.projects p on p.id = pm.project_id
    join public.organizations o on o.id = p.org_id
    where o.created_by = p_owner and pm.user_id = p_user
  );
$$;

-- Rewritten to use the shared helper, so org_members and project_members can
-- never drift apart on what counts as an existing seat.
create or replace function public.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  if new.org_id is null then
    return new;
  end if;

  v_owner := public.org_owner(new.org_id);
  if v_owner is null then
    return new;
  end if;

  -- The owner joining their own workspace must never be blocked, or creating a
  -- workspace would fail at the membership insert that follows it.
  if new.user_id = v_owner then
    return new;
  end if;

  if public.account_has_seat(v_owner, new.user_id) then
    return new;
  end if;

  v_plan := public.account_plan(v_owner);
  select seats into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new;
  end if;

  v_used := public.account_seats_used(v_owner);
  if v_used >= v_limit then
    raise exception 'i7os_seat_limit'
      using detail = format('plan=%s limit=%s used=%s', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to add more people.';
  end if;

  return new;
end;
$$;

-- Same gate on the project-membership path.
create or replace function public.enforce_project_member_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  select o.created_by into v_owner
  from public.projects p
  join public.organizations o on o.id = p.org_id
  where p.id = new.project_id;

  if v_owner is null or new.user_id = v_owner then
    return new;
  end if;

  if public.account_has_seat(v_owner, new.user_id) then
    return new;
  end if;

  v_plan := public.account_plan(v_owner);
  select seats into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new;
  end if;

  v_used := public.account_seats_used(v_owner);
  if v_used >= v_limit then
    raise exception 'i7os_seat_limit'
      using detail = format('plan=%s limit=%s used=%s', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to add more people.';
  end if;

  return new;
end;
$$;

drop trigger if exists project_members_enforce_seat_limit on public.project_members;
create trigger project_members_enforce_seat_limit
  before insert on public.project_members
  for each row execute function public.enforce_project_member_seat_limit();

-- And stop the project invite from being sent when there is no seat for it.
create or replace function public.enforce_project_invite_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  select o.created_by into v_owner
  from public.projects p
  join public.organizations o on o.id = p.org_id
  where p.id = new.project_id;

  if v_owner is null then
    return new;
  end if;

  v_plan := public.account_plan(v_owner);
  select seats into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new;
  end if;

  v_used := public.account_seats_used(v_owner) + (
    select count(distinct i.email)::integer
    from public.project_invitations i
    join public.projects p on p.id = i.project_id
    join public.organizations o on o.id = p.org_id
    where o.created_by = v_owner and i.status = 'pending'
  );

  if v_used >= v_limit then
    raise exception 'i7os_seat_limit'
      using detail = format('plan=%s limit=%s used=%s (incl. pending invites)', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to invite more people.';
  end if;

  return new;
end;
$$;

drop trigger if exists project_invitations_enforce_seat_limit on public.project_invitations;
create trigger project_invitations_enforce_seat_limit
  before insert on public.project_invitations
  for each row execute function public.enforce_project_invite_seat_limit();
