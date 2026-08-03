<template>
  <div class="product-catalog-page">
    <header class="catalog-hero">
      <div>
        <p class="eyebrow">MASTER PRODUCT DATABASE</p>
        <h1>Product Catalog</h1>
        <p>Search manufacturer catalogs, supplier records, specifications, and current pricing.</p>
      </div>
      <label v-if="isAdmin" class="upload-button catalog-import-button">
        <FileUp :size="18" />
        <span>Import Catalog</span>
        <input type="file" accept=".xlsx,.csv" @change="handleImport" />
      </label>
    </header>

    <section class="catalog-search-panel">
      <Search :size="22" />
      <input v-model="query" placeholder='Search “Cisco codec”, “55 inch”, part number, supplier…' @keyup.enter="runSearch(1)" />
      <button class="primary-action" type="button" @click="runSearch(1)">Search</button>
    </section>
    <div v-if="suggestions.length" class="suggestion-row">
      <span>Explore:</span>
      <button v-for="suggestion in suggestions" :key="suggestion" type="button" @click="query = suggestion; runSearch(1)">{{ suggestion }}</button>
    </div>

    <section v-if="importSummary" class="import-summary-card">
      <div><strong>{{ importSummary.newProducts }}</strong><span>New Products</span></div>
      <div><strong>{{ importSummary.updatedProducts }}</strong><span>Updated Products</span></div>
      <div><strong>{{ importSummary.duplicateRecords }}</strong><span>Duplicate Records</span></div>
      <div><strong>{{ importSummary.errors.length }}</strong><span>Errors</span></div>
      <div><strong>{{ importSummary.skippedRows }}</strong><span>Skipped Rows</span></div>
      <div><strong>{{ importSummary.priceChanges }}</strong><span>Price Changes</span></div>
    </section>
    <p v-if="status" class="status-note">{{ status }}</p>

    <div class="catalog-layout">
      <aside class="catalog-filters">
        <div class="filter-heading"><h2>Filters</h2><button type="button" @click="clearFilters">Clear</button></div>
        <FilterSelect v-model="manufacturer" label="Manufacturer" :options="facets.manufacturers" />
        <FilterSelect v-model="category" label="Category" :options="facets.categories" />
        <FilterSelect v-model="supplier" label="Supplier" :options="facets.suppliers" />
        <fieldset><legend>Price Range</legend><div class="range-fields"><input v-model.number="minPrice" type="number" min="0" placeholder="Min" /><input v-model.number="maxPrice" type="number" min="0" placeholder="Max" /></div></fieldset>
        <fieldset><legend>Lead Time</legend><select v-model.number="leadTimeDays"><option :value="null">Any</option><option :value="7">7 days</option><option :value="14">14 days</option><option :value="30">30 days</option><option :value="60">60 days</option></select></fieldset>
        <FilterToggle v-model="purchasable" label="Purchasable" />
        <FilterToggle v-model="inStock" label="In Stock" />
        <FilterToggle v-model="taaCompliant" label="TAA Compliant" />
        <FilterToggle v-model="serialRequired" label="Serial Number Required" />
        <FilterToggle v-model="active" label="Active" />
        <button class="secondary-action apply-filters" type="button" @click="runSearch(1)">Apply Filters</button>
      </aside>

      <main class="catalog-results">
        <div class="results-heading"><div><h2>Products</h2><p>{{ total.toLocaleString() }} matching products · server-side results</p></div><select v-model.number="pageSize" @change="runSearch(1)"><option :value="25">25 per page</option><option :value="50">50 per page</option><option :value="100">100 per page</option></select></div>
        <div v-if="loading" class="catalog-empty">Searching the catalog…</div>
        <div v-else-if="error" class="catalog-empty error-state">{{ error }}</div>
        <div v-else-if="!products.length" class="catalog-empty"><h3>No exact match</h3><p>Try a broader description, nearby screen size, manufacturer, or category.</p></div>
        <div v-else class="catalog-table-wrap">
          <table class="catalog-table">
            <thead><tr><th>Manufacturer</th><th>Part Number</th><th>Description</th><th>Current Cost</th><th>Supplier</th><th>Lead Time</th><th>Purchasable</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="product in products" :key="product.id" tabindex="0" @click="openProduct(product.id)" @keyup.enter="openProduct(product.id)">
                <td><strong>{{ product.manufacturer }}</strong></td><td><span class="part-number">{{ product.manufacturer_part_number }}</span></td><td>{{ product.description }}</td><td>{{ currency(product.current_cost ?? 0) }}</td><td>{{ product.supplier || '—' }}</td><td>{{ product.lead_time || '—' }}</td><td><span :class="['catalog-badge', product.purchasable ? 'success' : 'muted']">{{ yesNo(product.purchasable) }}</span></td><td>{{ product.procurement_status || (product.active ? 'Active' : 'Inactive') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination"><button type="button" :disabled="page <= 1" @click="runSearch(page - 1)">Previous</button><span>Page {{ page }} of {{ totalPages }}</span><button type="button" :disabled="page >= totalPages" @click="runSearch(page + 1)">Next</button></div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FileUp, Search } from '@lucide/vue'
import FilterSelect from '../components/catalog/FilterSelect.vue'
import FilterToggle from '../components/catalog/FilterToggle.vue'
import { currency } from '../services/calculations'
import { fetchSession } from '../services/auth'
import { importCatalog, loadCatalogFacets, searchCatalog, type CatalogProduct, type ImportSummary } from '../services/productCatalogApi'

const router = useRouter(); const query = ref(''); const products = ref<CatalogProduct[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(25)
const manufacturer = ref(''); const category = ref(''); const supplier = ref(''); const minPrice = ref<number | null>(null); const maxPrice = ref<number | null>(null); const leadTimeDays = ref<number | null>(null)
const purchasable = ref<boolean | null>(null); const inStock = ref<boolean | null>(null); const taaCompliant = ref<boolean | null>(null); const serialRequired = ref<boolean | null>(null); const active = ref<boolean | null>(true)
const loading = ref(false); const error = ref(''); const status = ref(''); const suggestions = ref<string[]>([]); const importSummary = ref<ImportSummary | null>(null)
const facets = ref({ manufacturers: [] as Array<{ value: string; count: number }>, categories: [] as Array<{ value: string; count: number }>, suppliers: [] as Array<{ value: string; count: number }> })
const isAdmin = computed(() => fetchSession()?.role === 'Admin'); const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

onMounted(async () => { try { facets.value = await loadCatalogFacets() } catch {} await runSearch(1) })
async function runSearch(nextPage = page.value) { loading.value = true; error.value = ''; try { const result = await searchCatalog({ q: query.value, page: nextPage, pageSize: pageSize.value, manufacturer: manufacturer.value ? [manufacturer.value] : [], category: category.value ? [category.value] : [], supplier: supplier.value ? [supplier.value] : [], minPrice: minPrice.value, maxPrice: maxPrice.value, leadTimeDays: leadTimeDays.value, purchasable: purchasable.value, inStock: inStock.value, taaCompliant: taaCompliant.value, serialRequired: serialRequired.value, active: active.value }); products.value = result.products; total.value = result.total; page.value = result.page; suggestions.value = result.suggestions } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to search the product catalog.' } finally { loading.value = false } }
async function handleImport(event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; status.value = `Importing ${file.name}…`; try { importSummary.value = await importCatalog(file); status.value = `Import complete: ${importSummary.value.newProducts} new and ${importSummary.value.updatedProducts} updated.`; facets.value = await loadCatalogFacets(); await runSearch(1) } catch (cause) { status.value = cause instanceof Error ? cause.message : 'Catalog import failed.' } finally { input.value = '' } }
function clearFilters() { manufacturer.value = ''; category.value = ''; supplier.value = ''; minPrice.value = null; maxPrice.value = null; leadTimeDays.value = null; purchasable.value = null; inStock.value = null; taaCompliant.value = null; serialRequired.value = null; active.value = true; void runSearch(1) }
function openProduct(id: string) { void router.push(`/catalog/${id}`) }
function yesNo(value: boolean | null) { return value === null ? 'Unknown' : value ? 'Yes' : 'No' }
</script>

<style scoped>
.product-catalog-page{display:grid;gap:1.25rem}.catalog-hero,.results-heading,.filter-heading{display:flex;justify-content:space-between;align-items:center;gap:1rem}.catalog-hero h1{margin:.15rem 0}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.12em;color:#64748b}.catalog-import-button input{display:none}.catalog-search-panel{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.75rem;padding:1rem 1.1rem;background:#fff;border:1px solid #dbe3ec;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.06)}.catalog-search-panel input{border:0;outline:0;font-size:1rem;width:100%}.suggestion-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;color:#64748b}.suggestion-row button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:.35rem .7rem;color:#334155}.import-summary-card{display:grid;grid-template-columns:repeat(6,1fr);gap:.75rem}.import-summary-card div{background:#fff;border:1px solid #dbe3ec;border-radius:12px;padding:.85rem}.import-summary-card strong,.import-summary-card span{display:block}.import-summary-card strong{font-size:1.25rem}.import-summary-card span{font-size:.75rem;color:#64748b}.catalog-layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:1rem}.catalog-filters,.catalog-results{background:#fff;border:1px solid #dbe3ec;border-radius:14px}.catalog-filters{padding:1rem;align-self:start;display:grid;gap:1rem}.filter-heading h2,.results-heading h2{margin:0}.filter-heading button{border:0;background:none;color:#2563eb}.catalog-filters fieldset{border:0;padding:0;margin:0;display:grid;gap:.4rem}.catalog-filters legend{font-size:.78rem;font-weight:700;color:#475569;margin-bottom:.4rem}.catalog-filters select,.catalog-filters input,.results-heading select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:.55rem;background:#fff}.range-fields{display:grid;grid-template-columns:1fr 1fr;gap:.4rem}.apply-filters{justify-content:center}.catalog-results{min-width:0}.results-heading{padding:1rem 1.1rem;border-bottom:1px solid #e2e8f0}.results-heading p{margin:.2rem 0 0;color:#64748b;font-size:.82rem}.catalog-table-wrap{overflow:auto}.catalog-table{width:100%;border-collapse:collapse;font-size:.82rem}.catalog-table th{position:sticky;top:0;background:#f8fafc;text-align:left;color:#475569;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}.catalog-table th,.catalog-table td{padding:.78rem;border-bottom:1px solid #eef2f7}.catalog-table tbody tr{cursor:pointer}.catalog-table tbody tr:hover{background:#f8fbff}.part-number{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#1d4ed8}.catalog-badge{display:inline-flex;padding:.2rem .45rem;border-radius:999px;font-size:.72rem}.catalog-badge.success{background:#dcfce7;color:#166534}.catalog-badge.muted{background:#f1f5f9;color:#64748b}.catalog-empty{padding:4rem;text-align:center;color:#64748b}.error-state{color:#b91c1c}.pagination{display:flex;justify-content:center;align-items:center;gap:1rem;padding:1rem}.pagination button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:.45rem .8rem}.pagination button:disabled{opacity:.45}@media(max-width:900px){.catalog-layout{grid-template-columns:1fr}.import-summary-card{grid-template-columns:repeat(2,1fr)}.catalog-hero{align-items:flex-start;flex-direction:column}}
</style>
