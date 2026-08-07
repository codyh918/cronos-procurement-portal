import type { QuoteLine } from '../types'

export type ImportedQuoteLine = Omit<QuoteLine, 'id' | 'approved'>
type ZipArchive = {
  file: (path: string) => { async: (type: 'string') => Promise<string> } | null
}

export async function parseQuoteImportFile(file: File): Promise<ImportedQuoteLine[]> {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!['.csv', '.txt', '.xlsx', '.xls', '.pdf'].includes(extension)) {
    throw new Error('CSV, TXT, XLS, XLSX, and PDF imports are available in the Vue port.')
  }

  if (extension === '.xlsx') {
    const rows = await parseWorkbook(file)
    return rowsToMaterialLines(rows).slice(0, 1000)
  }

  if (extension === '.xls') {
    const rows = parseLegacySpreadsheetText(await file.text())
    const lines = rowsToMaterialLines(rows).slice(0, 1000)
    if (!lines.length) {
      throw new Error('This legacy XLS file could not be read in the browser. Save it as XLSX, CSV, or PDF and import again.')
    }
    return lines
  }

  if (extension === '.pdf') {
    const rows = await parsePdf(file)
    return rowsToMaterialLines(rows).slice(0, 1000)
  }

  const text = await file.text()
  return rowsToMaterialLines(parseDelimited(text)).slice(0, 1000)
}

function parseLegacySpreadsheetText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (/<(?:\w+:)?Workbook[\s>]/i.test(trimmed) || /<(?:\w+:)?Worksheet[\s>]/i.test(trimmed)) return parseSpreadsheetXml(trimmed)
  if (/<table[\s>]/i.test(trimmed)) return parseHtmlTable(trimmed)
  if (/part|sku|item|description|qty|quantity|cost|price/i.test(trimmed)) return parseDelimited(trimmed)

  return []
}

function parseHtmlTable(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(document.querySelectorAll('tr'))
    .map(row =>
      Array.from(row.querySelectorAll('th,td'))
        .map(cell => cell.textContent?.trim() ?? ''),
    )
    .filter(row => row.some(Boolean))
}

function parseSpreadsheetXml(xml: string) {
  const rows = parseSpreadsheetXmlFallback(xml)
  if (rows.length) return rows

  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return elementsByLocalName(document, 'Row')
    .map(row =>
      elementsByLocalName(row, 'Cell').map(cell => {
        const data = elementsByLocalName(cell, 'Data')[0]
        return data?.textContent?.trim() ?? ''
      }),
    )
    .filter(row => row.some(Boolean))
}

function parseSpreadsheetXmlFallback(xml: string) {
  return Array.from(xml.matchAll(/<(?:(?:\w+):)?Row\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Row>/gi))
    .map(rowMatch =>
      Array.from(rowMatch[1].matchAll(/<(?:(?:\w+):)?Cell\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Cell>/gi)).map(cellMatch => {
        const dataMatch = cellMatch[1].match(/<(?:(?:\w+):)?Data\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?Data>/i)
        return decodeXml(stripTags(dataMatch?.[1] ?? cellMatch[1])).trim()
      }),
    )
    .filter(row => row.some(Boolean))
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

function elementsByLocalName(root: ParentNode, localName: string) {
  const normalized = localName.toLowerCase()
  return Array.from(root.querySelectorAll('*')).filter(element => element.localName.toLowerCase() === normalized)
}

async function parsePdf(file: File) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableFontFace: true,
    useWorkerFetch: false,
  })
  const document = await loadingTask.promise as {
    numPages: number
    getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>
    destroy?: () => Promise<void>
  }
  const rows: string[][] = []

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      rows.push(...textItemsToRows(textContent.items))
    }
  } finally {
    await document.destroy?.()
  }

  return rows
}

