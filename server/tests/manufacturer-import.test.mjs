import test from 'node:test'
import assert from 'node:assert/strict'

const { applyManufacturerUpdates } = await import('../../src/services/manufacturerMatching.mjs')

function line(clin, partNumber, manufacturer = '') {
  return { id: clin, clin, partNumber, manufacturer, description: '', quantity: 1, unitCost: 1, pricingMode: 'markup', markupPercent: 0, marginPercent: 0, vendor: '', quoteNumber: '', leadTime: '', approved: false }
}

function row(clin, partNumber, manufacturer) {
  return { clin, partNumber, manufacturer, description: '', quantity: 1, unitCost: 0, pricingMode: 'markup', markupPercent: 0, marginPercent: 0, vendor: '', quoteNumber: '', leadTime: '' }
}

test('updates manufacturers by exported line and part number', () => {
  const result = applyManufacturerUpdates([row('1', '54101', 'Thomas & Betts'), row('2', '00861', 'Black Box')], [line('1', '54101'), line('2', '00861')])
  assert.equal(result.updatedCount, 2)
  assert.deepEqual(result.updatedLines.map(item => item.manufacturer), ['Thomas & Betts', 'Black Box'])
})

test('ignores blank placeholders and refuses mismatched line identities', () => {
  const result = applyManufacturerUpdates([row('1', 'WRONG-PART', 'Wrong OEM'), row('2', '00861', 'N/A')], [line('1', '54101'), line('2', '00861')])
  assert.equal(result.updatedCount, 0)
  assert.equal(result.unmatchedCount, 1)
  assert.equal(result.skippedCount, 1)
})

test('uses a unique part number when line numbers are unavailable', () => {
  const result = applyManufacturerUpdates([row('', 'SRTL3KRM1UWNC', 'APC')], [line('7', 'SRTL3KRM1UWNC')])
  assert.equal(result.updatedCount, 1)
  assert.equal(result.updatedLines[0].manufacturer, 'APC')
})
