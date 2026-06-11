<template>
  <div v-if="project" class="project-detail-page">
    <section class="project-hero">
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

      <div class="detail-stat-grid">
        <DetailStat
          href="#project-quotes"
          label="Quotes"
          :value="project.quotes.length"
          :detail="currency(quoteSummary.customerTotal)"
          :icon="FileText"
        />
        <DetailStat
          href="#project-pos"
          label="Purchase Orders"
          :value="project.purchaseOrders.length"
          :detail="currency(poSummary.totalCost)"
          :icon="ShoppingCart"
          tone="warning"
        />
        <DetailStat
          href="#project-equipment"
          label="Purchased Items"
          :value="purchasedEquipmentCount"
          :detail="`${poSummary.quantityReceived} / ${poSummary.quantityOrdered} received`"
          :icon="PackageCheck"
          tone="success"
        />
        <DetailStat
          href="#project-tasks"
          label="Open Tasks"
          :value="projectTasks.length"
          detail="Items needing attention"
          :icon="ListChecks"
          :tone="projectTasks.length ? 'danger' : 'success'"
        />
      </div>

      <div class="summary-tile-grid">
        <SummaryTile label="POs Not Sent" :value="poNotSentCount" tone="success" />
        <SummaryTile label="Tracking Missing" :value="trackingMissingCount" :tone="trackingMissingCount ? 'danger' : 'success'" />
        <SummaryTile label="Tracking Updated" :value="trackingUpdatedCount" tone="success" />
      </div>

      <div class="dashboard-action-grid">
        <DashboardAction href="#project-quotes" :icon="FileText" label="Quotes" description="View, edit, approve, export" />
        <DashboardAction href="#project-pos" :icon="ReceiptText" label="Purchase Orders" description="Vendor POs and PDF exports" />
        <DashboardAction href="#project-documents" :icon="FileSpreadsheet" label="Financial Docs" description="Reports and customer files" />
        <DashboardAction href="#project-tasks" :icon="ClipboardList" label="Tasks" description="Open work by priority" />
        <DashboardAction href="#project-equipment" :icon="PackageCheck" label="Equipment" description="Parts, costs, receiving" />
        <DashboardAction href="/purchase-orders" :icon="Truck" label="Tracking" description="Shipping dates and carriers" />
      </div>
    </section>

    <section class="info-tile-grid">
      <InfoTile label="Type" :value="project.projectType" />
      <InfoTile label="Assigned" :value="assignedUserNames || '-'" />
      <InfoTile label="PM" :value="project.projectManager || '-'" />
      <InfoTile label="Engineer" :value="project.engineer || '-'" />
      <InfoTile label="POP" :value="`${project.startDate || 'TBD'} to ${project.endDate || 'TBD'}`" />
      <InfoTile label="Delivery" :value="project.deliveryAddress || '-'" />
    </section>

    <section class="detail-panel" id="missing-tracking">
      <PanelHeading
        title="Tracking Missing"
        description="Update tracking, carrier, estimated ship date, and line status for open project items."
        :pill="trackingMissingCount ? `${trackingMissingCount} line${trackingMissingCount === 1 ? '' : 's'} missing` : 'All tracking entered'"
        :tone="trackingMissingCount ? 'danger' : 'success'"
      />
      <div v-if="missingTrackingLines.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table missing-tracking-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Vendor</th>
                <th>Part</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Tracking</th>
                <th>Carrier</th>
                <th>ESD</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in missingTrackingLines" :key="`${line.poId}-${line.id}`">
                <td class="nowrap">
                  <RouterLink class="table-link" :to="`/purchase-orders/${line.poId}`">{{ line.poNumber }}</RouterLink>
                </td>
                <td>{{ line.vendor }}</td>
                <td>
                  <strong>{{ line.partNumber }}</strong>
                  <small>{{ line.manufacturer || '-' }}</small>
                </td>
                <td>{{ line.description }}</td>
                <td>{{ line.quantityOrdered }}</td>
                <td>
                  <select class="cell-input w-40" :value="line.status" @change="updateLineTracking(line.poId, line.id, { status: inputValue($event) as Status })">
                    <option v-for="status in trackingStatusOptions" :key="status" :value="status">{{ status }}</option>
                  </select>
                </td>
                <td>
                  <input class="cell-input w-44" :value="line.trackingNumber ?? ''" @input="updateLineTracking(line.poId, line.id, { trackingNumber: inputValue($event) })" />
                </td>
                <td>
                  <input class="cell-input w-32" :value="line.carrier ?? ''" @input="updateLineTracking(line.poId, line.id, { carrier: inputValue($event) })" />
                </td>
                <td>
                  <input class="cell-input w-36" type="date" :value="line.estimatedShipDate ?? ''" @input="updateLineTracking(line.poId, line.id, { estimatedShipDate: inputValue($event) })" />
                </td>
                <td>
                  <input class="cell-input w-52" :value="line.notes ?? ''" @input="updateLineTracking(line.poId, line.id, { notes: inputValue($event) })" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="success-empty">
        <CheckCircle2 :size="28" />
        <p>All open project lines have tracking entered.</p>
      </div>
    </section>

    <section class="detail-panel" id="project-tasks">
      <PanelHeading
        title="Project Tasks"
        description="Open items that need action before this project can move forward."
        :pill="projectTasks.length ? `${projectTasks.length} open` : 'All clear'"
        :tone="projectTasks.length ? 'danger' : 'success'"
      />
      <DataTable v-if="projectTasks.length" :columns="['Priority', 'Task', 'Area', 'Action']" :rows="projectTaskRows" />
      <div v-else class="success-empty">
        <CheckCircle2 :size="28" />
        <p>No open project tasks detected.</p>
      </div>
    </section>

    <div v-if="importMessage" class="import-success-note">
      {{ importMessage }}
    </div>

    <section class="detail-panel" id="project-documents">
      <PanelHeading
        title="Financial Docs & Exports"
        description="Customer-facing quote PDFs, vendor PO PDFs, and checkbook reporting when applicable."
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
            ref="trackingFileInput"
            class="hidden-file-input"
            type="file"
            accept=".csv,.txt,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            @change="importTrackingWorkbook"
          />
          <input
            ref="checkbookFileInput"
            class="hidden-file-input"
            type="file"
            accept=".csv,.txt,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            @change="importCheckbookWorkbook"
          />
        </div>
      </PanelHeading>
      <div class="document-grid">
        <DocumentTile :icon="FileText" title="Customer Quote PDFs" :description="`${project.quotes.length} quotes available in the quote table`" href="#project-quotes" action="Go to Quotes" />
        <DocumentTile :icon="ReceiptText" title="Vendor PO PDFs" :description="`${project.purchaseOrders.length} purchase orders available in the PO table`" href="#project-pos" action="Go to POs" />
        <div class="document-tile">
          <Truck :size="22" />
          <h3>PO / Inventory Rollup</h3>
          <p>Excel tracking report with line items, vendor orders, carrier, ESD, received date, and status.</p>
          <button class="doc-action" type="button" @click="exportTrackingWorkbook">Export XLSX</button>
        </div>
        <div v-if="purchasedEquipmentRows.length" class="document-tile">
          <Download :size="22" />
          <h3>Customer Tracking Report</h3>
          <p>Consolidated item-level shipping report for this project. Pricing is omitted.</p>
          <button class="doc-action" type="button" @click="exportConsolidatedTrackingPdf">Customer Tracking PDF</button>
        </div>
        <div v-if="checkbookSummary" class="document-tile">
          <FileSpreadsheet :size="22" />
          <h3>Checkbook Reports</h3>
          <p>Financial report and tracking workbook for customer balance reporting.</p>
          <div class="doc-action-row">
            <button class="doc-action" type="button" @click="exportCheckbookPdf">PDF</button>
            <button class="doc-action secondary-doc-action" type="button" @click="exportCheckbookWorkbook">XLSX</button>
          </div>
        </div>
        <div v-else class="document-tile muted">
          <FileSpreadsheet :size="22" />
          <h3>Checkbook Reports</h3>
          <p>Available when the project type is Checkbook.</p>
        </div>
      </div>
    </section>

    <section v-if="checkbookSummary" class="detail-panel">
      <PanelHeading
        title="Checkbook Financials"
        description="Customer balance is reduced by issued PO customer cost."
      >
        <div class="page-actions">
          <button class="secondary-action icon-action" type="button" @click="exportCheckbookWorkbook">
            <FileSpreadsheet :size="17" />
            <span>Tracking XLSX</span>
          </button>
          <button class="secondary-action icon-action" type="button" @click="exportCheckbookPdf">
            <Download :size="17" />
            <span>Financial Report PDF</span>
          </button>
        </div>
      </PanelHeading>
      <div class="checkbook-summary-grid">
        <InfoTile label="Starting Balance" :value="currency(checkbookSummary.startingBalance)" />
        <InfoTile label="Cost to Customer" :value="currency(checkbookSummary.customerCost)" />
        <InfoTile label="Remaining Balance" :value="currency(checkbookSummary.remainingBalance)" />
        <InfoTile label="Cronos Cost" :value="currency(checkbookSummary.ourCost)" />
        <InfoTile label="Gross Profit" :value="currency(checkbookSummary.grossProfit)" />
      </div>
      <DataTable
        v-if="checkbookSummary.lines.length"
        :columns="['PO #', 'Quote #', 'Vendor', 'Description', 'Requestor', 'Date Issued', 'Our Cost', 'Customer Cost', 'Profit']"
        :rows="checkbookRows"
      />
      <section v-else class="large-empty-card compact-empty">
        <p>No purchase orders have been issued against this checkbook yet.</p>
      </section>
    </section>

    <section id="project-quotes" class="linked-section">
      <div class="section-title-row">
        <h2>Project Quotes</h2>
        <RouterLink :to="`/projects/${project.id}/quotes/new`">Add Quote</RouterLink>
      </div>
      <div v-if="project.quotes.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Quote #</th>
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
                      v-if="quote.status === 'Customer Approved'"
                      class="mini-action danger"
                      type="button"
                      @click="toggleQuoteApproval(quote.id, false)"
                    >
                      <XCircle :size="14" />
                      <span>Not Approved</span>
                    </button>
                    <button
                      v-else
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

    <section id="project-pos" class="linked-section">
      <div class="section-title-row">
        <h2>Purchase Orders</h2>
        <RouterLink to="/purchase-orders">View all POs</RouterLink>
      </div>
      <div v-if="project.purchaseOrders.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Date Issued</th>
                <th>Lines</th>
                <th>Total Cost</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="po in project.purchaseOrders" :key="po.id">
                <td class="nowrap">
                  <RouterLink class="table-link" :to="`/purchase-orders/${po.id}`">{{ po.poNumber }}</RouterLink>
                </td>
                <td>{{ po.vendor }}</td>
                <td><StatusBadge :status="po.status" /></td>
                <td class="nowrap">{{ po.dateIssued }}</td>
                <td>{{ po.lines.length }}</td>
                <td>{{ currency(po.totalCost) }}</td>
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
    </section>

    <section id="project-equipment" class="linked-section">
      <h2>Purchased Equipment Rollup</h2>
      <p class="section-description">
        All line items purchased for this project, including PO send status and tracking status.
      </p>
      <DataTable
        v-if="purchasedEquipmentRows.length"
        :columns="['PO #', 'Vendor', 'CLIN', 'Part', 'Description', 'Qty', 'Item Status', 'PO Sent', 'Vendor Order', 'Tracking', 'Carrier', 'ESD', 'Received']"
        :rows="purchasedEquipmentRows"
      />
      <section v-else class="large-empty-card compact-empty">
        <p>No purchased equipment has been generated yet.</p>
      </section>
    </section>

    <section class="bottom-status-grid">
      <div class="detail-panel">
        <h2>Kitting Status</h2>
        <StatusBadge :status="project.kitStatus" />
      </div>
      <div class="detail-panel">
        <h2>Shipment Status</h2>
        <StatusBadge :status="project.shipmentStatus" />
      </div>
      <div class="detail-panel">
        <h2>Notes</h2>
        <p class="notes-copy">{{ project.notes || 'No notes yet.' }}</p>
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
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  PackageCheck,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingCart,
  Truck,
  Upload,
  XCircle,
} from '@lucide/vue'
import type { Component } from 'vue'
import DataTable from '../components/DataTable.vue'
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
import { exportCheckbookFinancialWorkbook, exportProjectTrackingWorkbook } from '../services/workbookExports'
import type { CustomerQuote, Project, PurchaseOrder, PurchaseOrderLine, Status } from '../types'

