-- Customer/vendor portability pilot. Deploy only after review; this script does not copy or delete production data.
create type public.atlas_entity_status as enum ('active', 'inactive', 'deleted');

create table public.atlas_customers (
  id uuid primary key default gen_random_uuid(),
  customer_number text,
  legal_name text not null,
  display_name text not null,
  primary_contact_name text,
  primary_email text,
  primary_phone text,
  website text,
  status public.atlas_entity_status not null default 'active',
  source_system text,
  source_id text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint atlas_customer_soft_delete_consistent check ((deleted_at is null) = (deleted_by is null))
);
create unique index atlas_customers_business_key on public.atlas_customers(lower(customer_number)) where customer_number is not null and deleted_at is null;
create unique index atlas_customers_source_key on public.atlas_customers(source_system, source_id) where source_system is not null and source_id is not null;

create table public.atlas_customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.atlas_customers(id),
  label text not null,
  address_type text not null check (address_type in ('main_office','billing','shipping','project_site','government_site','other')),
  contact_name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_province text,
  postal_code text,
  country_code char(2) not null default 'US',
  email text,
  phone text,
  is_primary boolean not null default false,
  status public.atlas_entity_status not null default 'active',
  source_system text,
  source_id text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);
create unique index atlas_customer_primary_address on public.atlas_customer_addresses(customer_id) where is_primary and deleted_at is null;

create table public.atlas_vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_number text,
  legal_name text not null,
  dba_name text,
  website text,
  status public.atlas_entity_status not null default 'active',
  is_preferred boolean not null default false,
  cage_code text,
  uei text,
  duns text,
  tax_id text,
  payment_terms text,
  account_number text,
  notes text,
  legacy_payload jsonb not null default '{}'::jsonb,
  source_system text,
  source_id text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  version bigint not null default 1 check (version > 0),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);
create unique index atlas_vendors_business_key on public.atlas_vendors(lower(vendor_number)) where vendor_number is not null and deleted_at is null;
create unique index atlas_vendors_name_key on public.atlas_vendors(lower(legal_name)) where deleted_at is null;

create table public.atlas_data_audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  request_id uuid,
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.atlas_customers enable row level security;
alter table public.atlas_customer_addresses enable row level security;
alter table public.atlas_vendors enable row level security;
alter table public.atlas_data_audit_events enable row level security;

-- Browser clients receive no write policy. All mutations use the authenticated Node API/service role.
create policy atlas_customers_authenticated_read on public.atlas_customers for select to authenticated using (true);
create policy atlas_customer_addresses_authenticated_read on public.atlas_customer_addresses for select to authenticated using (true);
create policy atlas_vendors_authenticated_read on public.atlas_vendors for select to authenticated using (true);
create policy atlas_audit_authenticated_read on public.atlas_data_audit_events for select to authenticated using (true);

comment on table public.atlas_customers is 'Provider-neutral normalized customer pilot; UUID is permanent and customer_number remains a business key.';
comment on table public.atlas_vendors is 'Provider-neutral normalized vendor pilot; UUID is permanent and vendor_number/source_id remain external keys.';
