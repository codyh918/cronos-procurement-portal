import type { CustomerQuote, Project, ProjectFormInput, ProjectPurchaseOrder, PurchaseOrder, PurchaseOrderLine, QuoteLine, Status } from '../types'
import { TRACKING_25_100_ROWS } from '../data/tracking-25-100-data'
import { generateVendorPurchaseOrders, groupQuoteLinesByVendor, marginPercentToMarkupPercent } from './calculations'
import type { CheckbookPoImportInput } from './checkbookImport'
import { syncCustomerOrdersFromApprovedProjects } from './customerOrders'
import { recordPurchaseOrdersInCatalog } from './partCatalog'
import { hydrateLocalCollection, readLocalCollection, saveLocalAndRemoteCollection } from './remoteRecords'
import type { TrackingImportInput } from './trackingImport'
import { loadVendorDirectory } from './vendorDirectory'
import { normalizeCustomerFields } from './customerFormatting'
import { createCustomerFromProject, findAddressById, findCustomerById, rememberCustomerUse, snapshotFromCustomerAddress, upsertAddressForProject } from './customerRecords'

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
    mergeWithLocal: mergeProjectsPreservingNestedRecords,
  })
}

export function saveProject(input: ProjectFormInput): Project {
  const project: Project = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    checkbookStartingBalance: Number(input.checkbookStartingBalance || 0),
    materialBudget: Number(input.materialBudget || 0),
    quotes: [],
    quoteLines: [],
    purchaseOrders: [],
    inventory: [],
    kitStatus: 'Quoted',
    shipmentStatus: 'Quoted',
  }

  const linkedProject = linkProjectCustomer(project)
  saveProjects([linkedProject, ...loadProjects()], linkedProject.id)
  return linkedProject
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
    updatedProject = linkProjectCustomer(normalizeProject({
      ...project,
      ...input,
      projectNumber,
      projectName,
      customer,
      checkbookStartingBalance: Number(input.checkbookStartingBalance || 0),
      materialBudget: Number(input.materialBudget || 0),
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
    }))
    return updatedProject
  })

  if (!updatedProject) return undefined

  saveProjects(projects, updatedProject.id)
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
  options: { contractFeeEnabled?: boolean; expirationDays?: 30 | 60 | 90; quoteName?: string; shippingCost?: number } = {},
): CustomerQuote {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const quoteLines: QuoteLine[] = lines.map(line => normalizeQuoteLineForSave({ ...line, id: crypto.randomUUID(), approved: false }))
  const quote: CustomerQuote = {
    id: crypto.randomUUID(),
    quoteNumber: nextQuoteNumber(project),
    projectId: project.id,
    projectNumber: project.projectNumber,
    projectName: project.projectName,
    customer: project.customer,
    quoteName: options.quoteName?.trim() ?? '',
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

  saveProjects(projects, project.id)
  return quote
}

export function updateQuoteForProject(
  projectId: string,
  quoteId: string,
  lines: Array<Omit<QuoteLine, 'id' | 'approved'> & Partial<Pick<QuoteLine, 'id' | 'approved'>>>,
  options: { contractFeeEnabled?: boolean; expirationDays?: 30 | 60 | 90; quoteName?: string; shippingCost?: number } = {},
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
    ...normalizeQuoteLineForSave(line),
    approved: existingQuote.status === 'Customer Approved' ? true : line.approved ?? false,
  }))
  const updatedQuote: CustomerQuote = {
    ...existingQuote,
    quoteName: options.quoteName?.trim() ?? existingQuote.quoteName ?? '',
    expirationDays: options.expirationDays ?? existingQuote.expirationDays ?? 30,
    contractFeeEnabled: options.contractFeeEnabled ?? existingQuote.contractFeeEnabled ?? false,
    shippingCost: normalizeMoney(options.shippingCost ?? existingQuote.shippingCost),
    lines: quoteLines,
  }
  const quotes = (project.quotes ?? []).map(quote => (quote.id === quoteId ? updatedQuote : quote))
  const projectWithQuote = normalizeProject({
    ...project,
    quotes,
    quoteLines: quotes.flatMap(quote => quote.lines),
  })
  const syncResult = syncPurchaseOrdersForQuote(projectWithQuote, updatedQuote)
  const updatedProject = syncResult.project
  const projects = loadProjects().map(current => (current.id === project.id ? updatedProject : current))

  saveProjects(projects, updatedProject.id)
  if (syncResult.touchedPurchaseOrders.length) {
    recordPurchaseOrdersInCatalog(updatedProject, syncResult.touchedPurchaseOrders)
    syncCustomerOrdersFromApprovedProjects([updatedProject])
  }
  logQuotePoSync(updatedQuote, syncResult)
  return updatedQuote
}

