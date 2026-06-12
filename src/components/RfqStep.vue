<template>
  <div class="rfq-step" :class="{ complete }">
    <div>
      <CheckCircle2 :size="17" />
      <p>{{ title }}</p>
    </div>
    <strong>{{ detail }}</strong>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle2 } from '@lucide/vue'

defineProps<{
  complete: boolean
  title: string
  detail: string
}>()
</script>
