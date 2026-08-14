export const PRICING_STATUSES = Object.freeze({ VERIFIED: 'Verified', STALE: 'Stale', UNVERIFIED: 'Unverified', PRICE_CHANGED: 'Price Changed', PRODUCT_NOT_FOUND: 'Product Not Found', DISTRIBUTOR_ERROR: 'Distributor Error' })
export const DEFAULT_PRICING_FRESHNESS_DAYS = 30

export function pricingFreshnessDays(env = process.env) {
  const value = Number(env.PRICING_FRESHNESS_DAYS ?? DEFAULT_PRICING_FRESHNESS_DAYS)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_PRICING_FRESHNESS_DAYS
}

export function catalogPricingStatus(snapshot, { now = Date.now(), freshnessDays = DEFAULT_PRICING_FRESHNESS_DAYS } = {}) {
  if (!snapshot?.productId || snapshot.catalogCost === null || snapshot.catalogCost === undefined || !Number.isFinite(Number(snapshot.catalogCost))) return PRICING_STATUSES.UNVERIFIED
  if (snapshot.pricingStatus !== PRICING_STATUSES.VERIFIED || !snapshot.verifiedAt) return PRICING_STATUSES.UNVERIFIED
  const verifiedAt = Date.parse(snapshot.verifiedAt)
  return !Number.isFinite(verifiedAt) || now - verifiedAt > freshnessDays * 86400000 ? PRICING_STATUSES.STALE : PRICING_STATUSES.VERIFIED
}

export function comparePricing({ line, catalog, distributor, verifiedAt }) {
  const catalogCost = finiteMoney(catalog?.catalogCost)
  const distributorCost = finiteMoney(distributor?.unitCost)
  if (!distributor || distributor.pricingStatus === PRICING_STATUSES.PRODUCT_NOT_FOUND) return baseResult(line, catalog, distributor, verifiedAt, PRICING_STATUSES.PRODUCT_NOT_FOUND, catalogCost, null)
  if (distributor.pricingStatus !== PRICING_STATUSES.VERIFIED || distributorCost === null) return baseResult(line, catalog, distributor, verifiedAt, PRICING_STATUSES.DISTRIBUTOR_ERROR, catalogCost, null)
  const delta = catalogCost === null ? null : round(distributorCost - catalogCost)
  const percentDelta = catalogCost && delta !== null ? round((delta / catalogCost) * 100, 4) : null
  const status = delta !== null && Math.abs(delta) >= 0.005 ? PRICING_STATUSES.PRICE_CHANGED : PRICING_STATUSES.VERIFIED
  return { ...baseResult(line, catalog, distributor, verifiedAt, status, catalogCost, distributorCost), delta, percentDelta }
}

export function quoteLinePricingStatus(line, now = Date.now(), freshnessDays = DEFAULT_PRICING_FRESHNESS_DAYS) {
  if (line?.pricingStatus === PRICING_STATUSES.VERIFIED && line.pricingVerifiedAt) {
    const verifiedAt = Date.parse(line.pricingVerifiedAt)
    return Number.isFinite(verifiedAt) && now - verifiedAt <= freshnessDays * 86400000 ? PRICING_STATUSES.VERIFIED : PRICING_STATUSES.STALE
  }
  return Object.values(PRICING_STATUSES).includes(line?.pricingStatus) ? line.pricingStatus : PRICING_STATUSES.UNVERIFIED
}

export function verificationSummary(lines, now = Date.now(), freshnessDays = DEFAULT_PRICING_FRESHNESS_DAYS) {
  const statuses = lines.map(line => quoteLinePricingStatus(line, now, freshnessDays))
  const verified = statuses.filter(status => status === PRICING_STATUSES.VERIFIED).length
  return { total: statuses.length, verified, requiringVerification: statuses.length - verified, allVerified: statuses.length > 0 && verified === statuses.length }
}

export function chunkForDistributor(items, size = 100) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

function baseResult(line, catalog, distributor, verifiedAt, status, catalogCost, distributorCost) {
  return { lineId: String(line?.lineId || ''), partNumber: String(line?.partNumber || ''), manufacturer: String(line?.manufacturer || ''), currentQuoteCost: finiteMoney(line?.currentCost), catalogProductId: catalog?.productId || null, catalogCost, catalogVerifiedAt: catalog?.verifiedAt || null, distributorCost, availableQuantity: distributor?.availableQuantity ?? null, availabilityStatus: distributor?.availabilityStatus ?? null, source: distributor?.source || 'TD SYNNEX', verifiedAt: verifiedAt || distributor?.verifiedAt || null, status, delta: null, percentDelta: null }
}

function finiteMoney(value) { const number = Number(value); return value === null || value === undefined || value === '' || !Number.isFinite(number) ? null : round(number) }
function round(value, places = 2) { const scale = 10 ** places; return Math.round((value + Number.EPSILON) * scale) / scale }
