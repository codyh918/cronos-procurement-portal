<template>
  <div v-if="project" class="project-detail-page">
    <section class="project-dashboard-hero">
      <div class="project-hero-head">
        <div>
          <div class="project-title-row">
            <h1>{{ project.projectNumber }}</h1>
            <StatusBadge :status="project.status" />
          </div>
          <p class="project-name">{{ project.projectName }}</p>
          <p class="project-subtitle">
            {{ project.customer }} - Contract {{ project.contractNumber || 'Pending' }} -
            {{ project.projectType }}
          </p>
        </div>
        <div class="hero-actions">
          <RouterLink class="secondary-action" to="/projects">Back to Projects</RouterLink>
          <RouterLink class="secondary-action icon-action" :to="`/projects/${project.id}/edit`">
            <Pencil :size="17" />
            <span>Edit Project</span>
          </RouterLink>
          <RouterLink class="primary-action icon-action" :to="`/projects/${project.id}/quotes/new`">
            <Plus :size="17" />
            <span>Add Quote</span>
          </RouterLink>
        </div>
      </div>

      <div class="project-summary-card-grid">
        <InfoTile label="Project Number" :value="project.projectNumber" />
        <InfoTile label="Project Name" :value="project.projectName || '-'" />
        <InfoTile label="Customer" :value="project.customer || '-'" />
        <InfoTile label="Assigned User" :value="assignedUserNames || '-'" />
        <InfoTile label="Government Lead" :value="project.governmentProjectLead || '-'" />
        <InfoTile label="Project Type" :value="project.projectType" />
        <InfoTile label="Status" :value="project.status" />
        <InfoTile label="Contract / Quote Value" :value="currency(quoteSummary.customerTotal)" />
        <InfoTile label="Material Budget" :value="currency(materialBudget)" />
        <InfoTile label="Material Purchased" :value="currency(materialOrderedValue)" />
        <InfoTile label="Material Remaining" :value="currency(materialRemainingValue)" />
      </div>

      <div class="project-health-grid">
        <HealthCard label="Material Ordered" :value="currency(materialOrderedValue)" :percent="materialOrderedPercent" tone="default" />
        <HealthCard label="Material Received" :value="currency(materialReceivedValue)" :percent="materialReceivedPercent" tone="success" />
        <HealthCard label="Material Shipped" :value="currency(materialShippedValue)" :percent="materialShippedPercent" tone="warning" />
        <HealthCard label="Open Vendor Issues" :value="openVendorIssuesCount" :percent="0" tone="danger" compact />
        <HealthCard label="Open Purchase Orders" :value="openPurchaseOrderCount" :percent="0" tone="default" compact />
        <HealthCard label="Pending Deliveries" :value="pendingDeliveryCount" :percent="0" tone="warning" compact />
      </div>
    </section>

    <section class="project-tab-bar" aria-label="Project sections">
      <button
        v-for="tab in projectTabs"
        :key="tab.id"
        type="button"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </section>

    <div v-if="importMessage" class="import-success-note">
      {{ importMessage }}
    </div>

    <section v-if="activeTab === 'overview'" class="project-tab-panel">
      <div class="detail-panel">
        <PanelHeading
          title="Project Summary"
          description="Material procurement status across quotes, purchase orders, receiving, and shipments."
        />
        <div class="material-progress-grid">
          <ProgressRow label="Ordered" :value="materialOrderedValue" :total="materialBudget" :percent="materialOrderedPercent" />
          <ProgressRow label="Received" :value="materialReceivedValue" :total="materialBudget" :percent="materialReceivedPercent" />
          <ProgressRow label="Shipped" :value="materialShippedValue" :total="materialBudget" :percent="materialShippedPercent" />
        </div>
      </div>

      <div class="detail-panel">
        <PanelHeading
          title="Attention Required"
          description="Vendor, tracking, and delivery items that need procurement follow-up."
          :pill="attentionItems.length ? `${attentionItems.length} open` : 'Clear'"
          :tone="attentionItems.length ? 'danger' : 'success'"
        />
        <div v-if="attentionItems.length" class="data-table-frame">
          <div class="table-scroll">
            <table class="data-table attention-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>PO</th>
                  <th>Issue</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in attentionItems" :key="item.id">
                  <td>{{ item.vendor }}</td>
                  <td>
                    <button class="table-link inline-link-button" type="button" @click="openProjectPo(item.poId)">
                      {{ item.poNumber }}
                    </button>
                  </td>
                  <td><span class="compact-alert-badge">{{ item.issue }}</span></td>
                  <td>{{ item.age }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="success-empty">
          <CheckCircle2 :size="28" />
          <p>No material procurement issues need attention.</p>
        </div>
      </div>
    </section>

    <section v-if="activeTab === 'quotes'" id="project-quotes" class="project-tab-panel">
      <div class="section-title-row">
        <h2>Project Quotes</h2>
        <RouterLink :to="`/projects/${project.id}/quotes/new`">Add Quote</RouterLink>
      </div>
      <div v-if="project.quotes.length" class="data-table-frame top-scroll-frame">
        <div class="table-scroll-top" aria-hidden="true" @scroll="syncQuoteScroll('top', $event)">
          <div class="quote-scroll-spacer" />
        </div>
        <div class="table-scroll" @scroll="syncQuoteScroll('bottom', $event)">
          <table ref="quoteTable" class="data-table quote-items-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Quote Name</th>
                <th>Status</th>
                <th>Lines</th>
                <th>Expires</th>
                <th>Total Cost</th>
                <th>Line Total</th>
                <th>Contract Fee</th>
                <th>Shipping</th>
                <th>Quote Total</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="quote in project.quotes" :key="quote.id">
                <td class="nowrap">
                  <RouterLink class="table-link" :to="`/projects/${project.id}/quotes/${quote.id}/edit`">
                    {{ quote.quoteNumber }}
                  </RouterLink>
                </td>
                <td>
                  <span class="quote-name-readonly">{{ quote.quoteName || 'Untitled quote' }}</span>
                </td>
                <td><StatusBadge :status="quote.status" /></td>
                <td>{{ quote.lines.length }}</td>
                <td>{{ quote.expirationDays ?? 30 }} days</td>
                <td>{{ currency(quoteTotals(quote).totalCost) }}</td>
                <td>{{ currency(quoteTotals(quote).totalSellPrice) }}</td>
                <td>{{ currency(quoteTotals(quote).contractFee) }}</td>
                <td>{{ currency(quoteTotals(quote).shippingCost) }}</td>
                <td>{{ currency(quoteTotals(quote).customerTotal) }}</td>
                <td class="nowrap">{{ formatDate(quote.createdAt) }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      v-if="quote.status !== 'Customer Approved'"
                      class="mini-action success"
                      type="button"
                      @click="toggleQuoteApproval(quote.id, true)"
                    >
                      <CheckCircle2 :size="14" />
                      <span>Approve</span>
                    </button>
                    <button
                      v-if="quote.status === 'Customer Approved'"
                      class="mini-action"
                      type="button"
                      @click="generatePurchaseOrders(quote.id)"
                    >
                      <PackagePlus :size="14" />
                      <span>Generate POs</span>
                    </button>
                    <RouterLink class="mini-action link" :to="`/projects/${project.id}/quotes/${quote.id}/edit`">
                      <Pencil :size="14" />
                      <span>Edit</span>
                    </RouterLink>
                    <button class="mini-action" type="button" @click="exportQuotePdf(quote)">
                      <Download :size="14" />
                      <span>PDF</span>
                    </button>
                    <button class="mini-action" type="button" @click="exportQuoteExcel(quote)">
                      <FileSpreadsheet :size="14" />
                      <span>Excel</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <section v-else class="large-empty-card compact-empty">
        <p>No quotes have been created for this project yet.</p>
        <RouterLink class="primary-action icon-action" :to="`/projects/${project.id}/quotes/new`">
          <Plus :size="17" />
          <span>Add Quote</span>
        </RouterLink>
      </section>
    </section>

    <section v-if="activeTab === 'purchase-orders'" id="project-pos" class="project-tab-panel">
      <div class="section-title-row">
        <h2>Open POs</h2>
      </div>
      <div v-if="project.purchaseOrders.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Vendor</th>
                <th>PO Amount</th>
                <th>Ordered Date</th>
                <th>Expected Ship Date</th>
                <th>Status</th>
                <th>Lines</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="po in project.purchaseOrders" :key="po.id">
                <td class="nowrap">
                  <button class="table-link inline-link-button" type="button" @click="openProjectPo(po.id)">{{ po.poNumber }}</button>
                </td>
                <td>{{ po.vendor }}</td>
                <td>{{ currency(po.totalCost) }}</td>
                <td class="nowrap">{{ formatDateOrPending(po.dateIssued) }}</td>
                <td>{{ formatDateOrPending(po.estimatedShipDate) }}</td>
                <td><StatusBadge :status="po.status" /></td>
                <td>{{ po.lines.length }}</td>
                <td>
                  <button class="mini-action" type="button" @click="exportPoPdf(po)">
                    <Download :size="14" />
                    <span>PDF</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <section v-else class="large-empty-card compact-empty">
        <p>Approve a customer quote to generate vendor purchase orders.</p>
      </section>

      <section v-if="selectedProjectPo" class="detail-panel project-po-panel">
        <PanelHeading
          :title="selectedProjectPo.poNumber"
          :description="`${selectedProjectPo.vendor} purchase order for ${project.projectNumber}`"
          :pill="selectedProjectPo.status"
          tone="warning"
        >
          <div class="page-actions">
            <button class="secondary-action icon-action" type="button" @click="exportPoPdf(selectedProjectPo)">
              <Download :size="17" />
              <span>Download PO PDF</span>
            </button>
            <button class="secondary-action" type="button" @click="closeProjectPo">Close</button>
          </div>
        </PanelHeading>
        <div class="info-tile-grid compact-po-info">
          <InfoTile label="Vendor" :value="selectedProjectPo.vendor" />
          <InfoTile label="Date Issued" :value="selectedProjectPo.dateIssued || 'Pending'" />
          <InfoTile label="Total Cost" :value="currency(selectedProjectPo.totalCost)" />
          <InfoTile label="Lines" :value="String(selectedProjectPo.lines.length)" />
        </div>
        <div class="data-table-frame">
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>CLIN</th>
                  <th>Part</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Vendor Order</th>
                  <th>Carrier</th>
                  <th>Tracking</th>
                  <th>ESD</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in selectedProjectPo.lines" :key="line.id">
                  <td>{{ line.clin }}</td>
                  <td>{{ line.partNumber }}</td>
                  <td>{{ line.description }}</td>
                  <td>{{ line.quantityOrdered }}</td>
                  <td>{{ line.status }}</td>
                  <td>{{ line.vendorOrderNumber || 'Pending' }}</td>
                  <td>{{ line.carrier || 'Pending' }}</td>
                  <td>{{ line.trackingNumber || 'Pending' }}</td>
                  <td>{{ formatDateOrPending(line.estimatedShipDate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>

    <section v-if="activeTab === 'material-tracking'" id="project-equipment" class="project-tab-panel">
      <PanelHeading
        title="Material Tracking"
        description="Line-item procurement status, expected ship dates, carriers, and tracking."
      >
        <div class="page-actions">
          <button class="secondary-action icon-action" type="button" @click="exportTrackingWorkbook">
            <Download :size="17" />
            <span>Export Tracking Report</span>
          </button>
          <button class="secondary-action icon-action" type="button" @click="trackingFileInput?.click()">
            <Upload :size="17" />
            <span>Import Tracking</span>
          </button>
          <input
            ref="trackingFileInput"
            class="hidden-file-input"
            type="file"
            accept=".csv,.txt,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            @change="importTrackingWorkbook"
          />
        </div>
      </PanelHeading>
      <div v-if="purchasedEquipmentLines.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table editable-equipment-table">
            <thead>
              <tr>
                <th>Project Number</th>
                <th>Project Name</th>
                <th>Customer</th>
                <th>PO #</th>
                <th>Vendor</th>
                <th>Manufacturer</th>
                <th>Description</th>
                <th>Part Number</th>
                <th>Quantity</th>
                <th>Ship Date</th>
                <th>Carrier</th>
                <th>Tracking Number</th>
                <th>Delivery Status</th>
                <th>Estimated Delivery Date</th>
                <th>Actual Delivery Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in purchasedEquipmentLines" :key="`${line.poId}-${line.id}`">
                <td class="nowrap">{{ project.projectNumber }}</td>
                <td>{{ project.projectName }}</td>
                <td>{{ project.customer }}</td>
                <td class="nowrap">
                  <button class="table-link inline-link-button" type="button" @click="openProjectPo(line.poId)">{{ line.poNumber }}</button>
                </td>
                <td>{{ line.vendor }}</td>
                <td>{{ line.manufacturer || 'Pending' }}</td>
                <td>{{ line.description }}</td>
                <td>{{ line.partNumber }}</td>
                <td>{{ line.quantityOrdered }}</td>
                <td>
                  <input
                    class="cell-input w-36"
                    type="date"
                    :value="line.estimatedShipDate ?? ''"
                    @change="updateLineTracking(line.poId, line.id, { estimatedShipDate: inputValue($event) })"
                  />
                </td>
                <td>
                  <input
                    class="cell-input w-28"
                    :value="line.carrier ?? ''"
                    placeholder="Carrier"
                    @change="updateLineTracking(line.poId, line.id, { carrier: inputValue($event) })"
                  />
                </td>
                <td>
                  <input
                    class="cell-input w-44"
                    :value="line.trackingNumber ?? ''"
                    placeholder="Tracking #"
                    @change="updateLineTracking(line.poId, line.id, { trackingNumber: inputValue($event) })"
                  />
                </td>
                <td>
                  <select class="cell-input w-40" :value="line.status" @change="updateLineTracking(line.poId, line.id, { status: inputValue($event) as Status })">
                    <option v-for="status in trackingStatusOptions" :key="status" :value="status">{{ status }}</option>
                  </select>
                </td>
                <td>
                  <input
                    class="cell-input w-36"
                    type="date"
                    :value="line.estimatedDeliveryDate ?? ''"
                    @change="updateLineTracking(line.poId, line.id, { estimatedDeliveryDate: inputValue($event) })"
                  />
                </td>
                <td>
                  <input
                    class="cell-input w-36"
                    type="date"
                    :value="line.receivedDate ?? ''"
                    @change="updateLineTracking(line.poId, line.id, { receivedDate: inputValue($event) })"
                  />
                </td>
                <td>
                  <input
                    class="cell-input w-52"
                    :value="line.notes ?? ''"
                    placeholder="Notes"
                    @change="updateLineTracking(line.poId, line.id, { notes: inputValue($event) })"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <section v-else class="large-empty-card compact-empty">
        <p>No purchased equipment has been generated yet.</p>
      </section>
    </section>

    <section v-if="activeTab === 'shipments'" class="project-tab-panel">
      <PanelHeading
        title="Shipments"
        description="Line-level shipment, carrier, tracking, and delivery visibility."
        :pill="shipmentLines.length ? `${shipmentLines.length} shipment lines` : 'No shipments'"
        tone="warning"
      />
      <div v-if="shipmentLines.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO</th>
                <th>Vendor</th>
                <th>Part Number</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Carrier</th>
                <th>Tracking</th>
                <th>Ship Date</th>
                <th>Delivery Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in shipmentLines" :key="`${line.poId}-${line.id}`">
                <td>
                  <button class="table-link inline-link-button" type="button" @click="openProjectPo(line.poId)">{{ line.poNumber }}</button>
                </td>
                <td>{{ line.vendor }}</td>
                <td>{{ line.partNumber }}</td>
                <td>{{ line.description }}</td>
                <td>{{ line.quantityOrdered }}</td>
                <td>{{ line.status }}</td>
                <td>{{ line.carrier || 'Pending' }}</td>
                <td>{{ line.trackingNumber || 'Pending' }}</td>
                <td>{{ formatDateOrPending(line.estimatedShipDate) }}</td>
                <td>{{ formatDateOrPending(line.receivedDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <section v-else class="large-empty-card compact-empty">
        <p>No shipped material has been recorded yet.</p>
      </section>
    </section>

    <section v-if="activeTab === 'documents'" class="project-tab-panel">
      <PanelHeading
        title="Documents"
        description="Quotes, purchase orders, acknowledgements, tracking documents, and customer files."
      >
        <div class="page-actions">
          <button class="secondary-action icon-action" type="button" @click="trackingFileInput?.click()">
            <Upload :size="17" />
            <span>Import Tracking</span>
          </button>
          <button class="secondary-action icon-action" type="button" @click="checkbookFileInput?.click()">
            <Upload :size="17" />
            <span>Import Checkbook POs</span>
          </button>
          <input
            ref="checkbookFileInput"
            class="hidden-file-input"
            type="file"
            accept=".csv,.txt,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            @change="importCheckbookWorkbook"
          />
        </div>
      </PanelHeading>

      <div class="document-drop-zone">
        <Upload :size="26" />
        <strong>Drop project documents here</strong>
        <p>Store vendor acknowledgements, tracking documents, customer files, or procurement backup.</p>
      </div>

      <div class="document-grid">
        <DocumentTile :icon="FileText" title="Quotes" :description="`${project.quotes.length} quotes available`" href="#project-quotes" action="Open Quotes Tab" />
        <DocumentTile :icon="ReceiptText" title="Purchase Orders" :description="`${project.purchaseOrders.length} purchase orders available`" href="#project-pos" action="Open PO Tab" />
        <div class="document-tile">
          <Truck :size="22" />
          <h3>Tracking Documents</h3>
          <p>Export the current line-item tracking workbook.</p>
          <button class="doc-action" type="button" @click="exportTrackingWorkbook">Export XLSX</button>
        </div>
        <div v-if="purchasedEquipmentLines.length" class="document-tile">
          <Download :size="22" />
          <h3>Customer Tracking Report</h3>
          <p>Customer-facing line-item shipping report.</p>
          <button class="doc-action" type="button" @click="exportConsolidatedTrackingPdf">Customer Tracking PDF</button>
        </div>
        <div v-if="checkbookSummary" class="document-tile">
          <FileSpreadsheet :size="22" />
          <h3>Checkbook Reports</h3>
          <p>Financial report and tracking workbook for checkbook balance reporting.</p>
          <div class="doc-action-row">
            <button class="doc-action" type="button" @click="exportCheckbookPdf">PDF</button>
            <button class="doc-action secondary-doc-action" type="button" @click="exportCheckbookWorkbook">XLSX</button>
          </div>
        </div>
      </div>
    </section>
  </div>

  <div v-else class="project-detail-page">
    <h1>Project not found</h1>
    <RouterLink class="table-link" to="/projects">Back to Projects</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  Truck,
  Upload,
} from '@lucide/vue'
import type { Component } from 'vue'
import StatusBadge from '../components/StatusBadge.vue'
import { calculateQuoteSummary, currency } from '../services/calculations'
import { loadUsers } from '../services/auth'
import { getCheckbookSummary } from '../services/checkbook'
import { parseCheckbookPoFile } from '../services/checkbookImport'
import { formatDisplayDate } from '../services/dateFormat'
import {
  generatePurchaseOrdersForQuote,
  importCheckbookPurchaseOrders,
  importPurchaseOrderTracking,
  loadProject,
  setQuoteApprovalStatus,
  updatePurchaseOrderLineTracking,
} from '../services/localProjects'
import { exportCheckbookReportPdf, exportCustomerConsolidatedTrackingReportPdf, exportCustomerQuotePdf as downloadCustomerQuotePdf, exportPurchaseOrderPdf as downloadPurchaseOrderPdf } from '../services/pdfExports'
import { parseTrackingImportFile } from '../services/trackingImport'
import { exportCheckbookFinancialWorkbook, exportCustomerQuoteWorkbook, exportProjectTrackingWorkbook } from '../services/workbookExports'
import type { CustomerQuote, Project, PurchaseOrder, PurchaseOrderLine, Status } from '../types'

type Tone = 'default' | 'warning' | 'danger' | 'success'
type PurchasedEquipmentLine = PurchaseOrderLine & {
  poId: string
  poNumber: string
  poStatus: Status
  vendor: string
}
type ProjectTabId = 'overview' | 'quotes' | 'purchase-orders' | 'material-tracking' | 'shipments' | 'documents'

const route = useRoute()
const project = ref<Project>()
const users = ref(loadUsers())
const importMessage = ref('')
const checkbookFileInput = ref<HTMLInputElement | null>(null)
const trackingFileInput = ref<HTMLInputElement | null>(null)
const quoteTable = ref<HTMLTableElement | null>(null)
const selectedProjectPoId = ref('')
const activeTab = ref<ProjectTabId>('overview')
let syncingQuoteScroll = false
const trackingStatusOptions: Status[] = ['Ordered', 'Backordered', 'Shipped', 'Delivered', 'Cancelled']
const projectTabs: Array<{ id: ProjectTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'purchase-orders', label: 'Purchase Orders' },
  { id: 'material-tracking', label: 'Material Tracking' },
  { id: 'shipments', label: 'Shipments' },
  { id: 'documents', label: 'Documents' },
]

onMounted(() => {
  reloadProject()
})

function reloadProject() {
  project.value = loadProject(String(route.params.id))
  users.value = loadUsers()
}

const assignedUserNames = computed(() => {
  const ids = new Set(project.value?.assignedUserIds ?? [])
  return users.value.filter(user => ids.has(user.id)).map(user => user.name).join(', ')
})

const quoteSummary = computed(() =>
  (project.value?.quotes ?? []).reduce(
    (summary, quote) => {
      const totals = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)
      return {
        totalCost: summary.totalCost + totals.totalCost,
        customerTotal: summary.customerTotal + totals.customerTotal,
      }
    },
    { totalCost: 0, customerTotal: 0 },
  ),
)

const poSummary = computed(() =>
  (project.value?.purchaseOrders ?? []).reduce(
    (summary, po) => {
      po.lines.forEach(line => {
        summary.quantityOrdered += line.quantityOrdered
      })
      summary.totalCost += po.totalCost
      return summary
    },
    { totalCost: 0, quantityOrdered: 0 },
  ),
)

const purchasedEquipmentLines = computed<PurchasedEquipmentLine[]>(() =>
  (project.value?.purchaseOrders ?? []).flatMap(po =>
    po.lines.map(line => ({
      ...line,
      poId: po.id,
      poNumber: po.poNumber,
      poStatus: po.status,
      vendor: po.vendor,
      carrier: line.carrier ?? '',
      trackingNumber: line.trackingNumber ?? '',
      estimatedShipDate: line.estimatedShipDate ?? '',
      estimatedDeliveryDate: line.estimatedDeliveryDate ?? '',
      receivedDate: line.receivedDate ?? '',
      notes: line.notes ?? '',
    })),
  ),
)

const missingTrackingLines = computed(() =>
  purchasedEquipmentLines.value.filter(line => line.poStatus !== 'PO Generated' && !line.trackingNumber),
)

const trackingMissingCount = computed(() => missingTrackingLines.value.length)

const checkbookSummary = computed(() =>
  project.value?.projectType === 'Checkbook' ? getCheckbookSummary(project.value) : undefined,
)

const selectedProjectPo = computed(() =>
  project.value?.purchaseOrders.find(po => po.id === selectedProjectPoId.value),
)

const materialBudget = computed(() => {
  if (!project.value) return 0
  if (project.value.projectType === 'Checkbook') return project.value.checkbookStartingBalance || quoteSummary.value.customerTotal || poSummary.value.totalCost
  return project.value.materialBudget || quoteSummary.value.totalCost || quoteSummary.value.customerTotal || poSummary.value.totalCost
})
const materialOrderedValue = computed(() => poSummary.value.totalCost)
const materialReceivedValue = computed(() =>
  purchasedEquipmentLines.value.reduce((total, line) => total + line.quantityReceived * line.unitCost, 0),
)
const materialShippedValue = computed(() =>
  purchasedEquipmentLines.value
    .filter(line => isShippedStatus(line.status))
    .reduce((total, line) => total + line.quantityOrdered * line.unitCost, 0),
)
const materialRemainingValue = computed(() => Math.max(materialBudget.value - materialOrderedValue.value, 0))
const materialOrderedPercent = computed(() => percentOf(materialOrderedValue.value, materialBudget.value))
const materialReceivedPercent = computed(() => percentOf(materialReceivedValue.value, materialBudget.value))
const materialShippedPercent = computed(() => percentOf(materialShippedValue.value, materialBudget.value))
const openPurchaseOrderCount = computed(
  () => project.value?.purchaseOrders.filter(po => !['Received', 'Delivered', 'Cancelled'].includes(po.status)).length ?? 0,
)
const pendingDeliveryCount = computed(() =>
  purchasedEquipmentLines.value.filter(line => !['Received', 'Delivered', 'Cancelled'].includes(line.status)).length,
)
const openVendorIssuesCount = computed(() =>
  purchasedEquipmentLines.value.filter(line => line.status === 'Backordered' || line.status === 'RMA / Issue' || line.status === 'RMA' || (!line.trackingNumber && line.poStatus !== 'PO Generated')).length,
)
const shipmentLines = computed(() =>
  purchasedEquipmentLines.value.filter(line => isShippedStatus(line.status) || line.trackingNumber || line.carrier),
)
const attentionItems = computed(() =>
  purchasedEquipmentLines.value
    .flatMap(line => {
      const issues: Array<{ issue: string; date?: string }> = []
      if (line.status === 'Backordered') issues.push({ issue: 'Vendor backorder', date: line.estimatedShipDate })
      if (line.status === 'RMA' || line.status === 'RMA / Issue') issues.push({ issue: 'Vendor issue', date: line.receivedDate })
      if (line.poStatus !== 'PO Generated' && !line.estimatedShipDate) issues.push({ issue: 'PO acknowledged but no ship date' })
      if (line.estimatedShipDate && !line.trackingNumber && new Date(line.estimatedShipDate) < startOfToday()) issues.push({ issue: 'Past due delivery', date: line.estimatedShipDate })
      if (!line.trackingNumber && line.poStatus !== 'PO Generated') issues.push({ issue: 'Tracking missing' })
      if (line.quantityReceived > 0 && line.quantityReceived < line.quantityOrdered) issues.push({ issue: 'Partial shipment', date: line.receivedDate })
      return issues.map((issue, index) => ({
        id: `${line.poId}-${line.id}-${index}`,
        poId: line.poId,
        poNumber: line.poNumber,
        vendor: line.vendor,
        issue: issue.issue,
        age: issue.date ? ageInDays(issue.date) : 'Open',
      }))
    })
    .slice(0, 8),
)

function quoteTotals(quote: CustomerQuote) {
  return calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost ?? 0)
}

function toggleQuoteApproval(quoteId: string, approved: boolean) {
  const result = setQuoteApprovalStatus(String(route.params.id), quoteId, approved)
  project.value = result.project
}

function generatePurchaseOrders(quoteId: string) {
  const result = generatePurchaseOrdersForQuote(String(route.params.id), quoteId)
  project.value = result.project
}

function updateLineTracking(poId: string, lineId: string, updates: Parameters<typeof updatePurchaseOrderLineTracking>[3]) {
  project.value = updatePurchaseOrderLineTracking(String(route.params.id), poId, lineId, updates)
}

function openProjectPo(poId: string) {
  activeTab.value = 'purchase-orders'
  selectedProjectPoId.value = poId
  window.history.replaceState(null, '', `#project-po-${poId}`)
}

function closeProjectPo() {
  selectedProjectPoId.value = ''
  window.history.replaceState(null, '', '#project-pos')
}

function syncQuoteScroll(source: 'top' | 'bottom', event: Event) {
  if (syncingQuoteScroll) return
  const top = event.currentTarget as HTMLDivElement
  const bottom = top.parentElement?.querySelector<HTMLDivElement>('.table-scroll')
  const topScroller = top.parentElement?.querySelector<HTMLDivElement>('.table-scroll-top')
  const target = source === 'top' ? bottom : topScroller
  if (!target) return

  syncingQuoteScroll = true
  target.scrollLeft = top.scrollLeft
  window.requestAnimationFrame(() => {
    syncingQuoteScroll = false
  })
}

async function exportQuotePdf(quote: CustomerQuote) {
  await downloadCustomerQuotePdf(quote, project.value)
}

async function exportQuoteExcel(quote: CustomerQuote) {
  await exportCustomerQuoteWorkbook(quote, project.value)
}

async function exportPoPdf(po: PurchaseOrder) {
  await downloadPurchaseOrderPdf(po, project.value)
}

async function exportTrackingWorkbook() {
  if (!project.value) return
  await exportProjectTrackingWorkbook(project.value)
}

async function exportCheckbookWorkbook() {
  if (!project.value) return
  await exportCheckbookFinancialWorkbook(project.value)
}

async function exportCheckbookPdf() {
  if (!project.value) return
  await exportCheckbookReportPdf(project.value)
}

async function exportConsolidatedTrackingPdf() {
  if (!project.value) return
  await exportCustomerConsolidatedTrackingReportPdf(project.value)
}

async function importCheckbookWorkbook(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const rows = await parseCheckbookPoFile(file)
    const result = importCheckbookPurchaseOrders(String(route.params.id), rows)
    project.value = result.project
    importMessage.value = `${result.importedCount} PO${result.importedCount === 1 ? '' : 's'} imported. ${result.skippedCount} skipped.`
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to import the workbook.')
  }
}

async function importTrackingWorkbook(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const rows = await parseTrackingImportFile(file)
    const result = importPurchaseOrderTracking(String(route.params.id), rows)
    project.value = result.project
    importMessage.value = `${result.importedCount} PO${result.importedCount === 1 ? '' : 's'} updated from tracking import. ${result.skippedCount} skipped.`
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to import the tracking file.')
  }
}

function formatDate(value: string) {
  return formatDisplayDate(value)
}

function formatDateOrPending(value: string | undefined) {
  return value ? formatDate(value) : 'Pending'
}

function inputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : ''
}

function percentOf(value: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)))
}

