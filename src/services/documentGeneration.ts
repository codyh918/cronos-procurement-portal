import type { CustomerQuote, Project, ProjectPurchaseOrder, PurchaseOrder, PurchaseOrderLine, QuoteLine } from '../types'
import { calculateLineTotals, calculateQuoteSummary } from './calculations'

export const DOCUMENT_PLACEHOLDER = 'N/A'

export type AtlasDocumentKind =
  | 'Customer Quote PDF'
  | 'Purchase Order PDF'
  | 'Customer Tracking Update PDF'
  | 'Checkbook Financial Report PDF'
  | 'Customer Consolidated Tracking PDF'
  | 'Project Tracking Workbook'
  | 'Checkbook Financial Workbook'
  | 'Customer Quote Workbook'
  | 'Vendor RFQ Workbook'
  | 'Data Export CSV'

type AuditSeverity = 'warning' | 'error'

export type AtlasDocumentAuditIssue = {
  severity: AuditSeverity
  field: string
  message: string
}

export type AtlasDocumentAudit = {
  documentName: string
  kind: AtlasDocumentKind
  startedAt: string
  issues: AtlasDocumentAuditIssue[]
}

export function createDocumentAudit(kind: AtlasDocumentKind, documentName: string): AtlasDocumentAudit {
  const audit = {
    documentName: documentValue(documentName, kind),
    kind,
    startedAt: new Date().toISOString(),
    issues: [],
  }
  logDocumentEvent(audit, 'started')
  return audit
}

export function finishDocumentAudit(audit: AtlasDocumentAudit) {
  const missing = audit.issues.filter(issue => issue.severity === 'error').length
  const warnings = audit.issues.filter(issue => issue.severity === 'warning').length
  logDocumentEvent(audit, 'finished', { errors: missing, warnings })
}

export function recordDocumentIssue(
  audit: AtlasDocumentAudit,
  severity: AuditSeverity,
  field: string,
  message: string,
) {
  audit.issues.push({ severity, field, message })
}

export function documentValue(value: unknown, label = 'Field') {
  if (value === null || value === undefined) return DOCUMENT_PLACEHOLDER
  const text = String(value).trim()
  return text || DOCUMENT_PLACEHOLDER
}

export function optionalDocumentValue(value: unknown) {
  const prepared = documentValue(value)
  return prepared === DOCUMENT_PLACEHOLDER ? '' : prepared
}

export function numericDocumentValue(value: unknown, fallback = 0) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function validateProjectDocumentFields(audit: AtlasDocumentAudit, project?: Project) {
  if (!project) {
    recordDocumentIssue(audit, 'warning', 'Project', 'Project context was not supplied.')
    return
  }

  requireFields(audit, 'Project', {
    'Project Number': project.projectNumber,
    'Project Name': project.projectName,
    Customer: project.customer,
  })

  if (!project.deliveryAddress) {
    recordDocumentIssue(audit, 'warning', 'Shipping Address', 'Project shipping address is missing.')
  }
}

export function validateQuoteDocument(audit: AtlasDocumentAudit, quote: CustomerQuote, project?: Project) {
  requireFields(audit, 'Quote', {
    'Quote Number': quote.quoteNumber,
    'Project Number': quote.projectNumber || project?.projectNumber,
    'Project Name': quote.projectName || project?.projectName,
    Customer: quote.customer || project?.customer,
  })
  validateProjectDocumentFields(audit, project)
  validateQuoteLines(audit, quote.lines)

  const summary = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)
  if (!Number.isFinite(summary.customerTotal)) {
    recordDocumentIssue(audit, 'error', 'Quote Total', 'Quote total could not be calculated.')
  }
}

export function validatePurchaseOrderDocument(audit: AtlasDocumentAudit, po: PurchaseOrder | ProjectPurchaseOrder, project?: Project) {
  requireFields(audit, 'Purchase Order', {
    'PO Number': po.poNumber,
    Vendor: po.vendor,
    Terms: po.terms || 'NET30',
    Project: project?.projectNumber || ('projectNumber' in po ? po.projectNumber : ''),
  })
  validateProjectDocumentFields(audit, project)
  validatePurchaseOrderLines(audit, po.lines)
}

