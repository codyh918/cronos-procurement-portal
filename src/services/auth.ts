
import type { AppRole, UserProfile, UserSession } from '../types'
import { hydrateLocalCollection, readLocalCollection, saveLocalAndRemoteCollection } from './remoteRecords'

const USERS_KEY = 'cronos.users'
const SESSION_KEY = 'cronos.session'
const ROLE_PREVIEW_KEY = 'cronos.rolePreview'
const CURRENT_AUTH_VERSION = 3
const USERS_REMOTE_TYPE = 'app_users'
const USERS_REMOTE_KEY = 'all'
let usersHydration: Promise<UserProfile[]> | null = null

export const appRoles: AppRole[] = ['Admin', 'Procurement Team', 'Accounting', 'Executive']

const seededAdmin: UserProfile = {
  id: 'seed-admin-cody',
  name: 'Cody Hibbard',
  email: 'cody.hibbard@cronosllc.com',
  password: 'CronosAdmin!2026',
  role: 'Admin',
  title: 'Administrator',
  phone: '',
  active: true,
}

export type PendingLogin = {
  id: string
  name: string
  email: string
  role: AppRole
  title: string
  twoFactorEnabled: boolean
  setupSecret?: string
  setupUri?: string
}

export function fetchSession(): UserSession | null {
  const session = readJson<UserSession | null>(SESSION_KEY, null)
  if (!session) return null
  if (session.authVersion !== CURRENT_AUTH_VERSION) {
    setSession(null)
    return null
  }

  const user = readStoredUsers().find(item => item.id === session.id || item.email.toLowerCase() === session.email.toLowerCase())
  if (!user?.active) {
    setSession(null)
    return null
  }

  const syncedSession = toSession(user)
  if (
    syncedSession.id !== session.id ||
    syncedSession.name !== session.name ||
    syncedSession.email !== session.email ||
    syncedSession.role !== session.role ||
    syncedSession.title !== session.title
  ) {
    setSession(syncedSession)
  }

  return syncedSession
}

export function ensureDefaultAdminSession() {
  return fetchSession()
}

export function loginUser(email: string, password: string) {
  const user = findActiveUser(email, password)
  const session = toSession(user)
  setSession(session)
  return session
}

export async function beginLogin(email: string, password: string): Promise<PendingLogin> {
  await hydrateUsers(true)
  const user = findActiveUser(email, password)
  if (!user.twoFactorSecret) {
    const secret = generateTotpSecret()
    const users = readStoredUsers().map(item => (item.id === user.id ? { ...item, twoFactorSecret: secret, twoFactorEnabled: false } : item))
    saveUsers(users)
    return toPendingLogin({ ...user, twoFactorSecret: secret, twoFactorEnabled: false })
  }

  return toPendingLogin(user)
}

export async function completeLogin(userId: string, code: string) {
  await hydrateUsers(true)
  const users = readStoredUsers()
  const user = users.find(item => item.id === userId)
  if (!user?.active || !user.twoFactorSecret) {
    throw new Error('Invalid email or password.')
  }

  const verified = await verifyTotpCode(user.twoFactorSecret, code)
  if (!verified) {
    throw new Error('Invalid authenticator code.')
  }

  if (!user.twoFactorEnabled) {
    saveUsers(users.map(item => (item.id === user.id ? { ...item, twoFactorEnabled: true } : item)))
  }

  const session = toSession(user)
  setSession(session)
  return session
}

export function setSession(session: UserSession | null) {
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(SESSION_KEY)
  }
  window.dispatchEvent(new Event('cronos:session-changed'))
}

export function logoutUser() {
  setSession(null)
}

export function loadUsers() {
  void hydrateUsers()
  return readStoredUsers().map(redactPassword)
}

export function addUser(input: Omit<UserProfile, 'id'>) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const password = String(input.password ?? '')

  if (!name || !email || password.length < 8) {
    throw new Error('Name, email, and a password of at least 8 characters are required.')
  }

  const users = readStoredUsers()
  if (users.some(user => user.email.toLowerCase() === email)) {
    throw new Error('A user with that email already exists.')
  }

  const created: UserProfile = {
    ...input,
    id: crypto.randomUUID(),
    name,
    email,
    title: input.title.trim(),
    phone: input.phone.trim(),
    active: input.active !== false,
  }
  const updated = sortUsers([...users, created])
  saveUsers(updated)
  return updated.map(redactPassword)
}

export function updateUser(userId: string, updates: Partial<UserProfile>) {
  const users = readStoredUsers()
  let matched = false
  const updated = users.map(user => {
    if (user.id !== userId) return user
    matched = true
    const password = typeof updates.password === 'string' ? updates.password.trim() : ''
    return {
      ...user,
      name: typeof updates.name === 'string' ? updates.name.trim() : user.name,
      email: typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : user.email,
      password: password ? password : user.password,
      twoFactorSecret: Object.prototype.hasOwnProperty.call(updates, 'twoFactorSecret') ? updates.twoFactorSecret : user.twoFactorSecret,
      twoFactorEnabled: updates.twoFactorEnabled ?? user.twoFactorEnabled,
      role: updates.role ?? user.role,
      title: typeof updates.title === 'string' ? updates.title.trim() : user.title,
      phone: typeof updates.phone === 'string' ? updates.phone.trim() : user.phone,
      active: typeof updates.active === 'boolean' ? updates.active : user.active,
    }
  })

  if (!matched) throw new Error('Unable to update user.')

  const sorted = sortUsers(updated)
  saveUsers(sorted)
  syncSessionAfterUserUpdate(sorted)
  return sorted.map(redactPassword)
}

