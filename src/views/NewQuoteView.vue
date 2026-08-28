<template>
  <div v-if="project && (!isEditMode || quote)" class="quote-builder-page">
    <header class="page-heading">
      <div>
        <h1>{{ quote ? `Edit Quote ${quote.quoteNumber}` : 'Create Project Quote' }}</h1>
        <p>{{ project.projectNumber }} - {{ project.projectName }}</p>
      </div>
      <div class="page-actions">
        <RouterLink class="secondary-action" :to="`/projects/${project.id}`">Back to Project</RouterLink>
        <button v-if="quote" class="secondary-action" type="button" :disabled="isExportingPdf" @click="exportPdf">
          <Download :size="17" />
          <span>{{ isExportingPdf ? 'Generating PDF...' : 'Download Quote PDF' }}</span>
        </button>
        <button v-if="quote" class="secondary-action" type="button" @click="exportExcel">
          <FileSpreadsheet :size="17" />
          <span>Download Quote Excel</span>
        </button>
        <button v-if="quote" class="secondary-action" type="button" :disabled="!draftLines.length" @click="exportRfqPackage">
          <FileSpreadsheet :size="17" />
          <span>Vendor RFQ Workbooks</span>
        </button>
        <button v-if="quote" class="secondary-action danger-outline-action" type="button" @click="removeQuote">
          <Trash2 :size="17" />
          <span>Delete Quote</span>
        </button>
        <button class="primary-action" type="button" :disabled="!draftLines.length || isSavingQuote" @click="saveQuote">
          <Save :size="17" />
          <span>{{ isSavingQuote ? 'Saving...' : quote ? 'Save Changes' : 'Save Quote' }}</span>
        </button>
        <button v-if="!quote" class="secondary-action" type="button" :disabled="!draftLines.length" @click="exportRfqPackage">
          <FileSpreadsheet :size="17" />
          <span>Vendor RFQ Workbooks</span>
        </button>
      </div>
    </header>
    <div v-if="saveQuoteError" class="warning-note save-error">
      {{ saveQuoteError }}
    </div>

    <section class="quote-summary-grid">
      <QuoteSummaryTile label="Lines" :value="String(draftLines.length)" />
      <QuoteSummaryTile label="Total Cost" :value="currency(summary.totalCost)" />
      <QuoteSummaryTile label="Line Item Total" :value="currency(summary.totalSellPrice)" />
      <QuoteSummaryTile label="Contract Fee" :value="currency(summary.contractFee)" />
      <QuoteSummaryTile label="Shipping" :value="currency(summary.shippingCost)" />
      <QuoteSummaryTile label="Quote Total" :value="currency(summary.customerTotal)" />
    </section>

    <section class="settings-strip pricing-verification-summary">
      <div>
        <h2>Pricing Verification</h2>
        <p>{{ pricingSummary.allVerified ? 'All pricing verified' : `${pricingSummary.requiringVerification} of ${pricingSummary.total} items require pricing verification` }}</p>
        <p v-if="pricingVerificationError" class="status-note price-error">{{ pricingVerificationError }}</p>
      </div>
      <div class="quote-detail-controls">
        <label class="pricing-filter-toggle"><input v-model="showOnlyPricingIssues" type="checkbox" /> Show only items requiring verification</label>
        <button class="primary-action" type="button" :disabled="!pricingSummary.requiringVerification || pricingVerificationLoading" @click="verifyQuotePricing()">
          {{ pricingVerificationLoading ? 'Checking TD SYNNEX...' : 'Verify Pricing' }}
        </button>
      </div>
    </section>

    <section v-if="pricingReview.length" ref="pricingReviewPanel" class="pricing-review-panel">
      <div class="quote-draft-heading">
        <div><h2>Pricing Verification Review</h2><p>No quote or catalog pricing changes until you apply selected results.</p></div>
        <button class="secondary-action" type="button" @click="cancelPricingReview">Cancel</button>
      </div>
      <div class="quote-lines-scroll"><table class="quote-lines-table pricing-review-table">
        <thead><tr><th></th><th>Part Number</th><th>Current Cost</th><th>Atlas Catalog</th><th>TD SYNNEX Cost</th><th>Delta</th><th>Availability</th><th>Status</th></tr></thead>
        <tbody><tr v-for="result in pricingReview" :key="result.lineId">
          <td><input v-model="selectedVerificationIds" type="checkbox" :value="result.lineId" :disabled="result.distributorCost === null" /></td>
          <td>{{ result.partNumber }}</td><td>{{ moneyOrDash(result.currentQuoteCost) }}</td><td>{{ moneyOrDash(result.catalogCost) }}</td><td>{{ moneyOrDash(result.distributorCost) }}</td>
          <td>{{ deltaLabel(result.delta, result.percentDelta) }}</td><td>{{ result.availableQuantity ?? result.availabilityStatus ?? '—' }}</td><td><span class="pricing-review-status">{{ result.status }}</span></td>
        </tr></tbody>
      </table></div>
      <div class="pricing-review-actions">
        <button class="primary-action" type="button" :disabled="!selectedVerificationIds.length || pricingVerificationLoading" @click="applyPricingReview(false)">Apply Selected</button>
        <button v-if="canUpdateCatalog" class="secondary-action" type="button" :disabled="!selectedVerificationIds.length || pricingVerificationLoading" @click="applyPricingReview(true)">Update Catalog for Selected + Apply</button>
      </div>
    </section>

    <section class="settings-strip">
      <div>
        <h2>Quote Details</h2>
        <p>Update the customer-facing quote name and approval status from this edit screen.</p>
      </div>
      <div class="quote-detail-controls">
        <label class="mini-field quote-name-field">
          <span>Quote Name</span>
          <input v-model="quoteName" placeholder="Example: General Purchase" />
        </label>
        <button
          v-if="quote"
          class="secondary-action"
          :class="{ 'danger-outline-action': quote.status === 'Customer Approved' }"
          type="button"
          @click="toggleApproval"
        >
          <XCircle v-if="quote.status === 'Customer Approved'" :size="17" />
          <CheckCircle2 v-else :size="17" />
          <span>{{ quote.status === 'Customer Approved' ? 'Mark Not Approved' : 'Mark Approved' }}</span>
        </button>
      </div>
    </section>

    <section class="settings-strip">
      <div>
        <h2>Contract Fee</h2>
        <p>
          {{
            contractFeeEnabled
              ? 'Contract fee is active. The line item total plus shipping is divided by .889.'
              : 'Add a contract fee calculated from the line item total plus shipping.'
          }}
        </p>
      </div>
      <button class="primary-action" :class="{ 'light-action': contractFeeEnabled }" type="button" @click="contractFeeEnabled = !contractFeeEnabled">
        <BadgeDollarSign :size="17" />
        <span>{{ contractFeeEnabled ? 'Remove Contract Fee' : 'Add Contract Fee' }}</span>
      </button>
    </section>

    <section v-if="showPricingControls" class="quote-profit-grid">
      <QuoteSummaryTile label="Gross Profit" :value="currency(summary.totalGrossProfit)" />
    </section>

    <section v-if="showPricingControls" class="settings-strip">
      <div>
        <h2>Apply Pricing to All Lines</h2>
        <p>Set one margin or markup across the quote. You can still adjust any line individually afterward.</p>
        <p v-if="bulkPricingStatus" class="status-note">{{ bulkPricingStatus }}</p>
      </div>
      <div class="quote-detail-controls">
        <label class="mini-field">
          <span>Method</span>
          <select v-model="bulkPricingMode">
            <option value="margin">Margin</option>
            <option value="markup">Markup</option>
          </select>
        </label>
        <label class="mini-field">
          <span>{{ bulkPricingMode === 'margin' ? 'Margin %' : 'Markup %' }}</span>
          <input v-model.number="bulkPricingPercent" type="number" min="0" :max="bulkPricingMode === 'margin' ? 99.99 : undefined" step="0.01" />
        </label>
        <button class="primary-action" type="button" :disabled="!draftLines.length" @click="applyBulkPricing">Apply to All Lines</button>
      </div>
    </section>

    <section class="settings-strip">
      <div>
        <h2>Shipping Cost</h2>
        <p>Add a customer-facing shipping charge to the quote total.</p>
      </div>
      <label class="mini-field">
        <span>Shipping</span>
        <input v-model.number="shippingCost" type="number" min="0" step="0.01" />
      </label>
    </section>

    <section class="settings-strip">
      <div>
        <h2>Quote Expiration</h2>
        <p>Choose how long the customer quote remains valid.</p>
      </div>
      <label class="mini-field">
        <span>Expires In</span>
        <select v-model.number="expirationDays">
          <option :value="30">30 days</option>
          <option :value="60">60 days</option>
          <option :value="90">90 days</option>
        </select>
      </label>
    </section>

    <section class="import-panel">
      <div>
        <h2>Import ROM / material list</h2>
        <p>{{ quote ? 'Upload an exported ROM Tool quote, Excel, CSV, TXT, or PDF to append material lines to this quote.' : 'Upload an exported ROM Tool quote, Excel, CSV, TXT, or PDF. Material lines are added to the draft and grouped by vendor for RFQs.' }}</p>
      </div>
      <label class="upload-button">
        <FileUp :size="17" />
        <span>Upload ROM / Quote</span>
        <input type="file" @change="handleImport" />
      </label>
      <p v-if="importStatus">{{ importStatus }}</p>
    </section>
    <MelImportReview v-if="melImportAnalysis" :analysis="melImportAnalysis" @cancel="cancelMelImport" @import="approveMelImport" />

    <section class="import-panel manufacturer-import-panel">
      <div>
        <h2>Bulk update manufacturers</h2>
        <p>Update the Manufacturer column in an exported Atlas quote workbook, then upload it here. Atlas matches rows by Line and Part # without changing pricing, quantities, or descriptions.</p>
      </div>
      <label class="upload-button">
        <FileSpreadsheet :size="17" />
        <span>Upload Manufacturer Updates</span>
        <input type="file" accept=".xlsx,.xls,.csv" @change="handleManufacturerImport" />
      </label>
      <p v-if="manufacturerImportStatus">{{ manufacturerImportStatus }}</p>
    </section>

    <section class="rfq-panel">
      <div class="rfq-panel-heading">
        <div>
          <h2>Engineer MEL to Vendor RFQ Workflow</h2>
          <p>{{ quote ? 'Verify catalog pricing through vendor RFQs before issuing purchase orders.' : 'Use catalog pricing as a starting point, but verify Design &amp; Install pricing through vendor RFQs before issuing POs.' }}</p>
        </div>
        <div class="page-actions">
          <button class="primary-action" type="button" :disabled="!draftLines.length" @click="exportRfqPackage">
            <Send :size="17" />
            <span>Generate Vendor RFQs</span>
          </button>
          <label class="secondary-action upload-inline">
            <Upload :size="17" />
            <span>Import Vendor Pricing</span>
            <input type="file" @change="handleRfqImport" />
          </label>
        </div>
      </div>

      <div class="rfq-step-grid">
        <RfqStep :complete="draftLines.length > 0" title="1. MEL Imported" :detail="`${draftLines.length} line${draftLines.length === 1 ? '' : 's'}`" />
        <RfqStep
          :complete="rfqReadiness.missingVendorCount === 0 && draftLines.length > 0"
          title="2. Vendors Assigned"
          :detail="`${rfqReadiness.assignedVendorCount}/${rfqReadiness.totalLines} assigned`"
        />
        <RfqStep :complete="rfqStatus.includes('exported') || rfqStatus.includes('Updated')" title="3. RFQs Sent" detail="Vendor workbooks" />
        <RfqStep
          :complete="rfqReadiness.missingVerifiedPricingCount === 0 && draftLines.length > 0"
          title="4. Pricing Verified"
          :detail="`${rfqReadiness.verifiedPricingCount}/${rfqReadiness.totalLines} verified`"
        />
        <RfqStep
          :complete="rfqReadiness.readyForCustomerQuote"
          :title="quote ? '5. Ready for PO' : '5. Ready for Quote'"
          :detail="rfqReadiness.readyForCustomerQuote ? (quote ? 'Pricing verified' : 'Save quote') : 'Need responses'"
        />
      </div>

      <div v-if="rfqReadiness.missingVerifiedPricingCount" class="warning-note">
        {{ rfqReadiness.missingVerifiedPricingCount }} line{{ rfqReadiness.missingVerifiedPricingCount === 1 ? '' : 's' }} still need vendor quote number and verified unit cost{{ quote ? '.' : ' before PO generation.' }}
      </div>
      <p v-if="rfqStatus" class="status-note">{{ rfqStatus }}</p>
    </section>

    <form class="quote-entry-grid" @submit.prevent="addLine">
      <section class="quote-line-form">
        <label class="form-field">
          <span>Part Number</span>
          <input
            v-model="lineForm.partNumber"
            list="part-number-suggestions"
            required
            placeholder="Type part number for catalog pricing"
            @input="scheduleCatalogLookup(lineForm.partNumber)"
          />
          <datalist id="part-number-suggestions">
            <option
              v-for="record in partSuggestions"
              :key="record.id"
              :value="record.partNumber"
            >
              {{ record.description }} - {{ record.vendor }} - {{ currency(record.unitCost) }}
            </option>
            <option
              v-for="suggestion in oemSuggestions"
              :key="`${suggestion.vendor}-${suggestion.oem}`"
              :value="suggestion.oem"
            >
              {{ suggestion.vendor }} - {{ suggestion.products }}
            </option>
          </datalist>
          <small v-if="catalogStatus" class="field-help">{{ catalogStatus }}</small>
          <VerifiedCatalogPricing
            :part-number="lineForm.partNumber"
            :manufacturer="lineForm.manufacturer"
            :quantity="quantity"
            @apply="applyVerifiedCatalogPrice"
          />
          <button
            class="secondary-action inline-pricing-lookup"
            type="button"
            :disabled="!lineForm.partNumber.trim() || pricingVerificationLoading"
            @click="verifyEntryPricing"
          >
            {{ pricingVerificationLoading ? 'Checking TD SYNNEX...' : unitCost > 0 ? 'Verify with TD SYNNEX' : 'Get TD SYNNEX Pricing' }}
          </button>
        </label>
        <FormField v-model="lineForm.manufacturer" label="Manufacturer" placeholder="Enter manufacturer" />
        <label class="form-field">
          <span>Vendor / Source</span>
          <select v-model="lineForm.vendor">
            <option value="">Select vendor</option>
            <option v-for="vendor in getVendorOptions(lineForm.vendor)" :key="vendor" :value="vendor">{{ vendor }}</option>
          </select>
        </label>
        <FormField v-model.number="quantity" label="Quantity" placeholder="1" type="number" min="1" required />
        <FormField v-model.number="unitCost" label="Unit Cost" placeholder="0.00" type="number" min="0" step="0.01" required />

        <template v-if="showPricingControls">
          <label class="form-field">
            <span>Markup %</span>
            <input v-model.number="markupPercent" type="number" min="0" step="0.01" placeholder="15" />
          </label>
        </template>
        <div v-else class="pricing-info span-2">
          Design &amp; Install project: line pricing uses verified vendor cost only. Markup controls are hidden.
        </div>

        <FormField v-model="lineForm.quoteNumber" label="Vendor Quote Number" placeholder="Optional" />
        <FormField v-model="lineForm.supplierPartNumber" label="Supplier Part Number" placeholder="Auto-filled from catalog" />
        <FormField v-model="lineForm.leadTime" label="Lead Time" placeholder="Example: 14 days" />
        <label class="form-field span-2">
          <span>Description</span>
          <textarea v-model="lineForm.description" required placeholder="Enter customer-facing line item description" />
        </label>

        <div class="span-2">
          <button class="primary-action" type="submit">
            <Plus :size="17" />
            <span>{{ quote ? 'Add Line' : 'Add Line to Quote' }}</span>
          </button>
        </div>
      </section>

      <aside class="line-preview-panel">
        <h2>Line Preview</h2>
        <div class="preview-row"><span>Sell Price</span><strong>{{ currency(previewTotals.sellPrice) }}</strong></div>
        <div class="preview-row"><span>Extended Cost</span><strong>{{ currency(previewTotals.extendedCost) }}</strong></div>
        <div class="preview-row"><span>Extended Sell</span><strong>{{ currency(previewTotals.extendedSellPrice) }}</strong></div>
        <template v-if="showPricingControls">
          <div class="preview-row"><span>Gross Profit</span><strong>{{ currency(previewTotals.grossProfit) }}</strong></div>
        </template>
      </aside>
    </form>

    <section class="quote-draft-panel">
      <div class="quote-draft-heading">
        <div>
          <h2>{{ quote ? 'Quote Lines' : 'Quote Draft Lines' }}</h2>
          <p>{{ quote ? 'Modify any line item field, remove lines, or add new ones before saving changes.' : 'Modify any line item field before saving the quote.' }}</p>
        </div>
        <div class="page-actions">
          <button class="primary-action" type="button" :disabled="!draftLines.length || isSavingQuote" @click="saveQuote">
            <Save :size="17" />
            <span>{{ isSavingQuote ? 'Saving...' : quote ? 'Save Changes' : 'Save Quote' }}</span>
          </button>
          <button class="secondary-action" type="button" :disabled="!draftLines.length" @click="exportRfqPackage">
            <FileSpreadsheet :size="17" />
            <span>Vendor RFQ Workbooks</span>
          </button>
        </div>
      </div>
      <QuoteLinesEditor
        :lines="draftLines"
        :empty-message="quote ? 'This quote has no lines.' : 'No lines in this quote yet.'"
        :show-pricing-controls="showPricingControls"
        :show-only-pricing-issues="showOnlyPricingIssues"
        @change="draftLines = $event"
        @verify="verifyQuotePricing($event)"
      />
    </section>
  </div>

  <div v-else-if="loaded" class="not-found-page">
    <h1>{{ isEditMode ? 'Quote not found' : 'Project not found' }}</h1>
    <RouterLink class="text-link" :to="isEditMode ? `/projects/${String(route.params.id)}` : '/projects'">
      {{ isEditMode ? 'Back to Project' : 'Back to Projects' }}
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BadgeDollarSign, CheckCircle2, Download, FileSpreadsheet, FileUp, Plus, Save, Send, Trash2, Upload, XCircle } from '@lucide/vue'
import FormField from '../components/FormField.vue'
import MelImportReview from '../components/MelImportReview.vue'
import QuoteLinesEditor from '../components/QuoteLinesEditor.vue'
import QuoteSummaryTile from '../components/QuoteSummaryTile.vue'
import RfqStep from '../components/RfqStep.vue'
import VerifiedCatalogPricing from '../components/VerifiedCatalogPricing.vue'
import { calculateLineTotals, calculateQuoteSummaryWithContractFee, currency, type PricingMode } from '../services/calculations'
import { applyPricingToAllLines } from '../services/bulkPricing.mjs'
import { createQuoteForProjectStrict, deleteQuoteForProject, loadProject, setQuoteApprovalStatus, updateQuoteForProjectStrict } from '../services/localProjects'
import { applyManufacturerUpdateFile } from '../services/manufacturerImport'
import { findLatestPartPrice, findPartPriceSuggestions } from '../services/partCatalog'
import { suggestCatalogProducts, type CatalogProduct, type VerifiedCatalogPrice } from '../services/productCatalogApi'
import { exportCustomerQuotePdf } from '../services/pdfExports'
import { analyzeMelImportFile, melItemToQuoteLine, parseQuoteImportFile } from '../services/quoteImport'
import type { MelAnalysis, MelItem } from '../services/melIngestion.mjs'
import { applyVendorRfqResponseFile } from '../services/vendorRfqResponses'
import { getOemSuggestions, recommendVendorForPart } from '../services/vendorIntelligence'
import { getVendorOptions } from '../services/vendors'
import { exportCustomerQuoteWorkbook, exportVendorRfqPackage } from '../services/workbookExports'
import { fetchSession, getEffectiveRole } from '../services/auth'
import { applyVerifiedPricing, previewPricing, pricingVerificationSummary, quoteLinePricingStatus, type PricingVerificationResult } from '../services/pricingVerification'
import type { CustomerQuote, Project, QuoteLine } from '../types'

