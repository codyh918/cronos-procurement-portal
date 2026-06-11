<template>
  <div v-if="!order" class="not-found-page">
    <h1>Customer order not found</h1>
    <RouterLink class="text-link" to="/admin/orders">Back to Orders</RouterLink>
  </div>

  <div v-else class="customer-order-detail-page">
    <header class="customer-order-detail-heading">
      <div>
        <RouterLink class="text-link detail-back-link" to="/admin/orders">Back to Customer Orders</RouterLink>
        <h1>{{ order.orderNumber }}</h1>
        <p>Customer PO {{ order.customerPoNumber }} | {{ order.customerName }}</p>
      </div>
      <div class="page-actions">
        <RouterLink class="secondary-action" :to="`/admin/orders/${order.id}/items`">Items</RouterLink>
        <RouterLink class="secondary-action" :to="`/admin/orders/${order.id}/tracking-link`">Tracking Link</RouterLink>
        <a class="primary-action" href="/orders/track" target="_blank" rel="noreferrer">Public Lookup</a>
      </div>
    </header>

    <div v-if="message" class="save-message">{{ message }}</div>

    <section v-if="mode === 'detail'" class="customer-order-card customer-order-edit-grid">
      <DetailField label="Order #" :value="order.orderNumber" @change="saveOrder({ orderNumber: $event })" />
      <DetailField label="Customer PO #" :value="order.customerPoNumber" @change="saveOrder({ customerPoNumber: $event })" />
      <DetailField label="Customer / Agency" :value="order.customerName" @change="saveOrder({ customerName: $event })" />
      <DetailField label="Project Name" :value="order.projectName" @change="saveOrder({ projectName: $event })" />
      <DetailField label="Order Date" type="date" :value="order.orderDate" @change="saveOrder({ orderDate: $event })" />
      <label class="form-field">
        <span>Overall Status</span>
        <select :value="order.overallStatus" @change="saveOrder({ overallStatus: inputValue($event) as CustomerOrderStatus })">
          <option v-for="status in customerOrderStatuses" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </label>
      <DetailField label="Estimated Ship" type="date" :value="order.estimatedShipDate" @change="saveOrder({ estimatedShipDate: $event })" />
      <DetailField label="Cronos Contact" :value="order.cronosContactName" @change="saveOrder({ cronosContactName: $event })" />
      <DetailField label="Cronos Email" :value="order.cronosContactEmail" @change="saveOrder({ cronosContactEmail: $event })" />
      <DetailField label="Customer-Facing Notes" :value="order.publicNotes" @change="saveOrder({ publicNotes: $event })" />
      <DetailField label="Internal Notes" :value="order.internalNotes" @change="saveOrder({ internalNotes: $event })" />
    </section>

    <template v-if="mode !== 'tracking'">
      <section class="customer-order-card">
        <h2>Add Line Item</h2>
        <div class="customer-order-item-form">
          <label class="form-field">
            <span>Line #</span>
            <input v-model="itemForm.lineNumber" />
          </label>
          <label class="form-field">
            <span>Manufacturer</span>
            <input v-model="itemForm.manufacturer" />
          </label>
          <label class="form-field">
            <span>Part Number</span>
            <input v-model="itemForm.partNumber" />
          </label>
          <label class="form-field">
            <span>Description</span>
            <input v-model="itemForm.description" />
          </label>
          <label class="form-field">
            <span>Qty Ordered</span>
            <input v-model.number="itemForm.quantityOrdered" min="0" type="number" />
          </label>
          <label class="form-field">
            <span>Vendor</span>
            <input v-model="itemForm.vendor" />
          </label>
          <label class="form-field">
            <span>Vendor PO #</span>
            <input v-model="itemForm.vendorPoNumber" />
          </label>
          <label class="form-field">
            <span>Expected Ship</span>
            <input v-model="itemForm.expectedShipDate" type="date" />
          </label>
        </div>
        <button class="primary-action add-item-button" type="button" @click="addItem">
          <Plus :size="17" />
          <span>Add Item</span>
        </button>
      </section>

      <section class="customer-order-card">
        <div class="line-items-heading">
          <h2>Line Items</h2>
          <StatusBadge :status="order.overallStatus" />
        </div>
        <div class="table-scroll">
          <table class="order-items-table">
            <thead>
              <tr>
                <th v-for="header in itemHeaders" :key="header">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items" :key="item.id">
                <td><input class="cell-input w-16" :value="item.lineNumber" @change="saveItem(item.id, { lineNumber: inputValue($event) })" /></td>
                <td><input class="cell-input w-36" :value="item.manufacturer" @change="saveItem(item.id, { manufacturer: inputValue($event) })" /></td>
                <td><input class="cell-input w-36" :value="item.partNumber" @change="saveItem(item.id, { partNumber: inputValue($event) })" /></td>
                <td><input class="cell-input w-64" :value="item.description" @change="saveItem(item.id, { description: inputValue($event) })" /></td>
                <td><input class="cell-input w-20" type="number" min="0" :value="item.quantityOrdered" @change="saveItem(item.id, { quantityOrdered: numberValue($event) })" /></td>
                <td><input class="cell-input w-20" type="number" min="0" :value="item.quantityReceived" @change="saveItem(item.id, { quantityReceived: numberValue($event) })" /></td>
                <td><input class="cell-input w-20" type="number" min="0" :value="item.quantityShipped" @change="saveItem(item.id, { quantityShipped: numberValue($event) })" /></td>
                <td><input class="cell-input w-36" :value="item.vendor" @change="saveItem(item.id, { vendor: inputValue($event) })" /></td>
                <td><input class="cell-input w-36" :value="item.vendorPoNumber" @change="saveItem(item.id, { vendorPoNumber: inputValue($event) })" /></td>
                <td><input class="cell-input w-36" type="date" :value="item.vendorPoDate" @change="saveItem(item.id, { vendorPoDate: inputValue($event) })" /></td>
                <td><input class="cell-input w-36" type="date" :value="item.expectedShipDate" @change="saveItem(item.id, { expectedShipDate: inputValue($event) })" /></td>
                <td><input class="cell-input w-28" :value="item.carrier" @change="saveItem(item.id, { carrier: inputValue($event) })" /></td>
                <td><input class="cell-input w-44" :value="item.trackingNumber" @change="saveItem(item.id, { trackingNumber: inputValue($event) })" /></td>
                <td>
                  <select class="cell-input w-48" :value="item.status" @change="saveItem(item.id, { status: inputValue($event) as CustomerOrderStatus })">
                    <option v-for="status in customerOrderStatuses" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </td>
                <td><input class="cell-input w-56" :value="item.customerVisibleNotes" @change="saveItem(item.id, { customerVisibleNotes: inputValue($event) })" /></td>
                <td><input class="cell-input w-56" :value="item.internalNotes" @change="saveItem(item.id, { internalNotes: inputValue($event) })" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <section v-if="mode !== 'items'" class="customer-order-card">
      <div class="tracking-card-heading">
        <div>
          <h2>Customer Tracking Link</h2>
          <p>Generate secure tokenized links. Only the hashed token is stored locally.</p>
        </div>
        <div class="page-actions">
          <button class="primary-action" type="button" @click="makeTrackingLink">
            <RefreshCw :size="17" />
            <span>Generate / Regenerate</span>
          </button>
          <button class="secondary-action" type="button" @click="copyEmailTemplate">
            <Copy :size="17" />
            <span>Copy Email Template</span>
          </button>
        </div>
      </div>

      <div v-if="latestLink" class="generated-link">{{ latestLink }}</div>

      <div class="table-scroll">
        <table class="tracking-token-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Created</th>
              <th>Last Accessed</th>
              <th>Token Hash</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="token in order.trackingTokens" :key="token.id">
              <td>{{ token.isActive ? 'Active' : 'Disabled' }}</td>
              <td>{{ formatDate(token.createdAt) }}</td>
              <td>{{ token.lastAccessedAt ? formatDate(token.lastAccessedAt) : 'Never' }}</td>
              <td class="token-hash">{{ token.tokenHash.slice(0, 18) }}...</td>
              <td>
                <button v-if="token.isActive" class="danger-link" type="button" @click="disableToken(token.id)">Disable</button>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Copy, Plus, RefreshCw } from '@lucide/vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  addCustomerOrderItem,
  customerOrderStatuses,
  disableTrackingToken,
  generateTrackingToken,
  loadCustomerOrder,
  updateCustomerOrder,
  updateCustomerOrderItem,
} from '../services/customerOrders'
import { formatDisplayDate } from '../services/dateFormat'
import type { CustomerOrder, CustomerOrderInput, CustomerOrderItemInput, CustomerOrderStatus } from '../types'

