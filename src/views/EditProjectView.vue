<template>
  <div v-if="project" class="form-page">
    <header class="page-heading">
      <div>
        <h1>Edit Project</h1>
        <p>Update project identity, customer details, dates, status, and shipping information.</p>
      </div>
      <RouterLink class="secondary-action" :to="`/projects/${project.id}`">Back to Project</RouterLink>
    </header>

    <form class="project-form" @submit.prevent="handleSubmit">
      <label class="form-field">
        <span>Project Type</span>
        <select v-model="form.projectType">
          <option value="Design & Install">Design &amp; Install</option>
          <option value="Resale">Resale</option>
          <option value="Checkbook">Checkbook</option>
        </select>
      </label>

      <FormField v-model="form.projectNumber" label="Project Number" placeholder="Enter project number" required />
      <FormField v-model="form.projectName" label="Project Name" placeholder="Enter project name" required />

      <template v-if="form.projectType !== 'Resale'">
        <FormField v-model="form.contractNumber" label="Contract Number" placeholder="Enter contract number" />
        <label class="form-field">
          <span>Prime or Sub</span>
          <select v-model="form.primeOrSub">
            <option value="Prime">Prime</option>
            <option value="Subcontractor">Subcontractor</option>
          </select>
        </label>
      </template>

      <label class="form-field">
        <span>Status</span>
        <select v-model="form.status">
          <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>

      <FormField
        v-if="form.projectType === 'Checkbook'"
        v-model.number="form.checkbookStartingBalance"
        label="Customer Starting Balance"
        placeholder="0.00"
        type="number"
        step="0.01"
        min="0"
        required
      />

      <FormField
        v-if="form.projectType === 'Design & Install'"
        v-model.number="form.materialBudget"
        label="Material Budget"
        placeholder="0.00"
        type="number"
        step="0.01"
        min="0"
      />

      <template v-if="form.projectType !== 'Resale'">
        <FormField v-model="form.projectManager" label="Project Manager" placeholder="Cody Hibbard" />
        <FormField v-model="form.governmentProjectLead" label="Government Project Lead" placeholder="Government lead name" />
        <FormField v-model="form.engineer" label="Engineer" placeholder="Engineer name" />
      </template>

      <fieldset class="form-field span-2 assignment-field">
        <legend>Assigned Users</legend>
        <div v-if="assignableUsers.length" class="assignment-grid">
          <label v-for="user in assignableUsers" :key="user.id" class="assignment-option">
            <input v-model="form.assignedUserIds" type="checkbox" :value="user.id" />
            <span>
              <strong>{{ user.name }}</strong>
              <small>{{ user.role }}{{ user.title ? ` - ${user.title}` : '' }}</small>
            </span>
          </label>
        </div>
        <p v-else>No active users are available yet.</p>
      </fieldset>

      <div class="form-section">
        <h2>Customer Information</h2>
      </div>
      <div class="customer-lookup-panel">
        <FormField v-model="form.customer" label="Company Name" placeholder="Search or enter customer company" required @focus="showCustomerSuggestions = true" />
        <div v-if="showCustomerSuggestions && customerSuggestions.length" class="customer-suggestion-list">
          <button v-for="suggestion in customerSuggestions" :key="suggestion.customer.id" class="customer-suggestion" type="button" @click="selectCustomer(suggestion)">
            <strong>{{ suggestion.label }}</strong>
            <small>{{ suggestion.detail || 'Active customer' }}</small>
          </button>
        </div>
      </div>
      <FormField v-model="form.customerContactName" label="Attention / Contact" placeholder="Primary customer POC" />
      <FormField v-model="form.customerAddress1" label="Street Address 1" placeholder="123 Main Street" required />
      <FormField v-model="form.customerAddress2" label="Street Address 2" placeholder="Suite, floor, building, or mail stop" />
      <FormField v-model="form.customerCity" label="City" placeholder="Lexington Park" required />
      <label class="form-field">
        <span>State</span>
        <select v-model="form.customerState" required>
          <option value="">Select state</option>
          <option v-for="state in states" :key="state" :value="state">{{ state }}</option>
        </select>
      </label>
      <FormField v-model="form.customerZip" label="ZIP Code" placeholder="20653" required />
      <FormField v-model="form.customerCountry" label="Country" placeholder="United States" />
      <FormField v-model="form.customerEmail" label="Email" placeholder="customer@example.com" type="email" />
      <FormField v-model="form.customerPhone" label="Phone" placeholder="(555) 555-5555" type="tel" />
      <FormField v-model="form.customerNumber" label="Customer Number" placeholder="Optional customer ID" />
      <FormField v-model="form.customerWebsite" label="Website" placeholder="https://example.com" />
      <div class="form-section">
        <h2>Shipping Information</h2>
        <p>Enter the address where this project's materials should be delivered.</p>
      </div>
      <div v-if="addressSuggestions.length" class="span-2 address-suggestion-list">
        <span class="address-suggestion-heading">Saved addresses — click one to use it as the shipping address</span>
        <button v-for="address in addressSuggestions" :key="address.id" class="address-suggestion" type="button" @click="selectShippingAddress(address)">
          <strong>{{ address.label || address.type }}</strong>
          <small>{{ [address.streetAddress1, `${address.city}, ${address.state} ${address.zipCode}`.trim()].filter(Boolean).join(' | ') }}</small>
          <small v-if="address.contactName">Contact: {{ address.contactName }}</small>
        </button>
      </div>
      <FormField v-model="form.shippingContactName" label="Shipping Contact" placeholder="Ship-to POC" />
      <FormField v-model="form.shippingEmail" label="Shipping Email" placeholder="shipping@example.com" type="email" />
      <FormField v-model="form.shippingPhone" label="Shipping Phone" placeholder="(555) 555-5555" type="tel" />
      <FormField v-model="form.startDate" label="Start Date" placeholder="2026-06-03" type="date" />
      <FormField v-model="form.endDate" label="End Date" placeholder="2026-09-30" type="date" />

      <label class="form-field span-2">
        <span>Delivery Address</span>
        <textarea v-model="form.deliveryAddress" placeholder="Customer delivery location" />
      </label>
      <label class="form-field span-2">
        <span>Shipping Instructions</span>
        <textarea
          v-model="form.shippingInstructions"
          placeholder="Delivery hours, dock instructions, attention line, access notes, or special handling"
        />
      </label>
      <label class="form-field span-2">
        <span>Notes</span>
        <textarea v-model="form.notes" placeholder="Project notes, constraints, or special handling instructions" />
      </label>

      <div class="span-2">
        <button class="primary-action" type="submit">
          <Save :size="17" />
          <span>Save Changes</span>
        </button>
      </div>
    </form>

    <section v-if="isAdmin" class="danger-zone project-delete-zone">
      <div>
        <h2>Delete Project</h2>
        <p>Remove this project, including its quotes, purchase orders, and project history for every user.</p>
      </div>
      <button class="danger-action" type="button" @click="deleteCurrentProject">
        <Trash2 :size="17" />
        <span>Delete Project</span>
      </button>
    </section>
  </div>

  <div v-else-if="loaded" class="not-found-page">
    <h1>Project not found</h1>
    <RouterLink class="text-link" to="/projects">Back to Projects</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Save, Trash2 } from '@lucide/vue'
