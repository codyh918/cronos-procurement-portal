<template>
  <div class="sewp-portal-nav">
    <RouterLink to="/sewp-rfqs/dashboard">Dashboard</RouterLink>
    <RouterLink to="/sewp-rfqs/work-queue">Work Queue</RouterLink>
    <RouterLink class="sewp-nav-create" to="/sewp-rfqs/new"><Plus :size="16" /> New RFQ</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@lucide/vue'
</script>
