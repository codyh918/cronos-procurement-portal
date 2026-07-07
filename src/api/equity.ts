import { analyzeEquity, listEquities } from '../lib/data/equityData'

export async function searchTickers(query: string) {
  const normalized = query.trim().toUpperCase()
  return listEquities().filter(
    equity => equity.ticker.includes(normalized) || equity.name.toUpperCase().includes(normalized),
  )
}

export async function getEquityAnalysis(ticker: string) {
  return analyzeEquity(ticker)
}
