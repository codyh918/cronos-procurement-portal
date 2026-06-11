<template>
  <div class="customers-page">
    <header class="page-heading">
      <div>
        <h1>Customers</h1>
        <p>Customer contacts, ship-to details, and active Cronos project references.</p>
      </div>
      <RouterLink class="primary-action" to="/projects/new">New Project</RouterLink>
    </header>

    <section class="summary-grid">
      <div class="summary-card">
        <p>Customers</p>
        <strong>{{ customers.length }}</strong>
      </div>
      <div class="summary-card">
        <p>Projects Linked</p>
        <strong>{{ projects.length }}</strong>
      </div>
      <div class="summary-card">
        <p>Ship-To Records</p>
        <strong>{{ shipToRecords }}</strong>
      </div>
    </section>

    <div class="data-table-frame">
      <div class="table-scroll">
        <table class="data-table customers-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Projects</th>
              <th>Latest Project</th>
              <th>Shipping Contact</th>
              <th>Ship-To / Instructions</th>
            </tr>
          </thead>
          <tbody v-if="customers.length">
            <tr v-for="customer in customers" :key="customer.customer">
              <td>{{ customer.customer }}</td>
              <td>{{ customer.contact || 'Not provided' }}</td>
              <td>{{ customer.email || 'Not provided' }}</td>
              <td>{{ customer.phone || 'Not provided' }}</td>
              <td>{{ customer.projectCount }}</td>
              <td>
                <RouterLink v-if="customer.latestProject" class="table-link" :to="`/projects/${customer.latestProject.id}`">
                  {{ customer.latestProject.projectNumber }}
                </RouterLink>
                <span v-else>None</span>
              </td>
              <td>{{ customer.shippingContact || 'Not provided' }}</td>
              <td class="ship-to-cell">
                <p>{{ customer.deliveryAddress || 'No delivery address on file' }}</p>
                <p v-if="customer.shippingInstructions" class="ship-instructions">{{ customer.shippingInstructions }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { loadProjects } from '../services/localProjects'
import type { Project } from '../types'

type CustomerRow = {
  customer: string
  projectCount: number
  latestProject?: Project
  contact: string
  email: string
  phone: string
  shippingContact: string
  deliveryAddress: string
  shippingInstructions: string
}

const projects = ref<Project[]>(loadProjects())

onMounted(() => window.addEventListener('cronos:projects-changed', refreshProjects))
onUnmounted(() => window.removeEventListener('cronos:projects-changed', refreshProjects))

const customers = computed(() => buildCustomerRows(projects.value))
const shipToRecords = computed(
  () => projects.value.filter(project => project.deliveryAddress || project.shippingContactName).length,
)

function refreshProjects() {
  projects.value = loadProjects()
}

function buildCustomerRows(sourceProjects: Project[]): CustomerRow[] {
  const grouped = sourceProjects.reduce<Map<string, Project[]>>((groups, project) => {
    const key = project.customer.trim() || 'Unnamed Customer'
    groups.set(key, [...(groups.get(key) ?? []), project])
    return groups
  }, new Map())

  return Array.from(grouped.entries())
    .map(([customer, customerProjects]) => {
      const latestProject = customerProjects[0]
      const contactProject = customerProjects.find(project => project.customerContactName || project.customerEmail || project.customerPhone) ?? latestProject
      const shippingProject =
        customerProjects.find(project => project.deliveryAddress || project.shippingContactName || project.shippingInstructions) ?? latestProject

      return {
        customer,
        projectCount: customerProjects.length,
        latestProject,
        contact: contactProject?.customerContactName ?? '',
        email: contactProject?.customerEmail ?? '',
        phone: contactProject?.customerPhone ?? '',
        shippingContact: shippingProject?.shippingContactName ?? '',
        deliveryAddress: shippingProject?.deliveryAddress ?? '',
        shippingInstructions: shippingProject?.shippingInstructions ?? '',
      }
    })
    .sort((a, b) => a.customer.localeCompare(b.customer))
}
</script>
