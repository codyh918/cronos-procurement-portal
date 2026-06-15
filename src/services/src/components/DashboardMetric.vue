<template>
  <RouterLink class="metric-card" :to="href">
    <div class="metric-top">
      <div class="metric-icon" :class="toneClass">
        <component :is="icon" :size="20" />
      </div>
      <div class="metric-copy">
        <p>{{ label }}</p>
        <strong>{{ value }}</strong>
      </div>
    </div>
    <span class="metric-action">{{ action }} -&gt;</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { Tone } from '../types'

const props = withDefaults(
  defineProps<{
    href: string
    label: string
    value: string | number
    action: string
    icon: Component
    tone?: Tone
  }>(),
  { tone: 'default' },
)

const toneClass = computed(() => `tone-${props.tone}`)
</script>
