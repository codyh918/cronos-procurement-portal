import type { CustomerQuote, Project, ProjectPurchaseOrder, PurchaseOrderLine, UserProfile } from '../types'
import { calculateQuoteSummary } from './calculations'
import { loadProjects } from './localProjects'

const TASKS_KEY = 'cronos.procurementTasks'
const DUE_OUTS_KEY = 'cronos.procurementDueOuts'
const ACTIVITY_KEY = 'cronos.procurementActivityLog'

export type ProcurementPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type ProcurementStatus = 'Open' | 'In Progress' | 'Waiting' | 'Complete' | 'Resolved'
export type WaitingOn = 'Vendor' | 'Internal Approval' | 'Customer' | 'Cronos'
export type RelatedRecordType = 'Quote' | 'PO' | 'Vendor' | 'Shipment' | 'RMA' | 'Project'
export type RiskSeverity = 'Low' | 'Medium' | 'High' | 'Critical'
export type ShipmentStatus = 'In transit' | 'Delivering today' | 'Delivered' | 'Delayed' | 'Exception' | 'Tracking missing'

export type ProcurementTask = {
  id: string
  title: string
  description: string
  projectId: string
  projectNumber: string
  customer: string
  assignedToUserId: string
  assignedUser: string
  priority: ProcurementPriority
  dueDate: string
  status: ProcurementStatus
  relatedRecordType: RelatedRecordType
  relatedRecordId: string
  relatedHref: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type ProcurementDueOut = {
  id: string
  title: string
  projectId: string
  projectNumber: string
  customer: string
  ownerUserId: string
  owner: string
  dueDate: string
  status: ProcurementStatus
  nextAction: string
  waitingOn: WaitingOn
  createdAt: string
  updatedAt: string
}

export type VendorUpdate = {
  id: string
  vendor: string
  poId: string
  poNumber: string
  projectId: string
  projectNumber: string
  issueType: string
  lastUpdateDate: string
  daysSinceUpdate: number
  nextAction: string
  status: ProcurementStatus
  relatedHref: string
}

export type ProcurementRisk = {
  id: string
  projectId: string
  projectNumber: string
  customer: string
  poId: string
  lineItemId: string
  manufacturer: string
  partNumber: string
  description: string
  quantity: number
  requiredByDate: string
  currentEta: string
  riskReason: string
  severity: RiskSeverity
  status: ProcurementStatus
  relatedHref: string
}

export type ProcurementShipment = {
  id: string
  vendor: string
  projectId: string
  projectNumber: string
  poId: string
  poNumber: string
  carrier: string
  trackingNumber: string
  estimatedDeliveryDate: string
  actualDeliveryDate: string
  deliveryStatus: ShipmentStatus
  exceptionNotes: string
  relatedHref: string
}

export type ProcurementActivity = {
  id: string
  timestamp: string
  userId: string
  user: string
  action: string
  projectId: string
  projectNumber: string
  relatedRecordType: RelatedRecordType
  relatedRecordId: string
  relatedHref: string
  notes: string
}

export type ProcurementAlert = {
  id: string
  alertType: string
  title: string
  description: string
  severity: RiskSeverity
  assignedToUserId: string
  assignedUser: string
  projectId: string
  projectNumber: string
  relatedRecordType: RelatedRecordType
  relatedRecordId: string
  relatedHref: string
  status: ProcurementStatus
  createdAt: string
  resolvedAt?: string
}

export type ProcurementDashboardData = {
  tasks: ProcurementTask[]
  dueOuts: ProcurementDueOut[]
  vendorUpdates: VendorUpdate[]
  risks: ProcurementRisk[]
  shipments: ProcurementShipment[]
  activity: ProcurementActivity[]
  alerts: ProcurementAlert[]
  pipeline: Array<{ status: string; count: number; href: string }>
}

export function loadProcurementDashboardData(users: UserProfile[]): ProcurementDashboardData {
  const projects = loadProjects()
  const tasks = loadTasks(projects, users)
  const dueOuts = loadDueOuts(projects, users)
  const purchaseOrders = flattenPurchaseOrders(projects)
  const quotes = flattenQuotes(projects)
  const vendorUpdates = buildVendorUpdates(purchaseOrders)
  const risks = buildRisks(projects, purchaseOrders, quotes)
  const shipments = buildShipments(purchaseOrders)
  const activity = loadActivity(projects, users, purchaseOrders, quotes)
  const alerts = buildAlerts(tasks, dueOuts, vendorUpdates, risks, shipments, users)
  const pipeline = buildPipeline(projects, quotes, purchaseOrders)

  return { tasks, dueOuts, vendorUpdates, risks, shipments, activity, alerts, pipeline }
}

export function updateProcurementTask(taskId: string, updates: Partial<Pick<ProcurementTask, 'assignedToUserId' | 'dueDate' | 'status' | 'completedAt'>>) {
  const tasks = readJson<ProcurementTask[]>(TASKS_KEY, [])
  const updated = tasks.map(task =>
    task.id === taskId
      ? {
          ...task,
          ...updates,
          updatedAt: new Date().toISOString(),
          completedAt: updates.status === 'Complete' ? new Date().toISOString() : updates.completedAt,
        }
      : task,
  )
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(updated))
  window.dispatchEvent(new Event('cronos:procurement-dashboard-changed'))
  return updated
}