type ExpirationDays = 30 | 60 | 90

const route = useRoute()
const router = useRouter()
const project = ref<Project>()
const quote = ref<CustomerQuote>()
const loaded = ref(false)
const pricingMode = ref<PricingMode>('markup')
const quantity = ref(1)
const unitCost = ref(0)
const markupPercent = ref(15)
const bulkPricingMode = ref<PricingMode>('margin')
const bulkPricingPercent = ref(20)
const bulkPricingStatus = ref('')
const draftLines = ref<QuoteLine[]>([])
const quoteName = ref('')
const expirationDays = ref<ExpirationDays>(30)
const contractFeeEnabled = ref(false)
const shippingCost = ref(0)
const importStatus = ref('')
const melImportAnalysis = ref<MelAnalysis>()
const manufacturerImportStatus = ref('')
const rfqStatus = ref('')
const isExportingPdf = ref(false)
const routeQuoteId = computed(() => String(route.params.quoteId ?? route.params.quoteNumber ?? ''))
const isEditMode = computed(() => Boolean(routeQuoteId.value))
const catalogStatus = ref('')
const remotePartSuggestions = ref<CatalogProduct[]>([])
const isSavingQuote = ref(false)
const saveQuoteError = ref('')
const pricingReview = ref<PricingVerificationResult[]>([])
const selectedVerificationIds = ref<string[]>([])
const pricingVerificationLoading = ref(false)
const pricingVerificationError = ref('')
const showOnlyPricingIssues = ref(false)
const pricingReviewPanel = ref<HTMLElement>()
const newLineId = ref(crypto.randomUUID())
const newLinePricing = reactive<{ pricingStatus: QuoteLine['pricingStatus']; pricingSource?: string; pricingVerifiedAt?: string; catalogProductId?: string | null; catalogCost?: number | null }>({ pricingStatus: 'Unverified' })
let catalogLookupTimer: ReturnType<typeof setTimeout> | undefined
let tdPricingLookupTimer: ReturnType<typeof setTimeout> | undefined
let tdPricingRequestId = 0
const tdPricingCache = new Map<string, PricingVerificationResult[]>()

