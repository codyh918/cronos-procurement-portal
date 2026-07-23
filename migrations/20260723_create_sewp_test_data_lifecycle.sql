-- Admin-only support function for permanently purging soft-deleted SEWP test data.
create or replace function public.purge_deleted_sewp_rfq_test_data(p_rfq_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.sewp_rfqs;
  target_import_id uuid;
  target_project_id uuid;
begin
  select * into target
  from public.sewp_rfqs
  where id = p_rfq_id and deleted_at is not null
  for update;

  if not found then
    raise exception 'Deleted RFQ not found' using errcode = 'P0002';
  end if;

  target_import_id := target.import_id;
  target_project_id := target.atlas_project_id;

  update public.sewp_rfqs
  set import_id = null, atlas_project_id = null
  where id = target.id;

  if target_project_id is not null then
    update public.atlas_projects set sewp_rfq_id = null where id = target_project_id;
  end if;

  if target_import_id is not null then
    update public.sewp_rfq_imports
    set created_rfq_id = null, created_project_id = null
    where id = target_import_id;
  end if;

  if target_project_id is not null then
    delete from public.atlas_projects where id = target_project_id;
  end if;

  delete from public.sewp_rfqs where id = target.id;

  if target_import_id is not null then
    delete from public.sewp_rfq_imports where id = target_import_id;
  end if;

  return jsonb_build_object(
    'rfqId', target.id,
    'officialRfqNumber', target.official_rfq_number,
    'projectId', target_project_id,
    'importId', target_import_id
  );
end;
$$;

revoke all on function public.purge_deleted_sewp_rfq_test_data(uuid) from public, anon, authenticated;

