-- Account lifecycle: reclaim space from abandoned workspaces without burning
-- people who might still come back.
--
-- Staged on purpose. Storage objects are ~99% of the bytes an abandoned
-- workspace costs; the rows describing its structure cost almost nothing. So
-- the expensive part goes first, and the structure survives long enough that
-- someone returning still sees their projects and can convert.
--
--   day 0    access ends            → read-only (…_read_only_mode.sql)
--   day -14  warning email
--   day -3   final warning email
--   day 30   storage objects purged  (60 for accounts that ever paid)
--   day 90   workspace rows purged  (180 for accounts that ever paid)
--
-- Accounts that ever paid get double the window: a failed card payment moves a
-- Stripe subscription to 'canceled', which is indistinguishable from a real
-- cancellation, and deleting a paying customer's work over an expired card is
-- the one mistake with no way back.

alter table public.billing_accounts
  add column if not exists ever_paid boolean not null default false,
  -- When the account lost access. Recomputed by the sweep rather than only
  -- written on a webhook, so a missed event can't strand the clock — and so a
  -- returning customer resets it simply by having access again.
  add column if not exists access_ended_at timestamptz,
  add column if not exists storage_purged_at timestamptz,
  add column if not exists purged_at timestamptz,
  add column if not exists purge_warned_at timestamptz,
  -- Per-account escape hatch: never touch this one automatically.
  add column if not exists purge_exempt boolean not null default false;

comment on column public.billing_accounts.purge_exempt is
  'Set true to exclude an account from all automatic deletion.';

-- Backfill: anyone with a Stripe subscription has paid at some point.
update public.billing_accounts
set ever_paid = true
where stripe_subscription_id is not null and ever_paid = false;

-- Audit trail. Automatic deletion is the one action with no undo, so what was
-- removed, when, and on what basis has to survive the deletion itself.
create table if not exists public.account_lifecycle_log (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  action text not null check (action in ('warned', 'storage_purged', 'purged', 'skipped', 'dry_run')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_lifecycle_log_owner_idx
  on public.account_lifecycle_log(owner_user_id, created_at desc);

alter table public.account_lifecycle_log enable row level security;
revoke all on table public.account_lifecycle_log from anon, authenticated;
grant select, insert on table public.account_lifecycle_log to service_role;

-- Keep access_ended_at in step with reality. Called at the start of every
-- sweep: it starts the clock for accounts that just lost access and, more
-- importantly, CLEARS it the moment access comes back.
create or replace function public.refresh_access_ended()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Access regained → clock stops and the warning is forgotten.
  update public.billing_accounts b
  set access_ended_at = null, purge_warned_at = null
  where b.access_ended_at is not null
    and public.account_plan(b.owner_user_id) <> 'free';

  -- Access lost → clock starts. Dates back to trial expiry where we know it,
  -- so a trial that lapsed weeks ago isn't given a fresh 30 days.
  update public.billing_accounts b
  set access_ended_at = coalesce(
        case when b.stripe_subscription_id is null then b.trial_ends_at end,
        b.current_period_end,
        now()
      )
  where b.access_ended_at is null
    and public.account_plan(b.owner_user_id) = 'free';
end;
$$;

-- Accounts due for something, with the reason attached. A view rather than
-- logic inside the job: the exact set can be inspected before anything is
-- deleted, and reviewed afterwards.
create or replace view public.account_lifecycle_due as
select
  b.owner_user_id,
  b.ever_paid,
  b.access_ended_at,
  b.purge_warned_at,
  b.storage_purged_at,
  b.purged_at,
  extract(day from now() - b.access_ended_at)::integer as days_without_access,
  case when b.ever_paid then 60 else 30 end  as storage_purge_after_days,
  case when b.ever_paid then 180 else 90 end as full_purge_after_days,
  case
    when b.purged_at is not null then 'done'
    when now() >= b.access_ended_at + make_interval(days => case when b.ever_paid then 180 else 90 end)
      then 'purge'
    when b.storage_purged_at is null
     and now() >= b.access_ended_at + make_interval(days => case when b.ever_paid then 60 else 30 end)
      then 'purge_storage'
    when b.purge_warned_at is null
     and now() >= b.access_ended_at + make_interval(days => (case when b.ever_paid then 60 else 30 end) - 14)
      then 'warn'
    else 'wait'
  end as due_action
from public.billing_accounts b
where b.access_ended_at is not null
  and b.purge_exempt = false;

revoke all on public.account_lifecycle_due from anon, authenticated;
grant select on public.account_lifecycle_due to service_role;
