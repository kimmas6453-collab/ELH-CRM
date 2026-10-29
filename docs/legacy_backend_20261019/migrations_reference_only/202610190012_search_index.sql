begin;
create extension if not exists pg_trgm with schema extensions;
create index leads_search_folded_trgm on public.leads using gin(search_folded extensions.gin_trgm_ops);
commit;
