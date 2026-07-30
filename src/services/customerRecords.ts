import type { CustomerAddressRecord, CustomerAddressSnapshot, CustomerAddressType, CustomerRecord, Project } from '../types'
import { hydrateLocalCollection, readLocalCollection } from './remoteRecords'
import { replacePilotCollection } from './atlasDataApi'
import { structuredCustomerFromProject } from './customerFormatting'

const CUSTOMER_STORAGE_KEY = 'cronos.customers'
const ADDRESS_STORAGE_KEY = 'cronos.customerAddresses'
const CUSTOMER_REMOTE_TYPE = 'customers'
const ADDRESS_REMOTE_TYPE = 'customer_addresses'
const REMOTE_KEY = 'all'
let hydrationStarted = false

export type CustomerSuggestion = {
  customer: CustomerRecord
  primaryAddress?: CustomerAddressRecord
  label: string
  detail: string
}

export function hydrateCustomers() {
  if (hydrationStarted || typeof window === 'undefined') return
  hydrationStarted = true
  void hydrateLocalCollection<CustomerRecord>(CUSTOMER_STORAGE_KEY, CUSTOMER_REMOTE_TYPE, REMOTE_KEY, {
    eventName: 'cronos:customers-changed',
    normalize: customers => customers.map(normalizeCustomerRecord),
  })
  void hydrateLocalCollection<CustomerAddressRecord>(ADDRESS_STORAGE_KEY, ADDRESS_REMOTE_TYPE, REMOTE_KEY, {
    eventName: 'cronos:customers-changed',
    normalize: addresses => addresses.map(normalizeAddressRecord),
  })
}

export function loadCustomers() {
  hydrateCustomers()
  return readLocalCollection<CustomerRecord>(CUSTOMER_STORAGE_KEY).map(normalizeCustomerRecord)
}

export function loadCustomerAddresses(customerId?: string) {
  hydrateCustomers()
  const addresses = readLocalCollection<CustomerAddressRecord>(ADDRESS_STORAGE_KEY).map(normalizeAddressRecord)
  return customerId ? addresses.filter(address => address.customerId === customerId && address.active) : addresses
}

export function syncCustomersFromProjects(projects: Project[]) {
  const customers = loadCustomers()
  const addresses = loadCustomerAddresses()
  let nextCustomers = [...customers]
  let nextAddresses = [...addresses]
  let changed = false

  projects.forEach(project => {
    const company = project.customer.trim()
    if (!company) return
    let customer = nextCustomers.find(record => normalizeCompany(record.legalCompanyName) === normalizeCompany(company))
    const now = new Date().toISOString()
    if (!customer) {
      customer = normalizeCustomerRecord({
        id: project.customerId || crypto.randomUUID(),
        legalCompanyName: company,
        displayName: company,
        customerNumber: project.customerNumber ?? '',
        primaryContact: project.customerContactName,
        primaryEmail: project.customerEmail,
        primaryPhone: project.customerPhone,
        website: project.customerWebsite ?? '',
        active: true,
        createdAt: now,
        updatedAt: now,
        useCount: 0,
        lastUsedAt: '',
      })
      nextCustomers.push(customer)
      changed = true
    }

    const hasAddress = project.customerAddress1 || project.customerCity || project.customerZip
    const duplicate = hasAddress ? nextAddresses.find(address =>
      address.customerId === customer.id &&
      normalizeAddress(address.streetAddress1) === normalizeAddress(project.customerAddress1) &&
      normalizeSearch(address.city) === normalizeSearch(project.customerCity) &&
      normalizeSearch(address.zipCode) === normalizeSearch(project.customerZip),
    ) : undefined
    if (hasAddress && !duplicate) {
      nextAddresses.push(normalizeAddressRecord({
        id: project.customerAddressId || crypto.randomUUID(),
        customerId: customer.id,
        label: 'Project Site',
        type: 'Project Site',
        contactName: project.customerContactName,
        streetAddress1: project.customerAddress1,
        streetAddress2: project.customerAddress2,
        city: project.customerCity,
        state: project.customerState,
        zipCode: project.customerZip,
        country: project.customerCountry,
        email: project.customerEmail,
        phone: project.customerPhone,
        isPrimary: !nextAddresses.some(address => address.customerId === customer.id && address.isPrimary),
        active: true,
        createdAt: now,
        updatedAt: now,
        useCount: 0,
        lastUsedAt: '',
      }))
      changed = true
    }
  })

  if (changed) {
    saveCustomers(nextCustomers)
    saveAddresses(nextAddresses)
  }
}

