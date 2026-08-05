-- Normalize legacy catalog keys so application matching and both unique
-- indexes use the same canonical manufacturer + part-number values.
begin;

update public.atlas_products
set
  manufacturer = btrim(manufacturer),
  manufacturer_part_number = btrim(manufacturer_part_number),
  updated_at = now()
where
  manufacturer is distinct from btrim(manufacturer)
  or manufacturer_part_number is distinct from btrim(manufacturer_part_number);

commit;
