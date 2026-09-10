-- Daily estimates: shared IPs count together; no raw IP or browser identifier.
create table public.website_visits (
  day date not null default (now() at time zone 'Europe/Berlin')::date,
  visitor text not null check (visitor ~ '^[a-f0-9]{64}$'),
  country text not null,
  source text not null,
  pageviews integer not null default 1,
  last_seen timestamptz not null default now(),
  primary key(day, visitor)
);
create table public.website_pages (
  day date not null,
  path text not null,
  pageviews bigint not null default 1,
  primary key(day, path)
);
alter table public.website_visits enable row level security;
alter table public.website_pages enable row level security;
revoke all on public.website_visits, public.website_pages from public, anon, authenticated;
grant select, insert, update, delete on public.website_visits, public.website_pages to service_role;

create function public.record_website_visit(p_visitor text, p_path text, p_country text, p_source text)
returns void language plpgsql security invoker set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Berlin')::date; accepted integer;
begin
  if length(p_path) > 100 or length(p_source) > 253 or p_country !~ '^[A-Z]{2}$' then
    raise exception 'Invalid event';
  end if;
  -- Remove old daily identifiers and counters on the next incoming visit.
  delete from public.website_visits where day < d - 89;
  delete from public.website_pages where day < d - 89;
  insert into public.website_visits(day, visitor, country, source)
  values(d, p_visitor, p_country, p_source)
  on conflict (day, visitor) do update
    set pageviews = public.website_visits.pageviews + 1, last_seen = now()
    where public.website_visits.last_seen < now() - interval '2 seconds'
      and public.website_visits.pageviews < 1000;
  get diagnostics accepted = row_count;
  if accepted > 0 then
    insert into public.website_pages(day, path) values(d, p_path)
    on conflict (day, path) do update set pageviews = public.website_pages.pageviews + 1;
  end if;
end;
$$;
revoke all on function public.record_website_visit(text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_website_visit(text,text,text,text) to service_role;

create function public.admin_website_stats()
returns jsonb language sql stable security invoker set search_path = '' as $$
with bounds as (select (now() at time zone 'Europe/Berlin')::date as today),
v as (select w.* from public.website_visits w, bounds b where w.day between b.today - 29 and b.today),
daily as (
  select d::date as day, count(v.visitor) as visitors, coalesce(sum(v.pageviews),0) as pageviews
  from bounds b cross join lateral generate_series(b.today - 29, b.today, interval '1 day') d
  left join v on v.day = d::date group by d
),
countries as (select country as name, count(*) as visitors from v group by country order by visitors desc, country limit 10),
sources as (select source as name, count(*) as visitors from v group by source order by visitors desc, source limit 10),
pages as (select path as name, sum(pageviews) as pageviews from public.website_pages, bounds b where day between b.today - 29 and b.today group by path order by pageviews desc, path limit 10)
select jsonb_build_object(
  'today', (select visitors from daily, bounds b where day = b.today),
  'days7', (select coalesce(sum(visitors),0) from daily, bounds b where day >= b.today - 6),
  'days30', (select coalesce(sum(visitors),0) from daily),
  'pageviews', (select coalesce(sum(pageviews),0) from daily),
  'daily', (select jsonb_agg(to_jsonb(daily) order by day) from daily),
  'countries', coalesce((select jsonb_agg(to_jsonb(countries)) from countries),'[]'::jsonb),
  'sources', coalesce((select jsonb_agg(to_jsonb(sources)) from sources),'[]'::jsonb),
  'pages', coalesce((select jsonb_agg(to_jsonb(pages)) from pages),'[]'::jsonb)
);
$$;
revoke all on function public.admin_website_stats() from public, anon, authenticated;
grant execute on function public.admin_website_stats() to service_role;
