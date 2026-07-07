import type { EquityRecord, ValuationMetrics } from '../../types/equity'

export function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  return numerator / denominator
}

export function calculateValuationMetrics(equity: EquityRecord): ValuationMetrics {
  const forwardEps = equity.analystEstimate?.forwardEps ?? 0
  const forwardEbitda = equity.analystEstimate?.forwardEbitda ?? 0

  return {
    pe: safeRatio(equity.currentPrice, equity.eps),
    forwardPe: safeRatio(equity.currentPrice, forwardEps),
    evEbitda: safeRatio(equity.enterpriseValue, forwardEbitda || equity.ebitda),
    priceSales: safeRatio(equity.marketCap, equity.revenue),
    priceBook: safeRatio(equity.marketCap, equity.bookValue),
    freeCashFlowYield: safeRatio(equity.freeCashFlow, equity.marketCap),
    pegRatio: safeRatio(safeRatio(equity.currentPrice, equity.eps) ?? 0, equity.earningsGrowth * 100),
    debtEquity: safeRatio(equity.totalDebt, equity.shareholdersEquity),
    revenueGrowth: equity.revenueGrowth,
    grossMargin: equity.grossMargin,
    operatingMargin: equity.operatingMargin,
    netMargin: equity.netMargin,
  }
}

export function averageMetrics(records: EquityRecord[]): ValuationMetrics {
  const metrics = records.map(calculateValuationMetrics)
  const average = (selector: (metric: ValuationMetrics) => number | null) => {
    const values = metrics.map(selector).filter((value): value is number => value !== null && Number.isFinite(value))
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  return {
    pe: average(metric => metric.pe),
    forwardPe: average(metric => metric.forwardPe),
    evEbitda: average(metric => metric.evEbitda),
    priceSales: average(metric => metric.priceSales),
    priceBook: average(metric => metric.priceBook),
    freeCashFlowYield: average(metric => metric.freeCashFlowYield),
    pegRatio: average(metric => metric.pegRatio),
    debtEquity: average(metric => metric.debtEquity),
    revenueGrowth: average(metric => metric.revenueGrowth) ?? 0,
    grossMargin: average(metric => metric.grossMargin) ?? 0,
    operatingMargin: average(metric => metric.operatingMargin) ?? 0,
    netMargin: average(metric => metric.netMargin) ?? 0,
  }
}
