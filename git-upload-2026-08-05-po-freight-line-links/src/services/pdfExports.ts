import type { CustomerQuote, Project, ProjectPurchaseOrder, PurchaseOrder } from '../types'
import { calculateLineTotals, calculateQuoteSummary, currency } from './calculations'
import { getCheckbookSummary } from './checkbook'
import { documentContactLines, getProjectDocumentContact } from './documentContacts'
import { formatCustomerAddressLines, structuredCustomerFromProject } from './customerFormatting'
import { loadProject } from './localProjects'
import {
  createDocumentAudit,
  documentValue,
  finishDocumentAudit,
  normalizePurchaseOrderLineForDocument,
  normalizeQuoteLineForDocument,
  recordDocumentIssue,
  validateProjectDocumentFields,
  validatePurchaseOrderDocument,
  validateQuoteDocument,
} from './documentGeneration'

type JsPdf = import('jspdf').jsPDF
type PdfTableColumn = {
  label: string
  x: number
  width: number
  align: 'left' | 'center' | 'right'
  wrap?: boolean
  breakWords?: boolean
  numeric?: boolean
}
type PdfTableCell = {
  column: PdfTableColumn
  text: string | string[]
  fontSize?: number
}
type AtlasMetadataRow = {
  label: string
  value: string | number
  wrap?: boolean
}
let logoDataUrl: string | null | undefined
const NAVY: [number, number, number] = [6, 22, 61]
const LINE: [number, number, number] = [200, 210, 224]
const TEXT: [number, number, number] = [7, 27, 73]
const MUTED: [number, number, number] = [82, 97, 121]
const PAGE_BOTTOM = 722
const CRONOS_ADDRESS = ['4301 Evans to Locks Road', 'Evans, GA 30809']
const CRONOS_BILL_TO = ['3925 CAREY CT', 'ELLICOTT CITY, MD 21042']
const CRONOS_CAGE_CODE = '8NPB1'
const EMBEDDED_PDF_LOGO = 'data:image/png;base64,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O6f09HQGDRrEySefzJQpUzjrrLPo169fXF5aa9asYdmyZaxbt478/HwqKytpaGjAtu1Of0aVUtxwww3xuVdUHAmFQurDDz9UV199tRo8eLDSdV019YTp1J977733oMc4Y8aMLjmmQ/1omqYGDx6srr32WvXZZ5/F5dps2bJF/eY3v1GDBg3q1HMzTVNNmDBB/f3vf1fV1dXtPv6f/OQn7T4Gj8ejvvjii7iM60UXXXTYxzF8+HAVDAbbtR/bttXs2bPVRRddpFJTUzv1GmZnZ6tp06apzz//PCZjVltbqx577DE1ZsyYLtOIg/3cfvvtcblP4ia87733njr99NMTYvDuu+++gx7nzJkzE054DxThCy64QK1YsSIm16W6ulrdeeedKiMjo8vP7dhjj1Wvvvpqu87j6quv7tC+x4wZ0yHhPxgXX3zxYR/DqFGj2iW8S5YsUd/61re6/PoZhqEuv/xytX379naP17Jly9TYsWMT9vm78847u4fwNjY2qptvvjmh3lzdWXibf1JTU9XTTz/doWuzbt06NW7cuIQ7t+uuu07V19d3qvAC6sYbb+x2wvvYY4+p5OTkhLp+ubm56s0334x6rL744guVlZWV0M9dtxDeurq6qG48Ed7ofx555JF2XZsvv/xS9evXL2HP6zvf+Y6qq6vrVOE1DEPNnj272wjv3XffnbDXz+VyqRdffPGwz6WsrEwNGzYs4Z+3eAmvHsvVx+nTp/POO+9IrEgcueuuu3j33Xej2qawsJAf/vCH7N27N2HPa86cOdx4442dunodDoe55ZZbEnpcmnnmmWd48MEHE/b4gsEgN9xwA/PmzTuszz/22GPs2LEDiePtIC+88AL/+c9/RBk7QSx+9atfUV1dfdgvxFtvvZVdu3Yl/Lm9/PLLvPzyy526z4KCAn75y192WbjS4bB27VruuOOOhL9+fr+f6dOnU1FRccjPeb1eXnrpJSSBooMUFxfz+9//XlSxk9ixYwf//ve/D9uSfOutt7rNuf3+97//xgc31rzxxhu88MILCTkejuNw9913U19f3y2u386dO/nzn/98yM8sXLiQ4uJiEd6O8ve//53S0lJRxE62Dm3bPuRnbNv+xocg0SgsLOTFF1/s9P3eeeedbNq0KeHGY8mSJXz44Yfd6hq+8MILh3TffP7550jmWgepra09bOurq/gmgeqO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'

