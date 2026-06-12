<template>
  <div v-if="po" class="po-detail-page">
    <header class="page-heading">
      <div>
        <h1>{{ po.poNumber }}</h1>
        <p>{{ po.projectNumber }} - {{ po.projectName }} - {{ po.vendor }}</p>
      </div>
      <div class="page-actions">
        <RouterLink class="secondary-action" to="/purchase-orders">Back to POs</RouterLink>
        <button class="secondary-action" type="button" @click="exportCustomerUpdate">
          <Download :size="17" />
          <span>Customer Update</span>
        </button>
        <button class="primary-action" type="button" @click="exportPoPdf">
          <Download :size="17" />
          <span>Download PO PDF</span>
        </button>
      </div>
    </header>

    <section class="po-tracking-card">
      <label class="tracking-field">
        <span>Status</span>
        <select :value="po.status" @change="updatePo({ status: inputValue($event) as Status })">
          <option v-for="status in poStatuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>
      <TrackingField label="Carrier" :value="po.carrier ?? ''" @change="updatePo({ carrier: $event })" />
      <TrackingField label="Tracking Number" :value="po.trackingNumber ?? ''" @change="updatePo({ trackingNumber: $event })" />
      <TrackingField label="Tracking URL" :value="po.trackingUrl ?? ''" @change="updatePo({ trackingUrl: $event })" />
      <TrackingField type="date" label="Date Issued" :value="po.dateIssued ?? ''" @change="updatePo({ dateIssued: $event })" />
      <TrackingField type="date" label="Estimated Ship Date" :value="po.estimatedShipDate ?? ''" @change="updatePo({ estimatedShipDate: $event })" />
      <TrackingField type="date" label="Estimated Delivery Date" :value="po.expectedDeliveryDate ?? ''" @change="updatePo({ expectedDeliveryDate: $event })" />
      <label class="tracking-field span-2">
        <span>Customer Update Notes</span>
        <textarea :value="po.customerUpdateNotes ?? ''" @input="updatePo({ customerUpdateNotes: inputValue($event) })" />
      </label>
    </section>

    <section class="po-lines-panel">
      <div class="po-lines-heading">
        <div>
          <h2>PO Line Item Tracking</h2>
          <p>Update vendor order, tracking, shipping, and item status.</p>
        </div>
        <StatusBadge :status="po.status" />
      </div>

      <div class="quote-lines-scroll">
        <table class="po-lines-table">
          <thead>
            <tr>
              <th v-for="heading in lineHeadings" :key="heading">{{ heading }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in po.lines" :key="line.id">
              <td>{{ line.clin }}</td>
              <td>
                <p class="line-part">{{ line.partNumber }}</p>
                <p class="line-manufacturer">{{ line.manufacturer }}</p>
              </td>
              <td class="line-description">{{ line.description }}</td>
              <td>{{ line.quantityOrdered }}</td>
              <td>
                <select class="cell-input w-40" :value="line.status" @change="updateLine(line.id, { status: inputValue($event) as Status })">
                  <option v-for="status in lineStatuses" :key="status" :value="status">{{ status }}</option>
                </select>
              </td>
              <td><input class="cell-input w-36" :value="line.vendorOrderNumber ?? ''" @input="updateLine(line.id, { vendorOrderNumber: inputValue($event) })" /></td>
              <td><input class="cell-input w-44" :value="line.trackingNumber ?? ''" @input="updateLine(line.id, { trackingNumber: inputValue($event) })" /></td>
              <td><input class="cell-input w-28" :value="line.carrier ?? ''" @input="updateLine(line.id, { carrier: inputValue($event) })" /></td>
              <td><input class="cell-input w-36" type="date" :value="line.estimatedShipDate ?? ''" @input="updateLine(line.id, { estimatedShipDate: inputValue($event) })" /></td>
              <td><input class="cell-input w-52" :value="line.notes ?? ''" @input="updateLine(line.id, { notes: inputValue($event) })" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>

  <div v-else-if="loaded" class="not-found-page">
    <h1>Purchase order not found</h1>
    <RouterLink class="text-link" to="/purchase-orders">Back to Purchase Orders</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Download } from '@lucide/vue'
import StatusBadge from '../components/StatusBadge.vue'
import TrackingField from '../components/TrackingField.vue'
import {
  loadPurchaseOrder,
  loadProject,
  syncCheckbookTrackingRows,
  updatePurchaseOrderLineTracking,
  updatePurchaseOrderTracking,
} from '../services/localProjects'
import { exportCustomerTrackingUpdatePdf, exportPurchaseOrderPdf } from '../services/pdfExports'
import type { ProjectPurchaseOrder, PurchaseOrder, PurchaseOrderLine, Status } from '../types'

const route = useRoute()
const po = ref<ProjectPurchaseOrder>()
const loaded = ref(false)

const poStatuses: Status[] = ['PO Generated', 'PO Issued', 'Ordered', 'Partially Received', 'Received', 'Backordered', 'Cancelled']
const lineStatuses: Status[] = ['Ordered', 'Backordered', 'Partially Received', 'Received', 'Shipped', 'Delivered', 'Cancelled']
const lineHeadings = ['CLIN', 'Part', 'Description', 'Qty', 'Status', 'Vendor Order', 'Tracking', 'Carrier', 'ESD', 'Notes']

onMounted(() => {
  syncCheckbookTrackingRows()
  reloadPo()
  loaded.value = true
})

function reloadPo() {
  po.value = loadPurchaseOrder(String(route.params.poId))
}

function updatePo(
  updates: Partial<
    Pick<
      PurchaseOrder,
      'dateIssued' | 'status' | 'estimatedShipDate' | 'expectedDeliveryDate' | 'carrier' | 'trackingNumber' | 'trackingUrl' | 'customerUpdateNotes'
    >
  >,
) {
  if (!po.value) return

  updatePurchaseOrderTracking(po.value.projectId, po.value.id, updates)
  reloadPo()
}

function updateLine(
  lineId: string,
  updates: Partial<
    Pick<
      PurchaseOrderLine,
      'status' | 'vendorOrderNumber' | 'estimatedShipDate' | 'carrier' | 'trackingNumber' | 'trackingUrl' | 'notes'
    >
  >,
) {
  if (!po.value) return

  updatePurchaseOrderLineTracking(po.value.projectId, po.value.id, lineId, updates)
  reloadPo()
}

async function exportCustomerUpdate() {
  if (!po.value) return
  await exportCustomerTrackingUpdatePdf(po.value)
}

async function exportPoPdf() {
  if (!po.value) return
  await exportPurchaseOrderPdf(po.value, loadProject(po.value.projectId))
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}
</script>
