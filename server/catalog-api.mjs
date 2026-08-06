import { randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import { authenticateSewpRequest, requirePermission } from './sewp-auth.mjs'

const PRODUCT_SELECT = 'id,manufacturer,manufacturer_part_number,description,additional_description,category,subcategory,keywords,budget_unit_price,current_cost,unit_of_measure,supplier,supplier_part_number,fsc,nsn,lead_time,lead_time_days,purchasable,procurement_status,dpas,serial_number_required,taa_compliant,in_stock,screen_size_inches,specifications,source_file,source_row,active,created_at,updated_at'
const SEMANTIC_GROUPS = [
  ['display', 'monitor', 'screen', 'commercial display', 'interactive display'],
  ['codec', 'room kit', 'room bar', 'video conferencing', 'endpoint'],
  ['touchscreen', 'touch panel', 'navigator', 'touchlink', 'control panel'],
  ['amplifier', 'amp', 'audio amplifier'],
  ['microphone', 'mic', 'audio input'],
]

export async function handleCatalogApi({ request, response, pathname, sendJson, readJsonBody, readBufferBody, supabase }) {
  if (!pathname.startsWith('/api/catalog')) return false
  const auth = await authenticateSewpRequest(request, supabase)
  const permission = request.method === 'GET' ? 'atlas.catalog.view' : 'atlas.catalog.manage'
  const allowed = requirePermission(auth, permission)
  if (!allowed.ok) { sendJson(response, allowed.status, { error: allowed.error }); return true }
  if (!supabase) { sendJson(response, 503, { error: 'Catalog persistence is not configured.' }); return true }

  try {
    if (request.method === 'GET' && pathname === '/api/catalog/products') {
      await searchProducts({ request, response, sendJson, supabase })
      return true
    }
    if (request.method === 'GET' && pathname === '/api/catalog/facets') {
      const { data, error } = await supabase.rpc('atlas_catalog_facets')
      if (error) throw error
      sendJson(response, 200, data || { manufacturers: [], categories: [], suppliers: [] })
      return true
    }
    if (request.method === 'GET' && pathname === '/api/catalog/pricing-changes') {
      const url = new URL(request.url, 'http://localhost')
      let query = supabase.from('atlas_product_pricing_history')
        .select('id,product_id,previous_cost,new_cost,effective_date,source_file,change_amount,change_percent,atlas_products(manufacturer,manufacturer_part_number,description)', { count: 'exact' })
        .order('effective_date', { ascending: false })
        .range(0, Math.min(numberParam(url, 'limit', 100), 500) - 1)
      if (url.searchParams.get('batch')) query = query.eq('import_batch', url.searchParams.get('batch'))
      const { data, error, count } = await query
      if (error) throw error
      sendJson(response, 200, { changes: data || [], total: count || 0 })
      return true
    }
    if (request.method === 'GET' && pathname === '/api/catalog/import-batches') {
      const batches = await supabase.from('atlas_catalog_import_batches').select('id,source_file,status,total_rows,new_products,updated_products,imported_at,pricing_verification_status,pricing_verified_at,pricing_expiration_date').order('imported_at', { ascending: false }).limit(25)
      if (batches.error) throw batches.error
      sendJson(response, 200, { batches: batches.data || [] }); return true
    }
    const verifyBatchMatch = pathname.match(/^\/api\/catalog\/import-batches\/([0-9a-f-]+)\/verify$/i)
    if (request.method === 'POST' && verifyBatchMatch) {
      const profile = await activeAdminProfile(supabase, auth.user.id)
      if (!profile) { sendJson(response, 403, { error: 'Administrator access is required.' }); return true }
      const body = await readJsonBody(request); const expirationDate = validFutureDate(body.expirationDate)
      if (!expirationDate) { sendJson(response, 400, { error: 'A future expiration date is required.' }); return true }
      const verifiedAt = new Date().toISOString(); const batchId = verifyBatchMatch[1]
      const pricing = await supabase.from('atlas_product_pricing_history').update({ pricing_status: 'Verified', verified_at: verifiedAt, verified_by: auth.user.id, expiration_date: expirationDate }).eq('import_batch', batchId).select('id,product_id')
      if (pricing.error) throw pricing.error
      if (!pricing.data?.length) { sendJson(response, 409, { error: 'This batch has no pricing records to verify.' }); return true }
      const batch = await supabase.from('atlas_catalog_import_batches').update({ pricing_verification_status: 'Verified', pricing_verified_at: verifiedAt, pricing_verified_by: auth.user.id, pricing_expiration_date: expirationDate }).eq('id', batchId)
      if (batch.error) throw batch.error
      await chunkedInsert(supabase, 'atlas_catalog_audit_events', pricing.data.map(row => ({ product_id: row.product_id, action: 'pricing.batch_verified', actor_user_id: auth.user.id, import_batch: batchId, after_data: { pricing_history_id: row.id, pricing_status: 'Verified', verified_at: verifiedAt, expiration_date: expirationDate } })), false)
      sendJson(response, 200, { batchId, verifiedRecords: pricing.data.length, verifiedAt, expirationDate }); return true
    }
    if (request.method === 'GET' && pathname === '/api/catalog/verified-prices') {
      await findVerifiedPrices({ request, response, sendJson, supabase })
      return true
    }
    const productMatch = pathname.match(/^\/api\/catalog\/products\/([0-9a-f-]+)$/i)
    if (request.method === 'GET' && productMatch) {
      const id = productMatch[1]
      const [product, pricing, audit] = await Promise.all([
        supabase.from('atlas_products').select(PRODUCT_SELECT).eq('id', id).single(),
        supabase.from('atlas_product_pricing_history').select('*').eq('product_id', id).order('effective_date', { ascending: false }).limit(100),
        supabase.from('atlas_catalog_audit_events').select('id,action,occurred_at,metadata').eq('product_id', id).order('occurred_at', { ascending: false }).limit(100),
      ])
      if (product.error) { sendJson(response, 404, { error: 'Product not found.' }); return true }
      const related = await findRelatedProducts(supabase, product.data)
      sendJson(response, 200, { product: product.data, pricingHistory: pricing.data || [], auditTrail: audit.data || [], relatedProducts: related })
      return true
    }
    if (request.method === 'PATCH' && productMatch) {
      const profile = await activeAdminProfile(supabase, auth.user.id)
      if (!profile) { sendJson(response, 403, { error: 'Administrator access is required.' }); return true }
      const before = await supabase.from('atlas_products').select(PRODUCT_SELECT).eq('id', productMatch[1]).single()
      if (before.error) { sendJson(response, 404, { error: 'Product not found.' }); return true }
      const patch = sanitizeProductPatch(await readJsonBody(request))
      if (!Object.keys(patch).length) { sendJson(response, 400, { error: 'No supported changes were provided.' }); return true }
      patch.updated_at = new Date().toISOString(); patch.updated_by = auth.user.id
      const updated = await supabase.from('atlas_products').update(patch).eq('id', productMatch[1]).select(PRODUCT_SELECT).single()
      if (updated.error) throw updated.error
      if (patch.current_cost !== undefined && money(before.data.current_cost) !== money(patch.current_cost)) {
        await supabase.from('atlas_product_pricing_history').insert({ product_id: productMatch[1], previous_cost: before.data.current_cost, new_cost: patch.current_cost, imported_by: auth.user.id, source_file: 'Manual Atlas edit' })
      }
      await supabase.from('atlas_catalog_audit_events').insert({ product_id: productMatch[1], action: 'product.updated', actor_user_id: auth.user.id, before_data: before.data, after_data: updated.data })
      sendJson(response, 200, { product: updated.data })
      return true
    }
    if (request.method === 'POST' && pathname === '/api/catalog/import') {
      const profile = await activeAdminProfile(supabase, auth.user.id)
      if (!profile) { sendJson(response, 403, { error: 'Administrator access is required.' }); return true }
      const url = new URL(request.url, 'http://localhost')
      const filename = safeFilename(url.searchParams.get('filename') || 'catalog.xlsx')
      if (!/\.(xlsx|csv)$/i.test(filename)) { sendJson(response, 400, { error: 'Only XLSX and CSV catalog files are supported.' }); return true }
      const buffer = await readBufferBody(request, 40 * 1024 * 1024)
      const parsed = parseCatalogWorkbook(buffer, filename)
      const verifyPricing = url.searchParams.get('verifyPricing') === 'true'
      const expirationDate = verifyPricing ? validFutureDate(url.searchParams.get('expirationDate')) : null
      if (verifyPricing && !expirationDate) { sendJson(response, 400, { error: 'A future expiration date is required when verifying imported pricing.' }); return true }
      const summary = await importProducts(supabase, parsed, filename, auth.user.id, { verifyPricing, expirationDate })
      sendJson(response, 200, summary)
      return true
    }
    sendJson(response, 404, { error: 'Catalog route not found.' })
  } catch (error) {
    const message = catalogErrorMessage(error)
    console.error('Catalog API failure', { message, error })
    sendJson(response, 500, { error: message })
  }
  return true
}

async function findVerifiedPrices({ request, response, sendJson, supabase }) {
  const url = new URL(request.url, 'http://localhost')
  const partNumber = string(url.searchParams.get('partNumber'))
  const manufacturer = string(url.searchParams.get('manufacturer'))
  const quantity = Math.max(0, numberParam(url, 'quantity', 0))
  if (!partNumber) { sendJson(response, 400, { error: 'Part number is required.' }); return }
  let productQuery = supabase.from('atlas_products').select('id,manufacturer,manufacturer_part_number,description,supplier').ilike('manufacturer_part_number', partNumber).eq('active', true).limit(25)
  if (manufacturer) productQuery = productQuery.ilike('manufacturer', manufacturer)
  const products = await productQuery
  if (products.error) throw products.error
  const exact = (products.data || []).filter(product => string(product.manufacturer_part_number).toLowerCase() === partNumber.toLowerCase() && (!manufacturer || string(product.manufacturer).toLowerCase() === manufacturer.toLowerCase()))
  if (!exact.length) { sendJson(response, 200, { prices: [] }); return }
  const history = await supabase.from('atlas_product_pricing_history').select('id,product_id,new_cost,effective_date,expiration_date,quantity_basis,pricing_status,vendor,verified_at,verified_by,source_file').in('product_id', exact.map(product => product.id)).order('effective_date', { ascending: false })
  if (history.error) throw history.error
  const verifierIds = [...new Set((history.data || []).map(row => row.verified_by).filter(Boolean))]
  const profiles = verifierIds.length ? await supabase.from('atlas_user_profiles').select('auth_user_id,display_name,email').in('auth_user_id', verifierIds) : { data: [], error: null }
  if (profiles.error) throw profiles.error
  const names = new Map((profiles.data || []).map(profile => [profile.auth_user_id, profile.display_name || profile.email]))
  const productsById = new Map(exact.map(product => [product.id, product])); const now = Date.now()
  const prices = (history.data || []).map(row => {
    const product = productsById.get(row.product_id); const expiration = row.expiration_date ? Date.parse(row.expiration_date) : null
    const eligibility = catalogPriceEligibility(row, quantity, now)
    return { ...row, manufacturer: product?.manufacturer || '', manufacturer_part_number: product?.manufacturer_part_number || '', description: product?.description || '', vendor: row.vendor || product?.supplier || '', verified_by_name: row.verified_by ? (names.get(row.verified_by) || 'Verified user') : '', days_remaining: expiration === null ? null : Math.max(0, Math.ceil((expiration - now) / 86400000)), ...eligibility }
  })
  sendJson(response, 200, { prices })
}

export function catalogPriceEligibility(row, quantity, now = Date.now()) {
  const expiration = row.expiration_date ? Date.parse(row.expiration_date) : null
  const expired = expiration !== null && expiration < now
  const quantityEligible = !row.quantity_basis || quantity >= Number(row.quantity_basis)
  const applicable = row.pricing_status === 'Verified' && !expired && quantityEligible
  return { display_status: expired ? 'Expired' : row.pricing_status, applicable, disabled_reason: applicable ? '' : expired ? 'Expired pricing cannot be applied.' : !quantityEligible ? `Minimum quantity is ${row.quantity_basis}.` : `${row.pricing_status} pricing cannot be applied.` }
}

async function searchProducts({ request, response, sendJson, supabase }) {
  const url = new URL(request.url, 'http://localhost')
  const page = Math.max(1, numberParam(url, 'page', 1)); const pageSize = Math.min(100, Math.max(1, numberParam(url, 'pageSize', 25)))
  const queryText = String(url.searchParams.get('q') || '').trim()
  let query = supabase.from('atlas_products').select(PRODUCT_SELECT, { count: 'exact' })
  const terms = semanticTerms(queryText)
  if (terms.length) {
    const filters = terms.flatMap(term => {
      const safe = term.replace(/[,%()]/g, ' ').trim()
      return [`manufacturer.ilike.%${safe}%`, `manufacturer_part_number.ilike.%${safe}%`, `supplier_part_number.ilike.%${safe}%`, `description.ilike.%${safe}%`, `additional_description.ilike.%${safe}%`, `category.ilike.%${safe}%`]
    })
    query = query.or(filters.join(','))
  }
  query = applyFilter(query, url, 'manufacturer', 'manufacturer')
  query = applyFilter(query, url, 'category', 'category')
  query = applyFilter(query, url, 'supplier', 'supplier')
  for (const [param, column] of [['purchasable', 'purchasable'], ['inStock', 'in_stock'], ['taaCompliant', 'taa_compliant'], ['serialRequired', 'serial_number_required'], ['active', 'active']]) {
    const value = booleanParam(url.searchParams.get(param)); if (value !== null) query = query.eq(column, value)
  }
  const min = money(url.searchParams.get('minPrice')); const max = money(url.searchParams.get('maxPrice'))
  if (min !== null) query = query.gte('current_cost', min); if (max !== null) query = query.lte('current_cost', max)
  const leadDays = numberParam(url, 'leadTimeDays', 0); if (leadDays > 0) query = query.lte('lead_time_days', leadDays)
  query = query.order('manufacturer').order('manufacturer_part_number').range((page - 1) * pageSize, page * pageSize - 1)
  const { data, error, count } = await query
  if (error) throw error
  sendJson(response, 200, { products: data || [], total: count || 0, page, pageSize, suggestions: buildSuggestions(queryText, data || []) })
}

async function importProducts(supabase, parsed, filename, actorId, verification = {}) {
  const batchId = randomUUID(); const now = new Date().toISOString()
  const verifiedFields = verification.verifyPricing ? { pricing_verification_status: 'Verified', pricing_verified_at: now, pricing_verified_by: actorId, pricing_expiration_date: verification.expirationDate } : {}
  const batchInsert = await supabase.from('atlas_catalog_import_batches').insert({ id: batchId, source_file: filename, source_type: filename.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx', total_rows: parsed.totalRows, imported_by: actorId, ...verifiedFields })
  if (batchInsert.error) throw new Error(`Could not start catalog import: ${catalogErrorMessage(batchInsert.error)}`)
  const existing = new Map()
  const importKeys = parsed.products.map(item => ({ manufacturer: item.manufacturer, manufacturer_part_number: item.manufacturerPartNumber }))
  for (let index = 0; index < importKeys.length; index += 500) {
    const result = await supabase.rpc('atlas_catalog_match_products', { p_keys: importKeys.slice(index, index + 500) })
    if (result.error) throw new Error(`Could not match existing catalog products: ${catalogErrorMessage(result.error)}`)
    for (const item of result.data || []) existing.set(productKey(item.manufacturer, item.manufacturer_part_number), item)
  }
  const inserts = []; const updates = []; const prices = []; const audits = []
  for (const item of parsed.products) {
    const current = existing.get(productKey(item.manufacturer, item.manufacturer_part_number))
    const row = { ...toDatabaseProduct(item), updated_at: now, updated_by: actorId, last_import_batch: batchId, source_file: filename }
    if (current) {
      row.id = current.id; updates.push(row)
      if (money(item.currentCost) !== null && (verification.verifyPricing || money(current.current_cost) !== money(item.currentCost))) prices.push(priceHistoryRow(current.id, current.current_cost, item, actorId, batchId, filename, now, verification))
      audits.push({ product_id: current.id, action: 'product.import_updated', actor_user_id: actorId, import_batch: batchId, after_data: row })
    } else inserts.push(row)
  }
  // Upsert here as a final database-level guard. A stale/incomplete catalog snapshot
  // must not abort the whole import when the unique manufacturer + part key exists.
  const inserted = await chunkedCatalogUpsert(supabase, inserts)
  await chunkedUpsert(supabase, 'atlas_products', updates, 'id')
  for (const row of inserted) {
    if (money(row.current_cost) !== null) prices.push(priceHistoryRow(row.id, null, { currentCost: row.current_cost, supplier: row.supplier }, actorId, batchId, filename, now, verification))
    audits.push({ product_id: row.id, action: 'product.import_created', actor_user_id: actorId, import_batch: batchId, after_data: row })
  }
  await chunkedInsert(supabase, 'atlas_product_pricing_history', prices, false)
  await chunkedInsert(supabase, 'atlas_catalog_audit_events', audits, false)
  const summary = { batchId, sourceFile: filename, totalRows: parsed.totalRows, newProducts: inserts.length, updatedProducts: updates.length, duplicateRecords: parsed.duplicates, errors: parsed.errors, skippedRows: parsed.skipped, priceChanges: prices.filter(item => item.previous_cost !== null).length }
  await supabase.from('atlas_catalog_import_batches').update({ status: parsed.errors.length ? 'completed_with_errors' : 'completed', new_products: summary.newProducts, updated_products: summary.updatedProducts, duplicate_records: summary.duplicateRecords, error_rows: parsed.errors.length, skipped_rows: summary.skippedRows, price_changes: summary.priceChanges, summary, completed_at: new Date().toISOString() }).eq('id', batchId)
  return summary
}

function priceHistoryRow(productId, previousCost, item, actorId, batchId, filename, now, verification) {
  return { product_id: productId, previous_cost: previousCost, new_cost: item.currentCost, imported_by: actorId, import_batch: batchId, source_file: filename, vendor: item.supplier || '', pricing_status: verification.verifyPricing ? 'Verified' : 'Unverified', verified_at: verification.verifyPricing ? now : null, verified_by: verification.verifyPricing ? actorId : null, expiration_date: verification.verifyPricing ? verification.expirationDate : null }
}

function validFutureDate(value) { const parsed = Date.parse(String(value || '')); return Number.isFinite(parsed) && parsed > Date.now() ? new Date(parsed).toISOString() : null }

export function parseCatalogWorkbook(buffer, filename) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames.includes('BLANK') ? 'BLANK' : workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true })
  if (!rows.length) return { products: [], errors: [], duplicates: 0, skipped: 0, totalRows: 0 }
  const headers = rows[0].map(normalizeHeader); const indexes = headerIndexes(headers)
  let category = ''; let duplicates = 0; let skipped = 0; const errors = []; const products = new Map()
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]; const type = Number(read(row, indexes.recordType)); const description = string(read(row, indexes.description))
    if (type === 1) { category = description; skipped += 1; continue }
    const manufacturer = string(read(row, indexes.manufacturer)); const part = string(read(row, indexes.partNumber))
    if (!manufacturer && !part && !description) { skipped += 1; continue }
    if ([manufacturer, part, description].every(value => value.toUpperCase() === 'END')) { skipped += 1; continue }
    if (!manufacturer || !part) { errors.push({ row: index + 1, error: 'Manufacturer and Part Number are required.' }); continue }
    const item = { manufacturer, manufacturerPartNumber: part, description, additionalDescription: string(read(row, indexes.additionalDescription)), category: string(read(row, indexes.category)) || category, subcategory: string(read(row, indexes.subcategory)), budgetUnitPrice: money(read(row, indexes.budgetPrice)), currentCost: money(read(row, indexes.currentCost)) ?? money(read(row, indexes.budgetPrice)), unitOfMeasure: string(read(row, indexes.unit)), supplier: string(read(row, indexes.supplier)), supplierPartNumber: string(read(row, indexes.supplierPart)), fsc: string(read(row, indexes.fsc)), nsn: string(read(row, indexes.nsn)), leadTime: string(read(row, indexes.leadTime)), purchasable: booleanParam(read(row, indexes.purchasable)), procurementStatus: string(read(row, indexes.procurementStatus)), dpas: string(read(row, indexes.dpas)), serialNumberRequired: booleanParam(read(row, indexes.serialRequired)), taaCompliant: booleanParam(read(row, indexes.taaCompliant)), inStock: booleanParam(read(row, indexes.inStock)), sourceRow: index + 1, active: true }
    const key = productKey(manufacturer, part); if (products.has(key)) duplicates += 1
    products.set(key, item)
  }
  return { products: [...products.values()], errors, duplicates, skipped, totalRows: Math.max(0, rows.length - 1) }
}

