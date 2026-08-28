import type { Component } from 'vue'

export type AppRole = 'Admin' | 'Procurement Team' | 'Engineering' | 'Sales'
export type CanonicalRole = 'admin' | 'procurement' | 'engineering' | 'sales'

export type UserProfile = {
  id: string
  supabaseAuthUserId?: string
  username?: string
  firstName?: string
  lastName?: string
  name: string
  email: string
  twoFactorSecret?: string
  twoFactorEnabled?: boolean
  role: AppRole
  title: string
  phone: string
  active: boolean
  createdAt?: string
  createdBy?: string
}

export type UserSession = {
  id: string
  username?: string
  name: string
  email: string
  role: AppRole
  title: string
  authVersion?: number
}

export type Tone = 'default' | 'warning' | 'danger' | 'success'

export type NavItem = {
  href: string
  match: string
  label: string
  icon: Component
  allowedRoles?: CanonicalRole[]
}

export type Metric = {
  label: string
  value: string | number
  action: string
  tone?: Tone
  icon: Component
}

export type PipelineRow = {
  label: string
  value: string
  color: string
  href: string
}

export type QuickAction = {
  label: string
  href?: string
  onClick?: () => void
  icon: Component
  colorClass: string
}

export type ProjectType = 'Design & Install' | 'Resale' | 'Checkbook'

export type Status =
  | 'Quoted'
  | 'Customer Approved'
  | 'Pending Procurement'
  | 'PO Generated'
  | 'PO Issued'
  | 'Ordered'
  | 'Awaiting Vendor Shipment'
  | 'In Transit to Cronos'
  | 'Partially Received'
  | 'Received'
  | 'Received at Cronos'
  | 'Stored'
  | 'Allocated to Kit'
  | 'Kitted'
  | 'Staged'
  | 'Ready to Ship'
  | 'Partially Shipped'
  | 'Shipped to Customer'
  | 'Shipped'
  | 'Delivered'
  | 'RMA'
  | 'RMA / Issue'
  | 'Cancelled'
  | 'Backordered'

export type ProjectFormInput = {
  projectType: ProjectType
  checkbookStartingBalance: number
  materialBudget: number
  assignedUserIds: string[]
  customerId: string
  customerAddressId: string
  customerSnapshot?: CustomerAddressSnapshot
  projectNumber: string
  projectName: string
  customer: string
  customerContactName: string
  customerAddress1: string
  customerAddress2: string
  customerCity: string
  customerState: string
  customerZip: string
  customerCountry: string
  customerEmail: string
  customerPhone: string
  customerNumber: string
  customerWebsite: string
  shippingContactName: string
  shippingEmail: string
  shippingPhone: string
  shippingInstructions: string
  contractNumber: string
  primeOrSub: 'Prime' | 'Subcontractor'
  projectManager: string
  governmentProjectLead: string
  engineer: string
  startDate: string
  endDate: string
  status: Status
  deliveryAddress: string
  notes: string
}

export type CustomerRecord = {
  id: string
  legalCompanyName: string
  displayName: string
  customerNumber: string
  primaryContact: string
  primaryEmail: string
  primaryPhone: string
  website: string
  active: boolean
  createdAt: string
  updatedAt: string
  useCount: number
  lastUsedAt: string
}

export type CustomerAddressType = 'Main Office' | 'Billing' | 'Shipping' | 'Project Site' | 'Government Site' | 'Other'

export type CustomerAddressRecord = {
  id: string
  customerId: string
  label: string
  type: CustomerAddressType
  contactName: string
  streetAddress1: string
  streetAddress2: string
  city: string
  state: string
  zipCode: string
  country: string
  email: string
  phone: string
  isPrimary: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  useCount: number
  lastUsedAt: string
}

export type CustomerAddressSnapshot = {
  companyName: string
  contactName: string
  streetAddress1: string
  streetAddress2: string
  city: string
  state: string
  zipCode: string
  country: string
  email: string
  phone: string
  customerNumber: string
  website: string
  capturedAt: string
}

export type QuoteLine = {
  id: string
  clin: string
  partNumber: string
  manufacturer: string
  description: string
  quantity: number
  unitCost: number
  pricingMode?: 'markup' | 'margin'
  marginPercent?: number
  markupPercent: number
  vendor: string
  supplierPartNumber?: string
  quoteNumber: string
  leadTime: string
  approved: boolean
  pricingStatus?: PricingVerificationStatus
  pricingSource?: string
  pricingVerifiedAt?: string
  catalogProductId?: string | null
  catalogCost?: number | null
  pricingVerificationHistory?: PricingVerificationAudit[]
  melImport?: MelImportProvenance
}

export type MelImportProvenance = {
  sourceFilename: string
  uploadedAt: string
  importedBy: string
  worksheet: string
  sourceRow: number
  headerRow: number
  parsingMethod: string
  originalValues: Record<string, string>
  normalizedValues: { quantity: number; partNumber: string; manufacturer: string; description: string }
  confidence: { quantity: number; partNumber: number; manufacturer: number; description: number; overall: number }
}

export type PricingVerificationStatus = 'Verified' | 'Stale' | 'Unverified' | 'Price Changed' | 'Product Not Found' | 'Distributor Error'

export type PricingVerificationAudit = {
  id: string
  quoteId?: string | null
  quoteLineId: string
  partNumber: string
  previousCost: number
  verifiedCost: number
  pricingSource: string
  verifiedAt: string
  appliedBy: string
  catalogUpdated: boolean
}

export type CustomerQuote = {
  id: string
  quoteNumber: string
  quoteName?: string
  projectId: string
  projectNumber: string
  projectName: string
  customer: string
  status: Status
  createdAt: string
  expirationDays?: 30 | 60 | 90
  contractFeeEnabled?: boolean
  shippingCost?: number
  lines: QuoteLine[]
}

