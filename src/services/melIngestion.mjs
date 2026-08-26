export const MEL_FIELDS = ['ignore', 'quantity', 'description', 'partNumber', 'manufacturer', 'unitCost', 'alternatePartNumber', 'category', 'location', 'room', 'system', 'notes', 'clin']
export const MEL_CONFIDENCE_THRESHOLDS = Object.freeze({ high: 0.9, review: 0.7 })

const ALIASES = {
  partNumber: ['part number', 'part no', 'part #', 'p/n', 'pn', 'model', 'model number', 'mfr part number', 'manufacturer part number', 'manufacturer p/n', 'mpn', 'item number', 'product number', 'sku', 'catalog number'],
  manufacturer: ['manufacturer', 'mfg', 'mfr', 'make', 'oem', 'brand', 'vendor manufacturer'],
  quantity: ['quantity', 'qty', 'qty.', 'quantity required', 'qty to order', 'ordered qty', 'count', 'quantiy'],
  description: ['description', 'item description', 'product description', 'equipment description', 'p/n desc', 'part description', 'material description', 'item', 'equipment'],
  unitCost: ['budget unit price', 'unit cost', 'unit price', 'net price', 'quoted price', 'price', 'cost'],
  alternatePartNumber: ['alternate part number', 'alternate part', 'alt part', 'alt pn', 'alternate sku'],
  category: ['category', 'section', 'equipment type', 'type'], location: ['location', 'site'], room: ['room', 'room number'], system: ['system', 'system name'], notes: ['notes', 'comments', 'remarks'], clin: ['clin', 'customer line number', 'line number', 'line no', 'item no'],
}

export function analyzeMelWorkbook(workbook, options = {}) {
  const sheets = (workbook?.sheets || []).map(sheet => analyzeSheet(sheet, options)).sort((a, b) => b.score - a.score)
  const bestScore = sheets[0]?.score || 0
  const selectionFloor = Math.max(0.55, bestScore - 0.18)
  const selected = sheets.filter(sheet => sheet.score >= selectionFloor && sheet.items.length)
  const usable = selected.length ? distinctEquipmentSheets(selected) : sheets.filter(sheet => sheet.items.length && sheet.score >= 0.35).slice(0, 1)
  const items = usable.flatMap(sheet => sheet.items)
  const supplementalPrices = collectSupplementalPrices(sheets)
  for (const item of items) {
    if (item.unitCost > 0 || !item.partNumber) continue
    const price = supplementalPrices.get(normalize(item.partNumber))
    if (price) { item.unitCost = price.unitCost; item.pricingSource = { sheet: price.sheet, row: price.row } }
  }
  markDuplicates(items)
  return {
    filename: String(workbook?.filename || ''), inspectedAt: new Date().toISOString(), worksheetsInspected: sheets.length,
    sheets, selectedSheetNames: usable.map(sheet => sheet.name), items,
    averageConfidence: average(items.map(item => item.confidence.overall)),
    needsManualMapping: !items.length || !usable.some(sheet => sheet.mappingConfidence >= (options.mappingThreshold ?? MEL_CONFIDENCE_THRESHOLDS.review)),
    diagnostics: diagnosticMessage(sheets, items),
  }
}

export function analyzeSheet(sheet, options = {}) {
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
  const regions = findTableRegions(rows, options)
  const items = regions.flatMap(region => extractRegion(sheet, rows, region, options))
  const best = regions.slice().sort((a, b) => b.score - a.score)[0]
  const visibilityPenalty = sheet?.hidden ? 0.12 : 0
  const itemSignal = Math.min(items.length / 10, 1)
  const score = clamp((best?.score || 0) * 0.72 + itemSignal * 0.28 - visibilityPenalty)
  return { name: String(sheet?.name || 'Worksheet'), hidden: Boolean(sheet?.hidden), rows, rowCount: rows.length, columnCount: Math.max(0, ...rows.map(row => row.length)), score, mappingConfidence: best?.mappingConfidence || 0, headerRows: regions.map(region => region.headerRow + 1), regions, items, columns: candidateColumns(rows, best?.headerRow ?? 0) }
}

