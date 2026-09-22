-- Wer den direkten Weg zu Meta benutzen darf, steht jetzt an der Zeile und
-- nicht mehr in einer Umgebungsvariablen.
--
-- INSTAGRAM_DIRECT_ORGS war richtig, solange es genau einen Workspace gab: eine
-- Liste in Vercel, und der Code liest sie. Nur kostet jeder neue Tester damit
-- einen Deploy, und das ist keine Verwaltung, das ist ein Release.
--
-- Der direkte Weg kostet uns pro Nutzung nichts, anders als Zernio. Er darf
-- deshalb an Tester gehen, ohne dass sie einen bezahlten Plan haben. Was er
-- NICHT tut: er schaltet kein anderes Feature frei. Nur Instagram und Threads
-- verbinden, deren Zahlen lesen und darauf veröffentlichen.
--
-- Die Umgebungsvariable bleibt gültig. Beides zusammen entscheidet, damit ein
-- Eintrag, der heute dort steht, nicht mit dieser Migration verschwindet.
alter table public.organizations
  add column if not exists social_direct boolean not null default false;

comment on column public.organizations.social_direct is
  'Darf dieser Workspace Instagram und Threads direkt ueber Meta verbinden, statt ueber Zernio? Gesetzt im Admin-Dashboard. Wirkt zusaetzlich zu INSTAGRAM_DIRECT_ORGS, nicht statt dessen.';

-- Die Workspace-Tabelle im Admin-Dashboard zeigt den Schalter, also muss die
-- Sicht ihn fuehren. Sonst unveraendert.
create or replace view public.admin_workspaces as
 select o.name as workspace,
    o.created_at::date as angelegt,
    ou.email as besitzer,
    account_plan(o.created_by) as plan,
    ( select count(*) from org_members m where m.org_id = o.id) as mitglieder,
    ( select string_agg(coalesce(pr.display_name, mu.email::text), ', '::text order by m.joined_at)
        from org_members m
          join auth.users mu on mu.id = m.user_id
          left join profiles pr on pr.id = m.user_id
       where m.org_id = o.id) as personen,
    ( select count(*) from projects p where p.org_id = o.id) as projekte,
    round(coalesce(( select sum(f.size_bytes) from workspace_files f where f.org_id = o.id), 0::numeric) / 1048576.0, 1) as speicher_mb,
    o.id as workspace_id,
    -- ANS ENDE, nicht dazwischen: `create or replace view` darf Spalten nur
    -- anhaengen, eine eingeschobene benennt die nachfolgende um und Postgres
    -- lehnt das ab.
    o.social_direct
   from organizations o
     left join auth.users ou on ou.id = o.created_by;

-- Dieselbe Absicherung wie vorher: die Sicht gehoert dem Dienstschluessel, der
-- Browser kommt nicht heran.
revoke all on public.admin_workspaces from anon, authenticated;
