<template>
  <aside class="watchlist-panel">
    <div class="section-heading">
      <h2>Watchlist</h2>
      <p>Saved locally until Supabase auth is connected.</p>
    </div>
    <div v-if="entries.length" class="watchlist-items">
      <button v-for="entry in entries" :key="entry.ticker" type="button" class="watchlist-item" @click="$emit('select', entry.ticker)">
        <span>
          <strong>{{ entry.ticker }}</strong>
          <small>Added {{ entry.addedAt }}</small>
        </span>
        <em>{{ changeText(entry) }}</em>
      </button>
    </div>
    <p v-else class="empty-copy">Save tickers to track score changes over time.</p>
  </aside>
</template>

<script setup lang="ts">
import type { WatchlistEntry } from '../../types/equity'

defineEmits<{
  select: [ticker: string]
}>()

defineProps<{
  entries: WatchlistEntry[]
}>()

function changeText(entry: WatchlistEntry) {
  const first = entry.scoreHistory[0]?.composite ?? 0
  const last = entry.scoreHistory.at(-1)?.composite ?? first
  const change = last - first
  return `${change >= 0 ? '+' : ''}${change} pts`
}
</script>
