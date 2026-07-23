import type { QuoteLine } from '../types'
import type { ImportedQuoteLine } from './quoteImport'

export type ManufacturerUpdateResult = {
  updatedLines: QuoteLine[]
  updatedCount: number
  unchangedCount: number
  skippedCount: number
  unmatchedCount: number
}

export function applyManufacturerUpdates(rows: ImportedQuoteLine[], currentLines: QuoteLine[]): ManufacturerUpdateResult
