<template>
  <section class="metric-grid" aria-label="Valuation metrics">
    <article v-for="metric in renderedMetrics" :key="metric.label" class="metric-tile">
      <span>{{ metric.label }}</span>
      <strong>{{ metric.value }}</strong>
      <small>{{ metric.context }}</small>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ValuationMetrics } from '../../types/equity'

const props = defineProps<{
  metrics: ValuationMetrics
}>()

const multiple = (value: number | null) => (value === null ? 'N/A' : `${value.toFixed(1)}x`)
const percent = (value: number | null) => (value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`)

const renderedMetrics = computed(() => [
  { label: 'P/E', value: multiple(props.metrics.pe), context: 'Trailing earnings' },
  { label: 'Forward P/E', value: multiple(props.metrics.forwardPe), context: 'Analyst EPS estimate' },
  { label: 'EV/EBITDA', value: multiple(props.metrics.evEbitda), context: 'Enterprise value basis' },
  { label: 'Price/Sales', value: multiple(props.metrics.priceSales), context: 'Revenue multiple' },
  { label: 'Price/Book', value: multiple(props.metrics.priceBook), context: 'Equity book value' },
  { label: 'FCF Yield', value: percent(props.metrics.freeCashFlowYield), context: 'Free cash flow / cap' },
  { label: 'PEG Ratio', value: multiple(props.metrics.pegRatio), context: 'P/E to growth' },
  { label: 'Debt/Equity', value: multiple(props.metrics.debtEquity), context: 'Balance sheet leverage' },
  { label: 'Revenue Growth', value: percent(props.metrics.revenueGrowth), context: 'Latest annual trend' },
  { label: 'Gross Margin', value: percent(props.metrics.grossMargin), context: 'Gross profit rate' },
  { label: 'Operating Margin', value: percent(props.metrics.operatingMargin), context: 'Operating profit rate' },
  { label: 'Net Margin', value: percent(props.metrics.netMargin), context: 'Bottom-line margin' },
])
</script>
