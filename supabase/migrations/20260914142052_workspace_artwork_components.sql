create table public.artwork_components (
 org_id uuid not null references public.organizations(id) on delete cascade,
 id uuid not null,
 definition jsonb not null check (jsonb_typeof(definition) = 'object'),
 deleted_at timestamptz,
 primary key (org_id,id)
);
alter table public.artwork_components enable row level security;
grant select, insert, update, delete on public.artwork_components to authenticated;
create policy "Workspace component members" on public.artwork_components for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create trigger artwork_components_read_only before insert or update on public.artwork_components for each row execute function public.enforce_read_only();
