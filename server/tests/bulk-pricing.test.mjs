import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPricingToAllLines } from '../../src/services/bulkPricing.mjs'

const lines = [{ id: '1', pricingMode: 'markup', markupPercent: 5 }, { id: '2', pricingMode: 'markup', markupPercent: 15 }]

test('applies one margin to every line without mutating the source', () => {
  const updated = applyPricingToAllLines(lines, 'margin', 25)
  assert.deepEqual(updated.map(line => [line.pricingMode, line.marginPercent]), [['margin', 25], ['margin', 25]])
  assert.equal(lines[0].pricingMode, 'markup')
})

test('applies one markup to every line', () => {
  const updated = applyPricingToAllLines(lines, 'markup', 18)
  assert.deepEqual(updated.map(line => line.markupPercent), [18, 18])
})

test('rejects invalid margin values', () => {
  assert.throws(() => applyPricingToAllLines(lines, 'margin', 100), /less than 100/)
})
