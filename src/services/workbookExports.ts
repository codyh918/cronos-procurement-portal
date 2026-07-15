import type { CustomerQuote, Project, PurchaseOrderLine, QuoteLine, Status } from '../types'
import { calculateLineTotals, calculateQuoteSummary } from './calculations'
import { getCheckbookSummary } from './checkbook'
import { getProjectDocumentContact } from './documentContacts'
import { formatCustomerAddressLines, structuredCustomerFromProject } from './customerFormatting'
import {
  createDocumentAudit,
  documentValue,
  finishDocumentAudit,
  normalizePurchaseOrderLineForDocument,
  normalizeQuoteLineForDocument,
  validateProjectDocumentFields,
  validatePurchaseOrderLines,
  validateQuoteDocument,
  validateQuoteLines,
} from './documentGeneration'
import { loadVendorDirectory } from './vendorDirectory'

const CRONOS_CAGE_CODE = '8NPB1'

type WorkbookCell =
  | string
  | number
  | {
      value?: string | number
      formula?: string
      style?: number
    }
type WorkbookSheet = {
  name: string
  rows: WorkbookCell[][]
  columnWidths?: number[]
  merges?: string[]
  freezePane?: string
  autoFilter?: string
  printTitleRows?: string
  landscape?: boolean
  image?: 'cronosLogo'
}

type TrackingWorkbookLine = PurchaseOrderLine & {
  poNumber: string
  poStatus: Status
  vendor: string
}

export async function exportProjectTrackingWorkbook(project: Project) {
  const audit = createDocumentAudit('Project Tracking Workbook', project.projectNumber)
  validateProjectDocumentFields(audit, project)
  const lines = getTrackingWorkbookLines(project)
  validatePurchaseOrderLines(audit, lines)
  const generatedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
  const isCheckbook = project.projectType === 'Checkbook'
  const sheets = project.projectType === 'Design & Install'
    ? [buildTrackingDetailSheet(project, lines, generatedDate)]
    : [
        buildTrackingDetailSheet(project, lines, generatedDate),
        buildTrackingSummarySheet(project, lines, generatedDate, isCheckbook),
      ]

  await downloadWorkbook(
    sheets,
    `Cronos-${sanitizeFileName(project.projectNumber)}-Tracking-Report.xlsx`,
  )
  finishDocumentAudit(audit)
}

export async function exportCheckbookFinancialWorkbook(project: Project) {
  const audit = createDocumentAudit('Checkbook Financial Workbook', project.projectNumber)
  validateProjectDocumentFields(audit, project)
  const summary = getCheckbookSummary(project)
  await downloadWorkbook(
    [
      {
        name: 'Financial Summary',
        rows: [
          ['Project', documentValue(project.projectNumber)],
          ['Customer', documentValue(project.customer)],
          ['Starting Balance', summary.startingBalance],
          ['Cost to Customer', summary.customerCost],
          ['Remaining Balance', summary.remainingBalance],
        ],
      },
      {
        name: 'PO Detail',
        rows: [
          ['PO #', 'Quote #', 'Vendor', 'Description', 'Requestor', 'Date Issued', 'Cost to Customer'],
          ...summary.lines.map(line => [
            documentValue(line.poNumber),
            documentValue(line.quoteNumber),
            documentValue(line.vendor),
            documentValue(line.description),
            documentValue(line.requestor),
            documentValue(line.dateIssued),
            line.customerCost,
          ]),
        ],
      },
    ],
    `Cronos-${sanitizeFileName(project.projectNumber)}-Checkbook-Tracking.xlsx`,
  )
  finishDocumentAudit(audit)
}

