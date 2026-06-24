import type { CustomerQuote, Project, PurchaseOrderLine, QuoteLine, Status } from '../types'
import { calculateLineTotals, calculateQuoteSummary } from './calculations'
import { getCheckbookSummary } from './checkbook'

const CRONOS_CAGE_CODE = '8NPB1'
const CRONOS_POC_EMAIL = 'cody.hibbard@cronosllc.com'
const CRONOS_POC_PHONE = '(352) 464-4046'

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
  image?: 'cronosLogo'
}

type TrackingWorkbookLine = PurchaseOrderLine & {
  poNumber: string
  poStatus: Status
  vendor: string
}

export async function exportProjectTrackingWorkbook(project: Project) {
  const lines = getTrackingWorkbookLines(project)
  const generatedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
  const isCheckbook = project.projectType === 'Checkbook'

  await downloadWorkbook(
    [
      buildTrackingSummarySheet(project, lines, generatedDate, isCheckbook),
      buildTrackingDetailSheet(project, lines),
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
        ],
      },
      {
        name: 'PO Detail',
        rows: [
          ['PO #', 'Quote #', 'Vendor', 'Description', 'Requestor', 'Date Issued', 'Cost to Customer'],
          ...summary.lines.map(line => [
            line.poNumber,
            line.quoteNumber,
            line.vendor,
            line.description,
            line.requestor,
            line.dateIssued,
            line.customerCost,
          ]),
        ],
      },
    ],
    `Cronos-${sanitizeFileName(project.projectNumber)}-Checkbook-Tracking.xlsx`,
  )
}

export async function exportCustomerQuoteWorkbook(quote: CustomerQuote, project?: Project) {
  const summary = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)
  const startRow = 18
  const lineRows = quote.lines.map((line, index) => {
    const rowNumber = startRow + index
    const totals = calculateLineTotals(line)
    return [
      { value: index + 1, style: 6 },
      { value: line.manufacturer || '', style: 6 },
      { value: line.clin || '', style: 6 },
      { value: line.quantity || 0, style: 6 },
      { value: line.partNumber || '', style: 6 },
      { value: line.description || '', style: 7 },
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
        columnWidths: [1, 8, 14, 17, 8, 17, 52, 15, 17],
        merges: ['B11:C11', 'D11:F11', 'G11:G11', 'H11:I11', 'B12:C12', 'D12:F12', 'G12:G12', 'H12:I12', 'B13:C13', 'D13:F13', 'G13:G13', 'H13:I13'],
        rows: [
          [],
          [],
          ['', '', '', '', { value: 'CRONOS LLC', style: 1 }],
          ['', '', '', '', { value: '4301 Evans to Locks Road', style: 2 }, '', { value: 'Quote Number:', style: 3 }, { value: quote.quoteNumber, style: 4 }],
          ['', '', '', '', { value: 'Evans, GA 30809', style: 2 }, '', { value: 'Quote Name:', style: 3 }, { value: quote.quoteName || '-', style: 4 }],
          ['', '', '', '', { value: `Cage Code: ${CRONOS_CAGE_CODE}`, style: 2 }, '', { value: 'Date:', style: 3 }, { value: formatDateForWorkbook(quote.createdAt), style: 4 }],
          ['', '', '', '', { value: 'cronosllc.com', style: 2 }, '', { value: 'Expires:', style: 3 }, { value: getQuoteExpirationDateForWorkbook(quote), style: 4 }],
          [],
          ['', '', '', '', { value: `Project: ${quote.projectNumber} - ${quote.projectName}`, style: 5 }],
          [],
          ['', { value: 'Customer Account:', style: 3 }, '', { value: quote.customer || project?.customer || '', style: 4 }, '', '', { value: 'Cronos POC:', style: 3 }, { value: project?.projectManager || 'Cody Hibbard', style: 4 }],
          ['', { value: 'Customer Name:', style: 3 }, '', { value: project?.customerContactName || '', style: 4 }, '', '', { value: 'Email:', style: 3 }, { value: CRONOS_POC_EMAIL, style: 4 }],
          ['', { value: 'Customer Email:', style: 3 }, '', { value: project?.customerEmail || '', style: 4 }, '', '', { value: 'Direct Phone:', style: 3 }, { value: CRONOS_POC_PHONE, style: 4 }],
          [],
          [],
          ['', { value: 'Line', style: 9 }, { value: 'Manufacturer', style: 9 }, { value: 'CLIN', style: 9 }, { value: 'QTY', style: 9 }, { value: 'Part #', style: 9 }, { value: 'Description', style: 9 }, { value: 'Unit Cost', style: 9 }, { value: 'Extended Cost', style: 9 }],
          [],
          ...lineRows.map(row => ['', ...row]),
          [],
          ['', '', '', '', '', '', { value: 'Line Item Total', style: 10 }, '', { formula: `SUM(I${startRow}:I${startRow + Math.max(lineRows.length - 1, 0)})`, value: summary.totalSellPrice, style: 11 }],
          ['', '', '', '', '', '', { value: 'Contract Fee', style: 10 }, '', { value: summary.contractFee, style: 11 }],
          ['', '', '', '', '', '', { value: 'Shipping', style: 10 }, '', { value: summary.shippingCost, style: 11 }],
          ['', '', '', '', '', '', { value: 'Quote Total', style: 12 }, '', { formula: `I${totalRow}+I${totalRow + 1}+I${totalRow + 2}`, value: summary.customerTotal, style: 13 }],
        ],
      },
    ],
    `Cronos-${sanitizeFileName(quote.quoteNumber)}-Quote.xlsx`,
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

function buildVendorRfqRows(project: Project, vendor: string, lines: QuoteLine[]) {
  return [
    [{ value: 'CRONOS LLC', style: 14 }],
    [{ value: 'Vendor Request for Quote', style: 15 }],
    [{ value: 'Please complete Vendor Quote #, Vendor Unit Cost, Lead Time, and Notes, then return this workbook to Cronos.', style: 22 }],
    [],
    [{ value: `Project: ${project.projectNumber} - ${project.projectName}`, style: 22 }],
    [{ value: `Vendor: ${vendor}`, style: 22 }],
    [{ value: `RFQ Date: ${new Date().toLocaleDateString('en-US')}`, style: 19 }],
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
    ].map(value => ({ value, style: 18 })),
    ...lines.map(line => [
      { value: line.clin, style: 19 },
      { value: line.partNumber, style: 19 },
      { value: line.manufacturer, style: 19 },
      { value: line.description, style: 22 },
      { value: line.quantity, style: 19 },
      { value: vendor, style: 22 },
      { value: '', style: 19 },
      { value: '', style: 20 },
      { value: line.leadTime || '', style: 19 },
      { value: '', style: 22 },
    ]),
  ]
}

