<template>
  <div class="vendors-page">
    <header class="page-heading">
      <div>
        <h1>Vendors</h1>
        <p>Cronos vendor directory with contact details, OEM coverage, and product categories.</p>
      </div>
      <div class="page-actions">
        <button class="secondary-action" type="button" @click="downloadTemplate">
          <FileSpreadsheet :size="17" />
          <span>Download Vendor Template</span>
        </button>
        <button class="secondary-action" type="button" @click="exportVendors">
          <Download :size="17" />
          <span>Export Vendors</span>
        </button>
        <button v-if="canImport" class="secondary-action" type="button" @click="vendorImportInput?.click()">
          <Upload :size="17" />
          <span>Import Vendors</span>
        </button>
        <input ref="vendorImportInput" class="hidden-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="handleVendorImport" />
        <button class="primary-action" type="button" @click="saveDirectory">
          <Save :size="17" />
          <span>Save Directory</span>
        </button>
      </div>
    </header>

    <div v-if="saveMessage" class="save-message">{{ saveMessage }}</div>

    <section v-if="importPreview" class="vendor-import-preview">
      <div>
        <h2>Vendor Import Preview</h2>
        <p>{{ importPreview.filename }}</p>
      </div>
      <div class="summary-grid">
        <div class="summary-card"><p>Vendors Updated</p><strong>{{ importPreview.updated.length }}</strong></div>
        <div class="summary-card"><p>New Vendors</p><strong>{{ importPreview.added.length }}</strong></div>
        <div class="summary-card"><p>Duplicate Records</p><strong>{{ importPreview.duplicates.length }}</strong></div>
        <div class="summary-card"><p>Validation Errors</p><strong>{{ importPreview.errors.length }}</strong></div>
      </div>
      <label class="toggle-line">
        <input v-model="allowBlankOverwrite" type="checkbox" />
        <span>Allow blanks to overwrite existing data</span>
      </label>
      <div class="page-actions">
        <button class="primary-action" type="button" :disabled="importPreview.errors.length > 0" @click="confirmImport">Confirm Import</button>
        <button v-if="importPreview.errors.length" class="secondary-action" type="button" @click="downloadErrors">Download Error Report</button>
        <button class="secondary-action" type="button" @click="cancelImport">Cancel Import</button>
      </div>
      <details v-if="importPreview.errors.length">
        <summary>Validation Errors</summary>
        <ul>
          <li v-for="error in importPreview.errors" :key="`${error.rowNumber}-${error.column}-${error.problem}`">
            Row {{ error.rowNumber }} - {{ error.column }}: {{ error.problem }}
          </li>
        </ul>
      </details>
    </section>

    <section v-if="lastImportLog" class="save-message">
      Import Complete: {{ lastImportLog.updated }} vendors updated, {{ lastImportLog.added }} added, {{ lastImportLog.failed }} errors.
      <button class="inline-link-button table-link" type="button" @click="downloadImportLog">Download Import Log</button>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <p>Total Vendors</p>
        <strong>{{ vendors.length }}</strong>
      </div>
      <div class="summary-card">
        <p>Contacts Entered</p>
        <strong>{{ contactsEntered }}</strong>
      </div>
      <div class="summary-card">
        <p>Preferred Vendors</p>
        <strong>{{ preferredCount }}</strong>
      </div>
    </section>

    <section class="vendor-search-card">
      <div>
        <h2>Vendor Contact Directory</h2>
        <p>Search by vendor, contact, OEM, product line, phone, email, or account number.</p>
      </div>
      <label class="vendor-search">
        <Search :size="17" />
        <input v-model="search" placeholder="Search vendors..." />
      </label>
    </section>

    <section class="vendor-add-card">
      <div>
        <h2>Add Vendor</h2>
        <p>New vendors are saved to the directory and appear in quote vendor/source dropdowns.</p>
      </div>

      <div class="vendor-add-grid">
        <VendorField v-model="newVendor.vendor" label="Vendor Name" placeholder="Vendor company name" required />
        <VendorField v-model="newVendor.primaryContact" label="Primary Contact" placeholder="Rep name" />
        <VendorField v-model="newVendor.email" label="Email" placeholder="email@vendor.com" type="email" />
        <VendorField v-model="newVendor.phone" label="Phone" placeholder="Phone" type="tel" />
        <VendorField v-model="newVendor.website" label="Website" placeholder="https://vendor.com" />
        <VendorField v-model="newVendor.accountNumber" label="Account #" placeholder="Cronos account number" />
        <VendorField v-model="newVendor.addressLine1" label="Address" placeholder="Street address" />
        <VendorField v-model="newVendor.city" label="City" placeholder="City" />
        <VendorField v-model="newVendor.state" label="State" placeholder="State" />
        <VendorField v-model="newVendor.zipCode" label="ZIP Code" placeholder="ZIP code" />
        <VendorField v-model="newVendor.country" label="Country" placeholder="US" />
        <VendorField v-model="newVendor.paymentTerms" label="Payment Terms" placeholder="Net 30" />
        <VendorField v-model="newVendor.taxId" label="Tax / Supplier ID" placeholder="Tax ID" />
        <VendorField v-model="newVendor.oems" label="OEMs" placeholder="Comma-separated OEMs" />
        <VendorField v-model="newVendor.products" label="Products" placeholder="Comma-separated product lines" />
        <label class="vendor-field span-3">
          <span>Notes</span>
          <textarea v-model="newVendor.notes" placeholder="Terms, ordering instructions, contract notes..." />
        </label>
      </div>

      <button class="primary-action" type="button" :disabled="creatingVendor" @click="addVendor">
        <Plus :size="17" />
        <span>{{ creatingVendor ? 'Adding Vendor…' : 'Add Vendor' }}</span>
      </button>
    </section>

    <section class="vendor-table-card">
      <div class="table-scroll">
        <table class="vendor-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Status</th>
              <th>Primary Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Website</th>
              <th>Account #</th>
              <th>OEMs / Products</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vendor in filteredVendors" :key="vendor.vendor">
              <td>
                <p class="vendor-name">{{ vendor.vendor }}</p>
                <p class="vendor-subtitle">{{ vendor.products.slice(0, 2).join(', ') || 'Vendor profile' }}</p>
              </td>
              <td>
                <select class="vendor-cell-input w-28" :value="vendor.status" @change="updateVendor(vendor.vendor, { status: inputValue($event) as VendorStatus })">
                  <option value="Active">Active</option>
                  <option value="Preferred">Preferred</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </td>
              <td>
                <input class="vendor-cell-input w-40" :value="vendor.primaryContact" placeholder="Rep name" @input="updateVendor(vendor.vendor, { primaryContact: inputValue($event) })" />
              </td>
              <td>
                <div class="contact-cell">
                  <label>
                    <Mail :size="13" />
                    <input :value="vendor.email" type="email" placeholder="email@vendor.com" @input="updateVendor(vendor.vendor, { email: inputValue($event) })" />
                  </label>
                  <a v-if="vendor.email" :href="`mailto:${vendor.email}`">Email</a>
                </div>
              </td>
              <td>
                <div class="contact-cell">
                  <label>
                    <Phone :size="13" />
                    <input :value="vendor.phone" type="tel" placeholder="Phone" @input="updateVendor(vendor.vendor, { phone: inputValue($event) })" />
                  </label>
                  <a v-if="vendor.phone" :href="`tel:${vendor.phone}`">Call</a>
                </div>
              </td>
              <td>
                <div class="website-cell">
                  <input class="vendor-cell-input w-40" :value="vendor.website" placeholder="Website" @input="updateVendor(vendor.vendor, { website: inputValue($event) })" />
                  <a v-if="vendor.website" :href="vendor.website" target="_blank" rel="noreferrer">
                    <span>Open</span>
                    <ExternalLink :size="12" />
                  </a>
                </div>
              </td>
              <td>
                <input class="vendor-cell-input w-40" :value="vendor.accountNumber" placeholder="Account #" @input="updateVendor(vendor.vendor, { accountNumber: inputValue($event) })" />
              </td>
              <td class="vendor-oems">
                <p>{{ vendor.oems.slice(0, 8).join(', ') || 'OEMs not mapped' }}</p>
                <span>{{ vendor.products.join(', ') || 'Products not mapped' }}</span>
              </td>
              <td>
                <textarea
                  class="vendor-notes"
                  :value="vendor.notes"
                  placeholder="Terms, rep notes, ordering instructions..."
                  @input="updateVendor(vendor.vendor, { notes: inputValue($event) })"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Download, ExternalLink, FileSpreadsheet, Mail, Phone, Plus, Save, Search, Upload } from '@lucide/vue'
