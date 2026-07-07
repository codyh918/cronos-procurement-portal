<template>
  <section class="scout-section">
    <div class="section-heading">
      <h2>Benchmark Comparison</h2>
      <p>Sector, industry, and peer context for the active ticker.</p>
    </div>
    <div class="comparison-table-wrap">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>P/E</th>
            <th>Forward P/E</th>
            <th>EV/EBITDA</th>
            <th>P/S</th>
            <th>FCF Yield</th>
            <th>Rev Growth</th>
            <th>Net Margin</th>
          </tr>
        </thead>
        <tbody>
          <tr class="active-row">
            <td>{{ analysis.equity.ticker }}</td>
            <td>{{ multiple(analysis.metrics.pe) }}</td>
            <td>{{ multiple(analysis.metrics.forwardPe) }}</td>
            <td>{{ multiple(analysis.metrics.evEbitda) }}</td>
            <td>{{ multiple(analysis.metrics.priceSales) }}</td>
            <td>{{ percent(analysis.metrics.freeCashFlowYield) }}</td>
            <td>{{ percent(analysis.metrics.revenueGrowth) }}</td>
            <td>{{ percent(analysis.metrics.netMargin) }}</td>
          </tr>
          <tr>
            <td>Sector avg</td>
            <td>{{ multiple(analysis.benchmarks.sectorAverage.pe) }}</td>
            <td>{{ multiple(analysis.benchmarks.sectorAverage.forwardPe) }}</td>
            <td>{{ multiple(analysis.benchmarks.sectorAverage.evEbitda) }}</td>
            <td>{{ multiple(analysis.benchmarks.sectorAverage.priceSales) }}</td>
            <td>{{ percent(analysis.benchmarks.sectorAverage.freeCashFlowYield) }}</td>
            <td>{{ percent(analysis.benchmarks.sectorAverage.revenueGrowth) }}</td>
            <td>{{ percent(analysis.benchmarks.sectorAverage.netMargin) }}</td>
          </tr>
          <tr>
            <td>Industry avg</td>
            <td>{{ multiple(analysis.benchmarks.industryAverage.pe) }}</td>
            <td>{{ multiple(analysis.benchmarks.industryAverage.forwardPe) }}</td>
            <td>{{ multiple(analysis.benchmarks.industryAverage.evEbitda) }}</td>
            <td>{{ multiple(analysis.benchmarks.industryAverage.priceSales) }}</td>
            <td>{{ percent(analysis.benchmarks.industryAverage.freeCashFlowYield) }}</td>
            <td>{{ percent(analysis.benchmarks.industryAverage.revenueGrowth) }}</td>
            <td>{{ percent(analysis.benchmarks.industryAverage.netMargin) }}</td>
          </tr>
          <tr v-for="peer in analysis.benchmarks.peers" :key="peer.ticker">
            <td>{{ peer.ticker }}</td>
            <td>{{ multiple(peer.metrics.pe) }}</td>
            <td>{{ multiple(peer.metrics.forwardPe) }}</td>
            <td>{{ multiple(peer.metrics.evEbitda) }}</td>
            <td>{{ multiple(peer.metrics.priceSales) }}</td>
            <td>{{ percent(peer.metrics.freeCashFlowYield) }}</td>
            <td>{{ percent(peer.metrics.revenueGrowth) }}</td>
            <td>{{ percent(peer.metrics.netMargin) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { EquityAnalysis } from '../../types/equity'

defineProps<{
  analysis: EquityAnalysis
}>()

const multiple = (value: number | null) => (value === null ? 'N/A' : `${value.toFixed(1)}x`)
const percent = (value: number | null) => (value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`)
</script>
