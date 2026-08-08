-- Image (and later video) generation jobs.
--
-- The upstream provider is asynchronous for nearly every model: the submit call
-- answers with a request id and the result arrives seconds to minutes later. A
-- Vercel function cannot wait that long, so the job has to outlive the request
-- that started it — and the browser that started it, since people close tabs.
--
-- It also has to outlive the request for a second reason: this is the record of
-- what we owe. Cost is written when a job COMPLETES, not when it is submitted,
-- so a failed generation is never billed to anyone's allowance.
create table if not exists public.generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'image' check (kind in ('image', 'video')),
  model         text not null,
  prompt        text,
  -- The provider's own id, and where to ask about it. Stored rather than
  -- derived: the polling URL is handed to us and its shape is theirs to change.
  provider_request_id text,
  polling_url   text,
  status        text not null default 'queued'
                check (status in ('queued', 'running', 'completed', 'failed')),
  -- Micro-USD, so the price of a single image is still an integer. Costs of a
  -- fraction of a cent are exactly where floating point starts lying.
  cost_micro_usd bigint not null default 0,
  result_url    text,          -- our copy, in storage — not the provider's link
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists generation_jobs_org_created_idx
  on public.generation_jobs (org_id, created_at desc);
-- The status poll looks jobs up by provider id; without this it scans.
create index if not exists generation_jobs_provider_idx
  on public.generation_jobs (provider_request_id)
  where provider_request_id is not null;
-- Monthly allowance sums live jobs per org over a period.
create index if not exists generation_jobs_billing_idx
  on public.generation_jobs (org_id, status, completed_at);

alter table public.generation_jobs enable row level security;

-- Members of the workspace may READ their jobs, so the UI can show progress and
-- history. Nobody writes through the anon key: every insert and update comes
-- from api/generate.js with the service key, which is what makes the allowance
-- check unavoidable. A client-side insert would be a free image.
drop policy if exists generation_jobs_select on public.generation_jobs;
create policy generation_jobs_select on public.generation_jobs
  for select using (
    exists (
      select 1 from public.org_members m
      where m.org_id = generation_jobs.org_id and m.user_id = auth.uid()
    )
  );

comment on table public.generation_jobs is
  'Async image/video generation jobs. Written only by api/generate.js via the service key; cost is recorded on completion, never on submission.';
