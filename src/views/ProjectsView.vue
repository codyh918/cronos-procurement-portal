<template>
  <div class="projects-page">
    <header class="projects-header"><div><h1>Projects</h1><p>Manage active sales and procurement projects</p></div><RouterLink class="primary-action" to="/projects/new"><Plus :size="17"/><span>New Project</span></RouterLink></header>

    <section class="project-kpis">
      <article><span>Active Projects</span><strong>{{ kpis.active }}</strong><small>{{ kpis.completed }} completed</small></article>
      <article><span>Customer Approved</span><strong>{{ kpis.approved }}</strong><small>Ready for procurement</small></article>
      <article><span>Total Quoted</span><strong>{{ currency(kpis.quoted) }}</strong><small>Across all project quotes</small></article>
      <article><span>Checkbook Balance</span><strong>{{ currency(kpis.checkbook) }}</strong><small>Remaining customer funds</small></article>
    </section>

    <section class="control-bar">
      <label class="project-search"><Search :size="17"/><input v-model="search" placeholder="Search projects" aria-label="Search Projects"/></label>
      <label>Status<select v-model="statusFilter"><option value="">All statuses</option><option v-for="value in statuses" :key="value">{{ value }}</option></select></label>
      <label>Type<select v-model="typeFilter"><option value="">All types</option><option v-for="value in types" :key="value">{{ value }}</option></select></label>
      <label>Customer<select v-model="customerFilter"><option value="">All customers</option><option v-for="value in customers" :key="value">{{ value }}</option></select></label>
      <label>Assigned User<select v-model="userFilter"><option value="">Anyone</option><option v-for="user in activeUsers" :key="user.id" :value="user.id">{{ user.name }}</option></select></label>
      <div class="scope-toggle" aria-label="Project completion filter"><button v-for="scope in scopes" :key="scope" :class="{active: activityFilter===scope}" @click="activityFilter=scope">{{ scope }}</button></div>
    </section>

    <section v-if="projects.length" class="projects-table-card">
      <header class="table-heading"><div><h2>All Projects</h2><p>{{ filteredProjects.length }} matching project{{ filteredProjects.length===1?'':'s' }}</p></div><label>Rows <select v-model.number="pageSize"><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></select></label></header>
      <div class="table-scroll"><table><thead><tr>
        <th class="project-col" @click="setSort('project')">Project <SortMark :active="sortKey==='project'" :direction="sortDirection"/></th>
        <th class="customer-col" @click="setSort('customer')">Customer <SortMark :active="sortKey==='customer'" :direction="sortDirection"/></th>
        <th class="compact-col">Assigned</th><th class="compact-col">Type</th>
        <th class="compact-col" @click="setSort('status')">Status <SortMark :active="sortKey==='status'" :direction="sortDirection"/></th>
        <th class="money" @click="setSort('cost')">Cost <SortMark :active="sortKey==='cost'" :direction="sortDirection"/></th>
        <th class="money" @click="setSort('sell')">Sell Price <SortMark :active="sortKey==='sell'" :direction="sortDirection"/></th>
        <th class="money" @click="setSort('profit')">Gross Profit <SortMark :active="sortKey==='profit'" :direction="sortDirection"/></th><th class="actions-col">Actions</th>
      </tr></thead><tbody>
        <tr v-for="row in pagedRows" :key="row.project.id" tabindex="0" @click="openProject(row.project.id)" @keyup.enter="openProject(row.project.id)">
          <td><span class="project-number">{{ row.project.projectNumber }}</span><strong class="project-name">{{ row.project.projectName }}</strong><small v-if="row.project.projectType==='Checkbook'">Checkbook Balance: {{ currency(row.checkbookBalance) }}</small></td>
          <td>{{ row.project.customer || '—' }}</td>
          <td><span class="assigned" :title="row.assignedNames.join(', ')">{{ compactAssigned(row.assignedNames) }}</span></td>
          <td><span class="type-label">{{ row.project.projectType }}</span></td>
          <td><StatusBadge :status="row.project.status"/></td>
          <td class="money">{{ currency(row.cost) }}</td><td class="money">{{ currency(row.sell) }}</td><td class="money"><strong :class="row.profit<0?'negative':'positive'">{{ currency(row.profit) }}</strong><small>{{ row.gpPercent.toFixed(1) }}% GP</small></td>
          <td class="actions-cell" @click.stop @keyup.enter.stop><button class="more-button" aria-label="Project actions" @click="toggleMenu(row.project.id)"><MoreHorizontal :size="19"/></button><div v-if="openMenu===row.project.id" class="action-menu"><button @click="openProject(row.project.id)">Open Project</button><button @click="go(`/projects/${row.project.id}/quotes/new`)">Add Quote</button><button @click="go(`/projects/${row.project.id}/edit`)">Edit Project</button><button @click="duplicateProject(row.project)">Duplicate Project</button><button class="danger" @click="archiveProject(row.project)">Archive Project</button></div></td>
        </tr>
      </tbody></table></div>
      <footer class="pagination"><span>Showing {{ pageStart }}–{{ pageEnd }} of {{ filteredProjects.length }}</span><div><button :disabled="page===1" @click="page--">Previous</button><span>Page {{ page }} of {{ totalPages }}</span><button :disabled="page===totalPages" @click="page++">Next</button></div></footer>
    </section>
    <section v-else class="large-empty-card"><h2>No projects yet</h2><p>Create the first sales or procurement project.</p><RouterLink class="primary-action" to="/projects/new"><Plus :size="17"/> New Project</RouterLink></section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { MoreHorizontal, Plus, Search } from '@lucide/vue'
