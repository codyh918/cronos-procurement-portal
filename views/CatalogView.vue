<template>
  <div class="catalog-page">
    <header class="catalog-heading">
      <div>
        <h1>Part &amp; Price Catalog</h1>
        <p>Historic part pricing from workbook imports and generated purchase orders.</p>
      </div>
      <label class="catalog-search">
        <input v-model="search" placeholder="Search part number, description, vendor, PO..." />
        <Search :size="20" />
      </label>
    </header>

    <section class="catalog-metric-grid">
      <DashboardMetric href="/catalog" :icon="Database" label="Unique Parts" :value="latestParts.length" action="Latest pricing" />
      <DashboardMetric href="/catalog" :icon="History" label="Price Records" :value="records.length" action="Full history" />
      <DashboardMetric href="/catalog" :icon="ShoppingCart" label="PO Records" :value="poHistoryCount" tone="success" action="Auto captured" />
      <DashboardMetric href="/catalog" :icon="DollarSign" label="Avg. Catalog Cost" :value="currency(avgPrice)" tone="warning" action="Latest records" />
    </section>

    <section class="register-card">
      <div class="register-header">
        <div>
          <h2>Latest Catalog Pricing</h2>
          <p>Quote forms use this table to auto-fill matched part numbers.</p>
        </div>
        <button class="secondary-action" type="button" @click="rebuildFromPurchaseOrders">Sync PO History</button>
      </div>

      <DataTable v-if="filteredRecords.length" :columns="columns" :rows="catalogRows" />

      <section v-else class="large-empty-card compact-empty">
        <h2>No catalog records found</h2>
        <p>Generated purchase orders and imported workbook pricing will appear here.</p>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Database, DollarSign, History, Search, ShoppingCart } from '@lucide/vue'
import DashboardMetric from '../components/DashboardMetric.vue'
import DataTable from '../components/DataTable.vue'
import { currency } from '../services/calculations'
import { formatDisplayDate } from '../services/dateFormat'
import { loadProjects } from '../services/localProjects'
import {
  getPartCatalogSummary,
  loadPartCatalog,
  rebuildPartCatalogFromProjects,
  type PartPriceRecord,
} from '../services/partCatalog'

const records = ref<PartPriceRecord[]>(loadPartCatalog())
const search = ref('')

const columns = ['Part #', 'Description', 'Manufacturer', 'Vendor', 'Unit Cost', 'Source', 'Project', 'Date']

const latestParts = computed(() => getPartCatalogSummary(records.value))
const filteredRecords = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return latestParts.value

  return latestParts.value.filter(record =>
    [
      record.partNumber,
      record.manufacturer,
      record.description,
      record.vendor,
      record.poNumber,
      record.projectNumber,
      record.projectName,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term),
  )
})
const poHistoryCount = computed(() => records.value.filter(record => record.projectId !== 'catalog-seed').length)
const avgPrice = computed(() =>
  latestParts.value.length
    ? latestParts.value.reduce((total, record) => total + record.unitCost, 0) / latestParts.value.length
    : 0,
)

const catalogRows = computed(() =>
  filteredRecords.value.map(record => [
    {
      type: 'link' as const,
      label: record.partNumber,
      to: '/catalog',
      className: 'table-link',
    },
    record.description,
    record.manufacturer || 'Not assigned',
    record.vendor || 'Not assigned',
    currency(record.unitCost),
    record.poNumber,
    record.projectId !== 'catalog-seed'
      ? {
          type: 'link' as const,
          label: record.projectNumber,
          to: `/projects/${record.projectId}`,
          className: 'table-link',
        }
      : record.projectName,
    formatDate(record.dateIssued || record.recordedAt),
  ]),
)

function rebuildFromPurchaseOrders() {
  records.value = rebuildPartCatalogFromProjects(loadProjects())
}

function formatDate(value: string) {
  return formatDisplayDate(value)
}
</script>