export function resetUserTwoFactor(userId: string) {
  const users = readStoredUsers()
  const updated = users.map(user => (user.id === userId ? { ...user, twoFactorSecret: undefined, twoFactorEnabled: false } : user))
  saveUsers(updated)
  syncSessionAfterUserUpdate(updated)
  return updated.map(redactPassword)
}

export function getRolePreview() {
  const value = window.localStorage.getItem(ROLE_PREVIEW_KEY) as AppRole | null
  return value && appRoles.includes(value) ? value : null
}

export function setRolePreview(role: AppRole | '') {
  if (role) {
    window.localStorage.setItem(ROLE_PREVIEW_KEY, role)
  } else {
    window.localStorage.removeItem(ROLE_PREVIEW_KEY)
  }
  window.dispatchEvent(new Event('cronos:role-preview-changed'))
}

export function getEffectiveRole(session: UserSession | null = fetchSession()) {
  if (!session) return null
  return session.role === 'Admin' ? getRolePreview() ?? session.role : session.role
}

function readStoredUsers() {
  void hydrateUsers()
  const users = readLocalCollection<UserProfile>(USERS_KEY)
  const normalized = ensureSeededAdmin(users)
  if (JSON.stringify(normalized) !== JSON.stringify(users)) {
    saveUsers(normalized)
  }
  return normalized
}

function hydrateUsers(force = false) {
  if (typeof window === 'undefined') return Promise.resolve([] as UserProfile[])
  if (usersHydration && !force) return usersHydration

  usersHydration = hydrateLocalCollection<UserProfile>(USERS_KEY, USERS_REMOTE_TYPE, USERS_REMOTE_KEY, {
    eventName: 'cronos:users-changed',
    normalize: ensureSeededAdmin,
  })
  return usersHydration
}

function findActiveUser(email: string, password: string) {
  const user = readStoredUsers().find(item => item.email.toLowerCase() === email.trim().toLowerCase())
  if (!user?.active || user.password !== password) {
    throw new Error('Invalid email or password.')
  }
  return user
}

function saveUsers(users: UserProfile[]) {
  saveLocalAndRemoteCollection(USERS_KEY, USERS_REMOTE_TYPE, USERS_REMOTE_KEY, users, 'cronos:users-changed')
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function sortUsers(users: UserProfile[]) {
  return [...users].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function redactPassword(user: UserProfile): UserProfile {
  const { password: _password, ...safeUser } = user
  return safeUser
}

function ensureSeededAdmin(users: UserProfile[]) {
  const existing = users.find(user => user.email.toLowerCase() === seededAdmin.email)
  if (!existing) return sortUsers([seededAdmin, ...users])

  return sortUsers(
    users.map(user => {
      const role = appRoles.includes(user.role) ? user.role : 'Procurement Team'
      return user.email.toLowerCase() === seededAdmin.email
        ? {
            ...user,
            id: user.id || seededAdmin.id,
            name: user.name || seededAdmin.name,
            email: seededAdmin.email,
            password: !user.password || user.password === 'admin' ? seededAdmin.password : user.password,
            role: 'Admin',
            title: user.title || seededAdmin.title,
            phone: user.phone ?? seededAdmin.phone,
            active: true,
          }
        : {
            ...user,
            role,
            twoFactorEnabled: user.twoFactorEnabled ?? false,
          }
    }),
  )
}

function toPendingLogin(user: UserProfile): PendingLogin {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    setupSecret: user.twoFactorEnabled ? undefined : user.twoFactorSecret,
    setupUri: user.twoFactorEnabled || !user.twoFactorSecret ? undefined : buildOtpAuthUri(user),
  }
}

function toSession(user: UserProfile): UserSession {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    authVersion: CURRENT_AUTH_VERSION,
  }
}

function generateTotpSecret() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

function buildOtpAuthUri(user: UserProfile) {
  const issuer = 'Cronos Procurement'
  const label = `${issuer}:${user.email}`
  const params = new URLSearchParams({
    secret: user.twoFactorSecret ?? '',
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

async function verifyTotpCode(secret: string, code: string) {
  const cleanCode = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(cleanCode)) return false

  const timestep = Math.floor(Date.now() / 1000 / 30)
  const expectedCodes = await Promise.all([-1, 0, 1].map(offset => generateTotpCode(secret, timestep + offset)))
  return expectedCodes.includes(cleanCode)
}

async function generateTotpCode(secret: string, counter: number) {
  const key = await crypto.subtle.importKey('raw', decodeBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const counterBytes = new ArrayBuffer(8)
  const view = new DataView(counterBytes)
  view.setUint32(4, counter, false)
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes))
  const offset = signature[signature.length - 1] & 0x0f
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff)
  return String(binary % 1000000).padStart(6, '0')
}

