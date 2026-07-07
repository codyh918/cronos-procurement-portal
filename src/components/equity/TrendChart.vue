<template>
  <section class="scout-section chart-panel">
    <div class="section-heading">
      <h2>Price and Fundamentals</h2>
      <p>Historical mock trend data for research workflow testing.</p>
    </div>
    <svg class="trend-chart" viewBox="0 0 640 220" role="img" :aria-label="`${ticker} price history chart`">
      <polyline class="trend-grid" points="30,40 610,40" />
      <polyline class="trend-grid" points="30,110 610,110" />
      <polyline class="trend-grid" points="30,180 610,180" />
      <polyline class="trend-line" :points="pricePoints" />
      <circle v-for="point in circles" :key="`${point.x}-${point.y}`" :cx="point.x" :cy="point.y" r="3" />
    </svg>
    <div class="mini-bars">
      <div v-for="item in trends" :key="item.year" class="mini-bar-row">
        <span>{{ item.year }}</span>
        <div>
          <i :style="{ width: `${barWidth(item.revenue)}%` }"></i>
        </div>
        <strong>{{ compact(item.revenue) }} revenue</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FinancialTrendPoint, PricePoint } from '../../types/equity'

const props = defineProps<{
  ticker: string
  prices: PricePoint[]
  trends: FinancialTrendPoint[]
}>()

const circles = computed(() => {
  const closes = props.prices.map(point => point.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const spread = Math.max(1, max - min)
  return props.prices.map((point, index) => ({
    x: 30 + (index / Math.max(1, props.prices.length - 1)) * 580,
    y: 180 - ((point.close - min) / spread) * 140,
  }))
})

const pricePoints = computed(() => circles.value.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '))

const maxRevenue = computed(() => Math.max(...props.trends.map(item => item.revenue)))
const barWidth = (value: number) => Math.max(8, (value / maxRevenue.value) * 100)
const compact = (value: number) => `$${(value / 1000).toFixed(0)}B`
</script>