export async function exportCustomerQuoteWorkbook(quote: CustomerQuote, project?: Project) {
  const audit = createDocumentAudit('Customer Quote Workbook', quote.quoteNumber)
  validateQuoteDocument(audit, quote, project)
  const summary = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)
  const checkbookBudgetRows = buildCheckbookQuoteBudgetRows(project, summary.customerTotal)
  const poc = getProjectDocumentContact(project)
  const customer = structuredCustomerFromProject(project, quote.customer)
  const customerAddress = formatCustomerAddressLines(customer).join('\n')
  const startRow = 18
  const lineRows = quote.lines.map(normalizeQuoteLineForDocument).map((line, index) => {
    const rowNumber = startRow + index
    const totals = calculateLineTotals(line)
    return [
      { value: index + 1, style: 6 },
      { value: line.manufacturer, style: 6 },
      { value: line.quantity || 0, style: 6 },
      { value: line.partNumber, style: 6 },
      { value: line.description, style: 7 },
      { value: totals.sellPrice, style: 8 },
      { formula: `D${rowNumber}*G${rowNumber}`, value: totals.extendedSellPrice, style: 8 },
    ]
  })
  const totalRow = startRow + lineRows.length + 1

  await downloadWorkbook(
    [
      {
        name: sanitizeSheetName(quote.quoteNumber),
        image: 'cronosLogo',
        columnWidths: [1, 8, 16, 8, 18, 58, 15, 17],
        merges: ['B11:C11', 'D11:F11', 'G11:G11', 'H11:H11', 'B12:C12', 'D12:F12', 'G12:G12', 'H12:H12', 'B13:C13', 'D13:F13', 'G13:G13', 'H13:H13'],
        rows: [
          [],
          [],
          ['', '', '', '', { value: 'CRONOS LLC', style: 1 }],
          ['', '', '', '', { value: '4301 Evans to Locks Road', style: 2 }, '', { value: 'Quote Number:', style: 3 }, { value: quote.quoteNumber, style: 4 }],
          ['', '', '', '', { value: 'Evans, GA 30809', style: 2 }, '', { value: 'Quote Name:', style: 3 }, { value: quote.quoteName || '-', style: 4 }],
          ['', '', '', '', { value: `Cage Code: ${CRONOS_CAGE_CODE}`, style: 2 }, '', { value: 'Date:', style: 3 }, { value: documentValue(formatDateForWorkbook(quote.createdAt)), style: 4 }],
          ['', '', '', '', { value: 'cronosllc.com', style: 2 }, '', { value: 'Expires:', style: 3 }, { value: getQuoteExpirationDateForWorkbook(quote), style: 4 }],
          [],
          ['', '', '', '', { value: `Project: ${documentValue(quote.projectNumber)} - ${documentValue(quote.projectName)}`, style: 5 }],
          [],
          ['', { value: 'Customer:', style: 3 }, '', { value: documentValue(customer.companyName), style: 4 }, '', '', { value: 'Cronos POC:', style: 3 }, { value: documentValue(poc.name), style: 4 }],
          ['', { value: 'Attention:', style: 3 }, '', { value: documentValue(customer.attention), style: 4 }, '', '', { value: 'Email:', style: 3 }, { value: documentValue(poc.email), style: 4 }],
          ['', { value: 'Address:', style: 3 }, '', { value: documentValue(customerAddress), style: 22 }, '', '', { value: 'Direct Phone:', style: 3 }, { value: documentValue(poc.phone), style: 4 }],
          [],
          [],
          ['', { value: 'Line', style: 9 }, { value: 'Manufacturer', style: 9 }, { value: 'QTY', style: 9 }, { value: 'Part #', style: 9 }, { value: 'Description', style: 9 }, { value: 'Unit Cost', style: 9 }, { value: 'Extended Cost', style: 9 }],
          [],
          ...lineRows.map(row => ['', ...row]),
          [],
          ['', '', '', '', '', { value: 'Line Item Total', style: 10 }, '', { formula: `SUM(H${startRow}:H${startRow + Math.max(lineRows.length - 1, 0)})`, value: summary.totalSellPrice, style: 11 }],
          ['', '', '', '', '', { value: 'Contract Fee', style: 10 }, '', { value: summary.contractFee, style: 11 }],
          ['', '', '', '', '', { value: 'Shipping', style: 10 }, '', { value: summary.shippingCost, style: 11 }],
          ['', '', '', '', '', { value: 'Quote Total', style: 12 }, '', { formula: `H${totalRow}+H${totalRow + 1}+H${totalRow + 2}`, value: summary.customerTotal, style: 13 }],
          ...checkbookBudgetRows,
        ],
      },
    ],
    `Cronos-${sanitizeFileName(quote.quoteNumber)}-Quote.xlsx`,
  )
  finishDocumentAudit(audit)
}

