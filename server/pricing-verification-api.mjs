import { randomUUID } from 'node:crypto'
import { authenticateSewpRequest, requirePermission } from './sewp-auth.mjs'
import { tdSynnexService, TdSynnexError } from './td-synnex-service.mjs'
import { chunkForDistributor, comparePricing, pricingFreshnessDays } from './pricing-verification.mjs'

export async function handlePricingVerificationApi({ request, response, pathname, sendJson, readJsonBody, authClient, supabase, service = tdSynnexService }) {
  if (!pathname.startsWith('/api/pricing-verification')) return false
  const auth = await authenticateSewpRequest(request, authClient)
  const allowed = requirePermission(auth, 'atlas.pricing.verify')
  if (!allowed.ok) { sendJson(response, allowed.status, { error: allowed.error }); return true }
  if (!supabase) { sendJson(response, 503, { error: 'Catalog persistence is not configured.' }); return true }
  try {
    const body = await readJsonBody(request)
    const lines = sanitizeLines(body.lines)
    if (request.method === 'POST' && pathname === '/api/pricing-verification/preview') {
      const results = await verifyLines({ lines, supabase, service })
      sendJson(response, 200, { provider: 'TD SYNNEX', freshnessDays: pricingFreshnessDays(), results }); return true
    }
    if (request.method === 'POST' && pathname === '/api/pricing-verification/apply') {
      const updateCatalog = body.updateCatalog === true
      if (updateCatalog) {
        const catalogAllowed = requirePermission(auth, 'atlas.catalog.manage')
        if (!catalogAllowed.ok) { sendJson(response, catalogAllowed.status, { error: catalogAllowed.error }); return true }
      }
      const results = await verifyLines({ lines, supabase, service })
      const applicable = results.filter(item => ['Verified', 'Price Changed'].includes(item.status) && item.distributorCost !== null)
      if (updateCatalog) await updateCatalogPricing(supabase, applicable, auth.user.id)
      await recordQuoteAudit(supabase, applicable, lines, auth.user.id, String(body.quoteId || ''), updateCatalog)
      sendJson(response, 200, { provider: 'TD SYNNEX', results: applicable, catalogUpdated: updateCatalog }); return true
    }
    sendJson(response, 404, { error: 'Pricing verification route not found.' })
  } catch (error) {
    const safe = safeVerificationError(error)
    sendJson(response, safe.status, { error: safe.message, code: safe.code, retryable: safe.retryable })
  }
  return true
}

export async function verifyLines({ lines, supabase, service }) {
  const snapshots = await loadCatalogSnapshots(supabase, lines)
  const distributorByPart = new Map()
  for (const chunk of chunkForDistributor([...new Set(lines.map(line => line.partNumber))], 100)) {
    const response = await service.getPriceAvailability(chunk)
    for (const item of response.results || []) distributorByPart.set(normalize(item.manufacturerPartNumber), item)
  }
  const verifiedAt = new Date().toISOString()
  return lines.map(line => comparePricing({ line, catalog: snapshots.get(line.lineId), distributor: distributorByPart.get(normalize(line.partNumber)), verifiedAt }))
}

async function loadCatalogSnapshots(supabase, lines) {
  const products = await supabase.from('atlas_products').select('id,manufacturer,manufacturer_part_number,current_cost,supplier').in('manufacturer_part_number', [...new Set(lines.map(line => line.partNumber))]).eq('active', true)
  if (products.error) throw products.error
  const ids = (products.data || []).map(item => item.id)
  const history = ids.length ? await supabase.from('atlas_product_pricing_history').select('product_id,pricing_status,verified_at,effective_date').in('product_id', ids).order('effective_date', { ascending: false }) : { data: [], error: null }
  if (history.error) throw history.error
  const latest = new Map()
  for (const row of history.data || []) if (!latest.has(row.product_id)) latest.set(row.product_id, row)
  const snapshots = new Map()
  for (const line of lines) {
    const matches = (products.data || []).filter(product => normalize(product.manufacturer_part_number) === normalize(line.partNumber))
    const product = matches.find(item => !line.manufacturer || normalize(item.manufacturer) === normalize(line.manufacturer)) || matches[0]
    snapshots.set(line.lineId, product ? { productId: product.id, catalogCost: product.current_cost, verifiedAt: latest.get(product.id)?.verified_at || null, pricingStatus: latest.get(product.id)?.pricing_status || 'Unverified' } : null)
  }
  return snapshots
}

async function updateCatalogPricing(supabase, results, userId) {
  const verifiedAt = new Date().toISOString()
  const expirationDate = new Date(Date.parse(verifiedAt) + pricingFreshnessDays() * 86400000).toISOString()
  for (const item of results) {
    if (!item.catalogProductId) continue
    const updated = await supabase.from('atlas_products').update({ current_cost: item.distributorCost, supplier: item.source, updated_at: verifiedAt, updated_by: userId }).eq('id', item.catalogProductId)
    if (updated.error) throw updated.error
    const history = await supabase.from('atlas_product_pricing_history').insert({ product_id: item.catalogProductId, previous_cost: item.catalogCost, new_cost: item.distributorCost, vendor: item.source, source_file: 'TD SYNNEX Sandbox API', pricing_status: 'Verified', verified_at: verifiedAt, verified_by: userId, expiration_date: expirationDate, effective_date: verifiedAt, imported_by: userId })
    if (history.error) throw history.error
    const audit = await supabase.from('atlas_catalog_audit_events').insert({ product_id: item.catalogProductId, action: 'pricing.distributor_verified', actor_user_id: userId, before_data: { current_cost: item.catalogCost }, after_data: { current_cost: item.distributorCost, source: item.source, verified_at: verifiedAt } })
    if (audit.error) throw audit.error
  }
}

async function recordQuoteAudit(supabase, results, lines, userId, quoteId, catalogUpdated) {
  if (!results.length) return
  const lineMap = new Map(lines.map(line => [line.lineId, line]))
  const rows = results.map(item => ({ id: randomUUID(), quote_id: quoteId || null, quote_line_id: item.lineId, part_number: item.partNumber, previous_cost: lineMap.get(item.lineId)?.currentCost ?? null, verified_cost: item.distributorCost, pricing_source: item.source, verified_at: item.verifiedAt, applied_by: userId, catalog_updated: catalogUpdated }))
  const audit = await supabase.from('atlas_quote_pricing_audit').insert(rows)
  if (audit.error) throw audit.error
}

function sanitizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw Object.assign(new Error('Select at least one quote line.'), { status: 400, code: 'INVALID_LINES' })
  if (lines.length > 1000) throw Object.assign(new Error('No more than 1,000 quote lines can be verified at once.'), { status: 400, code: 'TOO_MANY_LINES' })
  const clean = lines.map(line => ({ lineId: String(line?.lineId || '').trim(), partNumber: String(line?.partNumber || '').trim(), manufacturer: String(line?.manufacturer || '').trim(), currentCost: Number.isFinite(Number(line?.currentCost)) ? Number(line.currentCost) : null })).filter(line => line.lineId && line.partNumber)
  if (!clean.length) throw Object.assign(new Error('Selected lines require manufacturer part numbers.'), { status: 400, code: 'INVALID_LINES' })
  return clean
}

function safeVerificationError(error) {
  if (error instanceof TdSynnexError) return error
  return { status: Number(error?.status) || 500, code: error?.code || 'PRICING_VERIFICATION_FAILED', retryable: false, message: Number(error?.status) === 400 ? error.message : 'Pricing verification could not be completed. Existing quote pricing was preserved.' }
}
function normalize(value) { return String(value || '').trim().toLowerCase() }
