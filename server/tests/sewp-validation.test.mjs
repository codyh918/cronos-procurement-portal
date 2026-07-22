import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSewpConfig } from '../sewp-config.mjs'
import { cleanText, validateCreateRfq, validatePagination, validateStageTransition } from '../sewp-validation.mjs'

test('validates and normalizes a manual RFQ', () => {
  const result = validateCreateRfq({
    title: '  Endpoint refresh  ',
    officialRfqNumber: ' RFQ-123 ',
    source: 'Manual',
    estimatedValue: '125000.50',
    responseDueAt: '2026-08-01T17:00:00-04:00',
  })
  assert.equal(result.ok, true)
  assert.equal(result.value.title, 'Endpoint refresh')
  assert.equal(result.value.officialRfqNumber, 'RFQ-123')
  assert.equal(result.value.estimatedValue, 125000.5)
  assert.equal(result.value.responseDueAt, '2026-08-01T21:00:00.000Z')
})

test('rejects missing identity and invalid values', () => {
  const result = validateCreateRfq({ responseDueAt: 'not-a-date', estimatedValue: -1, ownerUserId: 'bad' })
  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, [
    'responseDueAt must be a valid ISO date/time.',
    'title is required.',
    'officialRfqNumber is required.',
    'estimatedValue must be a nonnegative number.',
    'ownerUserId must be a UUID.',
  ])
})

test('strips control characters from user text', () => {
  assert.equal(cleanText('A\u0000B\u0007C', 20), 'ABC')
})

test('bounds queue pagination', () => {
  const result = validatePagination(new URL('https://atlas.test/api/sewp-rfqs?page=-5&pageSize=1000'))
  assert.deepEqual(result, { page: 1, pageSize: 100, from: 0, to: 99 })
})

test('requires a valid target stage and optimistic-lock version', () => {
  assert.equal(validateStageTransition({ targetStage: 'Submitted', expectedVersion: 3 }).ok, true)
  const invalid = validateStageTransition({ targetStage: 'Skip Everything', expectedVersion: 0 })
  assert.equal(invalid.ok, false)
  assert.equal(invalid.errors.length, 2)
})

test('uses safe file-limit defaults and accepts positive overrides', () => {
  const defaults = loadSewpConfig({})
  assert.equal(defaults.maxFileBytes, 25 * 1024 * 1024)
  assert.equal(defaults.maxFilesPerRfq, 20)
  const configured = loadSewpConfig({ SEWP_MAX_FILE_BYTES: '1000', SEWP_MAX_FILES_PER_RFQ: '5' })
  assert.equal(configured.maxFileBytes, 1000)
  assert.equal(configured.maxFilesPerRfq, 5)
})
