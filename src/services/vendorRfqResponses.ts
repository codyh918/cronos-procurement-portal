import type { QuoteLine } from '../types'
import { parseQuoteImportFile, type ImportedQuoteLine } from './quoteImport'

export type VendorRfqResponseResult = {
  updatedLines: QuoteLine[]
  updatedCount: number
  unmatchedCount: number
}

export async function applyVendorRfqResponseFile(file: File, lines: QuoteLine[]): Promise<VendorRfqResponseResult> {
  const responseRows = (await parseQuoteImportFile(file))
    .map(normalizeResponseRow)
    .filter(row => row.unitCost > 0 || row.quoteNumber || row.leadTime)
  const matchedRowIndexes = new Set<number>()
  let updatedCount = 0

  const updatedLines = lines.map(line => {
    const responseIndex = responseRows.findIndex((row, index) => {
      if (matchedRowIndexes.has(index)) return false
      return normalize(row.clin) === normalize(line.clin) || normalize(row.partNumber) === normalize(line.partNumber)
    })

    if (responseIndex < 0) return line

    const response = responseRows[responseIndex]
    matchedRowIndexes.add(responseIndex)
    updatedCount += 1

    return {
      ...line,
      vendor: response.vendor || line.vendor,
      quoteNumber: response.quoteNumber || line.quoteNumber,
      unitCost: response.unitCost > 0 ? response.unitCost : line.unitCost,
      leadTime: response.leadTime || line.leadTime,
    }
  })

  return {
    updatedLines,
    updatedCount,
    unmatchedCount: responseRows.length - matchedRowIndexes.size,
  }
}

function normalizeResponseRow(row: ImportedQuoteLine) {
  return {
    clin: row.clin,
    partNumber: row.partNumber,
    vendor: row.vendor,
    quoteNumber: row.quoteNumber,
    unitCost: row.unitCost,
    leadTime: row.leadTime,
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}
