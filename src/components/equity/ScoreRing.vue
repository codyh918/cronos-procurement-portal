<template>
  <div class="score-ring" :style="{ '--score': score }">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="score-ring-track" cx="60" cy="60" r="52" />
      <circle class="score-ring-value" cx="60" cy="60" r="52" />
    </svg>
    <div class="score-ring-label">
      <strong>{{ score }}</strong>
      <span>{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  score: number
  label: string
}>()
</script>
