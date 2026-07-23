import type { QuoteLine } from '../types'
export function applyPricingToAllLines(lines: QuoteLine[], mode: 'markup' | 'margin', percent: number): QuoteLine[]