export async function exportCustomerQuotePdf(quote: CustomerQuote, project?: Project) {
  // Resolve the saved project when the user downloads the document. The detail
  // screen may still hold its pre-edit object after returning from Edit Project.
  const currentProject = loadProject(quote.projectId) ?? project
  const audit = createDocumentAudit('Customer Quote PDF', quote.quoteNumber)
  validateQuoteDocument(audit, quote, currentProject)
  const shippingLines = getShippingAddressLines(currentProject)
  if (!shippingLines.length) {
    recordDocumentIssue(audit, 'error', 'Shipping Address', 'Quote PDF requires a project shipping address.')
    finishDocumentAudit(audit)
    window.alert('Add a shipping address to this project before generating the customer quote PDF.')
    return
  }

  const poc = getProjectDocumentContact(currentProject)
  const doc = await createDocument()
  await drawCronosLetterhead(doc, '')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...NAVY)
  doc.text('Quote', 471, 34, { align: 'center' })

  const metadataBottom = AtlasMetadataGrid(doc, 372, 42, 184, [
    { label: 'Quote Number:', value: quote.quoteNumber, wrap: false },
    { label: 'Quote Name:', value: quote.quoteName || '-', wrap: true },
    { label: 'Date:', value: formatPdfDate(quote.createdAt || new Date().toISOString()), wrap: false },
    { label: 'Expires:', value: getQuoteExpirationDate(quote), wrap: false },
    { label: 'Project:', value: quote.projectNumber, wrap: false },
  ])

  const infoBoxY = Math.max(150, metadataBottom + 16)
  let y = infoBoxY + 170

  drawCustomerInfoBox(doc, 40, infoBoxY, 248, 150, 'Customer', currentProject, quote.customer)
  drawInfoBox(doc, 324, infoBoxY, 248, 150, 'Cronos POC', getQuotePocBoxLines(poc))

  y = drawQuoteTemplateTable(doc, Math.max(320, y), quote)
  const summary = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)

  const totalRows = [
    ['Line Item Total', currency(summary.totalSellPrice)],
  ]
  if (quote.contractFeeEnabled && summary.contractFee > 0) {
    totalRows.push(['Contract Fee', currency(summary.contractFee)])
  }
  if ((quote.shippingCost ?? 0) > 0) {
    totalRows.push(['Shipping', currency(summary.shippingCost)])
  }
  totalRows.push(['Quote Total', currency(summary.customerTotal)])

  y = AtlasPageBreakHandler(doc, y + 24, 98)
  drawTotals(doc, y, totalRows)
  AtlasDocumentFooter(doc)
  finishDocumentAudit(audit)
  doc.save(`${quote.quoteNumber}.pdf`)
}

export async function exportPurchaseOrderPdf(po: PurchaseOrder | ProjectPurchaseOrder, project?: Project) {
  const audit = createDocumentAudit('Purchase Order PDF', po.poNumber)
  validatePurchaseOrderDocument(audit, po, project)
  const poc = getProjectDocumentContact(project)
  const doc = await createDocument()
  await drawCronosLetterhead(doc, '')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...NAVY)
  doc.text('Purchase Order', 474, 34, { align: 'center' })

  const metadataBottom = AtlasMetadataGrid(doc, 372, 46, 184, [
    { label: 'Date:', value: formatPdfDate(po.dateIssued), wrap: false },
    { label: 'Terms:', value: po.terms || 'NET30', wrap: false },
    { label: 'PO #:', value: po.poNumber, wrap: false },
    { label: 'Project:', value: project ? project.projectNumber : 'projectNumber' in po ? po.projectNumber : '', wrap: false },
  ])

  const firstInfoY = Math.max(150, metadataBottom + 16)
  drawInfoBox(doc, 40, firstInfoY, 248, 130, 'Vendor', [po.vendor])
  drawCustomerInfoBox(doc, 324, firstInfoY, 248, 130, 'Ship To', project, project?.customer)
  const secondInfoY = firstInfoY + 150
  drawInfoBox(doc, 40, secondInfoY, 248, 100, 'Bill To', CRONOS_BILL_TO)
  drawInfoBox(doc, 324, secondInfoY, 248, 100, 'Cronos POC', documentContactLines(poc))

  const y = drawPurchaseOrderTemplateTable(doc, Math.max(410, secondInfoY + 140), po)
  drawPurchaseOrderTotal(doc, y + 14, getPoSubtotal(po), po.freightCost || 0)
  drawPurchaseOrderFooter(doc)
  finishDocumentAudit(audit)
  doc.save(`Cronos-${sanitizeFileName(po.poNumber)}-Purchase-Order.pdf`)
}

async function drawCronosLetterhead(doc: JsPdf, title: string) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 612, 792, 'F')
  await drawLogo(doc, 42, 28, 110, 74)

  if (title) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(...NAVY)
    doc.text(title, 306, 104, { align: 'center' })
  }
}

function AtlasMetadataGrid(doc: JsPdf, x: number, y: number, width: number, rows: AtlasMetadataRow[]) {
  const labelWidth = 62
  const valueWidth = width - labelWidth - 24
  const preparedRows = rows.map(row => ({
    label: documentValue(row.label),
    wrap: row.wrap ?? true,
    value: row.wrap === false ? [AtlasCurrencyCell(doc, documentValue(row.value), valueWidth, 8.5)] : AtlasWrappedText(doc, documentValue(row.value), valueWidth),
  }))
  const rowHeights = preparedRows.map(row => Math.max(18, 8 + row.value.length * 10))
  const blockHeight = 12 + rowHeights.reduce((total, height) => total + height, 0)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.rect(x, y, width, blockHeight)
  let rowY = y + 18
  preparedRows.forEach(({ label, value }, index) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT)
    doc.text(label, x + 10, rowY)
    doc.setFont('helvetica', 'normal')
    doc.text(value, x + labelWidth + 10, rowY)
    rowY += rowHeights[index]
  })
  return y + blockHeight
}

