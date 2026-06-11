import type { Project, PurchaseOrderLine, QuoteLine, Status } from '../types'
import { getCheckbookSummary } from './checkbook'

type WorkbookCell = string | number
type WorkbookSheet = {
  name: string
  rows: WorkbookCell[][]
}

type TrackingWorkbookLine = PurchaseOrderLine & {
  poNumber: string
  poStatus: Status
  vendor: string
}

export async function exportProjectTrackingWorkbook(project: Project) {
  const lines = getTrackingWorkbookLines(project)
  const generatedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  await downloadWorkbook(
    [
      {
        name: 'Summary',
        rows: [
          [`Tracking Report ${project.projectNumber}`],
          [`Customer procurement update | Generated ${generatedDate}`],
          [],
          ['Line Items', lines.length, 'Received', countReceived(lines), 'Tracking Provided', countTracking(lines), 'Scheduled', countScheduled(lines), 'Pending Update', countPending(lines)],
          [],
          ['Project Tab', 'Line Items', 'Received', 'Tracking Provided', 'Scheduled', 'Pending Update'],
          [project.projectNumber, lines.length, countReceived(lines), countTracking(lines), countScheduled(lines), countPending(lines)],
        ],
      },
      {
        name: sanitizeSheetName(project.projectNumber),
        rows: [
          [project.projectNumber],
          ['Customer procurement line-item update'],
          [],
          [],
          ['Item No', 'Part Number', 'Manufacturer', 'Description', 'Quantity', 'PO Number', 'Vendor', 'Vendor Order Number', 'Tracking Number', 'ESD', 'Received Date', 'Shipping Co', 'Status', 'Notes'],
          ...lines.map((line, index) => [
            line.itemNumber || index + 1,
            line.partNumber,
            line.manufacturer ?? '',
            line.description,
            line.quantityOrdered,
            line.poNumber,
            line.vendor,
            line.vendorOrderNumber ?? '',
            line.trackingNumber ?? '',
            formatDateForWorkbook(line.estimatedShipDate),
            formatDateForWorkbook(line.receivedDate),
            line.carrier ?? '',
            line.status,
            line.notes ?? '',
          ]),
        ],
      },
    ],
    `Cronos-${sanitizeFileName(project.projectNumber)}-Tracking-Report.xlsx`,
  )
}

export async function exportCheckbookFinancialWorkbook(project: Project) {
  const summary = getCheckbookSummary(project)
  await downloadWorkbook(
    [
      {
        name: 'Financial Summary',
        rows: [
          ['Project', project.projectNumber],
          ['Customer', project.customer],
          ['Starting Balance', summary.startingBalance],
          ['Cost to Customer', summary.customerCost],
          ['Remaining Balance', summary.remainingBalance],
          ['Cronos Cost', summary.ourCost],
          ['Gross Profit', summary.grossProfit],
        ],
      },
      {
        name: 'PO Detail',
        rows: [
          ['PO #', 'Quote #', 'Vendor', 'Description', 'Requestor', 'Date Issued', 'Cronos Cost', 'Cost to Customer', 'Gross Profit'],
          ...summary.lines.map(line => [
            line.poNumber,
            line.quoteNumber,
            line.vendor,
            line.description,
            line.requestor,
            line.dateIssued,
            line.ourCost,
            line.customerCost,
            line.grossProfit,
          ]),
        ],
      },
    ],
    `Cronos-${sanitizeFileName(project.projectNumber)}-Checkbook-Tracking.xlsx`,
  )
}

export async function exportVendorRfqPackage(project: Project, lines: QuoteLine[]) {
  const grouped = groupQuoteLinesByVendor(lines)
  const vendors = Object.entries(grouped)

  for (const [vendor, vendorLines] of vendors) {
    await downloadWorkbook(
      [
        {
          name: 'RFQ',
          rows: buildVendorRfqRows(project, vendor, vendorLines),
        },
      ],
      `Cronos-${sanitizeFileName(project.projectNumber)}-${sanitizeFileName(vendor)}-RFQ.xlsx`,
    )
  }

  return vendors.length
}

async function downloadWorkbook(sheets: WorkbookSheet[], fileName: string) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  zip.file('[Content_Types].xml', contentTypesXml(sheets))
  zip.file('_rels/.rels', rootRelsXml())
  zip.file('docProps/app.xml', appXml())
  zip.file('docProps/core.xml', coreXml())
  zip.file('xl/workbook.xml', workbookXml(sheets))
  zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml(sheets))
  zip.file('xl/styles.xml', stylesXml())
  sheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet.rows))
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

function buildVendorRfqRows(project: Project, vendor: string, lines: QuoteLine[]) {
  return [
    ['CRONOS LLC'],
    ['Vendor Request for Quote'],
    ['Please complete Vendor Quote #, Vendor Unit Cost, Lead Time, and Notes, then return this workbook to Cronos.'],
    [],
    [`Project: ${project.projectNumber} - ${project.projectName}`],
    [`Vendor: ${vendor}`],
    [`RFQ Date: ${new Date().toLocaleDateString('en-US')}`],
    [
      'CLIN',
      'Part Number',
      'Manufacturer',
      'Description',
      'Quantity',
      'Vendor',
      'Requested Vendor Quote #',
      'Vendor Unit Cost',
      'Lead Time',
      'Notes',
    ],
    ...lines.map(line => [
      line.clin,
      line.partNumber,
      line.manufacturer,
      line.description,
      line.quantity,
      vendor,
      '',
      '',
      line.leadTime || '',
      '',
    ]),
  ]
}

function getTrackingWorkbookLines(project: Project): TrackingWorkbookLine[] {
  return project.purchaseOrders.flatMap(po =>
    po.lines.map(line => ({
      ...line,
      poNumber: po.poNumber,
      poStatus: po.status,
      vendor: po.vendor,
      vendorOrderNumber: line.vendorOrderNumber,
      carrier: line.carrier || po.carrier,
      trackingNumber: line.trackingNumber || po.trackingNumber,
      estimatedShipDate: line.estimatedShipDate || po.estimatedShipDate,
      receivedDate: line.receivedDate || po.expectedDeliveryDate,
    })),
  )
}

function worksheetXml(rows: WorkbookCell[][]) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const reference = `${columnName(columnIndex + 1)}${rowIndex + 1}`
          if (typeof cell === 'number') return `<c r="${reference}"><v>${Number.isFinite(cell) ? cell : 0}</v></c>`
          return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`)
}

function workbookXml(sheets: WorkbookSheet[]) {
  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')

  return xmlHeader(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`)
}

function workbookRelsXml(sheets: WorkbookSheet[]) {
  const sheetRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('')

  return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
}

function contentTypesXml(sheets: WorkbookSheet[]) {
  const sheetTypes = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')

  return xmlHeader(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheetTypes}</Types>`)
}

function rootRelsXml() {
  return xmlHeader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
}

function stylesXml() {
  return xmlHeader('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>')
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

function formatDateForWorkbook(value: string | undefined) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function sanitizeSheetName(value: string) {
  return (value || 'Project').replace(/[\[\]:*?/\\]/g, '-').slice(0, 31)
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-')
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