function loadTasks(projects: Project[], users: UserProfile[]) {
  const stored = readJson<ProcurementTask[]>(TASKS_KEY, [])
  if (stored.length) return hydrateTaskUsers(stored, users)

  const seeded = seedTasks(projects, users)
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(seeded))
  return hydrateTaskUsers(seeded, users)
}

function loadDueOuts(projects: Project[], users: UserProfile[]) {
  const stored = readJson<ProcurementDueOut[]>(DUE_OUTS_KEY, [])
  if (stored.length) return hydrateDueOutUsers(stored, users)

  const seeded = seedDueOuts(projects, users)
  window.localStorage.setItem(DUE_OUTS_KEY, JSON.stringify(seeded))
  return hydrateDueOutUsers(seeded, users)
}

function loadActivity(projects: Project[], users: UserProfile[], pos: FlatPurchaseOrder[], quotes: FlatQuote[]) {
  const stored = readJson<ProcurementActivity[]>(ACTIVITY_KEY, [])
  if (stored.length) return stored

  const user = users[0]
  const seeded: ProcurementActivity[] = [
    ...pos.slice(0, 4).map((po, index) => ({
      id: `activity-po-${po.id}`,
      timestamp: offsetDate(-(index + 1)),
      userId: user?.id ?? '',
      user: user?.name ?? 'System',
      action: po.trackingNumber ? 'Tracking number added' : 'PO issued',
      projectId: po.projectId,
      projectNumber: po.projectNumber,
      relatedRecordType: 'PO' as RelatedRecordType,
      relatedRecordId: po.poNumber,
      relatedHref: `/purchase-orders/${po.id}`,
      notes: po.trackingNumber ? `${po.carrier || 'Carrier'} tracking ${po.trackingNumber}` : `${po.vendor} purchase order is active.`,
    })),
    ...quotes.slice(0, 3).map((quote, index) => ({
      id: `activity-quote-${quote.id}`,
      timestamp: offsetDate(-(index + 5)),
      userId: user?.id ?? '',
      user: user?.name ?? 'System',
      action: quote.status === 'Customer Approved' ? 'Quote approved' : 'Quote sent',
      projectId: quote.projectId,
      projectNumber: quote.projectNumber,
      relatedRecordType: 'Quote' as RelatedRecordType,
      relatedRecordId: quote.quoteNumber,
      relatedHref: `/projects/${quote.projectId}/quotes/${quote.id}/edit`,
      notes: `${quote.customer} ${quote.status.toLowerCase()}.`,
    })),
  ]
  window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(seeded))
  return seeded
}

