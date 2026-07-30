-- Deterministic SEWP email import. Apply after 20260722_create_sewp_rfq_foundation.sql.
create type public.sewp_import_status as enum (
  'uploaded','extracting','review_required','ready_for_approval',
  'creating_project','completed','failed','duplicate','superseded'
);

alter table public.sewp_rfqs add column if not exists atlas_project_id uuid;
alter table public.sewp_rfqs add column if not exists sewp_request_id text;
alter table public.sewp_rfqs add column if not exists modification_level text;
alter table public.sewp_rfqs add column if not exists import_id uuid;

create table public.atlas_projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique,
  project_name text not null,
  project_type text not null default 'SEWP RFQ',
  status text not null default 'RFQ Received',
  vehicle text not null default 'SEWP',
  sewp_rfq_id uuid unique references public.sewp_rfqs(id),
  sewp_request_id text,
  agency text,
  government_customer jsonb not null default '{}'::jsonb,
  customer_address jsonb not null default '{}'::jsonb,
  shipping_information jsonb not null default '{}'::jsonb,
  reply_deadline timestamptz,
  requirements jsonb not null default '{}'::jsonb,
  import_warnings jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sewp_rfqs
  add constraint sewp_rfqs_atlas_project_fk foreign key (atlas_project_id) references public.atlas_projects(id);

create table public.sewp_rfq_imports (
  id uuid primary key default gen_random_uuid(),
  status public.sewp_import_status not null default 'uploaded',
  original_filename text not null,
  original_file_size bigint not null check (original_file_size > 0),
  original_file_hash text not null check (original_file_hash ~ '^[0-9a-f]{64}$'),
  original_storage_key text not null unique,
  message_subject text,
  message_id text,
  sewp_request_id text,
  agency_id text,
  modification_level text,
  imported_by uuid not null references auth.users(id),
  imported_at timestamptz not null default now(),
  parser_version text not null,
  extraction_version text not null,
  extraction_data jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_rfq_id uuid references public.sewp_rfqs(id),
  created_project_id uuid references public.atlas_projects(id),
  idempotency_key text unique,
  updated_at timestamptz not null default now()
);

alter table public.sewp_rfqs
  add constraint sewp_rfqs_import_fk foreign key (import_id) references public.sewp_rfq_imports(id);

create unique index sewp_import_exact_duplicate on public.sewp_rfq_imports(original_file_hash);
create index sewp_import_business_key on public.sewp_rfq_imports(sewp_request_id, modification_level, agency_id);

create table public.sewp_rfq_import_attachments (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sewp_rfq_imports(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  file_size bigint not null,
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  storage_key text not null unique,
  document_type text,
  parse_status text not null,
  parse_error text,
  created_at timestamptz not null default now()
);

create table public.atlas_project_material_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.atlas_projects(id) on delete cascade,
  rfq_id uuid not null references public.sewp_rfqs(id),
  import_id uuid not null references public.sewp_rfq_imports(id),
  source_attachment_id uuid references public.sewp_rfq_import_attachments(id),
  line_order integer not null,
  clin text,
  manufacturer text,
  part_number text,
  description text,
  quantity numeric(16,4),
  unit_of_issue text,
  unit_price numeric(16,4),
  extended_amount numeric(16,4),
  notes text,
  worksheet_name text,
  original_excel_row integer,
  source_cells jsonb not null default '{}'::jsonb,
  unique(project_id, line_order)
);

alter table public.atlas_projects enable row level security;
alter table public.sewp_rfq_imports enable row level security;
alter table public.sewp_rfq_import_attachments enable row level security;
alter table public.atlas_project_material_lines enable row level security;

create policy sewp_projects_read on public.atlas_projects for select to authenticated
  using (public.sewp_has_permission('sewp.rfq.view'));
create policy sewp_imports_read on public.sewp_rfq_imports for select to authenticated
  using (public.sewp_has_permission('sewp.rfq.view'));