function drawInfoBox(doc: JsPdf, x: number, y: number, width: number, height: number, title: string, lines: string[]) {
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.rect(x, y, width, height)
  doc.setFillColor(...NAVY)
  doc.rect(x, y, width, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(title, x + 10, y + 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...TEXT)
  const cleanLines = lines.map(line => documentValue(line).trim()).filter(line => line !== 'N/A')
  const visible = cleanLines.length ? cleanLines : ['N/A']
  let textY = y + 38
  visible.forEach(line => {
    const wrapped = AtlasWrappedText(doc, line, width - 20)
    doc.text(wrapped, x + 10, textY)
    textY += Math.max(12, wrapped.length * 10)
  })
}

function drawCustomerInfoBox(doc: JsPdf, x: number, y: number, width: number, height: number, title: string, project: Project | undefined, fallbackCompany = '') {
  const customer = structuredCustomerFromProject(project, fallbackCompany)
  const addressLines = formatCustomerAddressLines(customer)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.rect(x, y, width, height)
  doc.setFillColor(...NAVY)
  doc.rect(x, y, width, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(title, x + 10, y + 15)

  let textY = y + 38
  doc.setTextColor(...TEXT)
  if (customer.companyName) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const companyLines = AtlasWrappedText(doc, customer.companyName, width - 20)
    doc.text(companyLines, x + 10, textY)
    textY += Math.max(12, companyLines.length * 10)
  }
  if (customer.attention && customer.attention.toLowerCase() !== customer.companyName.toLowerCase()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Attention:', x + 10, textY)
    textY += 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(AtlasWrappedText(doc, customer.attention, width - 20), x + 10, textY)
    textY += 13
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  addressLines.forEach(line => {
    const wrapped = AtlasWrappedText(doc, line, width - 20)
    doc.text(wrapped, x + 10, textY)
    textY += Math.max(11, wrapped.length * 10)
  })

  if (customer.email) {
    textY += 4
    doc.setFontSize(7.8)
    doc.setFont('helvetica', 'bold')
    doc.text('Email:', x + 10, textY)
    textY += 9
    doc.setFont('helvetica', 'normal')
    doc.text(AtlasWrappedText(doc, customer.email, width - 20), x + 10, textY)
    textY += 10
  }
  if (customer.phone) {
    doc.setFontSize(7.8)
    doc.setFont('helvetica', 'bold')
    doc.text('Phone:', x + 10, textY)
    textY += 9
    doc.setFont('helvetica', 'normal')
    doc.text(customer.phone, x + 10, textY)
  }
}

function drawPurchaseOrderTemplateTable(doc: JsPdf, startY: number, po: PurchaseOrder | ProjectPurchaseOrder) {
  const columns = [
    { label: 'Item #', x: 40, width: 42, align: 'left' as const, wrap: false },
    { label: 'Part Number', x: 82, width: 82, align: 'left' as const, wrap: true, breakWords: true },
    { label: 'Manufacturer', x: 164, width: 76, align: 'left' as const, wrap: true },
    { label: 'Description', x: 240, width: 178, align: 'left' as const, wrap: true },
    { label: 'Qty', x: 418, width: 38, align: 'center' as const, numeric: true },
    { label: 'Unit Cost', x: 456, width: 58, align: 'right' as const, numeric: true },
    { label: 'Total Cost', x: 514, width: 58, align: 'right' as const, numeric: true },
  ]
  let y = drawDarkTableHeader(doc, startY, columns)

  po.lines.map(normalizePurchaseOrderLineForDocument).forEach((line, index) => {
    const cells = [
      { column: columns[0], text: line.itemNumber || String(index + 1) },
      { column: columns[1], text: line.partNumber },
      { column: columns[2], text: line.manufacturer || po.vendor || 'N/A' },
      { column: columns[3], text: line.description },
      { column: columns[4], text: String(line.quantityOrdered || 0) },
      { column: columns[5], text: currency(line.unitCost || 0) },
      { column: columns[6], text: currency((line.unitCost || 0) * (line.quantityOrdered || 0)) },
    ]
    const rowHeight = calculatePdfTableRowHeight(doc, cells)
    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage()
      y = drawDarkTableHeader(doc, 54, columns)
    }
    AtlasTable(doc, y, rowHeight, cells)
    y += rowHeight
  })

  return y
}

function drawQuoteTemplateTable(doc: JsPdf, startY: number, quote: CustomerQuote) {
  const columns = [
    { label: 'Line', x: 40, width: 30, align: 'left' as const, wrap: false },
    { label: 'Manufacturer', x: 70, width: 70, align: 'left' as const, wrap: true },
    { label: 'Qty', x: 140, width: 28, align: 'center' as const, numeric: true },
    { label: 'Part Number', x: 168, width: 116, align: 'left' as const, wrap: true, breakWords: true },
    { label: 'Description', x: 284, width: 114, align: 'left' as const, wrap: true },
    { label: 'Unit Cost', x: 398, width: 58, align: 'right' as const, numeric: true },
    { label: 'Extended Cost', x: 456, width: 62, align: 'right' as const, numeric: true },
    { label: 'Lead Time', x: 518, width: 54, align: 'left' as const, wrap: true },
  ]
  let y = drawDarkTableHeader(doc, startY, columns)

  quote.lines.map(normalizeQuoteLineForDocument).forEach((line, index) => {
    const totals = calculateLineTotals(line)
    const cells = [
      { column: columns[0], text: String(index + 1) },
      { column: columns[1], text: line.manufacturer },
      { column: columns[2], text: String(line.quantity || 0) },
      { column: columns[3], text: line.partNumber },
      { column: columns[4], text: line.description },
      { column: columns[5], text: currency(totals.sellPrice) },
      { column: columns[6], text: currency(totals.extendedSellPrice) },
      { column: columns[7], text: line.leadTime?.trim() || 'TBD' },
    ]
    const rowHeight = calculatePdfTableRowHeight(doc, cells)
    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage()
      y = drawDarkTableHeader(doc, 54, columns)
    }
    AtlasTable(doc, y, rowHeight, cells)
    y += rowHeight
  })

  return y
}

