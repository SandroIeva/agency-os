-- PDFs alongside documents.
--
-- Same table rather than a new one: they live in the same list, the same
-- folders, the same visibility rules and the same project scoping. A separate
-- table would mean duplicating all of that and merging two queries for every
-- listing.
--
-- kind = 'doc'  → content holds BlockNote block JSON (unchanged)
-- kind = 'pdf'  → file_url points at the stored file, content stays empty
alter table public.brand_documents
  add column if not exists kind text not null default 'doc'
    check (kind in ('doc', 'pdf')),
  add column if not exists file_url text,
  add column if not exists file_size bigint;

comment on column public.brand_documents.kind is
  'doc = editable document (content), pdf = uploaded file (file_url).';

-- A pdf row without a file would render as an empty viewer with no way to fix
-- it from the UI, so the pairing is enforced here rather than trusted.
alter table public.brand_documents
  drop constraint if exists brand_documents_pdf_needs_file;
alter table public.brand_documents
  add constraint brand_documents_pdf_needs_file
  check (kind <> 'pdf' or file_url is not null);
