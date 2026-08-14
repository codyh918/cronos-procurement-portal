import type { PricingVerificationStatus, QuoteLine } from '../types'
import { getSupabaseAccessToken } from './supabaseAuth'

export const PRICING_FRESHNESS_DAYS = positiveDays(import.meta.env.VITE_PRICING_FRESHNESS_DAYS, 30)

export type PricingVerificationResult = {
  lineId: string
  partNumber: string
  manufacturer: string
  currentQuoteCost: number | null
  catalogProductId: string | null
  catalogCost: number | null
  catalogVerifiedAt: string | null
  distributorCost: number | null
  availableQuantity: number | null
  availabilityStatus: string | null
  source: string
  verifiedAt: string | null
  status: PricingVerificationStatus
  delta: number | null
  percentDelta: number | null
}

type VerificationLine = Pick<QuoteLine, 'id' | 'partNumber' | 'manufacturer' | 'unitCost'>

export function quoteLinePricingStatus(line: QuoteLine, now = Date.now()): PricingVerificationStatus {
  if (line.pricingStatus === 'Verified' && line.pricingVerifiedAt) {
    const verifiedAt = Date.parse(line.pricingVerifiedAt)
    return Number.isFinite(verifiedAt) && now - verifiedAt <= PRICING_FRESHNESS_DAYS * 86400000 ? 'Verified' : 'Stale'
  }
  return line.pricingStatus || 'Unverified'
}

export function pricingVerificationSummary(lines: QuoteLine[]) {
  const verified = lines.filter(line => quoteLinePricingStatus(line) === 'Verified').length
  return { total: lines.length, verified, requiringVerification: lines.length - verified, allVerified: lines.length > 0 && verified === lines.length }
}

export function previewPricing(lines: VerificationLine[]) {
  return request('/api/pricing-verification/preview', lines, false, '')
}

export function applyVerifiedPricing(lines: VerificationLine[], options: { quoteId?: string; updateCatalog?: boolean }) {
  return request('/api/pricing-verification/apply', lines, options.updateCatalog === true, options.quoteId || '')
}

async function request(path: string, lines: VerificationLine[], updateCatalog: boolean, quoteId: string) {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('An authenticated Atlas session is required.')
  const response = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: lines.map(line => ({ lineId: line.id, partNumber: line.partNumber, manufacturer: line.manufacturer, currentCost: line.unitCost })), updateCatalog, quoteId }) })
  const payload = await response.json().catch(() => ({})) as { results?: PricingVerificationResult[]; error?: string; catalogUpdated?: boolean }
  if (!response.ok) throw new Error(payload.error || 'Pricing verification is temporarily unavailable.')
  return { results: payload.results || [], catalogUpdated: payload.catalogUpdated === true }
}

function positiveDays(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback }
