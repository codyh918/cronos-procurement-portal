-- Date-only expiration values were initially stored at midnight UTC, causing
-- them to display as the prior day in US time zones. Treat selected dates as
-- valid through the end of that calendar day.
begin;

update public.atlas_product_pricing_history
set expiration_date = expiration_date + interval '23 hours 59 minutes 59.999 seconds'
where expiration_date is not null
  and expiration_date = date_trunc('day', expiration_date);

update public.atlas_catalog_import_batches
set pricing_expiration_date = pricing_expiration_date + interval '23 hours 59 minutes 59.999 seconds'
where pricing_expiration_date is not null
  and pricing_expiration_date = date_trunc('day', pricing_expiration_date);

commit;