import FormField from '../components/FormField.vue'
import { fetchSession, loadUsers } from '../services/auth'
import { applyCustomerAddressToProjectInput, rankAddressSuggestions, searchCustomerSuggestions, syncCustomersFromProjects } from '../services/customerRecords'
import { deleteProject, loadProject, loadProjects, updateProjectFromInput } from '../services/localProjects'
import type { CustomerAddressRecord, Project, ProjectFormInput, Status } from '../types'

const route = useRoute()
const router = useRouter()
syncCustomersFromProjects(loadProjects())
const project = ref<Project>()
const loaded = ref(false)
const isAdmin = ref(false)

const statuses: Status[] = [
  'Quoted',
  'Customer Approved',
  'PO Issued',
  'Ordered',
  'Shipped',
  'Delivered',
  'RMA',
  'Cancelled',
]

const form = reactive<ProjectFormInput>({
  projectType: 'Design & Install',
  checkbookStartingBalance: 0,
  materialBudget: 0,
  assignedUserIds: [],
  customerId: '',
  customerAddressId: '',
  projectNumber: '',
  projectName: '',
  customer: '',
  customerContactName: '',
  customerAddress1: '',
  customerAddress2: '',
  customerCity: '',
  customerState: '',
  customerZip: '',
  customerCountry: '',
  customerEmail: '',
  customerPhone: '',
  customerNumber: '',
  customerWebsite: '',
  shippingContactName: '',
  shippingEmail: '',
  shippingPhone: '',
  shippingInstructions: '',
  contractNumber: '',
  primeOrSub: 'Prime',
  projectManager: '',
  governmentProjectLead: '',
  engineer: '',
  startDate: '',
  endDate: '',
  status: 'Quoted',
  deliveryAddress: '',
  notes: '',
})

const assignableUsers = computed(() => loadUsers().filter(user => user.active))
const states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY', 'DC']
const showCustomerSuggestions = ref(false)
const customerSuggestions = computed(() => searchCustomerSuggestions(form.customer, 8))
const addressSuggestions = computed(() => (form.customerId ? rankAddressSuggestions(form.customerId, 6) : []))

onMounted(() => {
  refreshSession()
  window.addEventListener('cronos:session-changed', refreshSession)
  const loadedProject = loadProject(String(route.params.id))
  project.value = loadedProject
  if (loadedProject) populateForm(loadedProject)
  loaded.value = true
})

onUnmounted(() => {
  window.removeEventListener('cronos:session-changed', refreshSession)
})

