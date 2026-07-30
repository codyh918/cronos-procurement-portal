import test from 'node:test'
import assert from 'node:assert/strict'
import { DataValidationError, SupabasePilotRepository } from '../data-repositories.mjs'

test('vendor name is required', async () => {
  const repository = new SupabasePilotRepository({})
  await assert.rejects(() => repository.createVendor({}, { id: 'actor' }), error =>
    error instanceof DataValidationError && error.message === 'Vendor name is required.')
})

test('duplicate vendor names require an explicit override', async () => {
  const client = fakeClient({ duplicate: { id: 'existing', legal_name: 'Acme', vendor_number: 'V-1' } })
  const repository = new SupabasePilotRepository(client)
  await assert.rejects(() => repository.createVendor({ vendor: '  ACME  ' }, { id: 'actor' }), error =>
    error instanceof DataValidationError && error.status === 409)
})

test('vendor creation records creator identity, timestamps, and audit events', async () => {
  const client = fakeClient()
  const repository = new SupabasePilotRepository(client)
  const vendor = await repository.createVendor({ vendor: ' New Vendor ', email: 'rep@example.com' }, {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', username: 'kara.young', name: 'Kara Young',
  })
  assert.equal(vendor.vendor, 'New Vendor')
  assert.equal(vendor.createdBy, 'Kara Young')
  assert.equal(vendor.createdByUserId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  assert.ok(vendor.createdDate)
  assert.equal(client.inserts.atlas_vendors[0].created_by, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  assert.equal(client.inserts.atlas_audit_events[0].action, 'vendor.created')
})

test('vendor UI exposes Add Vendor without role gating and prevents duplicate submissions', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/views/VendorsView.vue', 'utf8'))
  assert.doesNotMatch(source, /v-if="canAddVendor"/)
  assert.match(source, /:disabled="creatingVendor"/)
  assert.match(source, /createVendorRecord/)
})

function fakeClient(options = {}) {
  const inserts = { atlas_vendors: [], atlas_audit_events: [] }
  return {
    inserts,
    from(table) {
      if (table === 'atlas_vendors') {
        return {
          select() {
            return {
              ilike() {
                return { is: () => ({ maybeSingle: async () => ({ data: options.duplicate || null, error: null }) }) }
              },
            }
          },
          insert(row) {
            inserts.atlas_vendors.push(row)
            return { select: () => ({ single: async () => ({ data: row, error: null }) }) }
          },
        }
      }
      return {
        insert: async row => {
          inserts.atlas_audit_events.push(row)
          return { error: null }
        },
      }
    },
  }
}
