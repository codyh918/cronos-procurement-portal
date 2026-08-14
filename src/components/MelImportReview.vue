<template>
  <section class="mel-review-panel">
    <div class="mel-review-heading">
      <div><h2>MEL Import Review</h2><p>{{ analysis.diagnostics }}</p><p><strong>{{ includedCount }}</strong> selected · {{ duplicateCount }} duplicates · Average confidence {{ percent(averageConfidence) }}</p></div>
      <button class="secondary-action" type="button" @click="emit('cancel')">Cancel</button>
    </div>
    <div class="mel-sheet-summary">
      <span v-for="sheet in analysis.sheets" :key="sheet.name" :class="{ selected: analysis.selectedSheetNames.includes(sheet.name) }">{{ sheet.name }} · {{ percent(sheet.score) }} · {{ sheet.items.length }} items<span v-if="sheet.hidden"> · hidden</span></span>
    </div>
    <div v-if="analysis.needsManualMapping || showMapping" class="mel-mapping-panel">
      <div><h3>Column Mapping</h3><p>Override how columns are interpreted, then re-run extraction.</p></div>
      <div class="mel-mapping-controls">
        <label><span>Worksheet</span><select v-model="mappingSheetName"><option v-for="sheet in analysis.sheets" :key="sheet.name" :value="sheet.name">{{ sheet.name }}</option></select></label>
        <label><span>Header row</span><input v-model.number="mappingHeaderRow" type="number" min="1" /></label>
      </div>
      <div class="mel-column-map-grid">
        <label v-for="column in mappingSheet?.columns || []" :key="column.index"><span>{{ column.label }} · {{ column.sample.join(' / ') || 'blank' }}</span><select v-model="manualMapping[column.index]"><option v-for="field in mappingFields" :key="field" :value="field">{{ fieldLabel(field) }}</option></select></label>
      </div>
      <button class="primary-action" type="button" @click="applyManualMapping">Re-run Extraction</button>
    </div>
    <div class="mel-review-toolbar">
      <button class="secondary-action" type="button" @click="showMapping = !showMapping">{{ showMapping ? 'Hide Mapping' : 'Map Columns Manually' }}</button>
      <button v-if="duplicateCount" class="secondary-action" type="button" @click="combineDuplicates">Combine Safe Duplicates</button>
    </div>
    <div class="quote-lines-scroll"><table class="quote-lines-table mel-review-table">
      <thead><tr><th>Import</th><th>Qty</th><th>Part Number</th><th>Manufacturer</th><th>Description</th><th>Unit Cost</th><th>Catalog</th><th>Source</th><th>Confidence</th></tr></thead>
      <tbody><tr v-for="item in items" :key="item.id" :class="{ 'needs-attention': item.confidence.overall < thresholds.review }">
        <td><input v-model="item.included" type="checkbox" /></td><td><input v-model.number="item.quantity" class="cell-input w-20" type="number" min="0.01" step="0.01" /></td>
        <td><input v-model="item.partNumber" class="cell-input w-36" /><small v-if="item.confidence.partNumber < thresholds.review">⚠ Possible Part Number</small></td>
        <td><input v-model="item.manufacturer" class="cell-input w-36" /><small v-if="item.confidence.manufacturer < thresholds.review">⚠ Manufacturer uncertain</small></td>
        <td><textarea v-model="item.description" class="cell-textarea" /></td><td><input v-model.number="item.unitCost" class="cell-input w-28" type="number" min="0" step="0.01" /><small v-if="item.pricingSource">{{ item.pricingSource.sheet }} row {{ item.pricingSource.row }}</small></td><td>{{ item.catalogMatch || 'Not checked' }}</td><td>{{ item.source.sheet }} row {{ item.source.row }}</td>
        <td><span :class="confidenceClass(item.confidence.overall)">{{ percent(item.confidence.overall) }}</span><small v-if="item.duplicate">Duplicate detected</small></td>
      </tr></tbody>
    </table></div>
    <div class="mel-review-actions"><button class="secondary-action" type="button" @click="emit('cancel')">Cancel</button><button class="primary-action" type="button" :disabled="!includedCount" @click="emit('import', items.filter(item => item.included))">Import {{ includedCount }} to Quote</button></div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { MEL_CONFIDENCE_THRESHOLDS, MEL_FIELDS, remapMelSheet, type MelAnalysis, type MelField, type MelItem } from '../services/melIngestion.mjs'
const props = defineProps<{ analysis: MelAnalysis }>()
const emit = defineEmits<{ cancel: []; import: [items: MelItem[]] }>()
const thresholds = MEL_CONFIDENCE_THRESHOLDS; const mappingFields = MEL_FIELDS
const items = ref<MelItem[]>(structuredClone(props.analysis.items)); const showMapping = ref(props.analysis.needsManualMapping)
const mappingSheetName = ref(props.analysis.sheets[0]?.name || ''); const mappingHeaderRow = ref(props.analysis.sheets[0]?.headerRows[0] || 1); const manualMapping = reactive<Record<number, MelField>>({})
const mappingSheet = computed(() => props.analysis.sheets.find(sheet => sheet.name === mappingSheetName.value))
const includedCount = computed(() => items.value.filter(item => item.included).length); const duplicateCount = computed(() => items.value.filter(item => item.duplicate).length)
const averageConfidence = computed(() => { const selected = items.value.filter(item => item.included); return selected.length ? selected.reduce((sum, item) => sum + item.confidence.overall, 0) / selected.length : 0 })
watch(() => props.analysis, analysis => { items.value = structuredClone(analysis.items); mappingSheetName.value = analysis.sheets[0]?.name || ''; mappingHeaderRow.value = analysis.sheets[0]?.headerRows[0] || 1 }, { deep: false })
watch(mappingSheet, sheet => { Object.keys(manualMapping).forEach(key => delete manualMapping[Number(key)]); const region = sheet?.regions[0]; if (region) Object.entries(region.mapping).forEach(([column, field]) => { manualMapping[Number(column)] = field }) }, { immediate: true })
function applyManualMapping() { const sheet = mappingSheet.value; if (!sheet) return; items.value = remapMelSheet({ name: sheet.name, rows: sheet.rows, hidden: sheet.hidden }, manualMapping, Math.max(0, mappingHeaderRow.value - 1), { filename: props.analysis.filename }) }
function combineDuplicates() { const combined = new Map<string, MelItem>(); const keep: MelItem[] = []; for (const item of items.value) { const key = `${normalize(item.manufacturer)}::${normalize(item.partNumber)}::${normalize(item.room)}::${normalize(item.location)}::${normalize(item.category)}`; if (!item.partNumber || !combined.has(key)) { combined.set(key, item); keep.push(item) } else combined.get(key)!.quantity += item.quantity }; items.value = keep.map(item => ({ ...item, duplicate: false })) }
function confidenceClass(value: number) { return value >= thresholds.high ? 'confidence-high' : value >= thresholds.review ? 'confidence-review' : 'confidence-low' }
function percent(value: number) { return `${Math.round((value || 0) * 100)}%` }
function fieldLabel(field: MelField) { return field === 'ignore' ? 'Ignore' : field.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()) }
function normalize(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') }
</script>