function seedTasks(projects: Project[], users: UserProfile[]): ProcurementTask[] {
  const fallbackProject = projects[0]
  const activeUsers = users.filter(user => user.active)
  const assignee = activeUsers.find(user => user.role.includes('Procurement')) ?? activeUsers[0]
  const manager = activeUsers.find(user => user.role === 'Admin') ?? assignee
  const sourceProjects = projects.length ? projects.slice(0, 4) : [fallbackSeedProject()]

  return sourceProjects.flatMap((project, index) => [
    createTask(project, assignee, {
      id: `task-vendor-${project.id}`,
      title: `Follow up vendor ETA for ${project.projectNumber}`,
      description: 'Confirm ship date and recovery plan for open material.',
      priority: index === 0 ? 'High' : 'Medium',
      dueDate: offsetDate(index - 1).slice(0, 10),
      status: index === 2 ? 'In Progress' : 'Open',
      relatedRecordType: 'PO',
      relatedRecordId: project.purchaseOrders[0]?.poNumber ?? project.projectNumber,
      relatedHref: project.purchaseOrders[0] ? `/purchase-orders/${project.purchaseOrders[0].id}` : `/projects/${project.id}`,
    }),
    createTask(project, manager, {
      id: `task-approval-${project.id}`,
      title: `Review procurement blockers for ${project.customer}`,
      description: 'Validate overdue actions and unblock purchasing decisions.',
      priority: index === 0 ? 'Critical' : 'High',
      dueDate: offsetDate(index + 1).slice(0, 10),
      status: 'Open',
      relatedRecordType: 'Project',
      relatedRecordId: project.projectNumber,
      relatedHref: `/projects/${project.id}`,
    }),
  ])
}

function seedDueOuts(projects: Project[], users: UserProfile[]): ProcurementDueOut[] {
  const owner = users.find(user => user.active && user.role === 'Procurement Team') ?? users.find(user => user.active) ?? users[0]
  return (projects.length ? projects.slice(0, 6) : [fallbackSeedProject()]).map((project, index) => ({
    id: `dueout-${project.id}`,
    title: `${project.projectNumber} procurement update`,
    projectId: project.id,
    projectNumber: project.projectNumber,
    customer: project.customer,
    ownerUserId: owner?.id ?? '',
    owner: owner?.name ?? 'Unassigned',
    dueDate: offsetDate(index - 2).slice(0, 10),
    status: index % 3 === 0 ? 'Waiting' : 'Open',
    nextAction: index % 2 === 0 ? 'Send customer material status update' : 'Collect vendor ship-date confirmation',
    waitingOn: index % 3 === 0 ? 'Vendor' : index % 3 === 1 ? 'Internal Approval' : 'Customer',
    createdAt: offsetDate(-7),
    updatedAt: offsetDate(-index),
  }))
}

type FlatPurchaseOrder = ProjectPurchaseOrder & { customer: string; requiredByDate: string }
type FlatQuote = CustomerQuote & { projectId: string; projectNumber: string; projectName: string; customer: string }

function flattenPurchaseOrders(projects: Project[]): FlatPurchaseOrder[] {
  return projects.flatMap(project =>
    project.purchaseOrders.map(po => ({
      ...po,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      customer: project.customer,
      requiredByDate: project.endDate || offsetDate(21).slice(0, 10),
    })),
  )
}

function flattenQuotes(projects: Project[]): FlatQuote[] {
  return projects.flatMap(project =>
    (project.quotes ?? []).map(quote => ({
      ...quote,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      customer: project.customer,
    })),
  )
}

function buildVendorUpdates(pos: FlatPurchaseOrder[]): VendorUpdate[] {
  return pos.flatMap(po => {
    const rows: VendorUpdate[] = []
    const days = daysSince(po.dateIssued)
    if (!po.estimatedShipDate && !po.expectedDeliveryDate) rows.push(vendorUpdate(po, 'PO acknowledged but no ship date', days, 'Request confirmed ship date.'))
    if (!po.trackingNumber && !['PO Generated', 'Received', 'Delivered', 'Cancelled'].includes(po.status)) rows.push(vendorUpdate(po, 'Tracking missing', days, 'Request carrier and tracking number.'))
    if (po.lines.some(line => line.status === 'Backordered')) rows.push(vendorUpdate(po, 'Backorder with no recovery date', days, 'Request recovery date or substitute option.'))
    return rows
  })
}

