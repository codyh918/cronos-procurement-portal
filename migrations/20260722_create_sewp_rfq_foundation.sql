-- Atlas SEWP RFQ Portal, Phase 1A/1B foundation
-- Apply through the Supabase migration workflow before enabling the portal.
-- This migration does not make the deployment CUI compliant.

create extension if not exists pgcrypto;

do $$ begin
  create type public.sewp_rfq_stage as enum (
    'New', 'Intake in Progress', 'Intake Review Required', 'Bid/No-Bid Review',
    'Approved to Pursue', 'Vendor RFQs in Progress', 'Waiting on Vendor Pricing',
    'Pricing Analysis', 'Technical Review', 'Compliance Review', 'Internal Approval',
    'Ready for Submission', 'Submitted', 'Clarification or Amendment', 'Awarded',
    'Lost', 'No-Bid', 'Cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sewp_ai_review_status as enum (
    'Not Started', 'Processing', 'AI Proposed', 'Human Verified', 'Needs Review',
    'Not Found', 'Conflicting Information', 'Processing Failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sewp_task_status as enum ('Open', 'In Progress', 'Blocked', 'Complete', 'Cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.sewp_permissions (
  permission_key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sewp_user_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.sewp_permissions(permission_key) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

insert into public.sewp_permissions(permission_key, description) values
  ('sewp.rfq.view', 'View permitted SEWP RFQs and documents'),
  ('sewp.rfq.create', 'Create SEWP RFQs'),
  ('sewp.rfq.edit', 'Edit SEWP RFQ data'),
  ('sewp.rfq.assign', 'Assign RFQ owners'),
  ('sewp.rfq.upload', 'Upload RFQ documents'),
  ('sewp.rfq.review_ai', 'Review AI extraction results'),
  ('sewp.rfq.verify_fields', 'Human-verify extracted fields'),
  ('sewp.rfq.edit_bom', 'Edit draft BOM lines'),
  ('sewp.rfq.review_requirements', 'Review RFQ requirements'),
  ('sewp.rfq.transition', 'Perform standard RFQ stage transitions'),
  ('sewp.rfq.override_transition', 'Override stage transitions with justification'),
  ('sewp.rfq.manage_tasks', 'Create and manage SEWP tasks'),
  ('sewp.rfq.view_audit', 'View SEWP audit history')
on conflict (permission_key) do update set description = excluded.description;

create or replace function public.sewp_has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'atlas_role') = 'admin'
    or required_permission in (
      select jsonb_array_elements_text(coalesce(auth.jwt() -> 'app_metadata' -> 'atlas_permissions', '[]'::jsonb))
    )
    or exists (
      select 1 from public.sewp_user_permissions p
      where p.user_id = auth.uid() and p.permission_key = required_permission
    ),
    false
  );
$$;

