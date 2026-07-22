<template>
  <main class="sewp-page">
    <div class="sewp-heading-row">
      <div><p class="sewp-kicker">ATLAS OPERATIONS</p><h1>SEWP RFQ Portal</h1><p>Track intake, pricing, reviews, and submissions.</p></div>
      <SewpPortalNav />
    </div>
    <div class="sewp-cui-warning"><ShieldAlert :size="18" /> Do not upload CUI until this environment is formally approved.</div>
    <div v-if="error" class="sewp-alert error">{{ error }}</div>
    <section class="sewp-metric-grid">
      <article><span>Active RFQs</span><strong>{{ active }}</strong><small>Open opportunities</small></article>
      <article><span>Due in 7 Days</span><strong>{{ dueSoon }}</strong><small>Requires attention</small></article>
      <article><span>At Risk</span><strong>{{ atRisk }}</strong><small>Critical or overdue</small></article>
      <article><span>Submitted</span><strong>{{ submitted }}</strong><small>Awaiting outcome</small></article>
    </section>
    <section class="sewp-panel">
      <div class="sewp-panel-heading"><div><h2>Priority work</h2><p>RFQs ordered by deadline.</p></div><RouterLink to="/sewp-rfqs/work-queue">Open work queue</RouterLink></div>
      <div v-if="loading" class="sewp-empty">Loading secure RFQ data...</div>
      <div v-else-if="!records.length" class="sewp-empty"><FileSearch :size="28" /><strong>No RFQs yet</strong><RouterLink class="primary-action" to="/sewp-rfqs/new">Create RFQ</RouterLink></div>
      <div v-else class="table-scroll"><table class="sewp-table"><thead><tr><th>Opportunity</th><th>RFQ</th><th>Agency</th><th>Stage</th><th>Due</th></tr></thead><tbody><tr v-for="r in records.slice(0, 8)" :key="r.id"><td><RouterLink :to="`/sewp-rfqs/${r.id}`">{{ r.atlas_opportunity_number }}</RouterLink></td><td>{{ r.official_rfq_number }}</td><td>{{ r.agency || '-' }}</td><td><span class="sewp-pill">{{ r.current_stage }}</span></td><td>{{ date(r.response_due_at) }}</td></tr></tbody></table></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileSearch, ShieldAlert } from '@lucide/vue'
import SewpPortalNav from '../components/SewpPortalNav.vue'
import { listSewpRfqs } from '../services/sewpApi'
import type { SewpRfq } from '../types/sewp'
const records = ref<SewpRfq[]>([]), loading = ref(true), error = ref('')
const active = computed(() => records.value.filter(r => !['Awarded','Lost','No-Bid','Cancelled'].includes(r.current_stage)).length)
const submitted = computed(() => records.value.filter(r => r.current_stage === 'Submitted').length)
const atRisk = computed(() => records.value.filter(r => ['At Risk','Critical','Blocked','Overdue'].includes(r.health_status)).length)
const dueSoon = computed(() => records.value.filter(r => r.response_due_at && +new Date(r.response_due_at) <= Date.now() + 604800000).length)
onMounted(async () => { try { records.value = (await listSewpRfqs()).records } catch (e) { error.value = e instanceof Error ? e.message : 'Unable to load RFQs.' } finally { loading.value = false } })
const date = (v: string | null) => v ? new Date(v).toLocaleDateString() : 'Not set'
</script>
