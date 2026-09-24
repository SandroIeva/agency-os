-- Ein halb fertiger Beitrag, während der Bot nach dem Text fragt.
--
-- Alles andere in den Messengern kommt ohne Zwischenspeicher aus: der Zustand
-- steckt in den Knöpfen und in der Antwort-Verkettung, und das ist gut so, denn
-- ein Zustand, der nirgends liegt, kann auch nicht ablaufen oder verwaisen.
--
-- Freier Text bricht diese Kette. Antwortet jemand auf eine Frage des Bots,
-- reicht Telegram die Frage mit, aber nur EINE Ebene tief: die Nachricht mit
-- dem Bild dahinter ist dann nicht mehr erreichbar. Also muss irgendwo stehen,
-- worauf sich der Text bezieht.
--
-- Der Schlüssel ist die Nachricht, die die Frage stellt (`telegram:<chat>:<id>`)
-- beziehungsweise Slacks private_metadata. Damit gehört ein Entwurf immer zu
-- genau einer Frage, und zwei parallele Beiträge kommen sich nicht ins Gehege.
create table if not exists public.messenger_drafts (
  key        text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists messenger_drafts_age on public.messenger_drafts (created_at);

-- Nur der Dienstschlüssel. Die Messenger-Funktionen lesen und schreiben das,
-- der Browser hat damit nichts zu tun.
alter table public.messenger_drafts enable row level security;

comment on table public.messenger_drafts is
  'Halb fertiger Social Post, während der Bot nach dem Beitragstext fragt. Kurzlebig, wird beim Einlösen gelöscht und sonst nach einem Tag.';
