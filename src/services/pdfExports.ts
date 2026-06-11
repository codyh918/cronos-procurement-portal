import type { CustomerQuote, Project, ProjectPurchaseOrder, PurchaseOrder } from '../types'
import { calculateLineTotals, calculateQuoteSummary, currency } from './calculations'
import { getCheckbookSummary } from './checkbook'

type JsPdf = import('jspdf').jsPDF
let logoDataUrl: string | null | undefined

export async function exportCustomerQuotePdf(quote: CustomerQuote, project?: Project) {
  const doc = await createDocument()
  let y = await drawHeader(doc, 'Customer Quote')
  y = drawKeyValue(doc, y, [
    ['Quote #', quote.quoteNumber],
    ['Project', `${quote.projectNumber} - ${quote.projectName}`],
    ['Customer', quote.customer],
    ['Expires', `${quote.expirationDays ?? 30} days from issue`],
    ['Contact', project?.customerContactName || ''],
    ['Email', project?.customerEmail || ''],
  ])

  y = drawQuoteLines(doc, y + 8, quote)
  const summary = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)
  drawTotals(doc, y + 10, [
    ['Line Item Total', currency(summary.totalSellPrice)],
    ['Contract Fee', currency(summary.contractFee)],
    ['Shipping', currency(summary.shippingCost)],
    ['Quote Total', currency(summary.customerTotal)],
  ])
  doc.save(`${quote.quoteNumber}.pdf`)
}

export async function exportPurchaseOrderPdf(po: PurchaseOrder | ProjectPurchaseOrder, project?: Project) {
  const doc = await createDocument()
  let y = await drawHeader(doc, 'Purchase Order')
  y = drawKeyValue(doc, y, [
    ['PO #', po.poNumber],
    ['Vendor', po.vendor],
    ['Project', project ? `${project.projectNumber} - ${project.projectName}` : 'projectNumber' in po ? `${po.projectNumber} - ${po.projectName}` : ''],
    ['Date Issued', po.dateIssued],
    ['Status', po.status],
    ['Requestor', po.requestor ?? project?.projectManager ?? ''],
  ])

  y = drawPoLines(doc, y + 8, po)
  drawTotals(doc, y + 10, [['Total Cost', currency(po.totalCost)]])
  doc.save(`${po.poNumber}.pdf`)
}

export async function exportCustomerTrackingUpdatePdf(po: PurchaseOrder | ProjectPurchaseOrder, project?: Project) {
  const doc = await createDocument()
  let y = await drawHeader(doc, 'Customer Tracking Update')
  y = drawKeyValue(doc, y, [
    ['PO #', po.poNumber],
    ['Project', project ? `${project.projectNumber} - ${project.projectName}` : 'projectNumber' in po ? `${po.projectNumber} - ${po.projectName}` : ''],
    ['Vendor', po.vendor],
    ['Status', po.status],
    ['Carrier', po.carrier ?? ''],
    ['Tracking', po.trackingNumber ?? ''],
    ['Estimated Ship', po.estimatedShipDate ?? ''],
    ['Estimated Delivery', po.expectedDeliveryDate ?? ''],
  ])

  if (po.customerUpdateNotes) {
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Update Notes', 40, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(po.customerUpdateNotes, 520), 40, y + 26)
    y += 58
  }

  drawPoLines(doc, y + 8, po, true)
  doc.save(`${po.poNumber}-customer-update.pdf`)
}

export async function exportCheckbookReportPdf(project: Project) {
  const summary = getCheckbookSummary(project)
  const doc = await createDocument()
  let y = await drawHeader(doc, 'Checkbook Financial Report')
  y = drawKeyValue(doc, y, [
    ['Project', `${project.projectNumber} - ${project.projectName}`],
    ['Customer', project.customer],
    ['Starting Balance', currency(summary.startingBalance)],
    ['Cost to Customer', currency(summary.customerCost)],
    ['Remaining Balance', currency(summary.remainingBalance)],
    ['Cronos Cost', currency(summary.ourCost)],
    ['Gross Profit', currency(summary.grossProfit)],
  ])

  y = drawTableHeader(doc, y + 16, ['PO #', 'Vendor', 'Description', 'Cost', 'Customer', 'Profit'])
  summary.lines.forEach(line => {
    y = ensurePage(doc, y)
    doc.text(line.poNumber, 40, y)
    doc.text(line.vendor || '-', 106, y)
    doc.text(doc.splitTextToSize(line.description || '-', 170), 174, y)
    doc.text(currency(line.ourCost), 362, y)
    doc.text(currency(line.customerCost), 434, y)
    doc.text(currency(line.grossProfit), 520, y)
    y += 32
  })

  doc.save(`${project.projectNumber}-checkbook-report.pdf`)
}

