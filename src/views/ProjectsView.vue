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

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Pencil, Plus } from '@lucide/vue'
import StatusBadge from '../components/StatusBadge.vue'
import { calculateQuoteSummary, currency } from '../services/calculations'
import { getCheckbookSummary } from '../services/checkbook'
import { loadUsers } from '../services/auth'
import { loadProjects } from '../services/localProjects'
import type { Project } from '../types'

const projects = ref<Project[]>(loadProjects())
const users = ref(loadUsers())

onMounted(() => {
  window.addEventListener('cronos:projects-changed', refreshProjects)
})
onUnmounted(() => {
  window.removeEventListener('cronos:projects-changed', refreshProjects)
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

function refreshProjects() {
  projects.value = loadProjects()
  users.value = loadUsers()
}

function assignedUserNames(project: Project) {
  const ids = new Set(project.assignedUserIds ?? [])
  return users.value.filter(user => ids.has(user.id)).map(user => user.name)
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

</script>