type Tone = 'default' | 'warning' | 'danger' | 'success'
type PurchasedEquipmentLine = PurchaseOrderLine & {
  poId: string
  poNumber: string
  poStatus: Status
  vendor: string
}

const route = useRoute()
const project = ref<Project>()
const users = ref(loadUsers())
const importMessage = ref('')
const checkbookFileInput = ref<HTMLInputElement | null>(null)
const trackingFileInput = ref<HTMLInputElement | null>(null)
const trackingStatusOptions: Status[] = ['Ordered', 'Backordered', 'Partially Received', 'Received', 'Shipped', 'Delivered', 'Cancelled']

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
        summary.quantityReceived += line.quantityReceived
      })
      summary.totalCost += po.totalCost
      return summary
    },
    { totalCost: 0, quantityOrdered: 0, quantityReceived: 0 },
  ),
)

const purchasedEquipmentCount = computed(() =>
  (project.value?.purchaseOrders ?? []).reduce((total, po) => total + po.lines.length, 0),
)

const purchasedEquipmentLines = computed<PurchasedEquipmentLine[]>(() =>
  (project.value?.purchaseOrders ?? []).flatMap(po =>
    po.lines.map(line => ({
      ...line,
      poId: po.id,
      poNumber: po.poNumber,
      poStatus: po.status,
      vendor: po.vendor,
      carrier: line.carrier || po.carrier,
      trackingNumber: line.trackingNumber || po.trackingNumber,
      estimatedShipDate: line.estimatedShipDate || po.estimatedShipDate,
      receivedDate: line.receivedDate || po.expectedDeliveryDate,
    })),
  ),
)

