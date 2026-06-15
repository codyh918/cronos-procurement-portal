<template>
  <PublicOrderStatus v-if="order" :order="order" />

  <div v-else-if="loaded" class="public-invalid-page">
    <section class="public-invalid-card">
      <img src="/cronos-logo.jpg" alt="Cronos" />
      <h1>Tracking Link Not Available</h1>
      <p>This tracking link is invalid, disabled, or no longer available. Please contact your Cronos representative.</p>
      <RouterLink class="primary-action" to="/orders/track">Search by Order and PO</RouterLink>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PublicOrderStatus from '../components/PublicOrderStatus.vue'
import { findOrderByToken } from '../services/customerOrders'
import type { CustomerOrder } from '../types'

const route = useRoute()
const order = ref<CustomerOrder>()
const loaded = ref(false)

watch(
  () => route.params.token,
  async token => {
    loaded.value = false
    order.value = await findOrderByToken(decodeURIComponent(String(token ?? '')))
    loaded.value = true
  },
  { immediate: true },
)
</script>
