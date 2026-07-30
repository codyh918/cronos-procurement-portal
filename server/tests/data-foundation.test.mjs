import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SupabasePilotRepository } from '../data-repositories.mjs'

test('customer and vendor Vue screens contain no Supabase dependency', async () => {
  for (const file of ['src/views/CustomersView.vue', 'src/views/VendorsView.vue']) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /supabase|app_records|\.from\(/i)
  }
})

test('pilot repository is replaceable behind a stable collection contract', async () => {
  const writes = []
  const client = {
    from(table) {
      return {
        select() {
          const chain = { is: async () => ({ data: [], error: null }), order: async () => ({ data: [], error: null }) }
          return chain
        },
        upsert: async rows => { writes.push({ table, rows }); return { error: null } },
        update: () => ({ in: async () => ({ error: null }) }),
      }
    },
  }
  const repository = new SupabasePilotRepository(client)
  const actorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const result = await repository.replaceCollection('customers', [{
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    legalCompanyName: 'Example Agency', displayName: 'Example Agency', customerNumber: 'C-100',
    active: true,
  }], actorId)
  assert.deepEqual(result, { count: 1, softDeleted: 0 })
  assert.equal(writes[0].table, 'atlas_customers')
  assert.equal(writes[0].rows[0].customer_number, 'C-100')
  assert.equal(writes[0].rows[0].created_by, actorId)
})
