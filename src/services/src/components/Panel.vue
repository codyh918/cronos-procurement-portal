<template>
  <section class="panel" :class="className">
    <header class="panel-header">
      <h3>{{ title }}</h3>
      <RouterLink v-if="action && actionHref" :to="actionHref">{{ action }}</RouterLink>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  action?: string
  actionHref?: string
  className?: string
}>()
</script>