const purchasedEquipmentRows = computed(() =>
  purchasedEquipmentLines.value.map(line => [
      { type: 'link' as const, label: line.poNumber, to: `/purchase-orders/${line.poId}`, className: 'table-link' },
      line.vendor,
      line.clin,
      line.partNumber,
      line.description,
      `${line.quantityReceived} / ${line.quantityOrdered}`,
      { type: 'badge' as const, status: line.status },
      line.poStatus === 'PO Generated' ? 'Pending Send' : 'Sent',
      line.vendorOrderNumber || 'Pending',
      line.trackingNumber || (line.poStatus === 'PO Generated' ? 'Not Required Yet' : 'Needs Tracking'),
      line.carrier || 'Pending',
      formatDateOrPending(line.estimatedShipDate),
      formatDateOrPending(line.receivedDate),
    ]),
)

const poNotSentCount = computed(
  () => project.value?.purchaseOrders.filter(po => po.status === 'PO Generated').length ?? 0,
)

const missingTrackingLines = computed(() =>
  purchasedEquipmentLines.value.filter(line => line.poStatus !== 'PO Generated' && !line.trackingNumber),
)

const trackingMissingCount = computed(() => missingTrackingLines.value.length)

const trackingUpdatedCount = computed(
  () => purchasedEquipmentLines.value.filter(line => line.trackingNumber).length,
)

