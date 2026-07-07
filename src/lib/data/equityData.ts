import type { BenchmarkSet, EquityAnalysis, EquityRecord, WatchlistEntry } from '../../types/equity'
import { detectRiskFlags } from '../risk/riskFlags'
import { calculateScores } from '../scoring/equityScoring'
import { averageMetrics, calculateValuationMetrics } from '../valuation/metrics'
import { mockEquities } from './mockEquities'

const WATCHLIST_KEY = 'equity-scout.watchlist'

export function listEquities() {
  return mockEquities
}

export function findEquity(ticker: string) {
  return mockEquities.find(equity => equity.ticker.toUpperCase() === ticker.trim().toUpperCase()) ?? null
}

export function buildBenchmarks(equity: EquityRecord): BenchmarkSet {
  const sectorRecords = mockEquities.filter(item => item.sector === equity.sector && item.ticker !== equity.ticker)
  const industryRecords = mockEquities.filter(item => item.industry === equity.industry && item.ticker !== equity.ticker)
  const seededPeers = equity.peers
    .map(peerTicker => findEquity(peerTicker))
    .filter((peer): peer is EquityRecord => peer !== null)
  const supplementalPeers = [...industryRecords, ...sectorRecords, ...mockEquities]
    .filter(item => item.ticker !== equity.ticker)
    .filter(item => !seededPeers.some(peer => peer.ticker === item.ticker))
  const peers = [...seededPeers, ...supplementalPeers].slice(0, 5)

  return {
    sectorAverage: averageMetrics(sectorRecords.length ? sectorRecords : peers),
    industryAverage: averageMetrics(industryRecords.length ? industryRecords : peers),
    peers: peers.map(peer => ({ ...peer, metrics: calculateValuationMetrics(peer) })),
  }
}

export function analyzeEquity(ticker: string): EquityAnalysis | null {
  const equity = findEquity(ticker)
  if (!equity) return null

  const metrics = calculateValuationMetrics(equity)
  const benchmarks = buildBenchmarks(equity)
  const scores = calculateScores(equity, metrics)
  const riskFlags = detectRiskFlags(equity, metrics)

  const sectorPe = benchmarks.sectorAverage.pe
  const peDiscount = sectorPe && metrics.pe ? (sectorPe - metrics.pe) / sectorPe : 0
  const fcfYield = (metrics.freeCashFlowYield ?? 0) * 100
  const positives = [
    peDiscount > 0.08 ? `P/E is ${(peDiscount * 100).toFixed(0)}% below the sector average.` : '',
    fcfYield > 4 ? `Free cash flow yield is ${fcfYield.toFixed(1)}%, giving the business visible cash return support.` : '',
    equity.revenueGrowth > 0.1 ? `Revenue is growing ${(equity.revenueGrowth * 100).toFixed(1)}%, which supports a higher quality valuation case.` : '',
    equity.netMargin > (benchmarks.industryAverage.netMargin ?? 0) ? 'Net margin is ahead of the industry average.' : '',
  ].filter(Boolean)

  const cautions = [
    metrics.pe && sectorPe && metrics.pe > sectorPe ? 'P/E is above the sector average, so the valuation case depends more on growth or quality.' : '',
    fcfYield < 1 ? 'Free cash flow yield is low or negative.' : '',
    equity.revenueGrowth < 0 ? 'Revenue is declining, which can make cheap multiples a value trap.' : '',
    riskFlags.length ? `${riskFlags.length} risk flag${riskFlags.length === 1 ? '' : 's'} require review before relying on the score.` : '',
  ].filter(Boolean)

  const posture = scores.composite >= 72 ? 'appears potentially undervalued' : scores.composite >= 55 ? 'looks mixed but worth monitoring' : 'does not screen as clearly undervalued'
  const summary = `${equity.ticker} ${posture} in this mock model. The composite score is ${scores.composite}/100, led by a ${scores.value}/100 value score and ${scores.quality}/100 quality score.`

  return { equity, metrics, benchmarks, scores, riskFlags, explanation: { summary, positives, cautions } }
}

export function loadWatchlist(): WatchlistEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) ?? '[]') as WatchlistEntry[]
  } catch {
    return []
  }
}

export function saveWatchlist(entries: WatchlistEntry[]) {
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries))
}

export function toggleWatchlistTicker(ticker: string, compositeScore: number) {
  const entries = loadWatchlist()
  const normalized = ticker.toUpperCase()
  const existing = entries.find(entry => entry.ticker === normalized)
  if (existing) {
    saveWatchlist(entries.filter(entry => entry.ticker !== normalized))
    return false
  }

  const today = new Date().toISOString().slice(0, 10)
  saveWatchlist([
    ...entries,
    {
      ticker: normalized,
      addedAt: today,
      scoreHistory: [
        { date: '2026-06-01', composite: Math.max(0, compositeScore - 4) },
        { date: '2026-06-15', composite: Math.max(0, compositeScore - 1) },
        { date: today, composite: compositeScore },
      ],
    },
  ])
  return true
}
