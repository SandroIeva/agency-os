-- "Ich habe den KI-Schlüssel-Dialog gesehen" ist eine Tatsache über einen
-- Menschen, nicht über einen Browser. Sie stand bisher nur in localStorage,
-- und `ACCOUNT_LOCAL_KEYS` räumt die beim Wechsel des Kontos ausdrücklich weg
-- (zu Recht: sonst erbt der Nächste am selben Rechner fremde Schlüssel). Also
-- kam der Dialog nach jeder Neuanmeldung wieder, auf jedem zweiten Gerät
-- ohnehin, und "Später" hielt nur bis zum Abmelden.
--
-- `tour_seen_at` daneben ist dasselbe Muster und der Grund, warum diese Spalte
-- so heißt und nicht anders: eine Zeitmarke, kein Boolean, damit man später
-- sehen kann, wann.
alter table public.profiles
  add column if not exists ai_intro_seen_at timestamptz;

comment on column public.profiles.ai_intro_seen_at is
  'Wann diese Person den KI-Schlüssel-Dialog weggeklickt oder einen Schlüssel hinterlegt hat. Wie tour_seen_at: localStorage ist nur der Zwischenspeicher davon.';