import { useRouter } from 'vue-router'
import StatusBadge from '../components/StatusBadge.vue'
import { calculateQuoteSummary, currency } from '../services/calculations'
import { getCheckbookSummary } from '../services/checkbook'
import { loadUsers } from '../services/auth'
import { loadProjects, saveProject, updateProjectFromInput } from '../services/localProjects'
import type { Project, Status } from '../types'

type SortKey='project'|'customer'|'status'|'cost'|'sell'|'profit'
const router=useRouter(),projects=ref<Project[]>(loadProjects()),users=ref(loadUsers()),search=ref(''),statusFilter=ref(''),typeFilter=ref(''),customerFilter=ref(''),userFilter=ref(''),activityFilter=ref<'Active'|'Completed'|'All'>('Active')
const sortKey=ref<SortKey>('project'),sortDirection=ref<'asc'|'desc'>('asc'),page=ref(1),pageSize=ref(25),openMenu=ref('')
const scopes=['Active','Completed','All'] as const
const completedStatuses=new Set<Status>(['Delivered','Cancelled'])
const statuses=computed(()=>[...new Set(projects.value.map(p=>p.status))].sort()),types=computed(()=>[...new Set(projects.value.map(p=>p.projectType))].sort()),customers=computed(()=>[...new Set(projects.value.map(p=>p.customer).filter(Boolean))].sort()),activeUsers=computed(()=>users.value.filter(u=>u.active!==false))
const rows=computed(()=>projects.value.map(project=>{const totals=projectTotals(project),assignedNames=assignedUserNames(project);return{project,...totals,assignedNames,checkbookBalance:project.projectType==='Checkbook'?getCheckbookSummary(project).remainingBalance:0}}))
const filteredProjects=computed(()=>rows.value.filter(row=>{const p=row.project,q=search.value.trim().toLowerCase(),completed=completedStatuses.has(p.status);return(!q||[p.projectNumber,p.projectName,p.customer,...row.assignedNames].some(v=>v.toLowerCase().includes(q)))&&(!statusFilter.value||p.status===statusFilter.value)&&(!typeFilter.value||p.projectType===typeFilter.value)&&(!customerFilter.value||p.customer===customerFilter.value)&&(!userFilter.value||p.assignedUserIds?.includes(userFilter.value))&&(activityFilter.value==='All'||(activityFilter.value==='Completed'?completed:!completed))}).sort((a,b)=>compareRows(a,b)))
const totalPages=computed(()=>Math.max(1,Math.ceil(filteredProjects.value.length/pageSize.value))),pagedRows=computed(()=>filteredProjects.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value)),pageStart=computed(()=>filteredProjects.value.length?(page.value-1)*pageSize.value+1:0),pageEnd=computed(()=>Math.min(page.value*pageSize.value,filteredProjects.value.length))
const kpis=computed(()=>rows.value.reduce((out,row)=>{if(!completedStatuses.has(row.project.status))out.active++;else out.completed++;if(row.project.status==='Customer Approved')out.approved++;out.quoted+=row.sell;if(row.project.projectType==='Checkbook')out.checkbook+=row.checkbookBalance;return out},{active:0,completed:0,approved:0,quoted:0,checkbook:0}))
watch([search,statusFilter,typeFilter,customerFilter,userFilter,activityFilter,pageSize],()=>page.value=1)
onMounted(()=>{window.addEventListener('cronos:projects-changed',refresh);document.addEventListener('click',closeMenu)})
onUnmounted(()=>{window.removeEventListener('cronos:projects-changed',refresh);document.removeEventListener('click',closeMenu)})
function refresh(){projects.value=loadProjects();users.value=loadUsers()}
function projectTotals(project:Project){const totals=(project.quotes??[]).reduce((s,q)=>{const t=calculateQuoteSummary(q.lines,q.contractFeeEnabled,q.shippingCost);return{cost:s.cost+t.totalCost,sell:s.sell+t.customerTotal}},{cost:0,sell:0});const profit=totals.sell-totals.cost;return{...totals,profit,gpPercent:totals.sell>0?profit/totals.sell*100:0}}
function assignedUserNames(project:Project){const ids=new Set(project.assignedUserIds??[]);return users.value.filter(u=>ids.has(u.id)).map(u=>u.name)}
function compactAssigned(names:string[]){if(!names.length)return'Unassigned';const first=names[0].split(' ');const short=first.length>1?`${first[0]} ${first.at(-1)?.[0]}.`:first[0];return names.length>1?`${short} +${names.length-1}`:short}
function compareRows(a:any,b:any){const values={project:[a.project.projectNumber,b.project.projectNumber],customer:[a.project.customer,b.project.customer],status:[a.project.status,b.project.status],cost:[a.cost,b.cost],sell:[a.sell,b.sell],profit:[a.profit,b.profit]}[sortKey.value];const result=typeof values[0]==='number'?values[0]-values[1]:String(values[0]).localeCompare(String(values[1]),undefined,{numeric:true});return sortDirection.value==='asc'?result:-result}
function setSort(key:SortKey){if(sortKey.value===key)sortDirection.value=sortDirection.value==='asc'?'desc':'asc';else{sortKey.value=key;sortDirection.value='asc'}}
function openProject(id:string){void router.push(`/projects/${id}`)} function go(path:string){openMenu.value='';void router.push(path)}
function toggleMenu(id:string){openMenu.value=openMenu.value===id?'':id} function closeMenu(){openMenu.value=''}
function duplicateProject(project:Project){const number=`${project.projectNumber}-COPY`;saveProject({...project,projectNumber:number,projectName:`${project.projectName} (Copy)`,status:'Quoted',assignedUserIds:[...(project.assignedUserIds??[])]});openMenu.value=''}
function archiveProject(project:Project){if(!window.confirm(`Archive ${project.projectNumber}? It will be marked Cancelled and retained for reporting.`))return;updateProjectFromInput(project.id,{...project,status:'Cancelled'});openMenu.value=''}
const SortMark=defineComponent({props:{active:Boolean,direction:String},setup:p=>()=>h('span',{class:'sort-mark'},p.active?(p.direction==='asc'?'↑':'↓'):'↕')})
</script>

