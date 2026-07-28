-- Adds a heartbeat row to the lifecycle log.
--
-- Why: the sweep only wrote a row when an account was actually due for
-- something. So an empty log meant either "nobody is due" or "the job never
-- ran" — and those are the two things you most need to tell apart before
-- trusting the job with irreversible deletions. Now every run leaves a trace,
-- and an empty log unambiguously means something is broken.
alter table public.account_lifecycle_log
  drop constraint if exists account_lifecycle_log_action_check;

alter table public.account_lifecycle_log
  add constraint account_lifecycle_log_action_check
  check (action in ('warned', 'storage_purged', 'purged', 'skipped', 'dry_run', 'heartbeat'));

-- Convenience view for the "is this thing alive and what would it do" check.
create or replace view public.account_lifecycle_runs as
select
  created_at,
  (detail ->> 'armed')::boolean      as scharf_geschaltet,
  (detail ->> 'considered')::integer as kandidaten,
  (detail ->> 'warned')::integer     as gewarnt,
  (detail ->> 'storagePurged')::integer as dateien_geloescht,
  (detail ->> 'purged')::integer     as komplett_geloescht,
  (detail ->> 'failed')::integer     as fehlgeschlagen
from public.account_lifecycle_log
where action = 'heartbeat'
order by created_at desc;

revoke all on public.account_lifecycle_runs from anon, authenticated;
grant select on public.account_lifecycle_runs to service_role;
