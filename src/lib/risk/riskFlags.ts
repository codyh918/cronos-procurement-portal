import type { EquityRecord, RiskFlag, ValuationMetrics } from '../../types/equity'

export function detectRiskFlags(equity: EquityRecord, metrics: ValuationMetrics): RiskFlag[] {
  const flags: RiskFlag[] = []

  if ((metrics.debtEquity ?? 0) > 1.6) {
    flags.push({ key: 'high-debt', label: 'High debt', severity: 'high', detail: `Debt/equity is ${metrics.debtEquity?.toFixed(2)}x.` })
  }
  if (equity.freeCashFlow < 0) {
    flags.push({ key: 'negative-fcf', label: 'Negative free cash flow', severity: 'high', detail: 'Recent free cash flow is below zero.' })
  }
  if (equity.revenueGrowth < 0) {
    flags.push({ key: 'declining-revenue', label: 'Declining revenue', severity: 'medium', detail: `Revenue growth is ${(equity.revenueGrowth * 100).toFixed(1)}%.` })
  }
  if (equity.operatingMargin < 0.06 || equity.netMargin < 0.04) {
    flags.push({ key: 'shrinking-margins', label: 'Margin pressure', severity: 'medium', detail: 'Operating or net margins are thin versus most profitable peers.' })
  }
  if (equity.priceChange6m < -0.18) {
    flags.push({ key: 'large-price-drop', label: 'Recent large price drop', severity: 'medium', detail: `Six-month price move is ${(equity.priceChange6m * 100).toFixed(1)}%.` })
  }
  if (equity.recentEarningsSurprise < -0.04) {
    flags.push({ key: 'earnings-miss', label: 'Earnings miss', severity: 'medium', detail: `Latest surprise was ${(equity.recentEarningsSurprise * 100).toFixed(1)}%.` })
  }
  if (equity.sharesOutstandingGrowth > 0.015) {
    flags.push({ key: 'dilution-risk', label: 'Dilution risk', severity: 'medium', detail: `Share count growth is ${(equity.sharesOutstandingGrowth * 100).toFixed(1)}%.` })
  }
  if (equity.sector === 'Consumer Cyclical' && equity.priceChange6m < 0) {
    flags.push({ key: 'sector-weakness', label: 'Sector weakness', severity: 'low', detail: 'Consumer cyclical peers are being penalized in the mock data set.' })
  }

  return flags
}
