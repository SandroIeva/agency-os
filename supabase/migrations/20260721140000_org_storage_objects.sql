-- Enumerate EVERY storage object that belongs to a workspace, so a workspace
-- deletion can wipe all its assets from the storage backend (not just the DB
-- rows) — including files uploaded by OTHER members. Called server-side by the
-- workspace-delete edge function (service role), which then removes the objects
-- via the Storage API and deletes the org (DB cascade handles the rest).
--
-- Sources combined for completeness:
--   1) workspace_files ledger (authoritative for tracked uploads, incl. the
--      user-scoped <uid>/ paths in user-files whose org_id we recorded on upload),
--   2) org-prefixed paths in storage.objects (catches older/untracked files),
--   3) moodboards, which live under moodboards/<boardId>/ (joined to the org).
create or replace function public.org_storage_objects(p_org uuid)
returns table (bucket text, name text)
language sql
security definer
set search_path = public
as $$
  select bucket, path from public.workspace_files where org_id = p_org
  union
  select o.bucket_id, o.name
  from storage.objects o
  where (o.bucket_id = 'brand-assets' and (
            o.name like p_org::text || '/%'
         or o.name like 'whiteboards/' || p_org::text || '/%'
         or o.name like 'documents/'   || p_org::text || '/%'))
     or (o.bucket_id = 'chat-attachments' and o.name like 'ai-images/' || p_org::text || '/%')
     or (o.bucket_id = 'project-logos' and (
            o.name like p_org::text || '/%'
         or o.name like 'org/' || p_org::text || '/%'))
  union
  select o.bucket_id, o.name
  from storage.objects o
  join public.moodboards m on m.id::text = split_part(o.name, '/', 2)
  where o.bucket_id = 'brand-assets' and o.name like 'moodboards/%' and m.org_id = p_org;
$$;

-- Server-only: called with the service key by the workspace-delete edge function.
revoke all on function public.org_storage_objects(uuid) from public, anon, authenticated;
grant execute on function public.org_storage_objects(uuid) to service_role;