function buildCheckbookQuoteBudgetRows(project: Project | undefined, materialQuoted: number): WorkbookCell[][] {
  if (project?.projectType !== 'Checkbook') return []

  const materialBudget = project.checkbookStartingBalance || 0
  const remainingBalance = materialBudget - materialQuoted

  return [
    [],
    ['', '', '', '', '', { value: 'Total Material Budget', style: 10 }, '', { value: materialBudget, style: 11 }],
    ['', '', '', '', '', { value: 'Total Material Quoted', style: 10 }, '', { value: materialQuoted, style: 11 }],
    ['', '', '', '', '', { value: 'Balance Remaining', style: 12 }, '', { value: remainingBalance, style: 13 }],
  ]
}

export async function exportVendorRfqPackage(project: Project, lines: QuoteLine[]) {
  const audit = createDocumentAudit('Vendor RFQ Workbook', project.projectNumber)
  validateProjectDocumentFields(audit, project)
  validateQuoteLines(audit, lines)
  const grouped = groupQuoteLinesByVendor(lines)
  const vendors = Object.entries(grouped)

  for (const [vendor, vendorLines] of vendors) {
    await downloadWorkbook(
      [
        buildVendorRfqSheet(project, vendor, vendorLines),
        buildVendorRfqSummarySheet(project, vendor, vendorLines),
        buildVendorRfqInstructionsSheet(),
      ],
      `Cronos-${sanitizeFileName(project.projectNumber)}-${sanitizeFileName(vendor)}-RFQ.xlsx`,
    )
  }

  finishDocumentAudit(audit)
  return vendors.length
}

async function downloadWorkbook(sheets: WorkbookSheet[], fileName: string) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const logoBytes = sheets.some(sheet => sheet.image === 'cronosLogo') ? await fetchCronosLogo() : null

  zip.file('[Content_Types].xml', contentTypesXml(sheets, Boolean(logoBytes)))
  zip.file('_rels/.rels', rootRelsXml())
  zip.file('docProps/app.xml', appXml())
  zip.file('docProps/core.xml', coreXml())
  zip.file('xl/workbook.xml', workbookXml(sheets))
  zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml(sheets))
  zip.file('xl/styles.xml', stylesXml())
  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet, index, Boolean(logoBytes)))
    if (index === 0 && logoBytes) {
      zip.file('xl/worksheets/_rels/sheet1.xml.rels', sheetDrawingRelsXml())
      zip.file('xl/drawings/drawing1.xml', drawingXml())
      zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRelsXml())
      zip.file('xl/media/cronos-logo.jpg', logoBytes)
    }
  })

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function groupQuoteLinesByVendor(lines: QuoteLine[]) {
  return lines.reduce<Record<string, QuoteLine[]>>((groups, line) => {
    const vendor = line.vendor || 'Unassigned Vendor'
    groups[vendor] = groups[vendor] ?? []
    groups[vendor].push(line)
    return groups
  }, {})
}

