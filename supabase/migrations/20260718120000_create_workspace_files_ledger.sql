-- Per-file storage ledger for workspace storage-quota accounting.
--
-- Why a ledger (and not path parsing): storage buckets in this app use
-- INCONSISTENT path conventions — many objects are keyed by user id, not org id
-- (user-files, chat-attachments, creations, os-visuals …). So the object path
-- alone can't tell us which workspace an upload belongs to. Instead the client
-- records one row here at upload time (org_id + size known in that context), and
-- workspace usage = sum(size_bytes) for that org.
create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  bucket text not null,
  path text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- One ledger row per stored object; re-uploads (upsert) update the size.
  unique (bucket, path)
);

create index if not exists workspace_files_org_idx on public.workspace_files(org_id);

comment on table public.workspace_files is
  'Ledger of uploaded storage objects per workspace, for storage-quota accounting.';

alter table public.workspace_files enable row level security;

-- The client uploads directly to Storage, then records the row here, so members
-- of a workspace may read/insert/delete ledger rows for that workspace. (This is
-- soft cost-control accounting, not a security boundary — a periodic server-side
-- recompute from storage.objects is the authoritative correction.)
create policy workspace_files_select on public.workspace_files
  for select using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );
create policy workspace_files_insert on public.workspace_files
  for insert with check (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
    and created_by = auth.uid()
  );
create policy workspace_files_update on public.workspace_files
  for update using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );
create policy workspace_files_delete on public.workspace_files
  for delete using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- Efficient workspace usage total. security definer so it can aggregate the whole
-- ledger, but it only answers for a workspace the caller actually belongs to.
create or replace function public.workspace_storage_used(p_org uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  total bigint;
begin
  if not exists (
    select 1 from public.org_members where org_id = p_org and user_id = auth.uid()
  ) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  select coalesce(sum(size_bytes), 0) into total
  from public.workspace_files where org_id = p_org;
  return total;
end;
$$;
