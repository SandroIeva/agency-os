-- Operator overview: who signed up, which workspaces exist, and who belongs to
-- which. Views rather than an app screen — no serverless function (the Hobby
-- Node budget is full), no deploy, and the numbers are always live.
--
-- SECURITY: these expose every user's email address across all workspaces. A
-- view runs with its owner's rights and therefore bypasses the RLS on the
-- tables underneath, so access is revoked from anon and authenticated and
-- granted only to service_role. That means: readable from the Supabase SQL
-- editor and the service key, never from the browser client.

-- ── Per workspace: owner, plan, who is in it, what it holds ────────────────
create or replace view public.admin_workspaces as
select
  o.name                                            as workspace,
  o.created_at::date                                as angelegt,
  ou.email                                          as besitzer,
  public.account_plan(o.created_by)                 as plan,
  (select count(*) from public.org_members m where m.org_id = o.id) as mitglieder,
  (select string_agg(coalesce(pr.display_name, mu.email), ', ' order by m.joined_at)
     from public.org_members m
     join auth.users mu on mu.id = m.user_id
     left join public.profiles pr on pr.id = m.user_id
    where m.org_id = o.id)                          as personen,
  (select count(*) from public.projects p where p.org_id = o.id) as projekte,
  round(coalesce((select sum(f.size_bytes) from public.workspace_files f
                   where f.org_id = o.id), 0) / 1048576.0, 1)     as speicher_mb,
  o.id                                              as workspace_id
from public.organizations o
left join auth.users ou on ou.id = o.created_by;

revoke all on public.admin_workspaces from anon, authenticated;
grant select on public.admin_workspaces to service_role;

-- ── Per user: registration, activity, what they own ────────────────────────
create or replace view public.admin_users as
select
  u.email,
  coalesce(p.display_name, '—')                     as name,
  u.created_at::date                                as registriert,
  u.last_sign_in_at::date                           as zuletzt_aktiv,
  public.account_plan(u.id)                         as plan,
  b.status                                          as abo_status,
  b.trial_ends_at::date                             as trial_bis,
  (select count(*) from public.organizations o where o.created_by = u.id) as eigene_workspaces,
  -- Workspaces they belong to but did NOT create — tells invited members apart
  -- from owners, which the raw member count alone cannot.
  (select count(*) from public.org_members m
     join public.organizations o2 on o2.id = m.org_id
    where m.user_id = u.id and o2.created_by <> u.id) as gast_in,
  round(coalesce((select sum(f.size_bytes) from public.workspace_files f
                   join public.organizations o3 on o3.id = f.org_id
                  where o3.created_by = u.id), 0) / 1048576.0, 1) as speicher_mb
from auth.users u
left join public.profiles p on p.id = u.id
left join public.billing_accounts b on b.owner_user_id = u.id;

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to service_role;

-- ── One-line summary ───────────────────────────────────────────────────────
-- "Registered but never created a workspace" is deliberately its own number:
-- it is the drop-off between signing up and actually starting, and nothing
-- else in the product surfaces it.
create or replace view public.admin_summary as
select
  (select count(*) from auth.users)                                          as nutzer_gesamt,
  (select count(*) from auth.users where last_sign_in_at is null)            as nie_eingeloggt,
  (select count(*) from auth.users u
    where not exists (select 1 from public.organizations o where o.created_by = u.id)) as ohne_workspace,
  (select count(*) from auth.users where created_at > now() - interval '7 days')  as neu_7_tage,
  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as aktiv_7_tage,
  (select count(*) from public.organizations)                                as workspaces,
  (select count(*) from public.billing_accounts
    where stripe_subscription_id is not null and status in ('active','past_due')) as zahlende_kunden,
  (select count(*) from public.billing_accounts b
    where public.account_plan(b.owner_user_id) = 'starter'
      and b.stripe_subscription_id is null)                                  as im_trial,
  round(coalesce((select sum(size_bytes) from public.workspace_files), 0) / 1048576.0, 1) as speicher_mb_gesamt;

revoke all on public.admin_summary from anon, authenticated;
grant select on public.admin_summary to service_role;