function buildVendorRfqSheet(project: Project, vendor: string, lines: QuoteLine[]): WorkbookSheet {
  const poc = getProjectDocumentContact(project)
  const customer = structuredCustomerFromProject(project)
  const vendorRecord = findVendorRecord(vendor)
  const vendorContact = [vendorRecord?.primaryContact, vendorRecord?.email, vendorRecord?.phone].filter(Boolean).join(' | ')
  const rfqNumber = `${project.projectNumber}-${sanitizeFileName(vendor)}-RFQ`
  const dueDate = vendorRfqDueDate()
  const headerRow = 15
  const firstDataRow = headerRow + 1
  const rows: WorkbookCell[][] = [
    [],
    [],
    ['', '', '', { value: 'CRONOS LLC', style: 14 }],
    ['', '', '', { value: 'Vendor Request for Quote', style: 15 }],
    [],
    ['', { value: 'RFQ Number', style: 3 }, { value: documentValue(rfqNumber), style: 4 }, '', { value: 'Vendor Name', style: 3 }, { value: documentValue(vendor), style: 4 }],
    ['', { value: 'Project Number', style: 3 }, { value: documentValue(project.projectNumber), style: 4 }, '', { value: 'Vendor Contact', style: 3 }, { value: documentValue(vendorContact), style: 4 }],
    ['', { value: 'Project Name', style: 3 }, { value: documentValue(project.projectName), style: 4 }, '', { value: 'Requested Date', style: 3 }, { value: formatDateForWorkbook(new Date().toISOString()), style: 4 }],
    ['', { value: 'Customer', style: 3 }, { value: documentValue(customer.companyName), style: 4 }, '', { value: 'Due Date', style: 3 }, { value: dueDate, style: 4 }],
    ['', { value: 'Requested By', style: 3 }, { value: documentValue(poc.name), style: 4 }, '', { value: 'Email', style: 3 }, { value: documentValue(poc.email), style: 4 }],
    ['', { value: 'Phone', style: 3 }, { value: documentValue(poc.phone), style: 4 }, '', { value: 'Cage Code', style: 3 }, { value: documentValue(poc.cageCode), style: 4 }],
    [],
    [{ value: 'Please complete the vendor response fields and return this workbook to Cronos by the due date.', style: 22 }],
    [],
    [
      'Line',
      'Manufacturer',
      'Part Number',
      'Description',
      'Qty',
      'Requested Unit Cost',
      'Vendor Part Number',
      'Unit Price',
      'Extended Price',
      'Lead Time',
      'TAA Compliant',
      'Warranty',
      'Substitute/Alternate Offered',
      'Vendor Notes',
    ].map(value => ({ value, style: 18 })),
    ...lines.map(normalizeQuoteLineForDocument).map((line, index) => {
      const rowNumber = firstDataRow + index
      return [
        { value: index + 1, style: 19 },
        { value: line.manufacturer, style: 19 },
        { value: line.partNumber, style: 19 },
        { value: line.description, style: 22 },
        { value: line.quantity, style: 19 },
        { value: line.unitCost, style: 20 },
        { value: '', style: 19 },
        { value: '', style: 20 },
        { formula: `E${rowNumber}*H${rowNumber}`, value: 0, style: 20 },
        { value: line.leadTime || 'TBD', style: 19 },
        { value: '', style: 19 },
        { value: '', style: 19 },
        { value: '', style: 19 },
        { value: '', style: 22 },
      ]
    }),
  ]

  const lastRow = Math.max(firstDataRow, firstDataRow + lines.length - 1)
  return {
    name: 'RFQ',
    image: 'cronosLogo',
    rows,
    columnWidths: [8, 18, 20, 52, 10, 18, 22, 16, 18, 16, 16, 18, 24, 38],
    merges: ['D3:F3', 'D4:F4', 'A13:N13'],
    freezePane: `A${firstDataRow}`,
    autoFilter: `A${headerRow}:N${lastRow}`,
  }
}

function buildVendorRfqSummarySheet(project: Project, vendor: string, lines: QuoteLine[]): WorkbookSheet {
  const dueDate = vendorRfqDueDate()
  return {
    name: 'Summary',
    rows: [
      [{ value: 'RFQ Summary', style: 14 }],
      [],
      ['Project Number', project.projectNumber],
      ['Project Name', project.projectName],
      ['Vendor', vendor],
      ['Vendor Response Due Date', dueDate],
      ['Total Items', lines.length],
      ['Total Quoted Amount', { formula: `SUM('RFQ'!I16:I${15 + Math.max(lines.length, 1)})`, value: 0, style: 20 }],
    ],
    columnWidths: [28, 42],
  }
}

function buildVendorRfqInstructionsSheet(): WorkbookSheet {
  return {
    name: 'Instructions',
    rows: [
      [{ value: 'Vendor Instructions', style: 14 }],
      [],
      [{ value: 'Complete the response fields on the RFQ tab: Vendor Part Number, Unit Price, Lead Time, TAA Compliant, Warranty, Substitute/Alternate Offered, and Vendor Notes.', style: 22 }],
      [{ value: 'Extended Price is formula-driven from Quantity and Unit Price. Please do not remove formulas unless you are returning a flat priced response.', style: 22 }],
      [{ value: 'Return this workbook to the Cronos contact listed on the RFQ tab by the response due date.', style: 22 }],
    ],
    columnWidths: [110],
  }
}