export function updateQuoteName(projectId: string, quoteId: string, quoteName: string) {
  const project = loadProject(projectId)
  if (!project) {
    throw new Error('Project not found.')
  }

  const quotes = (project.quotes ?? []).map(quote =>
    quote.id === quoteId
      ? {
          ...quote,
          quoteName: quoteName.trim(),
        }
      : quote,
  )

  if (!quotes.some(quote => quote.id === quoteId)) {
    throw new Error('Quote not found.')
  }

  const updatedProject = normalizeProject({
    ...project,
    quotes,
    quoteLines: quotes.flatMap(quote => quote.lines),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
  return updatedProject
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

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
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
    const syncResult = syncPurchaseOrdersForQuote(project, quote)
    if (syncResult.touchedPurchaseOrders.length) {
      saveProjects(loadProjects().map(current => (current.id === project.id ? syncResult.project : current)), syncResult.project.id)
      recordPurchaseOrdersInCatalog(syncResult.project, syncResult.touchedPurchaseOrders)
      syncCustomerOrdersFromApprovedProjects([syncResult.project])
    }
    logQuotePoSync(quote, syncResult)
    return {
      project: syncResult.project,
      quote,
      purchaseOrders: syncResult.project.purchaseOrders.filter(po => po.quoteId === quoteId),
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

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
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
    if (!approvedQuotes.length) return project

    let nextProject = project
    const touchedPurchaseOrders: PurchaseOrder[] = []
    approvedQuotes.forEach(quote => {
      const hasRelatedPurchaseOrders = nextProject.purchaseOrders.some(po => po.quoteId === quote.id)
      if (!hasRelatedPurchaseOrders) {
        const purchaseOrders = generateVendorPurchaseOrders(quote.lines, nextProject.projectNumber, nextPoSequence(nextProject)).map(po => ({
          ...po,
          quoteId: quote.id,
        }))
        nextProject = normalizeProject({
          ...nextProject,
          purchaseOrders: [...nextProject.purchaseOrders, ...purchaseOrders],
        })
        touchedPurchaseOrders.push(...purchaseOrders)
        return
      }

      const syncResult = syncPurchaseOrdersForQuote(nextProject, quote)
      nextProject = syncResult.project
      touchedPurchaseOrders.push(...syncResult.touchedPurchaseOrders)
      logQuotePoSync(quote, syncResult)
    })

    if (!touchedPurchaseOrders.length) return project

    saveProjects(loadProjects().map(current => (current.id === project.id ? nextProject : current)), nextProject.id)
    recordPurchaseOrdersInCatalog(nextProject, touchedPurchaseOrders)
    syncCustomerOrdersFromApprovedProjects([nextProject])
    return nextProject
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

export function loadPurchaseOrder(identifier: string): ProjectPurchaseOrder | undefined {
  const normalizedIdentifier = decodeURIComponent(identifier).trim().toLowerCase()
  return loadPurchaseOrders().find(po =>
    po.id.toLowerCase() === normalizedIdentifier || po.poNumber.trim().toLowerCase() === normalizedIdentifier,
  )
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
        terms: defaultPurchaseOrderTerms(row.vendor),
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
            estimatedDeliveryDate: '',
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

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
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

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
  return updatedProject
}

export function updatePurchaseOrderDetails(
  projectId: string,
  poId: string,
  updates: Partial<
    Pick<
      PurchaseOrder,
      | 'poNumber'
      | 'vendor'
      | 'description'
      | 'dateIssued'
      | 'status'
      | 'estimatedShipDate'
      | 'expectedDeliveryDate'
      | 'carrier'
      | 'trackingNumber'
      | 'trackingUrl'
      | 'customerUpdateNotes'
      | 'requestor'
      | 'customerTotalCost'
      | 'terms'
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

      const nextPo = {
        ...po,
        ...updates,
        poNumber: updates.poNumber?.trim() || po.poNumber,
        vendor: updates.vendor?.trim() || po.vendor,
        terms: updates.terms?.trim() ?? po.terms,
        dateIssued: normalizeOptionalDateString(updates.dateIssued) || updates.dateIssued || po.dateIssued,
        estimatedShipDate: normalizeOptionalDateString(updates.estimatedShipDate) || updates.estimatedShipDate || po.estimatedShipDate,
        expectedDeliveryDate: normalizeOptionalDateString(updates.expectedDeliveryDate) || updates.expectedDeliveryDate || po.expectedDeliveryDate,
        customerTotalCost:
          typeof updates.customerTotalCost === 'number'
            ? normalizeMoney(updates.customerTotalCost)
            : po.customerTotalCost,
      }

      return {
        ...nextPo,
        totalCost: getPurchaseOrderComputedTotal(nextPo.lines),
      }
    }),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
  return updatedProject
}

export function updatePurchaseOrderLineTracking(
  projectId: string,
  poId: string,
  lineId: string,
  updates: Partial<
    Pick<
      PurchaseOrderLine,
      | 'status'
      | 'vendorOrderNumber'
      | 'estimatedShipDate'
      | 'estimatedDeliveryDate'
      | 'receivedDate'
      | 'carrier'
      | 'trackingNumber'
      | 'trackingUrl'
      | 'notes'
      | 'quantityReceived'
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
              estimatedDeliveryDate: normalizeOptionalDateString(updates.estimatedDeliveryDate) || updates.estimatedDeliveryDate,
              receivedDate: normalizeOptionalDateString(updates.receivedDate) || updates.receivedDate,
              quantityReceived:
                typeof updates.quantityReceived === 'number'
                  ? Math.min(Math.max(0, updates.quantityReceived), line.quantityOrdered)
                  : line.quantityReceived,
            }
          : line,
      )

      return summarizePurchaseOrderTracking(po, lines)
    }),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
  return updatedProject
}

