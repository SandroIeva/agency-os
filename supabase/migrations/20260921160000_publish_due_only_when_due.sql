-- Der Takt ruft nur noch raus, wenn es etwas zu tun gibt.
--
-- Vorher rief pg_cron alle fünf Minuten die Vercel-Funktion, also 288 Mal am
-- Tag, rund 8.600 Mal im Monat. Die Funktion las dann eine Zeile aus
-- scheduled_posts, fand nichts und antwortete {"due":0}. An den allermeisten
-- Tagen ist nichts geplant, also war das 8.600 Mal Funktion starten, um
-- festzustellen, dass nichts zu tun ist.
--
-- Vercels Free-Plan rechnet in "Fluid Active CPU" und gibt vier Stunden im
-- Monat. Ein Aufruf, der nichts findet, ist billig, aber nicht kostenlos, und
-- er läuft eben immer.
--
-- Die Frage, ob etwas fällig ist, kann Postgres selbst beantworten: es ist
-- dieselbe Abfrage, die die Funktion sonst als erstes gemacht hätte, nur
-- innerhalb der Datenbank und damit umsonst. Das WHERE hängt am Ausdruck, also
-- wird net.http_post gar nicht erst ausgewertet, wenn nichts ansteht.
--
-- Was sich NICHT ändert: ist etwas fällig, läuft es wie bisher alle fünf
-- Minuten, bis es durch ist. Ein Beitrag wird dadurch keine Sekunde später
-- veröffentlicht.
select cron.unschedule('i7os-publish-due');

select cron.schedule('i7os-publish-due', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://app.i7os.com/api/publish-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-i7-hook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'publish_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (
    select 1 from public.scheduled_posts
    where status in ('queued', 'processing')
      and publish_at <= now()
  );
$$);
