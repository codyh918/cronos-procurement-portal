-- Atlas centralized product catalog. Apply after 20260729_create_atlas_identity_and_vendor_permissions.sql.
begin;

create extension if not exists pg_trgm;

alter table public.atlas_user_profiles drop constraint if exists atlas_user_profiles_role_check;
alter table public.atlas_user_profiles
  add constraint atlas_user_profiles_role_check
  check (role in ('admin', 'procurement', 'engineering', 'sales'));

create table if not exists public.atlas_catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_type text not null check (source_type in ('xlsx', 'csv', 'seed', 'distributor')),
  status text not null default 'processing' check (status in ('processing', 'completed', 'completed_with_errors', 'failed')),
  total_rows integer not null default 0,
  new_products integer not null default 0,
  updated_products integer not null default 0,
  duplicate_records integer not null default 0,
  error_rows integer not null default 0,
  skipped_rows integer not null default 0,
  price_changes integer not null default 0,
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.atlas_products (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  manufacturer_part_number text not null,
  description text not null default '',
  additional_description text not null default '',
  category text not null default '',
  subcategory text not null default '',
  keywords text[] not null default '{}',
  budget_unit_price numeric(14,2),
  current_cost numeric(14,2),
  unit_of_measure text not null default '',
  supplier text not null default '',
  supplier_part_number text not null default '',
  fsc text not null default '',
  nsn text not null default '',
  lead_time text not null default '',
  lead_time_days integer,
  purchasable boolean,
  procurement_status text not null default '',
  dpas text not null default '',
  serial_number_required boolean,
  taa_compliant boolean,
  in_stock boolean,
  screen_size_inches numeric(6,2),
  specifications jsonb not null default '{}'::jsonb,
  source_file text not null default '',
  source_row integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  last_import_batch uuid references public.atlas_catalog_import_batches(id),
  search_document tsvector,
  constraint atlas_products_manufacturer_part_unique unique (manufacturer, manufacturer_part_number)
);

create unique index if not exists atlas_products_manufacturer_part_ci
  on public.atlas_products (lower(btrim(manufacturer)), lower(btrim(manufacturer_part_number)));

create or replace function public.atlas_products_search_document_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_document :=
    setweight(to_tsvector('simple', coalesce(new.manufacturer, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.manufacturer_part_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '') || ' ' || coalesce(new.additional_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.category, '') || ' ' || coalesce(new.subcategory, '') || ' ' || array_to_string(new.keywords, ' ')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.supplier, '') || ' ' || coalesce(new.supplier_part_number, '')), 'D');
  return new;
end;
$$;

drop trigger if exists atlas_products_search_document_trigger on public.atlas_products;
create trigger atlas_products_search_document_trigger
before insert or update of manufacturer, manufacturer_part_number, description, additional_description,
  category, subcategory, keywords, supplier, supplier_part_number
on public.atlas_products
for each row execute function public.atlas_products_search_document_update();

create index if not exists atlas_products_search_document_gin on public.atlas_products using gin(search_document);
create index if not exists atlas_products_description_trgm on public.atlas_products using gin(lower(description) gin_trgm_ops);
create index if not exists atlas_products_part_trgm on public.atlas_products using gin(lower(manufacturer_part_number) gin_trgm_ops);
create index if not exists atlas_products_manufacturer_idx on public.atlas_products (manufacturer);
create index if not exists atlas_products_category_idx on public.atlas_products (category);
create index if not exists atlas_products_supplier_idx on public.atlas_products (supplier);
create index if not exists atlas_products_cost_idx on public.atlas_products (current_cost);
create index if not exists atlas_products_active_idx on public.atlas_products (active);

create table if not exists public.atlas_product_pricing_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.atlas_products(id) on delete restrict,
  previous_cost numeric(14,2),
  new_cost numeric(14,2) not null,
  effective_date timestamptz not null default now(),
  imported_by uuid references auth.users(id),
  import_batch uuid references public.atlas_catalog_import_batches(id),
  source_file text not null default '',
  change_amount numeric(14,2) generated always as (new_cost - coalesce(previous_cost, 0)) stored,
  change_percent numeric(12,4) generated always as (
    case when previous_cost is null or previous_cost = 0 then null
      else ((new_cost - previous_cost) / previous_cost) * 100 end
  ) stored
);
create index if not exists atlas_product_price_history_product_idx
  on public.atlas_product_pricing_history(product_id, effective_date desc);
create index if not exists atlas_product_price_history_batch_idx
  on public.atlas_product_pricing_history(import_batch);

create table if not exists public.atlas_catalog_audit_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.atlas_products(id) on delete restrict,
  action text not null,
  actor_user_id uuid references auth.users(id),
  import_batch uuid references public.atlas_catalog_import_batches(id),
  occurred_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists atlas_catalog_audit_product_idx
  on public.atlas_catalog_audit_events(product_id, occurred_at desc);

alter table public.atlas_products enable row level security;
alter table public.atlas_product_pricing_history enable row level security;
alter table public.atlas_catalog_import_batches enable row level security;
alter table public.atlas_catalog_audit_events enable row level security;

drop policy if exists atlas_products_active_read on public.atlas_products;
create policy atlas_products_active_read on public.atlas_products for select to authenticated
using (exists (select 1 from public.atlas_user_profiles p where p.auth_user_id = auth.uid() and p.is_active));
drop policy if exists atlas_product_pricing_read on public.atlas_product_pricing_history;
create policy atlas_product_pricing_read on public.atlas_product_pricing_history for select to authenticated
using (exists (select 1 from public.atlas_user_profiles p where p.auth_user_id = auth.uid() and p.is_active));

revoke insert, update, delete on public.atlas_products from anon, authenticated;
revoke insert, update, delete on public.atlas_product_pricing_history from anon, authenticated;
revoke all on public.atlas_catalog_import_batches from anon, authenticated;
revoke all on public.atlas_catalog_audit_events from anon, authenticated;
grant select on public.atlas_products, public.atlas_product_pricing_history to authenticated;

create or replace function public.atlas_catalog_facets()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'manufacturers', coalesce((select jsonb_agg(row_to_json(x)) from (select manufacturer as value, count(*) as count from atlas_products where active group by manufacturer order by count(*) desc, manufacturer limit 250) x), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(row_to_json(x)) from (select category as value, count(*) as count from atlas_products where active and category <> '' group by category order by count(*) desc, category limit 250) x), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(row_to_json(x)) from (select supplier as value, count(*) as count from atlas_products where active and supplier <> '' group by supplier order by count(*) desc, supplier limit 250) x), '[]'::jsonb)
  );
$$;
revoke all on function public.atlas_catalog_facets() from public;
grant execute on function public.atlas_catalog_facets() to authenticated;

commit;