function buildTrackingSummarySheet(project: Project, lines: TrackingWorkbookLine[], generatedDate: string, includeCosts: boolean): WorkbookSheet {
  const projectCost = includeCosts ? getCheckbookSummary(project).customerCost : 0
  const headers = includeCosts
    ? ['Project Tab', 'Line Items', 'Received', 'Tracking Provided', 'Scheduled', 'Pending Update', 'Project Cost']
    : ['Project Tab', 'Line Items', 'Received', 'Tracking Provided', 'Scheduled', 'Pending Update']
  const summaryRow: WorkbookCell[] = [
    'Material Tracking',
    lines.length,
    countReceived(lines),
    countTracking(lines),
    countScheduled(lines),
    countPending(lines),
  ]
  if (includeCosts) summaryRow.push({ value: projectCost, style: 20 })

  const rows: WorkbookCell[][] = [
    [{ value: `Tracking Report ${project.projectNumber}`, style: 14 }],
    [{ value: `Customer procurement update | Generated ${generatedDate}`, style: 15 }],
    [],
    [
      { value: lines.length, style: 16 },
      '',
      '',
      { value: countReceived(lines), style: 16 },
      '',
      '',
      { value: countTracking(lines), style: 16 },
      '',
      '',
      { value: countScheduled(lines), style: 16 },
      '',
      '',
      { value: countPending(lines), style: 16 },
    ],
    [],
    [
      { value: 'Line Items', style: 17 },
      '',
      '',
      { value: 'Received', style: 17 },
      '',
      '',
      { value: 'Tracking Provided', style: 17 },
      '',
      '',
      { value: 'Scheduled', style: 17 },
      '',
      '',
      { value: 'Pending Update', style: 17 },
    ],
    [],
    [],
    headers.map(value => ({ value, style: 18 })),
    summaryRow.map(cell => (typeof cell === 'object' ? cell : { value: cell, style: 19 })),
  ]

  if (includeCosts) {
    rows.push([], ['', '', '', '', '', { value: 'Total Cost', style: 21 }, { formula: 'SUM(G10:G10)', value: projectCost, style: 20 }])
  }

  return {
    name: 'Summary',
    rows,
    columnWidths: [34, 14, 14, 20, 14, 18, 16, 14, 14, 18, 14, 14, 18, 14, 14],
    merges: ['A1:O1', 'A2:O2', 'A4:B5', 'D4:E5', 'G4:H5', 'J4:K5', 'M4:N5', 'A6:B6', 'D6:E6', 'G6:H6', 'J6:K6', 'M6:N6'],
    freezePane: 'A9',
  }
}

