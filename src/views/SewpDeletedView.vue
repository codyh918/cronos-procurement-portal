<template>
  <main class="sewp-page">
    <div class="sewp-heading-row"><div><p class="sewp-kicker">SEWP RFQ PORTAL</p><h1>Deleted Opportunities</h1><p>Restore opportunities or permanently remove administrator test data.</p></div><SewpPortalNav /></div>
    <div class="sewp-alert warning"><TriangleAlert :size="18"/> Permanent deletion removes the RFQ, linked imported project, source hashes, BOM, documents, and private storage objects. Use it only for test data.</div>
    <section class="sewp-panel">
      <div v-if="error" class="sewp-alert error">{{ error }}</div>
      <div v-if="loading" class="sewp-empty">Loading deleted opportunities…</div>
      <div v-else-if="!records.length" class="sewp-empty"><Trash2 :size="28"/><strong>No deleted opportunities</strong></div>
      <div v-else class="table-scroll"><table class="sewp-table"><thead><tr><th>Opportunity</th><th>Official RFQ</th><th>Title</th><th>Agency</th><th>Deleted</th><th>Linked data</th><th>Actions</th></tr></thead><tbody><tr v-for="record in records" :key="record.id"><td>{{ record.atlas_opportunity_number }}</td><td>{{ record.official_rfq_number }}</td><td>{{ record.title }}</td><td>{{ record.agency || '—' }}</td><td>{{ date(record.deleted_at) }}</td><td>{{ record.import_id ? 'Import' : 'Manual' }}{{ record.atlas_project_id ? ' · Project' : '' }}</td><td><div class="row-actions"><button class="secondary-action" :disabled="working===record.id" @click="restore(record)"><RotateCcw :size="15"/>Restore</button><button class="danger-action" :disabled="working===record.id" @click="purge(record)"><Trash2 :size="15"/>Permanently Delete Test Data</button></div></td></tr></tbody></table></div>
    </section>
  </main>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RotateCcw, Trash2, TriangleAlert } from '@lucide/vue'
import SewpPortalNav from '../components/SewpPortalNav.vue'
import { listDeletedSewpRfqs, permanentlyDeleteSewpRfq, restoreSewpRfq, type DeletedSewpRfq } from '../services/sewpApi'
const records=ref<DeletedSewpRfq[]>([]),loading=ref(true),working=ref(''),error=ref('')
async function load(){loading.value=true;error.value='';try{records.value=(await listDeletedSewpRfqs()).records}catch(e){error.value=e instanceof Error?e.message:'Unable to load deleted opportunities.'}finally{loading.value=false}}
async function restore(record:DeletedSewpRfq){working.value=record.id;error.value='';try{await restoreSewpRfq(record.id);records.value=records.value.filter(item=>item.id!==record.id)}catch(e){error.value=e instanceof Error?e.message:'Unable to restore opportunity.'}finally{working.value=''}}
async function purge(record:DeletedSewpRfq){const required=`PURGE ${record.official_rfq_number}`;const confirmation=window.prompt(`Permanently delete ${record.atlas_opportunity_number} and all linked test data?\\n\\nThis cannot be undone. Type ${required} to confirm.`);if(confirmation?.trim()!==required){if(confirmation!==null)error.value='Confirmation did not match. Nothing was permanently deleted.';return}working.value=record.id;error.value='';try{const result=await permanentlyDeleteSewpRfq(record.id);records.value=records.value.filter(item=>item.id!==record.id);if(result.storageWarnings.length)error.value=result.storageWarnings.join(' ')}catch(e){error.value=e instanceof Error?e.message:'Unable to permanently delete test data.'}finally{working.value=''}}
onMounted(load)
const date=(value:string)=>new Date(value).toLocaleString()
</script>
<style scoped>
.row-actions{display:flex;gap:8px;flex-wrap:wrap}.row-actions button{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.danger-action{padding:8px 10px;border:1px solid #c83d3d;border-radius:7px;background:#fff;color:#a52222;font-weight:700;cursor:pointer}.danger-action:hover{background:#fff1f1}.danger-action:disabled{opacity:.55;cursor:not-allowed}
</style>