export function remapMelSheet(sheet, mapping, headerRow = 0, options = {}) {
  const normalized = Object.fromEntries(Object.entries(mapping).filter(([, field]) => field && field !== 'ignore').map(([column, field]) => [Number(column), field]))
  const region = { headerRow, endRow: sheet.rows.length - 1, mapping: normalized, fieldConfidence: Object.fromEntries(Object.values(normalized).map(field => [field, 1])), mappingConfidence: 1, score: 1 }
  const items = extractRegion(sheet, sheet.rows, region, options)
  markDuplicates(items)
  return items
}

function findTableRegions(rows, options) {
  const scanLimit = Math.min(rows.length, options.headerScanLimit ?? 100)
  const candidates = []
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rows[rowIndex] || []
    if (row.filter(populated).length < 2) continue
    const inferred = inferColumns(rows, rowIndex)
    const belowScore = scoreRowsBelow(rows, rowIndex, inferred.mapping)
    const conceptCount = new Set(Object.values(inferred.mapping)).size
    const score = clamp(inferred.mappingConfidence * 0.65 + belowScore * 0.25 + Math.min(conceptCount / 4, 1) * 0.1)
    if (conceptCount >= 2 && score >= 0.42) candidates.push({ headerRow: rowIndex, mapping: inferred.mapping, fieldConfidence: inferred.fieldConfidence, mappingConfidence: inferred.mappingConfidence, score })
  }
  const headers = candidates.sort((a, b) => a.headerRow - b.headerRow).filter((candidate, index, all) => !all.slice(0, index).some(other => Math.abs(other.headerRow - candidate.headerRow) <= 2 && other.score >= candidate.score))
  return headers.map((header, index) => ({ ...header, endRow: (headers[index + 1]?.headerRow ?? rows.length) - 1 }))
}

function inferColumns(rows, headerRow) {
  const header = rows[headerRow] || []
  const width = Math.max(header.length, ...rows.slice(headerRow + 1, headerRow + 16).map(row => row.length))
  const proposals = []
  for (let column = 0; column < width; column += 1) {
    const headerText = text(header[column])
    const values = rows.slice(headerRow + 1, headerRow + 16).map(row => text(row[column])).filter(Boolean)
    for (const field of Object.keys(ALIASES)) {
      const headerScore = aliasScore(headerText, ALIASES[field], field)
      const valueScore = semanticValueScore(field, values)
      const score = clamp(headerScore * 0.72 + valueScore * 0.28)
      if (score >= 0.42) proposals.push({ column, field, score })
    }
  }
  const mapping = {}; const fieldConfidence = {}; const usedColumns = new Set()
  for (const proposal of proposals.sort((a, b) => b.score - a.score)) {
    if (usedColumns.has(proposal.column) || fieldConfidence[proposal.field] !== undefined) continue
    mapping[proposal.column] = proposal.field; fieldConfidence[proposal.field] = proposal.score; usedColumns.add(proposal.column)
  }
  const primary = ['partNumber', 'description', 'manufacturer', 'quantity'].map(field => fieldConfidence[field] || 0)
  return { mapping, fieldConfidence, mappingConfidence: average(primary.filter(Boolean)) }
}