const lineForm = reactive({
  partNumber: '',
  manufacturer: '',
  description: '',
  vendor: '',
  supplierPartNumber: '',
  quoteNumber: '',
  leadTime: '',
})

const showPricingControls = computed(() => project.value?.projectType !== 'Design & Install')
const nextClin = computed(() => String(draftLines.value.length + 1))
const partSuggestions = computed(() => {
  const local = findPartPriceSuggestions(lineForm.partNumber)
  const remote = remotePartSuggestions.value.map(product => ({
    id: product.id,
    partNumber: product.manufacturer_part_number,
    manufacturer: product.manufacturer,
    description: product.description,
    vendor: product.supplier,
    unitCost: product.current_cost ?? 0,
    poNumber: 'Product Catalog',
  }))
  const seen = new Set<string>()
  return [...remote, ...local].filter(item => {
    const key = `${item.manufacturer}:${item.partNumber}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
})
const oemSuggestions = computed(() => getOemSuggestions(lineForm.partNumber))
const summary = computed(() => calculateQuoteSummaryWithContractFee(draftLines.value, contractFeeEnabled.value, shippingCost.value))
const pricingSummary = computed(() => pricingVerificationSummary(draftLines.value))
const canUpdateCatalog = computed(() => getEffectiveRole(fetchSession()) === 'Admin')
const previewLine = computed(() =>
  ({ ...buildDraftLine({
    clin: nextClin.value,
    partNumber: lineForm.partNumber,
    manufacturer: lineForm.manufacturer,
    description: lineForm.description,
    quantity: quantity.value,
    unitCost: unitCost.value,
    pricingMode: showPricingControls.value ? pricingMode.value : 'markup',
    markupPercent: showPricingControls.value ? markupPercent.value : 0,
    marginPercent: 0,
    vendor: lineForm.vendor,
    supplierPartNumber: lineForm.supplierPartNumber,
    quoteNumber: lineForm.quoteNumber,
    leadTime: lineForm.leadTime,
    ...newLinePricing,
  }), id: newLineId.value }),
)
const previewTotals = computed(() => calculateLineTotals(previewLine.value))
const rfqReadiness = computed(() => {
  const totalLines = draftLines.value.length
  const assignedVendorCount = draftLines.value.filter(line => line.vendor.trim()).length
  const verifiedPricingCount = draftLines.value.filter(line => line.quoteNumber.trim() && line.unitCost > 0).length

  return {
    totalLines,
    assignedVendorCount,
    missingVendorCount: totalLines - assignedVendorCount,
    verifiedPricingCount,
    missingVerifiedPricingCount: totalLines - verifiedPricingCount,
    readyForCustomerQuote: totalLines > 0 && assignedVendorCount === totalLines && verifiedPricingCount === totalLines,
  }
})

onMounted(() => {
  loadQuoteDraft(true)
  window.addEventListener('cronos:projects-changed', reloadQuoteDraftAfterSync)
})

onUnmounted(() => {
  if (catalogLookupTimer) clearTimeout(catalogLookupTimer)
  if (tdPricingLookupTimer) clearTimeout(tdPricingLookupTimer)
  window.removeEventListener('cronos:projects-changed', reloadQuoteDraftAfterSync)
})

function loadQuoteDraft(force = false) {
  const loadedProject = loadProject(String(route.params.id))
  const loadedQuote = loadedProject?.quotes.find(item => item.id === routeQuoteId.value || item.quoteNumber === routeQuoteId.value)
  project.value = loadedProject
  quote.value = loadedQuote

  if (loadedQuote) {
    const editableLines = getEditableQuoteLines(loadedQuote, loadedProject)
    quoteName.value = loadedQuote.quoteName ?? ''
    if (force || (!draftLines.value.length && editableLines.length)) {
      draftLines.value = normalizePricingForProject(applySequentialClins(editableLines), loadedProject?.projectType !== 'Design & Install')
    }
    expirationDays.value = loadedQuote.expirationDays ?? 30
    contractFeeEnabled.value = loadedQuote.contractFeeEnabled ?? false
    shippingCost.value = loadedQuote.shippingCost ?? 0
  }

  loaded.value = true
}

function reloadQuoteDraftAfterSync() {
  loadQuoteDraft(false)
}

function addLine() {
  draftLines.value = applySequentialClins([...draftLines.value, previewLine.value])
  resetLineForm()
}

function applyBulkPricing() {
  try {
    draftLines.value = applyPricingToAllLines(draftLines.value, bulkPricingMode.value, bulkPricingPercent.value)
    bulkPricingStatus.value = `Applied ${bulkPricingPercent.value}% ${bulkPricingMode.value} to ${draftLines.value.length} line${draftLines.value.length === 1 ? '' : 's'}.`
  } catch (error) {
    bulkPricingStatus.value = error instanceof Error ? error.message : 'Unable to apply pricing to all lines.'
  }
}

async function verifyQuotePricing(lineId?: string) {
  const lines = lineId ? draftLines.value.filter(line => line.id === lineId) : draftLines.value.filter(line => quoteLinePricingStatus(line) !== 'Verified')
  if (!lines.length || pricingVerificationLoading.value) return
  pricingVerificationLoading.value = true; pricingVerificationError.value = ''
  try {
    const response = await previewPricing(lines)
    pricingReview.value = response.results
    selectedVerificationIds.value = response.results.filter(item => item.distributorCost !== null && ['Verified', 'Price Changed'].includes(item.status)).map(item => item.lineId)
    await nextTick(); pricingReviewPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (error) {
    pricingVerificationError.value = error instanceof Error ? error.message : 'TD SYNNEX pricing is temporarily unavailable.'
  } finally { pricingVerificationLoading.value = false }
}

async function verifyEntryPricing() {
  await runEntryPricingLookup({ scrollToReview: true, force: true })
}

function scheduleAutomaticTdLookup(partNumber: string) {
  if (tdPricingLookupTimer) clearTimeout(tdPricingLookupTimer)
  tdPricingRequestId += 1
  if (partNumber.trim().length < 4) return
  tdPricingLookupTimer = setTimeout(() => void runEntryPricingLookup({ scrollToReview: false, force: false }), 800)
}

async function runEntryPricingLookup({ scrollToReview, force }: { scrollToReview: boolean; force: boolean }) {
  if (!lineForm.partNumber.trim()) return
  const cacheKey = `${lineForm.manufacturer.trim().toLowerCase()}::${lineForm.partNumber.trim().toLowerCase()}`
  const cached = force ? undefined : tdPricingCache.get(cacheKey)
  if (cached) { showEntryPricingResults(cached.map(item => ({ ...item, lineId: newLineId.value, currentQuoteCost: unitCost.value })), scrollToReview); return }
  const requestId = ++tdPricingRequestId
  pricingVerificationLoading.value = true; pricingVerificationError.value = ''
  try {
    const response = await previewPricing([previewLine.value])
    if (requestId !== tdPricingRequestId) return
    tdPricingCache.set(cacheKey, response.results)
    showEntryPricingResults(response.results, scrollToReview)
  } catch (error) {
    if (requestId === tdPricingRequestId) pricingVerificationError.value = error instanceof Error ? error.message : 'TD SYNNEX pricing is temporarily unavailable.'
  } finally { if (requestId === tdPricingRequestId) pricingVerificationLoading.value = false }
}

function showEntryPricingResults(results: PricingVerificationResult[], scrollToReview: boolean) {
  pricingReview.value = results
  selectedVerificationIds.value = results.filter(item => item.distributorCost !== null && ['Verified', 'Price Changed'].includes(item.status)).map(item => item.lineId)
  const pricedResult = results.find(item => item.distributorCost !== null && ['Verified', 'Price Changed'].includes(item.status))
  if (pricedResult) {
    lineForm.vendor = pricedResult.source || 'TD SYNNEX'
    catalogStatus.value = `TD SYNNEX pricing found: ${currency(pricedResult.distributorCost || 0)} with ${pricedResult.availableQuantity ?? 'unknown'} available. The pricing review is ready for approval.`
  } else if (results.some(item => item.status === 'Product Not Found')) {
    catalogStatus.value = 'This manufacturer part number was not found at TD SYNNEX.'
  }
  if (scrollToReview) void nextTick(() => pricingReviewPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

async function applyPricingReview(updateCatalog: boolean) {
  const selected = new Set(selectedVerificationIds.value)
  const lines = draftLines.value.filter(line => selected.has(line.id))
  if (selected.has(newLineId.value)) lines.push(previewLine.value)
  if (!lines.length || pricingVerificationLoading.value) return
  pricingVerificationLoading.value = true; pricingVerificationError.value = ''
  try {
    const response = await applyVerifiedPricing(lines, { quoteId: quote.value?.id, updateCatalog })
    const results = new Map(response.results.map(item => [item.lineId, item]))
    const actor = fetchSession()?.name || fetchSession()?.email || 'Atlas user'
    draftLines.value = draftLines.value.map(line => {
      const result = results.get(line.id)
      if (!result || result.distributorCost === null || !result.verifiedAt) return line
      return { ...line, unitCost: result.distributorCost, vendor: result.source || line.vendor, pricingStatus: 'Verified' as const, pricingSource: result.source, pricingVerifiedAt: result.verifiedAt, catalogProductId: result.catalogProductId, catalogCost: updateCatalog ? result.distributorCost : result.catalogCost, pricingVerificationHistory: [...(line.pricingVerificationHistory || []), { id: crypto.randomUUID(), quoteId: quote.value?.id || null, quoteLineId: line.id, partNumber: line.partNumber, previousCost: line.unitCost, verifiedCost: result.distributorCost, pricingSource: result.source, verifiedAt: result.verifiedAt, appliedBy: actor, catalogUpdated: updateCatalog }] }
    })
    const entryResult = results.get(newLineId.value)
    if (entryResult?.distributorCost !== null && entryResult?.distributorCost !== undefined && entryResult.verifiedAt) {
      unitCost.value = entryResult.distributorCost
      lineForm.vendor = entryResult.source || lineForm.vendor
      newLinePricing.pricingStatus = 'Verified'
      newLinePricing.pricingSource = entryResult.source
      newLinePricing.pricingVerifiedAt = entryResult.verifiedAt
      newLinePricing.catalogProductId = entryResult.catalogProductId
      newLinePricing.catalogCost = updateCatalog ? entryResult.distributorCost : entryResult.catalogCost
    }
    pricingReview.value = []; selectedVerificationIds.value = []
  } catch (error) {
    pricingVerificationError.value = error instanceof Error ? error.message : 'Pricing could not be applied. Existing quote pricing was preserved.'
  } finally { pricingVerificationLoading.value = false }
}

function cancelPricingReview() { pricingReview.value = []; selectedVerificationIds.value = [] }
function moneyOrDash(value: number | null) { return value === null ? '—' : currency(value) }
function deltaLabel(delta: number | null, percent: number | null) { return delta === null ? '—' : `${delta >= 0 ? '+' : ''}${currency(delta)}${percent === null ? '' : ` (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`}` }

function applyCatalogPart(partNumber: string) {
  const remote = remotePartSuggestions.value.find(item => item.manufacturer_part_number.trim().toLowerCase() === partNumber.trim().toLowerCase())
  if (remote) {
    lineForm.manufacturer = remote.manufacturer
    lineForm.description = remote.description
    lineForm.vendor = remote.supplier
    lineForm.supplierPartNumber = remote.supplier_part_number
    lineForm.leadTime = remote.lead_time
    catalogStatus.value = `Exact Product Catalog match: ${remote.manufacturer} ${remote.manufacturer_part_number}. Select a verified pricing record below to apply its cost.`
    return
  }
  const match = findLatestPartPrice(partNumber)
  if (!match) {
    const inferredVendor = recommendVendorForPart(partNumber, lineForm.manufacturer, lineForm.description)
    lineForm.vendor ||= inferredVendor
    catalogStatus.value = partNumber.trim()
      ? inferredVendor
        ? `Vendor inferred from OEM/product mapping: ${inferredVendor}.`
        : 'No catalog match found yet. Keep typing for suggestions.'
      : ''
    return
  }

  lineForm.manufacturer = match.manufacturer || lineForm.manufacturer
  lineForm.description = match.description || lineForm.description
  lineForm.vendor = match.vendor || lineForm.vendor
  catalogStatus.value = `Local purchase-history match found for ${match.partNumber}. Unit cost was not changed; only verified catalog pricing can be applied below.`
}

function applyVerifiedCatalogPrice(price: VerifiedCatalogPrice) {
  if (!price.applicable || price.display_status !== 'Verified') return
  unitCost.value = Number(price.new_cost)
  lineForm.vendor = price.vendor || lineForm.vendor
  lineForm.manufacturer = price.manufacturer || lineForm.manufacturer
  newLinePricing.pricingStatus = 'Verified'
  newLinePricing.pricingSource = price.vendor || 'Atlas Catalog'
  newLinePricing.pricingVerifiedAt = price.verified_at || new Date().toISOString()
  newLinePricing.catalogProductId = price.product_id
  newLinePricing.catalogCost = Number(price.new_cost)
  catalogStatus.value = `Applied verified catalog unit cost ${currency(price.new_cost)} from ${price.vendor || 'the selected pricing record'}.`
}

function scheduleCatalogLookup(value: string) {
  newLinePricing.pricingStatus = 'Unverified'; newLinePricing.pricingSource = undefined; newLinePricing.pricingVerifiedAt = undefined; newLinePricing.catalogProductId = null; newLinePricing.catalogCost = null
  applyCatalogPart(value)
  if (catalogLookupTimer) clearTimeout(catalogLookupTimer)
  scheduleAutomaticTdLookup(value)
  if (value.trim().length < 2) { remotePartSuggestions.value = []; return }
  catalogLookupTimer = setTimeout(async () => {
    try {
      remotePartSuggestions.value = await suggestCatalogProducts(value, 10)
      applyCatalogPart(value)
    } catch {
      remotePartSuggestions.value = []
    }
  }, 220)
}

async function saveQuote() {
  if (!draftLines.value.length || !project.value || isSavingQuote.value) return

  isSavingQuote.value = true
  saveQuoteError.value = ''

  try {
    const normalizedLines = normalizePricingForProject(applySequentialClins(draftLines.value), showPricingControls.value)
    if (quote.value) {
      const updatedQuote = await updateQuoteForProjectStrict(project.value.id, quote.value.id, normalizedLines, {
        contractFeeEnabled: contractFeeEnabled.value,
        expirationDays: expirationDays.value,
        quoteName: quoteName.value,
        shippingCost: shippingCost.value,
      })
      router.push(`/projects/${project.value.id}?quote=${encodeURIComponent(updatedQuote.quoteNumber)}`)
      return
    }

    const newQuoteLines = normalizedLines.map(({ id: _id, approved: _approved, ...line }) => line)
    const createdQuote = await createQuoteForProjectStrict(project.value.id, newQuoteLines, {
      contractFeeEnabled: contractFeeEnabled.value,
      expirationDays: expirationDays.value,
      quoteName: quoteName.value,
      shippingCost: shippingCost.value,
    })

    router.push(`/projects/${project.value.id}?quote=${encodeURIComponent(createdQuote.quoteNumber)}`)
  } catch (error) {
    saveQuoteError.value = error instanceof Error ? error.message : 'Quote could not be saved.'
  } finally {
    isSavingQuote.value = false
  }
}

function toggleApproval() {
  if (!project.value || !quote.value) return

  const approved = quote.value.status !== 'Customer Approved'
  const result = setQuoteApprovalStatus(project.value.id, quote.value.id, approved)
  project.value = result.project
  quote.value = result.quote
}

function removeQuote() {
  if (!project.value || !quote.value) return
  const linkedPoCount = project.value.purchaseOrders.filter(po => po.quoteId === quote.value?.id).length
  const linkedPoWarning = linkedPoCount
    ? ` This will also delete ${linkedPoCount} linked purchase order${linkedPoCount === 1 ? '' : 's'}.`
    : ''
  if (!window.confirm(`Delete quote ${quote.value.quoteNumber}?${linkedPoWarning} This action cannot be undone.`)) return

  try {
    deleteQuoteForProject(project.value.id, quote.value.id)
    void router.push(`/projects/${project.value.id}`)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to delete the quote.')
  }
}

async function exportPdf() {
  if (!quote.value || isExportingPdf.value) return

  isExportingPdf.value = true
  rfqStatus.value = 'Generating quote PDF...'
  try {
    const exported = await exportCustomerQuotePdf({ ...quote.value, lines: draftLines.value }, project.value)
    rfqStatus.value = exported
      ? `${quote.value.quoteNumber} PDF exported.`
      : 'PDF not exported. Add the project shipping address, save the project, and try again.'
  } catch (error) {
    rfqStatus.value = error instanceof Error
      ? `PDF could not be generated: ${error.message}`
      : 'PDF could not be generated. Refresh the page and try again.'
  } finally {
    isExportingPdf.value = false
  }
}

async function exportExcel() {
  if (!quote.value) return

  await exportCustomerQuoteWorkbook({ ...quote.value, lines: draftLines.value }, project.value)
  rfqStatus.value = `${quote.value.quoteNumber} Excel quote exported.`
}

async function exportRfqPackage() {
  if (!draftLines.value.length || !project.value) return

  const preparedLines = applySequentialClins(draftLines.value)
  draftLines.value = preparedLines
  const exportedCount = await exportVendorRfqPackage(project.value, preparedLines)
  rfqStatus.value = `${exportedCount} vendor RFQ workbook${exportedCount === 1 ? '' : 's'} exported. Send each vendor their matching Cronos RFQ workbook, then import completed responses here.`
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    importStatus.value = ''
    return
  }

  try {
    importStatus.value = `Analyzing ${file.name}...`
    if (/\.pdf$/i.test(file.name)) {
      const importedLines = await parseQuoteImportFile(file)
      const materialLines = importedLines.map(line => buildDraftLine({ ...line, pricingMode: showPricingControls.value ? line.pricingMode ?? 'markup' : 'markup', markupPercent: showPricingControls.value ? line.markupPercent : 0, marginPercent: 0 }))
      draftLines.value = normalizePricingForProject(applySequentialClins([...draftLines.value, ...materialLines]), showPricingControls.value)
      importStatus.value = `Added ${materialLines.length} PDF line item(s). Spreadsheet imports provide the full review workflow.`
      return
    }
    const analysis = await analyzeMelImportFile(file)
    await matchMelItemsToCatalog(analysis.items)
    const includedItems = analysis.items.filter(item => item.included)
    if (includedItems.length && !analysis.needsManualMapping) {
      approveMelImport(includedItems)
      return
    }

    melImportAnalysis.value = analysis
    importStatus.value = includedItems.length
      ? `${analysis.diagnostics} Review the detected rows below, confirm the column mapping, then select Import to Quote.`
      : `${analysis.diagnostics} No importable rows were found. Review the column mapping below.`
  } catch (error) {
    importStatus.value = error instanceof Error ? error.message : 'Could not import this file.'
  }
}

async function matchMelItemsToCatalog(items: MelItem[]) {
  const uniqueParts = [...new Set(items.map(item => item.partNumber.trim()).filter(Boolean))]
  const matches = new Map<string, CatalogProduct[]>()
  for (let index = 0; index < uniqueParts.length; index += 5) {
    await Promise.all(uniqueParts.slice(index, index + 5).map(async partNumber => {
      try { matches.set(partNumber.toLowerCase(), await suggestCatalogProducts(partNumber, 10)) } catch { matches.set(partNumber.toLowerCase(), []) }
    }))
  }
  for (const item of items) {
    const exact = (matches.get(item.partNumber.toLowerCase()) || []).filter(product => product.manufacturer_part_number.trim().toLowerCase() === item.partNumber.trim().toLowerCase())
    const manufacturerExact = item.manufacturer ? exact.filter(product => product.manufacturer.trim().toLowerCase() === item.manufacturer.trim().toLowerCase()) : exact
    const candidates = manufacturerExact.length ? manufacturerExact : exact
    item.catalogMatch = candidates.length === 1 ? 'Catalog Match' : candidates.length > 1 ? 'Multiple Matches' : 'No Catalog Match'
    item.catalogProductId = candidates.length === 1 ? candidates[0].id : null
    if (!item.manufacturer && candidates.length === 1) { item.manufacturer = candidates[0].manufacturer; item.manufacturerSuggested = true; item.confidence.manufacturer = Math.max(item.confidence.manufacturer, 0.75) }
  }
}

function approveMelImport(items: MelItem[]) {
  const importedBy = fetchSession()?.name || fetchSession()?.email || 'Atlas user'
  const materialLines = items.map(item => {
    const line = melItemToQuoteLine(item)
    if (line.melImport) line.melImport.importedBy = importedBy
    return buildDraftLine({ ...line, clin: line.clin || String(draftLines.value.length + 1), pricingMode: showPricingControls.value ? line.pricingMode ?? 'markup' : 'markup', markupPercent: showPricingControls.value ? line.markupPercent : 0, marginPercent: 0 })
  })
  draftLines.value = normalizePricingForProject(applySequentialClins([...draftLines.value, ...materialLines]), showPricingControls.value)
  importStatus.value = `Imported ${materialLines.length} reviewed MEL line item${materialLines.length === 1 ? '' : 's'} into the quote draft.`
  melImportAnalysis.value = undefined
}

function cancelMelImport() { melImportAnalysis.value = undefined; importStatus.value = 'MEL import cancelled. No quote lines were changed.' }

async function handleRfqImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    rfqStatus.value = ''
    return
  }

  try {
    const result = await applyVendorRfqResponseFile(file, draftLines.value)
    draftLines.value = normalizePricingForProject(applySequentialClins(result.updatedLines), showPricingControls.value)
    rfqStatus.value = `Updated ${result.updatedCount} line${result.updatedCount === 1 ? '' : 's'} with vendor pricing. ${result.unmatchedCount} response line${result.unmatchedCount === 1 ? '' : 's'} did not match ${quote.value ? 'this quote' : 'the current draft'}.`
  } catch (error) {
    rfqStatus.value = error instanceof Error ? error.message : 'Could not import vendor RFQ response.'
  }
}

async function handleManufacturerImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    manufacturerImportStatus.value = ''
    return
  }

  try {
    manufacturerImportStatus.value = `Reading ${file.name}...`
    const result = await applyManufacturerUpdateFile(file, draftLines.value)
    draftLines.value = result.updatedLines
    manufacturerImportStatus.value = result.updatedCount
      ? `Updated ${result.updatedCount} manufacturer${result.updatedCount === 1 ? '' : 's'}. ${result.unchangedCount} unchanged, ${result.skippedCount} blank or N/A, and ${result.unmatchedCount} unmatched. Review the lines, then click Save Changes.`
      : `No manufacturers were updated. ${result.unchangedCount} unchanged, ${result.skippedCount} blank or N/A, and ${result.unmatchedCount} unmatched.`
  } catch (error) {
    manufacturerImportStatus.value = error instanceof Error ? error.message : 'Could not import manufacturer updates.'
  } finally {
    input.value = ''
  }
}

function buildDraftLine(input: Omit<QuoteLine, 'id' | 'approved'>): QuoteLine {
  return {
    ...input,
    id: crypto.randomUUID(),
    quantity: Number.isFinite(input.quantity) ? input.quantity : 0,
    unitCost: Number.isFinite(input.unitCost) ? input.unitCost : 0,
    approved: false,
  }
}

function applySequentialClins(lines: QuoteLine[]) {
  return lines.map((line, index) => ({
    ...line,
    clin: String(index + 1),
  }))
}

function normalizePricingForProject(lines: QuoteLine[], controlsVisible: boolean) {
  if (controlsVisible) return lines

  return lines.map(line => ({
    ...line,
    pricingMode: 'markup' as const,
    markupPercent: 0,
    marginPercent: 0,
  }))
}

function getEditableQuoteLines(loadedQuote: CustomerQuote, loadedProject?: Project) {
  if (loadedQuote.lines?.length) return loadedQuote.lines

  const relatedPoLines = (loadedProject?.purchaseOrders ?? [])
    .filter(po => po.quoteId === loadedQuote.id)
    .flatMap(po => po.lines.map(line => ({
      id: stripPoLineId(line.id),
      clin: line.clin,
      partNumber: line.partNumber,
      manufacturer: line.manufacturer || '',
      description: line.description,
      quantity: line.quantityOrdered,
      unitCost: line.unitCost,
      pricingMode: 'markup' as const,
      markupPercent: 0,
      marginPercent: 0,
      vendor: po.vendor,
      quoteNumber: '',
      leadTime: line.estimatedShipDate || '',
      approved: loadedQuote.status === 'Customer Approved',
    })))

  return relatedPoLines
}

function stripPoLineId(id: string) {
  return id.startsWith('po-') ? id.slice(3) : id
}

function resetLineForm() {
  tdPricingRequestId += 1
  if (tdPricingLookupTimer) clearTimeout(tdPricingLookupTimer)
  lineForm.partNumber = ''
  lineForm.manufacturer = ''
  lineForm.description = ''
  lineForm.vendor = ''
  lineForm.supplierPartNumber = ''
  lineForm.quoteNumber = ''
  lineForm.leadTime = ''
  catalogStatus.value = ''
  remotePartSuggestions.value = []
  quantity.value = 1
  unitCost.value = 0
  newLineId.value = crypto.randomUUID()
  newLinePricing.pricingStatus = 'Unverified'; newLinePricing.pricingSource = undefined; newLinePricing.pricingVerifiedAt = undefined; newLinePricing.catalogProductId = null; newLinePricing.catalogCost = null
}
</script>
