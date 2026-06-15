export type TrackingImportInput = {
  itemNumber: string
  projectNumber: string
  poNumber: string
  vendor: string
  vendorOrderNumber?: string
  partNumber: string
  manufacturer: string
  description: string
  quantity: number
  trackingNumber?: string
  estimatedShipDate?: string
  receivedDate?: string
  carrier?: string
  notes?: string
}

const headerAliases = {
  itemNumber: ['item', 'item #', 'item number', 'line', 'line #'],
  projectNumber: ['project number', 'project #', 'project'],
  poNumber: ['po#', 'po #', 'po number', 'po no', 'po'],
  vendor: ['vendor', 'supplier'],
  vendorOrderNumber: ['vendor order', 'vendor order #', 'vendor order number', 'sales order', 'order #'],
  partNumber: ['part', 'part #', 'part number', 'sku', 'model'],
  manufacturer: ['manufacturer', 'mfr', 'oem'],
  description: ['description', 'item description', 'product description'],
  quantity: ['qty', 'quantity', 'quantity ordered', 'ordered'],
  trackingNumber: ['tracking', 'tracking #', 'tracking number', 'tracking no'],
  estimatedShipDate: ['estimated ship date', 'esd', 'ship date', 'expected ship date'],
  receivedDate: ['received date', 'date received', 'delivery date', 'delivered date'],
  carrier: ['carrier', 'shipper', 'freight carrier'],
  notes: ['notes', 'comment', 'comments'],
} as const

export async function parseTrackingImportFile(file: File): Promise<TrackingImportInput[]> {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  const rows = extension === '.xlsx' ? await parseXlsxRows(file) : parseTextRows(await file.text())
  return rowsToTrackingRows(rows)
}

function rowsToTrackingRows(rows: string[][]) {
  if (!rows.length) return []

  const headerIndex = rows.findIndex(row => row.some(cell => /po|project|tracking|carrier|part|received/i.test(cell)))
  const header = rows[Math.max(0, headerIndex)].map(normalizeHeader)
  const dataRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 1)

  return dataRows
    .map(row => ({
      itemNumber: stringValue(readAlias(row, header, headerAliases.itemNumber)),
      projectNumber: stringValue(readAlias(row, header, headerAliases.projectNumber)),
      poNumber: stringValue(readAlias(row, header, headerAliases.poNumber)),
      vendor: stringValue(readAlias(row, header, headerAliases.vendor)),
      vendorOrderNumber: stringValue(readAlias(row, header, headerAliases.vendorOrderNumber)),
      partNumber: stringValue(readAlias(row, header, headerAliases.partNumber)),
      manufacturer: stringValue(readAlias(row, header, headerAliases.manufacturer)),
      description: stringValue(readAlias(row, header, headerAliases.description)),
      quantity: numberValue(readAlias(row, header, headerAliases.quantity)),
      trackingNumber: stringValue(readAlias(row, header, headerAliases.trackingNumber)),
      estimatedShipDate: dateValue(readAlias(row, header, headerAliases.estimatedShipDate)),
      receivedDate: dateValue(readAlias(row, header, headerAliases.receivedDate)),
      carrier: stringValue(readAlias(row, header, headerAliases.carrier)),
      notes: stringValue(readAlias(row, header, headerAliases.notes)),
    }))
    .filter(row => row.projectNumber || row.poNumber || row.trackingNumber || row.partNumber)
}

async function parseXlsxRows(file: File) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const sharedStrings = await readSharedStrings(zip)
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
  if (!sheetXml) throw new Error('Unable to read the first worksheet from this tracking workbook.')
  return worksheetToRows(sheetXml, sharedStrings)
}

async function readSharedStrings(zip: { file: (path: string) => { async: (type: 'string') => Promise<string> } | null }) {
  const xml = await zip.file('xl/sharedStrings.xml')?.async('string')
  if (!xml) return []

  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(document.getElementsByTagName('si')).map(item =>
    Array.from(item.getElementsByTagName('t'))
      .map(text => text.textContent ?? '')
      .join(''),
  )
}

function worksheetToRows(xml: string, sharedStrings: string[]) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const rows: string[][] = []

  Array.from(document.getElementsByTagName('row')).forEach((row, rowIndex) => {
    const cells: string[] = []
    Array.from(row.getElementsByTagName('c')).forEach((cell, cellIndex) => {
      const reference = cell.getAttribute('r')
      const columnIndex = reference ? columnLettersToIndex(reference.replace(/\d/g, '')) : cellIndex
      cells[columnIndex] = readCellValue(cell, sharedStrings)
    })
    rows[rowIndex] = cells.map(cell => cell ?? '')
  })

  return rows.filter(row => row.some(Boolean))
}

function readCellValue(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') return Array.from(cell.getElementsByTagName('t')).map(text => text.textContent ?? '').join('')

  const value = cell.getElementsByTagName('v')[0]?.textContent ?? ''
  if (type === 's') return sharedStrings[Number(value)] ?? ''
  return value
}

function parseTextRows(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (/<(?:\w+:)?Workbook[\s>]/i.test(trimmed) || /<(?:\w+:)?Worksheet[\s>]/i.test(trimmed)) return parseSpreadsheetXml(trimmed)
  if (/<table[\s>]/i.test(trimmed)) return parseHtmlTable(trimmed)
  return parseDelimited(trimmed)
}

function parseHtmlTable(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(document.querySelectorAll('tr'))
    .map(row => Array.from(row.querySelectorAll('th,td')).map(cell => cell.textContent?.trim() ?? ''))
    .filter(row => row.some(Boolean))
}

function parseSpreadsheetXml(xml: string) {
  return Array.from(xml.matchAll(/<(?:(?:\w+):)?Row\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Row>/gi))
    .map(rowMatch =>
      Array.from(rowMatch[1].matchAll(/<(?:(?:\w+):)?Cell\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Cell>/gi)).map(cellMatch => {
        const dataMatch = cellMatch[1].match(/<(?:(?:\w+):)?Data\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Data>/i)
        return decodeXml(stripTags(dataMatch?.[1] ?? cellMatch[1])).trim()
      }),
    )
    .filter(row => row.some(Boolean))
}

function parseDelimited(text: string) {
  return text
    .split(/\r?\n/)
    .map(row => splitRow(row).map(cell => cell.trim()))
    .filter(row => row.some(Boolean))
}

function splitRow(row: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    if (char === '"' && row[index + 1] === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if ((char === ',' || char === '\t') && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

function readAlias(row: string[], header: string[], aliases: readonly string[]) {
  const index = header.findIndex(heading => aliases.includes(heading))
  return index >= 0 ? row[index] ?? '' : ''
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function stringValue(value: unknown) {
  return String(value ?? '').trim()
}

function dateValue(value: unknown) {
  const raw = stringValue(value)
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toISOString().slice(0, 10)
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, '')
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function columnLettersToIndex(letters: string) {
  return letters
    .toUpperCase()
    .split('')
    .reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
}
