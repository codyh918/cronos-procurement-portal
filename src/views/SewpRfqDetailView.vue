<template>
  <main class="sewp-page">
    <div class="sewp-heading-row"><div><RouterLink class="sewp-back" to="/sewp-rfqs/work-queue">Back to work queue</RouterLink><h1>{{ rfq?.atlas_opportunity_number || 'RFQ Workspace' }}</h1><p>{{ rfq ? `${rfq.official_rfq_number} - ${rfq.title}` : 'Loading opportunity...' }}</p></div><div class="heading-tools"><button v-if="rfq" class="danger-action" :disabled="deleting" @click="deleteOpportunity"><Trash2 :size="16"/>{{ deleting ? 'Deleting…' : 'Delete Opportunity' }}</button><SewpPortalNav /></div></div>
    <div v-if="error" class="sewp-alert error">{{ error }}</div><div v-else-if="!rfq || !workspace" class="sewp-panel sewp-empty">Loading secure RFQ workspace...</div>
    <template v-else>
      <section class="sewp-stage-card"><div><span>Current stage</span><strong>{{ rfq.current_stage }}</strong><small>Record version {{ rfq.version }}</small></div><div class="sewp-transition"><select v-model="target"><option v-for="s in sewpStages" :key="s">{{ s }}</option></select><input v-model.trim="note" placeholder="Transition note" /><button class="primary-action" :disabled="busy || target === rfq.current_stage" @click="changeStage">{{ busy ? 'Updating...' : 'Update Stage' }}</button></div></section>
      <nav class="sewp-workspace-tabs"><button v-for="t in tabs" :key="t" :class="{ active: tab === t }" @click="tab = t">{{ t }}<span v-if="count(t)" class="tab-count">{{ count(t) }}</span></button></nav>

      <section v-if="tab === 'Overview'" class="sewp-detail-grid">
        <article class="sewp-panel"><h2>Opportunity details</h2><dl><div><dt>Official RFQ</dt><dd>{{ rfq.official_rfq_number }}</dd></div><div><dt>Agency</dt><dd>{{ rfq.agency || 'Not set' }}</dd></div><div><dt>Customer</dt><dd>{{ rfq.customer_organization || 'Not set' }}</dd></div><div><dt>Source</dt><dd>{{ rfq.source }}</dd></div><div><dt>Priority</dt><dd>{{ rfq.priority }}</dd></div><div><dt>Health</dt><dd>{{ rfq.health_status }}</dd></div></dl></article>
        <article class="sewp-panel"><h2>Schedule and value</h2><dl><div><dt>Received</dt><dd>{{ date(rfq.date_received) }}</dd></div><div><dt>Questions due</dt><dd>{{ date(rfq.questions_due_at) }}</dd></div><div><dt>Response due</dt><dd>{{ date(rfq.response_due_at) }}</dd></div><div><dt>Estimated value</dt><dd>{{ money(rfq.estimated_value) }}</dd></div></dl></article>
        <article v-if="workspace.project" class="sewp-panel"><h2>Linked Atlas project</h2><dl><div><dt>Project number</dt><dd>{{ workspace.project.project_number }}</dd></div><div><dt>Name</dt><dd>{{ workspace.project.project_name }}</dd></div><div><dt>Status</dt><dd>{{ workspace.project.status }}</dd></div><div><dt>Vehicle</dt><dd>{{ workspace.project.vehicle }}</dd></div></dl></article>
        <article class="sewp-panel"><h2>Customer and shipping</h2><dl><div><dt>Government POC</dt><dd>{{ governmentPoc }}</dd></div><div><dt>Customer address</dt><dd class="pre">{{ workspace.project?.customer_address?.formatted || field('customer_address') || 'Not set' }}</dd></div><div><dt>Ship to</dt><dd class="pre">{{ shipping }}</dd></div></dl></article>
        <article class="sewp-panel wide"><h2>Internal notes</h2><p>{{ rfq.notes || 'No internal notes have been added.' }}</p></article>
      </section>

      <section v-else-if="tab === 'Documents'" class="sewp-panel">
        <div class="sewp-panel-heading"><div><h2>Documents</h2><p>Original email and extracted attachments in private storage.</p></div><strong>{{ workspace.documents.length }}</strong></div>
        <div v-if="!workspace.documents.length" class="sewp-empty">No documents are linked to this RFQ.</div>
        <div v-else class="table-scroll"><table class="sewp-table"><thead><tr><th>Document</th><th>Category</th><th>Type</th><th>Size</th><th>Status</th><th>Version</th><th></th></tr></thead><tbody><tr v-for="document in workspace.documents" :key="document.id"><td><strong>{{ document.display_name }}</strong><small class="hash">{{ document.sha256.slice(0, 12) }}…</small></td><td>{{ document.category }}</td><td>{{ document.detected_mime_type }}</td><td>{{ fileSize(document.file_size_bytes) }}</td><td>{{ document.processing_status }}</td><td>{{ document.document_version }}</td><td><button class="secondary-action compact" :disabled="downloading === document.id" @click="download(document.id)"><Download :size="15"/>{{ downloading === document.id ? 'Preparing…' : 'Download' }}</button></td></tr></tbody></table></div>
      </section>

      <section v-else-if="tab === 'BOM'" class="sewp-panel">
        <div class="sewp-panel-heading"><div><h2>Bill of materials</h2><p>Imported equipment lines in source order.</p></div><div class="bom-metrics"><strong>{{ workspace.lines.length }} lines</strong><span>{{ totalQuantity.toLocaleString() }} total quantity</span><span>{{ blankManufacturers }} manufacturer reviews</span></div></div>
        <div v-if="!workspace.lines.length" class="sewp-empty">No BOM lines are linked to this RFQ.</div>
        <div v-else class="table-scroll bom-scroll"><table class="sewp-table"><thead><tr><th>Line</th><th>CLIN</th><th>Manufacturer</th><th>Part number</th><th>Description</th><th>Qty</th><th>UOI</th><th>Review</th></tr></thead><tbody><tr v-for="line in workspace.lines" :key="line.id"><td>{{ line.line_number }}</td><td>{{ line.clin }}</td><td :class="{ review: !line.manufacturer }">{{ line.manufacturer || 'Not stated' }}</td><td>{{ line.requested_part_number }}</td><td>{{ line.description }}</td><td>{{ line.quantity }}</td><td>{{ line.unit_of_measure || '—' }}</td><td>{{ line.review_status }}</td></tr></tbody></table></div>
      </section>

      <section v-else-if="tab === 'Requirements'" class="sewp-detail-grid">
        <article class="sewp-panel"><h2>Compliance requirements</h2><dl><div v-for="item in requirementFields" :key="item.key"><dt>{{ item.label }}</dt><dd>{{ yesNo(field(item.key)) }}</dd></div></dl></article>
        <article class="sewp-panel"><h2>Delivery and amendment</h2><dl><div><dt>Delivery</dt><dd>{{ field('delivery_requirement') || 'Not set' }}</dd></div><div><dt>Modification level</dt><dd>{{ field('modification_level') || 'Not set' }}</dd></div><div><dt>Modification date</dt><dd>{{ dateValue(field('modification_date')) }}</dd></div><div><dt>Modification remarks</dt><dd>{{ field('modification_remarks') || 'Not set' }}</dd></div></dl></article>
        <article class="sewp-panel wide"><h2>Requirement records</h2><div v-if="!workspace.requirements.length" class="sewp-empty">No additional normalized requirement records.</div><div v-else class="table-scroll"><table class="sewp-table"><thead><tr><th>Category</th><th>Requirement</th><th>Applicability</th><th>Status</th></tr></thead><tbody><tr v-for="requirement in workspace.requirements" :key="requirement.id"><td>{{ requirement.category }}</td><td>{{ requirement.requirement_text }}</td><td>{{ requirement.applicability || '—' }}</td><td>{{ requirement.human_status }}</td></tr></tbody></table></div></article>
        <article v-if="workspace.import?.warnings.length" class="sewp-panel wide"><h2>Import warnings</h2><ul class="warning-list"><li v-for="warning in workspace.import.warnings" :key="warning.message">{{ warning.message }}</li></ul></article>
      </section>

      <section v-else-if="tab === 'Tasks'" class="sewp-panel">
        <div class="sewp-panel-heading"><div><h2>Tasks</h2><p>RFQ assignments and due dates.</p></div><strong>{{ workspace.tasks.length }}</strong></div>
        <div v-if="!workspace.tasks.length" class="sewp-empty">No tasks have been created for this RFQ.</div>
        <div v-else class="table-scroll"><table class="sewp-table"><thead><tr><th>Task</th><th>Type</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody><tr v-for="task in workspace.tasks" :key="task.id"><td>{{ task.title }}</td><td>{{ task.task_type }}</td><td>{{ task.priority }}</td><td>{{ date(task.due_at) }}</td><td>{{ task.status }}</td></tr></tbody></table></div>
      </section>

      <section v-else-if="tab === 'Audit'" class="sewp-panel">
        <div class="sewp-panel-heading"><div><h2>Audit history</h2><p>Import, creation, and workflow events.</p></div><strong>{{ workspace.auditEvents.length + workspace.stageHistory.length }}</strong></div>
        <div class="audit-list"><article v-for="event in auditTimeline" :key="event.id"><div><strong>{{ event.title }}</strong><p>{{ event.detail }}</p></div><time>{{ date(event.occurredAt) }}</time></article></div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, Trash2 } from '@lucide/vue'