function buildTrackingSummarySheet(project: Project, lines: TrackingWorkbookLine[], generatedDate: string, includeCosts: boolean): WorkbookSheet {
  const projectCost = includeCosts ? getCheckbookSummary(project).customerCost : 0
  const headers = includeCosts
    ? ['Project Tab', 'Line Items', 'Received', 'Tracking Provided', 'Scheduled', 'Pending Update', 'Project Cost']
    : ['Project Tab', 'Line Items', 'Received', 'Tracking Provided', 'Scheduled', 'Pending Update']
  const summaryRow: WorkbookCell[] = [
    sanitizeSheetName(project.projectNumber),
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

function buildTrackingDetailSheet(project: Project, lines: TrackingWorkbookLine[]): WorkbookSheet {
  const startRow = 6
  const rows: WorkbookCell[][] = [
    [{ value: project.projectNumber, style: 14 }],
    [{ value: 'Customer procurement line-item update', style: 15 }],
    [],
    [],
    [
      'Item No',
      'Part Number',
      'Manufacturer',
      'Description',
      'Quantity',
      'PO Number',
      'Vendor',
      'Vendor Order Number',
      'Tracking Number',
      'ESD',
      'Received Date',
      'Shipping Co',
      'Status',
    ].map(value => ({ value, style: 18 })),
    ...lines.map((line, index) => {
      const rowNumber = startRow + index
      const estimatedShipDate = formatDateForWorkbook(line.estimatedShipDate)
      const receivedDate = formatDateForWorkbook(line.receivedDate)
      return [
        { value: line.itemNumber || index + 1, style: 19 },
        { value: line.partNumber, style: 19 },
        { value: line.manufacturer ?? '', style: 19 },
        { value: line.description, style: 22 },
        { value: line.quantityOrdered, style: 19 },
        { value: line.poNumber, style: 19 },
        { value: line.vendor, style: 19 },
        { value: line.vendorOrderNumber ?? '', style: 19 },
        { value: line.trackingNumber ?? '', style: 19 },
        { value: estimatedShipDate, style: 19 },
        { value: receivedDate, style: 19 },
        { value: line.carrier ?? '', style: 19 },
        { formula: `IF(K${rowNumber}<>"","Received",IF(I${rowNumber}<>"","Tracking Provided",IF(J${rowNumber}<>"","Scheduled","Pending Update")))`, value: getTrackingWorkbookStatus(line), style: 19 },
      ]
    }),
  ]

  return {
    name: sanitizeSheetName(project.projectNumber),
    rows,
    columnWidths: [9, 18, 18, 48, 10, 24, 18, 20, 30, 14, 15, 15, 16],
    merges: ['A1:M1', 'A2:M2'],
    freezePane: 'A6',
  }
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

function worksheetXml(sheet: WorkbookSheet, sheetIndex: number, hasLogo: boolean) {
  const columnXml = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const sheetViewsXml = sheet.freezePane ? sheetViewsXmlForFreezePane(sheet.freezePane) : ''
  const mergeXml = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : ''
  const drawingXml = sheetIndex === 0 && sheet.image === 'cronosLogo' && hasLogo ? '<drawing r:id="rId1"/>' : ''
  const body = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => cellXml(cell, `${columnName(columnIndex + 1)}${rowIndex + 1}`))
        .join('')
      const height = worksheetRowHeight(row)
      return `<row r="${rowIndex + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`
    })
    .join('')

  return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${sheetViewsXml}${columnXml}<sheetData>${body}</sheetData>${mergeXml}${drawingXml}</worksheet>`)
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
  const value = normalized.value ?? ''
  return `<c r="${reference}"${style} t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`
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
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF06163D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border/>
    <border><left style="thin"><color rgb="FFD8DEE8"/></left><right style="thin"><color rgb="FFD8DEE8"/></right><top style="thin"><color rgb="FFD8DEE8"/></top><bottom style="thin"><color rgb="FFD8DEE8"/></bottom></border>
    <border><left style="medium"><color rgb="FF06163D"/></left><right style="medium"><color rgb="FF06163D"/></right><top style="medium"><color rgb="FF06163D"/></top><bottom style="medium"><color rgb="FF06163D"/></bottom></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="23">
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
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
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
    <xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>7</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
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
  if (line.receivedDate || line.status === 'Received') return 'Received'
  if (line.trackingNumber) return 'Tracking Provided'
  if (line.estimatedShipDate) return 'Scheduled'
  return 'Pending Update'
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
