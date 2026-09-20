-- Geplante Beiträge für die direkten Kanäle.
--
-- Threads und Instagram kennen in ihrer API keinen geplanten Beitrag, sie
-- veröffentlichen sofort oder gar nicht. "Später" bedeutet bei diesen Kanälen
-- deshalb: WIR heben den Beitrag auf und schicken ihn zur Zeit raus. Das ist
-- diese Tabelle, und api/publish-due arbeitet sie ab, angestoßen von pg_cron.
--
-- Anders als die Social-Verbindungen ist sie aus dem Browser lesbar: eine
-- Warteschlange, in die niemand hineinsehen kann, ist schlimmer als keine.
-- Geschrieben wird die Zeile von der Person, veröffentlicht wird mit dem
-- Service-Key.
create table if not exists public.scheduled_posts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  created_by   uuid not null references auth.users(id) on delete cascade,
  publish_at   timestamptz not null,
  status       text not null default 'queued'
               check (status in ('queued', 'processing', 'done', 'failed', 'cancelled')),
  body         text,
  targets      jsonb not null default '[]'::jsonb,
  media        jsonb not null default '[]'::jsonb,
  -- Ein Container, der noch umgerechnet wird, überlebt den Takt: der nächste
  -- Durchgang fragt ihn nur noch ab, statt ihn neu zu bauen. Ein zweiter
  -- Container wäre ein zweiter Beitrag.
  containers   jsonb not null default '{}'::jsonb,
  attempts     int not null default 0,
  last_error   text,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists scheduled_posts_due on public.scheduled_posts (status, publish_at);
create index if not exists scheduled_posts_org on public.scheduled_posts (org_id, publish_at desc);

alter table public.scheduled_posts enable row level security;

create policy "Queue readable by workspace" on public.scheduled_posts
  for select using (public.is_org_member(org_id));
create policy "Queue written by members" on public.scheduled_posts
  for insert with check (public.is_org_member(org_id) and created_by = auth.uid());
-- Ändern nur, solange nichts rausgegangen ist.
create policy "Queue changed while waiting" on public.scheduled_posts
  for update using (public.is_org_member(org_id) and status in ('queued', 'failed'))
  with check (public.is_org_member(org_id));
create policy "Queue deleted by members" on public.scheduled_posts
  for delete using (public.is_org_member(org_id));

-- Planen ist Schreiben, und ohne Plan ist der Workspace schreibgeschützt.
create trigger scheduled_posts_enforce_read_only
  before insert or update on public.scheduled_posts
  for each row execute function public.enforce_read_only();