import VendorField from '../components/VendorField.vue'
import { fetchSession, normalizeRole } from '../services/auth'
import {
  confirmVendorImport,
  exportVendorImportErrors,
  exportVendorImportLog,
  exportVendorWorkbook,
  loadVendorImportLogs,
  previewVendorImport,
  type VendorImportLog,
  type VendorImportPreview,
} from '../services/vendorBulk'
import {
  cacheVendorDirectory,
  createEmptyVendorRecord,
  loadVendorDirectory,
  saveVendorDirectory,
  type VendorDirectoryRecord,
  type VendorStatus,
} from '../services/vendorDirectory'
import { createVendorRecord } from '../services/atlasDataApi'

const emptyNewVendor = {
  vendor: '',
  primaryContact: '',
  email: '',
  phone: '',
  website: '',
  accountNumber: '',
  addressLine1: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'US',
  paymentTerms: '',
  taxId: '',
  oems: '',
  products: '',
  notes: '',
}

const vendors = ref<VendorDirectoryRecord[]>(loadVendorDirectory())
const search = ref('')
const saveMessage = ref('')
const newVendor = reactive({ ...emptyNewVendor })
const vendorImportInput = ref<HTMLInputElement | null>(null)
const importPreview = ref<VendorImportPreview | null>(null)
const allowBlankOverwrite = ref(false)
const lastImportLog = ref<VendorImportLog | null>(null)
const creatingVendor = ref(false)
const session = computed(() => fetchSession())
const canImport = computed(() => ['admin', 'procurement'].includes(normalizeRole(session.value?.role)))