function buildTrackingDetailSheet(project: Project, lines: TrackingWorkbookLine[], generatedDate: string): WorkbookSheet {
  const poc = getProjectDocumentContact(project)
  const customer = structuredCustomerFromProject(project)
  const headers = ['Line Item', 'PO Number', 'Vendor', 'Part Number', 'Description', 'Quantity', 'Carrier', 'Tracking Number', 'Status', 'Ship Date', 'Estimated Delivery', 'Actual Delivery', 'Notes']
  const tableHeaderRow = 11
  const rowsByPo = groupTrackingLinesByPo(lines)
  let lineItemNumber = 1
  const dataRows: WorkbookCell[][] = rowsByPo.flatMap(group =>
    group.lines.map(line => {
      const trackingStatus = getTrackingWorkbookStatus(line)
      return [
        { value: lineItemNumber++, style: 19 },
        { value: group.poNumber, style: 19 },
        { value: group.vendor, style: 19 },
        { value: line.partNumber, style: 19 },
        { value: conciseTrackingDescription(line.description), style: 22 },
        { value: line.quantityOrdered, style: 19 },
        { value: line.carrier || 'Pending', style: 19 },
        { value: line.trackingNumber || 'Pending', style: 19 },
        { value: trackingStatus, style: trackingStatusStyle(trackingStatus) },
        { value: formatDateForWorkbook(line.estimatedShipDate), style: 19 },
        { value: formatDateForWorkbook(line.estimatedDeliveryDate), style: 19 },
        { value: formatDateForWorkbook(line.receivedDate), style: 19 },
        { value: line.notes ?? '', style: 22 },
      ]
    }),
  )

  const totalPurchaseOrders = rowsByPo.length
  const delivered = lines.filter(line => getTrackingWorkbookStatus(line) === 'Delivered').length
  const partiallyShipped = lines.filter(line => getTrackingWorkbookStatus(line) === 'Partially Shipped').length
  const inTransit = lines.filter(line => getTrackingWorkbookStatus(line) === 'In Transit').length
  const delayed = lines.filter(line => getTrackingWorkbookStatus(line) === 'Delayed').length
  const pending = lines.filter(line => getTrackingWorkbookStatus(line) === 'Pending').length
  const rows: WorkbookCell[][] = [
    ['', '', '', { value: 'Material Tracking Report', style: 14 }],
    ['', '', '', { value: `Generated ${generatedDate}`, style: 15 }],
    [],
    ['', { value: 'Project Number', style: 1 }, { value: documentValue(project.projectNumber), style: 4 }, '', { value: 'Project Manager', style: 1 }, { value: documentValue(project.projectManager), style: 4 }],
    ['', { value: 'Project Name', style: 1 }, { value: documentValue(project.projectName), style: 4 }, '', { value: 'Generated By', style: 1 }, { value: documentValue(poc.name), style: 4 }],
    ['', { value: 'Customer', style: 1 }, { value: documentValue(customer.companyName), style: 4 }, '', { value: 'Date Generated', style: 1 }, { value: generatedDate, style: 4 }],
    [],
    [
      { value: totalPurchaseOrders, style: 16 },
      { value: lines.length, style: 16 },
      { value: delivered, style: 16 },
      { value: partiallyShipped, style: 16 },
      { value: inTransit, style: 16 },
      { value: pending, style: 16 },
      { value: delayed, style: 16 },
    ],
    [
      { value: 'Total POs', style: 17 },
      { value: 'Line Items', style: 17 },
      { value: 'Delivered', style: 17 },
      { value: 'Partially Shipped', style: 17 },
      { value: 'In Transit', style: 17 },
      { value: 'Pending', style: 17 },
      { value: 'Delayed', style: 17 },
    ],
    [],
    headers.map(value => ({ value, style: 18 })),
    ...dataRows,
  ]

  return {
    name: 'Material Tracking',
    rows,
    columnWidths: [12, 22, 24, 24, 42, 10, 18, 30, 20, 14, 18, 16, 38],
    merges: ['D1:H1', 'D2:H2', 'C4:D4', 'F4:H4', 'C5:D5', 'F5:H5', 'C6:D6', 'F6:H6'],
    freezePane: 'A12',
    autoFilter: `A${tableHeaderRow}:M${Math.max(tableHeaderRow, rows.length)}`,
    printTitleRows: '1:11',
    landscape: true,
  }
}

function getTrackingWorkbookLines(project: Project): TrackingWorkbookLine[] {
  return project.purchaseOrders.flatMap(po =>
    po.lines.map(line => ({
      ...normalizePurchaseOrderLineForDocument(line),
      poNumber: po.poNumber,
      poStatus: po.status,
      vendor: po.vendor,
      vendorOrderNumber: line.vendorOrderNumber,
      carrier: line.carrier ?? '',
      trackingNumber: line.trackingNumber ?? '',
      estimatedShipDate: line.estimatedShipDate ?? '',
      estimatedDeliveryDate: line.estimatedDeliveryDate ?? '',
      receivedDate: line.receivedDate ?? '',
      notes: line.notes ?? '',
    })),
  )
}

function groupTrackingLinesByPo(lines: TrackingWorkbookLine[]) {
  const groups = new Map<string, { poNumber: string; vendor: string; poStatus: Status; lines: TrackingWorkbookLine[] }>()
  lines.forEach(line => {
    const key = `${line.poNumber}||${line.vendor}`
    const current = groups.get(key) ?? { poNumber: line.poNumber, vendor: line.vendor, poStatus: line.poStatus, lines: [] }
    current.lines.push(line)
    groups.set(key, current)
  })
  return Array.from(groups.values())
}

function conciseTrackingDescription(value: string | undefined) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= 140) return normalized
  return `${normalized.slice(0, 137).trim()}...`
}

function trackingStatusStyle(status: string) {
  if (status === 'Delivered') return 24
  if (status === 'In Transit') return 25
  if (status === 'Partially Shipped') return 26
  if (status === 'Processing') return 27
  if (status === 'Delayed') return 28
  return 29
}

