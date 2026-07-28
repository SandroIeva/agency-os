-- Seats a plan has actually committed: people with access PLUS invitations that
-- are still outstanding. An invite that has been sent is a seat someone can walk
-- into, so it has to count before it is accepted.
--
-- Exists so the pre-flight check in the UI and the invite triggers agree. They
-- used to disagree: the triggers counted pending invites, the client did not, so
-- the UI would promise "one more seat available" and the insert would refuse it.
create or replace function public.account_seats_reserved(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.account_seats_used(p_owner) + coalesce((
    select count(distinct email)::integer from (
      select i.email
      from public.invitations i
      join public.organizations o on o.id = i.org_id
      where o.created_by = p_owner and i.status = 'pending'
      union
      select pi.email
      from public.project_invitations pi
      join public.projects p on p.id = pi.project_id
      join public.organizations o on o.id = p.org_id
      where o.created_by = p_owner and pi.status = 'pending'
    ) pending
  ), 0);
$$;

-- Both invite triggers now use it, so there is one definition of "reserved".
create or replace function public.enforce_invite_seat_limit()
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

  v_plan := public.account_plan(v_owner);
  select seats into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new;
  end if;

  v_used := public.account_seats_reserved(v_owner);
  if v_used >= v_limit then
    raise exception 'i7os_seat_limit'
      using detail = format('plan=%s limit=%s reserved=%s', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to invite more people.';
  end if;

  return new;
end;
$$;

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

  v_used := public.account_seats_reserved(v_owner);
  if v_used >= v_limit then
    raise exception 'i7os_seat_limit'
      using detail = format('plan=%s limit=%s reserved=%s', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to invite more people.';
  end if;

  return new;
end;
$$;
