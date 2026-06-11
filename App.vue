<template>
  <RouterView v-if="isPublicOrderTracking" />
  <AuthGate v-else>
    <AppShell>
      <RouterView />
    </AppShell>
  </AuthGate>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import AuthGate from './components/AuthGate.vue'

const route = useRoute()
const isPublicOrderTracking = computed(() => route.path.startsWith('/orders/track'))
</script>
