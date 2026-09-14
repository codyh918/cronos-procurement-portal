-- Data-preserving rollback for projects that have not entered the new financial workflow.
-- Stop application writes before running. Never drop ledgers, documents, or backups.
begin;
update public.app_records r set data=(
  select coalesce(jsonb_agg(case when b.project_id is not null and not exists(select 1 from public.atlas_managed_funds f where f.project_id=p->>'id') then jsonb_set(p,'{projectType}',b.source->'projectType') else p end order by n),'[]')
  from jsonb_array_elements(r.data) with ordinality a(p,n)
  left join public.atlas_managed_funds_legacy_backups b on b.project_id=p->>'id'
) where r.record_type='projects' and r.record_key='all';
-- Enrolled projects retain Managed Funds labels and all history. Do not reopen them
-- in a pre-migration client; export/reconcile first if a full product rollback is needed.
commit;
