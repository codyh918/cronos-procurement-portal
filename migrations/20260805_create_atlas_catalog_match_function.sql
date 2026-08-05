-- Match import keys with the exact normalization used by the catalog's
-- case-insensitive unique index.
begin;

create or replace function public.atlas_catalog_match_products(p_keys jsonb)
returns table (
  id uuid,
  manufacturer text,
  manufacturer_part_number text,
  current_cost numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    product.id,
    product.manufacturer,
    product.manufacturer_part_number,
    product.current_cost
  from public.atlas_products product
  where exists (
    select 1
    from jsonb_to_recordset(coalesce(p_keys, '[]'::jsonb)) as imported(
      manufacturer text,
      manufacturer_part_number text
    )
    where lower(btrim(imported.manufacturer)) = lower(btrim(product.manufacturer))
      and lower(btrim(imported.manufacturer_part_number)) = lower(btrim(product.manufacturer_part_number))
  );
$$;

revoke all on function public.atlas_catalog_match_products(jsonb) from public;
grant execute on function public.atlas_catalog_match_products(jsonb) to service_role;

commit;
