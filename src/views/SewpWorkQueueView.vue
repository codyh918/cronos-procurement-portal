<template>
  <main class="sewp-page">
    <div class="sewp-heading-row"><div><p class="sewp-kicker">SEWP RFQ PORTAL</p><h1>Work Queue</h1><p>Search and prioritize every opportunity.</p></div><SewpPortalNav /></div>
    <section class="sewp-panel">
      <div class="sewp-toolbar"><label class="sewp-search"><Search :size="18" /><input v-model="search" placeholder="Search RFQ number, opportunity, or title" @keyup.enter="load" /></label><select v-model="stage"><option value="">All stages</option><option v-for="s in sewpStages" :key="s">{{ s }}</option></select><button class="secondary-action" @click="load">Search</button></div>
      <div v-if="error" class="sewp-alert error">{{ error }}</div><div v-if="loading" class="sewp-empty">Loading secure RFQ data...</div>
      <div v-else-if="!filtered.length" class="sewp-empty"><Inbox :size="28" /><strong>No matching RFQs</strong></div>
      <div v-else class="table-scroll"><table class="sewp-table"><thead><tr><th>Opportunity</th><th>Official RFQ</th><th>Title</th><th>Agency</th><th>Stage</th><th>Health</th><th>Due</th></tr></thead><tbody><tr v-for="r in filtered" :key="r.id"><td><RouterLink :to="`/sewp-rfqs/${r.id}`">{{ r.atlas_opportunity_number }}</RouterLink></td><td>{{ r.official_rfq_number }}</td><td>{{ r.title }}</td><td>{{ r.agency || '-' }}</td><td><span class="sewp-pill">{{ r.current_stage }}</span></td><td>{{ r.health_status }}</td><td>{{ date(r.response_due_at) }}</td></tr></tbody></table></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Inbox, Search } from '@lucide/vue'
import SewpPortalNav from '../components/SewpPortalNav.vue'
import { listSewpRfqs } from '../services/sewpApi'
import { sewpStages, type SewpRfq } from '../types/sewp'
const records = ref<SewpRfq[]>([]), search = ref(''), stage = ref(''), loading = ref(true), error = ref('')
const filtered = computed(() => records.value.filter(r => !stage.value || r.current_stage === stage.value))
async function load() { loading.value = true; error.value = ''; try { records.value = (await listSewpRfqs(search.value)).records } catch (e) { error.value = e instanceof Error ? e.message : 'Unable to load RFQs.' } finally { loading.value = false } }
onMounted(load)
const date = (v: string | null) => v ? new Date(v).toLocaleDateString() : 'Not set'
</script>