function decodeBase32(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = secret.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of clean) {
    const index = alphabet.indexOf(char)
    if (index === -1) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(bytes)
}

function syncSessionAfterUserUpdate(users: UserProfile[]) {
  const session = fetchSession()
  if (!session) return

  const user = users.find(item => item.id === session.id)
  if (!user || !user.active) {
    setSession(null)
    return
  }

  setSession(toSession(user))
}

import type {
  CustomerOrder,
  CustomerOrderInput,
  CustomerOrderItem,
  CustomerOrderItemInput,
  CustomerOrderStatus,
  Project,
  PublicLookupAuditLog,
} from '../types'
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
  const origin = typeof window === 'undefined' ? 'https://atlas.cronosllc.com' : window.location.origin
  return `${origin}/orders/track/${encodeURIComponent(token)}`
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
    cronosContactName: existing?.cronosContactName ?? 'Cody Hibbard',
    cronosContactEmail: existing?.cronosContactEmail ?? 'cody.hibbard@cronosllc.com',
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

import type { CustomerQuote, Project, ProjectFormInput, ProjectPurchaseOrder, PurchaseOrder, PurchaseOrderLine, QuoteLine, Status } from '../types'
import { TRACKING_25_100_ROWS } from '../data/tracking-25-100-data'
import { generateVendorPurchaseOrders } from './calculations'
import type { CheckbookPoImportInput } from './checkbookImport'
import { syncCustomerOrdersFromApprovedProjects } from './customerOrders'
import { recordPurchaseOrdersInCatalog } from './partCatalog'
import { buildInventoryItem, getPurchaseOrderStatus, receiveLine, type ReceiveWarehouseInput } from './receiving'
import { hydrateLocalCollection, readLocalCollection, saveLocalAndRemoteCollection } from './remoteRecords'
import type { TrackingImportInput } from './trackingImport'

const STORAGE_KEY = 'cronos.projects'
const REMOTE_TYPE = 'projects'
const REMOTE_KEY = 'all'
let hydrationStarted = false

export function loadProjects(): Project[] {
  hydrateProjects()
  return readLocalCollection<Project>(STORAGE_KEY).map(normalizeProject)
}

function hydrateProjects() {
  if (hydrationStarted || typeof window === 'undefined') return
  hydrationStarted = true
  void hydrateLocalCollection<Project>(STORAGE_KEY, REMOTE_TYPE, REMOTE_KEY, {
    eventName: 'cronos:projects-changed',
    normalize: projects => projects.map(normalizeProject),
  })
}

export function saveProject(input: ProjectFormInput): Project {
  const project: Project = {
    ...input,
    id: crypto.randomUUID(),
    checkbookStartingBalance: Number(input.checkbookStartingBalance || 0),
    quotes: [],
    quoteLines: [],
    purchaseOrders: [],
    inventory: [],
    kitStatus: 'Quoted',
    shipmentStatus: 'Quoted',
  }

  saveProjects([project, ...loadProjects()])
  return project
}

export function loadProject(id: string): Project | undefined {
  return loadProjects().find(project => project.id === id)
}

export function updateProjectFromInput(id: string, input: ProjectFormInput): Project | undefined {
  let updatedProject: Project | undefined
  const projects = loadProjects().map(project => {
    if (project.id !== id) return project

    const oldProjectNumber = project.projectNumber
    const projectNumber = input.projectNumber.trim()
    const projectName = input.projectName.trim()
    const customer = input.customer.trim()
    updatedProject = normalizeProject({
      ...project,
      ...input,
      projectNumber,
      projectName,
      customer,
      checkbookStartingBalance: Number(input.checkbookStartingBalance || 0),
      quotes: (project.quotes ?? []).map(quote => ({
        ...quote,
        projectNumber,
        projectName,
        customer,
        quoteNumber: replaceProjectPrefix(quote.quoteNumber, oldProjectNumber, projectNumber),
      })),
      purchaseOrders: project.purchaseOrders.map(po => ({
        ...po,
        poNumber: replaceProjectPrefix(po.poNumber, oldProjectNumber, projectNumber),
      })),
    })
    return updatedProject
  })

  if (!updatedProject) return undefined

  saveProjects(projects)
  return updatedProject
}

export function deleteProject(projectId: string) {
  const projects = loadProjects()
  const projectToDelete = projects.find(project => project.id === projectId)

  if (!projectToDelete) {
    throw new Error('Project not found.')
  }

  saveProjects(projects.filter(project => project.id !== projectId))
  return projectToDelete
}

export function createQuoteForProject(
  projectId: string,
  lines: Array<Omit<QuoteLine, 'id' | 'approved'>>,
  options: { contractFeeEnabled?: boolean; expirationDays?: 30 | 60 | 90; shippingCost?: number } = {},
): CustomerQuote {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const quoteLines: QuoteLine[] = lines.map(line => ({
    ...line,
    id: crypto.randomUUID(),
    approved: false,
  }))
  const quote: CustomerQuote = {
    id: crypto.randomUUID(),
    quoteNumber: nextQuoteNumber(project),
    projectId: project.id,
    projectNumber: project.projectNumber,
    projectName: project.projectName,
    customer: project.customer,
    status: 'Quoted',
    createdAt: new Date().toISOString(),
    expirationDays: options.expirationDays ?? 30,
    contractFeeEnabled: options.contractFeeEnabled ?? false,
    shippingCost: normalizeMoney(options.shippingCost),
    lines: quoteLines,
  }

  const projects = loadProjects().map(current =>
    current.id === project.id
      ? normalizeProject({
          ...current,
          quotes: [quote, ...(current.quotes ?? [])],
          quoteLines: [...quoteLines, ...(current.quoteLines ?? [])],
        })
      : current,
  )

  saveProjects(projects)
  return quote
}

