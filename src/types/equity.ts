export type AnalystEstimate = {
  fiscalYear: number
  forwardEps: number
  forwardRevenue: number
  forwardEbitda: number
  consensus: 'Bullish' | 'Neutral' | 'Bearish'
}

export type PricePoint = {
  date: string
  close: number
}

export type FinancialTrendPoint = {
  year: number
  revenue: number
  netIncome: number
  freeCashFlow: number
}

export type EquityRecord = {
  ticker: string
  name: string
  sector: string
  industry: string
  currentPrice: number
  marketCap: number
  revenue: number
  netIncome: number
  eps: number
  freeCashFlow: number
  totalDebt: number
  cash: number
  enterpriseValue: number
  ebitda: number
  bookValue: number
  shareholdersEquity: number
  grossMargin: number
  operatingMargin: number
  netMargin: number
  revenueGrowth: number
  earningsGrowth: number
  priceChange6m: number
  recentEarningsSurprise: number
  sharesOutstandingGrowth: number
  analystEstimate?: AnalystEstimate
  priceHistory: PricePoint[]
  financialTrends: FinancialTrendPoint[]
  peers: string[]
}

export type ValuationMetrics = {
  pe: number | null
  forwardPe: number | null
  evEbitda: number | null
  priceSales: number | null
  priceBook: number | null
  freeCashFlowYield: number | null
  pegRatio: number | null
  debtEquity: number | null
  revenueGrowth: number
  grossMargin: number
  operatingMargin: number
  netMargin: number
}

export type ScoreBreakdown = {
  value: number
  quality: number
  growth: number
  risk: number
  momentum: number
  composite: number
}

export type RiskFlag = {
  key: string
  label: string
  severity: 'low' | 'medium' | 'high'
  detail: string
}

export type BenchmarkSet = {
  sectorAverage: ValuationMetrics
  industryAverage: ValuationMetrics
  peers: Array<EquityRecord & { metrics: ValuationMetrics }>
}

export type EquityAnalysis = {
  equity: EquityRecord
  metrics: ValuationMetrics
  benchmarks: BenchmarkSet
  scores: ScoreBreakdown
  riskFlags: RiskFlag[]
  explanation: {
    summary: string
    positives: string[]
    cautions: string[]
  }
}

export type WatchlistEntry = {
  ticker: string
  addedAt: string
  scoreHistory: Array<{
    date: string
    composite: number
  }>
}
