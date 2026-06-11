<template>
  <div class="purchase-orders-page">
    <header class="page-heading">
      <div>
        <h1>Purchase Orders</h1>
        <p>Vendor-specific POs generated from customer-approved quotes.</p>
      </div>
      <button class="primary-action" type="button" @click="generatePurchaseOrders">
        <PackagePlus :size="17" />
        <span>Generate POs</span>
      </button>
    </header>

    <section class="summary-grid">
      <div class="summary-card">
        <p>Open POs</p>
        <strong>{{ purchaseOrders.length }}</strong>
      </div>
      <div class="summary-card">
        <p>Total PO Cost</p>
        <strong>{{ currency(totalPoCost) }}</strong>
      </div>
      <div class="summary-card">
        <p>Vendors</p>
        <strong>{{ vendorCount }}</strong>
      </div>
    </section>

    <section class="register-card">
      <div class="register-header">
        <div>
          <h2>PO Register</h2>
          <p>Search by PO number, manufacturer, project, or status.</p>
        </div>
        <input v-model="search" type="search" placeholder="Search POs..." />
      </div>

      <DataTable v-if="filteredPurchaseOrders.length" :columns="columns" :rows="poRows" />

      <div v-else class="register-empty register-empty-no-icon">
        <p>
          {{
            purchaseOrders.length
              ? 'No purchase orders match that search.'
              : 'No purchase orders yet. Approve a quote to generate vendor POs.'
          }}
        </p>
        <RouterLink class="primary-action" to="/quotes">Go to Quotes</RouterLink>
      </div>
    </section>

    <section v-for="po in filteredPurchaseOrders" :key="po.id" class="po-list-edit-card">
      <div class="po-list-edit-heading">
        <div>
          <h2>{{ po.poNumber }} - {{ po.vendor }}</h2>
          <p>{{ po.projectNumber }} - {{ po.projectName || 'Project' }}</p>
        </div>
        <div class="page-actions">
          <button class="secondary-action" type="button" @click="exportCustomerUpdate(po)">
            <Download :size="17" />
            <span>Customer Update</span>
          </button>
          <button class="secondary-action" type="button" @click="exportPoPdf(po)">
            <Download :size="17" />
            <span>Export PO PDF</span>
          </button>
        </div>
      </div>

      <section class="po-tracking-card po-list-tracking-card">
        <label class="tracking-field">
          <span>Status</span>
          <select :value="po.status" @change="updatePo(po, { status: inputValue($event) as Status })">
            <option v-for="status in poStatuses" :key="status" :value="status">{{ status }}</option>
          </select>
        </label>
        <TrackingField label="Carrier" :value="po.carrier ?? ''" @change="updatePo(po, { carrier: $event })" />
        <TrackingField label="Tracking Number" :value="po.trackingNumber ?? ''" @change="updatePo(po, { trackingNumber: $event })" />
        <TrackingField label="Tracking URL" :value="po.trackingUrl ?? ''" @change="updatePo(po, { trackingUrl: $event })" />
        <TrackingField type="date" label="Date Issued" :value="po.dateIssued ?? ''" @change="updatePo(po, { dateIssued: $event })" />
        <TrackingField type="date" label="Estimated Ship Date" :value="po.estimatedShipDate ?? ''" @change="updatePo(po, { estimatedShipDate: $event })" />
        <TrackingField type="date" label="Estimated Delivery Date" :value="po.expectedDeliveryDate ?? ''" @change="updatePo(po, { expectedDeliveryDate: $event })" />
        <label class="tracking-field span-2">
          <span>Customer Update Notes</span>
          <textarea
            :value="po.customerUpdateNotes ?? ''"
            placeholder="Example: Items are in production. Tracking will be updated when carrier pickup is confirmed."
            @input="updatePo(po, { customerUpdateNotes: inputValue($event) })"
          />
        </label>
      </section>

      <DataTable
        :columns="['CLIN', 'Part', 'Description', 'Qty Ordered', 'Qty Received', 'Unit Cost', 'Status']"
        :rows="poLineRows(po)"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Download, PackagePlus } from '@lucide/vue'