<style scoped>
.projects-page{display:grid;gap:1rem;width:min(100%,1680px);margin:0 auto}.projects-header,.table-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem}.projects-header h1,.table-heading h2{margin:0}.projects-header p,.table-heading p{margin:.25rem 0 0;color:#64748b}.project-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem}.project-kpis article{background:#fff;border:1px solid #dbe3ec;border-radius:9px;padding:.9rem 1rem}.project-kpis span,.project-kpis small,.money small{display:block;color:#64748b}.project-kpis span{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.project-kpis strong{display:block;font-size:1.45rem;margin:.2rem 0}.project-kpis small{font-size:.72rem}.control-bar{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(120px,.7fr)) auto;align-items:end;gap:.65rem;background:#fff;border:1px solid #dbe3ec;border-radius:9px;padding:.75rem}.control-bar>label{display:grid;gap:.25rem;font-size:.68rem;font-weight:700;color:#475569}.control-bar select,.project-search{border:1px solid #cbd5e1;border-radius:7px;background:#fff;padding:.5rem}.project-search{display:flex!important;align-items:center;gap:.45rem}.project-search input{border:0;outline:0;width:100%}.scope-toggle{display:flex;background:#f1f5f9;border-radius:7px;padding:.2rem}.scope-toggle button{border:0;background:none;padding:.42rem .55rem;border-radius:5px;color:#64748b}.scope-toggle button.active{background:#fff;color:#1d4ed8;box-shadow:0 1px 2px #0f172a1a}.projects-table-card{background:#fff;border:1px solid #dbe3ec;border-radius:9px;min-width:0}.table-heading{padding:.8rem 1rem}.table-heading label{font-size:.72rem;color:#64748b}.table-heading select{margin-left:.35rem;border:1px solid #cbd5e1;border-radius:6px;padding:.35rem}.table-scroll{overflow:auto;max-height:calc(100vh - 365px)}table{border-collapse:separate;border-spacing:0;width:100%;font-size:.78rem}th{position:sticky;top:0;z-index:2;background:#f8fafc;color:#475569;text-transform:uppercase;font-size:.66rem;letter-spacing:.035em;cursor:pointer}th,td{padding:.7rem .65rem;border-top:1px solid #edf2f7;text-align:left;vertical-align:middle}tbody tr{cursor:pointer}tbody tr:hover{background:#f8fbff}.project-col{width:30%;min-width:285px}.customer-col{width:17%;min-width:160px}.compact-col{width:9%;white-space:nowrap}.project-number,.project-name,.money small{display:block}.project-number{font-size:.68rem;color:#2563eb;font-weight:700}.project-name{font-size:.84rem;margin:.15rem 0}.project-col+td{}.project-name+small{color:#64748b}.assigned{white-space:nowrap}.type-label{font-size:.72rem;white-space:nowrap}.money{text-align:right;white-space:nowrap}.money strong{display:block}.positive{color:#166534}.negative{color:#b91c1c}.actions-col,.actions-cell{width:44px;text-align:center}.actions-cell{position:relative}.more-button{border:0;background:none;border-radius:6px;padding:.3rem}.more-button:hover{background:#e2e8f0}.action-menu{position:absolute;right:32px;top:8px;z-index:10;width:155px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 30px #0f172a26;padding:.3rem}.action-menu button{display:block;width:100%;border:0;background:none;text-align:left;padding:.5rem;border-radius:5px;font-size:.76rem}.action-menu button:hover{background:#f1f5f9}.action-menu .danger{color:#b91c1c}.sort-mark{font-size:.7rem;color:#94a3b8}.pagination{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;color:#64748b;font-size:.75rem}.pagination div{display:flex;gap:.7rem;align-items:center}.pagination button{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:.4rem .65rem}.pagination button:disabled{opacity:.4}@media(max-width:1250px){.control-bar{grid-template-columns:repeat(3,1fr)}.project-kpis{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.projects-header{align-items:flex-start;flex-direction:column}.project-kpis,.control-bar{grid-template-columns:1fr}.table-scroll{max-height:none}}
</style>