function populateForm(loadedProject: Project) {
  form.projectType = loadedProject.projectType
  form.checkbookStartingBalance = Number(loadedProject.checkbookStartingBalance || 0)
  form.materialBudget = Number(loadedProject.materialBudget || 0)
  form.assignedUserIds = [...(loadedProject.assignedUserIds ?? [])]
  form.customerId = loadedProject.customerId ?? ''
  form.customerAddressId = loadedProject.customerAddressId ?? ''
  form.projectNumber = loadedProject.projectNumber
  form.projectName = loadedProject.projectName
  form.customer = loadedProject.customer
  form.customerContactName = loadedProject.customerContactName
  form.customerAddress1 = loadedProject.customerAddress1
  form.customerAddress2 = loadedProject.customerAddress2
  form.customerCity = loadedProject.customerCity
  form.customerState = loadedProject.customerState
  form.customerZip = loadedProject.customerZip
  form.customerCountry = loadedProject.customerCountry ?? ''
  form.customerEmail = loadedProject.customerEmail
  form.customerPhone = loadedProject.customerPhone
  form.customerNumber = loadedProject.customerNumber ?? ''
  form.customerWebsite = loadedProject.customerWebsite ?? ''
  form.shippingContactName = loadedProject.shippingContactName
  form.shippingEmail = loadedProject.shippingEmail
  form.shippingPhone = loadedProject.shippingPhone
  form.shippingInstructions = loadedProject.shippingInstructions
  form.contractNumber = loadedProject.contractNumber
  form.primeOrSub = loadedProject.primeOrSub
  form.projectManager = loadedProject.projectManager
  form.governmentProjectLead = loadedProject.governmentProjectLead ?? ''
  form.engineer = loadedProject.engineer
  form.startDate = loadedProject.startDate
  form.endDate = loadedProject.endDate
  form.status = loadedProject.status
  form.deliveryAddress = loadedProject.deliveryAddress
  form.notes = loadedProject.notes
}

function handleSubmit() {
  if (!project.value) return

  const input = normalizeForm()

  if (!input.projectNumber || !input.projectName || !input.customer || !input.customerAddress1 || !input.customerCity || !input.customerState || !input.customerZip) {
    window.alert('Project number, project name, company name, street address, city, state, and ZIP code are required.')
    return
  }

  if (input.projectType === 'Checkbook' && input.checkbookStartingBalance <= 0) {
    window.alert('Checkbook projects need a starting customer balance.')
    return
  }

  updateProjectFromInput(project.value.id, input)
  router.push(`/projects/${project.value.id}`)
}

function refreshSession() {
  isAdmin.value = fetchSession()?.role === 'Admin'
}

function deleteCurrentProject() {
  if (!project.value || !isAdmin.value) return

  const confirmed = window.confirm(
    `Delete project ${project.value.projectNumber}?\n\nThis removes the project, quotes, purchase orders, and project history for every user.`,
  )

  if (!confirmed) return

  deleteProject(project.value.id)
  router.push('/projects')
}

function normalizeForm(): ProjectFormInput {
  return {
    ...form,
    checkbookStartingBalance: Number(form.checkbookStartingBalance || 0),
    materialBudget: Number(form.materialBudget || 0),
    assignedUserIds: [...new Set(form.assignedUserIds)],
    customerId: form.customerId,
    customerAddressId: form.customerAddressId,
    projectNumber: form.projectNumber.trim(),
    projectName: form.projectName.trim(),
    customer: form.customer.trim(),
    customerContactName: form.customerContactName.trim(),
    customerAddress1: form.customerAddress1.trim(),
    customerAddress2: form.customerAddress2.trim(),
    customerCity: form.customerCity.trim(),
    customerState: form.customerState.trim(),
    customerZip: form.customerZip.trim(),
    customerCountry: form.customerCountry?.trim() ?? '',
    customerEmail: form.customerEmail.trim(),
    customerPhone: form.customerPhone.trim(),
    customerNumber: form.customerNumber?.trim() ?? '',
    customerWebsite: form.customerWebsite?.trim() ?? '',
    shippingContactName: form.shippingContactName.trim(),
    shippingEmail: form.shippingEmail.trim(),
    shippingPhone: form.shippingPhone.trim(),
    shippingInstructions: form.shippingInstructions.trim(),
    contractNumber: form.contractNumber.trim(),
    projectManager: form.projectManager.trim(),
    governmentProjectLead: form.governmentProjectLead.trim(),
    engineer: form.engineer.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    deliveryAddress: form.deliveryAddress.trim(),
    notes: form.notes.trim(),
  }
}

function selectCustomer(suggestion: ReturnType<typeof searchCustomerSuggestions>[number]) {
  Object.assign(form, applyCustomerAddressToProjectInput(form, suggestion.customer, suggestion.primaryAddress))
  showCustomerSuggestions.value = false
}

function selectShippingAddress(address: CustomerAddressRecord) {
  form.customerAddressId = address.id
  form.deliveryAddress = [
    address.streetAddress1,
    address.streetAddress2,
    [address.city, address.state, address.zipCode].filter(Boolean).join(' '),
    address.country,
  ].filter(Boolean).join('\n')
  form.shippingContactName = address.contactName
  form.shippingEmail = address.email
  form.shippingPhone = address.phone
}
</script>