function headerIndexes(headers) {
  const aliases = { recordType: ['record type indicator', 'type indicator', 'record type'], manufacturer: ['manufacturer', 'mfr'], partNumber: ['part no', 'part number', 'manufacturer part number', 'mpn'], description: ['p n desc', 'description', 'part description'], additionalDescription: ['add l p n desc', 'additional description'], category: ['category'], subcategory: ['subcategory'], budgetPrice: ['budget unit price'], currentCost: ['current cost', 'unit cost'], unit: ['u i', 'unit of measure', 'uom'], supplier: ['supplier', 'vendor'], supplierPart: ['supplier part no', 'supplier part number'], fsc: ['fsc code', 'fsc'], nsn: ['nsn'], leadTime: ['supplier lead time', 'lead time'], purchasable: ['purchasable'], procurementStatus: ['proc status', 'procurement status'], dpas: ['dpas'], serialRequired: ['require serial', 'serial number required'], taaCompliant: ['taa compliant', 'taa'], inStock: ['in stock', 'stock'] }
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [
    key,
    headers.findIndex(header => values.some(alias => header === alias || header.startsWith(`${alias} `))),
  ]))
}
function normalizeHeader(value) { return string(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function read(row, index) { return index >= 0 ? row[index] : null }
function string(value) { return String(value ?? '').trim() }
function booleanParam(value) { if (value === true || /^(y|yes|true|1)$/i.test(string(value))) return true; if (value === false || /^(n|no|false|0)$/i.test(string(value))) return false; return null }
function money(value) { if (value === null || value === undefined || value === '') return null; const parsed = Number(String(value).replace(/[$,]/g, '')); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null }
function catalogErrorMessage(error) { if (error instanceof Error && error.message) return error.message; if (error && typeof error === 'object') { const parts = [error.message, error.details, error.hint, error.code].filter(Boolean); if (parts.length) return parts.join(' | ') } return String(error || 'Catalog operation failed.') }
function productKey(manufacturer, part) { return `${string(manufacturer).toLowerCase()}::${string(part).toLowerCase()}` }
function screenSize(item) { const match = `${item.description} ${item.category}`.match(/(?:^|\s)(\d{2,3}(?:\.\d+)?)\s*(?:"|inch|in\b)/i); return match ? Number(match[1]) : null }
function leadDays(value) { const text = string(value); const match = text.match(/(\d+)/); if (!match) return null; const count = Number(match[1]); return /week/i.test(text) ? count * 7 : count }
function toDatabaseProduct(item) { return { manufacturer: item.manufacturer, manufacturer_part_number: item.manufacturerPartNumber, description: item.description || '', additional_description: item.additionalDescription || '', category: item.category || '', subcategory: item.subcategory || '', keywords: [], budget_unit_price: item.budgetUnitPrice, current_cost: item.currentCost, unit_of_measure: item.unitOfMeasure || '', supplier: item.supplier || '', supplier_part_number: item.supplierPartNumber || '', fsc: item.fsc || '', nsn: item.nsn || '', lead_time: item.leadTime || '', lead_time_days: leadDays(item.leadTime), purchasable: item.purchasable, procurement_status: item.procurementStatus || '', dpas: item.dpas || '', serial_number_required: item.serialNumberRequired, taa_compliant: item.taaCompliant ?? null, in_stock: item.inStock ?? null, screen_size_inches: screenSize(item), source_row: item.sourceRow, active: item.active !== false } }
function semanticTerms(query) { const raw = [...query.matchAll(/"([^"]+)"|(\S+)/g)].map(match => (match[1] || match[2]).toLowerCase()); const expanded = new Set(raw); for (const term of raw) for (const group of SEMANTIC_GROUPS) if (group.some(alias => alias.includes(term) || term.includes(alias))) group.forEach(alias => expanded.add(alias)); const size = query.match(/(\d{2,3})\s*(?:"|inch|in\b)/i); if (size) for (const value of [Number(size[1]) - 2, Number(size[1]), Number(size[1]) + 3]) expanded.add(String(value)); return [...expanded].filter(Boolean).slice(0, 16) }
function buildSuggestions(query, products) { if (!query.trim()) return []; const values = new Set(); for (const item of products.slice(0, 12)) { if (item.category) values.add(item.category); if (item.manufacturer) values.add(item.manufacturer) } return [...values].slice(0, 8) }
function applyFilter(query, url, param, column) { const values = url.searchParams.getAll(param).filter(Boolean); return values.length ? query.in(column, values) : query }
function numberParam(url, name, fallback) { const value = Number(url.searchParams.get(name)); return Number.isFinite(value) ? value : fallback }
function safeFilename(value) { return value.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) }
function sanitizeProductPatch(body) { const map = { manufacturer: 'manufacturer', manufacturerPartNumber: 'manufacturer_part_number', description: 'description', additionalDescription: 'additional_description', category: 'category', subcategory: 'subcategory', budgetUnitPrice: 'budget_unit_price', currentCost: 'current_cost', unitOfMeasure: 'unit_of_measure', supplier: 'supplier', supplierPartNumber: 'supplier_part_number', fsc: 'fsc', nsn: 'nsn', leadTime: 'lead_time', purchasable: 'purchasable', procurementStatus: 'procurement_status', dpas: 'dpas', serialNumberRequired: 'serial_number_required', taaCompliant: 'taa_compliant', inStock: 'in_stock', active: 'active', specifications: 'specifications' }; return Object.fromEntries(Object.entries(map).filter(([key]) => body[key] !== undefined).map(([key, column]) => [column, body[key]])) }
async function activeAdminProfile(supabase, id) { const { data } = await supabase.from('atlas_user_profiles').select('role,is_active').eq('auth_user_id', id).maybeSingle(); return data?.role === 'admin' && data.is_active ? data : null }
async function findRelatedProducts(supabase, product) { let query = supabase.from('atlas_products').select(PRODUCT_SELECT).neq('id', product.id).limit(8); if (product.category) query = query.eq('category', product.category); else query = query.eq('manufacturer', product.manufacturer); const { data } = await query; return data || [] }
async function chunkedInsert(supabase, table, rows, returning = true) { const output = []; for (let index = 0; index < rows.length; index += 200) { let query = supabase.from(table).insert(rows.slice(index, index + 200)); if (returning) query = query.select('*'); const result = await query; if (result.error) throw result.error; output.push(...(result.data || [])) } return output }
async function chunkedUpsert(supabase, table, rows, onConflict) { for (let index = 0; index < rows.length; index += 200) { const result = await supabase.from(table).upsert(rows.slice(index, index + 200), { onConflict }); if (result.error) throw result.error } }
async function chunkedCatalogUpsert(supabase, rows) { const output = []; for (let index = 0; index < rows.length; index += 200) { const result = await supabase.rpc('atlas_catalog_upsert_products', { p_rows: rows.slice(index, index + 200) }); if (result.error) throw new Error(`Could not upsert catalog products: ${catalogErrorMessage(result.error)}`); output.push(...(result.data || [])) } return output }