export function updatePurchaseOrderLineDetails(
  projectId: string,
  poId: string,
  lineId: string,
  updates: Partial<
    Pick<
      PurchaseOrderLine,
      | 'itemNumber'
      | 'clin'
      | 'partNumber'
      | 'manufacturer'
      | 'description'
      | 'quantityOrdered'
      | 'quantityReceived'
      | 'unitCost'
      | 'status'
      | 'vendorOrderNumber'
      | 'estimatedShipDate'
      | 'estimatedDeliveryDate'
      | 'receivedDate'
      | 'carrier'
      | 'trackingNumber'
      | 'trackingUrl'
      | 'notes'
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
              itemNumber: updates.itemNumber?.trim() || line.itemNumber,
              clin: updates.clin?.trim() || line.clin,
              partNumber: updates.partNumber?.trim() || line.partNumber,
              manufacturer: updates.manufacturer?.trim() ?? line.manufacturer,
              description: updates.description?.trim() || line.description,
              quantityOrdered:
                typeof updates.quantityOrdered === 'number'
                  ? Math.max(0, updates.quantityOrdered)
                  : line.quantityOrdered,
              quantityReceived:
                typeof updates.quantityReceived === 'number'
                  ? Math.min(Math.max(0, updates.quantityReceived), updates.quantityOrdered ?? line.quantityOrdered)
                  : line.quantityReceived,
              unitCost: typeof updates.unitCost === 'number' ? normalizeMoney(updates.unitCost) : line.unitCost,
              estimatedShipDate: normalizeOptionalDateString(updates.estimatedShipDate) || updates.estimatedShipDate,
              estimatedDeliveryDate: normalizeOptionalDateString(updates.estimatedDeliveryDate) || updates.estimatedDeliveryDate,
              receivedDate: normalizeOptionalDateString(updates.receivedDate) || updates.receivedDate,
            }
          : line,
      )

      return {
        ...summarizePurchaseOrderTracking(po, lines),
        totalCost: getPurchaseOrderComputedTotal(lines),
      }
    }),
  })

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)
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
    const estimatedDeliveryDate = earliestDate(trackingRows.map(row => row.estimatedDeliveryDate))
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
      expectedDeliveryDate: estimatedDeliveryDate || receivedDate || po.expectedDeliveryDate || '',
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

  saveProjects(loadProjects().map(current => (current.id === project.id ? updatedProject : current)), updatedProject.id)

  return {
    project: updatedProject,
    importedCount: updatedCount,
    skippedCount: rowsByPo.size - updatedCount,
  }
}

