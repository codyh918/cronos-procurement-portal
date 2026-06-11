<template>
  <span class="status-badge" :class="statusClass">{{ status }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Status } from '../types'

const props = defineProps<{ status: Status }>()

const statusClass = computed(
  () =>
    ({
      'Customer Approved': 'status-success',
      Received: 'status-success',
      Stored: 'status-success',
      Shipped: 'status-blue',
      Delivered: 'status-blue',
      'Pending Procurement': 'status-muted',
      'Awaiting Vendor Shipment': 'status-warning',
      'In Transit to Cronos': 'status-purple',
      'Received at Cronos': 'status-success',
      'Partially Shipped': 'status-purple',
      'Shipped to Customer': 'status-blue',
      'Ready to Ship': 'status-teal',
      Staged: 'status-teal',
      'Partially Received': 'status-purple',
      'Allocated to Kit': 'status-teal',
      Kitted: 'status-teal',
      Backordered: 'status-danger',
      RMA: 'status-danger',
      'RMA / Issue': 'status-danger',
      Cancelled: 'status-muted',
      'PO Generated': 'status-warning',
      'PO Issued': 'status-blue',
      Ordered: 'status-indigo',
      Quoted: 'status-muted',
    })[props.status] ?? 'status-blue',
)
</script>
