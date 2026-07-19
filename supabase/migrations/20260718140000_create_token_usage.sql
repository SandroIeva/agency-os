-- AI token-usage ledger for per-workspace consumption tracking (and the future
-- credit system). Written SERVER-SIDE by the chat-multi function using the
-- service key (so clients can't spoof it) — hence no client insert policy.
create table if not exists public.token_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text,                                   -- 'claude' | 'openai' | 'gemini'
  model text,
  feature text,                                    -- 'chat' | 'image-to-prompt' | 'persona' | …
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  -- true = user's own API key / OAuth (informational only, no cost to us);
  -- false = our managed key (billable against credits, once that exists).
  byok boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists token_usage_org_month_idx on public.token_usage(org_id, created_at);

comment on table public.token_usage is
  'Per-call AI token usage per workspace. Written server-side by chat-multi.';

alter table public.token_usage enable row level security;

-- Members may READ their workspace's usage (for the Settings display). Inserts
-- happen server-side with the service key (which bypasses RLS), so there is
-- deliberately no client insert/update/delete policy.
create policy token_usage_select on public.token_usage
  for select using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- Aggregated usage for a workspace since a given time (default: caller passes the
-- start of the current month). Grouped by provider + feature for the breakdown.
-- security definer + membership check so a member only sees their own workspace.
create or replace function public.workspace_token_usage(p_org uuid, p_since timestamptz)
returns table (provider text, feature text, byok boolean, input_tokens bigint, output_tokens bigint, calls bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.org_members where org_id = p_org and user_id = auth.uid()
  ) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  return query
    select t.provider, t.feature, t.byok,
           coalesce(sum(t.input_tokens), 0)::bigint,
           coalesce(sum(t.output_tokens), 0)::bigint,
           count(*)::bigint
    from public.token_usage t
    where t.org_id = p_org and t.created_at >= p_since
    group by t.provider, t.feature, t.byok;
end;
$$;