import DataTable from '../components/DataTable.vue'
import TrackingField from '../components/TrackingField.vue'
import { currency } from '../services/calculations'
import { formatDisplayDate } from '../services/dateFormat'
import {
  generatePurchaseOrdersForApprovedQuotes,
  loadProject,
  loadPurchaseOrders,
  syncCheckbookTrackingRows,
  updatePurchaseOrderTracking,
} from '../services/localProjects'
import { exportCustomerTrackingUpdatePdf, exportPurchaseOrderPdf } from '../services/pdfExports'
import type { ProjectPurchaseOrder, PurchaseOrder, Status } from '../types'

const purchaseOrders = ref<ProjectPurchaseOrder[]>(loadPurchaseOrders())
const search = ref('')
const poStatuses: Status[] = ['PO Generated', 'PO Issued', 'Ordered', 'Partially Received', 'Received', 'Backordered', 'Cancelled']

const columns = [
  'PO #',
  'Project',
  'Vendor',
  'Status',
  'Carrier',
  'Est. Ship',
  'Est. Delivery',
  'Tracking',
  'Total',
]

onMounted(() => {
  syncCheckbookTrackingRows()
  refreshPurchaseOrders()
  window.addEventListener('cronos:projects-changed', refreshPurchaseOrders)
})
onUnmounted(() => window.removeEventListener('cronos:projects-changed', refreshPurchaseOrders))

const filteredPurchaseOrders = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return purchaseOrders.value

  return purchaseOrders.value.filter(po =>
    [po.poNumber, po.vendor, po.projectNumber, po.projectName, po.status]
      .join(' ')
      .toLowerCase()
      .includes(term),
  )
})

const totalPoCost = computed(() =>
  purchaseOrders.value.reduce((total, po) => total + po.totalCost, 0),
)

const vendorCount = computed(() => new Set(purchaseOrders.value.map(po => po.vendor)).size)

const poRows = computed(() =>
  filteredPurchaseOrders.value.map(po => [
    {
      type: 'link' as const,
      label: po.poNumber,
      to: `/purchase-orders/${po.id}`,
      className: 'table-link',
    },
    {
      type: 'link' as const,
      label: po.projectNumber,
      to: `/projects/${po.projectId}`,
      className: 'table-link',
    },
    po.vendor,
    { type: 'badge' as const, status: po.status },
    po.carrier || 'Pending',
    formatDateOrPending(po.estimatedShipDate),
    formatDateOrPending(po.expectedDeliveryDate),
    po.trackingNumber
      ? {
          type: 'link' as const,
          label: po.trackingNumber,
          to: `/purchase-orders/${po.id}`,
          className: 'table-link',
        }
      : 'Pending',
    currency(po.totalCost),
  ]),
)

function poLineRows(po: ProjectPurchaseOrder) {
  return po.lines.map(line => [
    line.clin,
    line.partNumber,
    line.description,
    line.quantityOrdered,
    line.quantityReceived,
    currency(line.unitCost),
    { type: 'badge' as const, status: line.status },
  ])
}

function refreshPurchaseOrders() {
  purchaseOrders.value = loadPurchaseOrders()
}

function generatePurchaseOrders() {
  generatePurchaseOrdersForApprovedQuotes()
  refreshPurchaseOrders()
}

function updatePo(
  po: ProjectPurchaseOrder,
  updates: Partial<
    Pick<
      PurchaseOrder,
      'dateIssued' | 'status' | 'estimatedShipDate' | 'expectedDeliveryDate' | 'carrier' | 'trackingNumber' | 'trackingUrl' | 'customerUpdateNotes'
    >
  >,
) {
  updatePurchaseOrderTracking(po.projectId, po.id, updates)
  refreshPurchaseOrders()
}

async function exportCustomerUpdate(po: ProjectPurchaseOrder) {
  await exportCustomerTrackingUpdatePdf(po, loadProject(po.projectId))
}

async function exportPoPdf(po: ProjectPurchaseOrder) {
  await exportPurchaseOrderPdf(po, loadProject(po.projectId))
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function formatDateOrPending(value?: string) {
  if (!value) return 'Pending'
  return formatDisplayDate(value)
}
</script>