export function updateQuoteForProject(
  projectId: string,
  quoteId: string,
  lines: Array<Omit<QuoteLine, 'id' | 'approved'> & Partial<Pick<QuoteLine, 'id' | 'approved'>>>,
  options: { contractFeeEnabled?: boolean; expirationDays?: 30 | 60 | 90; shippingCost?: number } = {},
): CustomerQuote {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const existingQuote = project.quotes?.find(quote => quote.id === quoteId)
  if (!existingQuote) {
    throw new Error('Quote not found.')
  }

  const quoteLines: QuoteLine[] = lines.map(line => ({
    ...line,
    id: line.id ?? crypto.randomUUID(),
    approved: line.approved ?? false,
  }))
  const updatedQuote: CustomerQuote = {
    ...existingQuote,
    expirationDays: options.expirationDays ?? existingQuote.expirationDays ?? 30,
    contractFeeEnabled: options.contractFeeEnabled ?? existingQuote.contractFeeEnabled ?? false,
    shippingCost: normalizeMoney(options.shippingCost ?? existingQuote.shippingCost),
    lines: quoteLines,
  }
  const quotes = (project.quotes ?? []).map(quote => (quote.id === quoteId ? updatedQuote : quote))
  const projects = loadProjects().map(current =>
    current.id === project.id
      ? normalizeProject({
          ...current,
          quotes,
          quoteLines: quotes.flatMap(quote => quote.lines),
        })
      : current,
  )

  saveProjects(projects)
  return updatedQuote
}

export function setQuoteApprovalStatus(projectId: string, quoteId: string, approved: boolean) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const quote = project.quotes?.find(item => item.id === quoteId)
  if (!quote) {
    throw new Error('Quote not found.')
  }

  const quoteLines = quote.lines.map(line => ({
    ...line,
    approved,
  }))
  const updatedQuote: CustomerQuote = {
    ...quote,
    status: approved ? 'Customer Approved' : 'Quoted',
    lines: quoteLines,
  }
  const quotes = (project.quotes ?? []).map(item => (item.id === quoteId ? updatedQuote : item))
  const purchaseOrders = approved ? project.purchaseOrders : project.purchaseOrders.filter(po => po.quoteId !== quoteId)
  const projectHasApprovedQuotes = quotes.some(item => item.status === 'Customer Approved')
  const updatedProject = normalizeProject({
    ...project,
    status: projectHasApprovedQuotes ? 'Customer Approved' : 'Quoted',
    quotes,
    quoteLines: quotes.flatMap(item => item.lines),
    purchaseOrders,
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))
  recordPurchaseOrdersInCatalog(updatedProject, purchaseOrders)
  if (approved) {
    syncCustomerOrdersFromApprovedProjects([updatedProject])
  }

  return {
    project: updatedProject,
    quote: updatedQuote,
    purchaseOrders: purchaseOrders.filter(po => po.quoteId === quoteId),
  }
}

export function generatePurchaseOrdersForQuote(projectId: string, quoteId: string) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const quote = project.quotes?.find(item => item.id === quoteId)
  if (!quote) {
    throw new Error('Quote not found.')
  }

  if (quote.status !== 'Customer Approved') {
    throw new Error('Quote must be approved before generating purchase orders.')
  }

  const existing = project.purchaseOrders.filter(po => po.quoteId === quoteId)
  if (existing.length) {
    return {
      project,
      quote,
      purchaseOrders: existing,
    }
  }

  const purchaseOrders = generateVendorPurchaseOrders(quote.lines, project.projectNumber, nextPoSequence(project)).map(po => ({
    ...po,
    quoteId,
  }))
  const updatedProject = normalizeProject({
    ...project,
    purchaseOrders: [...project.purchaseOrders, ...purchaseOrders],
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))
  recordPurchaseOrdersInCatalog(updatedProject, purchaseOrders)
  syncCustomerOrdersFromApprovedProjects([updatedProject])

  return {
    project: updatedProject,
    quote,
    purchaseOrders,
  }
}

