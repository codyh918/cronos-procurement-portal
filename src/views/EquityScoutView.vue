<template>
  <div class="equity-scout-app">
    <header class="scout-topbar">
      <div>
        <span class="product-kicker">Research workspace</span>
        <h1>Equity Scout</h1>
      </div>
      <button class="theme-toggle" type="button" :aria-label="themeLabel" @click="toggleTheme">
        <component :is="themeIcon" :size="18" aria-hidden="true" />
      </button>
    </header>

    <main class="scout-layout">
      <section class="scout-main">
        <section class="search-panel">
          <div>
            <h2>Screen public equities for valuation dislocations</h2>
            <p>Search the mock data set by ticker or company name. Live market APIs can replace the mock API layer later.</p>
          </div>
          <form class="ticker-search" @submit.prevent="submitSearch">
            <Search :size="20" aria-hidden="true" />
            <input v-model="query" type="search" placeholder="Search AAPL, MSFT, GM, TSLA..." list="ticker-options" />
            <datalist id="ticker-options">
              <option v-for="equity in equities" :key="equity.ticker" :value="equity.ticker">{{ equity.name }}</option>
            </datalist>
            <button type="submit">Analyze</button>
          </form>
          <p v-if="message" class="form-message">{{ message }}</p>
        </section>

        <template v-if="analysis">
          <section class="company-header">
            <div>
              <div class="company-title-row">
                <h2>{{ analysis.equity.ticker }}</h2>
                <span>{{ analysis.equity.name }}</span>
              </div>
              <p>{{ analysis.equity.sector }} / {{ analysis.equity.industry }}</p>
            </div>
            <div class="company-actions">
              <div class="price-block">
                <span>Current price</span>
                <strong>{{ currency(analysis.equity.currentPrice, 'price') }}</strong>
              </div>
              <button class="watch-button" type="button" @click="toggleWatchlist">
                <component :is="isWatched ? StarOff : Star" :size="18" aria-hidden="true" />
                {{ isWatched ? 'Remove' : 'Watch' }}
              </button>
            </div>
          </section>

          <section class="score-board">
            <ScoreRing :score="analysis.scores.composite" label="Composite" />
            <div class="score-bars">
              <div v-for="score in scoreRows" :key="score.label" class="score-bar-row">
                <span>{{ score.label }}</span>
                <div><i :style="{ width: `${score.value}%` }"></i></div>
                <strong>{{ score.value }}</strong>
              </div>
            </div>
          </section>

          <section class="fundamentals-strip">
            <article>
              <span>Market cap</span>
              <strong>{{ currency(analysis.equity.marketCap) }}</strong>
            </article>
            <article>
              <span>Revenue</span>
              <strong>{{ currency(analysis.equity.revenue) }}</strong>
            </article>
            <article>
              <span>Net income</span>
              <strong>{{ currency(analysis.equity.netIncome) }}</strong>
            </article>
            <article>
              <span>EPS</span>
              <strong>{{ currency(analysis.equity.eps, 'price') }}</strong>
            </article>
            <article>
              <span>Free cash flow</span>
              <strong>{{ currency(analysis.equity.freeCashFlow) }}</strong>
            </article>
            <article>
              <span>Enterprise value</span>
              <strong>{{ currency(analysis.equity.enterpriseValue) }}</strong>
            </article>
            <article>
              <span>Total debt</span>
              <strong>{{ currency(analysis.equity.totalDebt) }}</strong>
            </article>
            <article>
              <span>Cash</span>
              <strong>{{ currency(analysis.equity.cash) }}</strong>
            </article>
          </section>

          <MetricGrid :metrics="analysis.metrics" />

          <section v-if="analysis.equity.analystEstimate" class="estimate-panel">
            <div class="section-heading">
              <h2>Analyst Forward Estimates</h2>
              <p>Mock consensus estimates, included to show the API contract.</p>
            </div>
            <div class="estimate-grid">
              <article>
                <span>Fiscal year</span>
                <strong>{{ analysis.equity.analystEstimate.fiscalYear }}</strong>
              </article>
              <article>
                <span>Forward EPS</span>
                <strong>{{ currency(analysis.equity.analystEstimate.forwardEps, 'price') }}</strong>
              </article>
              <article>
                <span>Forward revenue</span>
                <strong>{{ currency(analysis.equity.analystEstimate.forwardRevenue) }}</strong>
              </article>
              <article>
                <span>Forward EBITDA</span>
                <strong>{{ currency(analysis.equity.analystEstimate.forwardEbitda) }}</strong>
              </article>
              <article>
                <span>Consensus</span>
                <strong>{{ analysis.equity.analystEstimate.consensus }}</strong>
              </article>
            </div>
          </section>

          <div class="two-column">
            <TrendChart :ticker="analysis.equity.ticker" :prices="analysis.equity.priceHistory" :trends="analysis.equity.financialTrends" />
            <RiskFlags :flags="analysis.riskFlags" />
          </div>

          <ComparisonTable :analysis="analysis" />
          <ExplanationPanel :analysis="analysis" />
        </template>
      </section>

      <WatchlistPanel :entries="watchlist" @select="selectTicker" />
    </main>

    <footer class="scout-disclaimer">
      This tool is for educational and research purposes only. It does not provide financial, investment, tax, or legal advice. Users are responsible for their own investment decisions.
      Version 1 does not include live trading or brokerage order placement.
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Moon, Search, Star, StarOff, Sun } from '@lucide/vue'
import ComparisonTable from '../components/equity/ComparisonTable.vue'
import ExplanationPanel from '../components/equity/ExplanationPanel.vue'
import MetricGrid from '../components/equity/MetricGrid.vue'
import RiskFlags from '../components/equity/RiskFlags.vue'
import ScoreRing from '../components/equity/ScoreRing.vue'
import TrendChart from '../components/equity/TrendChart.vue'
import WatchlistPanel from '../components/equity/WatchlistPanel.vue'
import { getEquityAnalysis } from '../api/equity'
import { listEquities, loadWatchlist, toggleWatchlistTicker } from '../lib/data/equityData'
import type { EquityAnalysis, WatchlistEntry } from '../types/equity'

