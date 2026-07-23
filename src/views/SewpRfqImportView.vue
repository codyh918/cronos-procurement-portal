<template>
  <main class="sewp-page">
    <div class="sewp-heading-row"><div><p class="sewp-kicker">SEWP RFQ PORTAL</p><h1>Import SEWP RFQ</h1><p>Deterministic, server-side Outlook import with mandatory human review.</p></div><SewpPortalNav /></div>
    <div class="sewp-cui-warning"><ShieldAlert :size="18"/> Files are processed inside Atlas and retained in the configured private document store. No AI or external document service is used.</div>
    <div v-if="error" class="sewp-alert error">{{ error }}</div>
    <section v-if="!draft" class="sewp-panel">
      <div class="rfq-drop" :class="{ active: dragging }" @dragover.prevent="dragging=true" @dragleave="dragging=false" @drop.prevent="drop">
        <Upload :size="34"/><h2>Drop an Outlook .msg email</h2><p>Maximum 25 MB. The file signature is validated on the server.</p>
        <label class="primary-action">Choose .msg file<input hidden type="file" accept=".msg,application/vnd.ms-outlook" @change="choose"/></label>
      </div>
      <p v-if="busy" class="sewp-empty">Parsing email, extracting attachments, detecting the equipment table, and calculating hashes…</p>
    </section>
    <template v-else>
      <section class="sewp-stage-card"><div><span>Import status</span><strong>{{ draft.status }}</strong><small>{{ draft.original_filename }}</small></div><div><strong>{{ lines.length }} lines</strong><small>Total quantity {{ totalQuantity.toLocaleString() }}</small></div></section>
      <section class="sewp-detail-grid">
        <article class="sewp-panel"><h2>RFQ summary</h2><label v-for="field in summaryFields" :key="field.key" class="rfq-field"><span>{{ field.label }}</span><input v-model="fields[field.key]" :class="{ missing: !fields[field.key] }"/></label></article>
        <article class="sewp-panel"><h2>Customer and deadline</h2><label v-for="field in customerFields" :key="field.key" class="rfq-field"><span>{{ field.label }}</span><textarea v-if="field.long" v-model="fields[field.key]" rows="3" :class="{ missing: !fields[field.key] }"/><input v-else v-model="fields[field.key]" :class="{ missing: !fields[field.key] }"/></label></article>
        <article class="sewp-panel"><h2>Compliance and delivery</h2><label v-for="field in booleanFields" :key="field.key" class="rfq-field"><span>{{ field.label }}</span><select v-model="fields[field.key]"><option :value="null">Needs review</option><option :value="true">Yes</option><option :value="false">No</option></select></label><label class="rfq-field"><span>Delivery requirement</span><input v-model="fields.delivery_requirement"/></label></article>
        <article class="sewp-panel"><h2>Amendment</h2><label class="rfq-field"><span>Modification level</span><input v-model="fields.modification_level"/></label><label class="rfq-field"><span>Modification date</span><input v-model="fields.modification_date"/></label><label class="rfq-field"><span>Remarks</span><textarea v-model="fields.modification_remarks" rows="5"/></label><p v-for="item in draft.extraction_data.validations" :key="item.message" :class="['sewp-alert', item.status==='error'?'error':'success']">{{ item.message }}</p></article>
      </section>
      <section class="sewp-panel"><div class="sewp-panel-heading"><div><h2>Validation warnings</h2><p>Missing or incomplete source values are never invented.</p></div><strong>{{ draft.extraction_data.warnings.length }}</strong></div><ul class="rfq-warning-list"><li v-for="warning in draft.extraction_data.warnings" :key="warning.message">{{ warning.message }}</li></ul></section>
      <section class="sewp-panel"><div class="sewp-panel-heading"><div><h2>Equipment lines</h2><p>Original order, identifiers, worksheet, row, and source cells are preserved.</p></div></div><div class="table-scroll rfq-line-scroll"><table class="sewp-table"><thead><tr><th>#</th><th>CLIN</th><th>Brand/equal</th><th>Manufacturer</th><th>Part number</th><th>Description</th><th>Qty</th><th>UOI</th><th>Source</th></tr></thead><tbody><tr v-for="line in lines" :key="line.originalOrder"><td>{{line.originalOrder}}</td><td><input v-model="line.clin"/></td><td><input v-model="line.brandNameOrEqual"/></td><td><input v-model="line.manufacturer" :class="{missing:!line.manufacturer}"/></td><td><input v-model="line.manufacturerPartNumber"/></td><td><input v-model="line.description"/></td><td><input v-model.number="line.quantity" type="number" min="0"/></td><td><input v-model="line.unitOfIssue"/></td><td>{{line.worksheetName}} row {{line.originalExcelRow}}</td></tr></tbody></table></div></section>
      <section class="sewp-panel"><h2>Attachments and source evidence</h2><ul><li v-for="attachment in draft.extraction_data.attachments" :key="attachment.sha256">{{attachment.filename}} — {{Math.ceil(attachment.size/1024).toLocaleString()}} KB — SHA-256 {{attachment.sha256.slice(0,12)}}…</li></ul></section>
      <div class="rfq-review-actions"><button class="secondary-action" :disabled="busy" @click="reset">Cancel Import</button><button class="secondary-action" :disabled="busy" @click="save(false)">Save Draft Import</button><button class="primary-action" :disabled="busy || !fields.request_id || !lines.length" @click="approve">{{busy?'Working…':'Create SEWP RFQ and Project'}}</button></div>
    </template>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldAlert, Upload } from '@lucide/vue'