export function generatePurchaseOrdersForApprovedQuotes(projectId?: string) {
  const projects = projectId ? loadProjects().filter(project => project.id === projectId) : loadProjects()
  const updatedProjects = projects.map(project => {
    const approvedQuotes = (project.quotes ?? []).filter(quote => quote.status === 'Customer Approved')
    const missingQuotes = approvedQuotes.filter(quote => !project.purchaseOrders.some(po => po.quoteId === quote.id))

    if (!missingQuotes.length) return project

    let nextSequenceProject = project
    const newPurchaseOrders = missingQuotes.flatMap(quote => {
      const purchaseOrders = generateVendorPurchaseOrders(quote.lines, project.projectNumber, nextPoSequence(nextSequenceProject)).map(po => ({
        ...po,
        quoteId: quote.id,
      }))
      nextSequenceProject = {
        ...nextSequenceProject,
        purchaseOrders: [...nextSequenceProject.purchaseOrders, ...purchaseOrders],
      }
      return purchaseOrders
    })

    const updatedProject = normalizeProject({
      ...project,
      purchaseOrders: [...project.purchaseOrders, ...newPurchaseOrders],
    })
    saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))
    recordPurchaseOrdersInCatalog(updatedProject, newPurchaseOrders)
    syncCustomerOrdersFromApprovedProjects([updatedProject])
    return updatedProject
  })

  return updatedProjects
}

export function loadQuotes(): CustomerQuote[] {
  return loadProjects().flatMap(project => project.quotes ?? [])
}

export function loadPurchaseOrders(): ProjectPurchaseOrder[] {
  return loadProjects().flatMap(project =>
    (project.purchaseOrders ?? []).map(po => ({
      ...po,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.projectName,
    })),
  )
}

export function loadPurchaseOrder(poId: string): ProjectPurchaseOrder | undefined {
  return loadPurchaseOrders().find(po => po.id === poId)
}

export function syncCheckbookTrackingRows() {
  const checkbookProject = loadProjects().find(project => project.projectNumber.trim().toLowerCase() === '25-100')
  if (!checkbookProject) {
    return {
      importedCount: 0,
      skippedCount: 0,
    }
  }

  const result = importPurchaseOrderTracking(checkbookProject.id, TRACKING_25_100_ROWS)
  return {
    importedCount: result.importedCount,
    skippedCount: result.skippedCount,
  }
}

export function importCheckbookPurchaseOrders(projectId: string, rows: CheckbookPoImportInput[]) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const existingPoNumbers = new Set(project.purchaseOrders.map(po => po.poNumber.trim().toLowerCase()))
  const matchingRows = rows.filter(row => row.projectNumber.trim().toLowerCase() === project.projectNumber.trim().toLowerCase())
  const newPurchaseOrders: PurchaseOrder[] = matchingRows
    .filter(row => row.poNumber.trim() && row.vendor.trim() && row.totalCost > 0)
    .filter(row => !existingPoNumbers.has(row.poNumber.trim().toLowerCase()))
    .map(row => {
      const totalCost = normalizeMoney(row.totalCost)
      const customerTotalCost = normalizeMoney(row.customerTotalCost ?? row.totalCost)

      return {
        id: crypto.randomUUID(),
        poNumber: row.poNumber.trim(),
        vendor: row.vendor.trim(),
        description: row.description.trim(),
        dateIssued: normalizeOptionalDateString(row.dateIssued) || row.dateIssued || todayLocalDateString(),
        status: 'PO Issued',
        totalCost,
        customerTotalCost,
        expectedDeliveryDate: '',
        customerUpdateNotes: row.description.trim(),
        requestor: row.requestor?.trim() ?? '',
        lines: [
          {
            id: crypto.randomUUID(),
            clin: 'CHECKBOOK',
            partNumber: row.poNumber.trim(),
            manufacturer: row.vendor.trim(),
            description: row.description.trim() || `Checkbook PO ${row.poNumber.trim()}`,
            quantityOrdered: 1,
            quantityReceived: 0,
            unitCost: totalCost,
            status: 'Ordered',
            vendorOrderNumber: '',
            estimatedShipDate: '',
            receivedDate: '',
            carrier: '',
            trackingNumber: '',
            trackingUrl: '',
            notes: '',
          },
        ],
      }
    })

  if (!newPurchaseOrders.length) {
    return {
      project,
      importedCount: 0,
      skippedCount: matchingRows.length,
    }
  }

  const updatedProject = normalizeProject({
    ...project,
    projectType: 'Checkbook',
    status: project.status === 'Quoted' ? 'PO Issued' : project.status,
    purchaseOrders: [...project.purchaseOrders, ...newPurchaseOrders],
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))
  recordPurchaseOrdersInCatalog(updatedProject, newPurchaseOrders)

  return {
    project: updatedProject,
    importedCount: newPurchaseOrders.length,
    skippedCount: matchingRows.length - newPurchaseOrders.length,
  }
}

export function updatePurchaseOrderTracking(
  projectId: string,
  poId: string,
  updates: Partial<
    Pick<
      PurchaseOrder,
      'dateIssued' | 'status' | 'estimatedShipDate' | 'expectedDeliveryDate' | 'carrier' | 'trackingNumber' | 'trackingUrl' | 'customerUpdateNotes'
    >
  >,
) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const updatedProject = normalizeProject({
    ...project,
    purchaseOrders: project.purchaseOrders.map(po => (po.id === poId ? { ...po, ...updates } : po)),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))
  return updatedProject
}