const filteredVendors = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return vendors.value

  return vendors.value.filter(vendor =>
    [
      vendor.vendor,
      vendor.status,
      vendor.website,
      vendor.primaryContact,
      vendor.email,
      vendor.phone,
      vendor.accountNumber,
      vendor.notes,
      vendor.oems.join(' '),
      vendor.products.join(' '),
    ]
      .join(' ')
      .toLowerCase()
      .includes(term),
  )
})

const contactsEntered = computed(() => vendors.value.filter(vendor => vendor.primaryContact || vendor.email || vendor.phone).length)
const preferredCount = computed(() => vendors.value.filter(vendor => vendor.status === 'Preferred').length)

function updateVendor(vendorName: string, updates: Partial<VendorDirectoryRecord>) {
  vendors.value = vendors.value.map(vendor => (vendor.vendor === vendorName ? { ...vendor, ...updates } : vendor))
  saveMessage.value = ''
}

function saveDirectory() {
  vendors.value = saveVendorDirectory(vendors.value)
  saveMessage.value = 'Vendor directory saved.'
}

async function addVendor() {
  if (creatingVendor.value) return
  const vendorName = newVendor.vendor.trim()
  if (!vendorName) {
    window.alert('Vendor name is required.')
    return
  }

  const record: VendorDirectoryRecord = {
    ...createEmptyVendorRecord(vendorName),
    primaryContact: newVendor.primaryContact.trim(),
    email: newVendor.email.trim(),
    phone: newVendor.phone.trim(),
    website: newVendor.website.trim(),
    accountNumber: newVendor.accountNumber.trim(),
    addressLine1: newVendor.addressLine1.trim(),
    city: newVendor.city.trim(),
    state: newVendor.state.trim(),
    zipCode: newVendor.zipCode.trim(),
    country: newVendor.country.trim(),
    paymentTerms: newVendor.paymentTerms.trim(),
    taxId: newVendor.taxId.trim(),
    oems: splitList(newVendor.oems),
    products: splitList(newVendor.products),
    notes: newVendor.notes.trim(),
  }
  const localDuplicate = vendors.value.find(vendor => vendor.vendor.trim().toLowerCase() === vendorName.toLowerCase())
  let duplicateOverride = false
  if (localDuplicate) {
    duplicateOverride = window.confirm(`${localDuplicate.vendor} may already exist. Create a separate vendor after reviewing this match?`)
    if (!duplicateOverride) return
  }
  try {
    creatingVendor.value = true
    let result
    try {
      result = await createVendorRecord<VendorDirectoryRecord>(record, duplicateOverride)
    } catch (error) {
      const apiError = error as Error & { status?: number; possibleDuplicate?: { legal_name?: string } }
      if (apiError.status !== 409) throw error
      const possibleName = apiError.possibleDuplicate?.legal_name || vendorName
      if (!window.confirm(`${possibleName} may already exist. Create a separate vendor after reviewing this match?`)) return
      result = await createVendorRecord<VendorDirectoryRecord>(record, true)
    }
    vendors.value = cacheVendorDirectory([...vendors.value, result.vendor])
    Object.assign(newVendor, emptyNewVendor)
    saveMessage.value = result.message
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to add vendor.')
  } finally {
    creatingVendor.value = false
  }
}

async function exportVendors() {
  await exportVendorWorkbook(session.value ?? undefined)
}

async function downloadTemplate() {
  await exportVendorWorkbook(session.value ?? undefined, true)
}

async function handleVendorImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    importPreview.value = await previewVendorImport(file)
    saveMessage.value = 'Review the import preview before confirming.'
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to import this vendor workbook.')
  } finally {
    if (vendorImportInput.value) vendorImportInput.value.value = ''
  }
}

function confirmImport() {
  if (!importPreview.value) return
  lastImportLog.value = confirmVendorImport(importPreview.value, { allowBlankOverwrite: allowBlankOverwrite.value, user: session.value ?? undefined })
  vendors.value = loadVendorDirectory()
  importPreview.value = null
  saveMessage.value = 'Vendor import complete.'
}

function cancelImport() {
  importPreview.value = null
  saveMessage.value = 'Vendor import cancelled. No changes were saved.'
}

async function downloadErrors() {
  if (!importPreview.value) return
  await exportVendorImportErrors(importPreview.value.errors)
}

async function downloadImportLog() {
  await exportVendorImportLog(loadVendorImportLogs())
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function splitList(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}
</script>
