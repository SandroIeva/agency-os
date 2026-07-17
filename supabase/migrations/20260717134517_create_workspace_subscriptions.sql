create table if not exists public.workspace_subscriptions (
  org_id uuid primary key references public.organizations(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspace_subscriptions is
  'Server-managed Stripe subscription state for each i7OS workspace.';

alter table public.workspace_subscriptions enable row level security;

-- Billing identifiers and subscription state are server-only. The Vercel
-- billing endpoints validate the Supabase user and workspace membership before
-- reading this table with the server-side secret key.
revoke all on table public.workspace_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.workspace_subscriptions to service_role;
