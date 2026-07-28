-- Server-side enforcement of the plan limits.
--
-- The client already checks these before acting, but a client check is advice,
-- not a boundary: every one of these tables is writable directly through the
-- anon key under RLS, so the limits have to hold in the database too.
--
-- Grandfathering is intentional and falls out of these being BEFORE INSERT
-- triggers: an account that is already over a limit (e.g. after a downgrade)
-- keeps everything it has and simply cannot add more. Nothing is ever deleted.

-- ── Limits table ───────────────────────────────────────────────────────────
-- MUST be kept in sync with PLAN_ENTITLEMENTS in src/entitlements.js. The
-- numbers exist twice because enforcement genuinely runs in two runtimes
-- (Postgres and JS) and neither can call the other; there is no way to have one
-- copy. When changing a limit, change BOTH. null = unlimited, matching the JS.
create table if not exists public.plan_limits (
  plan text primary key check (plan in ('free', 'starter', 'pro', 'agency')),
  storage_bytes bigint,
  seats integer,
  workspaces integer,
  projects integer,
  collaboration boolean not null default false,
  read_only boolean not null default false
);

insert into public.plan_limits (plan, storage_bytes, seats, workspaces, projects, collaboration, read_only) values
  ('free',      1073741824,  1, 1,    0,    false, true),
  ('starter',   5368709120,  1, 1,    3,    false, false),
  ('pro',      26843545600,  5, 5,    null, true,  false),
  ('agency',  107374182400, 12, null, null, true,  false)
on conflict (plan) do update set
  storage_bytes = excluded.storage_bytes,
  seats         = excluded.seats,
  workspaces    = excluded.workspaces,
  projects      = excluded.projects,
  collaboration = excluded.collaboration,
  read_only     = excluded.read_only;

alter table public.plan_limits enable row level security;
revoke all on table public.plan_limits from anon, authenticated;
grant select on table public.plan_limits to service_role;

-- ── Comped / internal accounts ─────────────────────────────────────────────
-- A plan granted outside Stripe (team accounts, support goodwill, design
-- partners). Needed because the webhook derives the plan from the Stripe price
-- id, so a plan written straight into `plan` is silently reverted on the next
-- subscription event. Nothing in the Stripe sync path ever writes this column.
alter table public.billing_accounts
  add column if not exists plan_override text
    check (plan_override is null or plan_override in ('starter', 'pro', 'agency'));

comment on column public.billing_accounts.plan_override is
  'Manually granted plan that outranks Stripe. Never written by the webhook.';

-- ── Plan resolution ────────────────────────────────────────────────────────
-- The SQL mirror of resolveEntitlements() in src/entitlements.js. Same two
-- subtleties: an expired cardless trial is still stored as status 'trialing',
-- and Stripe reuses 'trialing' for card-backed trials — told apart by the
-- presence of a subscription id.
create or replace function public.account_plan(p_owner uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when b.plan_override is not null then b.plan_override
      when b.stripe_subscription_id is not null
       and b.status in ('active', 'trialing', 'past_due')
       and b.plan is not null
        then b.plan
      when b.stripe_subscription_id is null
       and b.status = 'trialing'
       and b.trial_ends_at is not null
       and b.trial_ends_at > now()
        then 'starter'
      else 'free'
    end
    from public.billing_accounts b
    where b.owner_user_id = p_owner
  ), 'free');
$$;

-- Owner of the account a workspace bills to.
create or replace function public.org_owner(p_org uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select created_by from public.organizations where id = p_org;
$$;

-- ── Workspace limit ────────────────────────────────────────────────────────
create or replace function public.enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  if new.created_by is null then
    return new;
  end if;

  v_plan := public.account_plan(new.created_by);
  select workspaces into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new; -- unlimited
  end if;

  select count(*) into v_used from public.organizations where created_by = new.created_by;
  if v_used >= v_limit then
    raise exception 'i7os_workspace_limit'
      using detail = format('plan=%s limit=%s used=%s', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to create more workspaces.';
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_enforce_workspace_limit on public.organizations;
create trigger organizations_enforce_workspace_limit
  before insert on public.organizations
  for each row execute function public.enforce_workspace_limit();

-- ── Project limit ──────────────────────────────────────────────────────────
-- Counted across every workspace the owner has, matching the pooled model.
-- There is no archive flag on projects, so "active projects" means all of them.
create or replace function public.enforce_project_limit()
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
  select projects into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new; -- unlimited
  end if;

  select count(*) into v_used
  from public.projects p
  join public.organizations o on o.id = p.org_id
  where o.created_by = v_owner;

  if v_used >= v_limit then
    raise exception 'i7os_project_limit'
      using detail = format('plan=%s limit=%s used=%s', v_plan, v_limit, v_used),
            hint = 'Upgrade the plan to create more projects.';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_enforce_project_limit on public.projects;
create trigger projects_enforce_project_limit
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- ── Seat limit ─────────────────────────────────────────────────────────────
-- Seats count PEOPLE across the owner's workspaces: the same teammate invited
-- into three of them occupies one seat. The owner occupies one, which is why
-- Starter (1 seat) means "no collaboration" rather than "one guest".
create or replace function public.account_seats_used(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct m.user_id)::integer
  from public.org_members m
  join public.organizations o on o.id = m.org_id
  where o.created_by = p_owner;
$$;

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

  -- Already on this account elsewhere → occupies no additional seat.
  if exists (
    select 1 from public.org_members m
    join public.organizations o on o.id = m.org_id
    where o.created_by = v_owner and m.user_id = new.user_id
  ) then
    return new;
  end if;

  v_plan := public.account_plan(v_owner);
  select seats into v_limit from public.plan_limits where plan = v_plan;
  if v_limit is null then
    return new; -- unlimited
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

drop trigger if exists org_members_enforce_seat_limit on public.org_members;
create trigger org_members_enforce_seat_limit
  before insert on public.org_members
  for each row execute function public.enforce_seat_limit();

-- Also stop the invite from being SENT, so nobody receives an email for a seat
-- that cannot be filled. org_members above stays the authoritative gate; this
-- one counts pending invitations alongside members so a burst of invites can't
-- overshoot the limit.
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
    return new; -- unlimited
  end if;

  v_used := public.account_seats_used(v_owner) + (
    select count(distinct i.email)::integer
    from public.invitations i
    join public.organizations o on o.id = i.org_id
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

drop trigger if exists invitations_enforce_seat_limit on public.invitations;
create trigger invitations_enforce_seat_limit
  before insert on public.invitations
  for each row execute function public.enforce_invite_seat_limit();
