<template>
  <div class="projects-page">
    <header class="page-heading">
      <div>
        <h1>Projects</h1>
        <p>Create and manage Cronos project records before quoting and procurement begin.</p>
      </div>
      <RouterLink class="primary-action" to="/projects/new">
        <Plus :size="17" />
        <span>Add Project</span>
      </RouterLink>
    </header>

    <div v-if="projects.length" class="data-table-frame">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="column in projectColumns" :key="column" class="nowrap">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in projects" :key="project.id">
              <td class="nowrap">
                <RouterLink class="table-link" :to="`/projects/${project.id}`">{{ project.projectNumber }}</RouterLink>
              </td>
              <td>{{ project.projectName }}</td>
              <td>{{ project.customer }}</td>
              <td>{{ assignedUserNames(project).join(', ') || '-' }}</td>
              <td>{{ project.projectType }}</td>
              <td><StatusBadge :status="project.status" /></td>
              <td>{{ currency(projectQuoteTotals(project).totalCost) }}</td>
              <td>{{ currency(projectQuoteTotals(project).customerTotal) }}</td>
              <td>{{ checkbookBalance(project) }}</td>
              <td>
                <div class="table-action-row">
                  <RouterLink class="table-link" :to="`/projects/${project.id}/quotes/new`">Add Quote</RouterLink>
                  <RouterLink class="table-mini-button" :to="`/projects/${project.id}/edit`">
                    <Pencil :size="14" />
                    <span>Edit</span>
                  </RouterLink>
                  <button
                    v-if="isAdmin"
                    class="table-mini-button danger"
                    type="button"
                    :title="`Delete ${project.projectNumber}`"
                    @click="deleteSelectedProject(project)"
                  >
                    <Trash2 :size="14" />
                    <span>Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <section v-else class="large-empty-card">
      <h2>No projects yet</h2>
      <p>
        Start by creating a project with customer, contract, POP, delivery location, PM, engineer,
        and status.
      </p>
      <RouterLink class="primary-action" to="/projects/new">
        <Plus :size="17" />
        <span>Add Project</span>
      </RouterLink>
    </section>

    <section class="rollup-card">
      <div class="rollup-header">
        <div>
          <h2>Purchased Equipment Rollup</h2>
          <p>All project equipment lines converted into purchase orders.</p>
        </div>
        <input v-model="equipmentSearch" type="search" placeholder="Search project, PO, part, tracking..." />
      </div>

      <div class="equipment-metrics">
        <DashboardMetric
          v-for="metric in equipmentMetrics"
          :key="metric.label"
          href="/projects"
          :label="metric.label"
          :value="metric.value"
          :action="metric.action"
          :icon="metric.icon"
          :tone="metric.tone"
        />
      </div>

      <div v-if="filteredPurchasedEquipment.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>PO #</th>
                <th>Vendor</th>
                <th>CLIN</th>
                <th>Part #</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Received</th>
                <th>Vendor Order</th>
                <th>Est. Ship</th>
                <th>Received Date</th>
                <th>Carrier</th>
                <th>Tracking</th>
                <th>Status</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in filteredPurchasedEquipment" :key="`${line.poId}-${line.id}`">
                <td class="nowrap">
                  <RouterLink class="table-link" :to="`/projects/${line.projectId}`">{{ line.projectNumber }}</RouterLink>
                </td>
                <td class="nowrap">
                  <RouterLink class="table-link dark" :to="`/purchase-orders/${line.poId}`">{{ line.poNumber }}</RouterLink>
                </td>
                <td>{{ line.vendor }}</td>
                <td>{{ line.clin }}</td>
                <td><strong>{{ line.partNumber }}</strong></td>
                <td>{{ line.description }}</td>
                <td>{{ line.quantityOrdered }}</td>
                <td>{{ line.quantityReceived }}</td>
                <td>{{ line.vendorOrderNumber || 'Pending' }}</td>
                <td>{{ formatDateOrPending(line.estimatedShipDate) }}</td>
                <td>{{ formatDateOrPending(line.receivedDate || line.expectedDeliveryDate) }}</td>
                <td>{{ line.carrier || 'Pending' }}</td>
                <td>
                  <a
                    v-if="line.trackingUrl && line.trackingNumber"
                    class="table-link"
                    :href="line.trackingUrl"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ line.trackingNumber }}
                  </a>
                  <span v-else>{{ line.trackingNumber || 'Pending' }}</span>
                </td>
                <td><StatusBadge :status="line.status" /></td>
                <td>{{ currency(line.unitCost * line.quantityOrdered) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <section v-else class="large-empty-card equipment-empty">
        <h2>No purchased equipment yet</h2>
        <p>
          Once a quote is approved and purchase orders are generated, the full equipment list will
          roll up here.
        </p>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Boxes, PackageCheck, Pencil, Plus, ShoppingCart, Trash2, Truck } from '@lucide/vue'
import DashboardMetric from '../components/DashboardMetric.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { calculateQuoteSummary, currency } from '../services/calculations'
import { getCheckbookSummary } from '../services/checkbook'
import { formatDisplayDate } from '../services/dateFormat'
import { fetchSession, loadUsers } from '../services/auth'
import { deleteProject, loadProjects } from '../services/localProjects'
import type { Metric, Project, PurchaseOrderLine, Status } from '../types'

type PurchasedEquipmentLine = PurchaseOrderLine & {
  projectId: string
  projectNumber: string
  projectName: string
  customer: string
  poId: string
  poNumber: string
  vendor: string
  poStatus: Status
  expectedDeliveryDate?: string
}

const equipmentSearch = ref('')
const projects = ref<Project[]>(loadProjects())
const isAdmin = ref(false)
const users = ref(loadUsers())

onMounted(() => {
  refreshSession()
  window.addEventListener('cronos:projects-changed', refreshProjects)
  window.addEventListener('cronos:session-changed', refreshSession)
})
onUnmounted(() => {
  window.removeEventListener('cronos:projects-changed', refreshProjects)
  window.removeEventListener('cronos:session-changed', refreshSession)
})

const projectColumns = [
  'Project #',
  'Project Name',
  'Customer',
  'Assigned',
  'Type',
  'Status',
  'Quote Cost',
  'Quote Total',
  'Checkbook Balance',
  'Actions',
]

const purchasedEquipment = computed<PurchasedEquipmentLine[]>(() =>
  projects.value.flatMap(project =>
    project.purchaseOrders.flatMap(po =>
      po.lines.map(line => ({
        ...line,
        projectId: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        customer: project.customer,
        poId: po.id,
        poNumber: po.poNumber,
        vendor: po.vendor,
        poStatus: po.status,
        vendorOrderNumber: line.vendorOrderNumber,
        estimatedShipDate: line.estimatedShipDate || po.estimatedShipDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        receivedDate: line.receivedDate,
        carrier: line.carrier || po.carrier,
        trackingNumber: line.trackingNumber || po.trackingNumber,
        trackingUrl: line.trackingUrl || po.trackingUrl,
        notes: line.notes,
      })),
    ),
  ),
)

const filteredPurchasedEquipment = computed(() => {
  const term = equipmentSearch.value.trim().toLowerCase()
  if (!term) return purchasedEquipment.value

  return purchasedEquipment.value.filter(line =>
    [
      line.projectNumber,
      line.projectName,
      line.customer,
      line.poNumber,
      line.vendor,
      line.clin,
      line.partNumber,
      line.manufacturer,
      line.description,
      line.carrier,
      line.trackingNumber,
      line.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term),
  )
})

const totalOrdered = computed(() => purchasedEquipment.value.reduce((total, line) => total + line.quantityOrdered, 0))
const totalReceived = computed(() => purchasedEquipment.value.reduce((total, line) => total + line.quantityReceived, 0))
const totalPurchasedCost = computed(() => purchasedEquipment.value.reduce((total, line) => total + line.unitCost * line.quantityOrdered, 0))
const trackingEnteredCount = computed(() => purchasedEquipment.value.filter(line => line.trackingNumber).length)

const equipmentMetrics = computed<Metric[]>(() => [
  { label: 'Purchased Lines', value: purchasedEquipment.value.length, action: 'PO equipment', icon: Boxes },
  { label: 'Purchased Cost', value: compactCurrency(totalPurchasedCost.value), action: 'Total PO cost', icon: ShoppingCart },
  { label: 'Qty Received', value: `${totalReceived.value} / ${totalOrdered.value}`, action: 'Warehouse progress', icon: PackageCheck, tone: 'success' },
  { label: 'Tracking Entered', value: trackingEnteredCount.value, action: 'Shipment updates', icon: Truck, tone: 'warning' },
])

function refreshProjects() {
  projects.value = loadProjects()
  users.value = loadUsers()
}

function refreshSession() {
  isAdmin.value = fetchSession()?.role === 'Admin'
  users.value = loadUsers()
}

function assignedUserNames(project: Project) {
  const ids = new Set(project.assignedUserIds ?? [])
  return users.value.filter(user => ids.has(user.id)).map(user => user.name)
}

function deleteSelectedProject(project: Project) {
  const confirmed = window.confirm(
    `Delete project ${project.projectNumber}?\n\nThis removes the project, quotes, purchase orders, inventory records, and project history for every user.`,
  )

  if (!confirmed) return

  deleteProject(project.id)
  refreshProjects()
}

function projectQuoteTotals(project: Project) {
  return (project.quotes ?? []).reduce(
    (summary, quote) => {
      const totals = calculateQuoteSummary(quote.lines, quote.contractFeeEnabled, quote.shippingCost)
      return {
        totalCost: summary.totalCost + totals.totalCost,
        customerTotal: summary.customerTotal + totals.customerTotal,
      }
    },
    { totalCost: 0, customerTotal: 0 },
  )
}

function checkbookBalance(project: Project) {
  return project.projectType === 'Checkbook' ? currency(getCheckbookSummary(project).remainingBalance) : '-'
}

function compactCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `$${Math.round(value / 1000)}K`
  return currency(value)
}

function formatDateOrPending(value: string | undefined) {
  if (!value) return 'Pending'
  return formatDisplayDate(value)
}
</script>
