import type { EquityRecord, ScoreBreakdown, ValuationMetrics } from '../../types/equity'

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const inverseScore = (value: number | null, low: number, high: number) => {
  if (value === null) return 45
  return clamp(100 - ((value - low) / (high - low)) * 100)
}
const positiveScore = (value: number, low: number, high: number) => clamp(((value - low) / (high - low)) * 100)

export function calculateScores(equity: EquityRecord, metrics: ValuationMetrics): ScoreBreakdown {
  const value = clamp(
    inverseScore(metrics.pe, 8, 38) * 0.25 +
      inverseScore(metrics.forwardPe, 7, 32) * 0.2 +
      inverseScore(metrics.evEbitda, 6, 28) * 0.2 +
      inverseScore(metrics.priceSales, 0.5, 12) * 0.15 +
      inverseScore(metrics.priceBook, 0.6, 15) * 0.1 +
      positiveScore((metrics.freeCashFlowYield ?? 0) * 100, 0, 9) * 0.1,
  )

  const quality = clamp(
    positiveScore(equity.grossMargin * 100, 12, 75) * 0.22 +
      positiveScore(equity.operatingMargin * 100, 3, 45) * 0.24 +
      positiveScore(equity.netMargin * 100, 2, 35) * 0.24 +
      positiveScore((metrics.freeCashFlowYield ?? 0) * 100, -3, 8) * 0.15 +
      inverseScore(metrics.debtEquity, 0.1, 3.2) * 0.15,
  )

  const growth = clamp(
    positiveScore(equity.revenueGrowth * 100, -5, 28) * 0.42 +
      positiveScore(equity.earningsGrowth * 100, -10, 35) * 0.34 +
      positiveScore(((equity.analystEstimate?.forwardRevenue ?? equity.revenue) / equity.revenue - 1) * 100, -3, 18) * 0.24,
  )

  const risk = clamp(
    inverseScore(metrics.debtEquity, 0.2, 3.5) * 0.28 +
      positiveScore((metrics.freeCashFlowYield ?? 0) * 100, -5, 8) * 0.22 +
      positiveScore(equity.revenueGrowth * 100, -12, 12) * 0.18 +
      positiveScore(equity.recentEarningsSurprise * 100, -12, 8) * 0.16 +
      inverseScore(equity.sharesOutstandingGrowth * 100, -5, 8) * 0.16,
  )

  const momentum = clamp(
    positiveScore(equity.priceChange6m * 100, -25, 30) * 0.52 +
      positiveScore(equity.recentEarningsSurprise * 100, -10, 10) * 0.28 +
      positiveScore(equity.revenueGrowth * 100, -8, 20) * 0.2,
  )

  return {
    value,
    quality,
    growth,
    risk,
    momentum,
    composite: clamp(value * 0.3 + quality * 0.22 + growth * 0.18 + risk * 0.18 + momentum * 0.12),
  }
}