export async function exportCustomerConsolidatedTrackingReportPdf(project: Project) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  const rows = project.purchaseOrders.flatMap(po =>
    po.lines.map((line, index) => ({
      itemNumber: line.itemNumber || String(index + 1),
      poNumber: po.poNumber,
      vendor: po.vendor,
      vendorOrderNumber: line.vendorOrderNumber ?? '',
      partNumber: line.partNumber,
      description: line.description,
      quantity: line.quantityOrdered,
      carrier: line.carrier || po.carrier || '',
      trackingNumber: line.trackingNumber || po.trackingNumber || '',
      estimatedShipDate: line.estimatedShipDate || po.estimatedShipDate || '',
      receivedDate: line.receivedDate || po.expectedDeliveryDate || '',
      status: line.status,
    })),
  )

  await drawLandscapeReportHeader(doc, 'Consolidated Shipping Tracking Report')
  doc.setFontSize(10)
  doc.text(`Project: ${project.projectNumber}`, 42, 70)
  doc.text(`Customer: ${project.customer}`, 42, 86)
  doc.text(`Date: ${new Intl.DateTimeFormat('en-US').format(new Date())}`, 42, 102)

  const received = rows.filter(row => row.receivedDate).length
  const tracking = rows.filter(row => row.trackingNumber).length
  const summary = [
    ['Tracked Lines', String(rows.length)],
    ['Tracking Entered', String(tracking)],
    ['Received', String(received)],
    ['Pending', String(rows.length - received)],
  ]

  doc.setDrawColor(222, 229, 238)
  doc.setFillColor(248, 251, 255)
  doc.roundedRect(42, 126, 720, 58, 4, 4, 'FD')
  summary.forEach(([label, value], index) => {
    const x = 58 + index * 172
    doc.setFontSize(8)
    doc.setTextColor(82, 97, 121)
    doc.text(label, x, 148)
    doc.setFontSize(15)
    doc.setTextColor(6, 22, 61)
    doc.text(value, x, 170)
  })

  let y = drawTrackingReportHeader(doc, 210)
  rows.forEach((row, index) => {
    const descriptionLines = doc.splitTextToSize(row.description || '-', 146).slice(0, 3)
    const partLines = doc.splitTextToSize(row.partNumber || '-', 82).slice(0, 2)
    const trackingLines = doc.splitTextToSize(row.trackingNumber || 'Pending', 94).slice(0, 2)
    const rowHeight = Math.max(42, 18 + Math.max(descriptionLines.length, partLines.length, trackingLines.length) * 10)

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
    doc.text(row.poNumber, 68, y + 17)
    doc.text(row.vendor, 164, y + 17)
    doc.text(row.vendorOrderNumber || 'Pending', 228, y + 17)
    doc.text(partLines, 300, y + 17)
    doc.text(descriptionLines, 388, y + 17)
    doc.text(String(row.quantity), 540, y + 17, { align: 'center' })
    doc.text(row.carrier || 'Pending', 568, y + 17)
    doc.text(trackingLines, 632, y + 17)
    doc.text(formatMaybeDate(row.estimatedShipDate), 728, y + 17, { align: 'right' })
    doc.text(formatMaybeDate(row.receivedDate), 782, y + 17, { align: 'right' })
    doc.text(getTrackingLineStatus(row), 786, y + 31)
    y += rowHeight
  })

  drawTrackingReportFooter(doc)
  doc.save(`Cronos-${sanitizeFileName(project.projectNumber)}-Customer-Tracking-Report.pdf`)
}

async function createDocument() {
  const { default: jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'pt', format: 'letter' })
}

async function drawHeader(doc: JsPdf, title: string) {
  doc.setFillColor(6, 22, 61)
  doc.rect(0, 0, 612, 78, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(34, 12, 132, 54, 4, 4, 'F')
  doc.setFillColor(28, 116, 222) doc.circle(62, 38, 16, 'F') doc.setFillColor(255, 255, 255) doc.circle(67, 38, 9, 'F') doc.rect(67, 30, 14, 16, 'F') doc.setFont('helvetica', 'bold') doc.setFontSize(19) doc.setTextColor(6, 22, 61) doc.text('CRONOS', 86, 45)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFontSize(18)
  doc.text(title, 360, 44)
  doc.setTextColor(7, 27, 73)
  doc.setFontSize(10)
  return 104
}

async function drawLandscapeReportHeader(doc: JsPdf, title: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(6, 22, 61)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(36, 14, 132, 54, 4, 4, 'F')
  doc.setDrawColor(222, 229, 238)
  doc.roundedRect(36, 14, 132, 54, 4, 4)
  await drawLogo(doc, 42, 18, 120, 46)
  doc.text(title, 176, 46)
  doc.setFontSize(8)
  doc.setTextColor(82, 97, 121)
  doc.setTextColor(6, 22, 61)
}

async function drawLogo(doc: JsPdf, x: number, y: number, width: number, height: number) {
  const logo = await getLogoDataUrl()
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', x, y, width, height, undefined, 'FAST')
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

  try {
    const response = await fetch('/cronos-logo-pdf.jpg')
    if (!response.ok) throw new Error('Logo image unavailable')
    const blob = await response.blob()
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    logoDataUrl = null
  }

  return logoDataUrl
}

function drawKeyValue(doc: JsPdf, startY: number, rows: string[][]) {
  let y = startY
  rows.filter(([, value]) => value).forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 40, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value), 170, y)
    y += 16
  })
  return y
}

