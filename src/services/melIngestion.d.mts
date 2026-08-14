export type MelField = 'ignore' | 'quantity' | 'description' | 'partNumber' | 'manufacturer' | 'alternatePartNumber' | 'category' | 'location' | 'room' | 'system' | 'notes' | 'clin'
export type MelSource = { filename: string; sheet: string; row: number; headerRow: number; parsingMethod: string; originalValues: Record<string, string> }
export type MelItem = { id: string; included: boolean; quantity: number; partNumber: string; manufacturer: string; description: string; alternatePartNumber: string; category: string; location: string; room: string; system: string; notes: string; clin: string; manufacturerSuggested: boolean; duplicate: boolean; confidence: { quantity: number; partNumber: number; description: number; manufacturer: number; overall: number }; source: MelSource; catalogMatch?: 'Catalog Match' | 'No Catalog Match' | 'Multiple Matches'; catalogProductId?: string | null }
export type MelSheetInput = { name: string; rows: string[][]; hidden?: boolean; hiddenRows?: number[]; hiddenColumns?: number[] }
export type MelSheetAnalysis = { name: string; hidden: boolean; rows: string[][]; rowCount: number; columnCount: number; score: number; mappingConfidence: number; headerRows: number[]; regions: Array<{ headerRow: number; endRow: number; mapping: Record<number, MelField>; mappingConfidence: number; score: number }>; items: MelItem[]; columns: Array<{ index: number; label: string; sample: string[] }> }
export type MelAnalysis = { filename: string; inspectedAt: string; worksheetsInspected: number; sheets: MelSheetAnalysis[]; selectedSheetNames: string[]; items: MelItem[]; averageConfidence: number; needsManualMapping: boolean; diagnostics: string }
export const MEL_FIELDS: MelField[]
export const MEL_CONFIDENCE_THRESHOLDS: { high: number; review: number }
export function analyzeMelWorkbook(workbook: { filename: string; sheets: MelSheetInput[] }, options?: Record<string, unknown>): MelAnalysis
export function analyzeSheet(sheet: MelSheetInput, options?: Record<string, unknown>): MelSheetAnalysis
export function remapMelSheet(sheet: MelSheetInput, mapping: Record<number, MelField>, headerRow?: number, options?: Record<string, unknown>): MelItem[]