function textItemsToRows(items: unknown[]) {
  const grouped = new Map<number, Array<{ x: number; text: string }>>()
  items.forEach(item => {
    if (!isPdfTextItem(item)) return
    const y = Math.round(item.transform[5] / 3) * 3
    const row = grouped.get(y) ?? []
    row.push({ x: item.transform[4], text: item.str.trim() })
    grouped.set(y, row)
  })

  return Array.from(grouped.entries())
    .sort(([leftY], [rightY]) => rightY - leftY)
    .map(([, row]) => row.sort((left, right) => left.x - right.x).map(item => item.text).filter(Boolean))
    .filter(row => row.length)
}

function isPdfTextItem(item: unknown): item is { str: string; transform: number[] } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    'transform' in item &&
    typeof (item as { str?: unknown }).str === 'string' &&
    Array.isArray((item as { transform?: unknown }).transform)
  )
}

async function parseWorkbook(file: File) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const sharedStrings = await readSharedStrings(zip)
  const sheetPaths = await findWorksheetPaths(zip)
  const sheetRows = await Promise.all(sheetPaths.map(async sheetPath => {
    const xml = await zip.file(sheetPath)?.async('string')
    return xml ? worksheetToRows(xml, sharedStrings) : []
  }))
  const rows = sheetRows
    .filter(sheet => sheet.length)
    .sort((left, right) => rowsToMaterialLines(right).length - rowsToMaterialLines(left).length)[0]
  const sheetXml = rows ? null : await zip.file('xl/worksheets/sheet1.xml')?.async('string')
  if (rows) return rows
  if (!sheetXml) throw new Error('Unable to read a worksheet from this XLSX file.')
  return worksheetToRows(sheetXml, sharedStrings)
}

async function readSharedStrings(zip: ZipArchive) {
  const xml = await zip.file('xl/sharedStrings.xml')?.async('string')
  if (!xml) return []

  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(document.getElementsByTagName('si')).map(item =>
    Array.from(item.getElementsByTagName('t'))
      .map(text => text.textContent ?? '')
      .join(''),
  )
}

