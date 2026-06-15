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
      <FormField v-model="form.customer" label="Customer" placeholder="Enter customer name" required />

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
      <FormField v-model="form.customerContactName" label="Customer Contact" placeholder="Primary customer POC" />
      <FormField v-model="form.customerEmail" label="Customer Email" placeholder="customer@example.com" type="email" />
      <FormField v-model="form.customerPhone" label="Customer Phone" placeholder="(555) 555-5555" type="tel" />

      <div class="form-section">
        <h2>Shipping Information</h2>
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
import { deleteProject, loadProject, updateProjectFromInput } from '../services/localProjects'
import type { Project, ProjectFormInput, Status } from '../types'

const route = useRoute()
const router = useRouter()
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
  projectNumber: '',
  projectName: '',
  customer: '',
  customerContactName: '',
  customerEmail: '',
  customerPhone: '',
  shippingContactName: '',
  shippingEmail: '',
  shippingPhone: '',
  shippingInstructions: '',
  contractNumber: '',
  primeOrSub: 'Prime',
  projectManager: '',
  engineer: '',
  startDate: '',
  endDate: '',
  status: 'Quoted',
  deliveryAddress: '',
  notes: '',
})

const assignableUsers = computed(() => loadUsers().filter(user => user.active))

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
  form.projectNumber = loadedProject.projectNumber
  form.projectName = loadedProject.projectName
  form.customer = loadedProject.customer
  form.customerContactName = loadedProject.customerContactName
  form.customerEmail = loadedProject.customerEmail
  form.customerPhone = loadedProject.customerPhone
  form.shippingContactName = loadedProject.shippingContactName
  form.shippingEmail = loadedProject.shippingEmail
  form.shippingPhone = loadedProject.shippingPhone
  form.shippingInstructions = loadedProject.shippingInstructions
  form.contractNumber = loadedProject.contractNumber
  form.primeOrSub = loadedProject.primeOrSub
  form.projectManager = loadedProject.projectManager
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

  if (!input.projectNumber || !input.projectName || !input.customer) {
    window.alert('Project number, project name, and customer are required.')
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
    projectNumber: form.projectNumber.trim(),
    projectName: form.projectName.trim(),
    customer: form.customer.trim(),
    customerContactName: form.customerContactName.trim(),
    customerEmail: form.customerEmail.trim(),
    customerPhone: form.customerPhone.trim(),
    shippingContactName: form.shippingContactName.trim(),
    shippingEmail: form.shippingEmail.trim(),
    shippingPhone: form.shippingPhone.trim(),
    shippingInstructions: form.shippingInstructions.trim(),
    contractNumber: form.contractNumber.trim(),
    projectManager: form.projectManager.trim(),
    engineer: form.engineer.trim(),
    startDate: form.startDate.trim(),
    endDate: form.endDate.trim(),
    deliveryAddress: form.deliveryAddress.trim(),
    notes: form.notes.trim(),
  }
}
</script>
