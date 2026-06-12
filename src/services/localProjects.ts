import type { CustomerQuote, Project, ProjectFormInput, ProjectPurchaseOrder, PurchaseOrder, PurchaseOrderLine, QuoteLine, Status } from '../types'
import { TRACKING_25_100_ROWS } from '../data/tracking-25-100-data'
import { generateVendorPurchaseOrders } from './calculations'
import type { CheckbookPoImportInput } from './checkbookImport'
import { syncCustomerOrdersFromApprovedProjects } from './customerOrders'
import { recordPurchaseOrdersInCatalog } from './partCatalog'
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
  const highestNewSequence = project.purchaseOrders.reduce((highest, po) => {
    const escapedProjectNumber = project.projectNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = po.poNumber.match(new RegExp(`^${escapedProjectNumber}-(\\d{4})-`))
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 0)

  return highestNewSequence || project.purchaseOrders.length
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