async function findWorksheetPaths(zip: ZipArchive) {
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (!workbookXml || !relsXml) return ['xl/worksheets/sheet1.xml']

  const workbook = new DOMParser().parseFromString(workbookXml, 'application/xml')
  const rels = new DOMParser().parseFromString(relsXml, 'application/xml')
  const relationships = Array.from(rels.getElementsByTagName('Relationship'))
  const paths = Array.from(workbook.getElementsByTagName('sheet'))
    .map(sheet => sheet.getAttribute('r:id') ?? sheet.getAttribute('id') ?? '')
    .map(relationshipId => relationships.find(item => item.getAttribute('Id') === relationshipId)?.getAttribute('Target') ?? '')
    .filter(Boolean)
    .map(target => {
      const normalized = target.replace(/^\/?xl\//, '')
      return `xl/${normalized}`
    })

  return paths.length ? paths : ['xl/worksheets/sheet1.xml']
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
  if (type === 'inlineStr') {
    return Array.from(cell.getElementsByTagName('t')).map(text => text.textContent ?? '').join('')
  }

  const value = cell.getElementsByTagName('v')[0]?.textContent ?? ''
  if (type === 's') return sharedStrings[Number(value)] ?? ''
  return value
}

function columnLettersToIndex(letters: string) {
  return letters
    .toUpperCase()
    .split('')
    .reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
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

function rowsToLines(rows: string[][]): ImportedQuoteLine[] {
  if (!rows.length) return []

  const headerIndex = rows.findIndex(row => row.some(cell => /part|sku|item|description|qty|quantity|cost|price/i.test(cell)))
  const header = rows[Math.max(headerIndex, 0)].map(normalizeHeader)
  const dataRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 1)

  return dataRows.map((row, index) => (row.length <= 1 ? inferLineFromText(row[0] ?? '', index) : rowToLine(row, header, index)))
}

function rowsToMaterialLines(rows: string[][]) {
  return rowsToLines(rows).filter(isMaterialLine)
}

function rowToLine(row: string[], header: string[], index: number): ImportedQuoteLine {
  const find = (...keys: string[]) => findByHeader(row, header, keys)
  const partNumber = find('partnumber', 'partno', 'pn', 'sku', 'modelnumber', 'model')
  const description = find('description', 'itemdescription', 'desc', 'product', 'material', 'equipment', 'item')
  const manufacturer = find('manufacturer', 'mfr', 'brand', 'make', 'oem')
  const quantity = parseNumber(find('totalquantity', 'totalqty', 'quantity', 'qty', 'count', 'needed')) || 1
  const unitCost = parseNumber(find('unitcost', 'unitprice', 'netprice', 'listprice', 'price', 'cost', 'budgetprice'))

  return {
    clin: find('clin', 'itemnumber', 'itemno', 'lineno', 'line') || String(index + 1),
    partNumber,
    manufacturer,
    description,
    quantity,
    unitCost,
    pricingMode: 'markup',
    markupPercent: 15,
    marginPercent: 20,
    vendor: find('vendor', 'source', 'supplier', 'distributor') || manufacturer,
    quoteNumber: find('quotenumber', 'quote', 'rfq'),
    leadTime: find('leadtime', 'lead', 'eta', 'delivery'),
  }
}

function findByHeader(row: string[], header: string[], keys: string[]) {
  for (const key of keys) {
    const exactIndex = header.findIndex(heading => heading === key)
    if (exactIndex >= 0) return row[exactIndex] ?? ''
  }
  for (const key of keys) {
    const containsIndex = header.findIndex(heading => heading.includes(key))
    if (containsIndex >= 0) return row[containsIndex] ?? ''
  }
  return ''
}

function isMaterialLine(line: ImportedQuoteLine) {
  const summaryText = `${line.partNumber} ${line.description}`.toLowerCase()
  if (!line.partNumber && !line.description) return false
  if (/^(equipment|parts|grand)\s+total\b/.test(summaryText.trim())) return false
  if (/supplier unable to quote|updated\/not quoted/.test(summaryText)) return false
  return line.quantity > 0
}

function inferLineFromText(text: string, index: number): ImportedQuoteLine {
  const tokens = text.split(/\s+/)
  const partIndex = tokens.findIndex(token => /[A-Z]{1,}[-A-Z0-9]*\d[-A-Z0-9]*/i.test(token))
  const partNumber = partIndex >= 0 ? tokens[partIndex] : ''
  const numericTokens = tokens
    .map((token, tokenIndex) => ({ token, tokenIndex, value: parseNumber(token) }))
    .filter(item => item.value > 0 && item.tokenIndex !== partIndex)
  const costToken = [...numericTokens].reverse().find(item => /\.\d{2}$/.test(item.token.replace(/[$,]/g, ''))) ?? numericTokens[numericTokens.length - 1]
  const quantityToken = numericTokens.find(item => item.tokenIndex !== costToken?.tokenIndex)
  const unitCost = costToken?.value ?? 0
  const quantity = quantityToken?.value ?? 1
  const vendor = costToken && costToken.tokenIndex < tokens.length - 1 ? tokens.slice(costToken.tokenIndex + 1).join(' ') : ''
  const descriptionEnd = quantityToken?.tokenIndex ?? costToken?.tokenIndex ?? tokens.length
  const description = tokens.slice(partIndex >= 0 ? partIndex + 1 : 0, descriptionEnd).join(' ') || text

  return {
    clin: `PDF-${index + 1}`,
    partNumber,
    manufacturer: '',
    description,
    quantity,
    unitCost,
    pricingMode: 'markup',
    markupPercent: 15,
    marginPercent: 20,
    vendor,
    quoteNumber: '',
    leadTime: '',
  }
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseNumber(value: string) {
  const normalized = String(value ?? '')
    .replace(/\(([^)]+)\)/, '-$1')
    .replace(/[$,\s]/g, '')
    .replace(/^[-–—]+$/, '0')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
