<template>
  <section class="scout-section explanation-panel">
    <div class="section-heading">
      <h2>Research Explanation</h2>
      <p>Plain-English readout of the valuation setup.</p>
    </div>
    <p class="explanation-summary">{{ analysis.explanation.summary }}</p>
    <div class="explanation-columns">
      <div>
        <h3>Why it may be undervalued</h3>
        <ul v-if="analysis.explanation.positives.length">
          <li v-for="item in analysis.explanation.positives" :key="item">{{ item }}</li>
        </ul>
        <p v-else class="empty-copy">The model does not find a strong undervaluation signal.</p>
      </div>
      <div>
        <h3>Why it may be overvalued or risky</h3>
        <ul v-if="analysis.explanation.cautions.length">
          <li v-for="item in analysis.explanation.cautions" :key="item">{{ item }}</li>
        </ul>
        <p v-else class="empty-copy">No major valuation cautions from the mock screen.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { EquityAnalysis } from '../../types/equity'

defineProps<{
  analysis: EquityAnalysis
}>()
</script>