function normalizeProject(project: Project): Project {
  const normalizedCustomer = normalizeCustomerFields(project)
  return {
    ...normalizedCustomer,
    customerId: normalizedCustomer.customerId ?? '',
    customerAddressId: normalizedCustomer.customerAddressId ?? '',
    projectType: project.projectType ?? 'Design & Install',
    checkbookStartingBalance: Number(project.checkbookStartingBalance || 0),
    materialBudget: Number(project.materialBudget || 0),
    assignedUserIds: Array.isArray(project.assignedUserIds) ? project.assignedUserIds : [],
    governmentProjectLead: project.governmentProjectLead ?? '',
    quotes: (project.quotes ?? []).map(quote => ({
      ...quote,
      quoteName: quote.quoteName ?? '',
      lines: (quote.lines ?? []).map(line => normalizeQuoteLineForSave(line)),
    })),
    quoteLines: (project.quoteLines ?? []).map(line => normalizeQuoteLineForSave(line)),
    purchaseOrders: (project.purchaseOrders ?? []).map(po => ({
      ...po,
      terms: po.terms ?? defaultPurchaseOrderTerms(po.vendor),
    })),
    inventory: project.inventory ?? [],
    kitStatus: project.kitStatus ?? 'Quoted',
    shipmentStatus: project.shipmentStatus ?? 'Quoted',
  }
}

function linkProjectCustomer(project: Project): Project {
  const customer = findCustomerById(project.customerId)
  const selectedAddress = findAddressById(project.customerAddressId)
  if (customer) {
    const address = selectedAddress ?? upsertAddressForProject(customer.id, project, 'Project Site')
    rememberCustomerUse(customer.id, address.id)
    return {
      ...project,
      customerId: customer.id,
      customerAddressId: address.id,
      customerSnapshot: snapshotFromCustomerAddress(customer, address, project),
    }
  }

  const created = createCustomerFromProject(project, 'Main Office')
  rememberCustomerUse(created.customer.id, created.address.id)
  return {
    ...project,
    customerId: created.customer.id,
    customerAddressId: created.address.id,
    customerSnapshot: snapshotFromCustomerAddress(created.customer, created.address, project),
  }
}

function saveProjects(projects: Project[], changedProjectId?: string) {
  const now = new Date().toISOString()
  const changedIds = changedProjectId ? [changedProjectId] : []
  const normalizedProjects = projects.map(project => {
    const normalized = normalizeProject(project)
    if (project.id !== changedProjectId) return normalized
    return {
      ...normalized,
      createdAt: normalized.createdAt || now,
      updatedAt: now,
    }
  })

  saveLocalAndRemoteCollection(STORAGE_KEY, REMOTE_TYPE, REMOTE_KEY, normalizedProjects, 'cronos:projects-changed', {
    mergeById: changedIds.length > 0,
    changedIds,
    mergeItem: mergeProjectPreservingNestedRecords,
  })
}

function mergeProjectsPreservingNestedRecords(remoteProjects: Project[], localProjects: Project[]) {
  const localById = new Map(localProjects.map(project => [project.id, normalizeProject(project)]))
  const seen = new Set<string>()
  const merged = remoteProjects.map(remoteProject => {
    seen.add(remoteProject.id)
    const localProject = localById.get(remoteProject.id)
    return localProject ? mergeProjectPreservingNestedRecords(localProject, remoteProject) : normalizeProject(remoteProject)
  })

  localProjects.forEach(localProject => {
    if (!seen.has(localProject.id)) {
      merged.push(normalizeProject(localProject))
    }
  })

  return merged
}

