-- Workspace ↔ Zernio mapping for the social-media integration (Analytics +
-- Post publishing). Each workspace gets ONE Zernio "profile" (Zernio's container
-- for connected social accounts); api/zernio.js creates it lazily on first use
-- and stores the id here. Server-only — the client talks to /api/zernio, never
-- to Zernio directly (the ZERNIO_API_KEY must never reach the browser).
create table if not exists public.workspace_social (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  zernio_profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspace_social is
  'Server-managed mapping of a workspace to its Zernio profile (social integration).';

alter table public.workspace_social enable row level security;

-- Server-only: api/zernio.js reads/writes with the service key (bypasses RLS).
revoke all on table public.workspace_social from anon, authenticated;
