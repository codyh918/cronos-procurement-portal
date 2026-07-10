import type { UserSession } from '../types'
import { loadVendorDirectory, saveVendorDirectory, type VendorDirectoryRecord, type VendorStatus } from './vendorDirectory'

export type VendorImportIssue = {
  rowNumber: number
  column: string
  value: string
  problem: string
  suggestedFix: string
}

export type VendorImportPreview = {
  filename: string
  rows: VendorImportRow[]
  updated: VendorImportRow[]
  added: VendorImportRow[]
  duplicates: VendorImportRow[]
  errors: VendorImportIssue[]
  skipped: VendorImportRow[]
}

export type VendorImportRow = {
  rowNumber: number
  record: VendorDirectoryRecord
  match?: VendorDirectoryRecord
  action: 'update' | 'add' | 'duplicate' | 'error' | 'skip'
  issues: VendorImportIssue[]
}

export type VendorImportLog = {
  id: string
  date: string
  user: string
  filename: string
  updated: number
  added: number
  failed: number
  durationMs: number
}

const LOG_STORAGE_KEY = 'cronos.vendorImportLogs'
const VENDOR_HEADERS = [
  'Vendor ID',
  'Vendor Name',
  'DBA Name',
  'Status (Active/Inactive)',
  'Primary Contact',
  'Secondary Contact',
  'Email',
  'Phone',
  'Website',
  'Address Line 1',
  'Address Line 2',
  'City',
  'State',
  'ZIP Code',
  'Country',
  'Cage Code',
  'UEI',
  'DUNS (legacy)',
  'Tax ID',
  'Payment Terms',
  'Lead Time',
  'Preferred Vendor (Yes/No)',
  'Manufacturer Authorization',
  'Small Business Type',
  'Notes',
  'Last Updated',
  'Created Date',
] as const

export async function exportVendorWorkbook(user?: UserSession, template = false) {
  const rows = template ? [exampleVendor()] : loadVendorDirectory().filter(vendor => vendor.status !== 'Inactive')
  await downloadWorkbook(
    [
      buildVendorSheet(rows, user?.name ?? 'Atlas User', template),
      ...(template ? [buildInstructionsSheet()] : []),
    ],
    template ? 'Atlas-Vendor-Import-Template.xlsx' : 'Atlas-Vendor-Master.xlsx',
  )
}

export async function previewVendorImport(file: File): Promise<VendorImportPreview> {
  const started = performance.now()
  const rows = await parseVendorWorkbook(file)
  const existing = loadVendorDirectory()
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const previewRows = rows.map(row => classifyVendorRow(row, existing, seenIds, seenNames))
  const preview = {
    filename: file.name,
    rows: previewRows,
    updated: previewRows.filter(row => row.action === 'update'),
    added: previewRows.filter(row => row.action === 'add'),
    duplicates: previewRows.filter(row => row.action === 'duplicate'),
    errors: previewRows.flatMap(row => row.issues),
    skipped: previewRows.filter(row => row.action === 'skip' || row.action === 'error'),
  }
  void started
  return preview
}

