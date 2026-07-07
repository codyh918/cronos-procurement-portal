<template>
  <section class="scout-section risk-panel">
    <div class="section-heading">
      <h2>Risk Flags</h2>
      <p>Items that can turn a low multiple into a value trap.</p>
    </div>
    <div v-if="flags.length" class="risk-list">
      <article v-for="flag in flags" :key="flag.key" class="risk-item" :class="`risk-${flag.severity}`">
        <strong>{{ flag.label }}</strong>
        <span>{{ flag.detail }}</span>
      </article>
    </div>
    <p v-else class="empty-copy">No major mock-data risk flags detected.</p>
  </section>
</template>

<script setup lang="ts">
import type { RiskFlag } from '../../types/equity'

defineProps<{
  flags: RiskFlag[]
}>()
</script>