function extractRegion(sheet, rows, region, options) {
  const items = []; let section = ''
  for (let rowIndex = region.headerRow + 1; rowIndex <= region.endRow; rowIndex += 1) {
    const row = rows[rowIndex] || []
    if (!row.some(populated)) continue
    const values = {}
    for (const [column, field] of Object.entries(region.mapping)) values[field] = text(row[Number(column)])
    const rowText = row.map(text).filter(Boolean).join(' ')
    if (isStructuralRow(rowText, values)) { if (isSectionRow(row, values)) section = rowText; continue }
    const quantity = parseQuantity(values.quantity)
    const partNumber = preservePartNumber(values.partNumber || values.alternatePartNumber)
    const description = text(values.description)
    const unitCost = parseMoney(values.unitCost) ?? 0
    if (!isEquipmentRow({ partNumber, description, manufacturer: text(values.manufacturer), quantity, rowText })) continue
    const confidence = {
      quantity: fieldConfidence(region, 'quantity', quantity !== null ? 0.92 : 0.2), partNumber: fieldConfidence(region, 'partNumber', partNumberScore(partNumber)),
      description: fieldConfidence(region, 'description', descriptionScore(description)), manufacturer: fieldConfidence(region, 'manufacturer', manufacturerScore(values.manufacturer)),
    }
    confidence.overall = average([confidence.quantity, confidence.partNumber, confidence.description, confidence.manufacturer].filter(value => value > 0.25))
    items.push({
      id: `${safeId(sheet.name)}-${rowIndex + 1}-${items.length + 1}`, included: true, quantity: quantity ?? 1, partNumber, manufacturer: text(values.manufacturer), description, unitCost,
      alternatePartNumber: preservePartNumber(values.alternatePartNumber), category: text(values.category) || section, location: text(values.location), room: text(values.room), system: text(values.system), notes: text(values.notes), clin: text(values.clin),
      manufacturerSuggested: false, duplicate: false, confidence,
      source: { filename: String(options.filename || ''), sheet: String(sheet.name || 'Worksheet'), row: rowIndex + 1, headerRow: region.headerRow + 1, parsingMethod: 'deterministic-semantic', originalValues: Object.fromEntries(row.map((value, column) => [columnName(column), text(value)])) },
    })
  }
  return items
}

function aliasScore(value, aliases, field = '') {
  const normalized = normalize(value); if (!normalized) return 0
  let best = 0
  for (const alias of aliases) {
    const target = normalize(alias)
    if (normalized === target) best = Math.max(best, field === 'unitCost' && target === 'cost' ? 0.86 : 1)
    else if (normalized.includes(target) || target.includes(normalized)) best = Math.max(best, 0.88)
    else { const similarity = 1 - levenshtein(normalized, target) / Math.max(normalized.length, target.length, 1); if (similarity >= 0.72) best = Math.max(best, similarity * 0.9) }
  }
  return best
}