create table if not exists public.sewp_opportunity_counters (
  opportunity_year integer primary key,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.next_sewp_opportunity_number(p_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare next_value integer;
begin
  insert into public.sewp_opportunity_counters(opportunity_year, last_value)
  values (p_year, 1)
  on conflict (opportunity_year) do update
    set last_value = public.sewp_opportunity_counters.last_value + 1,
        updated_at = now()
  returning last_value into next_value;
  return format('SEWP-%s-%s', p_year, lpad(next_value::text, 5, '0'));
end;
$$;

create table if not exists public.sewp_rfqs (
  id uuid primary key default gen_random_uuid(),
  atlas_opportunity_number text not null unique,
  official_rfq_number text not null,
  normalized_official_rfq_number text generated always as (lower(regexp_replace(official_rfq_number, '[^a-zA-Z0-9]', '', 'g'))) stored,
  title text not null,
  agency text,
  customer_organization text,
  source text not null default 'Manual',
  category text,
  set_aside text,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Critical')),
  health_status text not null default 'On Track' check (health_status in ('On Track', 'At Risk', 'Critical', 'Blocked', 'Overdue')),
  current_stage public.sewp_rfq_stage not null default 'New',
  ai_review_status public.sewp_ai_review_status not null default 'Not Started',
  date_received timestamptz not null default now(),
  questions_due_at timestamptz,
  response_due_at timestamptz,
  response_time_zone text not null default 'America/New_York',
  estimated_value numeric(16,2) check (estimated_value is null or estimated_value >= 0),
  owner_user_id uuid references auth.users(id),
  backup_owner_user_id uuid references auth.users(id),
  next_action text,
  next_action_owner_user_id uuid references auth.users(id),
  notes text,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (normalized_official_rfq_number, source)
);

create table if not exists public.sewp_rfq_contacts (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  contact_type text not null,
  name text,
  organization text,
  email text,
  phone text,
  review_status public.sewp_ai_review_status not null default 'Needs Review',
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_documents (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  category text not null,
  display_name text not null,
  storage_bucket text not null default 'sewp-rfq-documents',
  storage_object_key text not null unique,
  detected_mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  document_version integer not null default 1 check (document_version > 0),
  previous_document_id uuid references public.sewp_rfq_documents(id),
  amendment_id uuid,
  processing_status text not null default 'Uploaded' check (processing_status in ('Uploaded', 'Processing', 'Extraction Complete', 'Review Required', 'Processing Failed')),
  is_immutable_original boolean not null default true,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (rfq_id, category, display_name, document_version)
);

create table if not exists public.sewp_rfq_amendments (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  amendment_number text not null,
  effective_at timestamptz,
  review_status text not null default 'Pending',
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (rfq_id, amendment_number)
);

alter table public.sewp_rfq_documents
  drop constraint if exists sewp_rfq_documents_amendment_id_fkey;
alter table public.sewp_rfq_documents
  add constraint sewp_rfq_documents_amendment_id_fkey foreign key (amendment_id) references public.sewp_rfq_amendments(id);

create table if not exists public.sewp_rfq_assignments (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  assignment_role text not null,
  assigned_user_id uuid not null references auth.users(id),
  active boolean not null default true,
  reason text,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.sewp_rfq_tasks (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  task_type text not null,
  title text not null,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Critical')),
  assigned_user_id uuid references auth.users(id),
  due_at timestamptz,
  status public.sewp_task_status not null default 'Open',
  notes text,
  related_entity_type text,
  related_entity_id uuid,
  deduplication_key text,
  escalation_level integer not null default 0,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (rfq_id, deduplication_key)
);

create table if not exists public.sewp_rfq_notifications (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  severity text not null default 'Info' check (severity in ('Info', 'Warning', 'Critical')),
  deduplication_key text not null,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, deduplication_key)
);

create table if not exists public.sewp_rfq_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '[]'::jsonb,
  visible_columns jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.sewp_rfq_stage_history (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  from_stage public.sewp_rfq_stage,
  to_stage public.sewp_rfq_stage not null,
  actor_user_id uuid not null references auth.users(id),
  justification text,
  rfq_version integer not null,
  request_id uuid,
  occurred_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_audit_events (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references public.sewp_rfqs(id) on delete cascade,
  actor_type text not null check (actor_type in ('User', 'System', 'AI Agent')),
  actor_user_id uuid references auth.users(id),
  agent_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  source_document_id uuid references public.sewp_rfq_documents(id),
  request_id uuid,
  occurred_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  provider text not null,
  model_name text,
  agent_name text not null default 'Atlas SEWP Intake Assistant',
  configuration_version text not null,
  status text not null check (status in ('Queued', 'Processing', 'Extraction Complete', 'Review Required', 'Processing Failed')),
  attempt integer not null default 1,
  trace_id uuid not null default gen_random_uuid(),
  input_character_count integer,
  input_hash text,
  elapsed_ms integer,
  error_category text,
  redacted_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_extracted_fields (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  extraction_run_id uuid not null references public.sewp_rfq_extraction_runs(id) on delete cascade,
  field_key text not null,
  proposed_value jsonb,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  review_status public.sewp_ai_review_status not null,
  verified_value jsonb,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (extraction_run_id, field_key)
);

create table if not exists public.sewp_rfq_requirements (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  extraction_run_id uuid references public.sewp_rfq_extraction_runs(id),
  category text not null,
  requirement_text text not null,
  applicability text,
  ai_review_status public.sewp_ai_review_status not null default 'AI Proposed',
  human_status text not null default 'Needs Verification' check (human_status in ('Compliant', 'Appears Compliant', 'Needs Verification', 'Exception', 'Not Applicable', 'Missing')),
  reviewer_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_line_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  extraction_run_id uuid references public.sewp_rfq_extraction_runs(id),
  line_number text,
  clin text,
  manufacturer text,
  requested_part_number text,
  proposed_normalized_part_number text,
  approved_quoted_part_number text,
  description text,
  quantity numeric(16,4) check (quantity is null or quantity >= 0),
  unit_of_measure text,
  required_or_optional text,
  requested_configuration text,
  taa_requirement text,
  country_of_origin text,
  warranty text,
  required_delivery_at timestamptz,
  ship_to_location text,
  service_component text,
  notes text,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  review_status public.sewp_ai_review_status not null default 'AI Proposed',
  version integer not null default 1,
  is_deleted_draft boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_source_citations (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  extraction_run_id uuid not null references public.sewp_rfq_extraction_runs(id) on delete cascade,
  extracted_field_id uuid references public.sewp_rfq_extracted_fields(id) on delete cascade,
  requirement_id uuid references public.sewp_rfq_requirements(id) on delete cascade,
  line_item_id uuid references public.sewp_rfq_line_items(id) on delete cascade,
  document_id uuid not null references public.sewp_rfq_documents(id),
  document_version integer not null,
  page_number integer,
  worksheet_name text,
  row_number integer,
  cell_reference text,
  section_reference text,
  source_excerpt text,
  extraction_chunk_id text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(extracted_field_id, requirement_id, line_item_id) = 1)
);

create table if not exists public.sewp_rfq_field_corrections (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  extracted_field_id uuid references public.sewp_rfq_extracted_fields(id),
  line_item_id uuid references public.sewp_rfq_line_items(id),
  previous_value jsonb,
  corrected_value jsonb,
  reason text,
  corrected_by uuid not null references auth.users(id),
  corrected_at timestamptz not null default now(),
  record_version integer not null,
  check (num_nonnulls(extracted_field_id, line_item_id) = 1)
);

create table if not exists public.sewp_rfq_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.sewp_rfqs(id) on delete cascade,
  extraction_run_id uuid not null references public.sewp_rfq_extraction_runs(id),
  summary jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  review_status public.sewp_ai_review_status not null default 'AI Proposed',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.sewp_rfq_ai_execution_logs (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references public.sewp_rfqs(id) on delete cascade,
  extraction_run_id uuid references public.sewp_rfq_extraction_runs(id) on delete cascade,
  agent_name text not null,
  provider text not null,
  operation text not null,
  trace_id uuid not null,
  status text not null,
  elapsed_ms integer,
  retry_count integer not null default 0,
  redacted_error text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_sewp_rfqs_due on public.sewp_rfqs(response_due_at) where deleted_at is null;
create index if not exists idx_sewp_rfqs_stage on public.sewp_rfqs(current_stage) where deleted_at is null;
create index if not exists idx_sewp_rfqs_owner on public.sewp_rfqs(owner_user_id) where deleted_at is null;
create index if not exists idx_sewp_documents_rfq on public.sewp_rfq_documents(rfq_id, category, document_version desc);
create index if not exists idx_sewp_tasks_owner_due on public.sewp_rfq_tasks(assigned_user_id, due_at) where status <> 'Complete';
create index if not exists idx_sewp_audit_rfq_time on public.sewp_rfq_audit_events(rfq_id, occurred_at desc);
create index if not exists idx_sewp_citations_document on public.sewp_rfq_source_citations(document_id, page_number, worksheet_name, row_number);

create or replace function public.transition_sewp_rfq_stage(
  p_rfq_id uuid,
  p_target_stage public.sewp_rfq_stage,
  p_expected_version integer,
  p_justification text,
  p_actor_user_id uuid,
  p_request_id uuid
) returns public.sewp_rfqs
language plpgsql
security definer
set search_path = public
as $$
declare current_record public.sewp_rfqs;
declare updated_record public.sewp_rfqs;
begin
  select * into current_record from public.sewp_rfqs where id = p_rfq_id and deleted_at is null for update;
  if not found then raise exception 'RFQ not found' using errcode = 'P0002'; end if;
  if current_record.version <> p_expected_version then raise exception 'Stale RFQ version' using errcode = '40001'; end if;

  update public.sewp_rfqs
  set current_stage = p_target_stage,
      version = version + 1,
      updated_by = p_actor_user_id,
      updated_at = now()
  where id = p_rfq_id
  returning * into updated_record;

  insert into public.sewp_rfq_stage_history(rfq_id, from_stage, to_stage, actor_user_id, justification, rfq_version, request_id)
  values (p_rfq_id, current_record.current_stage, p_target_stage, p_actor_user_id, p_justification, updated_record.version, p_request_id);

  insert into public.sewp_rfq_audit_events(rfq_id, actor_type, actor_user_id, action, entity_type, entity_id, previous_value, new_value, reason, request_id)
  values (p_rfq_id, 'User', p_actor_user_id, 'rfq.stage_changed', 'sewp_rfq', p_rfq_id,
    jsonb_build_object('stage', current_record.current_stage, 'version', current_record.version),
    jsonb_build_object('stage', updated_record.current_stage, 'version', updated_record.version),
    p_justification, p_request_id);
  return updated_record;
end;
$$;

-- Private bucket. Storage objects must be created/read through the Storage API.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'sewp-rfq-documents',
  'sewp-rfq-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.sewp_permissions enable row level security;
alter table public.sewp_user_permissions enable row level security;
alter table public.sewp_rfqs enable row level security;
alter table public.sewp_rfq_contacts enable row level security;
alter table public.sewp_rfq_documents enable row level security;
alter table public.sewp_rfq_amendments enable row level security;
alter table public.sewp_rfq_assignments enable row level security;
alter table public.sewp_rfq_tasks enable row level security;
alter table public.sewp_rfq_notifications enable row level security;
alter table public.sewp_rfq_saved_views enable row level security;
alter table public.sewp_rfq_stage_history enable row level security;
alter table public.sewp_rfq_audit_events enable row level security;
alter table public.sewp_rfq_extraction_runs enable row level security;
alter table public.sewp_rfq_extracted_fields enable row level security;
alter table public.sewp_rfq_requirements enable row level security;
alter table public.sewp_rfq_line_items enable row level security;
alter table public.sewp_rfq_source_citations enable row level security;
alter table public.sewp_rfq_field_corrections enable row level security;
alter table public.sewp_rfq_ai_summaries enable row level security;
alter table public.sewp_rfq_ai_execution_logs enable row level security;

-- Direct browser access is read-only and permission-aware. Mutations use the authenticated Atlas server API.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'sewp_rfqs','sewp_rfq_contacts','sewp_rfq_documents','sewp_rfq_amendments',
    'sewp_rfq_assignments','sewp_rfq_tasks','sewp_rfq_stage_history',
    'sewp_rfq_extraction_runs','sewp_rfq_extracted_fields','sewp_rfq_requirements',
    'sewp_rfq_line_items','sewp_rfq_source_citations','sewp_rfq_ai_summaries'
  ] loop
    execute format('drop policy if exists sewp_authenticated_read on public.%I', table_name);
    execute format('create policy sewp_authenticated_read on public.%I for select to authenticated using (public.sewp_has_permission(''sewp.rfq.view''))', table_name);
  end loop;
end $$;

drop policy if exists sewp_user_reads_own_notifications on public.sewp_rfq_notifications;
create policy sewp_user_reads_own_notifications on public.sewp_rfq_notifications
for select to authenticated using (user_id = auth.uid() and public.sewp_has_permission('sewp.rfq.view'));

drop policy if exists sewp_user_manages_own_saved_views on public.sewp_rfq_saved_views;
create policy sewp_user_manages_own_saved_views on public.sewp_rfq_saved_views
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists sewp_authorized_audit_read on public.sewp_rfq_audit_events;
create policy sewp_authorized_audit_read on public.sewp_rfq_audit_events
for select to authenticated using (public.sewp_has_permission('sewp.rfq.view_audit'));

drop policy if exists sewp_authorized_execution_log_read on public.sewp_rfq_ai_execution_logs;
create policy sewp_authorized_execution_log_read on public.sewp_rfq_ai_execution_logs
for select to authenticated using (public.sewp_has_permission('sewp.rfq.view_audit'));

drop policy if exists sewp_authorized_corrections_read on public.sewp_rfq_field_corrections;
create policy sewp_authorized_corrections_read on public.sewp_rfq_field_corrections
for select to authenticated using (public.sewp_has_permission('sewp.rfq.review_ai'));

-- Storage is server-mediated in Phase 1. No authenticated INSERT/UPDATE/DELETE policy is granted.
-- A narrowly scoped SELECT policy allows authorized users to use signed/authenticated reads.
drop policy if exists sewp_authorized_document_read on storage.objects;
create policy sewp_authorized_document_read on storage.objects
for select to authenticated
using (bucket_id = 'sewp-rfq-documents' and public.sewp_has_permission('sewp.rfq.view'));

revoke all on public.sewp_opportunity_counters from anon, authenticated;
revoke all on function public.next_sewp_opportunity_number(integer) from public, anon, authenticated;
revoke all on function public.transition_sewp_rfq_stage(uuid, public.sewp_rfq_stage, integer, text, uuid, uuid) from public, anon, authenticated;

comment on table public.sewp_rfqs is 'Atlas SEWP RFQ system of record. Not approved for CUI without a separately authorized environment.';
comment on table public.sewp_rfq_audit_events is 'Append-only audit trail written by trusted server workflows.';
