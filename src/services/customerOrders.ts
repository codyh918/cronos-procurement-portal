import type {
  CustomerOrder,
  CustomerOrderInput,
  CustomerOrderItem,
  CustomerOrderItemInput,
  CustomerOrderStatus,
  Project,
  PublicLookupAuditLog,
} from '../types'
import { getAppBaseUrl } from './environment'
import { getProjectDocumentContact } from './documentContacts'
import { hydrateLocalCollection, readLocalCollection, saveLocalAndRemoteCollection } from './remoteRecords'

const ORDERS_KEY = 'cronos.customerOrders'
const AUDIT_KEY = 'cronos.publicLookupAuditLog'
const RATE_KEY = 'cronos.publicLookupRate'
const TOKEN_PREFIX = 'cronos_ot_'
const REMOTE_TYPE = 'customer_orders'
const REMOTE_KEY = 'all'
let hydrationStarted = false

export const customerOrderStatuses: CustomerOrderStatus[] = [
  'Pending Procurement',
  'PO Issued',
  'Backordered',
  'Awaiting Vendor Shipment',
  'In Transit to Cronos',
  'Received at Cronos',
  'Kitted',
  'Partially Shipped',
  'Shipped to Customer',
  'Delivered',
  'Cancelled',
  'RMA / Issue',
]

export const timelineSteps = ['Order Received', 'Procurement Started', 'Vendor POs Issued', 'Shipped', 'Delivered'] as const

export function loadCustomerOrders(): CustomerOrder[] {
  if (typeof window === 'undefined') return []

  hydrateCustomerOrders()
  const orders = readLocalCollection<CustomerOrder>(ORDERS_KEY).map(normalizeOrder)
  const cleaned = orders.filter(order => order.id !== 'sample-order-26-077')
  if (cleaned.length !== orders.length) saveCustomerOrders(cleaned)
  return cleaned
}

function hydrateCustomerOrders() {
  if (hydrationStarted || typeof window === 'undefined') return
  hydrationStarted = true
  void hydrateLocalCollection<CustomerOrder>(ORDERS_KEY, REMOTE_TYPE, REMOTE_KEY, {
    eventName: 'cronos:customer-orders-changed',
    normalize: orders => orders.map(normalizeOrder).filter(order => order.id !== 'sample-order-26-077'),
  })
}

export function saveCustomerOrders(orders: CustomerOrder[]) {
  if (typeof window === 'undefined') return

  saveLocalAndRemoteCollection(ORDERS_KEY, REMOTE_TYPE, REMOTE_KEY, orders.map(normalizeOrder), 'cronos:customer-orders-changed')
}

export function deleteCustomerOrdersForQuote(projectId: string, quoteId: string) {
  const orders = loadCustomerOrders()
  const remainingOrders = orders.filter(order => order.sourceProjectId !== projectId || order.sourceQuoteId !== quoteId)
  if (remainingOrders.length !== orders.length) saveCustomerOrders(remainingOrders)
  return orders.length - remainingOrders.length
}

export function loadCustomerOrder(id: string) {
  return loadCustomerOrders().find(order => order.id === id)
}

export function createCustomerOrder(input: CustomerOrderInput) {
  const now = new Date().toISOString()
  const order: CustomerOrder = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    items: [],
    trackingTokens: [],
    statusHistory: [
      {
        id: crypto.randomUUID(),
        customerOrderId: 'new',
        newStatus: input.overallStatus,
        changedBy: 'Cronos Admin',
        customerVisible: true,
        note: 'Order created.',
        createdAt: now,
      },
    ],
  }
  order.statusHistory[0].customerOrderId = order.id
  saveCustomerOrders([order, ...loadCustomerOrders()])
  return order
}

export function updateCustomerOrder(orderId: string, updates: Partial<CustomerOrderInput>) {
  const orders = loadCustomerOrders()
  const now = new Date().toISOString()
  let updated: CustomerOrder | undefined

  saveCustomerOrders(
    orders.map(order => {
      if (order.id !== orderId) return order
      updated = normalizeOrder({ ...order, ...updates, updatedAt: now })
      return updated
    }),
  )

  if (!updated) throw new Error('Order not found.')
  return updated
}

export function addCustomerOrderItem(orderId: string, input: CustomerOrderItemInput) {
  const orders = loadCustomerOrders()
  const now = new Date().toISOString()
  let updated: CustomerOrder | undefined
  const item: CustomerOrderItem = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now }

  saveCustomerOrders(
    orders.map(order => {
      if (order.id !== orderId) return order
      updated = normalizeOrder({
        ...order,
        updatedAt: now,
        items: [...order.items, item],
      })
      return updated
    }),
  )

  if (!updated) throw new Error('Order not found.')
  return updated
}