export type Project = ProjectFormInput & {
  id: string
  createdAt?: string
  updatedAt?: string
  quotes: CustomerQuote[]
  quoteLines: QuoteLine[]
  purchaseOrders: PurchaseOrder[]
  inventory: InventoryItem[]
  kitStatus: Status
  shipmentStatus: Status
  materialShipments?: MaterialShipment[]
  materialTrackingActivity?: MaterialTrackingActivity[]
}

export type MaterialShipmentLine = { id: string; shipmentId: string; poId: string; quoteId?: string; quoteNumber?: string; quoteName?: string; melLineItemId: string; quantityShipped: number; quantityDelivered: number; deliveredDate?: string; deliveredByUserId?: string; deliveredByUserName?: string; deliveredAt?: string }
export type MaterialShipment = { id: string; projectId: string; poId: string; vendor: string; carrier: string; trackingNumber: string; actualShipDate: string; expectedDeliveryDate?: string; deliveredDate?: string; packingSlipNumber?: string; notes?: string; createdBy: string; createdByName: string; createdAt: string; updatedAt: string; lines: MaterialShipmentLine[] }
export type MaterialTrackingActivity = { id: string; projectId: string; poId: string; melLineItemId?: string; shipmentId?: string; action: string; actorId: string; actorName: string; occurredAt: string; previousValue?: string; newValue?: string }

export type PurchaseOrderLine = {
  id: string
  itemNumber?: string
  clin: string
  partNumber: string
  manufacturer?: string
  description: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  status: Status
  vendorOrderNumber?: string
  estimatedShipDate?: string
  estimatedDeliveryDate?: string
  receivedDate?: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  customerNote?: string
  notes?: string
}

export type PurchaseOrder = {
  id: string
  poNumber: string
  quoteId?: string
  vendor: string
  description?: string
  dateIssued: string
  status: Status
  totalCost: number
  freightCost?: number
  customerTotalCost?: number
  estimatedShipDate?: string
  expectedDeliveryDate?: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  customerUpdateNotes?: string
  requestor?: string
  terms?: string
  lines: PurchaseOrderLine[]
}

export type InventoryItem = {
  id: string
  projectId?: string
  projectNumber?: string
  projectName?: string
  poNumber: string
  clin: string
  partNumber: string
  manufacturer: string
  description: string
  quantityOrdered: number
  quantityReceived: number
  quantityRemaining: number
  serialNumber?: string
  assetTag?: string
  warehouseId?: string
  warehouseLocation?: string
  rack?: string
  bin?: string
  palletNumber?: string
  status: Status
  receivedDate?: string
  receivedBy?: string
  notes?: string
}

export type ProjectPurchaseOrder = PurchaseOrder & {
  projectId: string
  projectNumber: string
  projectName: string
}

export type CustomerOrderStatus =
  | 'Pending Procurement'
  | 'PO Issued'
  | 'Backordered'
  | 'Awaiting Vendor Shipment'
  | 'In Transit to Cronos'
  | 'Received at Cronos'
  | 'Kitted'
  | 'Partially Shipped'
  | 'Shipped to Customer'
  | 'Delivered'
  | 'Cancelled'
  | 'RMA / Issue'

export type CustomerOrderItem = {
  id: string
  lineNumber: string
  manufacturer: string
  partNumber: string
  description: string
  quantityOrdered: number
  quantityReceived: number
  quantityShipped: number
  vendor: string
  vendorPoNumber: string
  vendorPoDate: string
  expectedShipDate: string
  carrier: string
  trackingNumber: string
  status: CustomerOrderStatus
  customerVisibleNotes: string
  internalNotes: string
  createdAt: string
  updatedAt: string
}

export type OrderTrackingToken = {
  id: string
  tokenHash: string
  isActive: boolean
  createdAt: string
  disabledAt?: string
  lastAccessedAt?: string
}

export type OrderStatusHistory = {
  id: string
  customerOrderId: string
  customerOrderItemId?: string
  previousStatus?: CustomerOrderStatus
  newStatus: CustomerOrderStatus
  changedBy: string
  customerVisible: boolean
  note: string
  createdAt: string
}

export type PublicLookupAuditLog = {
  id: string
  timestamp: string
  lookupType: 'token' | 'order-or-po'
  orderNumber?: string
  customerPoNumber?: string
  customerOrderId?: string
  success: boolean
  userAgent: string
}

export type CustomerOrder = {
  id: string
  sourceProjectId?: string
  sourceQuoteId?: string
  orderNumber: string
  customerPoNumber: string
  customerName: string
  projectName: string
  orderDate: string
  overallStatus: CustomerOrderStatus
  customerContactName: string
  customerContactEmail: string
  cronosContactName: string
  cronosContactEmail: string
  estimatedShipDate: string
  publicNotes: string
  internalNotes: string
  createdAt: string
  updatedAt: string
  items: CustomerOrderItem[]
  trackingTokens: OrderTrackingToken[]
  statusHistory: OrderStatusHistory[]
}

export type CustomerOrderInput = Pick<
  CustomerOrder,
  | 'orderNumber'
  | 'customerPoNumber'
  | 'customerName'
  | 'projectName'
  | 'orderDate'
  | 'overallStatus'
  | 'customerContactName'
  | 'customerContactEmail'
  | 'cronosContactName'
  | 'cronosContactEmail'
  | 'estimatedShipDate'
  | 'publicNotes'
  | 'internalNotes'
>

export type CustomerOrderItemInput = Omit<CustomerOrderItem, 'id' | 'createdAt' | 'updatedAt'>
