<template>
  <div class="customers-page">
    <header class="page-heading">
      <div>
        <h1>Customers</h1>
        <p>Reusable customer records, addresses, and project references.</p>
      </div>
      <RouterLink class="primary-action" to="/projects/new">New Project</RouterLink>
    </header>

    <section class="summary-grid">
      <div class="summary-card">
        <p>Active Customers</p>
        <strong>{{ activeCustomerCount }}</strong>
      </div>
      <div class="summary-card">
        <p>Addresses</p>
        <strong>{{ activeAddressCount }}</strong>
      </div>
      <div class="summary-card">
        <p>Projects Linked</p>
        <strong>{{ projects.length }}</strong>
      </div>
    </section>

    <label class="form-field customers-search">
      <span>Search Customers</span>
      <input v-model="query" placeholder="Company, contact, email, city, state, or customer number" />
    </label>

    <div class="data-table-frame">
      <div class="table-scroll">
        <table class="data-table customers-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Primary Address</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Addresses</th>
              <th>Projects</th>
              <th>Latest Project</th>
            </tr>
          </thead>
          <tbody v-if="rows.length">
            <tr v-for="row in rows" :key="row.customer.id">
              <td>
                <strong>{{ row.customer.displayName || row.customer.legalCompanyName }}</strong>
                <small v-if="row.customer.customerNumber">{{ row.customer.customerNumber }}</small>
              </td>
              <td>
                <CustomerAddress v-if="row.projectLikeAddress" :project="row.projectLikeAddress" />
                <span v-else>No address on file</span>
              </td>
              <td>{{ row.customer.primaryContact || 'Not provided' }}</td>
              <td>{{ row.customer.primaryEmail || 'Not provided' }}</td>
              <td>{{ row.customer.primaryPhone || 'Not provided' }}</td>
              <td>{{ row.addressCount }}</td>
              <td>{{ row.projectCount }}</td>
              <td>
                <RouterLink v-if="row.latestProject" class="table-link" :to="`/projects/${row.latestProject.id}`">
                  {{ row.latestProject.projectNumber }}
                </RouterLink>
                <span v-else>None</span>
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
import CustomerAddress from '../components/CustomerAddress.vue'
import { loadCustomerAddresses, loadCustomers, syncCustomersFromProjects } from '../services/customerRecords'
import { loadProjects } from '../services/localProjects'
import type { CustomerAddressRecord, CustomerRecord, Project } from '../types'

type CustomerRow = {
  customer: CustomerRecord
  primaryAddress?: CustomerAddressRecord
  projectLikeAddress?: Project
  addressCount: number
  projectCount: number
  latestProject?: Project
}

const projects = ref<Project[]>(loadProjects())
syncCustomersFromProjects(projects.value)
const customers = ref<CustomerRecord[]>(loadCustomers())
const addresses = ref<CustomerAddressRecord[]>(loadCustomerAddresses())
const query = ref('')

onMounted(() => {
  window.addEventListener('cronos:projects-changed', refresh)
  window.addEventListener('cronos:customers-changed', refresh)
})
onUnmounted(() => {
  window.removeEventListener('cronos:projects-changed', refresh)
  window.removeEventListener('cronos:customers-changed', refresh)
})

const activeCustomerCount = computed(() => customers.value.filter(customer => customer.active).length)
const activeAddressCount = computed(() => addresses.value.filter(address => address.active).length)
const rows = computed(() => buildRows())

function refresh() {
  projects.value = loadProjects()
  syncCustomersFromProjects(projects.value)
  customers.value = loadCustomers()
  addresses.value = loadCustomerAddresses()
}

function buildRows(): CustomerRow[] {
  const search = query.value.trim().toLowerCase()
  return customers.value
    .filter(customer => customer.active)
    .map(customer => {
      const customerAddresses = addresses.value.filter(address => address.customerId === customer.id && address.active)
      const primaryAddress = customerAddresses.find(address => address.isPrimary) ?? customerAddresses[0]
      const linkedProjects = projects.value.filter(project => project.customerId === customer.id || project.customer === customer.displayName || project.customer === customer.legalCompanyName)
      return {
        customer,
        primaryAddress,
        projectLikeAddress: primaryAddress ? addressAsProject(customer, primaryAddress) : undefined,
        addressCount: customerAddresses.length,
        projectCount: linkedProjects.length,
        latestProject: linkedProjects[0],
      }
    })
    .filter(row => {
      if (!search) return true
      return [row.customer.legalCompanyName, row.customer.displayName, row.customer.customerNumber, row.customer.primaryContact, row.customer.primaryEmail, row.primaryAddress?.city, row.primaryAddress?.state]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })
    .sort((a, b) => a.customer.displayName.localeCompare(b.customer.displayName))
}

function addressAsProject(customer: CustomerRecord, address: CustomerAddressRecord): Project {
  return {
    ...(projects.value[0] ?? {}),
    id: '',
    projectType: 'Resale',
    checkbookStartingBalance: 0,
    materialBudget: 0,
    assignedUserIds: [],
    customerId: customer.id,
    customerAddressId: address.id,
    projectNumber: '',
    projectName: '',
    customer: customer.displayName || customer.legalCompanyName,
    customerContactName: address.contactName || customer.primaryContact,
    customerAddress1: address.streetAddress1,
    customerAddress2: address.streetAddress2,
    customerCity: address.city,
    customerState: address.state,
    customerZip: address.zipCode,
    customerCountry: address.country,
    customerEmail: address.email || customer.primaryEmail,
    customerPhone: address.phone || customer.primaryPhone,
    customerNumber: customer.customerNumber,
    customerWebsite: customer.website,
  } as Project
}
</script>
