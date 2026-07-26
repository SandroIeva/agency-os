-- Self-service account deletion. Callable by the signed-in user for THEIR OWN
-- account only (SECURITY DEFINER + auth.uid() guard), mirroring delete_organization.
--
-- Why an RPC and not a plain auth-user delete: ~12 public tables reference
-- auth.users with ON DELETE NO ACTION (organizations, whiteboards, moodboards,
-- brand_documents, task_comments, timeline_items, …). Any content the user
-- created would otherwise block the delete. This function clears those blockers
-- in the right order, then deletes the auth user (which cascades everything with
-- ON DELETE CASCADE: profile, memberships, notes, files, chat, kanban, …).
--
-- Product policy (chosen by the team):
--   • Workspaces the user OWNS (created) are deleted entirely — including shared
--     ones with other members (their access goes too). Cascade via organizations.
--   • Content the user authored in OTHER people's workspaces is ANONYMIZED
--     (created_by → NULL) so teammates' work survives. Columns that are NOT NULL
--     (their own task comments/attachments, sent invites) are removed instead.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- 1) Delete every workspace the user created — cascades all its content.
  delete from public.organizations where created_by = uid;

  -- 2) Anonymize the user's authored content that lives in workspaces owned by
  --    others (nullable NO-ACTION FKs that would otherwise block the delete).
  update public.whiteboards      set created_by = null where created_by = uid;
  update public.whiteboard_items set created_by = null where created_by = uid;
  update public.moodboards       set created_by = null where created_by = uid;
  update public.moodboard_items  set created_by = null where created_by = uid;
  update public.brand_documents  set created_by = null where created_by = uid;
  update public.document_folders set created_by = null where created_by = uid;
  update public.timeline_items   set created_by = null where created_by = uid;
  update public.project_files    set user_id    = null where user_id    = uid;

  -- 3) Non-nullable contributions in others' workspaces → remove (user's own data).
  delete from public.task_comments    where user_id    = uid;
  delete from public.task_attachments where user_id    = uid;
  delete from public.invitations      where invited_by = uid;

  -- 4) Finally the auth user — cascades profile, memberships, notes, files, chat,
  --    kanban, reminders, tokens, push subs, google tokens, etc.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