function drawDarkTableHeader(
  doc: JsPdf,
  y: number,
  columns: PdfTableColumn[],
) {
  doc.setFillColor(...NAVY)
  doc.rect(40, y, 532, 24, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  columns.forEach(column => {
    const textX = column.align === 'right' ? column.x + column.width - 6 : column.align === 'center' ? column.x + column.width / 2 : column.x + 6
    doc.text(column.label, textX, y + 15, { align: column.align })
  })
  return y + 24
}

function AtlasWrappedText(doc: JsPdf, value: string | string[], width: number) {
  const raw = Array.isArray(value) ? value.join('\n') : documentValue(value)
  return raw
    .split(/\r?\n/)
    .flatMap(line => splitTextToWidth(doc, line.trim() || '-', Math.max(12, width), true))
}

function AtlasCurrencyCell(doc: JsPdf, value: string, width: number, fontSize = 8) {
  const text = documentValue(value).replace(/\s+/g, ' ')
  let candidate = text
  doc.setFontSize(fontSize)
  if (doc.getTextWidth(candidate) <= width) return candidate

  while (candidate.length > 4 && doc.getTextWidth(`${candidate.slice(0, -1)}...`) > width) {
    candidate = candidate.slice(0, -1)
  }
  return candidate.length > 4 ? `${candidate.slice(0, -1)}...` : text
}

function calculatePdfTableRowHeight(doc: JsPdf, cells: PdfTableCell[], lineHeight = 10) {
  const maxLines = Math.max(
    1,
    ...cells.map(cell => (cell.column.wrap === false || cell.column.numeric ? 1 : wrapCellText(doc, cell).length)),
  )
  return Math.max(30, 14 + maxLines * lineHeight)
}

function AtlasTable(doc: JsPdf, y: number, height: number, cells: PdfTableCell[]) {
  doc.setDrawColor(224, 229, 237)
  doc.setLineWidth(0.5)
  doc.rect(40, y, 532, height)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TEXT)
  cells.forEach(cell => {
    const fontSize = cell.fontSize ?? 8
    const text = Array.isArray(cell.text) ? cell.text.join(' ') : documentValue(cell.text)
    const lines = cell.column.wrap === false || cell.column.numeric
      ? [AtlasCurrencyCell(doc, text, cell.column.width - 12, fontSize)]
      : wrapCellText(doc, cell)
    const textX =
      cell.column.align === 'right'
        ? cell.column.x + cell.column.width - 6
        : cell.column.align === 'center'
          ? cell.column.x + cell.column.width / 2
          : cell.column.x + 6
    doc.setFontSize(fontSize)
    doc.text(lines, textX, y + 17, { align: cell.column.align })
  })
}

function wrapCellText(doc: JsPdf, cell: PdfTableCell) {
  const width = Math.max(12, cell.column.width - 12)
  const value = Array.isArray(cell.text) ? cell.text.join('\n') : documentValue(cell.text)
  return value
    .split(/\r?\n/)
    .flatMap(line => splitTextToWidth(doc, line.trim() || 'N/A', width, cell.column.breakWords))
}

function splitTextToWidth(doc: JsPdf, value: string, width: number, breakWords = false) {
  const lines = doc.splitTextToSize(value, width) as string[]
  if (!breakWords) return lines

  return lines.flatMap(line => {
    if (doc.getTextWidth(line) <= width) return [line]
    return breakLongToken(doc, line, width)
  })
}

function breakLongToken(doc: JsPdf, value: string, width: number) {
  const lines: string[] = []
  let current = ''

  Array.from(value).forEach(char => {
    const candidate = `${current}${char}`
    if (current && doc.getTextWidth(candidate) > width) {
      lines.push(current)
      current = char
      return
    }
    current = candidate
  })

  if (current) lines.push(current)
  return lines.length ? lines : ['N/A']
}

