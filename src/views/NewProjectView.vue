<template>
  <div class="form-page">
    <header class="page-heading">
      <div>
        <h1>New Project</h1>
        <p>Create the project record before sales quoting and procurement begin.</p>
      </div>
      <RouterLink class="secondary-action" to="/projects">Back to Projects</RouterLink>
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
          <span>Save Project</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Save } from '@lucide/vue'
import FormField from '../components/FormField.vue'
import { loadUsers } from '../services/auth'
import { saveProject } from '../services/localProjects'
import type { ProjectFormInput, Status } from '../types'

const router = useRouter()

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

function handleSubmit() {
  const input = normalizeForm()

  if (!input.projectNumber || !input.projectName || !input.customer) {
    window.alert('Project number, project name, and customer are required.')
    return
  }

  if (input.projectType === 'Checkbook' && input.checkbookStartingBalance <= 0) {
    window.alert('Checkbook projects need a starting customer balance.')
    return
  }

  saveProject(input)
  router.push('/projects')
}

function normalizeForm(): ProjectFormInput {
  return {
    ...form,
    checkbookStartingBalance: Number(form.checkbookStartingBalance || 0),
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
