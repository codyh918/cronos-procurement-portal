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

    <section class="po-edit-card">
      <div class="po-lines-heading">
        <div>
          <h2>Purchase Order Details</h2>
          <p>Edit PO header, vendor, requestor, description, and commercial values.</p>
        </div>
        <StatusBadge :status="po.status" />
      </div>
      <div class="po-edit-grid">
        <label class="tracking-field">
          <span>PO Number</span>
          <input :value="po.poNumber" @change="updatePo({ poNumber: inputValue($event) })" />
        </label>
        <label class="tracking-field">
          <span>Vendor</span>
          <input :value="po.vendor" @change="updatePo({ vendor: inputValue($event) })" />
        </label>
        <label class="tracking-field">
          <span>Requestor</span>
          <input :value="po.requestor ?? ''" @change="updatePo({ requestor: inputValue($event) })" />
        </label>
        <label class="tracking-field">
          <span>Terms</span>
          <input :value="po.terms ?? 'NET30'" @change="updatePo({ terms: inputValue($event) })" />
        </label>
        <label class="tracking-field">
          <span>Customer Total Cost</span>
          <input type="number" min="0" step="0.01" :value="po.customerTotalCost ?? po.totalCost" @change="updatePo({ customerTotalCost: numberValue($event) })" />
        </label>
        <label class="tracking-field span-2">
          <span>Description / Vendor Notes</span>
          <textarea :value="po.description ?? ''" @change="updatePo({ description: inputValue($event) })" />
        </label>
      </div>
    </section>

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
              <td><input class="cell-input w-20" :value="line.clin" @change="updateLine(line.id, { clin: inputValue($event) })" /></td>
              <td>
                <input class="cell-input w-44" :value="line.partNumber" @change="updateLine(line.id, { partNumber: inputValue($event) })" />
                <input class="cell-input w-44 line-sub-input" :value="line.manufacturer ?? ''" placeholder="Manufacturer" @change="updateLine(line.id, { manufacturer: inputValue($event) })" />
              </td>
              <td><textarea class="cell-input po-line-description-input" :value="line.description" @change="updateLine(line.id, { description: inputValue($event) })" /></td>
              <td><input class="cell-input w-20" type="number" min="0" :value="line.quantityOrdered" @change="updateLine(line.id, { quantityOrdered: numberValue($event) })" /></td>
              <td><input class="cell-input w-28" type="number" min="0" step="0.01" :value="line.unitCost" @change="updateLine(line.id, { unitCost: numberValue($event) })" /></td>
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
  updatePurchaseOrderLineDetails,
  updatePurchaseOrderDetails,
} from '../services/localProjects'
import { exportCustomerTrackingUpdatePdf, exportPurchaseOrderPdf } from '../services/pdfExports'
import type { ProjectPurchaseOrder, PurchaseOrder, PurchaseOrderLine, Status } from '../types'

const route = useRoute()
const po = ref<ProjectPurchaseOrder>()
const loaded = ref(false)

const poStatuses: Status[] = ['PO Generated', 'PO Issued', 'Ordered', 'Partially Received', 'Received', 'Backordered', 'Cancelled']
const lineStatuses: Status[] = ['Ordered', 'Backordered', 'Partially Received', 'Received', 'Shipped', 'Delivered', 'Cancelled']
const lineHeadings = ['CLIN', 'Part / Manufacturer', 'Description', 'Qty', 'Unit Cost', 'Status', 'Vendor Order', 'Tracking', 'Carrier', 'ESD', 'Notes']

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
      | 'poNumber'
      | 'vendor'
      | 'description'
      | 'dateIssued'
      | 'status'
      | 'estimatedShipDate'
      | 'expectedDeliveryDate'
      | 'carrier'
      | 'trackingNumber'
      | 'trackingUrl'
      | 'customerUpdateNotes'
      | 'requestor'
      | 'customerTotalCost'
      | 'terms'
    >
  >,
) {
  if (!po.value) return

  updatePurchaseOrderDetails(po.value.projectId, po.value.id, updates)
  reloadPo()
}

function updateLine(
  lineId: string,
  updates: Partial<
    Pick<
      PurchaseOrderLine,
      | 'clin'
      | 'partNumber'
      | 'manufacturer'
      | 'description'
      | 'quantityOrdered'
      | 'unitCost'
      | 'status'
      | 'vendorOrderNumber'
      | 'estimatedShipDate'
      | 'carrier'
      | 'trackingNumber'
      | 'trackingUrl'
      | 'notes'
    >
  >,
) {
  if (!po.value) return

  updatePurchaseOrderLineDetails(po.value.projectId, po.value.id, lineId, updates)
  reloadPo()
}

async function exportCustomerUpdate() {
  if (!po.value) return
  await exportCustomerTrackingUpdatePdf(po.value, loadProject(po.value.projectId))
}

async function exportPoPdf() {
  if (!po.value) return
  await exportPurchaseOrderPdf(po.value, loadProject(po.value.projectId))
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function numberValue(event: Event) {
  const value = Number(inputValue(event))
  return Number.isFinite(value) ? value : 0
}
</script>