function drawPurchaseOrderTotal(doc: JsPdf, y: number, subtotal: number, freight: number) {
  let boxY = y
  const boxHeight = freight > 0 ? 66 : 30
  if (boxY + boxHeight > PAGE_BOTTOM) {
    doc.addPage()
    boxY = 54
  }
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.8)
  doc.rect(408, boxY, 164, boxHeight)
  doc.setFillColor(248, 251, 255)
  doc.rect(408, boxY, 82, boxHeight, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT)
  if (freight > 0) {
    doc.text('Subtotal', 424, boxY + 17)
    doc.text('Freight', 424, boxY + 37)
    doc.text('PO Total', 424, boxY + 57)
    doc.text(currency(subtotal), 560, boxY + 17, { align: 'right' })
    doc.text(currency(freight), 560, boxY + 37, { align: 'right' })
    doc.text(currency(subtotal + freight), 560, boxY + 57, { align: 'right' })
  } else {
    doc.text('Total', 424, boxY + 19)
    doc.text(currency(subtotal), 560, boxY + 19, { align: 'right' })
  }
}

function drawPurchaseOrderFooter(doc: JsPdf) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('Please reference the PO number on all correspondence and shipment paperwork.', 40, 744)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text('CRONOS LLC', 572, 744, { align: 'right' })
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${page} of ${pages}`, 572, 764, { align: 'right' })
  }
}

function getPoSubtotal(po: PurchaseOrder | ProjectPurchaseOrder) {
  return po.lines.reduce((total, line) => total + (line.unitCost || 0) * (line.quantityOrdered || 0), 0)
}

function formatPdfDate(value?: string) {
  if (!value) return new Intl.DateTimeFormat('en-US').format(new Date())
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US').format(date)
}

function getQuoteExpirationDate(quote: CustomerQuote) {
  const date = new Date(quote.createdAt || Date.now())
  date.setDate(date.getDate() + (quote.expirationDays ?? 30))
  return formatPdfDate(date.toISOString())
}

function getQuotePocBoxLines(poc: ReturnType<typeof getProjectDocumentContact>) {
  return documentContactLines(poc)
}

function splitAddress(value: string) {
  return value
    .split(/\r?\n|,/)
    .map(line => line.trim())
    .filter(Boolean)
}

function getShippingAddressLines(project?: Project) {
  if (!project) return []

  return [
    ...splitAddress(project.deliveryAddress || ''),
    project.shippingContactName ? `Contact: ${project.shippingContactName}` : '',
    project.shippingEmail ? `Email: ${project.shippingEmail}` : '',
    project.shippingPhone ? `Phone: ${project.shippingPhone}` : '',
    project.shippingInstructions ? `Instructions: ${project.shippingInstructions}` : '',
  ].filter(Boolean)
}

export async function exportCustomerTrackingUpdatePdf(po: PurchaseOrder | ProjectPurchaseOrder, project?: Project) {
  const audit = createDocumentAudit('Customer Tracking Update PDF', po.poNumber)
  validatePurchaseOrderDocument(audit, po, project)
  const poc = getProjectDocumentContact(project)
  const doc = await createDocument()
  let y = await AtlasDocumentHeader(doc, 'Customer Tracking Update')
  y = drawKeyValue(doc, y, [
    ['PO #', po.poNumber],
    ['Project', project ? `${project.projectNumber} - ${project.projectName}` : 'projectNumber' in po ? `${po.projectNumber} - ${po.projectName}` : ''],
    ['Vendor', po.vendor],
    ['Cronos POC', `${poc.name}${poc.email ? ` | ${poc.email}` : ''}${poc.phone ? ` | ${poc.phone}` : ''}`],
    ['Status', po.status],
    ['Estimated Ship', po.estimatedShipDate ?? ''],
    ['Estimated Delivery', po.expectedDeliveryDate ?? ''],
  ])

  if (po.customerUpdateNotes) {
    const noteLines = AtlasWrappedText(doc, po.customerUpdateNotes, 520)
    y = AtlasPageBreakHandler(doc, y + 8, 28 + noteLines.length * 10)
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Update Notes', 40, y)
    doc.setFont('helvetica', 'normal')
    doc.text(noteLines, 40, y + 18)
    y += 28 + noteLines.length * 10
  }

  drawPoLines(doc, y + 8, po, true)
  AtlasDocumentFooter(doc)
  finishDocumentAudit(audit)
  doc.save(`${po.poNumber}-customer-update.pdf`)
}

export async function exportCheckbookReportPdf(project: Project) {
  const audit = createDocumentAudit('Checkbook Financial Report PDF', project.projectNumber)
  validateProjectDocumentFields(audit, project)
  const summary = getCheckbookSummary(project)
  const poc = getProjectDocumentContact(project)
  const doc = await createDocument()
  let y = await AtlasDocumentHeader(doc, 'Checkbook Financial Report')
  y = drawKeyValue(doc, y, [
    ['Project', `${project.projectNumber} - ${project.projectName}`],
    ['Customer', project.customer],
    ['Cronos POC', `${poc.name}${poc.email ? ` | ${poc.email}` : ''}${poc.phone ? ` | ${poc.phone}` : ''}`],
    ['Starting Balance', currency(summary.startingBalance)],
    ['Cost to Customer', currency(summary.customerCost)],
    ['Remaining Balance', currency(summary.remainingBalance)],
  ])

  const columns: PdfTableColumn[] = [
    { label: 'PO #', x: 40, width: 66, align: 'left', wrap: false },
    { label: 'Vendor', x: 106, width: 92, align: 'left', wrap: true },
    { label: 'Description', x: 198, width: 280, align: 'left', wrap: true },
    { label: 'Customer Cost', x: 478, width: 82, align: 'right', numeric: true },
  ]
  y = drawDarkTableHeader(doc, y + 16, columns)
  summary.lines.forEach(line => {
    const cells = [
      { column: columns[0], text: line.poNumber },
      { column: columns[1], text: line.vendor || '-' },
      { column: columns[2], text: line.description || '-' },
      { column: columns[3], text: currency(line.customerCost) },
    ]
    const rowHeight = calculatePdfTableRowHeight(doc, cells)
    if (y + rowHeight > PAGE_BOTTOM) {
      doc.addPage()
      y = drawDarkTableHeader(doc, 54, columns)
    }
    AtlasTable(doc, y, rowHeight, cells)
    y += rowHeight
  })

  AtlasDocumentFooter(doc)
  finishDocumentAudit(audit)
  doc.save(`${project.projectNumber}-checkbook-report.pdf`)
}

export async function exportCustomerConsolidatedTrackingReportPdf(project: Project) {
  const audit = createDocumentAudit('Customer Consolidated Tracking PDF', project.projectNumber)
  validateProjectDocumentFields(audit, project)
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  const poc = getProjectDocumentContact(project)
  const rows = project.purchaseOrders.flatMap(po =>
    po.lines.map((line, index) => ({
      itemNumber: line.itemNumber || String(index + 1),
      poNumber: po.poNumber,
      vendor: po.vendor,
      vendorOrderNumber: line.vendorOrderNumber ?? '',
      partNumber: line.partNumber,
      description: line.description,
      quantity: line.quantityOrdered,
      carrier: line.carrier ?? '',
      trackingNumber: line.trackingNumber ?? '',
      estimatedShipDate: line.estimatedShipDate ?? '',
      deliveryDate: line.receivedDate || line.estimatedDeliveryDate || '',
      status: line.status,
    })),
  )

  await drawLandscapeReportHeader(doc, 'Tracking Report')
  doc.setFontSize(10)
  doc.text(`Project: ${project.projectNumber}`, 42, 112)
  doc.text(`Customer: ${project.customer}`, 42, 128)
  doc.text(`Cronos POC: ${poc.name}${poc.email ? ` | ${poc.email}` : ''}`, 42, 144)

  const tracking = rows.filter(row => row.trackingNumber).length
  const scheduled = rows.filter(row => row.estimatedShipDate).length
  const pendingUpdates = rows.filter(row => !row.trackingNumber && !row.estimatedShipDate).length
  const summary = [
    ['Tracked Lines', String(rows.length)],
    ['Tracking Entered', String(tracking)],
    ['Scheduled', String(scheduled)],
    ['Pending Updates', String(pendingUpdates)],
  ]

  doc.setDrawColor(222, 229, 238)
  doc.setFillColor(248, 251, 255)
  doc.roundedRect(42, 166, 720, 58, 4, 4, 'FD')
  summary.forEach(([label, value], index) => {
    const x = 58 + index * 172
    doc.setFontSize(8)
    doc.setTextColor(82, 97, 121)
    doc.text(label, x, 188)
    doc.setFontSize(15)
    doc.setTextColor(6, 22, 61)
    doc.text(value, x, 210)
  })

  let y = drawTrackingReportHeader(doc, 250)
  rows.forEach((row, index) => {
    const descriptionLines = AtlasWrappedText(doc, row.description || '-', 118)
    const partLines = [AtlasCurrencyCell(doc, row.partNumber || '-', 82, 7.5)]
    const trackingLines = [AtlasCurrencyCell(doc, row.trackingNumber || 'Pending', 104, 7.5)]
    const dateLines = [`ESD: ${formatMaybeDate(row.estimatedShipDate)}`, `Del: ${formatMaybeDate(row.deliveryDate)}`]
    const rowHeight = Math.max(42, 18 + Math.max(descriptionLines.length, partLines.length, trackingLines.length, dateLines.length) * 10)

    if (y + rowHeight > 548) {
      drawTrackingReportFooter(doc)
      doc.addPage()
      y = drawTrackingReportHeader(doc, 52)
    }

    doc.setFillColor(index % 2 ? 249 : 255, index % 2 ? 251 : 255, index % 2 ? 253 : 255)
    doc.rect(42, y, 720, rowHeight, 'F')
    doc.setDrawColor(230, 235, 243)
    doc.line(42, y + rowHeight, 762, y + rowHeight)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(7, 27, 73)
    doc.text(row.itemNumber, 48, y + 17)
    doc.text(AtlasCurrencyCell(doc, row.poNumber, 82, 7.5), 68, y + 17)
    doc.text(AtlasWrappedText(doc, row.vendor, 58), 158, y + 17)
    doc.text(AtlasCurrencyCell(doc, row.vendorOrderNumber || 'Pending', 66, 7.5), 222, y + 17)
    doc.text(partLines, 296, y + 17)
    doc.text(descriptionLines, 384, y + 17)
    doc.text(String(row.quantity), 516, y + 17, { align: 'center' })
    doc.text(AtlasCurrencyCell(doc, row.carrier || 'Pending', 50, 7.5), 534, y + 17)
    doc.text(trackingLines, 590, y + 17)
    doc.text(dateLines, 708, y + 17)
    y += rowHeight
  })

  drawTrackingReportFooter(doc)
  finishDocumentAudit(audit)
  doc.save(`Cronos-${sanitizeFileName(project.projectNumber)}-Customer-Tracking-Report.pdf`)
}

async function createDocument() {
  const { default: jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'pt', format: 'letter' })
}

async function AtlasDocumentHeader(doc: JsPdf, title: string) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 612, 128, 'F')
  doc.setFillColor(6, 22, 61)
  doc.rect(0, 0, 612, 8, 'F')
  doc.setDrawColor(222, 229, 238)
  doc.line(40, 116, 572, 116)
  await drawLogo(doc, 40, 20, 132, 90)
  doc.setTextColor(6, 22, 61)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text(title, 572, 46, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(82, 97, 121)
  doc.text(`Generated ${new Intl.DateTimeFormat('en-US').format(new Date())}`, 572, 64, { align: 'right' })
  doc.setTextColor(7, 27, 73)
  doc.setFontSize(10)
  return 144
}

async function drawLandscapeReportHeader(doc: JsPdf, title: string) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, 792, 106, 'F')
  doc.setFillColor(6, 22, 61)
  doc.rect(0, 0, 792, 8, 'F')
  doc.setDrawColor(222, 229, 238)
  doc.line(42, 100, 750, 100)
  await drawLogo(doc, 42, 18, 116, 78)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(6, 22, 61)
  doc.text(title, 396, 50, { align: 'center' })
  doc.setTextColor(6, 22, 61)
}

function drawLogoMark(doc: JsPdf, x: number, y: number) {
  doc.setFillColor(28, 116, 222)
  doc.circle(x + 18, y + 18, 16, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(x + 23, y + 18, 9, 'F')
  doc.rect(x + 23, y + 10, 14, 16, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(6, 22, 61)
  doc.text('CRONOS', x + 42, y + 25)
}

async function drawLogo(doc: JsPdf, x: number, y: number, width: number, height: number) {
  const logo = await getLogoDataUrl()
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', x, y, width, height, undefined, 'FAST')
      return
    } catch {
      logoDataUrl = null
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(6, 22, 61)
  doc.text('CRONOS', x + 4, y + 30)
}

async function getLogoDataUrl() {
  if (logoDataUrl !== undefined) return logoDataUrl
  logoDataUrl = EMBEDDED_PDF_LOGO
  return logoDataUrl
}

function drawKeyValue(doc: JsPdf, startY: number, rows: string[][]) {
  const visibleRows = rows.filter(([, value]) => value)
  const preparedRows = visibleRows.map(([label, value]) => ({
    label,
    value: doc.splitTextToSize(String(value), 338),
  }))
  const cardHeight = Math.max(42, 22 + preparedRows.reduce((total, row) => total + Math.max(16, row.value.length * 11), 0))
  doc.setFillColor(248, 251, 255)
  doc.setDrawColor(222, 229, 238)
  doc.roundedRect(36, startY - 18, 540, cardHeight, 4, 4, 'FD')
  let y = startY
  preparedRows.forEach(({ label, value }) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(82, 97, 121)
    doc.text(label.toUpperCase(), 52, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(7, 27, 73)
    doc.text(value, 176, y)
    y += Math.max(16, value.length * 11)
  })
  return startY + cardHeight + 8
}

function drawQuoteLines(doc: JsPdf, startY: number, quote: CustomerQuote) {
  let y = drawTableHeader(doc, startY, ['Line', 'Part', 'Description', 'Qty', 'Unit', 'Extended'])
  quote.lines.forEach(line => {
    const totals = calculateLineTotals(line)
    const partLines = AtlasWrappedText(doc, line.partNumber || '-', 72)
    const descriptionLines = AtlasWrappedText(doc, line.description || '-', 188)
    const rowHeight = getPdfRowHeight(partLines, descriptionLines)
    y = AtlasPageBreakHandler(doc, y, rowHeight)
    drawTableRow(doc, y, rowHeight)
    doc.text(String(quote.lines.indexOf(line) + 1), 40, y + 16)
    doc.text(partLines, 76, y + 16)
    doc.text(descriptionLines, 158, y + 16)
    doc.text(String(line.quantity), 362, y + 16)
    doc.text(currency(totals.sellPrice), 404, y + 16)
    doc.text(currency(totals.extendedSellPrice), 488, y + 16)
    y += rowHeight
  })
  return y
}

function drawPoLines(doc: JsPdf, startY: number, po: PurchaseOrder | ProjectPurchaseOrder, trackingOnly = false) {
  const headers = trackingOnly
    ? ['Line', 'Part', 'Description', 'Qty', 'Status', 'Tracking']
    : ['Line', 'Part', 'Description', 'Qty', 'Unit', 'Extended']
  let y = drawTableHeader(doc, startY, headers)
  po.lines.forEach((line, index) => {
    const partLines = AtlasWrappedText(doc, line.partNumber || '-', 72)
    const descriptionLines = AtlasWrappedText(doc, line.description || '-', 188)
    const statusLines = trackingOnly ? AtlasWrappedText(doc, line.status || '-', 72) : []
    const trackingLines = trackingOnly ? AtlasWrappedText(doc, line.trackingNumber || '-', 80) : []
    const rowHeight = getPdfRowHeight(partLines, descriptionLines, statusLines, trackingLines)
    y = AtlasPageBreakHandler(doc, y, rowHeight)
    drawTableRow(doc, y, rowHeight)
    doc.text(String(index + 1), 40, y + 16)
    doc.text(partLines, 76, y + 16)
    doc.text(descriptionLines, 158, y + 16)
    doc.text(String(line.quantityOrdered), 362, y + 16)
    if (trackingOnly) {
      doc.text(statusLines, 404, y + 16)
      doc.text(trackingLines, 488, y + 16)
    } else {
      doc.text(currency(line.unitCost), 404, y + 16)
      doc.text(currency(line.unitCost * line.quantityOrdered), 488, y + 16)
    }
    y += rowHeight
  })
  return y
}

function drawTableHeader(doc: JsPdf, y: number, headers: string[]) {
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.setFillColor(6, 22, 61)
  doc.roundedRect(36, y - 14, 540, 24, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  const x = [40, 76, 158, 362, 404, 488]
  headers.forEach((header, index) => doc.text(header, x[index], y))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  return y + 28
}

function drawTotals(doc: JsPdf, startY: number, rows: string[][]) {
  const boxHeight = 30 + rows.length * 20
  doc.setFillColor(248, 251, 255)
  doc.setDrawColor(222, 229, 238)
  doc.roundedRect(366, startY, 210, boxHeight, 4, 4, 'FD')
  doc.setFillColor(6, 22, 61)
  doc.roundedRect(366, startY, 210, 24, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Cost Summary', 386, startY + 16)

  let y = startY + 42
  rows.forEach(([label, value], index) => {
    const isTotal = index === rows.length - 1
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...(isTotal ? TEXT : MUTED))
    doc.text(label, 386, y)
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT)
    doc.text(value, 560, y, { align: 'right' })
    if (!isTotal && index === rows.length - 2) {
      doc.setDrawColor(...LINE)
      doc.line(386, y + 8, 558, y + 8)
    }
    y += 20
  })
}

function getPdfRowHeight(...columns: string[][]) {
  const lineCount = Math.max(1, ...columns.map(column => column.length))
  return Math.max(34, 18 + lineCount * 10)
}

function drawTableRow(doc: JsPdf, y: number, height: number) {
  doc.setFillColor(255, 255, 255)
  doc.rect(36, y, 540, height, 'F')
  doc.setDrawColor(230, 235, 243)
  doc.line(36, y + height, 576, y + height)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(7, 27, 73)
}

function AtlasDocumentFooter(doc: JsPdf) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    const height = doc.internal.pageSize.getHeight()
    const width = doc.internal.pageSize.getWidth()
    doc.setDrawColor(222, 229, 238)
    doc.line(40, height - 34, width - 40, height - 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(82, 97, 121)
    doc.text('Cronos LLC', 40, height - 18)
    doc.text(`Page ${page} of ${pages}`, width - 40, height - 18, { align: 'right' })
  }
}

function AtlasPageBreakHandler(doc: JsPdf, y: number, rowHeight = 30) {
  if (y + rowHeight < PAGE_BOTTOM) return y
  doc.addPage()
  return 54
}

function drawTrackingReportHeader(doc: JsPdf, y: number) {
  doc.setFillColor(6, 22, 61)
  doc.rect(42, y, 720, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.text('#', 48, y + 17)
  doc.text('PO Number', 68, y + 17)
  doc.text('Vendor', 158, y + 17)
  doc.text('Vendor Order', 222, y + 17)
  doc.text('Part Number', 296, y + 17)
  doc.text('Description', 384, y + 17)
  doc.text('Qty', 516, y + 17, { align: 'center' })
  doc.text('Carrier', 534, y + 17)
  doc.text('Tracking', 590, y + 17)
  doc.text('Ship / Delivery', 708, y + 17)
  return y + 30
}

function drawTrackingReportFooter(doc: JsPdf) {
  doc.setDrawColor(222, 229, 238)
  doc.line(42, 560, 762, 560)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(82, 97, 121)
  doc.text('CRONOS LLC', 762, 574, { align: 'right' })
}

function formatMaybeDate(value: string | undefined) {
  return value ? new Intl.DateTimeFormat('en-US').format(new Date(value)) : 'Pending'
}

function splitTrackingReportValue(doc: JsPdf, value: string, width: number) {
  const cleaned = value.trim() || 'Pending'
  if (cleaned === 'Pending') return ['Pending']

  return cleaned
    .split(/[;,]\s*|\s{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .flatMap(part => AtlasWrappedText(doc, part, width))
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-')
}