type Mode = 'detail' | 'items' | 'tracking'

const route = useRoute()
const order = ref<CustomerOrder>()
const latestLink = ref('')
const message = ref('')
const itemForm = reactive<CustomerOrderItemInput>(emptyItem())
const itemHeaders = [
  'Line',
  'Manufacturer',
  'Part',
  'Description',
  'Ordered',
  'Received',
  'Shipped',
  'Vendor',
  'Vendor PO',
  'PO Date',
  'Expected Ship',
  'Carrier',
  'Tracking',
  'Status',
  'Customer Notes',
  'Internal Notes',
]

const mode = computed<Mode>(() => {
  if (route.name === 'customer-order-items') return 'items'
  if (route.name === 'customer-order-tracking-link') return 'tracking'
  return 'detail'
})

watch(
  () => route.params.id,
  id => {
    order.value = loadCustomerOrder(String(id))
    latestLink.value = ''
    message.value = ''
    Object.assign(itemForm, emptyItem())
  },
  { immediate: true },
)

function saveOrder(updates: Partial<CustomerOrderInput>) {
  if (!order.value) return
  order.value = updateCustomerOrder(order.value.id, updates)
  message.value = 'Order updated.'
}

function addItem() {
  if (!order.value) return
  if (!itemForm.description.trim() || !itemForm.partNumber.trim()) {
    window.alert('Part number and description are required.')
    return
  }

  const updated = addCustomerOrderItem(order.value.id, {
    ...itemForm,
    lineNumber: itemForm.lineNumber || String(order.value.items.length + 1),
    quantityOrdered: Number(itemForm.quantityOrdered || 0),
    quantityReceived: Number(itemForm.quantityReceived || 0),
    quantityShipped: Number(itemForm.quantityShipped || 0),
  })
  order.value = updated
  Object.assign(itemForm, emptyItem(String(updated.items.length + 1)))
  message.value = 'Line item added.'
}