export function updatePurchaseOrderLineTracking(
  projectId: string,
  poId: string,
  lineId: string,
  updates: Partial<
    Pick<
      PurchaseOrderLine,
      'status' | 'vendorOrderNumber' | 'estimatedShipDate' | 'receivedDate' | 'carrier' | 'trackingNumber' | 'trackingUrl' | 'notes' | 'quantityReceived'
    >
  >,
) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const updatedProject = normalizeProject({
    ...project,
    purchaseOrders: project.purchaseOrders.map(po => {
      if (po.id !== poId) return po

      const lines = po.lines.map(line =>
        line.id === lineId
          ? {
              ...line,
              ...updates,
              estimatedShipDate: normalizeOptionalDateString(updates.estimatedShipDate) || updates.estimatedShipDate,
              receivedDate: normalizeOptionalDateString(updates.receivedDate) || updates.receivedDate,
              quantityReceived:
                typeof updates.quantityReceived === 'number'
                  ? Math.min(Math.max(0, updates.quantityReceived), line.quantityOrdered)
                  : line.quantityReceived,
            }
          : line,
      )

      const carriers = uniqueValues(lines.map(line => line.carrier || po.carrier))
      const trackingNumbers = uniqueValues(lines.map(line => line.trackingNumber || po.trackingNumber))
      const estimatedShipDate = earliestDate(lines.map(line => line.estimatedShipDate || po.estimatedShipDate))
      const receivedDate = latestDate(lines.map(line => line.receivedDate || po.expectedDeliveryDate))

      return {
        ...po,
        carrier: carriers.join(', ') || po.carrier || '',
        trackingNumber: trackingNumbers.join(', ') || po.trackingNumber || '',
        trackingUrl: trackingNumbers.length === 1 ? buildTrackingUrl(carriers[0], trackingNumbers[0]) : po.trackingUrl || '',
        estimatedShipDate: estimatedShipDate || po.estimatedShipDate || '',
        expectedDeliveryDate: receivedDate || po.expectedDeliveryDate || '',
        status: getTrackingAwarePoStatus(lines, po.status),
        lines,
      }
    }),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))
  return updatedProject
}

export function importPurchaseOrderTracking(projectId: string, rows: TrackingImportInput[]) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const matchingRows = rows.filter(row => row.projectNumber.trim().toLowerCase() === project.projectNumber.trim().toLowerCase())
  const rowsByPo = groupTrackingRowsByPo(matchingRows)
  let updatedCount = 0
  const purchaseOrders = project.purchaseOrders.map(po => {
    const trackingRows = rowsByPo.get(po.poNumber.trim().toLowerCase())
    if (!trackingRows?.length) return po

    updatedCount += 1

    const carriers = uniqueValues(trackingRows.map(row => row.carrier))
    const trackingNumbers = uniqueValues(trackingRows.map(row => row.trackingNumber))
    const vendorOrderNumbers = uniqueValues(trackingRows.map(row => row.vendorOrderNumber))
    const estimatedShipDate = earliestDate(trackingRows.map(row => row.estimatedShipDate))
    const receivedDate = latestDate(trackingRows.map(row => row.receivedDate))
    const allRowsReceived = trackingRows.every(row => row.receivedDate)
    const anyRowsReceived = trackingRows.some(row => row.receivedDate)
    const status: Status = allRowsReceived ? 'Received' : anyRowsReceived ? 'Partially Received' : po.status
    const lineStatus: Status = allRowsReceived ? 'Received' : anyRowsReceived ? 'Partially Received' : 'Ordered'
    const lines = mergeTrackingRowsIntoPoLines(po, trackingRows, lineStatus)

    return {
      ...po,
      status,
      carrier: carriers.join(', ') || po.carrier || '',
      trackingNumber: trackingNumbers.join(', ') || po.trackingNumber || '',
      trackingUrl: trackingNumbers.length === 1 ? buildTrackingUrl(carriers[0], trackingNumbers[0]) : po.trackingUrl || '',
      estimatedShipDate: estimatedShipDate || po.estimatedShipDate || '',
      expectedDeliveryDate: receivedDate || po.expectedDeliveryDate || '',
      customerUpdateNotes: buildTrackingUpdateNote(trackingRows, vendorOrderNumbers),
      lines,
    }
  })
  const updatedProject = normalizeProject({
    ...project,
    purchaseOrders,
    inventory: project.inventory.map(item => {
      const trackingRows = rowsByPo.get(item.poNumber.trim().toLowerCase())
      if (!trackingRows?.length) return item
      const receivedDate = latestDate(trackingRows.map(row => row.receivedDate))
      return {
        ...item,
        status: receivedDate ? 'Received' : item.status,
        receivedDate: receivedDate || item.receivedDate,
      }
    }),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))

  return {
    project: updatedProject,
    importedCount: updatedCount,
    skippedCount: rowsByPo.size - updatedCount,
  }
}