create policy sewp_import_attachments_read on public.sewp_rfq_import_attachments for select to authenticated
  using (public.sewp_has_permission('sewp.rfq.view'));
create policy sewp_project_lines_read on public.atlas_project_material_lines for select to authenticated
  using (public.sewp_has_permission('sewp.rfq.view'));

update storage.buckets
set allowed_mime_types = array_append(coalesce(allowed_mime_types, '{}'::text[]), 'application/vnd.ms-outlook')
where id = 'sewp-rfq-documents' and not ('application/vnd.ms-outlook' = any(coalesce(allowed_mime_types, '{}'::text[])));

comment on table public.sewp_rfq_imports is 'Human-reviewed deterministic email imports; raw CUI stays in private storage.';
comment on table public.atlas_projects is 'Server-side project records created atomically from approved SEWP imports.';

create or replace function public.approve_sewp_rfq_import(
  p_import_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  imported public.sewp_rfq_imports;
  fields jsonb;
  line jsonb;
  attachment public.sewp_rfq_import_attachments;
  rfq public.sewp_rfqs;
  project public.atlas_projects;
  opportunity_number text;
  project_title text;
begin
  select * into imported from public.sewp_rfq_imports where id = p_import_id for update;
  if not found then raise exception 'RFQ import not found' using errcode = 'P0002'; end if;
  if imported.idempotency_key = p_idempotency_key and imported.status = 'completed' then
    return jsonb_build_object('rfqId', imported.created_rfq_id, 'projectId', imported.created_project_id, 'duplicateRequest', true);
  end if;
  if imported.status not in ('review_required', 'ready_for_approval') then
    raise exception 'RFQ import is not ready for approval';
  end if;
  if exists(select 1 from public.sewp_rfq_imports where idempotency_key = p_idempotency_key and id <> p_import_id) then
    raise exception 'Idempotency key has already been used' using errcode = '23505';
  end if;

  fields := imported.extraction_data -> 'fields';
  if coalesce(fields ->> 'request_id', '') = '' then raise exception 'SEWP request ID is required'; end if;
  update public.sewp_rfq_imports set status = 'creating_project', idempotency_key = p_idempotency_key where id = p_import_id;
  opportunity_number := public.next_sewp_opportunity_number(extract(year from now())::integer);
  project_title := coalesce(nullif(fields ->> 'opportunity_title', ''), nullif(fields ->> 'subject', ''), imported.message_subject, 'Imported RFQ');

  insert into public.sewp_rfqs(
    atlas_opportunity_number, official_rfq_number, title, agency, customer_organization,
    source, set_aside, current_stage, ai_review_status, response_due_at, notes,
    created_by, updated_by, sewp_request_id, modification_level, import_id
  ) values (
    opportunity_number, fields ->> 'request_id', project_title, fields ->> 'agency',
    coalesce(fields ->> 'suborganization', fields ->> 'agency'), 'SEWP', fields ->> 'set_aside_description',
    'Intake Review Required', 'Needs Review', nullif(fields ->> 'reply_by_date', '')::timestamptz,
    fields ->> 'additional_remarks', p_actor_user_id, p_actor_user_id,
    fields ->> 'request_id', fields ->> 'modification_level', p_import_id
  ) returning * into rfq;

  insert into public.atlas_projects(
    project_number, project_name, sewp_rfq_id, sewp_request_id, agency,
    government_customer, customer_address, shipping_information, reply_deadline,
    requirements, import_warnings, created_by
  ) values (
    opportunity_number, format('SEWP RFQ %s - %s', fields ->> 'request_id', project_title),
    rfq.id, fields ->> 'request_id', fields ->> 'agency',
    jsonb_build_object(
      'organization', coalesce(fields ->> 'suborganization', fields ->> 'agency'),
      'pocFirstName', fields ->> 'government_poc_first_name',
      'pocLastName', fields ->> 'government_poc_last_name',
      'pocEmail', fields ->> 'government_poc_email',
      'pocPhone', fields ->> 'government_poc_phone'
    ),
    jsonb_build_object('formatted', fields ->> 'customer_address'),
    jsonb_build_object('organization', fields ->> 'ship_to_organization', 'address', fields ->> 'ship_to_address'),
    nullif(fields ->> 'reply_by_date', '')::timestamptz,
    fields - array['customer_address','ship_to_address'],
    imported.warnings, p_actor_user_id
  ) returning * into project;

  update public.sewp_rfqs set atlas_project_id = project.id where id = rfq.id returning * into rfq;

  for attachment in select * from public.sewp_rfq_import_attachments where import_id = p_import_id loop
    insert into public.sewp_rfq_documents(
      rfq_id, category, display_name, storage_object_key, detected_mime_type,
      file_size_bytes, sha256, processing_status, uploaded_by
    ) values (
      rfq.id, attachment.document_type, attachment.filename, attachment.storage_key,
      attachment.mime_type, attachment.file_size, attachment.file_hash, 'Extraction Complete', p_actor_user_id
    );
  end loop;
  insert into public.sewp_rfq_documents(
    rfq_id, category, display_name, storage_object_key, detected_mime_type,
    file_size_bytes, sha256, processing_status, uploaded_by
  ) values (
    rfq.id, 'original_email', imported.original_filename, imported.original_storage_key,
    'application/vnd.ms-outlook', imported.original_file_size, imported.original_file_hash, 'Extraction Complete', p_actor_user_id
  );

  for line in select value from jsonb_array_elements(coalesce(imported.extraction_data -> 'lines', '[]'::jsonb)) loop
    insert into public.sewp_rfq_line_items(
      rfq_id, line_number, clin, manufacturer, requested_part_number, description,
      quantity, unit_of_measure, notes, review_status, created_by, updated_by
    ) values (
      rfq.id, line ->> 'originalOrder', line ->> 'clin', line ->> 'manufacturer',
      line ->> 'manufacturerPartNumber', line ->> 'description',
      nullif(line ->> 'quantity', '')::numeric, line ->> 'unitOfIssue', line ->> 'notes',
      'Needs Review', p_actor_user_id, p_actor_user_id
    );
    insert into public.atlas_project_material_lines(
      project_id, rfq_id, import_id, line_order, clin, manufacturer, part_number,
      description, quantity, unit_of_issue, unit_price, extended_amount, notes,
      worksheet_name, original_excel_row, source_cells
    ) values (
      project.id, rfq.id, p_import_id, (line ->> 'originalOrder')::integer,
      line ->> 'clin', line ->> 'manufacturer', line ->> 'manufacturerPartNumber',
      line ->> 'description', nullif(line ->> 'quantity', '')::numeric, line ->> 'unitOfIssue',
      nullif(line ->> 'unitPrice', '')::numeric, nullif(line ->> 'extendedAmount', '')::numeric,
      line ->> 'notes', line ->> 'worksheetName', (line ->> 'originalExcelRow')::integer,
      coalesce(line -> 'sourceCells', '{}'::jsonb)
    );
  end loop;

  insert into public.sewp_rfq_audit_events(
    rfq_id, actor_type, actor_user_id, action, entity_type, entity_id, new_value, request_id
  ) values (
    rfq.id, 'User', p_actor_user_id, 'rfq_import.approved_and_project_created',
    'rfq_import', p_import_id, jsonb_build_object('projectId', project.id, 'lineCount', jsonb_array_length(coalesce(imported.extraction_data -> 'lines', '[]'::jsonb))), p_request_id
  );
  update public.sewp_rfq_imports set
    status = 'completed', approved_at = now(), approved_by = p_actor_user_id,
    created_rfq_id = rfq.id, created_project_id = project.id, updated_at = now()
  where id = p_import_id;
  return jsonb_build_object('rfqId', rfq.id, 'projectId', project.id, 'projectNumber', project.project_number, 'duplicateRequest', false);
end;
$$;

revoke all on function public.approve_sewp_rfq_import(uuid,uuid,text,uuid) from public, anon, authenticated;