export function validateQuoteLines(audit: AtlasDocumentAudit, lines: QuoteLine[]) {
  if (!lines.length) {
    recordDocumentIssue(audit, 'error', 'Line Items', 'Document has no quote line items.')
    return
  }

  lines.forEach((line, index) => {
    const prefix = `Line ${index + 1}`
    requireFields(audit, prefix, {
      'Part Number': line.partNumber,
      Manufacturer: line.manufacturer,
      Description: line.description,
      Quantity: line.quantity,
    })
    if (numericDocumentValue(line.quantity) <= 0) {
      recordDocumentIssue(audit, 'warning', `${prefix} Quantity`, 'Quantity is zero or missing.')
    }
    if (!Number.isFinite(calculateLineTotals(line).extendedSellPrice)) {
      recordDocumentIssue(audit, 'error', `${prefix} Total`, 'Line total could not be calculated.')
    }
  })
}

export function validatePurchaseOrderLines(audit: AtlasDocumentAudit, lines: PurchaseOrderLine[]) {
  if (!lines.length) {
    recordDocumentIssue(audit, 'error', 'Line Items', 'Document has no purchase order line items.')
    return
  }

  lines.forEach((line, index) => {
    const prefix = `Line ${index + 1}`
    requireFields(audit, prefix, {
      'Part Number': line.partNumber,
      Description: line.description,
      Quantity: line.quantityOrdered,
    })
    if (numericDocumentValue(line.quantityOrdered) <= 0) {
      recordDocumentIssue(audit, 'warning', `${prefix} Quantity`, 'Quantity ordered is zero or missing.')
    }
  })
}

export function normalizeQuoteLineForDocument(line: QuoteLine): QuoteLine {
  return {
    ...line,
    partNumber: documentValue(line.partNumber, 'Part Number'),
    manufacturer: documentValue(line.manufacturer, 'Manufacturer'),
    description: documentValue(line.description, 'Description'),
    vendor: optionalDocumentValue(line.vendor),
    quoteNumber: optionalDocumentValue(line.quoteNumber),
    leadTime: optionalDocumentValue(line.leadTime) || 'TBD',
    quantity: numericDocumentValue(line.quantity),
    unitCost: numericDocumentValue(line.unitCost),
    markupPercent: numericDocumentValue(line.markupPercent),
  }
}

export function normalizePurchaseOrderLineForDocument(line: PurchaseOrderLine): PurchaseOrderLine {
  return {
    ...line,
    partNumber: documentValue(line.partNumber, 'Part Number'),
    manufacturer: optionalDocumentValue(line.manufacturer),
    description: documentValue(line.description, 'Description'),
    quantityOrdered: numericDocumentValue(line.quantityOrdered),
    quantityReceived: numericDocumentValue(line.quantityReceived),
    unitCost: numericDocumentValue(line.unitCost),
    status: line.status || 'Ordered',
  }
}

export function logDocumentException(audit: AtlasDocumentAudit, error: unknown) {
  recordDocumentIssue(audit, 'error', 'Rendering', error instanceof Error ? error.message : 'Unknown document rendering error.')
  console.error(`[Atlas Document] ${audit.kind} failed`, {
    documentName: audit.documentName,
    issues: audit.issues,
    error,
  })
}

function requireFields(audit: AtlasDocumentAudit, group: string, fields: Record<string, unknown>) {
  Object.entries(fields).forEach(([field, value]) => {
    if (documentValue(value) === DOCUMENT_PLACEHOLDER) {
      recordDocumentIssue(audit, 'error', `${group}: ${field}`, `${field} is missing.`)
    }
  })
}

function logDocumentEvent(audit: AtlasDocumentAudit, event: 'started' | 'finished', details: Record<string, unknown> = {}) {
  console.info(`[Atlas Document] ${audit.kind} ${event}`, {
    documentName: audit.documentName,
    startedAt: audit.startedAt,
    issues: audit.issues,
    ...details,
  })
}
