export function applyManufacturerUpdates(rows, currentLines) {
  const updatedLines = currentLines.map(line => ({ ...line }))
  const usedIndexes = new Set()
  let updatedCount = 0
  let unchangedCount = 0
  let skippedCount = 0
  let unmatchedCount = 0

  for (const row of rows) {
    const manufacturer = cleanManufacturer(row.manufacturer)
    if (!manufacturer) { skippedCount += 1; continue }
    const matchIndex = findMatchingLine(row, updatedLines, usedIndexes)
    if (matchIndex < 0) { unmatchedCount += 1; continue }
    usedIndexes.add(matchIndex)
    if (updatedLines[matchIndex].manufacturer.trim() === manufacturer) { unchangedCount += 1; continue }
    updatedLines[matchIndex].manufacturer = manufacturer
    updatedCount += 1
  }
  return { updatedLines, updatedCount, unchangedCount, skippedCount, unmatchedCount }
}

function findMatchingLine(row, lines, usedIndexes) {
  const clin = normalizeClin(row.clin)
  const part = normalizePartNumber(row.partNumber)
  const clinMatches = lines.map((line, index) => ({ line, index })).filter(({ line, index }) => !usedIndexes.has(index) && normalizeClin(line.clin) === clin)
  if (clin && clinMatches.length === 1) {
    const candidatePart = normalizePartNumber(clinMatches[0].line.partNumber)
    if (!part || !candidatePart || partNumbersMatch(part, candidatePart)) return clinMatches[0].index
  }
  if (!part) return -1
  const partMatches = lines.map((line, index) => ({ line, index })).filter(({ line, index }) => !usedIndexes.has(index) && partNumbersMatch(part, normalizePartNumber(line.partNumber)))
  return partMatches.length === 1 ? partMatches[0].index : -1
}

function cleanManufacturer(value) {
  const cleaned = String(value ?? '').trim()
  return !cleaned || /^(?:n\/?a|none|unknown|-)$/i.test(cleaned) ? '' : cleaned
}
function normalizeClin(value) { return String(value ?? '').trim().replace(/^0+/, '') }
function normalizePartNumber(value) { return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') }
function partNumbersMatch(left, right) {
  if (left === right) return true
  return /^\d+$/.test(left) && /^\d+$/.test(right) && left.replace(/^0+/, '') === right.replace(/^0+/, '')
}
