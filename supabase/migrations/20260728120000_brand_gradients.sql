-- Brand gradients, alongside the colour palette in the Brand Design section.
--
-- A separate column rather than a key inside color_palette: that jsonb holds
-- the palette's own shape ({primary, secondary, accents}) and is written by the
-- palette editor on every keystroke. Mixing a second, unrelated structure into
-- it would mean one editor's debounce could overwrite the other's work.
--
-- Shape: [{ id, name, angle, stops: [hex, …] }, …]
--   angle — degrees for the CSS linear-gradient
--   stops — 2 or 3 hex colours (start, optional middle, end)
-- Null means "not set yet"; the app then derives a starting set from the
-- palette so the section is never empty.
alter table public.brand_profile
  add column if not exists gradients jsonb;

comment on column public.brand_profile.gradients is
  'Brand gradients: [{id, name, angle, stops:[hex,…]}]. Null = derive from the palette.';
