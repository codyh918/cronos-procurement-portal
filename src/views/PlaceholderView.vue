<template>
  <section class="placeholder-page">
    <h1>{{ title }}</h1>
    <p>This route is staged for the Vue/TypeScript port.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => String(route.meta.title ?? 'Procurement'))
</script>
