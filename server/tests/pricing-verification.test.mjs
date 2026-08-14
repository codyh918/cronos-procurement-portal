import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogPricingStatus, chunkForDistributor, comparePricing, PRICING_STATUSES, quoteLinePricingStatus, verificationSummary } from '../pricing-verification.mjs'
import { requirePermission } from '../sewp-auth.mjs'

const NOW = Date.parse('2026-08-14T12:00:00Z')
const line = { lineId: 'line-1', partNumber: 'XTM1U-G', manufacturer: 'Chief', currentCost: 187.42 }
const catalog = { productId: 'product-1', catalogCost: 187.42, pricingStatus: 'Verified', verifiedAt: '2026-08-10T12:00:00Z' }
const distributor = { manufacturerPartNumber: 'XTM1U-G', unitCost: 194.17, availableQuantity: 24, availabilityStatus: 'Active', pricingStatus: 'Verified', source: 'TD SYNNEX' }

test('fresh catalog price is verified', () => assert.equal(catalogPricingStatus(catalog, { now: NOW, freshnessDays: 30 }), 'Verified'))
test('old catalog price is stale', () => assert.equal(catalogPricingStatus({ ...catalog, verifiedAt: '2026-06-01T12:00:00Z' }, { now: NOW, freshnessDays: 30 }), 'Stale'))
test('missing catalog price is unverified', () => assert.equal(catalogPricingStatus({ ...catalog, catalogCost: null }, { now: NOW }), 'Unverified'))
test('TD SYNNEX verification success preserves availability and source', () => { const result = comparePricing({ line, catalog: { ...catalog, catalogCost: 194.17 }, distributor, verifiedAt: '2026-08-14T12:00:00Z' }); assert.equal(result.status, 'Verified'); assert.equal(result.availableQuantity, 24); assert.equal(result.source, 'TD SYNNEX') })
test('changed distributor cost calculates dollar and percentage deltas', () => { const result = comparePricing({ line, catalog, distributor, verifiedAt: '2026-08-14T12:00:00Z' }); assert.equal(result.status, 'Price Changed'); assert.equal(result.delta, 6.75); assert.equal(result.percentDelta, 3.6015) })
test('quote-only apply data leaves catalog cost distinct', () => { const result = comparePricing({ line, catalog, distributor, verifiedAt: '2026-08-14T12:00:00Z' }); assert.equal(result.catalogCost, 187.42); assert.equal(result.distributorCost, 194.17) })
test('catalog-and-quote result carries product id needed for history update', () => assert.equal(comparePricing({ line, catalog, distributor }).catalogProductId, 'product-1'))
test('verification result contains audit identifiers and timestamp inputs', () => { const result = comparePricing({ line, catalog, distributor, verifiedAt: '2026-08-14T12:00:00Z' }); assert.equal(result.lineId, 'line-1'); assert.equal(result.partNumber, 'XTM1U-G'); assert.ok(result.verifiedAt) })
test('product not found is never verified', () => assert.equal(comparePricing({ line, catalog, distributor: { pricingStatus: 'Product Not Found', source: 'TD SYNNEX' } }).status, 'Product Not Found'))
test('missing or invalid distributor cost becomes distributor error', () => assert.equal(comparePricing({ line, catalog, distributor: { pricingStatus: 'Unverified', unitCost: null } }).status, 'Distributor Error'))
test('bulk quote summary identifies lines requiring verification', () => assert.deepEqual(verificationSummary([{ pricingStatus: 'Verified', pricingVerifiedAt: '2026-08-14T12:00:00Z' }, { pricingStatus: 'Stale' }, {}], NOW, 30), { total: 3, verified: 1, requiringVerification: 2, allVerified: false }))
test('distributor batching never exceeds 100 products', () => assert.deepEqual(chunkForDistributor(Array.from({ length: 205 }, (_, index) => index)).map(chunk => chunk.length), [100, 100, 5]))
test('catalog update permission is enforced independently from pricing verification', () => { const auth = { ok: true, user: { permissions: new Set(['atlas.pricing.verify']) } }; assert.equal(requirePermission(auth, 'atlas.pricing.verify').ok, true); assert.equal(requirePermission(auth, 'atlas.catalog.manage').status, 403) })
test('quote-level status ages a previously verified line to stale', () => assert.equal(quoteLinePricingStatus({ pricingStatus: PRICING_STATUSES.VERIFIED, pricingVerifiedAt: '2026-06-01T12:00:00Z' }, NOW, 30), 'Stale'))
