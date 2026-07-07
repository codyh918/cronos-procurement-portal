<template>
  <PublicOrderStatus v-if="order" :order="order" />

  <div v-else class="public-lookup-page">
    <section class="public-lookup-card">
      <div class="public-lookup-brand">
        <img src="/cronos-logo.jpg" alt="Cronos" />
        <div>
          <p>Cronos Customer Order Tracker</p>
          <h1>Check Order Status</h1>
          <span>Enter your Cronos order number or customer PO number to view procurement, shipment, and delivery status.</span>
        </div>
      </div>

      <form class="public-lookup-form" @submit.prevent="lookup">
        <label class="form-field">
          <span>Order Number or Customer PO Number</span>
          <input v-model="searchValue" required placeholder="Example: 26-077 or CACI-PO-001" />
        </label>
        <button class="primary-action public-lookup-button" type="submit">
          <Search :size="17" />
          <span>Check Order Status</span>
        </button>
      </form>

      <div v-if="message" class="public-error-message">{{ message }}</div>

      <div class="public-security-note">
        <ShieldCheck :size="20" />
        <p>Secure tracking links provide read-only access to a single order. Internal pricing, markup, and procurement notes are never shown on this customer page.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Search, ShieldCheck } from '@lucide/vue'
import PublicOrderStatus from '../components/PublicOrderStatus.vue'
import { findOrderByOrderOrPo } from '../services/customerOrders'
import type { CustomerOrder } from '../types'

const searchValue = ref('')
const order = ref<CustomerOrder>()
const message = ref('')

function lookup() {
  const found = findOrderByOrderOrPo(searchValue.value)
  order.value = found
  message.value = found ? '' : 'No order was found for that order number or customer PO number.'
}
</script>