import SewpPortalNav from '../components/SewpPortalNav.vue'
import { approveSewpRfqImport, updateSewpRfqImport, uploadSewpRfqEmail, type SewpRfqImport } from '../services/sewpApi'
const router=useRouter(),draft=ref<SewpRfqImport|null>(null),busy=ref(false),error=ref(''),dragging=ref(false)
const fields=computed<Record<string, any>>(() => draft.value!.extraction_data.fields),lines=computed(() => draft.value?.extraction_data.lines||[])
const totalQuantity=computed(()=>lines.value.reduce((sum,line)=>sum+Number(line.quantity||0),0))
const summaryFields=[{key:'request_id',label:'SEWP request ID'},{key:'subject',label:'Opportunity title'},{key:'agency',label:'Agency'},{key:'agency_id',label:'Agency ID'},{key:'request_date',label:'Request date'},{key:'reply_by_source_text',label:'Reply deadline source'}]
const customerFields=[{key:'government_poc_first_name',label:'POC first name'},{key:'government_poc_last_name',label:'POC last name'},{key:'government_poc_email',label:'POC email'},{key:'government_poc_phone',label:'POC phone'},{key:'customer_address',label:'Customer address',long:true},{key:'ship_to_organization',label:'Ship-to organization'},{key:'ship_to_address',label:'Ship-to address',long:true}]
const booleanFields=[{key:'taa_required',label:'TAA required'},{key:'authorized_reseller_required',label:'Authorized reseller required'},{key:'partial_quotes_allowed',label:'Partial quotes allowed'},{key:'partial_delivery_allowed',label:'Partial delivery allowed'},{key:'used_or_refurbished_allowed',label:'Used/refurbished allowed'},{key:'allow_questions',label:'Questions allowed'}]
async function process(file?:File){if(!file)return;busy.value=true;error.value='';try{draft.value=(await uploadSewpRfqEmail(file)).import}catch(e){error.value=e instanceof Error?e.message:'Import failed.'}finally{busy.value=false}}
function choose(event:Event){void process((event.target as HTMLInputElement).files?.[0])}
function drop(event:DragEvent){dragging.value=false;void process(event.dataTransfer?.files?.[0])}
async function save(ready:boolean){if(!draft.value)return;busy.value=true;try{draft.value=(await updateSewpRfqImport(draft.value.id,draft.value.extraction_data,ready)).import}catch(e){error.value=e instanceof Error?e.message:'Save failed.'}finally{busy.value=false}}
async function approve(){if(!draft.value)return;busy.value=true;error.value='';try{await save(true);const result=await approveSewpRfqImport(draft.value.id,crypto.randomUUID());await router.push(`/sewp-rfqs/${result.result.rfqId}`)}catch(e){error.value=e instanceof Error?e.message:'Project creation failed.'}finally{busy.value=false}}
function reset(){draft.value=null;error.value=''}
</script>
<style scoped>
.sewp-heading-actions,.rfq-review-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.rfq-drop{padding:64px 24px;text-align:center;border:2px dashed #9aa9ba;border-radius:12px}.rfq-drop.active{background:#edf6ff;border-color:#1565c0}.rfq-drop input{display:none}.rfq-field{display:grid;gap:5px;margin:10px 0}.rfq-field span{font-size:.78rem;font-weight:700;color:#536273}.missing{border-color:#bd6b00!important;background:#fff9ed!important}.rfq-warning-list{max-height:220px;overflow:auto}.rfq-line-scroll{max-height:540px}.rfq-line-scroll input{min-width:100px;width:100%;box-sizing:border-box}.rfq-line-scroll td:nth-child(6) input{min-width:260px}.rfq-review-actions{position:sticky;bottom:12px;justify-content:flex-end;padding:14px;background:#fff;border:1px solid #dce2e8;border-radius:10px;box-shadow:0 6px 20px #001b351f}
</style>
