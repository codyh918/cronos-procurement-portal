<template>
  <div class="public-order-status">
    <header class="public-status-header">
      <div class="public-status-header-inner">
        <div class="public-brand-row">
          <img src="/cronos-logo.jpg" alt="Cronos" />
          <div>
            <p>Cronos Customer Order Tracker</p>
            <h1>Order Status</h1>
          </div>
        </div>
        <button class="secondary-action" type="button" @click="printPage">
          <Printer :size="17" />
          <span>Print / Save PDF</span>
        </button>
      </div>
    </header>

    <main class="public-status-main">
      <section class="public-card">
        <div class="public-order-hero">
          <div>
            <p class="public-eyebrow">Cronos Order</p>
            <h2>{{ order.orderNumber }}</h2>
            <p class="public-subtitle">Customer PO {{ order.customerPoNumber }}</p>
          </div>
          <StatusBadge :status="order.overallStatus" />
        </div>

        <div class="public-info-grid">
          <InfoTile label="Customer / Agency" :value="order.customerName" />
          <InfoTile label="Project" :value="order.projectName" />
          <InfoTile label="Order Date" :value="formatDate(order.orderDate)" />
          <InfoTile label="Estimated Ship" :value="formatDateOrPending(order.estimatedShipDate)" />
          <InfoTile label="Last Updated" :value="formatDate(order.updatedAt)" />
          <InfoTile label="Cronos Contact" :value="`${order.cronosContactName} | ${order.cronosContactEmail}`" wide />
        </div>

        <div v-if="order.publicNotes" class="public-note">
          {{ order.publicNotes }}
        </div>
      </section>

      <section class="public-card">
        <h3>Order Timeline</h3>
        <div class="public-timeline-grid">
          <div v-for="(step, index) in timelineSteps" :key="step" class="public-timeline-step" :class="{ complete: index <= timelineIndex }">
            <div>
              <ShieldCheck :size="16" />
            </div>
            <p>{{ step }}</p>
          </div>
        </div>
      </section>

      <section class="public-card">
        <h3>Line Item Tracking</h3>
        <div class="table-scroll public-table-scroll">
          <table class="public-line-table">
            <thead>
              <tr>
                <th v-for="header in headers" :key="header">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in order.items" :key="item.id">
                <td class="strong-cell">{{ item.lineNumber }}</td>
                <td>{{ item.manufacturer || '-' }}</td>
                <td class="strong-cell">{{ item.partNumber || '-' }}</td>
                <td class="description-cell">
                  {{ item.description }}
                  <p v-if="item.customerVisibleNotes">{{ item.customerVisibleNotes }}</p>
                </td>
                <td>{{ item.quantityOrdered }}</td>
                <td>{{ item.quantityReceived }}</td>
                <td>{{ item.quantityShipped }}</td>
                <td>{{ item.vendor || 'Pending' }}</td>
                <td>{{ formatDateOrPending(item.vendorPoDate) }}</td>
                <td>{{ formatDateOrPending(item.expectedShipDate) }}</td>
                <td class="tracking-cell">{{ item.trackingNumber || 'Pending' }}</td>
                <td>{{ item.carrier || 'Pending' }}</td>
                <td><StatusBadge :status="item.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import { Printer, ShieldCheck } from '@lucide/vue'
import StatusBadge from './StatusBadge.vue'
import { getTimelineIndex, timelineSteps } from '../services/customerOrders'
import { formatDisplayDate } from '../services/dateFormat'
import type { CustomerOrder } from '../types'

const props = defineProps<{ order: CustomerOrder }>()

const headers = [
  'Line #',
  'Manufacturer',
  'Part Number',
  'Description',
  'Qty Ordered',
  'Qty Received',
  'Qty Shipped',
  'Vendor',
  'PO Issued',
  'Expected Ship',
  'Tracking',
  'Carrier',
  'Status',
]

const timelineIndex = computed(() => getTimelineIndex(props.order.overallStatus))

function printPage() {
  window.print()
}

function formatDate(value: string) {
  return formatDisplayDate(value)
}

function formatDateOrPending(value: string) {
  return value ? formatDate(value) : 'Pending'
}

const InfoTile = defineComponent({
  name: 'InfoTile',
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
    wide: { type: Boolean, default: false },
  },
  setup(tileProps) {
    return () =>
      h('div', { class: ['public-info-tile', tileProps.wide ? 'wide' : ''] }, [
        h('p', tileProps.label),
        h('strong', tileProps.value || '-'),
      ])
  },
})
</script>