function buildRisks(projects: Project[], pos: FlatPurchaseOrder[], quotes: FlatQuote[]): ProcurementRisk[] {
  const lineRisks = pos.flatMap(po =>
    po.lines.flatMap(line => riskReasons(po, line).map(reason => createRisk(po, line, reason))),
  )
  const quoteRisks = quotes
    .filter(quote => daysUntil(quote.createdAt) <= -27 || quote.status !== 'Customer Approved')
    .slice(0, 3)
    .map(quote => ({
      id: `risk-quote-${quote.id}`,
      projectId: quote.projectId,
      projectNumber: quote.projectNumber,
      customer: quote.customer,
      poId: '',
      lineItemId: quote.id,
      manufacturer: 'Quote',
      partNumber: quote.quoteNumber,
      description: `${quote.quoteNumber} needs approval or refresh.`,
      quantity: quote.lines.length,
      requiredByDate: offsetDate(3).slice(0, 10),
      currentEta: '',
      riskReason: 'Vendor quote expired or aging',
      severity: 'Medium' as RiskSeverity,
      status: 'Open' as ProcurementStatus,
      relatedHref: `/projects/${quote.projectId}/quotes/${quote.id}/edit`,
    }))
  void projects
  return [...lineRisks, ...quoteRisks].slice(0, 40)
}

function buildShipments(pos: FlatPurchaseOrder[]): ProcurementShipment[] {
  return pos.map(po => {
    const status = shipmentStatus(po)
    return {
      id: `shipment-${po.id}`,
      vendor: po.vendor,
      projectId: po.projectId,
      projectNumber: po.projectNumber,
      poId: po.id,
      poNumber: po.poNumber,
      carrier: po.carrier || 'Pending',
      trackingNumber: po.trackingNumber || 'Missing',
      estimatedDeliveryDate: po.expectedDeliveryDate || po.estimatedShipDate || '',
      actualDeliveryDate: status === 'Delivered' ? po.expectedDeliveryDate || '' : '',
      deliveryStatus: status,
      exceptionNotes: status === 'Exception' ? po.customerUpdateNotes || 'Vendor issue requires follow-up.' : status === 'Delayed' ? 'Estimated delivery date has passed.' : '',
      relatedHref: `/purchase-orders/${po.id}`,
    }
  })
}

function buildAlerts(
  tasks: ProcurementTask[],
  dueOuts: ProcurementDueOut[],
  vendorUpdates: VendorUpdate[],
  risks: ProcurementRisk[],
  shipments: ProcurementShipment[],
  users: UserProfile[],
): ProcurementAlert[] {
  const fallbackUser = users.find(user => user.active)
  return [
    ...tasks
      .filter(task => task.status !== 'Complete' && daysUntil(task.dueDate) < 0)
      .map(task => alertRow('task-overdue', `Task overdue: ${task.title}`, `${task.projectNumber} was due ${Math.abs(daysUntil(task.dueDate))} day(s) ago.`, task.priority, task.assignedToUserId, task.assignedUser, task.projectId, task.projectNumber, task.relatedRecordType, task.relatedRecordId, task.relatedHref)),
    ...dueOuts
      .filter(dueOut => dueOut.status !== 'Complete' && daysUntil(dueOut.dueDate) < 0)
      .map(dueOut => alertRow('dueout-overdue', `Due-out overdue: ${dueOut.title}`, dueOut.nextAction, 'High', dueOut.ownerUserId, dueOut.owner, dueOut.projectId, dueOut.projectNumber, 'Project', dueOut.projectNumber, `/projects/${dueOut.projectId}`)),
    ...vendorUpdates
      .filter(update => update.daysSinceUpdate >= 2)
      .map(update => alertRow('vendor-update', update.issueType, update.nextAction, update.daysSinceUpdate > 5 ? 'Critical' : 'High', fallbackUser?.id ?? '', fallbackUser?.name ?? 'Unassigned', update.projectId, update.projectNumber, 'PO', update.poNumber, update.relatedHref)),
    ...risks
      .filter(risk => ['High', 'Critical'].includes(risk.severity))
      .map(risk => alertRow('material-risk', risk.riskReason, risk.description, risk.severity, fallbackUser?.id ?? '', fallbackUser?.name ?? 'Unassigned', risk.projectId, risk.projectNumber, risk.poId ? 'PO' : 'Quote', risk.partNumber, risk.relatedHref)),
    ...shipments
      .filter(shipment => ['Delayed', 'Exception', 'Tracking missing'].includes(shipment.deliveryStatus))
      .map(shipment => alertRow('shipment', `${shipment.deliveryStatus}: ${shipment.poNumber}`, shipment.exceptionNotes || 'Shipment needs procurement follow-up.', shipment.deliveryStatus === 'Exception' ? 'Critical' : 'High', fallbackUser?.id ?? '', fallbackUser?.name ?? 'Unassigned', shipment.projectId, shipment.projectNumber, 'Shipment', shipment.trackingNumber, shipment.relatedHref)),
  ].slice(0, 30)
}

