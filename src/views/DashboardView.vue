<template>
  <div class="procurement-dashboard">
    <header class="dashboard-header procurement-command-header">
      <div>
        <p class="dashboard-kicker">Atlas Procurement</p>
        <h1>Procurement Dashboard</h1>
        <p>Action queue for tasks, due-outs, vendor follow-ups, material risks, shipments, and alerts.</p>
      </div>
      <div class="dashboard-actions procurement-actions">
        <label class="search-box">
          <input v-model="filters.search" type="search" placeholder="Search project, PO, vendor, manufacturer, part..." />
          <Search :size="20" />
        </label>
        <div class="segmented-control" aria-label="Dashboard view">
          <button type="button" :class="{ active: viewMode === 'my' }" @click="viewMode = 'my'">My View</button>
          <button type="button" :class="{ active: viewMode === 'team' }" @click="viewMode = 'team'">Team View</button>
        </div>
      </div>
    </header>

    <section class="procurement-filter-bar">
      <label>
        <span>Assigned User</span>
        <select v-model="filters.userId">
          <option value="">All Users</option>
          <option v-for="user in activeUsers" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
      </label>
      <label>
        <span>Project</span>
        <input v-model="filters.project" placeholder="Project #" />
      </label>
      <label>
        <span>Customer</span>
        <input v-model="filters.customer" placeholder="Customer" />
      </label>
      <label>
        <span>Vendor</span>
        <input v-model="filters.vendor" placeholder="Vendor" />
      </label>
      <label>
        <span>Status</span>
        <select v-model="filters.status">
          <option value="">All Statuses</option>
          <option>Open</option>
          <option>In Progress</option>
          <option>Waiting</option>
          <option>Complete</option>
          <option>Resolved</option>
        </select>
      </label>
      <label>
        <span>Priority</span>
        <select v-model="filters.priority">
          <option value="">All Priorities</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </label>
      <label>
        <span>Due</span>
        <select v-model="filters.dueDate">
          <option value="">Any Due Date</option>
          <option value="today">Due Today</option>
          <option value="week">Due This Week</option>
          <option value="overdue">Overdue</option>
        </select>
      </label>
    </section>

    <div class="procurement-dashboard-layout">
      <main class="procurement-dashboard-main">
        <section class="procurement-top-grid">
          <DashboardPanel title="My Tasks" :meta="`${visibleTasks.length} open`">
            <div v-if="visibleTasks.length" class="action-table-scroll">
              <table class="action-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Customer</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Related</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="task in visibleTasks" :key="task.id">
                    <td>
                      <strong>{{ task.title }}</strong>
                      <small>{{ task.description }}</small>
                    </td>
                    <td>{{ task.projectNumber }}</td>
                    <td>{{ task.customer }}</td>
                    <td><Badge :label="task.priority" :tone="priorityTone(task.priority)" /></td>
                    <td>{{ formatShortDate(task.dueDate) }}</td>
                    <td><Badge :label="task.status" :tone="statusTone(task.status)" /></td>
                    <td>
                      <select :value="task.assignedToUserId" :disabled="!canReassign" @change="reassignTask(task.id, inputValue($event))">
                        <option v-for="user in activeUsers" :key="user.id" :value="user.id">{{ user.name }}</option>
                      </select>
                    </td>
                    <td>
                      <RouterLink class="table-link" :to="task.relatedHref">{{ task.relatedRecordType }} {{ task.relatedRecordId }}</RouterLink>
                    </td>
                    <td>
                      <div class="dashboard-row-actions">
                        <button type="button" @click="completeTask(task.id)">Complete</button>
                        <input :value="task.dueDate" type="date" @change="changeTaskDueDate(task.id, inputValue($event))" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <EmptyState v-else title="No tasks need action" detail="Your filtered task queue is clear." />
          </DashboardPanel>

          <DashboardPanel title="Due Outs" :meta="`${visibleDueOuts.length} records`">
            <div class="due-out-tabs">
              <button v-for="category in dueOutCategories" :key="category.label" type="button" :class="{ active: dueOutCategory === category.key }" @click="dueOutCategory = category.key">
                {{ category.label }} <span>{{ category.count }}</span>
              </button>
            </div>
            <div v-if="visibleDueOuts.length" class="compact-record-list">
              <RouterLink v-for="dueOut in visibleDueOuts" :key="dueOut.id" :to="`/projects/${dueOut.projectId}`" class="compact-record">
                <div>
                  <strong>{{ dueOut.title }}</strong>
                  <small>{{ dueOut.projectNumber }} - {{ dueOut.customer }}</small>
                </div>
                <Badge :label="dueOut.waitingOn" tone="warning" />
                <span>{{ dueOut.owner }}</span>
                <span>{{ formatShortDate(dueOut.dueDate) }}</span>
                <em>{{ agingDays(dueOut.dueDate) }}d aging</em>
                <p>{{ dueOut.nextAction }}</p>
              </RouterLink>
            </div>
            <EmptyState v-else title="No due-outs found" detail="No due-outs match the selected category." />
          </DashboardPanel>

          <DashboardPanel title="Vendor Updates Needed" :meta="`${visibleVendorUpdates.length} flags`">
            <div v-if="visibleVendorUpdates.length" class="compact-record-list">
              <RouterLink v-for="update in visibleVendorUpdates" :key="update.id" :to="update.relatedHref" class="compact-record vendor-record">
                <div>
                  <strong>{{ update.vendor }}</strong>
                  <small>{{ update.poNumber }} - {{ update.projectNumber }}</small>
                </div>
                <Badge :label="update.issueType" tone="danger" />
                <span>{{ formatShortDate(update.lastUpdateDate) }}</span>
                <em>{{ update.daysSinceUpdate }} days</em>
                <p>{{ update.nextAction }}</p>
              </RouterLink>
            </div>
            <EmptyState v-else title="Vendors are current" detail="No missing ETA, tracking, response, or recovery-date flags." />
          </DashboardPanel>
        </section>

        <section class="procurement-middle-grid">
          <DashboardPanel title="Material At Risk" :meta="`${visibleRisks.length} risks`">
            <div v-if="visibleRisks.length" class="action-table-scroll">
              <table class="action-table risk-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Customer</th>
                    <th>Manufacturer</th>
                    <th>Part</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Required</th>
                    <th>ETA</th>
                    <th>Reason</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="risk in visibleRisks" :key="risk.id">
                    <td><RouterLink class="table-link" :to="risk.relatedHref">{{ risk.projectNumber }}</RouterLink></td>
                    <td>{{ risk.customer }}</td>
                    <td>{{ risk.manufacturer }}</td>
                    <td><strong>{{ risk.partNumber }}</strong></td>
                    <td>{{ risk.description }}</td>
                    <td>{{ risk.quantity }}</td>
                    <td>{{ formatShortDate(risk.requiredByDate) }}</td>
                    <td>{{ risk.currentEta ? formatShortDate(risk.currentEta) : 'Pending' }}</td>
                    <td>{{ risk.riskReason }}</td>
                    <td><Badge :label="risk.severity" :tone="priorityTone(risk.severity)" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <EmptyState v-else title="No material at risk" detail="No filtered items are currently threatening project delivery." />
          </DashboardPanel>

          <DashboardPanel title="Open Procurement Pipeline">
            <div class="pipeline-card-grid">
              <RouterLink
                v-for="row in filteredPipeline"
                :key="row.status"
                :to="row.href"
                class="pipeline-status-card"
                :class="{ active: pipelineFilter === row.status }"
                @click.prevent="togglePipeline(row.status)"
              >
                <span>{{ row.status }}</span>
                <strong>{{ row.count }}</strong>
              </RouterLink>
            </div>
          </DashboardPanel>
        </section>

        <section class="procurement-bottom-grid">
          <DashboardPanel title="Shipment Tracking" :meta="`${visibleShipments.length} shipments`">
            <div class="shipment-summary">
              <button v-for="row in shipmentSummary" :key="row.status" type="button" :class="{ active: shipmentFilter === row.status }" @click="shipmentFilter = shipmentFilter === row.status ? '' : row.status">
                {{ row.status }} <strong>{{ row.count }}</strong>
              </button>
            </div>
            <div v-if="visibleShipments.length" class="action-table-scroll">
              <table class="action-table">
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th>Tracking</th>
                    <th>Vendor</th>
                    <th>Project</th>
                    <th>PO</th>
                    <th>Estimated Delivery</th>
                    <th>Status</th>
                    <th>Exception Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="shipment in visibleShipments" :key="shipment.id">
                    <td>{{ shipment.carrier }}</td>
                    <td>{{ shipment.trackingNumber }}</td>
                    <td>{{ shipment.vendor }}</td>
                    <td>{{ shipment.projectNumber }}</td>
                    <td><RouterLink class="table-link" :to="shipment.relatedHref">{{ shipment.poNumber }}</RouterLink></td>
                    <td>{{ shipment.estimatedDeliveryDate ? formatShortDate(shipment.estimatedDeliveryDate) : 'Pending' }}</td>
                    <td><Badge :label="shipment.deliveryStatus" :tone="shipmentTone(shipment.deliveryStatus)" /></td>
                    <td>{{ shipment.exceptionNotes || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <EmptyState v-else title="No shipments found" detail="No shipments match the current filters." />
          </DashboardPanel>

          <DashboardPanel title="Recent Procurement Activity">
            <div v-if="visibleActivity.length" class="activity-feed">
              <RouterLink v-for="activity in visibleActivity" :key="activity.id" :to="activity.relatedHref" class="activity-row">
                <time>{{ formatActivityTime(activity.timestamp) }}</time>
                <div>
                  <strong>{{ activity.action }}</strong>
                  <span>{{ activity.user }} - {{ activity.projectNumber }} - {{ activity.relatedRecordType }} {{ activity.relatedRecordId }}</span>
                  <p>{{ activity.notes }}</p>
                </div>
              </RouterLink>
            </div>
            <EmptyState v-else title="No recent activity" detail="Procurement updates will appear here as work is completed." />
          </DashboardPanel>
        </section>
      </main>

      <aside class="procurement-alert-rail">
        <DashboardPanel title="Alerts" :meta="`${visibleAlerts.length} urgent`">
          <div v-if="visibleAlerts.length" class="alert-stack">
            <RouterLink v-for="alert in visibleAlerts" :key="alert.id" :to="alert.relatedHref" class="alert-card" :class="`alert-${alert.severity.toLowerCase()}`">
              <Badge :label="alert.severity" :tone="priorityTone(alert.severity)" />
              <strong>{{ alert.title }}</strong>
              <p>{{ alert.description }}</p>
              <small>{{ alert.projectNumber }} - {{ alert.relatedRecordType }} {{ alert.relatedRecordId }}</small>
            </RouterLink>
          </div>
          <EmptyState v-else title="No urgent alerts" detail="Nothing is currently blocking procurement flow." />
        </DashboardPanel>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Search } from '@lucide/vue'
import { ensureDefaultAdminSession, fetchSession, getEffectiveRole, loadUsers } from '../services/auth'
import {
  loadProcurementDashboardData,
  updateProcurementTask,
  type ProcurementAlert,
  type ProcurementDueOut,
  type ProcurementPriority,
  type ProcurementRisk,
  type ProcurementShipment,
  type ProcurementStatus,
  type ProcurementTask,
  type RiskSeverity,
  type ShipmentStatus,
} from '../services/procurementDashboard'
import type { UserProfile } from '../types'

type ViewMode = 'my' | 'team'
type DueOutCategory = 'today' | 'week' | 'overdue' | 'vendor' | 'internal' | 'customer'
type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'critical' | 'muted'

const session = ref(import.meta.env.VITE_REQUIRE_AUTH === '1' ? fetchSession() : ensureDefaultAdminSession())
const users = ref<UserProfile[]>([])
const data = ref(loadProcurementDashboardData([]))
const viewMode = ref<ViewMode>('my')
const dueOutCategory = ref<DueOutCategory>('overdue')
const pipelineFilter = ref('')
const shipmentFilter = ref<ShipmentStatus | ''>('')
const filters = reactive({
  search: '',
  userId: '',
  project: '',
  customer: '',
  vendor: '',
  status: '',
  priority: '',
  dueDate: '',
})

const activeUsers = computed(() => users.value.filter(user => user.active))
const effectiveRole = computed(() => getEffectiveRole(session.value))
const canReassign = computed(() => session.value?.role === 'Admin')
const canTeamView = computed(() => ['Admin', 'Executive'].includes(session.value?.role ?? ''))
const currentUserId = computed(() => filters.userId || session.value?.id || '')

const scopedTasks = computed(() =>
  applyAssignmentScope(data.value.tasks, item => item.assignedToUserId),
)
const visibleTasks = computed(() =>
  scopedTasks.value
    .filter(task => task.status !== 'Complete')
    .filter(task => matchesCoreFilters(task))
    .filter(task => matchesPriority(task.priority))
    .filter(task => matchesDueDate(task.dueDate))
    .slice(0, 14),
)

const scopedDueOuts = computed(() =>
  applyAssignmentScope(data.value.dueOuts, item => item.ownerUserId),
)
const visibleDueOuts = computed(() =>
  scopedDueOuts.value
    .filter(dueOut => matchesCoreFilters(dueOut))
    .filter(dueOut => matchesStatus(dueOut.status))
    .filter(dueOut => matchesDueOutCategory(dueOut))
    .slice(0, 12),
)

const visibleVendorUpdates = computed(() =>
  data.value.vendorUpdates
    .filter(update => matchesSearch([update.vendor, update.poNumber, update.projectNumber, update.issueType]))
    .filter(update => matchesProject(update.projectNumber))
    .filter(update => matchesVendor(update.vendor))
    .filter(update => matchesStatus(update.status))
    .slice(0, 12),
)

const visibleRisks = computed(() =>
  data.value.risks
    .filter(risk => matchesSearch([risk.projectNumber, risk.customer, risk.manufacturer, risk.partNumber, risk.description, risk.riskReason]))
    .filter(risk => matchesProject(risk.projectNumber))
    .filter(risk => matchesCustomer(risk.customer))
    .filter(risk => matchesPriority(risk.severity))
    .slice(0, 18),
)

const filteredPipeline = computed(() =>
  data.value.pipeline.filter(row => !pipelineFilter.value || row.status === pipelineFilter.value),
)

const visibleShipments = computed(() =>
  data.value.shipments
    .filter(shipment => matchesSearch([shipment.carrier, shipment.trackingNumber, shipment.vendor, shipment.projectNumber, shipment.poNumber]))
    .filter(shipment => matchesProject(shipment.projectNumber))
    .filter(shipment => matchesVendor(shipment.vendor))
    .filter(shipment => !shipmentFilter.value || shipment.deliveryStatus === shipmentFilter.value)
    .slice(0, 14),
)

const visibleActivity = computed(() =>
  data.value.activity
    .filter(activity => matchesSearch([activity.user, activity.action, activity.projectNumber, activity.relatedRecordId, activity.notes]))
    .filter(activity => matchesProject(activity.projectNumber))
    .slice(0, 12),
)

const visibleAlerts = computed(() =>
  applyAssignmentScope(data.value.alerts, item => item.assignedToUserId)
    .filter(alert => alert.status !== 'Resolved')
    .filter(alert => matchesSearch([alert.title, alert.description, alert.projectNumber, alert.relatedRecordId]))
    .filter(alert => matchesProject(alert.projectNumber))
    .filter(alert => matchesPriority(alert.severity))
    .slice(0, 12),
)

const dueOutCategories = computed(() => [
  { key: 'today' as DueOutCategory, label: 'Due today', count: scopedDueOuts.value.filter(item => daysUntil(item.dueDate) === 0).length },
  { key: 'week' as DueOutCategory, label: 'Due this week', count: scopedDueOuts.value.filter(item => daysUntil(item.dueDate) >= 0 && daysUntil(item.dueDate) <= 7).length },
  { key: 'overdue' as DueOutCategory, label: 'Overdue', count: scopedDueOuts.value.filter(item => daysUntil(item.dueDate) < 0).length },
  { key: 'vendor' as DueOutCategory, label: 'Waiting on vendor', count: scopedDueOuts.value.filter(item => item.waitingOn === 'Vendor').length },
  { key: 'internal' as DueOutCategory, label: 'Waiting on internal approval', count: scopedDueOuts.value.filter(item => item.waitingOn === 'Internal Approval').length },
  { key: 'customer' as DueOutCategory, label: 'Waiting on customer', count: scopedDueOuts.value.filter(item => item.waitingOn === 'Customer').length },
])

const shipmentSummary = computed(() => {
  const statuses: ShipmentStatus[] = ['In transit', 'Delivering today', 'Delivered', 'Delayed', 'Exception', 'Tracking missing']
  return statuses.map(status => ({ status, count: data.value.shipments.filter(shipment => shipment.deliveryStatus === status).length }))
})

onMounted(() => {
  refresh()
  window.addEventListener('cronos:projects-changed', refresh)
  window.addEventListener('cronos:session-changed', refresh)
  window.addEventListener('cronos:procurement-dashboard-changed', refresh)
})

onUnmounted(() => {
  window.removeEventListener('cronos:projects-changed', refresh)
  window.removeEventListener('cronos:session-changed', refresh)
  window.removeEventListener('cronos:procurement-dashboard-changed', refresh)
})

function refresh() {
  session.value = import.meta.env.VITE_REQUIRE_AUTH === '1' ? fetchSession() : ensureDefaultAdminSession()
  users.value = loadUsers()
  data.value = loadProcurementDashboardData(users.value)
  if (!canTeamView.value) viewMode.value = 'my'
}

function applyAssignmentScope<T>(items: T[], getUserId: (item: T) => string) {
  if (viewMode.value === 'team' && canTeamView.value && !filters.userId) return items
  const userId = currentUserId.value
  return userId ? items.filter(item => getUserId(item) === userId) : items
}

function completeTask(taskId: string) {
  updateProcurementTask(taskId, { status: 'Complete' })
  refresh()
}

function reassignTask(taskId: string, userId: string) {
  if (!canReassign.value) return
  updateProcurementTask(taskId, { assignedToUserId: userId })
  refresh()
}

function changeTaskDueDate(taskId: string, dueDate: string) {
  updateProcurementTask(taskId, { dueDate })
  refresh()
}

function togglePipeline(status: string) {
  pipelineFilter.value = pipelineFilter.value === status ? '' : status
}

function matchesCoreFilters(item: ProcurementTask | ProcurementDueOut | ProcurementAlert) {
  const customer = 'customer' in item ? item.customer : ''
  return (
    matchesSearch([item.projectNumber, customer, 'title' in item ? item.title : '', 'description' in item ? item.description : '']) &&
    matchesProject(item.projectNumber) &&
    matchesCustomer(customer) &&
    matchesStatus(item.status)
  )
}

function matchesDueOutCategory(dueOut: ProcurementDueOut) {
  if (dueOutCategory.value === 'today') return daysUntil(dueOut.dueDate) === 0
  if (dueOutCategory.value === 'week') return daysUntil(dueOut.dueDate) >= 0 && daysUntil(dueOut.dueDate) <= 7
  if (dueOutCategory.value === 'overdue') return daysUntil(dueOut.dueDate) < 0
  if (dueOutCategory.value === 'vendor') return dueOut.waitingOn === 'Vendor'
  if (dueOutCategory.value === 'internal') return dueOut.waitingOn === 'Internal Approval'
  if (dueOutCategory.value === 'customer') return dueOut.waitingOn === 'Customer'
  return true
}

function matchesSearch(values: string[]) {
  const term = filters.search.trim().toLowerCase()
  return !term || values.join(' ').toLowerCase().includes(term)
}

function matchesProject(value: string) {
  return !filters.project.trim() || value.toLowerCase().includes(filters.project.trim().toLowerCase())
}

function matchesCustomer(value: string) {
  return !filters.customer.trim() || value.toLowerCase().includes(filters.customer.trim().toLowerCase())
}

function matchesVendor(value: string) {
  return !filters.vendor.trim() || value.toLowerCase().includes(filters.vendor.trim().toLowerCase())
}

function matchesStatus(value: ProcurementStatus) {
  return !filters.status || value === filters.status
}

function matchesPriority(value: ProcurementPriority | RiskSeverity) {
  return !filters.priority || value === filters.priority
}

function matchesDueDate(value: string) {
  if (!filters.dueDate) return true
  const days = daysUntil(value)
  if (filters.dueDate === 'today') return days === 0
  if (filters.dueDate === 'week') return days >= 0 && days <= 7
  if (filters.dueDate === 'overdue') return days < 0
  return true
}

function priorityTone(priority: ProcurementPriority | RiskSeverity): BadgeTone {
  return { Critical: 'critical', High: 'danger', Medium: 'warning', Low: 'muted' }[priority] as BadgeTone
}

function statusTone(status: ProcurementStatus): BadgeTone {
  return { Complete: 'success', Resolved: 'success', Waiting: 'warning', 'In Progress': 'default', Open: 'muted' }[status] as BadgeTone
}

function shipmentTone(status: ShipmentStatus): BadgeTone {
  return { Exception: 'critical', Delayed: 'danger', 'Tracking missing': 'warning', Delivered: 'success', 'Delivering today': 'default', 'In transit': 'muted' }[status] as BadgeTone
}

function formatShortDate(value: string) {
  if (!value) return 'Pending'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function agingDays(value: string) {
  return Math.max(0, -daysUntil(value))
}

function daysUntil(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 999
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

function inputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : ''
}

const DashboardPanel = defineComponent({
  props: {
    title: { type: String, required: true },
    meta: { type: String, default: '' },
  },
  setup(props, { slots }) {
    return () =>
      h('section', { class: 'procurement-panel' }, [
        h('div', { class: 'procurement-panel-header' }, [
          h('h2', props.title),
          props.meta ? h('span', props.meta) : null,
        ]),
        h('div', { class: 'procurement-panel-body' }, slots.default?.()),
      ])
  },
})

const EmptyState = defineComponent({
  props: {
    title: { type: String, required: true },
    detail: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'procurement-empty' }, [h('strong', props.title), h('p', props.detail)])
  },
})

const Badge = defineComponent({
  props: {
    label: { type: String, required: true },
    tone: { type: String, default: 'default' },
  },
  setup(props) {
    return () => h('span', { class: `procurement-badge badge-${props.tone}` }, props.label)
  },
})

void effectiveRole
</script>