function worksheetXml(sheet: WorkbookSheet, sheetIndex: number, hasLogo: boolean) {
  const columnXml = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const sheetViewsXml = sheet.freezePane ? sheetViewsXmlForFreezePane(sheet.freezePane) : ''
  const mergeXml = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : ''
  const autoFilterXml = sheet.autoFilter ? `<autoFilter ref="${escapeXml(sheet.autoFilter)}"/>` : ''
  const drawingXml = sheetIndex === 0 && sheet.image === 'cronosLogo' && hasLogo ? '<drawing r:id="rId1"/>' : ''
  const pageSetupXml = sheet.landscape
    ? '<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.25" footer="0.25"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddHeader>&amp;CMaterial Tracking Report</oddHeader><oddFooter>&amp;LAtlas Material Tracking&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>'
    : ''
  const body = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => cellXml(cell, `${columnName(columnIndex + 1)}${rowIndex + 1}`))
        .join('')
      const height = worksheetRowHeight(row)
      return `<row r="${rowIndex + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`
    })
    .join('')

  return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${sheetViewsXml}${columnXml}<sheetData>${body}</sheetData>${autoFilterXml}${mergeXml}${pageSetupXml}${drawingXml}</worksheet>`)
}

function worksheetRowHeight(row: WorkbookCell[]) {
  const wrappedLengths = row
    .map(cell => (typeof cell === 'object' && cell !== null && (cell.style === 7 || cell.style === 22) ? String(cell.value ?? '').length : 0))
    .filter(Boolean)
  if (!wrappedLengths.length) return 0
  const longest = Math.max(...wrappedLengths)
  if (longest < 55) return 24
  if (longest < 120) return 42
  return 60
}

function sheetViewsXmlForFreezePane(topLeftCell: string) {
  const row = Number(topLeftCell.match(/\d+/)?.[0] ?? 1)
  const ySplit = Math.max(0, row - 1)
  if (!ySplit) return ''
  return `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${ySplit}" topLeftCell="${escapeXml(topLeftCell)}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>`
}

function cellXml(cell: WorkbookCell, reference: string) {
  const normalized = typeof cell === 'object' && cell !== null ? cell : { value: cell }
  const style = normalized.style ? ` s="${normalized.style}"` : ''
  if (normalized.formula) {
    const cached = typeof normalized.value === 'number' ? `<v>${Number.isFinite(normalized.value) ? normalized.value : 0}</v>` : ''
    return `<c r="${reference}"${style}><f>${escapeXml(normalized.formula)}</f>${cached}</c>`
  }
  if (typeof normalized.value === 'number') return `<c r="${reference}"${style}><v>${Number.isFinite(normalized.value) ? normalized.value : 0}</v></c>`
  const isLayoutBlank = normalized.value === ''
  const value = isLayoutBlank ? '' : documentValue(normalized.value)
  return `<c r="${reference}"${style} t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
}

function workbookXml(sheets: WorkbookSheet[]) {
  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')
  const definedNames = sheets
    .map((sheet, index) =>
      sheet.printTitleRows ? `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${quoteSheetName(sheet.name)}!$${sheet.printTitleRows.replace(':', ':$')}</definedName>` : '',
    )
    .join('')

  return xmlHeader(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets>${definedNames ? `<definedNames>${definedNames}</definedNames>` : ''}</workbook>`)
}

function workbookRelsXml(sheets: WorkbookSheet[]) {
  const sheetRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('')

  return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
}

function contentTypesXml(sheets: WorkbookSheet[], hasJpg = false) {
  const sheetTypes = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')
  const jpgType = hasJpg ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ''
  const drawingType = hasJpg ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''

  return xmlHeader(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${jpgType}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${drawingType}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheetTypes}</Types>`)
}

function rootRelsXml() {
  return xmlHeader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
}