export function receivePurchaseOrderLine(projectId: string, poId: string, lineId: string, input: ReceiveWarehouseInput) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const purchaseOrder = project.purchaseOrders.find(po => po.id === poId)
  if (!purchaseOrder) {
    throw new Error('Purchase order not found.')
  }

  const originalLine = purchaseOrder.lines.find(line => line.id === lineId)
  if (!originalLine) {
    throw new Error('Purchase order line not found.')
  }

  const receivedLine = receiveLine(originalLine, input.quantity)
  const inventoryItem = buildInventoryItem(project, purchaseOrder, receivedLine, input)
  const purchaseOrders = project.purchaseOrders.map(po => {
    if (po.id !== poId) return po

    const lines = po.lines.map(line => (line.id === lineId ? receivedLine : line))

    return {
      ...po,
      status: getPurchaseOrderStatus(lines, po.status),
      lines,
    }
  })
  const updatedProject = normalizeProject({
    ...project,
    purchaseOrders,
    inventory: [inventoryItem, ...project.inventory],
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)))

  return {
    project: updatedProject,
    inventoryItem,
  }
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    projectType: project.projectType ?? 'Design & Install',
    checkbookStartingBalance: Number(project.checkbookStartingBalance || 0),
    assignedUserIds: Array.isArray(project.assignedUserIds) ? project.assignedUserIds : [],
    quotes: project.quotes ?? [],
    quoteLines: project.quoteLines ?? [],
    purchaseOrders: project.purchaseOrders ?? [],
    inventory: project.inventory ?? [],
    kitStatus: project.kitStatus ?? 'Quoted',
    shipmentStatus: project.shipmentStatus ?? 'Quoted',
  }
}

function saveProjects(projects: Project[]) {
  saveLocalAndRemoteCollection(STORAGE_KEY, REMOTE_TYPE, REMOTE_KEY, projects.map(normalizeProject), 'cronos:projects-changed')
}

function nextQuoteNumber(project: Project) {
  const next = (project.quotes?.length ?? 0) + 1
  const suffix = String(next).padStart(3, '0')
  const base = project.projectNumber || 'CRONOS'
  return `${base}-Q-${suffix}`
}

function nextPoSequence(project: Project) {
  return project.purchaseOrders.reduce((highest, po) => {
    const match = po.poNumber.match(/-PO-(\d+)$/)
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 5100)
}

function replaceProjectPrefix(value: string, oldProjectNumber: string, newProjectNumber: string) {
  if (!oldProjectNumber || !value.startsWith(oldProjectNumber)) return value
  return `${newProjectNumber}${value.slice(oldProjectNumber.length)}`
}

function normalizeMoney(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(((value ?? 0) + Number.EPSILON) * 100) / 100) : 0
}

function todayLocalDateString() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeOptionalDateString(value?: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]))
}

function earliestDate(values: Array<string | undefined>) {
  return sortedDates(values)[0] ?? ''
}

function latestDate(values: Array<string | undefined>) {
  return sortedDates(values).at(-1) ?? ''
}

function sortedDates(values: Array<string | undefined>) {
  return values
    .map(normalizeOptionalDateString)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
}

function groupTrackingRowsByPo(rows: TrackingImportInput[]) {
  return rows.reduce<Map<string, TrackingImportInput[]>>((groups, row) => {
    const key = row.poNumber.trim().toLowerCase()
    if (!key) return groups
    groups.set(key, [...(groups.get(key) ?? []), row])
    return groups
  }, new Map())
}

function getTrackingAwarePoStatus(lines: PurchaseOrderLine[], previousStatus: Status): Status {
  if (!lines.length) return previousStatus
  if (lines.every(line => line.quantityReceived >= line.quantityOrdered)) return 'Received'
  if (lines.some(line => line.quantityReceived > 0)) return 'Partially Received'
  return previousStatus
}

function buildTrackingUpdateNote(rows: TrackingImportInput[], vendorOrderNumbers: string[]) {
  const receivedCount = rows.filter(row => row.receivedDate).length
  const trackingCount = rows.filter(row => row.trackingNumber).length
  const pendingCount = rows.length - receivedCount
  const vendorOrderText = vendorOrderNumbers.length ? ` Vendor order ${vendorOrderNumbers.join(', ')}.` : ''
  const pendingText = pendingCount ? ` ${pendingCount} line${pendingCount === 1 ? '' : 's'} pending receipt.` : ' All tracked lines have been received.'

  return `${rows.length} line${rows.length === 1 ? '' : 's'} tracked from procurement log.${vendorOrderText} ${trackingCount} tracking number${trackingCount === 1 ? '' : 's'} on file.${pendingText}`.trim()
}

function normalizePurchaseOrderLine(line: PurchaseOrderLine, po?: PurchaseOrder): PurchaseOrderLine {
  return {
    ...line,
    itemNumber: line.itemNumber ?? '',
    vendorOrderNumber: line.vendorOrderNumber ?? '',
    estimatedShipDate: normalizeOptionalDateString(line.estimatedShipDate) || normalizeOptionalDateString(po?.estimatedShipDate),
    receivedDate: normalizeOptionalDateString(line.receivedDate) || normalizeOptionalDateString(po?.expectedDeliveryDate),
    carrier: line.carrier ?? po?.carrier ?? '',
    trackingNumber: line.trackingNumber ?? po?.trackingNumber ?? '',
    trackingUrl: line.trackingUrl ?? po?.trackingUrl ?? '',
    notes: line.notes ?? '',
  }
}