const equities = listEquities()
const query = ref('GM')
const message = ref('')
const analysis = ref<EquityAnalysis | null>(null)
const watchlist = ref<WatchlistEntry[]>([])
const theme = ref(document.documentElement.dataset.theme ?? 'light')

const isWatched = computed(() => watchlist.value.some(entry => entry.ticker === analysis.value?.equity.ticker))
const themeIcon = computed(() => (theme.value === 'dark' ? Sun : Moon))
const themeLabel = computed(() => (theme.value === 'dark' ? 'Use light theme' : 'Use dark theme'))
const scoreRows = computed(() => {
  if (!analysis.value) return []
  return [
    { label: 'Value', value: analysis.value.scores.value },
    { label: 'Quality', value: analysis.value.scores.quality },
    { label: 'Growth', value: analysis.value.scores.growth },
    { label: 'Risk', value: analysis.value.scores.risk },
    { label: 'Momentum', value: analysis.value.scores.momentum },
  ]
})

onMounted(async () => {
  watchlist.value = loadWatchlist()
  await runAnalysis(query.value)
})

async function submitSearch() {
  await runAnalysis(query.value)
}

async function runAnalysis(ticker: string) {
  const result = await getEquityAnalysis(ticker)
  if (!result) {
    message.value = `No mock data found for "${ticker}". Try AAPL, MSFT, GOOGL, META, GM, F, TSLA, or NVDA.`
    return
  }

  query.value = result.equity.ticker
  analysis.value = result
  message.value = ''
}

function selectTicker(ticker: string) {
  query.value = ticker
  void runAnalysis(ticker)
}

function toggleWatchlist() {
  if (!analysis.value) return
  toggleWatchlistTicker(analysis.value.equity.ticker, analysis.value.scores.composite)
  watchlist.value = loadWatchlist()
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  window.localStorage.setItem('equity-scout.theme', theme.value)
}

function currency(value: number, mode: 'compact' | 'price' = 'compact') {
  if (mode === 'price') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  }
  return `$${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`
}
</script>
