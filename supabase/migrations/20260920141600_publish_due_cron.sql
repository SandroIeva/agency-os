-- Der Takt für geplante Beiträge.
--
-- Vercels Cron kann auf unserem Plan einmal am Tag, was für "heute 18:30" nichts
-- nützt. pg_cron kann alle fünf Minuten, und pg_net trägt den Aufruf nach
-- draußen, mit dem Geheimnis aus dem Vault, genau wie der Telegram-Anstoß.
--
-- Das Geheimnis selbst steht NICHT hier: es wird einmal von Hand angelegt
--   select vault.create_secret('<wert>', 'publish_secret', '...');
-- und derselbe Wert liegt in Vercel als PUBLISH_SECRET. Ohne beides antwortet
-- api/publish-due mit 503 und es passiert nichts.
create extension if not exists pg_cron;

select cron.schedule('i7os-publish-due', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://app.i7os.com/api/publish-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-i7-hook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'publish_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
$$);
