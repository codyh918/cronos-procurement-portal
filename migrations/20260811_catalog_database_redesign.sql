-- Product-centric catalog reporting and deterministic import classifications.
begin;

alter table public.atlas_catalog_import_batches
  add column if not exists unchanged_products integer not null default 0,
  add column if not exists metadata_updated_products integer not null default 0;

-- Preserve one master product for every normalized manufacturer + part number.
-- The pre-existing expression index remains the database enforcement mechanism.
create unique index if not exists atlas_products_manufacturer_part_ci
  on public.atlas_products (lower(btrim(manufacturer)), lower(btrim(manufacturer_part_number)));

drop function if exists public.atlas_catalog_match_products(jsonb);
create function public.atlas_catalog_match_products(p_keys jsonb)
returns setof public.atlas_products
language sql stable security definer set search_path = public as $$
  select product.* from public.atlas_products product
  where exists (
    select 1 from jsonb_to_recordset(coalesce(p_keys, '[]'::jsonb)) as imported(manufacturer text, manufacturer_part_number text)
    where lower(btrim(imported.manufacturer)) = lower(btrim(product.manufacturer))
      and lower(btrim(imported.manufacturer_part_number)) = lower(btrim(product.manufacturer_part_number))
  );
$$;
revoke all on function public.atlas_catalog_match_products(jsonb) from public;
grant execute on function public.atlas_catalog_match_products(jsonb) to service_role;

create index if not exists atlas_product_pricing_status_expiration_idx
  on public.atlas_product_pricing_history(pricing_status, expiration_date, effective_date desc);
create index if not exists atlas_product_pricing_vendor_idx
  on public.atlas_product_pricing_history(vendor, effective_date desc);

commit;
