-- Applied to production on 2026-09-19 as three migrations:
-- user_ai_keys_models, user_app_visits, admin_views_app_visits.

-- ── The AI model a person chose, per provider ───────────────────────────────
-- e.g. {"claude": "claude-opus-5"}. Empty means the default in src/aiModels.js.
-- Same row, same RLS as the keys; api/chat-multi reads it with the service key.
alter table public.user_ai_keys add column if not exists models jsonb not null default '{}'::jsonb;

-- ── How often people come BACK to the app ────────────────────────────────────
-- For the operator overview (/?admin). last_sign_in_at cannot answer it: a
-- session stays signed in for weeks. One row per person per Berlin day. A
-- visit is the app being opened, or the tab being returned to after at least
-- 30 minutes away; the server enforces the 30 minutes.
create table if not exists public.user_app_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  visits integer not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.user_app_visits enable row level security;
-- No policies: written only through track_app_visit(), read only by admin_* views.
revoke all on public.user_app_visits from anon, authenticated;

-- p_leave: the tab is being left. Moves last_at without counting.
create or replace function public.track_app_visit(p_leave boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Berlin')::date;
  prev timestamptz;
begin
  if uid is null then return; end if;
  select max(last_at) into prev from public.user_app_visits where user_id = uid;
  if p_leave then
    update public.user_app_visits set last_at = now() where user_id = uid and day = today;
    return;
  end if;
  insert into public.user_app_visits (user_id, day, visits, first_at, last_at)
  values (uid, today, case when prev is null or now() - prev >= interval '30 minutes' then 1 else 0 end, now(), now())
  on conflict (user_id, day) do update
    set visits = public.user_app_visits.visits
          + case when now() - public.user_app_visits.last_at >= interval '30 minutes' then 1 else 0 end,
        last_at = now();
end;
$$;
revoke all on function public.track_app_visit(boolean) from public, anon;
grant execute on function public.track_app_visit(boolean) to authenticated;

-- ── Visits in the operator overview ──────────────────────────────────────────
-- Existing columns keep name, type and order; new ones are appended.
create or replace view public.admin_users as
 select u.email,
    coalesce(p.display_name, '—'::text) as name,
    u.created_at::date as registriert,
    greatest(u.last_sign_in_at, v.letzter_besuch)::date as zuletzt_aktiv,
    account_plan(u.id) as plan,
    b.status as abo_status,
    b.trial_ends_at::date as trial_bis,
    ( select count(*) from organizations o where o.created_by = u.id) as eigene_workspaces,
    ( select count(*) from org_members m join organizations o2 on o2.id = m.org_id
       where m.user_id = u.id and o2.created_by <> u.id) as gast_in,
    round(coalesce(( select sum(f.size_bytes) from workspace_files f join organizations o3 on o3.id = f.org_id
       where o3.created_by = u.id), 0::numeric) / 1048576.0, 1) as speicher_mb,
    coalesce(v.besuche_7_tage, 0) as besuche_7_tage,
    coalesce(v.besuche_30_tage, 0) as besuche_30_tage,
    coalesce(v.besuche_gesamt, 0) as besuche_gesamt,
    coalesce(v.aktive_tage_30, 0) as aktive_tage_30,
    v.letzter_besuch
   from auth.users u
     left join profiles p on p.id = u.id
     left join billing_accounts b on b.owner_user_id = u.id
     left join lateral (
       select sum(a.visits) filter (where a.day > (now() at time zone 'Europe/Berlin')::date - 7) as besuche_7_tage,
              sum(a.visits) filter (where a.day > (now() at time zone 'Europe/Berlin')::date - 30) as besuche_30_tage,
              sum(a.visits) as besuche_gesamt,
              count(*) filter (where a.day > (now() at time zone 'Europe/Berlin')::date - 30) as aktive_tage_30,
              max(a.last_at) as letzter_besuch
         from user_app_visits a where a.user_id = u.id
     ) v on true;

create or replace view public.admin_summary as
 select ( select count(*) from auth.users) as nutzer_gesamt,
    ( select count(*) from auth.users where users.last_sign_in_at is null) as nie_eingeloggt,
    ( select count(*) from auth.users u where not (exists ( select 1 from organizations o where o.created_by = u.id))) as ohne_workspace,
    ( select count(*) from auth.users where users.created_at > (now() - '7 days'::interval)) as neu_7_tage,
    ( select count(*) from auth.users where users.last_sign_in_at > (now() - '7 days'::interval)) as aktiv_7_tage,
    ( select count(*) from organizations) as workspaces,
    ( select count(*) from billing_accounts
       where billing_accounts.stripe_subscription_id is not null and (billing_accounts.status = any (array['active'::text, 'past_due'::text]))) as zahlende_kunden,
    ( select count(*) from billing_accounts b where account_plan(b.owner_user_id) = 'starter'::text and b.stripe_subscription_id is null) as im_trial,
    round(coalesce(( select sum(workspace_files.size_bytes) from workspace_files), 0::numeric) / 1048576.0, 1) as speicher_mb_gesamt,
    ( select coalesce(sum(visits), 0) from user_app_visits where day = (now() at time zone 'Europe/Berlin')::date) as besuche_heute,
    ( select count(distinct user_id) from user_app_visits where day = (now() at time zone 'Europe/Berlin')::date) as nutzer_heute,
    ( select count(distinct user_id) from user_app_visits where day > (now() at time zone 'Europe/Berlin')::date - 7) as nutzer_7_tage,
    ( select count(*) from ( select user_id from user_app_visits
        where day > (now() at time zone 'Europe/Berlin')::date - 7
        group by user_id having count(*) >= 2) r) as wiederkehrend_7_tage,
    ( select min(day) from user_app_visits) as besuche_seit;