function semanticValueScore(field, values) {
  if (!values.length) return 0
  const scorers = { quantity: value => parseQuantity(value) !== null ? 1 : 0, unitCost: value => parseMoney(value) !== null ? 1 : 0, partNumber: partNumberScore, description: descriptionScore, manufacturer: manufacturerScore }
  const scorer = scorers[field]
  return scorer ? average(values.map(scorer)) : 0.25
}
function partNumberScore(value) { const v = text(value); if (!v || v.length > 80 || /\s{2,}/.test(v)) return 0; if (/^(?:\d+\.?\d*)$/.test(v)) return v.length >= 5 ? 0.55 : 0.1; if (/^(?=.*[a-z])(?=.*\d)[a-z0-9._\/-]{3,}$/i.test(v)) return 1; if (/^[a-z0-9._\/-]{3,}$/i.test(v)) return 0.68; return 0.1 }
function descriptionScore(value) { const v = text(value); if (!v) return 0; const words = v.split(/\s+/).length; return v.length >= 18 && words >= 3 ? 1 : v.length >= 8 && words >= 2 ? 0.7 : 0.2 }
function manufacturerScore(value) { const v = text(value); if (!v || v.length > 60 || /\d{4,}/.test(v)) return 0; return /^[a-z][a-z0-9 &+.'()-]{1,}$/i.test(v) ? 0.82 : 0.15 }
function scoreRowsBelow(rows, headerRow, mapping) { const sample = rows.slice(headerRow + 1, headerRow + 16); if (!sample.length) return 0; return average(sample.map(row => { const values = Object.entries(mapping).map(([column, field]) => field === 'quantity' ? parseQuantity(row[Number(column)]) !== null : populated(row[Number(column)])); return values.filter(Boolean).length / Math.max(values.length, 1) })) }

function isEquipmentRow({ partNumber, description, manufacturer, quantity, rowText }) { if (quantity === null || quantity <= 0) return false; if (!partNumber && !(description && manufacturer)) return false; return !/\b(sub\s*total|grand\s*total|labor total|shipping total|price total|signature|revision|instructions?)\b/i.test(rowText) }
function isStructuralRow(rowText, values) { if (/\b(sub\s*total|grand\s*total|labor total|shipping total|price total|signature|revision|instructions?)\b/i.test(rowText)) return true; return isSectionRow([], values) }
function isSectionRow(row, values) { const populatedFields = Object.values(values).filter(populated); return !values.partNumber && !values.quantity && populatedFields.length <= 1 && (text(values.description).length > 0 || row.filter(populated).length === 1) }
function parseQuantity(value) { const cleaned = text(value).replace(/,/g, ''); if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null; const number = Number(cleaned); return Number.isFinite(number) && number > 0 ? number : null }
function parseMoney(value) { const cleaned = text(value).replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1'); if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null; const number = Number(cleaned); return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null }
function preservePartNumber(value) { return text(value) }
function fieldConfidence(region, field, fallback) { return clamp(region.fieldConfidence?.[field] ?? fallback) }
function distinctEquipmentSheets(sheets) {
  const accepted = []
  const acceptedParts = new Set()
  for (const sheet of sheets) {
    const parts = [...new Set(sheet.items.map(item => normalize(item.partNumber)).filter(Boolean))]
    const overlap = parts.length ? parts.filter(part => acceptedParts.has(part)).length / parts.length : 0
    if (accepted.length && overlap >= 0.8) continue
    accepted.push(sheet); parts.forEach(part => acceptedParts.add(part))
  }
  return accepted
}
function collectSupplementalPrices(sheets) {
  const prices = new Map()
  for (const sheet of sheets) for (const region of sheet.regions || []) {
    const partColumn = Number(Object.keys(region.mapping).find(column => region.mapping[column] === 'partNumber'))
    const costColumn = Number(Object.keys(region.mapping).find(column => region.mapping[column] === 'unitCost'))
    if (!Number.isInteger(partColumn) || !Number.isInteger(costColumn)) continue
    for (let rowIndex = region.headerRow + 1; rowIndex < sheet.rows.length; rowIndex += 1) {
      const partNumber = preservePartNumber(sheet.rows[rowIndex]?.[partColumn]); const unitCost = parseMoney(sheet.rows[rowIndex]?.[costColumn])
      if (partNumber && unitCost !== null && !prices.has(normalize(partNumber))) prices.set(normalize(partNumber), { unitCost, sheet: sheet.name, row: rowIndex + 1 })
    }
  }
  return prices
}
function markDuplicates(items) { const counts = new Map(); for (const item of items) { if (!item.partNumber) continue; const key = `${normalize(item.manufacturer)}::${normalize(item.partNumber)}`; counts.set(key, (counts.get(key) || 0) + 1) } for (const item of items) { const key = `${normalize(item.manufacturer)}::${normalize(item.partNumber)}`; item.duplicate = Boolean(item.partNumber && counts.get(key) > 1) } }
function candidateColumns(rows, headerRow) { const width = Math.max(0, ...(rows.slice(headerRow, headerRow + 10).map(row => row.length))); return Array.from({ length: width }, (_, index) => ({ index, label: `Column ${columnName(index)}`, sample: rows.slice(headerRow, headerRow + 6).map(row => text(row[index])).filter(Boolean).slice(0, 3) })) }
function diagnosticMessage(sheets, items) { if (items.length) return `${items.length} equipment line item${items.length === 1 ? '' : 's'} detected across ${new Set(items.map(item => item.source.sheet)).size} worksheet${new Set(items.map(item => item.source.sheet)).size === 1 ? '' : 's'}.`; const possible = sheets.slice(0, 3).map(sheet => `${sheet.name} — ${Math.round(sheet.score * 100)}% confidence`).join('; '); return `No equipment table was confidently detected. Atlas inspected ${sheets.length} worksheet${sheets.length === 1 ? '' : 's'}.${possible ? ` Possible data: ${possible}.` : ''}` }
function normalize(value) { return text(value).toLowerCase().replace(/[^a-z0-9]/g, '') }
function text(value) { return String(value ?? '').trim() }
function populated(value) { return text(value) !== '' }
function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function clamp(value) { return Math.max(0, Math.min(1, Number(value) || 0)) }
function safeId(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sheet' }
function columnName(index) { let name = ''; for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name; return name }
function levenshtein(a, b) { const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j; for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return matrix[a.length][b.length] }