function isShippedStatus(status: Status) {
  return ['Shipped', 'Shipped to Customer', 'Partially Shipped', 'Delivered'].includes(status)
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function ageInDays(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Open'
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
  return `${diff} day${diff === 1 ? '' : 's'}`
}

const propsForComponents = {}
void propsForComponents
</script>

<script lang="ts">
import { defineComponent, h, resolveComponent } from 'vue'

export const DetailStat = defineComponent({
  props: {
    href: { type: String, required: true },
    icon: { type: [Object, Function], required: true },
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    detail: { type: String, required: true },
    tone: { type: String, default: 'default' },
  },
  setup(props) {
    return () =>
      h('a', { href: props.href, class: 'detail-stat' }, [
        h('div', { class: 'detail-stat-top' }, [
          h('span', { class: `detail-stat-icon tone-${props.tone}` }, [h(props.icon as Component, { size: 20 })]),
          h('div', [h('p', props.label), h('strong', props.value)]),
        ]),
        h('span', { class: 'detail-stat-link' }, `${props.detail} ->`),
      ])
  },
})

export const SummaryTile = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    tone: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: `summary-tile summary-${props.tone}` }, [
        h('p', props.label),
        h('strong', String(props.value)),
      ])
  },
})

export const HealthCard = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    percent: { type: Number, required: true },
    tone: { type: String, default: 'default' },
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h('div', { class: `project-health-card health-${props.tone}` }, [
        h('p', props.label),
        h('strong', String(props.value)),
        props.compact
          ? null
          : h('div', { class: 'project-health-progress', 'aria-hidden': 'true' }, [
              h('span', { style: { width: `${props.percent}%` } }),
            ]),
        props.compact ? null : h('small', `${props.percent}% complete`),
      ])
  },
})