export function confirmVendorImport(preview: VendorImportPreview, options: { allowBlankOverwrite: boolean; user?: UserSession }) {
  const started = performance.now()
  const existing = loadVendorDirectory()
  const next = [...existing]
  let updated = 0
  let added = 0
  const now = new Date().toISOString()

  preview.rows.filter(row => row.action === 'update' || row.action === 'add').forEach(row => {
    if (row.action === 'update' && row.match) {
      const index = next.findIndex(vendor => vendor.vendorId === row.match?.vendorId || normalizeComparable(vendor.vendor) === normalizeComparable(row.match?.vendor ?? ''))
      if (index >= 0) {
        next[index] = mergeVendor(next[index], row.record, options.allowBlankOverwrite, now)
        updated += 1
      }
      return
    }

    next.push({
      ...row.record,
      vendorId: row.record.vendorId || `V-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdDate: now,
      createdBy: options.user?.name ?? 'Atlas User',
      lastUpdated: now,
    })
    added += 1
  })

  saveVendorDirectory(next)
  const log: VendorImportLog = {
    id: crypto.randomUUID(),
    date: now,
    user: options.user?.name ?? 'Atlas User',
    filename: preview.filename,
    updated,
    added,
    failed: preview.errors.length,
    durationMs: Math.round(performance.now() - started),
  }
  saveVendorImportLog(log)
  return log
}

export function loadVendorImportLogs(): VendorImportLog[] {
  try {
    return JSON.parse(window.localStorage.getItem(LOG_STORAGE_KEY) ?? '[]') as VendorImportLog[]
  } catch {
    return []
  }
}

export async function exportVendorImportErrors(errors: VendorImportIssue[]) {
  await downloadWorkbook(
    [
      {
        name: 'Vendor Import Errors',
        rows: [
          ['Row Number', 'Column', 'Current Value', 'Problem', 'Suggested Fix'].map(value => ({ value, style: 18 })),
          ...errors.map(error => [
            { value: error.rowNumber, style: 19 },
            { value: error.column, style: 19 },
            { value: error.value, style: 19 },
            { value: error.problem, style: 22 },
            { value: error.suggestedFix, style: 22 },
          ]),
        ],
        columnWidths: [12, 24, 30, 48, 48],
        freezePane: 'A2',
        autoFilter: `A1:E${Math.max(1, errors.length + 1)}`,
      },
    ],
    'Vendor Import Errors.xlsx',
  )
}

export async function exportVendorImportLog(logs: VendorImportLog[]) {
  await downloadWorkbook(
    [
      {
        name: 'Vendor Import Log',
        rows: [
          ['Date', 'User', 'Filename', 'Updated', 'Added', 'Failed', 'Duration (ms)'].map(value => ({ value, style: 18 })),
          ...logs.map(log => [
            { value: log.date, style: 19 },
            { value: log.user, style: 19 },
            { value: log.filename, style: 19 },
            { value: log.updated, style: 19 },
            { value: log.added, style: 19 },
            { value: log.failed, style: 19 },
            { value: log.durationMs, style: 19 },
          ]),
        ],
        columnWidths: [26, 22, 38, 12, 12, 12, 16],
        freezePane: 'A2',
        autoFilter: `A1:G${Math.max(1, logs.length + 1)}`,
      },
    ],
    'Vendor Import Log.xlsx',
  )
}

function classifyVendorRow(row: { rowNumber: number; values: Record<string, string> }, existing: VendorDirectoryRecord[], seenIds: Set<string>, seenNames: Set<string>): VendorImportRow {
  const record = rowToVendor(row.values)
  const issues = validateVendorRow(row.rowNumber, record, seenIds, seenNames)
  const match = findVendorMatch(record, existing)
  if (issues.length) return { rowNumber: row.rowNumber, record, match, action: 'error', issues }
  if (!record.vendor.trim()) return { rowNumber: row.rowNumber, record, action: 'skip', issues: [] }
  if (!match && likelyDuplicate(record, existing)) return { rowNumber: row.rowNumber, record, action: 'duplicate', issues: [] }
  return { rowNumber: row.rowNumber, record, match, action: match ? 'update' : 'add', issues: [] }
}

function validateVendorRow(rowNumber: number, vendor: VendorDirectoryRecord, seenIds: Set<string>, seenNames: Set<string>) {
  const issues: VendorImportIssue[] = []
  if (!vendor.vendor.trim()) issues.push(issue(rowNumber, 'Vendor Name', vendor.vendor, 'Missing vendor name.', 'Enter a vendor name.'))
  if (vendor.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.email)) issues.push(issue(rowNumber, 'Email', vendor.email, 'Invalid email format.', 'Use name@example.com.'))
  if (vendor.state && !/^[A-Z]{2}$/.test(vendor.state)) issues.push(issue(rowNumber, 'State', vendor.state, 'State must be a two-letter abbreviation.', 'Use MD, VA, DC, etc.'))
  if (vendor.zipCode && !/^\d{5}(?:-\d{4})?$/.test(vendor.zipCode)) issues.push(issue(rowNumber, 'ZIP Code', vendor.zipCode, 'Invalid ZIP code.', 'Use 12345 or 12345-6789.'))
  if (vendor.vendorId && seenIds.has(vendor.vendorId)) issues.push(issue(rowNumber, 'Vendor ID', vendor.vendorId, 'Duplicate Vendor ID in import file.', 'Keep one row per Vendor ID.'))
  if (seenNames.has(normalizeComparable(vendor.vendor))) issues.push(issue(rowNumber, 'Vendor Name', vendor.vendor, 'Duplicate Vendor Name in import file.', 'Keep one row per Vendor Name.'))
  if (vendor.vendorId) seenIds.add(vendor.vendorId)
  if (vendor.vendor) seenNames.add(normalizeComparable(vendor.vendor))
  return issues
}

function rowToVendor(values: Record<string, string>): VendorDirectoryRecord {
  const statusValue = values['Status (Active/Inactive)'] || 'Active'
  const preferred = yesNo(values['Preferred Vendor (Yes/No)'])
  return {
    vendorId: values['Vendor ID'] ?? '',
    vendor: values['Vendor Name'] ?? '',
    dbaName: values['DBA Name'] ?? '',
    status: preferred ? 'Preferred' : normalizeStatus(statusValue),
    primaryContact: values['Primary Contact'] ?? '',
    secondaryContact: values['Secondary Contact'] ?? '',
    email: values['Email'] ?? '',
    phone: values['Phone'] ?? '',
    website: values['Website'] ?? '',
    addressLine1: values['Address Line 1'] ?? '',
    addressLine2: values['Address Line 2'] ?? '',
    city: values['City'] ?? '',
    state: (values['State'] ?? '').toUpperCase(),
    zipCode: values['ZIP Code'] ?? '',
    country: values['Country'] ?? '',
    cageCode: values['Cage Code'] ?? '',
    uei: values['UEI'] ?? '',
    duns: values['DUNS (legacy)'] ?? '',
    taxId: values['Tax ID'] ?? '',
    paymentTerms: values['Payment Terms'] ?? '',
    leadTime: values['Lead Time'] ?? '',
    preferredVendor: preferred,
    manufacturerAuthorization: values['Manufacturer Authorization'] ?? '',
    smallBusinessType: values['Small Business Type'] ?? '',
    notes: values['Notes'] ?? '',
    lastUpdated: values['Last Updated'] ?? '',
    createdDate: values['Created Date'] ?? '',
    accountNumber: '',
    oems: [],
    products: [],
    createdBy: '',
  }
}

function mergeVendor(existing: VendorDirectoryRecord, incoming: VendorDirectoryRecord, allowBlankOverwrite: boolean, now: string): VendorDirectoryRecord {
  const merged = { ...existing }
  ;(Object.keys(incoming) as Array<keyof VendorDirectoryRecord>).forEach(key => {
    const value = incoming[key]
    if (key === 'createdDate' || key === 'createdBy') return
    if (typeof value === 'string') {
      if (value || allowBlankOverwrite) Object.assign(merged, { [key]: value })
    } else {
      Object.assign(merged, { [key]: value })
    }
  })
  merged.preferredVendor = incoming.preferredVendor
  merged.status = incoming.preferredVendor ? 'Preferred' : incoming.status
  merged.lastUpdated = now
  return merged
}

function findVendorMatch(record: VendorDirectoryRecord, existing: VendorDirectoryRecord[]) {
  return existing.find(vendor => record.vendorId && vendor.vendorId === record.vendorId)
    ?? existing.find(vendor => normalizeComparable(vendor.vendor) === normalizeComparable(record.vendor))
    ?? existing.find(vendor => record.cageCode && normalizeComparable(vendor.cageCode) === normalizeComparable(record.cageCode))
    ?? existing.find(vendor => record.uei && normalizeComparable(vendor.uei) === normalizeComparable(record.uei))
    ?? existing.find(vendor => record.email && normalizeComparable(vendor.email) === normalizeComparable(record.email))
}

function likelyDuplicate(record: VendorDirectoryRecord, existing: VendorDirectoryRecord[]) {
  return existing.some(vendor => normalizeCompany(vendor.vendor) === normalizeCompany(record.vendor) || (record.email && vendor.email && emailDomain(vendor.email) === emailDomain(record.email)))
}

async function parseVendorWorkbook(file: File) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const sharedStrings = await readSharedStrings(zip)
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
  if (!sheetXml) throw new Error('Unable to read the Vendors worksheet.')
  const rows = worksheetToRows(sheetXml, sharedStrings)
  const headerIndex = rows.findIndex(row => row.some(cell => cell.trim() === 'Vendor Name'))
  const headers = rows[headerIndex] ?? []
  return rows.slice(headerIndex + 1)
    .map((row, index) => ({
      rowNumber: headerIndex + index + 2,
      values: Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ''])),
    }))
    .filter(row => Object.values(row.values).some(Boolean))
}

async function downloadWorkbook(sheets: WorkbookSheet[], fileName: string) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypesXml(sheets))
  zip.file('_rels/.rels', rootRelsXml())
  zip.file('docProps/app.xml', xmlHeader('<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Atlas</Application></Properties>'))
  zip.file('docProps/core.xml', xmlHeader(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:creator>Atlas</dc:creator><dcterms:created>${new Date().toISOString()}</dcterms:created></cp:coreProperties>`))
  zip.file('xl/workbook.xml', workbookXml(sheets))
  zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml(sheets))
  zip.file('xl/styles.xml', stylesXml())
  sheets.forEach((sheet, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet)))
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

type WorkbookCell = string | number | { value?: string | number; style?: number }
type WorkbookSheet = { name: string; rows: WorkbookCell[][]; columnWidths?: number[]; freezePane?: string; autoFilter?: string }

function buildVendorSheet(vendors: VendorDirectoryRecord[], exportedBy: string, template: boolean): WorkbookSheet {
  const rows: WorkbookCell[][] = [
    [{ value: 'Atlas Vendor Master', style: 14 }],
    [{ value: `Date exported: ${new Date().toLocaleDateString()} | Exported by: ${exportedBy}`, style: 15 }],
    [],
    VENDOR_HEADERS.map(value => ({ value, style: 18 })),
    ...vendors.map(vendor => VENDOR_HEADERS.map(header => ({ value: vendorValue(vendor, header), style: header === 'Notes' ? 22 : 19 }))),
  ]
  if (template) rows.push([])
  return {
    name: 'Vendors',
    rows,
    columnWidths: [18, 28, 22, 20, 22, 22, 28, 18, 28, 26, 24, 18, 10, 12, 16, 14, 24, 16, 18, 18, 16, 18, 28, 22, 44, 22, 22],
    freezePane: 'A5',
    autoFilter: `A4:AA${Math.max(4, vendors.length + 4)}`,
  }
}

function buildInstructionsSheet(): WorkbookSheet {
  return {
    name: 'Instructions',
    rows: [
      [{ value: 'Vendor Import Instructions', style: 14 }],
      [],
      ['Required fields: Vendor Name.'],
      ['Status values: Active or Inactive. Preferred Vendor values: Yes or No.'],
      ['Blank cells do not overwrite existing vendor values unless the import option is selected.'],
      ['Atlas matches existing vendors by Vendor ID, Vendor Name, CAGE Code, UEI, then Email.'],
    ],
    columnWidths: [120],
  }
}

function vendorValue(vendor: VendorDirectoryRecord, header: (typeof VENDOR_HEADERS)[number]) {
  const map: Record<(typeof VENDOR_HEADERS)[number], string> = {
    'Vendor ID': vendor.vendorId,
    'Vendor Name': vendor.vendor,
    'DBA Name': vendor.dbaName,
    'Status (Active/Inactive)': vendor.status === 'Preferred' ? 'Active' : vendor.status,
    'Primary Contact': vendor.primaryContact,
    'Secondary Contact': vendor.secondaryContact,
    Email: vendor.email,
    Phone: vendor.phone,
    Website: vendor.website,
    'Address Line 1': vendor.addressLine1,
    'Address Line 2': vendor.addressLine2,
    City: vendor.city,
    State: vendor.state,
    'ZIP Code': vendor.zipCode,
    Country: vendor.country,
    'Cage Code': vendor.cageCode,
    UEI: vendor.uei,
    'DUNS (legacy)': vendor.duns,
    'Tax ID': vendor.taxId,
    'Payment Terms': vendor.paymentTerms,
    'Lead Time': vendor.leadTime,
    'Preferred Vendor (Yes/No)': vendor.preferredVendor || vendor.status === 'Preferred' ? 'Yes' : 'No',
    'Manufacturer Authorization': vendor.manufacturerAuthorization,
    'Small Business Type': vendor.smallBusinessType,
    Notes: vendor.notes,
    'Last Updated': vendor.lastUpdated,
    'Created Date': vendor.createdDate,
  }
  return map[header] ?? ''
}

function exampleVendor(): VendorDirectoryRecord {
  const now = new Date().toISOString()
  return {
    vendorId: 'V-EXAMPLE',
    vendor: 'Example Vendor LLC',
    dbaName: '',
    status: 'Active',
    primaryContact: 'Jane Smith',
    secondaryContact: '',
    email: 'jane@examplevendor.com',
    phone: '(301) 555-1234',
    website: 'https://examplevendor.com',
    addressLine1: '123 Vendor Way',
    addressLine2: 'Suite 200',
    city: 'California',
    state: 'MD',
    zipCode: '20619',
    country: 'United States',
    cageCode: '',
    uei: '',
    duns: '',
    taxId: '',
    paymentTerms: 'NET30',
    leadTime: '2 weeks',
    preferredVendor: false,
    manufacturerAuthorization: '',
    smallBusinessType: '',
    notes: 'Example row. Replace with vendor data.',
    accountNumber: '',
    oems: [],
    products: [],
    createdDate: now,
    lastUpdated: now,
    createdBy: 'Atlas',
  }
}

function worksheetXml(sheet: WorkbookSheet) {
  const cols = sheet.columnWidths?.length ? `<cols>${sheet.columnWidths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : ''
  const freeze = sheet.freezePane ? sheetViewsXml(sheet.freezePane) : ''
  const rows = sheet.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => cellXml(cell, `${columnName(columnIndex + 1)}${rowIndex + 1}`)).join('')}</row>`).join('')
  const filter = sheet.autoFilter ? `<autoFilter ref="${escapeXml(sheet.autoFilter)}"/>` : ''
  return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rows}</sheetData>${filter}</worksheet>`)
}

function cellXml(cell: WorkbookCell, ref: string) {
  const normalized = typeof cell === 'object' && cell !== null ? cell : { value: cell }
  const style = normalized.style ? ` s="${normalized.style}"` : ''
  if (typeof normalized.value === 'number') return `<c r="${ref}"${style}><v>${normalized.value}</v></c>`
  return `<c r="${ref}"${style} t="inlineStr"><is><t>${escapeXml(String(normalized.value ?? ''))}</t></is></c>`
}

function stylesXml() {
  return xmlHeader('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF06163D"/><name val="Arial"/></font><font><sz val="11"/><color rgb="FF566779"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF06163D"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFF"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD8DEE8"/></left><right style="thin"><color rgb="FFD8DEE8"/></right><top style="thin"><color rgb="FFD8DEE8"/></top><bottom style="thin"><color rgb="FFD8DEE8"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="23"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf></cellXfs></styleSheet>')
}

function workbookXml(sheets: WorkbookSheet[]) {
  return xmlHeader(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
}

function workbookRelsXml(sheets: WorkbookSheet[]) {
  return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)
}

function contentTypesXml(sheets: WorkbookSheet[]) {
  return xmlHeader(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
}

function rootRelsXml() {
  return xmlHeader('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>')
}

function sheetViewsXml(topLeftCell: string) {
  const row = Number(topLeftCell.match(/\d+/)?.[0] ?? 1)
  return `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${Math.max(0, row - 1)}" topLeftCell="${escapeXml(topLeftCell)}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>`
}

async function readSharedStrings(zip: { file: (path: string) => { async: (type: 'string') => Promise<string> } | null }) {
  const xml = await zip.file('xl/sharedStrings.xml')?.async('string')
  if (!xml) return []
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('si')).map(item => Array.from(item.getElementsByTagName('t')).map(text => text.textContent ?? '').join(''))
}

function worksheetToRows(xml: string, shared: string[]) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('row')).map(row => {
    const values: string[] = []
    Array.from(row.getElementsByTagName('c')).forEach((cell, fallbackIndex) => {
      const ref = cell.getAttribute('r')
      const index = ref ? columnLettersToIndex(ref.replace(/\d/g, '')) : fallbackIndex
      values[index] = readCellValue(cell, shared)
    })
    return values.map(value => value ?? '')
  })
}

function readCellValue(cell: Element, shared: string[]) {
  if (cell.getAttribute('t') === 'inlineStr') return Array.from(cell.getElementsByTagName('t')).map(t => t.textContent ?? '').join('')
  const value = cell.getElementsByTagName('v')[0]?.textContent ?? ''
  return cell.getAttribute('t') === 's' ? shared[Number(value)] ?? '' : value
}

function saveVendorImportLog(log: VendorImportLog) {
  window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify([log, ...loadVendorImportLogs()].slice(0, 100)))
}

function issue(rowNumber: number, column: string, value: string, problem: string, suggestedFix: string): VendorImportIssue {
  return { rowNumber, column, value, problem, suggestedFix }
}

function normalizeStatus(value: string): VendorStatus {
  return value.trim().toLowerCase() === 'inactive' ? 'Inactive' : value.trim().toLowerCase() === 'preferred' ? 'Preferred' : 'Active'
}

function yesNo(value: string) {
  return /^(yes|y|true|1)$/i.test(value.trim())
}

function normalizeComparable(value: string) {
  return value.trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ')
}

function normalizeCompany(value: string) {
  return normalizeComparable(value).replace(/\b(llc|inc|corporation|corp|company|co)\b/g, '').trim()
}

function emailDomain(value: string) {
  return value.split('@')[1]?.toLowerCase() ?? ''
}

function columnName(index: number) {
  let name = ''
  let current = index
  while (current > 0) {
    const mod = (current - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    current = Math.floor((current - mod) / 26)
  }
  return name
}

function columnLettersToIndex(value: string) {
  return value.toUpperCase().split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function xmlHeader(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`
}

function escapeXml(value: string) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
