-- Cronos Inventory Management System (CIMS)
-- Standalone warehouse schema. Atlas remains system of record for projects,
-- customers, quotes, purchase orders, vendors, PO line items, and allocations.

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id),
  zone text not null,
  rack text not null,
  bin text not null,
  barcode_value text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (warehouse_id, zone, rack, bin)
);

create table if not exists projects_synced_from_atlas (
  id uuid primary key default gen_random_uuid(),
  atlas_external_id text not null unique,
  project_number text not null,
  project_name text not null,
  customer_name text not null,
  contract_number text,
  project_manager text,
  last_synced_at timestamptz not null default now()
);

create table if not exists vendors_synced_from_atlas (
  id uuid primary key default gen_random_uuid(),
  atlas_external_id text not null unique,
  vendor_name text not null,
  last_synced_at timestamptz not null default now()
);

create table if not exists purchase_orders_synced_from_atlas (
  id uuid primary key default gen_random_uuid(),
  atlas_external_id text not null unique,
  po_number text not null unique,
  vendor_id uuid not null references vendors_synced_from_atlas(id),
  project_id uuid references projects_synced_from_atlas(id),
  warehouse_id uuid references warehouses(id),
  ship_to_location text,
  buyer_name text,
  po_status text not null,
  sync_status text not null default 'Pending',
  raw_atlas_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now()
);

create table if not exists po_line_items_synced_from_atlas (
  id uuid primary key default gen_random_uuid(),
  atlas_external_id text not null unique,
  purchase_order_id uuid not null references purchase_orders_synced_from_atlas(id),
  line_number integer not null,
  manufacturer text,
  part_number text not null,
  upc text,
  manufacturer_barcode text,
  vendor_barcode text,
  description text,
  quantity_ordered numeric(14, 2) not null check (quantity_ordered >= 0),
  unit_cost numeric(14, 2),
  total_cost numeric(14, 2),
  required_delivery_date date,
  allocation_label text,
  serial_required boolean not null default false,
  asset_tag_required boolean not null default false,
  unique (purchase_order_id, line_number)
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  role_id uuid not null references roles(id),
  default_warehouse_id uuid references warehouses(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists user_warehouses (
  user_id uuid not null references users(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  primary key (user_id, warehouse_id)
);

create table if not exists pallets (
  id uuid primary key default gen_random_uuid(),
  pallet_id text not null unique,
  warehouse_id uuid not null references warehouses(id),
  warehouse_location_id uuid references warehouse_locations(id),
  barcode_value text not null unique,
  status text not null default 'Open',
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  po_line_item_id uuid references po_line_items_synced_from_atlas(id),
  project_id uuid references projects_synced_from_atlas(id),
  warehouse_id uuid not null references warehouses(id),
  warehouse_location_id uuid references warehouse_locations(id),
  pallet_id uuid references pallets(id),
  stock_inventory boolean not null default false,
  manufacturer text,
  part_number text not null,
  description text,
  quantity numeric(14, 2) not null check (quantity >= 0),
  available_quantity numeric(14, 2) not null default 0 check (available_quantity >= 0),
  status text not null,
  condition text not null default 'New',
  scanned_barcodes jsonb not null default '[]'::jsonb,
  sync_status text not null default 'Pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cims_inventory_atlas_or_stock check (stock_inventory or po_line_item_id is not null),
  constraint cims_inventory_project_or_stock check (stock_inventory or project_id is not null)
);

create table if not exists inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id),
  po_line_item_id uuid not null references po_line_items_synced_from_atlas(id),
  quantity_received numeric(14, 2) not null check (quantity_received > 0),
  received_at timestamptz not null default now(),
  received_by_user_id uuid references users(id),
  warehouse_id uuid not null references warehouses(id),
  warehouse_location_id uuid references warehouse_locations(id),
  pallet_id uuid references pallets(id),
  condition text not null,
  notes text,
  packing_slip_attachment_id uuid
);

create table if not exists serial_numbers (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  serial_number text not null unique,
  barcode_value text not null unique,
  status text not null default 'Active'
);

create table if not exists asset_tags (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  asset_tag text not null unique,
  barcode_value text not null unique,
  status text not null default 'Active'
);

create table if not exists barcode_scan_events (
  id uuid primary key default gen_random_uuid(),
  scanned_value text not null,
  scan_source text not null check (scan_source in ('USB', 'Bluetooth', 'Camera', 'Manual')),
  match_type text,
  matched_entity_id uuid,
  warehouse_id uuid references warehouses(id),
  user_id uuid references users(id),
  result text not null check (result in ('Matched', 'Multiple Matches', 'No Match')),
  occurred_at timestamptz not null default now()
);

create table if not exists kits (
  id uuid primary key default gen_random_uuid(),
  kit_number text not null unique,
  project_id uuid not null references projects_synced_from_atlas(id),
  warehouse_id uuid not null references warehouses(id),
  pallet_id uuid references pallets(id),
  barcode_value text not null unique,
  status text not null default 'Pending Kitting',
  created_by_user_id uuid references users(id),
  completed_at timestamptz
);

create table if not exists label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  label_type text not null check (label_type in ('Pallet label', 'Kit label', 'Asset tag label', 'Rack/bin location label')),
  label_size text not null check (label_size in ('4x6 shipping label', '2x1 asset label', '3x2 pallet/bin label')),
  barcode_value text not null,
  entity_type text not null,
  entity_id uuid,
  printed_by_user_id uuid references users(id),
  printed_at timestamptz not null default now(),
  reprint boolean not null default false
);

