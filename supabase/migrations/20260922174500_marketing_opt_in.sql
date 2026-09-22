-- Einwilligung in Produkt-Updates per E-Mail.
--
-- Drei Spalten, nicht eine. Ein blosses Ja oder Nein reicht nicht: im Streitfall
-- musst du belegen koennen, WANN jemand zugestimmt hat und WO. Ohne das ist die
-- Einwilligung eine Behauptung.
--
-- `null` heisst "noch nicht gefragt" und ist deshalb der Startwert, nicht false.
-- Wer nie gefragt wurde, hat weder zugestimmt noch abgelehnt, und nur beim
-- Ungefragten stellt sich die Frage ueberhaupt noch.
--
-- Das Gegenstueck dazu steht nicht hier: eine Abmeldung beim Versender muss
-- ihren Weg zurueck in diese Spalte finden, sonst laufen die beiden Listen
-- auseinander und es werden Leute angeschrieben, die sich abgemeldet haben.
alter table public.profiles
  add column if not exists marketing_opt_in boolean,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists marketing_opt_in_source text;

comment on column public.profiles.marketing_opt_in is
  'Einwilligung in Produkt-Updates per E-Mail. null = noch nicht gefragt, nicht abgelehnt.';
comment on column public.profiles.marketing_opt_in_at is
  'Wann die Entscheidung getroffen wurde. Der Nachweis, nicht die Deko.';
comment on column public.profiles.marketing_opt_in_source is
  'Wo sie getroffen wurde: "dialog" (die einmalige Frage) oder "settings" (die Zeile zum Widerrufen).';
