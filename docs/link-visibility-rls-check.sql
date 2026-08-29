-- Does "private" actually mean private?
--
-- Every table in this app is writable through the anon key, so a link that is
-- only hidden by a client-side filter is not hidden. This proves the boundary
-- is in Postgres. It writes two rows, reads them as two different members of
-- the same workspace, and rolls the whole thing back: the closing `raise`
-- aborts the block, and the savepoint takes the inserts with it.
--
-- Fill in an org and two of its members:
--   select org_id, min(user_id) a, max(user_id) b from org_members
--   group by org_id having count(*) >= 2 limit 1;
--
-- Expected: author sees 2 of 2; other sees shared: 1; other sees private: 0;
--           other updated private rows: 0; other deleted private rows: 0
do $$
declare
  org  uuid := '00000000-0000-0000-0000-000000000000';  -- ← the workspace
  ua   uuid := '00000000-0000-0000-0000-000000000000';  -- ← member A, the author
  ub   uuid := '00000000-0000-0000-0000-000000000000';  -- ← member B, anybody else
  priv uuid; shared uuid; n int; out text := '';
begin
  insert into workspace_links (org_id, title, url, visibility, created_by)
  values (org, 'A private one', 'https://example.com/p', 'private', ua) returning id into priv;
  insert into workspace_links (org_id, title, url, visibility, created_by)
  values (org, 'A shared one', 'https://example.com/s', 'workspace', ua) returning id into shared;

  perform set_config('request.jwt.claims', json_build_object('sub', ua)::text, true);
  set local role authenticated;
  select count(*) into n from workspace_links where id in (priv, shared);
  out := out || 'author sees ' || n || ' of 2; ';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub)::text, true);
  set local role authenticated;
  select count(*) into n from workspace_links where id = shared;
  out := out || 'other sees shared: ' || n || '; ';
  select count(*) into n from workspace_links where id = priv;
  out := out || 'other sees private: ' || n || '; ';
  update workspace_links set title = 'stolen' where id = priv;
  get diagnostics n = row_count;
  out := out || 'other updated private rows: ' || n || '; ';
  delete from workspace_links where id = priv;
  get diagnostics n = row_count;
  out := out || 'other deleted private rows: ' || n;

  reset role;
  raise exception 'RESULT >> %', out;   -- the abort IS the cleanup
end $$;