export function updateCustomerOrderItem(
  orderId: string,
  itemId: string,
  updates: Partial<CustomerOrderItemInput>,
  changedBy = 'Cronos Admin',
) {
  const orders = loadCustomerOrders()
  const now = new Date().toISOString()
  let updated: CustomerOrder | undefined

  saveCustomerOrders(
    orders.map(order => {
      if (order.id !== orderId) return order
      const currentItem = order.items.find(item => item.id === itemId)
      const previousStatus = currentItem?.status
      const items = order.items.map(item => (item.id === itemId ? { ...item, ...updates, updatedAt: now } : item))
      const statusHistory =
        updates.status && previousStatus && updates.status !== previousStatus
          ? [
              {
                id: crypto.randomUUID(),
                customerOrderId: order.id,
                customerOrderItemId: itemId,
                previousStatus,
                newStatus: updates.status,
                changedBy,
                customerVisible: true,
                note: updates.customerVisibleNotes || `Line ${currentItem?.lineNumber ?? ''} status updated.`,
                createdAt: now,
              },
              ...order.statusHistory,
            ]
          : order.statusHistory

      updated = normalizeOrder({
        ...order,
        items,
        statusHistory,
        overallStatus: deriveOverallStatus(items, order.overallStatus),
        updatedAt: now,
      })
      return updated
    }),
  )

  if (!updated) throw new Error('Order not found.')
  return updated
}

export async function generateTrackingToken(orderId: string) {
  const rawToken = `${TOKEN_PREFIX}${randomToken()}`
  const tokenHash = await hashToken(rawToken)
  const now = new Date().toISOString()
  const orders = loadCustomerOrders()
  let updated: CustomerOrder | undefined

  saveCustomerOrders(
    orders.map(order => {
      if (order.id !== orderId) return order
      updated = {
        ...order,
        updatedAt: now,
        trackingTokens: [{ id: crypto.randomUUID(), tokenHash, isActive: true, createdAt: now }, ...order.trackingTokens],
      }
      return updated
    }),
  )

  if (!updated) throw new Error('Order not found.')
  return { order: updated, token: rawToken, link: buildTrackingLink(rawToken) }
}

export function disableTrackingToken(orderId: string, tokenId: string) {
  const orders = loadCustomerOrders()
  const now = new Date().toISOString()
  let updated: CustomerOrder | undefined

  saveCustomerOrders(
    orders.map(order => {
      if (order.id !== orderId) return order
      updated = {
        ...order,
        updatedAt: now,
        trackingTokens: order.trackingTokens.map(token => (token.id === tokenId ? { ...token, isActive: false, disabledAt: now } : token)),
      }
      return updated
    }),
  )

  if (!updated) throw new Error('Order not found.')
  return updated
}

export async function findOrderByToken(rawToken: string) {
  if (!rawToken.trim()) return undefined
  if (isRateLimited()) {
    logPublicLookup({ lookupType: 'token', success: false })
    return undefined
  }

  const tokenHash = await hashToken(rawToken)
  const orders = loadCustomerOrders()
  const now = new Date().toISOString()
  let found: CustomerOrder | undefined
  const updatedOrders = orders.map(order => {
    const match = order.trackingTokens.find(token => token.tokenHash === tokenHash && token.isActive)
    if (!match) return order
    found = normalizeOrder(order)
    return {
      ...order,
      trackingTokens: order.trackingTokens.map(token => (token.id === match.id ? { ...token, lastAccessedAt: now } : token)),
    }
  })

  saveCustomerOrders(updatedOrders)
  logPublicLookup({ lookupType: 'token', customerOrderId: found?.id, success: Boolean(found) })
  return found
}

export function findOrderByOrderOrPo(searchValue: string) {
  if (isRateLimited()) {
    logPublicLookup({ lookupType: 'order-or-po', orderNumber: searchValue, customerPoNumber: searchValue, success: false })
    return undefined
  }

  const normalizedSearch = normalizeLookup(searchValue)
  if (!normalizedSearch) {
    logPublicLookup({ lookupType: 'order-or-po', orderNumber: searchValue, customerPoNumber: searchValue, success: false })
    return undefined
  }

  const found = loadCustomerOrders().find(
    order => normalizeLookup(order.orderNumber) === normalizedSearch || normalizeLookup(order.customerPoNumber) === normalizedSearch,
  )
  logPublicLookup({
    lookupType: 'order-or-po',
    orderNumber: searchValue,
    customerPoNumber: searchValue,
    customerOrderId: found?.id,
    success: Boolean(found),
  })
  return found
}

export function getPublicLookupAuditLog() {
  if (typeof window === 'undefined') return []

  try {
    return JSON.parse(window.localStorage.getItem(AUDIT_KEY) || '[]') as PublicLookupAuditLog[]
  } catch {
    return []
  }
}

export function buildTrackingLink(token: string) {
  return `${getAppBaseUrl()}/orders/track/${encodeURIComponent(token)}`
}

