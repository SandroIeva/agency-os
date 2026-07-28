-- Read-only mode for accounts without access (expired trial, cancelled plan).
--
-- The agreed policy is that nothing is ever deleted at this point: existing
-- content stays visible and exportable, but the workspace stops growing. This
-- is stage 0 of the account lifecycle — see …_account_lifecycle.sql for the
-- later stages that actually reclaim space.
--
-- Two deliberate carve-outs:
--   • DELETE is never blocked. Someone winding down must be able to clean up,
--     and the lifecycle purge itself relies on deletes working.
--   • Writes with no JWT (auth.uid() is null) pass through. That is the
--     service-key path used by the Stripe webhook, the token metering and the
--     purge job; freezing our own maintenance would be self-defeating.
create or replace function public.enforce_read_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_read_only boolean;
begin
  -- Server-side write (service key, no end user) — never frozen.
  if auth.uid() is null then
    return new;
  end if;

  if new.org_id is null then
    return new;
  end if;

  v_owner := public.org_owner(new.org_id);
  if v_owner is null then
    return new;
  end if;

  select read_only into v_read_only
  from public.plan_limits
  where plan = public.account_plan(v_owner);

  if coalesce(v_read_only, false) then
    raise exception 'i7os_read_only'
      using detail = 'account has no active plan',
            hint = 'Existing content stays available; a plan is needed to make changes.';
  end if;

  return new;
end;
$$;

-- Attached to the content tables that carry org_id. Infrastructure tables are
-- intentionally left out: notifications (other people's messages must still
-- arrive), workspace_files (the storage ledger has to stay accurate while
-- things are deleted), token_usage (server metering), org_members and
-- invitations (leaving or being removed must always work), and the billing
-- tables themselves.
do $$
declare
  t text;
  content_tables text[] := array[
    'projects', 'tasks', 'timeline_items', 'sprint_groups',
    'brand_documents', 'brand_profile', 'brand_shares', 'document_folders',
    'whiteboards', 'whiteboard_items',
    'moodboards', 'moodboard_items',
    'user_files', 'user_folders', 'project_files', 'file_metadata',
    'notes', 'calendar_events', 'reminders', 'chat_conversations'
  ];
begin
  foreach t in array content_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_enforce_read_only', t);
      execute format(
        'create trigger %I before insert or update on public.%I
           for each row execute function public.enforce_read_only()',
        t || '_enforce_read_only', t
      );
    end if;
  end loop;
end $$;