export const ProgressRow = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
    total: { type: Number, required: true },
    percent: { type: Number, required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: 'material-progress-row' }, [
        h('div', { class: 'material-progress-copy' }, [
          h('strong', props.label),
          h('span', `${currency(props.value)} of ${currency(props.total)}`),
        ]),
        h('div', { class: 'material-progress-meter' }, [h('span', { style: { width: `${props.percent}%` } })]),
        h('em', `${props.percent}%`),
      ])
  },
})

export const DashboardAction = defineComponent({
  props: {
    href: { type: String, required: true },
    icon: { type: [Object, Function], required: true },
    label: { type: String, required: true },
    description: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h('a', { href: props.href, class: 'dashboard-action' }, [
        h('span', [h(props.icon as Component, { size: 20 })]),
        h('h3', props.label),
        h('p', props.description),
      ])
  },
})

export const InfoTile = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'info-tile' }, [h('p', props.label), h('strong', props.value)])
  },
})

export const PanelHeading = defineComponent({
  props: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    pill: { type: String, default: '' },
    tone: { type: String, default: 'success' },
  },
  setup(props, { slots }) {
    return () =>
      h('div', { class: 'panel-heading' }, [
        h('div', [h('h2', props.title), h('p', props.description)]),
        slots.default?.() ??
          (props.pill ? h('span', { class: `panel-pill pill-${props.tone}` }, props.pill) : null),
      ])
  },
})

export const DocumentTile = defineComponent({
  props: {
    icon: { type: [Object, Function], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    href: { type: String, required: true },
    action: { type: String, required: true },
  },
  setup(props) {
    const RouterLink = resolveComponent('RouterLink')
    return () =>
      h('div', { class: 'document-tile' }, [
        h(props.icon as Component, { size: 22 }),
        h('h3', props.title),
        h('p', props.description),
        h(RouterLink, { to: props.href, class: 'doc-action' }, () => props.action),
      ])
  },
})
</script>