export function searchCustomerSuggestions(query: string, limit = 10): CustomerSuggestion[] {
  const normalizedQuery = normalizeSearch(query)
  const customers = loadCustomers().filter(customer => customer.active)
  const addresses = loadCustomerAddresses()
  const scored = customers
    .map(customer => {
      const customerAddresses = addresses.filter(address => address.customerId === customer.id)
      const primaryAddress = choosePrimaryAddress(customerAddresses)
      const haystack = [
        customer.legalCompanyName,
        customer.displayName,
        customer.customerNumber,
        customer.primaryContact,
        customer.primaryEmail,
        primaryAddress?.contactName,
        primaryAddress?.city,
        primaryAddress?.state,
        primaryAddress?.streetAddress1,
      ].join(' ')
      const score = normalizedQuery ? (normalizeSearch(haystack).includes(normalizedQuery) ? 10 : 0) : 1 + customer.useCount
      return { customer, primaryAddress, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.customer.lastUsedAt || '') - Date.parse(a.customer.lastUsedAt || ''))
    .slice(0, limit)

  return scored.map(({ customer, primaryAddress }) => ({
    customer,
    primaryAddress,
    label: customer.displayName || customer.legalCompanyName,
    detail: [primaryAddress ? `${primaryAddress.city}, ${primaryAddress.state}` : '', customer.primaryContact ? `Primary Contact: ${customer.primaryContact}` : '']
      .filter(Boolean)
      .join(' | '),
  }))
}

export function rankAddressSuggestions(customerId: string, limit = 8) {
  return loadCustomerAddresses(customerId)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Date.parse(b.lastUsedAt || '') - Date.parse(a.lastUsedAt || '') || b.useCount - a.useCount)
    .slice(0, limit)
}

export function findCustomerById(id?: string) {
  if (!id) return undefined
  return loadCustomers().find(customer => customer.id === id)
}

export function findAddressById(id?: string) {
  if (!id) return undefined
  return loadCustomerAddresses().find(address => address.id === id)
}

export function createCustomerFromProject(project: Project, addressType: CustomerAddressType = 'Main Office') {
  const now = new Date().toISOString()
  const duplicate = findLikelyDuplicateCustomer(project)
  const customer = duplicate ?? normalizeCustomerRecord({
    id: crypto.randomUUID(),
    legalCompanyName: project.customer,
    displayName: project.customer,
    customerNumber: project.customerNumber ?? '',
    primaryContact: project.customerContactName,
    primaryEmail: project.customerEmail,
    primaryPhone: project.customerPhone,
    website: project.customerWebsite ?? '',
    active: true,
    createdAt: now,
    updatedAt: now,
    useCount: 0,
    lastUsedAt: '',
  })
  if (!duplicate) saveCustomers([...loadCustomers(), customer])

  const address = upsertAddressForProject(customer.id, project, addressType)
  return { customer, address }
}

export function upsertAddressForProject(customerId: string, project: Project, type: CustomerAddressType = 'Project Site') {
  const addresses = loadCustomerAddresses()
  const now = new Date().toISOString()
  const existing = findDuplicateAddress(customerId, project)
  if (existing) return existing
  const address = normalizeAddressRecord({
    id: crypto.randomUUID(),
    customerId,
    label: type,
    type,
    contactName: project.customerContactName,
    streetAddress1: project.customerAddress1,
    streetAddress2: project.customerAddress2,
    city: project.customerCity,
    state: project.customerState,
    zipCode: project.customerZip,
    country: project.customerCountry,
    email: project.customerEmail,
    phone: project.customerPhone,
    isPrimary: !addresses.some(item => item.customerId === customerId && item.isPrimary),
    active: true,
    createdAt: now,
    updatedAt: now,
    useCount: 0,
    lastUsedAt: '',
  })
  saveAddresses([...addresses, address])
  return address
}

export function rememberCustomerUse(customerId: string, addressId?: string) {
  const now = new Date().toISOString()
  saveCustomers(loadCustomers().map(customer => (customer.id === customerId ? { ...customer, useCount: customer.useCount + 1, lastUsedAt: now, updatedAt: now } : customer)))
  if (addressId) {
    saveAddresses(loadCustomerAddresses().map(address => (address.id === addressId ? { ...address, useCount: address.useCount + 1, lastUsedAt: now, updatedAt: now } : address)))
  }
}

export function snapshotFromCustomerAddress(customer: CustomerRecord | undefined, address: CustomerAddressRecord | undefined, project?: Project): CustomerAddressSnapshot {
  const structured = structuredCustomerFromProject(project, customer?.displayName || customer?.legalCompanyName || '')
  return {
    companyName: customer?.displayName || customer?.legalCompanyName || structured.companyName,
    contactName: address?.contactName || customer?.primaryContact || structured.attention,
    streetAddress1: address?.streetAddress1 || structured.streetAddress1,
    streetAddress2: address?.streetAddress2 || structured.streetAddress2,
    city: address?.city || structured.city,
    state: address?.state || structured.state,
    zipCode: address?.zipCode || structured.zipCode,
    country: address?.country || structured.country,
    email: address?.email || customer?.primaryEmail || structured.email,
    phone: address?.phone || customer?.primaryPhone || structured.phone,
    customerNumber: customer?.customerNumber || structured.customerNumber,
    website: customer?.website || structured.website,
    capturedAt: new Date().toISOString(),
  }
}

