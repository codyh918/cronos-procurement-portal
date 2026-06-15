<template>
  <div class="vendors-page">
    <header class="page-heading">
      <div>
        <h1>Vendors</h1>
        <p>Cronos vendor directory with contact details, OEM coverage, and product categories.</p>
      </div>
      <button class="primary-action" type="button" @click="saveDirectory">
        <Save :size="17" />
        <span>Save Directory</span>
      </button>
    </header>

    <div v-if="saveMessage" class="save-message">{{ saveMessage }}</div>

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
        <VendorField v-model="newVendor.oems" label="OEMs" placeholder="Comma-separated OEMs" />
        <VendorField v-model="newVendor.products" label="Products" placeholder="Comma-separated product lines" />
        <label class="vendor-field span-3">
          <span>Notes</span>
          <textarea v-model="newVendor.notes" placeholder="Terms, ordering instructions, contract notes..." />
        </label>
      </div>

      <button class="primary-action" type="button" @click="addVendor">
        <Plus :size="17" />
        <span>Add Vendor</span>
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
import { ExternalLink, Mail, Phone, Plus, Save, Search } from '@lucide/vue'
import VendorField from '../components/VendorField.vue'
import {
  createEmptyVendorRecord,
  loadVendorDirectory,
  saveVendorDirectory,
  type VendorDirectoryRecord,
  type VendorStatus,
} from '../services/vendorDirectory'

const emptyNewVendor = {
  vendor: '',
  primaryContact: '',
  email: '',
  phone: '',
  website: '',
  accountNumber: '',
  oems: '',
  products: '',
  notes: '',
}

const vendors = ref<VendorDirectoryRecord[]>(loadVendorDirectory())
const search = ref('')
const saveMessage = ref('')
const newVendor = reactive({ ...emptyNewVendor })

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

function addVendor() {
  const vendorName = newVendor.vendor.trim()
  if (!vendorName) {
    window.alert('Vendor name is required.')
    return
  }

  if (vendors.value.some(vendor => vendor.vendor.trim().toLowerCase() === vendorName.toLowerCase())) {
    window.alert(`${vendorName} is already in the vendor directory.`)
    return
  }

  const record: VendorDirectoryRecord = {
    ...createEmptyVendorRecord(vendorName),
    primaryContact: newVendor.primaryContact.trim(),
    email: newVendor.email.trim(),
    phone: newVendor.phone.trim(),
    website: newVendor.website.trim(),
    accountNumber: newVendor.accountNumber.trim(),
    oems: splitList(newVendor.oems),
    products: splitList(newVendor.products),
    notes: newVendor.notes.trim(),
  }
  vendors.value = saveVendorDirectory([...vendors.value, record])
  Object.assign(newVendor, emptyNewVendor)
  saveMessage.value = `${vendorName} added to the vendor directory.`
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
