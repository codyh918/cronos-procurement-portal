<template>
  <div class="customer-orders-page">
    <header class="page-heading">
      <div>
        <h1>Customer Orders</h1>
        <p>Create and manage customer-facing order tracking records.</p>
      </div>
      <a class="secondary-action order-public-link" href="/orders/track" target="_blank" rel="noreferrer">
        <ExternalLink :size="17" />
        <span>Public Tracker</span>
      </a>
    </header>

    <div v-if="message" class="save-message success-message">{{ message }}</div>

    <section class="customer-order-card">
      <div class="customer-order-card-heading">
        <h2>Create Customer Order</h2>
        <p>This creates the customer-facing order record. Add line items from the order detail page.</p>
      </div>

      <form class="customer-order-form" @submit.prevent="createOrder">
        <label class="form-field">
          <span>Cronos Order #</span>
          <input v-model="form.orderNumber" required />
        </label>
        <label class="form-field">
          <span>Customer PO #</span>
          <input v-model="form.customerPoNumber" required />
        </label>
        <label class="form-field">
          <span>Customer / Agency</span>
          <input v-model="form.customerName" required />
        </label>
        <label class="form-field">
          <span>Project Name</span>
          <input v-model="form.projectName" />
        </label>
        <label class="form-field">
          <span>Order Date</span>
          <input v-model="form.orderDate" type="date" />
        </label>
        <label class="form-field">
          <span>Overall Status</span>
          <select v-model="form.overallStatus">
            <option v-for="status in customerOrderStatuses" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
        </label>
        <label class="form-field">
          <span>Customer Contact</span>
          <input v-model="form.customerContactName" />
        </label>
        <label class="form-field">
          <span>Customer Email</span>
          <input v-model="form.customerContactEmail" type="email" />
        </label>
        <label class="form-field">
          <span>Estimated Ship Date</span>
          <input v-model="form.estimatedShipDate" type="date" />
        </label>
        <label class="form-field">
          <span>Cronos Contact</span>
          <input v-model="form.cronosContactName" />
        </label>
        <label class="form-field">
          <span>Cronos Email</span>
          <input v-model="form.cronosContactEmail" type="email" />
        </label>
        <label class="form-field">
          <span>Customer Notes</span>
          <input v-model="form.publicNotes" />
        </label>
        <button class="primary-action order-create-button" type="submit">
          <Plus :size="17" />
          <span>Create Order</span>
        </button>
      </form>
    </section>

    <section class="customer-order-card register-card">
      <h2>Order Register</h2>

      <div class="data-table-frame customer-order-table-frame">
        <div class="table-scroll">
          <table class="data-table customer-order-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer PO</th>
                <th>Customer</th>
                <th>Project</th>
                <th>Status</th>
                <th>Items</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!orders.length">
                <td colspan="8">&nbsp;</td>
              </tr>
              <tr v-for="order in orders" :key="order.id">
                <td>
                  <RouterLink class="table-link" :to="`/admin/orders/${order.id}`">
                    {{ order.orderNumber }}
                  </RouterLink>
                </td>
                <td>{{ order.customerPoNumber }}</td>
                <td>{{ order.customerName }}</td>
                <td>{{ order.projectName || '-' }}</td>
                <td><StatusBadge :status="order.overallStatus" /></td>
                <td>{{ order.items.length }}</td>
                <td>{{ formatDate(order.updatedAt) }}</td>
                <td>
                  <div class="order-action-links">
                    <RouterLink class="table-link" :to="`/admin/orders/${order.id}/items`">Items</RouterLink>
                    <RouterLink class="table-link" :to="`/admin/orders/${order.id}/tracking-link`">Tracking Link</RouterLink>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ExternalLink, Plus } from '@lucide/vue'
import StatusBadge from '../components/StatusBadge.vue'
import { loadProjects } from '../services/localProjects'
import {
  createCustomerOrder,
  customerOrderStatuses,
  loadCustomerOrders,
  syncCustomerOrdersFromApprovedProjects,
} from '../services/customerOrders'
import { formatDisplayDate } from '../services/dateFormat'
import type { CustomerOrder, CustomerOrderInput } from '../types'

const orders = ref<CustomerOrder[]>(syncCustomerOrdersFromApprovedProjects(loadProjects()))
const form = reactive<CustomerOrderInput>(emptyOrder())
const message = ref('')

onMounted(() => {
  window.addEventListener('cronos:customer-orders-changed', refreshOrders)
  window.addEventListener('cronos:projects-changed', refreshOrders)
})

onUnmounted(() => {
  window.removeEventListener('cronos:customer-orders-changed', refreshOrders)
  window.removeEventListener('cronos:projects-changed', refreshOrders)
})

function createOrder() {
  const order = createCustomerOrder({ ...form })
  refreshOrders()
  Object.assign(form, emptyOrder())
  message.value = `${order.orderNumber} created.`
}

function refreshOrders() {
  orders.value = syncCustomerOrdersFromApprovedProjects(loadProjects())
}

function emptyOrder(): CustomerOrderInput {
  return {
    orderNumber: '',
    customerPoNumber: '',
    customerName: '',
    projectName: '',
    orderDate: new Date().toISOString().slice(0, 10),
    overallStatus: 'Pending Procurement',
    customerContactName: '',
    customerContactEmail: '',
    cronosContactName: 'Cody Hibbard',
    cronosContactEmail: 'cody.hibbard@cronosllc.com',
    estimatedShipDate: '',
    publicNotes: '',
    internalNotes: '',
  }
}

function formatDate(value: string) {
  return formatDisplayDate(value)
}
</script>
