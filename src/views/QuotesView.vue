<template>
  <div class="quotes-page">
    <header class="page-heading">
      <div>
        <h1>Quotes</h1>
        <p>Customer-facing quotes created from project records.</p>
      </div>
      <RouterLink class="primary-action" to="/projects">
        <Plus :size="17" />
        <span>Create from Project</span>
      </RouterLink>
    </header>

    <section class="summary-grid">
      <div class="summary-card">
        <p>Total Quotes</p>
        <strong>{{ totals.count }}</strong>
      </div>
      <div class="summary-card">
        <p>Total Sell Value</p>
        <strong>{{ currency(totals.totalSell) }}</strong>
      </div>
      <div class="summary-card">
        <p>Gross Profit</p>
        <strong>{{ currency(totals.totalGrossProfit) }}</strong>
      </div>
    </section>

    <section class="register-card">
      <div class="register-header">
        <div>
          <h2>Quote Register</h2>
          <p>Search by quote number, project, customer, or status.</p>
        </div>
        <input v-model="search" type="search" placeholder="Search quotes..." />
      </div>

      <div v-if="filteredQuotes.length" class="data-table-frame">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="column in columns" :key="column" :class="{ nowrap: isIdentifierColumn(column) }">
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="quote in filteredQuotes" :key="quote.id">
                <td class="nowrap">
                  <RouterLink class="table-link" :to="`/projects/${quote.projectId}/quotes/${quote.id}/edit`">
                    {{ quote.quoteNumber }}
                  </RouterLink>
                </td>
                <td class="nowrap">
                  <RouterLink class="table-link project-cell-link" :to="`/projects/${quote.projectId}`">
                    <strong>{{ quote.projectNumber }}</strong>
                    <span>{{ quote.projectName || '-' }}</span>
                  </RouterLink>
                </td>
                <td>{{ quote.customer || '-' }}</td>
                <td><StatusBadge :status="quote.status" /></td>
                <td>{{ quote.lines.length }}</td>
                <td>{{ quote.expirationDays ?? 30 }} days</td>
                <td>{{ currency(quoteTotals(quote).totalCost) }}</td>
                <td>{{ currency(quoteTotals(quote).totalSellPrice) }}</td>
                <td>{{ currency(quoteTotals(quote).contractFee) }}</td>
                <td>{{ currency(quoteTotals(quote).shippingCost) }}</td>
                <td>{{ currency(quoteTotals(quote).customerTotal) }}</td>
                <td class="nowrap">{{ formatDate(quote.createdAt) }}</td>
                <td>
                  <div class="row-actions">
                    <RouterLink class="mini-action link" :to="`/projects/${quote.projectId}/quotes/${quote.id}/edit`" title="Edit quote">
                      <Pencil :size="14" />
                      <span>Edit</span>
                    </RouterLink>
                    <button class="mini-action danger" type="button" title="Delete quote" @click="removeQuote(quote)">
                      <Trash2 :size="14" />
                      <span>Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else class="register-empty">
        <FileText :size="30" />
        <p>{{ quotes.length ? 'No quotes match that search.' : 'No quotes have been created yet.' }}</p>
        <RouterLink class="primary-action" to="/projects">Go to Projects</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { FileText, Pencil, Plus, Trash2 } from '@lucide/vue'
import StatusBadge from '../components/StatusBadge.vue'
import { calculateQuoteSummary, currency } from '../services/calculations'
import { formatDisplayDate } from '../services/dateFormat'
import { deleteQuoteForProject, loadProject, loadQuotes } from '../services/localProjects'
import type { CustomerQuote } from '../types'

const quotes = ref<CustomerQuote[]>(loadQuotes())
const search = ref('')

const columns = [
  'Quote #',
  'Project',
  'Customer',
  'Status',
  'Lines',
  'Expires',
  'Total Cost',
  'Line Total',
  'Contract Fee',
  'Shipping',
  'Quote Total',
  'Created',
  'Actions',
]

onMounted(() => window.addEventListener('cronos:projects-changed', refreshQuotes))
onUnmounted(() => window.removeEventListener('cronos:projects-changed', refreshQuotes))

const filteredQuotes = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return quotes.value

  return quotes.value.filter(quote =>
    [quote.quoteNumber, quote.projectNumber, quote.projectName, quote.customer, quote.status]
      .join(' ')
      .toLowerCase()
      .includes(term),
  )
})

const totals = computed(() =>
  quotes.value.reduce(
    (summary, quote) => {
      const quoteTotals = calculateQuoteSummary(
        quote.lines,
        quote.contractFeeEnabled,
        quote.shippingCost ?? 0,
      )
      return {
        count: summary.count + 1,
        totalSell: summary.totalSell + quoteTotals.customerTotal,
        totalGrossProfit: summary.totalGrossProfit + quoteTotals.totalGrossProfit,
      }
    },
    { count: 0, totalSell: 0, totalGrossProfit: 0 },
  ),
)

function refreshQuotes() {
  quotes.value = loadQuotes()
}

function removeQuote(quote: CustomerQuote) {
  const linkedPoCount = loadProject(quote.projectId)?.purchaseOrders.filter(po => po.quoteId === quote.id).length ?? 0
  const linkedPoWarning = linkedPoCount
    ? ` This will also delete ${linkedPoCount} linked purchase order${linkedPoCount === 1 ? '' : 's'}.`
    : ''
  if (!window.confirm(`Delete quote ${quote.quoteNumber}?${linkedPoWarning} This action cannot be undone.`)) return

  try {
    deleteQuoteForProject(quote.projectId, quote.id)
    refreshQuotes()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to delete the quote.')
  }
}

function quoteTotals(quote: CustomerQuote) {
  return calculateQuoteSummary(
    quote.lines,
    quote.contractFeeEnabled,
    quote.shippingCost ?? 0,
  )
}

function formatDate(value: string) {
  return formatDisplayDate(value)
}

function isIdentifierColumn(column: string) {
  return /(^|\s)(#|id|po|project|quote|date|eta|cost|value|total|actions)(\s|$)/i.test(column)
}
</script>