function buildPipeline(projects: Project[], quotes: FlatQuote[], pos: FlatPurchaseOrder[]) {
  const awaitingPricing = quotes.filter(quote => quote.lines.some(line => !line.vendor || line.unitCost <= 0)).length
  const awaitingCustomerApproval = quotes.filter(quote => quote.status === 'Quoted').length
  const readyForPo = quotes.filter(quote => quote.status === 'Customer Approved' && !pos.some(po => po.quoteId === quote.id)).length
  return [
    { status: 'Awaiting pricing', count: awaitingPricing, href: '/quotes' },
    { status: 'Awaiting customer approval', count: awaitingCustomerApproval, href: '/quotes' },
    { status: 'Awaiting internal approval', count: projects.filter(project => project.status === 'Pending Procurement').length, href: '/projects' },
    { status: 'Ready for PO', count: readyForPo, href: '/quotes' },
    { status: 'PO issued', count: pos.filter(po => po.status === 'PO Issued').length, href: '/purchase-orders' },
    { status: 'Awaiting vendor acknowledgment', count: pos.filter(po => po.status === 'PO Generated').length, href: '/purchase-orders' },
    { status: 'Awaiting shipment', count: pos.filter(po => ['Ordered', 'Awaiting Vendor Shipment'].includes(po.status)).length, href: '/purchase-orders' },
    { status: 'Partially received', count: pos.filter(po => po.status === 'Partially Received').length, href: '/purchase-orders' },
    { status: 'Fully received', count: pos.filter(po => po.status === 'Received').length, href: '/purchase-orders' },
    { status: 'Closed', count: pos.filter(po => ['Delivered', 'Cancelled'].includes(po.status)).length, href: '/purchase-orders' },
  ]
}

function createTask(project: Project, user: UserProfile | undefined, task: Omit<ProcurementTask, 'projectId' | 'projectNumber' | 'customer' | 'assignedToUserId' | 'assignedUser' | 'createdAt' | 'updatedAt'>): ProcurementTask {
  return {
    ...task,
    projectId: project.id,
    projectNumber: project.projectNumber,
    customer: project.customer,
    assignedToUserId: user?.id ?? '',
    assignedUser: user?.name ?? 'Unassigned',
    createdAt: offsetDate(-5),
    updatedAt: offsetDate(-1),
  }
}

function hydrateTaskUsers(tasks: ProcurementTask[], users: UserProfile[]) {
  return tasks.map(task => {
    const user = users.find(item => item.id === task.assignedToUserId)
    return { ...task, assignedUser: user?.name ?? task.assignedUser ?? 'Unassigned' }
  })
}

function hydrateDueOutUsers(dueOuts: ProcurementDueOut[], users: UserProfile[]) {
  return dueOuts.map(dueOut => {
    const user = users.find(item => item.id === dueOut.ownerUserId)
    return { ...dueOut, owner: user?.name ?? dueOut.owner ?? 'Unassigned' }
  })
}

function vendorUpdate(po: FlatPurchaseOrder, issueType: string, days: number, nextAction: string): VendorUpdate {
  return {
    id: `vendor-update-${po.id}-${issueType}`,
    vendor: po.vendor,
    poId: po.id,
    poNumber: po.poNumber,
    projectId: po.projectId,
    projectNumber: po.projectNumber,
    issueType,
    lastUpdateDate: po.dateIssued,
    daysSinceUpdate: days,
    nextAction,
    status: 'Open',
    relatedHref: `/purchase-orders/${po.id}`,
  }
}

