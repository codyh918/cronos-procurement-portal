<template>
  <div class="kitting-page">
    <header class="receiving-heading">
      <h1>Kitting</h1>
      <p>Create kit requests by project, allocate received inventory, and see missing material before staging.</p>
    </header>

    <DataTable :columns="columns" :rows="kitRows" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import DataTable from '../components/DataTable.vue'
import { loadProjects } from '../services/localProjects'
import type { InventoryItem, Project } from '../types'

const projects = ref<Project[]>(loadProjects())
const columns = ['Kit #', 'Project', 'Name', 'Status', 'Readiness']

onMounted(() => window.addEventListener('cronos:projects-changed', refreshProjects))
onUnmounted(() => window.removeEventListener('cronos:projects-changed', refreshProjects))

const kitRows = computed(() =>
  projects.value.map(project => [
    `KIT-${project.projectNumber}`,
    project.projectNumber,
    project.projectName,
    { type: 'badge' as const, status: project.kitStatus },
    project.inventory.length ? `${allocatedInventory(project)} items allocated` : 'Missing received material',
  ]),
)

function allocatedInventory(project: Project) {
  return (project.inventory as InventoryItem[]).reduce(
    (sum, item) => sum + Number(item.quantityReceived ?? 0),
    0,
  )
}

function refreshProjects() {
  projects.value = loadProjects()
}
</script>