export function applyCustomerAddressToProjectInput<T extends Partial<Project>>(input: T, customer: CustomerRecord, address?: CustomerAddressRecord): T {
  return {
    ...input,
    customerId: customer.id,
    customerAddressId: address?.id ?? '',
    customer: customer.displayName || customer.legalCompanyName,
    customerContactName: address?.contactName || customer.primaryContact,
    customerAddress1: address?.streetAddress1 ?? '',
    customerAddress2: address?.streetAddress2 ?? '',
    customerCity: address?.city ?? '',
    customerState: address?.state ?? '',
    customerZip: address?.zipCode ?? '',
    customerCountry: address?.country ?? '',
    customerEmail: address?.email || customer.primaryEmail,
    customerPhone: address?.phone || customer.primaryPhone,
    customerNumber: customer.customerNumber,
    customerWebsite: customer.website,
    customerSnapshot: snapshotFromCustomerAddress(customer, address),
  }
}

export function findLikelyDuplicateCustomer(project: Project) {
  const companyKey = normalizeCompany(project.customer)
  const emailDomain = project.customerEmail.split('@')[1]?.toLowerCase() ?? ''
  const phoneKey = normalizePhone(project.customerPhone)
  return loadCustomers().find(customer =>
    normalizeCompany(customer.legalCompanyName) === companyKey ||
    (emailDomain && customer.primaryEmail.toLowerCase().endsWith(`@${emailDomain}`)) ||
    (phoneKey && normalizePhone(customer.primaryPhone) === phoneKey),
  )
}

export function findDuplicateAddress(customerId: string, project: Project) {
  const streetKey = normalizeAddress(project.customerAddress1)
  const cityKey = normalizeSearch(project.customerCity)
  const zipKey = normalizeSearch(project.customerZip)
  return loadCustomerAddresses(customerId).find(address =>
    normalizeAddress(address.streetAddress1) === streetKey &&
    normalizeSearch(address.city) === cityKey &&
    normalizeSearch(address.zipCode) === zipKey,
  )
}

function choosePrimaryAddress(addresses: CustomerAddressRecord[]) {
  return addresses.find(address => address.isPrimary) ?? addresses[0]
}

function normalizeCustomerRecord(customer: CustomerRecord): CustomerRecord {
  return {
    ...customer,
    displayName: customer.displayName || customer.legalCompanyName,
    customerNumber: customer.customerNumber ?? '',
    primaryContact: customer.primaryContact ?? '',
    primaryEmail: customer.primaryEmail ?? '',
    primaryPhone: customer.primaryPhone ?? '',
    website: customer.website ?? '',
    active: customer.active ?? true,
    useCount: Number(customer.useCount || 0),
    createdAt: customer.createdAt || new Date().toISOString(),
    updatedAt: customer.updatedAt || new Date().toISOString(),
    lastUsedAt: customer.lastUsedAt ?? '',
  }
}

function normalizeAddressRecord(address: CustomerAddressRecord): CustomerAddressRecord {
  return {
    ...address,
    label: address.label || address.type || 'Main Office',
    type: address.type || 'Main Office',
    contactName: address.contactName ?? '',
    streetAddress1: address.streetAddress1 ?? '',
    streetAddress2: address.streetAddress2 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zipCode: address.zipCode ?? '',
    country: address.country ?? '',
    email: address.email ?? '',
    phone: address.phone ?? '',
    isPrimary: address.isPrimary ?? false,
    active: address.active ?? true,
    useCount: Number(address.useCount || 0),
    createdAt: address.createdAt || new Date().toISOString(),
    updatedAt: address.updatedAt || new Date().toISOString(),
    lastUsedAt: address.lastUsedAt ?? '',
  }
}

function saveCustomers(customers: CustomerRecord[]) {
  const normalized = customers.map(normalizeCustomerRecord)
  window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event('cronos:customers-changed'))
  void replacePilotCollection('customers', normalized).catch(reportPilotSyncError)
}

function saveAddresses(addresses: CustomerAddressRecord[]) {
  const normalized = addresses.map(normalizeAddressRecord)
  window.localStorage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event('cronos:customers-changed'))
  void replacePilotCollection('customer-addresses', normalized).catch(reportPilotSyncError)
}

function reportPilotSyncError(error: unknown) {
  window.dispatchEvent(new CustomEvent('cronos:remote-sync-error', {
    detail: error instanceof Error ? error.message : 'Atlas data API sync failed.',
  }))
}

function normalizeSearch(value: string) {
  return String(value ?? '').toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeCompany(value: string) {
  return normalizeSearch(value).replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, '').trim()
}

function normalizeAddress(value: string) {
  return normalizeSearch(value)
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bst\.\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bsuite\b/g, 'ste')
    .replace(/\bste\.\b/g, 'ste')
}

function normalizePhone(value: string) {
  return String(value ?? '').replace(/\D/g, '')
}