function drawQuoteLines(doc: JsPdf, startY: number, quote: CustomerQuote) {
  let y = drawTableHeader(doc, startY, ['CLIN', 'Part', 'Description', 'Qty', 'Unit', 'Extended'])
  quote.lines.forEach(line => {
    const totals = calculateLineTotals(line)
    const partLines = doc.splitTextToSize(line.partNumber || '-', 72)
    const descriptionLines = doc.splitTextToSize(line.description || '-', 188)
    const rowHeight = getPdfRowHeight(partLines, descriptionLines)
    y = ensurePage(doc, y, rowHeight)
    drawTableRow(doc, y, rowHeight)
    doc.text(line.clin, 40, y + 16)
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
    ? ['CLIN', 'Part', 'Description', 'Qty', 'Status', 'Tracking']
    : ['CLIN', 'Part', 'Description', 'Qty', 'Unit', 'Extended']
  let y = drawTableHeader(doc, startY, headers)
  po.lines.forEach(line => {
    const partLines = doc.splitTextToSize(line.partNumber || '-', 72)
    const descriptionLines = doc.splitTextToSize(line.description || '-', 188)
    const statusLines = trackingOnly ? doc.splitTextToSize(line.status || '-', 72) : []
    const trackingLines = trackingOnly ? doc.splitTextToSize(line.trackingNumber || po.trackingNumber || '-', 80) : []
    const rowHeight = getPdfRowHeight(partLines, descriptionLines, statusLines, trackingLines)
    y = ensurePage(doc, y, rowHeight)
    drawTableRow(doc, y, rowHeight)
    doc.text(line.clin, 40, y + 16)
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
  doc.setTextColor(7, 27, 73)
  doc.setFillColor(249, 251, 253)
  doc.rect(36, y - 14, 540, 24, 'F')
  doc.setDrawColor(222, 229, 238)
  doc.line(36, y + 12, 576, y + 12)
  doc.setFont('helvetica', 'bold')
  const x = [40, 76, 158, 362, 404, 488]
  headers.forEach((header, index) => doc.text(header, x[index], y))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  return y + 28
}

function drawTotals(doc: JsPdf, startY: number, rows: string[][]) {
  let y = startY
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 386, y)
    doc.text(value, 500, y)
    y += 18
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

function ensurePage(doc: JsPdf, y: number, rowHeight = 30) {
  if (y + rowHeight < 740) return y
  doc.addPage()
  return 54
}

function drawTrackingReportHeader(doc: JsPdf, y: number) {
  doc.setFillColor(6, 22, 61)
  doc.rect(42, y, 720, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.text('#', 48, y + 17)
  doc.text('PO Number', 68, y + 17)
  doc.text('Vendor', 164, y + 17)
  doc.text('Vendor Order', 228, y + 17)
  doc.text('Part Number', 300, y + 17)
  doc.text('Description', 388, y + 17)
  doc.text('Qty', 540, y + 17, { align: 'center' })
  doc.text('Carrier', 568, y + 17)
  doc.text('Tracking', 632, y + 17)
  doc.text('ESD', 728, y + 17, { align: 'right' })
  doc.text('Received', 782, y + 17, { align: 'right' })
  return y + 30
}

function drawTrackingReportFooter(doc: JsPdf) {
  doc.setDrawColor(222, 229, 238)
  doc.line(42, 560, 762, 560)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(82, 97, 121)
  doc.text('Customer-facing logistics report. Pricing and Cronos internal cost information intentionally omitted.', 42, 574)
  doc.text('CRONOS LLC', 762, 574, { align: 'right' })
}

function formatMaybeDate(value: string | undefined) {
  return value ? new Intl.DateTimeFormat('en-US').format(new Date(value)) : 'Pending'
}

function getTrackingLineStatus(row: { receivedDate: string; trackingNumber: string; estimatedShipDate: string }) {
  if (row.receivedDate) return 'Received'
  if (row.trackingNumber) return 'Shipped'
  if (row.estimatedShipDate) return 'Pending ship'
  return 'Pending'
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-')
}
