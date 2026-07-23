import type { QuoteLine } from '../types'
import { parseQuoteImportFile } from './quoteImport'
import { applyManufacturerUpdates } from './manufacturerMatching.mjs'

export type ManufacturerUpdateResult = {
  updatedLines: QuoteLine[]
  updatedCount: number
  unchangedCount: number
  skippedCount: number
  unmatchedCount: number
}

export async function applyManufacturerUpdateFile(file: File, currentLines: QuoteLine[]): Promise<ManufacturerUpdateResult> {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  if (!['.xlsx', '.xls', '.csv'].includes(extension)) throw new Error('Upload an XLSX, XLS, or CSV file with Line, Part #, and Manufacturer columns.')
  const rows = await parseQuoteImportFile(file)
  if (!rows.length) throw new Error('No quote line rows were found in this file.')
  return applyManufacturerUpdates(rows, currentLines) as ManufacturerUpdateResult
}

export { applyManufacturerUpdates }