export function syncCustomerOrdersFromApprovedProjects(projects: Project[]) {
  if (typeof window === 'undefined') return []

  const existingOrders = loadCustomerOrders()
  const ordersBySource = new Map(
    existingOrders.filter(order => order.sourceProjectId && order.sourceQuoteId).map(order => [`${order.sourceProjectId}:${order.sourceQuoteId}`, order]),
  )
  const syncedOrders: CustomerOrder[] = []

  projects.forEach(project => {
    ;(project.quotes ?? [])
      .filter(quote => quote.status === 'Customer Approved')
      .forEach(quote => {
        const key = `${project.id}:${quote.id}`
        const existing = ordersBySource.get(key)
        syncedOrders.push(buildCustomerOrderFromApprovedQuote(project, quote, existing))
      })
  })

  const syncedIds = new Set(syncedOrders.map(order => order.id))
  const manualOrders = existingOrders.filter(order => !order.sourceProjectId || !order.sourceQuoteId || !syncedIds.has(order.id))
  const nextOrders = [...syncedOrders, ...manualOrders].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  saveCustomerOrders(nextOrders)
  return nextOrders
}

export function getLatestTrackingLink(order: CustomerOrder) {
  const active = order.trackingTokens.find(token => token.isActive)
  return active ? 'Generated. Use Copy Customer Tracking Link for the newest raw link.' : 'No active tracking link.'
}

export function getTimelineIndex(status: CustomerOrderStatus) {
  if (status === 'Delivered') return 4
  if (status === 'Shipped to Customer' || status === 'Partially Shipped') return 3
  if (status === 'Kitted' || status === 'Received at Cronos') return 2
  if (status === 'PO Issued' || status === 'Awaiting Vendor Shipment' || status === 'Backordered' || status === 'In Transit to Cronos') return 2
  if (status === 'Pending Procurement') return 1
  return 0
}

function logPublicLookup(input: Omit<PublicLookupAuditLog, 'id' | 'timestamp' | 'userAgent'>) {
  if (typeof window === 'undefined') return

  const log = getPublicLookupAuditLog()
  const row: PublicLookupAuditLog = {
    ...input,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent || 'browser',
  }
  window.localStorage.setItem(AUDIT_KEY, JSON.stringify([row, ...log].slice(0, 500)))
}

function buildCustomerOrderFromApprovedQuote(project: Project, quote: Project['quotes'][number], existing?: CustomerOrder): CustomerOrder {
  const now = new Date().toISOString()
  const sourcePurchaseOrders = project.purchaseOrders.filter(po => po.quoteId === quote.id)
  const items = quote.lines.map((line, index) => {
    const poMatch = sourcePurchaseOrders.find(po =>
      po.lines.some(poLine => stripPoPrefix(poLine.id) === line.id || normalizeLookup(poLine.partNumber) === normalizeLookup(line.partNumber)),
    )
    const poLine = poMatch?.lines.find(item => stripPoPrefix(item.id) === line.id || normalizeLookup(item.partNumber) === normalizeLookup(line.partNumber))
    const existingItem = existing?.items.find(
      item => item.lineNumber === (line.clin || String(index + 1)) || normalizeLookup(item.partNumber) === normalizeLookup(line.partNumber),
    )

    return {
      id: existingItem?.id ?? crypto.randomUUID(),
      lineNumber: line.clin || String(index + 1),
      manufacturer: line.manufacturer,
      partNumber: line.partNumber,
      description: line.description,
      quantityOrdered: line.quantity,
      quantityReceived: poLine?.quantityReceived ?? existingItem?.quantityReceived ?? 0,
      quantityShipped: existingItem?.quantityShipped ?? 0,
      vendor: poMatch?.vendor || line.vendor || existingItem?.vendor || '',
      vendorPoNumber: poMatch?.poNumber || existingItem?.vendorPoNumber || '',
      vendorPoDate: poMatch?.dateIssued || existingItem?.vendorPoDate || '',
      expectedShipDate: poLine?.estimatedShipDate || poMatch?.estimatedShipDate || existingItem?.expectedShipDate || '',
      carrier: poLine?.carrier || poMatch?.carrier || existingItem?.carrier || '',
      trackingNumber: poLine?.trackingNumber || poMatch?.trackingNumber || existingItem?.trackingNumber || '',
      status: mapProjectLineStatus(poMatch, poLine, Boolean(sourcePurchaseOrders.length), existingItem?.status),
      customerVisibleNotes: existingItem?.customerVisibleNotes || '',
      internalNotes: existingItem?.internalNotes || '',
      createdAt: existingItem?.createdAt ?? now,
      updatedAt: now,
    }
  })
  const overallStatus = deriveOverallStatus(items, sourcePurchaseOrders.length ? 'PO Issued' : 'Pending Procurement')
  const poc = getProjectDocumentContact(project)

  return normalizeOrder({
    id: existing?.id ?? crypto.randomUUID(),
    sourceProjectId: project.id,
    sourceQuoteId: quote.id,
    orderNumber: project.projectNumber,
    customerPoNumber: quote.quoteNumber,
    customerName: project.customer,
    projectName: project.projectName,
    orderDate: quote.createdAt?.slice(0, 10) || now.slice(0, 10),
    overallStatus,
    customerContactName: project.customerContactName ?? existing?.customerContactName ?? '',
    customerContactEmail: project.customerEmail ?? existing?.customerContactEmail ?? '',
    cronosContactName: poc.name,
    cronosContactEmail: poc.email,
    estimatedShipDate: earliestNonEmpty(items.map(item => item.expectedShipDate)) || existing?.estimatedShipDate || '',
    publicNotes: existing?.publicNotes ?? 'Cronos will update this order page as procurement and shipment status changes.',
    internalNotes: existing?.internalNotes ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    items,
    trackingTokens: existing?.trackingTokens ?? [],
    statusHistory: existing?.statusHistory?.length
      ? existing.statusHistory
      : [
          {
            id: crypto.randomUUID(),
            customerOrderId: existing?.id ?? 'new',
            newStatus: overallStatus,
            changedBy: 'Cronos Sync',
            customerVisible: true,
            note: 'Customer order created from approved project quote.',
            createdAt: now,
          },
        ],
  })
}

