import type { CustomerQuote, Project, ProjectPurchaseOrder, PurchaseOrder } from '../types'
import { calculateLineTotals, calculateQuoteSummary, currency } from './calculations'
import { getCheckbookSummary } from './checkbook'

type JsPdf = import('jspdf').jsPDF
let logoDataUrl: string | null | undefined
const EMBEDDED_PDF_LOGO = 'data:image/jpeg;base64,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4LdaN8Dj7R+9kg52u3Fa0Xq3K10N4oX0dwpYqqnfvZI3MdfQelWmm4jkw+7frH1aOfRUyda9JZDCkFbOLdCk9OX1eGpTPHvNJK7xx8F3L1Hb0lVZU0tRRVL6aqgkp54zk6ORpa5vWCukwajHnjekqXLhvina0IBSCiFILahglMKYUAphThBMKQUQpBThFMKQUQpBThGUwpjeoBTG9ThGUgphQC7jA2AJ8QSsrrgx0NsacxnsdP0Do6e5QzZ8enpOTJO0J4sVstuSkdX0dGGEHVtW2+1seVNAf7u1w/xHj33UPr6lbyhDDHTwMhhY2OKNoa1rRkGgbgFNcBrdXbV5ZyW7eUfCHWabT109OSPxERFptkREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAXx8QYUs2J6birpRMmcBkyUeLIzqcNv4L7CKVbWpPNWdpeWrFo2mFFYl0L3S3F89kmFypxt4p2TZmj6nebqVdVFNPR1DqeqgkgmZsdHI0tcOwrXS+deMP2m/wBPxNzoIapvIXt8ZvU7eOxXWn4venTLG8fVWZuHVt1xzsyoFMK471oQpZC6Sy3F9OeSGpGu3scNo7iuGuejbFVqJL7W+pjHv6YiQdw2+ZXmHX6fL2t+fRV5NLlx96uYCkFKemqKWQsqIJYXDeJGFp86gHDnCsInfs056PIFIL+RMfK8Nja6Rx3BozK6S1YCxLdi0w2uWKM/5lR7E3z7T2BeXy0xxveYj5va0tedqxu58L27fb6y6VbaahppKmZ25kbcz1nmHSVaNk0NQRFst6rzMRtMNP4re1x2nsAVh2yz2+zUop7dSRU0fKGN2nrO89qqdRxrFj6Yo5p+iww8MyX65OkfVwWE9FMVI5lZfyyolG1tK05saf5j77q3daslrWsaGtAa1oyAAyAC/qLl9RqsuptzZJ3XuHBTDXlpAiItZmEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREEZIo5W6skbXjmcM16ps9sLszbqQnn4lv5L3EXsWmO0vJiJ7vFDS09P/gwRRfAYG/UvKiJM793vYREXgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICIiAiIgIiICrrHem/COBKiShqaiS4XJmx1JSAOLDz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'

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
  drawLogoMark(doc, 44, 20)
  doc.setTextColor(255, 255, 255)
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
  drawLogoMark(doc, 46, 22)
  doc.text(title, 176, 46)
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
  logoDataUrl = EMBEDDED_PDF_LOGO
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