create table if not exists kit_items (
  kit_id uuid not null references kits(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(14, 2) not null check (quantity > 0),
  primary key (kit_id, inventory_item_id)
);

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_synced_from_atlas(id),
  kit_id uuid references kits(id),
  carrier text not null,
  tracking_number text,
  ship_date date,
  destination text not null,
  status text not null default 'Ready to Ship',
  sync_status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists shipment_items (
  shipment_id uuid not null references shipments(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(14, 2) not null check (quantity > 0),
  primary key (shipment_id, inventory_item_id)
);

create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  from_warehouse_id uuid not null references warehouses(id),
  to_warehouse_id uuid not null references warehouses(id),
  transfer_date date not null default current_date,
  status text not null default 'Requested',
  custodian text,
  requested_by_user_id uuid references users(id),
  received_by_user_id uuid references users(id),
  received_at timestamptz
);

create table if not exists transfer_items (
  transfer_id uuid not null references transfers(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(14, 2) not null check (quantity > 0),
  primary key (transfer_id, inventory_item_id)
);

create table if not exists rmas (
  id uuid primary key default gen_random_uuid(),
  po_line_item_id uuid not null references po_line_items_synced_from_atlas(id),
  inventory_item_id uuid not null references inventory_items(id),
  reason text not null,
  vendor_rma_number text,
  replacement_tracking text,
  status text not null default 'RMA Pending',
  sync_status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  content_type text,
  storage_url text not null,
  uploaded_by_user_id uuid references users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  occurred_at timestamptz not null default now(),
  action text not null,
  old_value jsonb,
  new_value jsonb,
  po_number text,
  project_number text,
  warehouse_id uuid references warehouses(id),
  entity_type text,
  entity_id uuid
);

create table if not exists integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('Atlas to CIMS', 'CIMS to Atlas')),
  entity_type text not null,
  external_id text not null,
  status text not null check (status in ('Synced', 'Pending', 'Failed', 'Needs Review')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  message text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cims_po_line_po on po_line_items_synced_from_atlas(purchase_order_id);
create index if not exists idx_cims_inventory_project on inventory_items(project_id);
create index if not exists idx_cims_inventory_warehouse on inventory_items(warehouse_id);
create index if not exists idx_cims_inventory_status on inventory_items(status);
create index if not exists idx_cims_po_line_barcodes on po_line_items_synced_from_atlas(upc, manufacturer_barcode, vendor_barcode);
create index if not exists idx_cims_scan_value on barcode_scan_events(scanned_value);
create index if not exists idx_cims_audit_po_project on audit_logs(po_number, project_number);
create index if not exists idx_cims_sync_status_retry on integration_sync_logs(status, next_retry_at);
