begin;

create table if not exists public.atlas_quote_pricing_audit (
  id uuid primary key default gen_random_uuid(),
  quote_id text,
  quote_line_id text not null,
  part_number text not null,
  previous_cost numeric(14,2),
  verified_cost numeric(14,2) not null,
  pricing_source text not null,
  verified_at timestamptz not null,
  applied_by uuid not null references auth.users(id),
  catalog_updated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists atlas_quote_pricing_audit_quote_idx on public.atlas_quote_pricing_audit(quote_id, quote_line_id, verified_at desc);
alter table public.atlas_quote_pricing_audit enable row level security;

commit;
