export type WarehouseCode = 'LEX' | 'EVN' | 'VB'

export type InventoryStatus =
  | 'Ordered'
  | 'Partially Received'
  | 'Received'
  | 'On Hand'
  | 'Allocated to Project'
  | 'Pending Kitting'
  | 'Kitted'
  | 'Ready to Ship'
  | 'Shipped'
  | 'Delivered'
  | 'Damaged'
  | 'RMA Pending'
  | 'RMA Shipped'
  | 'Replaced'
  | 'Cancelled'

export type SyncStatus = 'Synced' | 'Pending' | 'Failed' | 'Needs Review'
export type LabelSize = '4x6 shipping label' | '2x1 asset label' | '3x2 pallet/bin label'

export type CimsRole =
  | 'Admin'
  | 'Warehouse Manager'
  | 'Warehouse Receiver'
  | 'Procurement User'
  | 'Project Manager'
  | 'Executive Viewer'
  | 'Read Only'

export interface Warehouse {
  id: WarehouseCode
  name: string
  address: string
  manager: string
  openPos: number
  users: number
}

export interface RackLocation {
  id: string
  warehouseId: WarehouseCode
  zone: string
  rack: string
  bin: string
  barcode: string
  capacityUsed: number
}

export interface AtlasProject {
  externalId: string
  projectNumber: string
  projectName: string
  customer: string
  contractNumber?: string
  projectManager: string
}

export interface Vendor {
  externalId: string
  name: string
}

export interface PurchaseOrderLine {
  externalId: string
  lineNumber: number
  manufacturer: string
  partNumber: string
  upc?: string
  manufacturerBarcode?: string
  vendorBarcode?: string
  description: string
  quantityOrdered: number
  quantityReceived: number
  unitCost?: number
  requiredDeliveryDate: string
  allocation: string
  serialRequired: boolean
  assetTagRequired: boolean
  condition: 'New' | 'Damaged' | 'Open Box'
}

export interface PurchaseOrder {
  externalId: string
  poNumber: string
  vendorExternalId: string
  projectExternalId: string
  warehouseId: WarehouseCode
  shipToLocation: string
  buyer: string
  status: 'Open' | 'Partially Received' | 'Received' | 'Closed'
  syncStatus: SyncStatus
  updatedAt: string
  lines: PurchaseOrderLine[]
}

export interface InventoryItem {
  id: string
  poNumber: string
  poLineExternalId: string
  projectExternalId: string
  warehouseId: WarehouseCode
  locationId: string
  palletId?: string
  kitId?: string
  manufacturer: string
  partNumber: string
  description: string
  quantity: number
  availableQuantity: number
  status: InventoryStatus
  condition: 'New' | 'Damaged' | 'Open Box'
  scannedBarcodes: string[]
  serialNumbers: string[]
  assetTags: string[]
  receivedAt?: string
  receiver?: string
  syncStatus: SyncStatus
}

export interface Pallet {
  id: string
  palletId: string
  barcodeValue: string
  warehouseId: WarehouseCode
  locationId: string
  projectExternalId: string
  poNumbers: string[]
  dateCreated: string
  createdBy: string
  labelSize: LabelSize
  status: 'Open' | 'Kitted' | 'Ready to Ship' | 'Shipped'
  managerApprovedMixedProject: boolean
}

export interface Kit {
  id: string
  kitNumber: string
  projectExternalId: string
  warehouseId: WarehouseCode
  palletId: string
  status: 'Pending Kitting' | 'Kitted' | 'Ready to Ship' | 'Shipped'
  itemIds: string[]
  photoCount: number
}

export interface Shipment {
  id: string
  projectExternalId: string
  kitId?: string
  carrier: string
  trackingNumber: string
  shipDate: string
  destination: string
  status: 'Ready to Ship' | 'Shipped' | 'Delivered'
  syncStatus: SyncStatus
}

export interface Transfer {
  id: string
  itemId: string
  fromWarehouseId: WarehouseCode
  toWarehouseId: WarehouseCode
  quantity: number
  transferDate: string
  status: 'Requested' | 'In Transit' | 'Received'
  custodian: string
}

export interface Rma {
  id: string
  poLineExternalId: string
  itemId: string
  reason: string
  vendorRmaNumber: string
  replacementTracking: string
  status: 'RMA Pending' | 'RMA Shipped' | 'Replaced'
  syncStatus: SyncStatus
}

export interface AuditLog {
  id: string
  user: string
  timestamp: string
  action: string
  oldValue: string
  newValue: string
  poNumber: string
  projectNumber: string
  warehouseId: WarehouseCode
}

export interface SyncLog {
  id: string
  direction: 'Atlas to CIMS' | 'CIMS to Atlas'
  entity: string
  externalId: string
  status: SyncStatus
  attempts: number
  lastAttemptAt: string
  message: string
}