function stylesXml() {
  return xmlHeader(`
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="_(&quot;$&quot;* #,##0.00_);_(&quot;$&quot;* (#,##0.00);_(&quot;$&quot;* &quot;-&quot;??_);_(@_)"/></numFmts>
  <fonts count="7">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF06163D"/><name val="Arial"/></font>
    <font><b/><sz val="18"/><color rgb="FF06163D"/><name val="Arial"/></font>
    <font><sz val="11"/><color rgb="FF566779"/><name val="Arial"/></font>
  </fonts>
  <fills count="10">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF06163D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDFF5E7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDDEBFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF1C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFE3C2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFD6D6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE9EEF5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border/>
    <border><left style="thin"><color rgb="FFD8DEE8"/></left><right style="thin"><color rgb="FFD8DEE8"/></right><top style="thin"><color rgb="FFD8DEE8"/></top><bottom style="thin"><color rgb="FFD8DEE8"/></bottom></border>
    <border><left style="medium"><color rgb="FF06163D"/></left><right style="medium"><color rgb="FF06163D"/></right><top style="medium"><color rgb="FF06163D"/></top><bottom style="medium"><color rgb="FF06163D"/></bottom></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="30">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1" applyBorder="1"><alignment wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`.replace(/\n\s*/g, ''))
}

function sheetDrawingRelsXml() {
  return xmlHeader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>')
}

function drawingRelsXml() {
  return xmlHeader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/cronos-logo.jpg"/></Relationships>')
}

function drawingXml() {
  return xmlHeader(`
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>6</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="2" name="Cronos Logo"/><xdr:cNvPicPr/></xdr:nvPicPr>
      <xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
      <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`.replace(/\n\s*/g, ''))
}

async function fetchCronosLogo() {
  try {
    const response = await fetch('/cronos-logo.jpg')
    if (!response.ok) return null
    return await response.arrayBuffer()
  } catch {
    return null
  }
}

function appXml() {
  return xmlHeader('<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Cronos Procurement</Application></Properties>')
}

function coreXml() {
  return xmlHeader(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:creator>Cronos Procurement</dc:creator><dcterms:created>${new Date().toISOString()}</dcterms:created></cp:coreProperties>`)
}

function xmlHeader(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`
}

function countReceived(lines: TrackingWorkbookLine[]) {
  return lines.filter(line => line.receivedDate || line.status === 'Received').length
}

function countTracking(lines: TrackingWorkbookLine[]) {
  return lines.filter(line => line.trackingNumber).length
}

function countScheduled(lines: TrackingWorkbookLine[]) {
  return lines.filter(line => line.estimatedShipDate && !line.trackingNumber && !line.receivedDate).length
}

function countPending(lines: TrackingWorkbookLine[]) {
  return lines.filter(line => !line.trackingNumber && !line.estimatedShipDate && !line.receivedDate).length
}

function getTrackingWorkbookStatus(line: TrackingWorkbookLine) {
  if (line.receivedDate || ['Received', 'Delivered'].includes(line.status)) return 'Delivered'
  if (line.status === 'Partially Shipped' || line.status === 'Partially Received') return 'Partially Shipped'
  if (line.status === 'Backordered' || line.status === 'RMA' || line.status === 'RMA / Issue') return 'Delayed'
  if (line.trackingNumber || line.status === 'Shipped' || line.status === 'In Transit to Cronos') return 'In Transit'
  if (line.estimatedShipDate || ['Ordered', 'PO Issued', 'Awaiting Vendor Shipment'].includes(line.status)) return 'Processing'
  return 'Pending'
}

function formatDateForWorkbook(value: string | undefined) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function getQuoteExpirationDateForWorkbook(quote: CustomerQuote) {
  const date = new Date(quote.createdAt || Date.now())
  date.setDate(date.getDate() + (quote.expirationDays ?? 30))
  return formatDateForWorkbook(date.toISOString())
}

function vendorRfqDueDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return formatDateForWorkbook(date.toISOString())
}

function findVendorRecord(vendor: string) {
  const normalized = vendor.trim().toLowerCase()
  return loadVendorDirectory().find(record => record.vendor.trim().toLowerCase() === normalized)
}

function sanitizeSheetName(value: string) {
  return (value || 'Project').replace(/[\[\]:*?/\\]/g, '-').slice(0, 31)
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-')
}

function quoteSheetName(value: string) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function columnName(index: number): string {
  let column = ''
  let current = index
  while (current > 0) {
    const remainder = (current - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    current = Math.floor((current - 1) / 26)
  }
  return column
}

function escapeXml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
