<template>
  <div class="shipping-page">
    <header class="receiving-heading">
      <h1>Shipping</h1>
      <p>Create shipments by project or kit, add carrier details, and mark shipped inventory.</p>
    </header>

    <DataTable :columns="columns" :rows="shipmentRows" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import DataTable from '../components/DataTable.vue'
import { loadProjects } from '../services/localProjects'
import type { Project } from '../types'

const projects = ref<Project[]>(loadProjects())
const columns = ['Shipment #', 'Project', 'Destination', 'Carrier', 'Tracking', 'Status']

onMounted(() => window.addEventListener('cronos:projects-changed', refreshProjects))
onUnmounted(() => window.removeEventListener('cronos:projects-changed', refreshProjects))

const shipmentRows = computed(() =>
  projects.value.map((project, index) => [
    `SHP-260${index + 1}`,
    project.projectNumber,
    project.deliveryAddress,
    index === 0 ? 'FedEx Freight' : 'TBD',
    index === 0 ? 'FDX-CRONOS-4412' : 'Pending',
    { type: 'badge' as const, status: project.shipmentStatus },
  ]),
)

function refreshProjects() {
  projects.value = loadProjects()
}
</script>
