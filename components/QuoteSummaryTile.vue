<template>
  <div class="quote-summary-tile">
    <p>{{ label }}</p>
    <strong>{{ value }}</strong>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string
}>()
</script>