import SewpPortalNav from '../components/SewpPortalNav.vue'
import { deleteSewpRfq, getSewpDocumentDownload, getSewpRfq, getSewpWorkspace, transitionSewpRfq, type SewpWorkspace } from '../services/sewpApi'
import { sewpStages, type SewpRfq, type SewpStage } from '../types/sewp'
const route=useRoute(),router=useRouter(),rfq=ref<SewpRfq|null>(null),workspace=ref<SewpWorkspace|null>(null),error=ref(''),busy=ref(false),deleting=ref(false),downloading=ref(''),note=ref(''),target=ref<SewpStage>('New'),tab=ref('Overview')
const tabs=['Overview','Documents','BOM','Requirements','Tasks','Audit']
const requirementFields=[{key:'taa_required',label:'TAA required'},{key:'authorized_reseller_required',label:'Authorized reseller required'},{key:'partial_quotes_allowed',label:'Partial quotes allowed'},{key:'partial_delivery_allowed',label:'Partial delivery allowed'},{key:'used_or_refurbished_allowed',label:'Used/refurbished allowed'},{key:'allow_questions',label:'Questions allowed'}]
onMounted(async()=>{try{const id=String(route.params.rfqId);const [record,data]=await Promise.all([getSewpRfq(id),getSewpWorkspace(id)]);rfq.value=record.record;workspace.value=data;target.value=record.record.current_stage}catch(e){error.value=e instanceof Error?e.message:'Unable to load RFQ workspace.'}})
async function changeStage(){if(!rfq.value)return;busy.value=true;try{rfq.value=(await transitionSewpRfq(rfq.value.id,target.value,rfq.value.version,note.value)).record;note.value='';workspace.value=await getSewpWorkspace(rfq.value.id)}catch(e){error.value=e instanceof Error?e.message:'Unable to update stage.'}finally{busy.value=false}}
async function download(documentId:string){if(!rfq.value)return;downloading.value=documentId;error.value='';try{const result=await getSewpDocumentDownload(rfq.value.id,documentId);window.location.assign(result.url)}catch(e){error.value=e instanceof Error?e.message:'Unable to download document.'}finally{downloading.value=''}}
async function deleteOpportunity(){if(!rfq.value)return;const confirmation=window.prompt(`Delete ${rfq.value.atlas_opportunity_number}?\\n\\nThis removes it from the SEWP Portal but preserves its audit history and documents. Type the official RFQ number ${rfq.value.official_rfq_number} to confirm.`);if(confirmation?.trim()!==rfq.value.official_rfq_number){if(confirmation!==null)error.value='The RFQ number did not match. Nothing was deleted.';return}deleting.value=true;error.value='';try{await deleteSewpRfq(rfq.value.id);await router.push('/sewp-rfqs/work-queue')}catch(e){error.value=e instanceof Error?e.message:'Unable to delete the opportunity.'}finally{deleting.value=false}}
const totalQuantity=computed(()=>workspace.value?.lines.reduce((sum,line)=>sum+Number(line.quantity||0),0)||0)
const blankManufacturers=computed(()=>workspace.value?.lines.filter(line=>!line.manufacturer).length||0)
const governmentPoc=computed(()=>{const project=workspace.value?.project?.government_customer;return project?[project.pocFirstName,project.pocLastName,project.pocEmail].filter(Boolean).join(' · '):'Not set'})
const shipping=computed(()=>{const value=workspace.value?.project?.shipping_information;return value?[value.organization,value.address].filter(Boolean).join('\n'):'Not set'})
const auditTimeline=computed(()=>[...(workspace.value?.auditEvents||[]).map(event=>({id:`a-${event.id}`,title:event.action.replace(/[._]/g,' '),detail:`${event.actor_type} · ${event.entity_type}${event.reason?` · ${event.reason}`:''}`,occurredAt:event.occurred_at})),...(workspace.value?.stageHistory||[]).map(event=>({id:`s-${event.id}`,title:`Stage changed to ${event.to_stage}`,detail:`From ${event.from_stage||'Created'} · Version ${event.rfq_version}${event.justification?` · ${event.justification}`:''}`,occurredAt:event.occurred_at}))].sort((a,b)=>new Date(b.occurredAt).getTime()-new Date(a.occurredAt).getTime()))
function field(key:string){return workspace.value?.import?.fields?.[key]??null}
function count(name:string){if(!workspace.value)return 0;if(name==='Documents')return workspace.value.documents.length;if(name==='BOM')return workspace.value.lines.length;if(name==='Requirements')return workspace.value.requirements.length;if(name==='Tasks')return workspace.value.tasks.length;if(name==='Audit')return workspace.value.auditEvents.length+workspace.value.stageHistory.length;return 0}
const date=(value:string|null)=>value?new Date(value).toLocaleString():'Not set'
const dateValue=(value:unknown)=>typeof value==='string'?date(value):'Not set'
const money=(value:number|null)=>value==null?'Not set':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value)
const yesNo=(value:unknown)=>value===true?'Yes':value===false?'No':'Needs review'
const fileSize=(value:number)=>value<1024?`${value} B`:value<1048576?`${(value/1024).toFixed(1)} KB`:`${(value/1048576).toFixed(1)} MB`
</script>

<style scoped>
.tab-count{margin-left:6px;padding:1px 6px;border-radius:999px;background:#e8eef7;font-size:.7rem}.hash{display:block;color:#6b7785;font-family:monospace;margin-top:3px}.compact{display:inline-flex;align-items:center;gap:5px;padding:7px 10px}.bom-scroll{max-height:620px}.bom-metrics{display:flex;gap:14px;flex-wrap:wrap;font-size:.84rem}.review{background:#fff6df;color:#8a5200}.pre{white-space:pre-line}.warning-list{margin:0;padding-left:20px}.audit-list{display:grid}.audit-list article{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid #e3e8ee}.audit-list article:last-child{border-bottom:0}.audit-list p{margin:4px 0 0;color:#667383}.audit-list time{white-space:nowrap;color:#667383;font-size:.82rem}
.heading-tools{display:flex;align-items:center;gap:12px}.danger-action{display:inline-flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #c83d3d;border-radius:7px;background:#fff;color:#a52222;font-weight:700;cursor:pointer}.danger-action:hover{background:#fff1f1}.danger-action:disabled{opacity:.55;cursor:not-allowed}
</style>
