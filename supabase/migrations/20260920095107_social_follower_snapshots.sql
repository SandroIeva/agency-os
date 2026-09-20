-- What "+3 since yesterday" under the follower count is counted from.
--
-- None of the three networks gives us a usable growth figure: Threads and
-- TikTok report only the current total, and Instagram's daily follower_count
-- metric stays silent until an account has 100 followers, which is exactly the
-- situation a new workspace is in. So we write the number down ourselves: one
-- row per account per day, written whenever Analytics is opened, and the
-- difference to the last day we saw is the growth.
--
-- Written only by the api/ functions with the service key, like every other
-- social table here: RLS on, no policies, nothing the browser can reach.
--
-- The read is always "the newest day before today for this account", which the
-- primary key's own order already serves, so there is no second index.
create table if not exists public.social_follower_snapshots (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  platform   text not null check (platform in ('instagram', 'threads', 'tiktok')),
  account_id text not null,
  day        date not null,
  followers  integer not null,
  created_at timestamptz not null default now(),
  primary key (org_id, platform, account_id, day)
);

alter table public.social_follower_snapshots enable row level security;