function mergeTrackingRowsIntoPoLines(po: PurchaseOrder, trackingRows: TrackingImportInput[], fallbackStatus: Status): PurchaseOrderLine[] {
  const existingLines = po.lines.map(line => normalizePurchaseOrderLine(line, po))
  const usedLineIds = new Set<string>()
  const trackedLines = trackingRows.map(row => {
    const match = findBestTrackingLineMatch(existingLines, row, usedLineIds)
    const quantityOrdered = row.quantity || match?.quantityOrdered || 1
    const quantityReceived = row.receivedDate ? Math.max(row.quantity, match?.quantityReceived ?? 0) : match?.quantityReceived ?? 0
    const status: Status = row.receivedDate ? 'Received' : row.trackingNumber ? 'Shipped' : row.estimatedShipDate ? 'Ordered' : fallbackStatus
    const line: PurchaseOrderLine = {
      id: match?.id ?? crypto.randomUUID(),
      itemNumber: row.itemNumber,
      clin: match?.clin ?? row.itemNumber ?? 'TRACKING',
      partNumber: row.partNumber || match?.partNumber || '',
      manufacturer: row.manufacturer || match?.manufacturer || po.vendor,
      description: row.description || match?.description || `Tracked line for ${po.poNumber}`,
      quantityOrdered,
      quantityReceived: Math.min(quantityReceived, quantityOrdered),
      unitCost: match?.unitCost ?? 0,
      status,
      vendorOrderNumber: row.vendorOrderNumber ?? match?.vendorOrderNumber ?? '',
      estimatedShipDate: normalizeOptionalDateString(row.estimatedShipDate) || match?.estimatedShipDate || '',
      receivedDate: normalizeOptionalDateString(row.receivedDate) || match?.receivedDate || '',
      carrier: row.carrier ?? match?.carrier ?? po.carrier ?? '',
      trackingNumber: row.trackingNumber ?? match?.trackingNumber ?? '',
      trackingUrl: buildTrackingUrl(row.carrier, row.trackingNumber) || match?.trackingUrl || '',
      notes: row.notes ?? match?.notes ?? '',
    }

    usedLineIds.add(line.id)
    return line
  })
  const untouchedLines = existingLines.filter(line => !usedLineIds.has(line.id))
  return [...trackedLines, ...untouchedLines]
}

function findBestTrackingLineMatch(lines: PurchaseOrderLine[], row: TrackingImportInput, usedLineIds: Set<string>) {
  const normalizedPart = row.partNumber.trim().toLowerCase()
  const normalizedDescription = row.description.trim().toLowerCase()

  return (
    lines.find(line => !usedLineIds.has(line.id) && normalizedPart && line.partNumber.trim().toLowerCase() === normalizedPart) ??
    lines.find(line => !usedLineIds.has(line.id) && normalizedDescription && line.description.trim().toLowerCase() === normalizedDescription) ??
    (lines.length === 1 && !usedLineIds.has(lines[0].id) ? lines[0] : undefined)
  )
}

function buildTrackingUrl(carrier: string | undefined, trackingNumber: string | undefined) {
  const tracking = trackingNumber?.trim()
  if (!tracking) return ''

  const normalizedCarrier = carrier?.toLowerCase() ?? ''
  if (normalizedCarrier.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tracking)}`
  if (normalizedCarrier.includes('ups')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(tracking)}`

  return ''
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

function getClient() {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  client = url && key ? createClient(url, key) : null
  return client
}

export function hasRemoteRecords() {
  return Boolean(getClient())
}

export async function loadRemoteRecord<T>(recordType: string, recordKey: string): Promise<T | null> {
  const supabase = getClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('app_records')
    .select('data')
    .eq('record_type', recordType)
    .eq('record_key', recordKey)
    .maybeSingle()

  if (error) {
    console.warn(`Unable to load ${recordType}:${recordKey} from Supabase`, error)
    return null
  }

  return (data?.data as T | undefined) ?? null
}

export async function saveRemoteRecord<T>(recordType: string, recordKey: string, data: T) {
  const supabase = getClient()
  if (!supabase) return

  const { error } = await supabase.from('app_records').upsert(
    {
      record_type: recordType,
      record_key: recordKey,
      data,
    },
    { onConflict: 'record_type,record_key' },
  )

  if (error) {
    console.warn(`Unable to save ${recordType}:${recordKey} to Supabase`, error)
  }
}

export async function hydrateLocalCollection<T>(
  storageKey: string,
  recordType: string,
  recordKey: string,
  options: {
    eventName?: string
    normalize?: (items: T[]) => T[]
  } = {},
) {
  const remote = await loadRemoteRecord<T[]>(recordType, recordKey)
  if (Array.isArray(remote)) {
    const normalized = options.normalize ? options.normalize(remote) : remote
    window.localStorage.setItem(storageKey, JSON.stringify(normalized))
    if (options.eventName) window.dispatchEvent(new Event(options.eventName))
    return normalized
  }

  const local = readLocalCollection<T>(storageKey)
  if (local.length) {
    await saveRemoteRecord(recordType, recordKey, local)
  }

  return local
}

export function saveLocalAndRemoteCollection<T>(storageKey: string, recordType: string, recordKey: string, items: T[], eventName?: string) {
  window.localStorage.setItem(storageKey, JSON.stringify(items))
  if (eventName) window.dispatchEvent(new Event(eventName))
  void saveRemoteRecord(recordType, recordKey, items)
}

export function readLocalCollection<T>(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}
