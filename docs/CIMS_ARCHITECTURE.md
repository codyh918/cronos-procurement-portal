# Cronos Inventory Management System (CIMS)

CIMS is a standalone warehouse and inventory platform that integrates with Atlas through API endpoints and webhooks. Atlas remains the source system for projects, customers, quotes, purchase orders, vendors, PO line items, and project allocations. CIMS owns physical inventory activity after material reaches a warehouse.

## Architecture

- Atlas creates and maintains commercial/project records.
- CIMS receives Atlas PO payloads through webhook/API integration.
- CIMS users receive, locate, allocate, kit, transfer, ship, and RMA physical inventory.
- CIMS sends warehouse status updates back to Atlas.
- Both systems use Atlas external IDs to prevent duplicate records.
- Sync attempts are recorded in `integration_sync_logs` with `Synced`, `Pending`, `Failed`, and `Needs Review` statuses.

## Data Ownership

Atlas system of record:

- Projects
- Customers
- Quotes
- Purchase orders
- Vendors
- PO line items
- Project allocations

CIMS system of record:

- Warehouse receiving
- Inventory quantities
- Serial numbers
- Asset tags
- Rack/bin locations
- Pallets
- Kits
- Transfers
- Shipments
- RMAs
- Warehouse audit trail
- Barcode scan events
- Pallet, kit, asset, and rack/bin label print history

## Atlas to CIMS Flow

Atlas calls `POST /api/cims/webhooks/atlas/purchase-order` when a PO is created or updated. The payload should include:

- `externalId`
- `poNumber`
- `vendor`
- `projectNumber`
- `projectName`
- `customer`
- `contractNumber`
- `shipToLocation`
- `buyer`
- `poStatus`
- `warehouseCode`
- `lineItems[]` with manufacturer, part number, description, ordered quantity, optional cost values, required delivery date, allocation, serial requirements, and asset tag requirements
- Optional barcode identifiers on each line: `upc`, `manufacturerBarcode`, and `vendorBarcode`

CIMS upserts by `externalId`, preserving local receiving and inventory activity.

## CIMS to Atlas Flow

CIMS calls or queues `POST /api/cims/webhooks/atlas/status` for warehouse events:

- `receiving_update`
- `kitting_status`
- `shipping_status`
- `transfer_status`
- `rma_status`
- `delivery_status`

Typical payload fields:

```json
{
  "eventType": "receiving_update",
  "externalId": "inv-1001",
  "poNumber": "PO-10592",
  "poLineExternalId": "atlas-po-10592-line-1",
  "quantityReceived": 8,
  "quantityRemainingOpen": 4,
  "receivingDate": "2026-07-06",
  "receiverName": "Kelly Morris",
  "warehouseLocation": "Lexington Park, MD",
  "binLocation": "LEX-A1-B04",
  "palletId": "PAL-LEX-00041",
  "serialNumbers": ["CNVX363-1001"],
  "assetTags": ["AT-4107-001"],
  "condition": "New",
  "syncStatus": "Pending"
}
```

## API Endpoints

- `GET /api/cims/health`
  Returns CIMS integration health and configured warehouse names.

- `GET /api/cims/integration/logs`
  Returns in-memory sync log records from the current server process.

- `POST /api/cims/webhooks/atlas/purchase-order`
  Receives PO create/update events from Atlas. Uses `externalId` or `poNumber` for idempotency.

- `POST /api/cims/webhooks/atlas/status`
  Queues CIMS outbound status events for Atlas acknowledgement.

- `POST /api/cims/sync/retry`
  Queues failed or pending sync records for retry. Optional body: `{ "externalId": "..." }`.

## Database Schema

The migration is at `migrations/20260706_create_cims_schema.sql`.

Core tables:

- `warehouses`
- `warehouse_locations`
- `projects_synced_from_atlas`
- `vendors_synced_from_atlas`
- `purchase_orders_synced_from_atlas`
- `po_line_items_synced_from_atlas`
- `inventory_items`
- `inventory_receipts`
- `serial_numbers`
- `asset_tags`
- `barcode_scan_events`
- `pallets`
- `kits`
- `kit_items`
- `shipments`
- `shipment_items`
- `transfers`
- `transfer_items`
- `rmas`
- `attachments`
- `label_print_jobs`
- `audit_logs`
- `integration_sync_logs`
- `users`
- `roles`
- `permissions`

Supporting tables:

- `role_permissions`
- `user_warehouses`

## Roles

- Admin
- Warehouse Manager
- Warehouse Receiver
- Procurement User
- Project Manager
- Executive Viewer
- Read Only

Permissions control:

- Receiving
- Editing inventory
- Moving inventory
- Shipping
- RMA creation
- Admin settings
- Cost visibility
- Project visibility

## Receiving Workflow

1. Warehouse user opens CIMS and selects their warehouse.
2. User scans the inbound item barcode using USB, Bluetooth, manual input, or mobile/tablet camera.
3. CIMS searches manufacturer part number, UPC, serial number, asset tag, PO line item ID, and vendor barcode.
4. If one expected PO line matches, CIMS opens the receiving screen for that line.
5. If multiple records match, CIMS shows a match selection screen.
6. If no record matches, CIMS populates manual search by PO, part number, vendor, or project.
7. User enters full or partial receipt quantity.
8. User captures serial number and asset tag values when required.
9. User creates or selects a pallet, assigns rack/bin location, and prints the pallet label.
10. CIMS stores scanned barcode values on the inventory record.
11. CIMS blocks over-receiving unless an admin approval flow is added.
12. Damaged items are created with zero available quantity.
13. CIMS updates received/open quantities and queues an Atlas receiving update.
14. CIMS writes audit, scan, label print, and sync log records.

## Barcode and QR Labels

Pallet IDs use this format:

`PAL-[WarehouseCode]-[YYYYMMDD]-[SequentialNumber]`

Example:

`PAL-LEX-20260707-0001`

Supported label types:

- Pallet labels
- Kit labels
- Asset tag labels
- Rack/bin location labels

Supported label sizes:

- `4x6 shipping label`
- `2x1 asset label`
- `3x2 pallet/bin label`

Pallet labels include:

- Pallet ID
- Warehouse location
- Project number
- Project name
- PO number(s)
- Date created
- Created by

Barcode scans should open real-time pallet contents, including item list, project allocation, warehouse, rack/bin, kit status, and shipment status.

## Business Rules

- A warehouse user can only receive against an existing Atlas PO unless the item is marked as stock inventory.
- Received material must be tied to a PO line item.
- Received material must be tied to a project allocation unless marked as stock.
- Partial receiving is supported.
- Over-receiving is blocked unless admin approval is implemented.
- Damaged items do not count as available inventory.
- Shipped items reduce available on-hand inventory.
- Transfers change warehouse location without reducing total company inventory.
- Every pallet must have a unique barcode or QR code.
- Items can be assigned to a pallet during receiving or later.
- A pallet may contain items from one project by default.
- Mixed-project pallets require manager approval.
- Scanned item barcodes must be stored for traceability.
- Pallet barcode scans must show current pallet contents.
- Barcode creation, scan lookup, and label reprints must be audited.
- All changes must be auditable.
- CIMS must not overwrite Atlas project or PO data without an explicit integration endpoint.

## Deployment Requirements

- Build frontend: `npm run build`
- Run production server: `npm run start`
- Apply SQL migration to the production database before enabling persistent CIMS storage.
- Configure Atlas webhook URL:
  `https://<cims-host>/api/cims/webhooks/atlas/purchase-order`
- Configure Atlas status receiver for outbound CIMS events:
  `https://<atlas-host>/<atlas-cims-status-endpoint>`
- Add authentication, webhook signing, and durable retry workers before production use.

## Current Implementation Notes

The first CIMS implementation includes a Vue standalone app, seed data, in-memory API/webhook handlers, SQL schema, and documentation. The server handlers establish the endpoint contract, but production persistence should move from process memory to the tables defined in the migration.