function saveItem(itemId: string, updates: Partial<CustomerOrderItemInput>) {
  if (!order.value) return
  order.value = updateCustomerOrderItem(order.value.id, itemId, updates)
}

async function makeTrackingLink() {
  if (!order.value) return

  const result = await generateTrackingToken(order.value.id)
  order.value = result.order
  latestLink.value = result.link
  await copyText(result.link)
  message.value = 'Customer tracking link generated and copied.'
}

async function copyEmailTemplate() {
  if (!order.value) return
  const link = latestLink.value || window.prompt('Paste the latest raw tracking link if it was generated earlier:', '') || ''
  if (!link) return

  const template = `Subject: Cronos Order Tracking Link - PO ${order.value.customerPoNumber}

Hello,

Your Cronos order can be tracked using the secure link below:

${link}

This page will show current procurement, shipping, and delivery status for the items on your order.

Thank you,
Cronos LLC`
  await copyText(template)
  message.value = 'Email template copied.'
}

function disableToken(tokenId: string) {
  if (!order.value) return
  order.value = disableTrackingToken(order.value.id, tokenId)
  message.value = 'Tracking link disabled.'
}

async function copyText(value: string) {
  try {
    await navigator.clipboard?.writeText(value)
  } catch {
    // Clipboard may be unavailable in non-secure or automated browser contexts.
  }
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function numberValue(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}

function emptyItem(lineNumber = ''): CustomerOrderItemInput {
  return {
    lineNumber,
    manufacturer: '',
    partNumber: '',
    description: '',
    quantityOrdered: 1,
    quantityReceived: 0,
    quantityShipped: 0,
    vendor: '',
    vendorPoNumber: '',
    vendorPoDate: '',
    expectedShipDate: '',
    carrier: '',
    trackingNumber: '',
    status: 'Pending Procurement',
    customerVisibleNotes: '',
    internalNotes: '',
  }
}

function formatDate(value: string) {
  return formatDisplayDate(value)
}

const DetailField = defineComponent({
  name: 'DetailField',
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
    type: { type: String, default: 'text' },
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () =>
      h('label', { class: 'form-field' }, [
        h('span', props.label),
        h('input', {
          type: props.type,
          value: props.value,
          onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).value),
        }),
      ])
  },
})
</script>