function riskReasons(po: FlatPurchaseOrder, line: PurchaseOrderLine) {
  const reasons: Array<{ reason: string; severity: RiskSeverity }> = []
  const eta = line.estimatedShipDate || po.estimatedShipDate || po.expectedDeliveryDate
  if (line.status === 'Backordered') reasons.push({ reason: 'Backordered item', severity: eta ? 'High' : 'Critical' })
  if (!line.trackingNumber && !po.trackingNumber && !['PO Generated', 'Received', 'Delivered', 'Cancelled'].includes(line.status)) reasons.push({ reason: 'Missing tracking', severity: 'Medium' })
  if (eta && po.requiredByDate && new Date(eta).getTime() > new Date(po.requiredByDate).getTime()) reasons.push({ reason: 'ETA later than required-by date', severity: 'Critical' })
  if (line.quantityReceived > 0 && line.quantityReceived < line.quantityOrdered) reasons.push({ reason: 'Partial shipment', severity: 'High' })
  if (['RMA', 'RMA / Issue'].includes(line.status)) reasons.push({ reason: 'Damaged/RMA item', severity: 'Critical' })
  if (po.requiredByDate && daysUntil(po.requiredByDate) <= 14 && line.quantityReceived < line.quantityOrdered) reasons.push({ reason: 'Required within 14 days and not received', severity: 'High' })
  return reasons
}

function createRisk(po: FlatPurchaseOrder, line: PurchaseOrderLine, risk: { reason: string; severity: RiskSeverity }): ProcurementRisk {
  return {
    id: `risk-${po.id}-${line.id}-${risk.reason}`,
    projectId: po.projectId,
    projectNumber: po.projectNumber,
    customer: po.customer,
    poId: po.id,
    lineItemId: line.id,
    manufacturer: line.manufacturer || po.vendor,
    partNumber: line.partNumber,
    description: line.description,
    quantity: line.quantityOrdered,
    requiredByDate: po.requiredByDate,
    currentEta: line.estimatedShipDate || po.estimatedShipDate || po.expectedDeliveryDate || '',
    riskReason: risk.reason,
    severity: risk.severity,
    status: 'Open',
    relatedHref: `/purchase-orders/${po.id}`,
  }
}

function shipmentStatus(po: FlatPurchaseOrder): ShipmentStatus {
  if (!po.trackingNumber) return 'Tracking missing'
  if (po.status === 'Delivered' || po.status === 'Received') return 'Delivered'
  if (po.status === 'RMA / Issue') return 'Exception'
  if (po.expectedDeliveryDate && daysUntil(po.expectedDeliveryDate) < 0) return 'Delayed'
  if (po.expectedDeliveryDate && daysUntil(po.expectedDeliveryDate) === 0) return 'Delivering today'
  return 'In transit'
}

function alertRow(
  alertType: string,
  title: string,
  description: string,
  severity: RiskSeverity,
  assignedToUserId: string,
  assignedUser: string,
  projectId: string,
  projectNumber: string,
  relatedRecordType: RelatedRecordType,
  relatedRecordId: string,
  relatedHref: string,
): ProcurementAlert {
  return {
    id: `alert-${alertType}-${projectId}-${relatedRecordId}-${title}`,
    alertType,
    title,
    description,
    severity,
    assignedToUserId,
    assignedUser,
    projectId,
    projectNumber,
    relatedRecordType,
    relatedRecordId,
    relatedHref,
    status: 'Open',
    createdAt: new Date().toISOString(),
  }
}

function fallbackSeedProject(): Project {
  return {
    id: 'seed-project',
    projectType: 'Resale',
    checkbookStartingBalance: 0,
    materialBudget: 0,
    assignedUserIds: [],
    projectNumber: 'CRONOS-SEED',
    projectName: 'Seed Procurement Project',
    customer: 'Cronos Customer',
    customerContactName: '',
    customerEmail: '',
    customerPhone: '',
    shippingContactName: '',
    shippingEmail: '',
    shippingPhone: '',
    shippingInstructions: '',
    contractNumber: '',
    primeOrSub: 'Prime',
    projectManager: '',
    engineer: '',
    startDate: offsetDate(-7).slice(0, 10),
    endDate: offsetDate(21).slice(0, 10),
    status: 'Pending Procurement',
    deliveryAddress: '',
    notes: '',
    quotes: [],
    quoteLines: [],
    purchaseOrders: [],
    inventory: [],
    kitStatus: 'Quoted',
    shipmentStatus: 'Quoted',
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function offsetDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function daysUntil(value: string) {
  if (!value) return 999
  const now = new Date()
  const date = new Date(value)
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

function daysSince(value: string) {
  if (!value) return 999
  return Math.max(0, -daysUntil(value))
}