const projectTasks = computed(() =>
  buildProjectTasks(),
)

const projectTaskRows = computed(() =>
  projectTasks.value.map(task => [
    task.priority,
    `${task.title} ${task.description}`,
    task.area,
    { type: 'link' as const, label: task.action, to: task.href, className: 'table-link' },
  ]),
)

const checkbookSummary = computed(() =>
  project.value?.projectType === 'Checkbook' ? getCheckbookSummary(project.value) : undefined,
)

const checkbookRows = computed(() =>
  (checkbookSummary.value?.lines ?? []).map(line => [
    { type: 'link' as const, label: line.poNumber, to: `/purchase-orders/${line.poId}`, className: 'table-link' },
    line.quoteNumber,
    line.vendor,
    line.description || '-',
    line.requestor || '-',
    line.dateIssued,
    currency(line.ourCost),
    currency(line.customerCost),
    currency(line.grossProfit),
  ]),
)

function buildProjectTasks() {
  const currentProject = project.value
  if (!currentProject) return []

  const tasks: Array<{
    id: string
    priority: string
    title: string
    description: string
    area: string
    action: string
    href: string
  }> = []

  if (!currentProject.quotes.length) {
    tasks.push(createTask(
      'quote-needed',
      'High',
      'Create the first project quote',
      'No customer quote has been created for this project.',
      'Quotes',
      'Add Quote',
      `/projects/${currentProject.id}/quotes/new`,
    ))
  }

  currentProject.quotes.forEach(quote => {
    if (quote.status !== 'Customer Approved') {
      tasks.push(createTask(
        `quote-approval-${quote.id}`,
        'High',
        `Approve or revise ${quote.quoteNumber}`,
        'Quote has not been marked customer approved.',
        'Quotes',
        'Review Quote',
        '#project-quotes',
      ))
    }

    if (quote.status === 'Customer Approved' && !currentProject.purchaseOrders.some(po => po.quoteId === quote.id)) {
      tasks.push(createTask(
        `po-generate-${quote.id}`,
        'High',
        `Generate POs for ${quote.quoteNumber}`,
        'Approved quote does not have vendor purchase orders yet.',
        'Purchase Orders',
        'Generate POs',
        '#project-quotes',
      ))
    }
  })

  currentProject.purchaseOrders.forEach(po => {
    if (po.status === 'PO Generated') {
      tasks.push(createTask(
        `po-send-${po.id}`,
        'High',
        `Send ${po.poNumber} to ${po.vendor}`,
        'PO has been generated but has not been marked issued/sent.',
        'Purchase Orders',
        'Open PO',
        `/purchase-orders/${po.id}`,
      ))
    }

    if (!po.estimatedShipDate && !po.expectedDeliveryDate) {
      tasks.push(createTask(
        `ship-date-${po.id}`,
        'Medium',
        `Add shipping dates for ${po.poNumber}`,
        'Estimated ship date or ETA is missing.',
        'Tracking',
        'Open PO',
        `/purchase-orders/${po.id}`,
      ))
    }

    if (!po.trackingNumber) {
      tasks.push(createTask(
        `tracking-${po.id}`,
        'Medium',
        `Add tracking for ${po.poNumber}`,
        'Carrier tracking has not been entered.',
        'Tracking',
        'Open PO',
        `/purchase-orders/${po.id}`,
      ))
    }

    const remaining = po.lines.reduce((total, line) => total + Math.max(0, line.quantityOrdered - line.quantityReceived), 0)
    if (remaining > 0) {
      tasks.push(createTask(
        `receiving-${po.id}`,
        'Low',
        `Receive ${remaining} item${remaining === 1 ? '' : 's'} on ${po.poNumber}`,
        'Warehouse receiving is not complete.',
        'Warehouse',
        'Go to Equipment',
        '#project-equipment',
      ))
    }
  })

  if (checkbookSummary.value && checkbookSummary.value.remainingBalance < 0) {
    tasks.push(createTask(
      'checkbook-overrun',
      'High',
      'Checkbook balance is overdrawn',
      'Customer-facing PO cost exceeds the starting balance.',
      'Financial Docs',
      'Review Financials',
      '#project-documents',
    ))
  }

  return tasks
}

function createTask(
  id: string,
  priority: string,
  title: string,
  description: string,
  area: string,
  action: string,
  href: string,
) {
  return {
    id,
    priority,
    title,
    description,
    area,
    action,
    href,
  }
}

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

async function exportQuotePdf(quote: CustomerQuote) {
  await downloadCustomerQuotePdf(quote, project.value)
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
