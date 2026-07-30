import { randomUUID } from 'node:crypto'
const TABLES = { customers: 'atlas_customers', 'customer-addresses': 'atlas_customer_addresses', vendors: 'atlas_vendors' }
export class SupabasePilotRepository {
  constructor(client) { this.client = client }
  async createVendor(record, actor, duplicateOverride = false) {
    const vendorName = String(record.vendor || '').trim()
    if (!vendorName) throw new DataValidationError('Vendor name is required.', 400)
    if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      throw new DataValidationError('Primary contact email is invalid.', 400)
    }
    const duplicate = await this.client.from('atlas_vendors')
      .select('id,legal_name,vendor_number').ilike('legal_name', vendorName).is('deleted_at', null).maybeSingle()
    if (duplicate.error) throw duplicate.error
    if (duplicate.data && !duplicateOverride) {
      throw new DataValidationError(`Possible duplicate vendor: ${duplicate.data.legal_name}`, 409, {
        possibleDuplicate: duplicate.data,
      })
    }
    const id = record.id || randomUUID()
    const now = new Date().toISOString()
    const normalized = {
      ...record, id, vendor: vendorName, vendorId: record.vendorId || `V-${id.slice(0, 8).toUpperCase()}`,
      createdDate: now, lastUpdated: now, createdBy: actor.name || actor.username || actor.email,
      createdByUserId: actor.id, lastModifiedBy: actor.id, lastModifiedAt: now,
    }
    const row = mapRecord('vendors', normalized, actor.id)
    const inserted = await this.client.from('atlas_vendors').insert(row).select('*').single()
    if (inserted.error) throw inserted.error
    await this.client.from('atlas_audit_events').insert({
      action: 'vendor.created', entity_type: 'vendor', entity_id: id, actor_user_id: actor.id,
      actor_username: actor.username || actor.name || actor.email,
      metadata: { vendorName, duplicateOverride: Boolean(duplicateOverride) },
    })
    if (duplicateOverride) {
      await this.client.from('atlas_audit_events').insert({
        action: 'vendor.duplicate_warning_overridden', entity_type: 'vendor', entity_id: id,
        actor_user_id: actor.id, actor_username: actor.username || actor.name || actor.email,
        metadata: { vendorName, possibleDuplicateId: duplicate.data?.id || null },
      })
    }
    return normalized
  }
  async replaceCollection(collection, records, actorId) {
    const table = TABLES[collection]
    if (!table) throw new Error('Unsupported collection')
    const rows = records.map(record => mapRecord(collection, record, actorId))
    const { data: existing, error: readError } = await this.client.from(table).select('id').is('deleted_at', null)
    if (readError) throw readError
    const incoming = new Set(rows.map(row => row.id))
    const removed = (existing || []).map(row => row.id).filter(id => !incoming.has(id))
    if (removed.length) {
      const { error } = await this.client.from(table).update({
        deleted_at: new Date().toISOString(), deleted_by: actorId, updated_by: actorId,
      }).in('id', removed)
      if (error) throw error
    }
    if (rows.length) {
      const { error } = await this.client.from(table).upsert(rows, { onConflict: 'id' })
      if (error) throw error
    }
    return { count: rows.length, softDeleted: removed.length }
  }
  async reconcile(collection) {
    const table = TABLES[collection]
    if (!table) throw new Error('Unsupported collection')
    const { data, error } = await this.client.from(table).select('*').is('deleted_at', null)
    if (error) throw error
    const rows = data || []
    const keys = new Map()
    for (const row of rows) {
      const key = collection === 'customers' ? row.customer_number : collection === 'vendors' ? row.vendor_number : null
      if (key) keys.set(key, (keys.get(key) || 0) + 1)
    }
    return {
      collection, recordCount: rows.length, missingIds: rows.filter(row => !row.id).length,
      duplicateBusinessKeys: [...keys].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count })),
      orphanedRelationships: collection === 'customer-addresses' ? await this.countOrphanAddresses() : 0,
      financialTotal: null, missingDocumentReferences: null,
    }
  }
  async countOrphanAddresses() {
    const { data, error } = await this.client.from('atlas_customer_addresses').select('customer_id,atlas_customers!left(id)').is('deleted_at', null)
    if (error) throw error
    return (data || []).filter(row => !row.atlas_customers).length
  }
  async exportCollection(collection) {
    const { data, error } = await this.client.from(TABLES[collection]).select('*').order('created_at')
    if (error) throw error
    return data || []
  }
}
function base(record, actorId) {
  const now = new Date().toISOString()
  return {
    id: record.id || record.vendorId, source_system: 'atlas_legacy', source_id: record.vendorId || record.id,
    created_at: record.createdAt || record.createdDate || now, created_by: actorId,
    updated_at: now, updated_by: actorId, version: Number(record.version || 1), deleted_at: null, deleted_by: null,
  }
}
function mapRecord(collection, record, actorId) {
  const common = base(record, actorId)
  if (collection === 'customers') return {
    ...common, customer_number: record.customerNumber || null, legal_name: record.legalCompanyName,
    display_name: record.displayName, primary_contact_name: record.primaryContact || null,
    primary_email: record.primaryEmail || null, primary_phone: record.primaryPhone || null,
    website: record.website || null, status: record.active === false ? 'inactive' : 'active',
  }
  if (collection === 'customer-addresses') return {
    ...common, customer_id: record.customerId, label: record.label, address_type: snake(record.type),
    contact_name: record.contactName || null, address_line_1: record.streetAddress1 || null,
    address_line_2: record.streetAddress2 || null, city: record.city || null, state_province: record.state || null,
    postal_code: record.zipCode || null, country_code: record.country || 'US', email: record.email || null,
    phone: record.phone || null, is_primary: Boolean(record.isPrimary), status: record.active === false ? 'inactive' : 'active',
  }
  return {
    ...common, vendor_number: record.vendorId, legal_name: record.vendor, dba_name: record.dbaName || null,
    website: record.website || null, status: record.status === 'Inactive' ? 'inactive' : 'active',
    is_preferred: Boolean(record.preferredVendor || record.status === 'Preferred'), cage_code: record.cageCode || null,
    uei: record.uei || null, duns: record.duns || null, tax_id: record.taxId || null,
    payment_terms: record.paymentTerms || null, account_number: record.accountNumber || null,
    notes: record.notes || null, legacy_payload: record,
  }
}
function snake(value) { return String(value || 'other').trim().toLowerCase().replace(/\s+/g, '_') }
export class DataValidationError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}
