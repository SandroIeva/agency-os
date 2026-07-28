-- Closes the gap left by …_read_only_mode.sql: tables that hold content but
-- carry no org_id of their own, so the workspace has to be resolved through
-- their parent row. Without these, a frozen workspace could still grow through
-- comments, checklist items and chat messages.

-- Shared predicate, so both read-only triggers decide the same way.
create or replace function public.org_is_read_only(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select pl.read_only
    from public.plan_limits pl
    where pl.plan = public.account_plan(public.org_owner(p_org))
  ), false);
$$;

create or replace function public.enforce_read_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;      -- server-side write
  if new.org_id is null then return new; end if;
  if public.org_is_read_only(new.org_id) then
    raise exception 'i7os_read_only'
      using detail = 'account has no active plan',
            hint = 'Existing content stays available; a plan is needed to make changes.';
  end if;
  return new;
end;
$$;

-- Generic child-table guard. The parent table and the foreign-key column are
-- passed as trigger arguments, and the id is read out of NEW via jsonb — the
-- dependable way to reach a dynamically named field in plpgsql.
create or replace function public.enforce_read_only_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent text := TG_ARGV[0];
  v_fk     text := TG_ARGV[1];
  v_id     uuid;
  v_org    uuid;
begin
  if auth.uid() is null then return new; end if;

  v_id := nullif(to_jsonb(new) ->> v_fk, '')::uuid;
  if v_id is null then return new; end if;

  execute format('select org_id from public.%I where id = $1', v_parent)
    into v_org using v_id;
  if v_org is null then return new; end if;

  if public.org_is_read_only(v_org) then
    raise exception 'i7os_read_only'
      using detail = format('via %s', v_parent),
            hint = 'Existing content stays available; a plan is needed to make changes.';
  end if;
  return new;
end;
$$;

do $$
declare
  spec record;
  -- child table, parent table, foreign key on the child
  specs text[][] := array[
    ['task_comments',        'tasks',              'task_id'],
    ['task_checklist_items', 'tasks',              'task_id'],
    ['task_attachments',     'tasks',              'task_id'],
    ['timeline_item_tasks',  'tasks',              'task_id'],
    ['document_comments',    'brand_documents',    'document_id'],
    ['document_shares',      'brand_documents',    'document_id'],
    ['kanban_columns',       'projects',           'project_id'],
    ['chat_messages',        'chat_conversations', 'conversation_id'],
    ['chat_participants',    'chat_conversations', 'conversation_id'],
    ['whiteboard_shares',    'whiteboards',        'board_id']
  ];
  i integer;
begin
  for i in 1 .. array_length(specs, 1) loop
    if to_regclass('public.' || specs[i][1]) is not null then
      execute format('drop trigger if exists %I on public.%I',
                     specs[i][1] || '_enforce_read_only', specs[i][1]);
      execute format(
        'create trigger %I before insert or update on public.%I
           for each row execute function public.enforce_read_only_child(%L, %L)',
        specs[i][1] || '_enforce_read_only', specs[i][1], specs[i][2], specs[i][3]
      );
    end if;
  end loop;
end $$;

-- Deliberately NOT guarded:
--   document_activity  — an append-only audit log written while merely opening a
--                        document. Blocking it would break reading, which is the
--                        one thing read-only mode is supposed to preserve.
--   project_members,
--   project_invitations — already refused for read-only accounts by the seat
--                        triggers (a read-only plan allows exactly one person),
--                        and a second guard would only obscure the message.
