<template>
  <main class="sewp-page">
    <div class="sewp-heading-row"><div><RouterLink class="sewp-back" to="/sewp-rfqs/work-queue">Back to work queue</RouterLink><h1>{{ rfq?.atlas_opportunity_number || 'RFQ Workspace' }}</h1><p>{{ rfq ? `${rfq.official_rfq_number} - ${rfq.title}` : 'Loading opportunity...' }}</p></div><SewpPortalNav /></div>
    <div v-if="error" class="sewp-alert error">{{ error }}</div><div v-else-if="!rfq" class="sewp-panel sewp-empty">Loading secure RFQ workspace...</div>
    <template v-else>
      <section class="sewp-stage-card"><div><span>Current stage</span><strong>{{ rfq.current_stage }}</strong><small>Record version {{ rfq.version }}</small></div><div class="sewp-transition"><select v-model="target"><option v-for="s in sewpStages" :key="s">{{ s }}</option></select><input v-model.trim="note" placeholder="Transition note" /><button class="primary-action" :disabled="busy || target === rfq.current_stage" @click="changeStage">{{ busy ? 'Updating...' : 'Update Stage' }}</button></div></section>
      <nav class="sewp-workspace-tabs"><button v-for="t in tabs" :key="t" :class="{ active: tab === t }" @click="tab = t">{{ t }}</button></nav>
      <section v-if="tab === 'Overview'" class="sewp-detail-grid"><article class="sewp-panel"><h2>Opportunity details</h2><dl><div><dt>Official RFQ</dt><dd>{{ rfq.official_rfq_number }}</dd></div><div><dt>Agency</dt><dd>{{ rfq.agency || 'Not set' }}</dd></div><div><dt>Customer</dt><dd>{{ rfq.customer_organization || 'Not set' }}</dd></div><div><dt>Source</dt><dd>{{ rfq.source }}</dd></div><div><dt>Priority</dt><dd>{{ rfq.priority }}</dd></div><div><dt>Health</dt><dd>{{ rfq.health_status }}</dd></div></dl></article><article class="sewp-panel"><h2>Schedule and value</h2><dl><div><dt>Received</dt><dd>{{ date(rfq.date_received) }}</dd></div><div><dt>Questions due</dt><dd>{{ date(rfq.questions_due_at) }}</dd></div><div><dt>Response due</dt><dd>{{ date(rfq.response_due_at) }}</dd></div><div><dt>Estimated value</dt><dd>{{ money(rfq.estimated_value) }}</dd></div></dl></article><article class="sewp-panel wide"><h2>Internal notes</h2><p>{{ rfq.notes || 'No internal notes have been added.' }}</p></article></section>
      <section v-else class="sewp-panel sewp-empty"><FolderKanban :size="30" /><strong>{{ tab }}</strong><span>Ready for the next implementation increment.</span></section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FolderKanban } from '@lucide/vue'
import SewpPortalNav from '../components/SewpPortalNav.vue'
import { getSewpRfq, transitionSewpRfq } from '../services/sewpApi'
import { sewpStages, type SewpRfq, type SewpStage } from '../types/sewp'
const route = useRoute(), rfq = ref<SewpRfq | null>(null), error = ref(''), busy = ref(false), note = ref(''), target = ref<SewpStage>('New'), tab = ref('Overview')
const tabs = ['Overview', 'Documents', 'BOM', 'Requirements', 'Tasks', 'Audit']
onMounted(async () => { try { rfq.value = (await getSewpRfq(String(route.params.rfqId))).record; target.value = rfq.value.current_stage } catch (e) { error.value = e instanceof Error ? e.message : 'Unable to load RFQ.' } })
async function changeStage() { if (!rfq.value) return; busy.value = true; try { rfq.value = (await transitionSewpRfq(rfq.value.id, target.value, rfq.value.version, note.value)).record; note.value = '' } catch (e) { error.value = e instanceof Error ? e.message : 'Unable to update stage.' } finally { busy.value = false } }
const date = (v: string | null) => v ? new Date(v).toLocaleString() : 'Not set'
const money = (v: number | null) => v == null ? 'Not set' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
</script>