function mergeProjectPreservingNestedRecords(remoteItem: unknown, localItem: unknown) {
  const remoteProject = normalizeProject(remoteItem as Project)
  const localProject = normalizeProject(localItem as Project)
  const quotes = mergeNestedById(remoteProject.quotes, localProject.quotes)
  const quoteLines = mergeNestedById(
    mergeNestedById(remoteProject.quoteLines, localProject.quoteLines),
    quotes.flatMap(quote => quote.lines),
  )

  return normalizeProject({
    ...remoteProject,
    ...localProject,
    createdAt: localProject.createdAt || remoteProject.createdAt,
    updatedAt: mostRecentDate(localProject.updatedAt, remoteProject.updatedAt),
    quotes,
    quoteLines,
    purchaseOrders: mergeNestedById(remoteProject.purchaseOrders, localProject.purchaseOrders),
    inventory: mergeNestedById(remoteProject.inventory, localProject.inventory),
  })
}

function mergeNestedById<T extends { id: string }>(remoteItems: T[] = [], localItems: T[] = []) {
  const merged = new Map<string, T>()
  remoteItems.forEach(item => merged.set(item.id, item))
  localItems.forEach(item => merged.set(item.id, item))
  return Array.from(merged.values())
}

function mostRecentDate(a?: string, b?: string) {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

type QuotePoSyncResult = {
  project: Project
  relatedPurchaseOrdersFound: number
  linesUpdated: number
  linesCreated: number
  linesRemoved: number
  totalsRecalculated: number
  touchedPurchaseOrders: PurchaseOrder[]
}

function normalizeQuoteLineForSave(
  line: Omit<QuoteLine, 'id' | 'approved'> & Partial<Pick<QuoteLine, 'id' | 'approved'>>,
): QuoteLine {
  const unitCost = normalizeMoney(numberFromUnknown(line.unitCost))
  const quantity = Math.max(0, numberFromUnknown(line.quantity))
  const rawMarkupPercent = numberFromUnknown(line.markupPercent)
  const marginPercent = line.marginPercent === undefined ? undefined : numberFromUnknown(line.marginPercent)
  const markupPercent = line.pricingMode === 'margin' && marginPercent !== undefined
    ? marginPercentToMarkupPercent(marginPercent)
    : rawMarkupPercent

  return {
    ...line,
    id: line.id ?? crypto.randomUUID(),
    clin: String(line.clin ?? '').trim(),
    partNumber: String(line.partNumber ?? '').trim(),
    manufacturer: String(line.manufacturer ?? '').trim(),
    description: String(line.description ?? '').trim(),
    quantity,
    unitCost,
    pricingMode: 'markup',
    markupPercent,
    marginPercent: undefined,
    vendor: String(line.vendor ?? '').trim(),
    quoteNumber: String(line.quoteNumber ?? '').trim(),
    leadTime: String(line.leadTime ?? '').trim(),
    approved: line.approved ?? false,
  }
}

function syncPurchaseOrdersForQuote(project: Project, quote: CustomerQuote): QuotePoSyncResult {
  const relatedPurchaseOrders = project.purchaseOrders.filter(po => po.quoteId === quote.id)
  if (!relatedPurchaseOrders.length && quote.status !== 'Customer Approved') {
    return emptyQuotePoSyncResult(project, relatedPurchaseOrders.length)
  }

  const approvedLines = quote.lines.filter(line => line.approved)
  const groupedLines = groupQuoteLinesByVendor(approvedLines)
  const groupedVendorKeys = new Set(Object.keys(groupedLines).map(normalizeVendorKey))
  const existingByVendor = new Map(
    relatedPurchaseOrders.map(po => [normalizeVendorKey(po.vendor), po]),
  )
  const nextPurchaseOrders: PurchaseOrder[] = []
  const touchedPurchaseOrders: PurchaseOrder[] = []
  let linesUpdated = 0
  let linesCreated = 0
  let linesRemoved = 0
  let totalsRecalculated = 0
  let nextSequenceProject = project

  const unrelatedPurchaseOrders = project.purchaseOrders.filter(po => po.quoteId !== quote.id)
  nextPurchaseOrders.push(...unrelatedPurchaseOrders)

  Object.entries(groupedLines).forEach(([vendor, vendorLines]) => {
    const existingPo = existingByVendor.get(normalizeVendorKey(vendor))
    const basePo = existingPo ?? {
      ...generateVendorPurchaseOrders(vendorLines, project.projectNumber, nextPoSequence(nextSequenceProject))[0],
      quoteId: quote.id,
    }

    if (!existingPo) {
      nextSequenceProject = {
        ...nextSequenceProject,
        purchaseOrders: [...nextSequenceProject.purchaseOrders, basePo],
      }
      linesCreated += vendorLines.length
    }

    const syncedLines = vendorLines.map(line => {
      const existingLine = findMatchingPurchaseOrderLine(existingPo?.lines ?? [], line)
      if (existingLine) linesUpdated += 1
      if (!existingLine && existingPo) linesCreated += 1
      return syncPurchaseOrderLineFromQuoteLine(existingLine, line)
    })

    if (existingPo) {
      linesRemoved += existingPo.lines.filter(line => !vendorLines.some(quoteLine => isPurchaseOrderLineMatch(line, quoteLine))).length
    }

    const syncedPo: PurchaseOrder = {
      ...basePo,
      quoteId: quote.id,
      vendor,
      terms: basePo.terms ?? defaultPurchaseOrderTerms(vendor),
      lines: syncedLines,
      totalCost: getPurchaseOrderComputedTotal(syncedLines),
    }
    totalsRecalculated += 1
    touchedPurchaseOrders.push(syncedPo)
    nextPurchaseOrders.push(syncedPo)
  })

  relatedPurchaseOrders.forEach(po => {
    if (!groupedVendorKeys.has(normalizeVendorKey(po.vendor))) {
      linesRemoved += po.lines.length
      totalsRecalculated += 1
    }
  })

  const updatedProject = normalizeProject({
    ...project,
    purchaseOrders: nextPurchaseOrders,
  })

  return {
    project: updatedProject,
    relatedPurchaseOrdersFound: relatedPurchaseOrders.length,
    linesUpdated,
    linesCreated,
    linesRemoved,
    totalsRecalculated,
    touchedPurchaseOrders,
  }
}

function emptyQuotePoSyncResult(project: Project, relatedPurchaseOrdersFound: number): QuotePoSyncResult {
  return {
    project,
    relatedPurchaseOrdersFound,
    linesUpdated: 0,
    linesCreated: 0,
    linesRemoved: 0,
    totalsRecalculated: 0,
    touchedPurchaseOrders: [],
  }
}

function syncPurchaseOrderLineFromQuoteLine(existingLine: PurchaseOrderLine | undefined, quoteLine: QuoteLine): PurchaseOrderLine {
  return {
    id: existingLine?.id ?? `po-${quoteLine.id}`,
    itemNumber: existingLine?.itemNumber,
    clin: quoteLine.clin,
    partNumber: quoteLine.partNumber,
    manufacturer: quoteLine.manufacturer,
    description: quoteLine.description,
    quantityOrdered: Math.max(0, numberFromUnknown(quoteLine.quantity)),
    quantityReceived: existingLine?.quantityReceived ?? 0,
    unitCost: normalizeMoney(numberFromUnknown(quoteLine.unitCost)),
    status: existingLine?.status ?? 'Ordered',
    vendorOrderNumber: existingLine?.vendorOrderNumber ?? '',
    estimatedShipDate: existingLine?.estimatedShipDate ?? '',
    estimatedDeliveryDate: existingLine?.estimatedDeliveryDate ?? '',
    receivedDate: existingLine?.receivedDate ?? '',
    carrier: existingLine?.carrier ?? '',
    trackingNumber: existingLine?.trackingNumber ?? '',
    trackingUrl: existingLine?.trackingUrl ?? '',
    notes: existingLine?.notes ?? '',
  }
}

function defaultPurchaseOrderTerms(vendor: string) {
  const vendorRecord = loadVendorDirectory().find(record => normalizeVendorKey(record.vendor) === normalizeVendorKey(vendor))
  const vendorTerms = vendorRecord?.notes.match(/\b(?:net\s*\d+|due\s+on\s+receipt|cod|prepaid)\b/i)?.[0]
  return vendorTerms ? vendorTerms.toUpperCase().replace(/\s+/g, ' ') : 'NET30'
}

function findMatchingPurchaseOrderLine(lines: PurchaseOrderLine[], quoteLine: QuoteLine) {
  return (
    lines.find(line => line.id === `po-${quoteLine.id}`) ??
    lines.find(line => stripPoLineId(line.id) === quoteLine.id) ??
    lines.find(line => normalizeComparable(line.partNumber) && normalizeComparable(line.partNumber) === normalizeComparable(quoteLine.partNumber)) ??
    lines.find(
      line =>
        normalizeComparable(line.manufacturer ?? '') === normalizeComparable(quoteLine.manufacturer) &&
        normalizeComparable(line.description) === normalizeComparable(quoteLine.description),
    )
  )
}

function isPurchaseOrderLineMatch(line: PurchaseOrderLine, quoteLine: QuoteLine) {
  return Boolean(findMatchingPurchaseOrderLine([line], quoteLine))
}

function stripPoLineId(value: string) {
  return value.replace(/^po-/, '')
}

function normalizeVendorKey(value: string) {
  return normalizeComparable(value || 'Unassigned')
}

function normalizeComparable(value: string) {
  return String(value ?? '').trim().toLowerCase()
}

function numberFromUnknown(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,]/g, '').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function logQuotePoSync(quote: CustomerQuote, result: QuotePoSyncResult) {
  if (typeof console === 'undefined') return
  console.info('[Atlas PO Sync] Quote updated', quote.quoteNumber)
  console.info('[Atlas PO Sync] Related POs found', result.relatedPurchaseOrdersFound)
  console.info('[Atlas PO Sync] PO lines updated', result.linesUpdated)
  console.info('[Atlas PO Sync] PO lines created', result.linesCreated)
  console.info('[Atlas PO Sync] PO lines removed', result.linesRemoved)
  console.info('[Atlas PO Sync] PO totals recalculated', result.totalsRecalculated)
  console.info('[Atlas PO Sync] PO PDFs regenerated', result.touchedPurchaseOrders.map(po => po.poNumber))
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

function getPurchaseOrderComputedTotal(lines: PurchaseOrderLine[]) {
  return normalizeMoney(lines.reduce((total, line) => total + (line.unitCost || 0) * (line.quantityOrdered || 0), 0))
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

function summarizePurchaseOrderTracking(po: PurchaseOrder, lines: PurchaseOrderLine[]): PurchaseOrder {
  const carriers = uniqueValues(lines.map(line => line.carrier))
  const trackingNumbers = uniqueValues(lines.map(line => line.trackingNumber))
  const estimatedShipDate = earliestDate(lines.map(line => line.estimatedShipDate))
  const estimatedDeliveryDate = earliestDate(lines.map(line => line.estimatedDeliveryDate))
  const receivedDate = latestDate(lines.map(line => line.receivedDate))

  return {
    ...po,
    carrier: carriers.join(', '),
    trackingNumber: trackingNumbers.join(', '),
    trackingUrl: trackingNumbers.length === 1 ? buildTrackingUrl(carriers[0], trackingNumbers[0]) : '',
    estimatedShipDate,
    expectedDeliveryDate: estimatedDeliveryDate || receivedDate,
    status: getTrackingAwarePoStatus(lines, po.status),
    lines,
  }
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
    estimatedShipDate:
      line.estimatedShipDate === undefined ? normalizeOptionalDateString(po?.estimatedShipDate) : normalizeOptionalDateString(line.estimatedShipDate),
    estimatedDeliveryDate:
      line.estimatedDeliveryDate === undefined ? normalizeOptionalDateString(po?.expectedDeliveryDate) : normalizeOptionalDateString(line.estimatedDeliveryDate),
    receivedDate: normalizeOptionalDateString(line.receivedDate),
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
      estimatedDeliveryDate: normalizeOptionalDateString(row.estimatedDeliveryDate) || match?.estimatedDeliveryDate || '',
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