function mapProjectLineStatus(
  po: Project['purchaseOrders'][number] | undefined,
  line: Project['purchaseOrders'][number]['lines'][number] | undefined,
  hasPurchaseOrders: boolean,
  fallback?: CustomerOrderStatus,
): CustomerOrderStatus {
  if (line?.trackingNumber || po?.trackingNumber) return 'In Transit to Cronos'
  if (line?.quantityReceived && line.quantityReceived >= line.quantityOrdered) return 'Received at Cronos'
  if (line?.quantityReceived && line.quantityReceived > 0) return 'In Transit to Cronos'
  if (line?.status === 'Backordered' || po?.lines.some(item => item.status === 'Backordered')) return 'Backordered'
  if (po) return 'PO Issued'
  if (hasPurchaseOrders) return 'Awaiting Vendor Shipment'
  return fallback ?? 'Pending Procurement'
}

function isRateLimited() {
  if (typeof window === 'undefined') return false

  const now = Date.now()
  const attempts = JSON.parse(window.localStorage.getItem(RATE_KEY) || '[]') as number[]
  const recent = attempts.filter(value => now - value < 60000)
  recent.push(now)
  window.localStorage.setItem(RATE_KEY, JSON.stringify(recent))
  return recent.length > 20
}

function normalizeOrder(order: CustomerOrder): CustomerOrder {
  const normalized: CustomerOrder = {
    ...order,
    estimatedShipDate: order.estimatedShipDate ?? '',
    publicNotes: order.publicNotes ?? '',
    internalNotes: order.internalNotes ?? '',
    items: (order.items ?? []).map((item, index) => ({
      ...item,
      lineNumber: item.lineNumber || String(index + 1),
      customerVisibleNotes: item.customerVisibleNotes ?? '',
      internalNotes: item.internalNotes ?? '',
      expectedShipDate: item.expectedShipDate ?? '',
      carrier: item.carrier ?? '',
      trackingNumber: item.trackingNumber ?? '',
      quantityReceived: Number(item.quantityReceived ?? 0),
      quantityShipped: Number(item.quantityShipped ?? 0),
    })),
    trackingTokens: order.trackingTokens ?? [],
    statusHistory: order.statusHistory ?? [],
  }

  return {
    ...normalized,
    statusHistory: normalized.statusHistory.map(row => ({
      ...row,
      customerOrderId: normalized.id,
    })),
  }
}

function deriveOverallStatus(items: CustomerOrderItem[], fallback: CustomerOrderStatus): CustomerOrderStatus {
  if (!items.length) return fallback
  if (items.every(item => item.status === 'Delivered')) return 'Delivered'
  if (items.some(item => item.status === 'Shipped to Customer' || item.quantityShipped > 0)) return 'Partially Shipped'
  if (items.every(item => item.status === 'Received at Cronos' || item.status === 'Kitted')) return 'Received at Cronos'
  if (items.some(item => item.status === 'In Transit to Cronos')) return 'In Transit to Cronos'
  if (items.some(item => item.status === 'PO Issued' || item.vendorPoNumber)) return 'PO Issued'
  return fallback
}

async function hashToken(token: string) {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function stripPoPrefix(value: string) {
  return value.startsWith('po-') ? value.slice(3) : value
}

function earliestNonEmpty(values: string[]) {
  return values.filter(Boolean).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? ''
}
