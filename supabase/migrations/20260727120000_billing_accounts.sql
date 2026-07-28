-- Billing moves from "a workspace has a plan" to "a PERSON has a plan that
-- covers all of their workspaces".
--
-- Why: the agreed pricing gives Pro up to 5 workspaces and Agency unlimited
-- ones, sharing ONE pooled storage/seat allowance. `workspace_subscriptions`
-- is keyed by org_id, so a plan is a property of a single workspace there —
-- a second workspace would silently be Free, and a user with three workspaces
-- would have three independent trial windows. Neither is expressible without
-- moving the subscription up one level, to the owner.
--
-- The paying entity is the user who CREATED the workspace
-- (organizations.created_by). Entitlements for any workspace resolve through
-- its owner, and usage (storage, seats) is summed across every workspace that
-- owner has.
--
-- This migration is additive: `workspace_subscriptions` is left in place and
-- the server dual-writes both tables during the transition, so a rollback
-- doesn't lose subscription state.
create table if not exists public.billing_accounts (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_product_id text,
  stripe_price_id text,
  plan text check (plan is null or plan in ('starter', 'pro', 'agency')),
  billing_interval text check (billing_interval is null or billing_interval in ('monthly', 'annual')),
  status text not null default 'inactive' check (
    status in (
      'inactive', 'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )
  ),
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  -- Cardless 7-day trial, tracked here rather than via Stripe's
  -- trial_period_days: the trial starts on first workspace creation, before any
  -- Stripe customer exists. An EXPIRED trial is still status 'trialing' with a
  -- past trial_ends_at — resolving that to Free entitlements is the
  -- application's job, so this table stays a plain record of fact.
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_accounts is
  'Server-managed Stripe subscription + trial state per paying user. One account covers all workspaces the user owns.';

-- Backfill from the per-workspace table via each workspace's creator. A user who
-- somehow owns two subscribed workspaces collapses to one account row; the most
-- recently updated subscription wins.
insert into public.billing_accounts (
  owner_user_id, stripe_customer_id, stripe_subscription_id, stripe_product_id,
  stripe_price_id, plan, billing_interval, status, cancel_at_period_end,
  current_period_end, created_at, updated_at
)
select distinct on (o.created_by)
  o.created_by, s.stripe_customer_id, s.stripe_subscription_id, s.stripe_product_id,
  s.stripe_price_id, s.plan, s.billing_interval, s.status, s.cancel_at_period_end,
  s.current_period_end, s.created_at, s.updated_at
from public.workspace_subscriptions s
join public.organizations o on o.id = s.org_id
where o.created_by is not null
order by o.created_by, s.updated_at desc
on conflict (owner_user_id) do nothing;

alter table public.billing_accounts enable row level security;

-- Billing identifiers and subscription state stay server-only, exactly as with
-- workspace_subscriptions. The Vercel billing endpoints validate the Supabase
-- user and workspace membership, then read this with the service key.
revoke all on table public.billing_accounts from anon, authenticated;
grant select, insert, update, delete on table public.billing_accounts to service_role;

-- ── Trial start ────────────────────────────────────────────────────────────
-- Creating a workspace starts the owner's 7-day trial, once per account. A
-- trigger rather than client code because organizations are inserted from
-- several places in App.jsx (onboarding, workspace switcher) and a missed call
-- site would silently hand someone an unlimited free ride.
create or replace function public.ensure_billing_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    return new;
  end if;
  insert into public.billing_accounts (owner_user_id, status, trial_started_at, trial_ends_at)
  values (new.created_by, 'trialing', now(), now() + interval '7 days')
  on conflict (owner_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_ensure_billing_account on public.organizations;
create trigger organizations_ensure_billing_account
  after insert on public.organizations
  for each row execute function public.ensure_billing_account();

-- Existing owners predate the trial. Give them a trial window too rather than
-- locking them out on deploy; already-subscribed accounts keep their status.
insert into public.billing_accounts (owner_user_id, status, trial_started_at, trial_ends_at)
select distinct o.created_by, 'trialing', now(), now() + interval '7 days'
from public.organizations o
where o.created_by is not null
on conflict (owner_user_id) do nothing;

-- ── Pooled storage usage ───────────────────────────────────────────────────
-- Storage is one allowance per ACCOUNT, spread over that owner's workspaces, so
-- the pre-upload check needs the owner's total rather than this workspace's.
-- Takes the workspace being uploaded into (not a user id) so a caller can only
-- ever read the pool they are actually about to draw from — membership in that
-- workspace is the permission check. Supersedes workspace_storage_used(), which
-- is kept for the per-workspace breakdown in Settings.
create or replace function public.account_storage_used(p_org uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  total bigint;
begin
  if not exists (
    select 1 from public.org_members where org_id = p_org and user_id = auth.uid()
  ) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  select created_by into owner_id from public.organizations where id = p_org;
  if owner_id is null then
    return 0;
  end if;

  select coalesce(sum(f.size_bytes), 0) into total
  from public.workspace_files f
  join public.organizations o on o.id = f.org_id
  where o.created_by = owner_id;

  return total;
end;
$$;

grant execute on function public.account_storage_used(uuid) to authenticated;
