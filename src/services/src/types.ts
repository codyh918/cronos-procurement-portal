import type { Component } from 'vue'

export type AppRole = 'Admin' | 'Procurement Team'
export type CanonicalRole = 'admin' | 'procurement'

export type UserProfile = {
  id: string
  name: string
  email: string
  password?: string
  twoFactorSecret?: string
  twoFactorEnabled?: boolean
  role: AppRole
  title: string
  phone: string
  active: boolean
}

export type UserSession = {
  id: string
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
  projectNumber: string
  projectName: string
  customer: string
  customerContactName: string
  customerEmail: string
  customerPhone: string
  shippingContactName: string
  shippingEmail: string
  shippingPhone: string
  shippingInstructions: string
  contractNumber: string
  primeOrSub: 'Prime' | 'Subcontractor'
  projectManager: string
  engineer: string
  startDate: string
  endDate: string
  status: Status
  deliveryAddress: string
  notes: string
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
  quoteNumber: string
  leadTime: string
  approved: boolean
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
  quotes: CustomerQuote[]
  quoteLines: QuoteLine[]
  purchaseOrders: PurchaseOrder[]
  inventory: InventoryItem[]
  kitStatus: Status
  shipmentStatus: Status
}

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
  receivedDate?: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
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
  customerTotalCost?: number
  estimatedShipDate?: string
  expectedDeliveryDate?: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  customerUpdateNotes?: string
  requestor?: string
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
