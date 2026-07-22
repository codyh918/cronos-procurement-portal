import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticateSewpRequest, requirePermission } from '../sewp-auth.mjs'

test('rejects requests without a bearer token', async () => {
  const result = await authenticateSewpRequest({ headers: {} }, null)
  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})

test('rejects invalid Supabase access tokens', async () => {
  const authClient = { auth: { getUser: async () => ({ data: { user: null }, error: new Error('invalid') }) } }
  const result = await authenticateSewpRequest({ headers: { authorization: 'Bearer invalid' } }, authClient)
  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})

test('maps procurement users to bounded permissions', async () => {
  const authClient = {
    auth: {
      getUser: async token => ({
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'buyer@example.com',
            app_metadata: { atlas_role: 'procurement' },
            user_metadata: {},
            token,
          },
        },
        error: null,
      }),
    },
  }
  const auth = await authenticateSewpRequest({ headers: { authorization: 'Bearer valid' } }, authClient)
  assert.equal(requirePermission(auth, 'sewp.rfq.create').ok, true)
  const denied = requirePermission(auth, 'sewp.rfq.override_transition')
  assert.equal(denied.ok, false)
  assert.equal(denied.status, 403)
})

test('allows admins through the wildcard permission', async () => {
  const authClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: '00000000-0000-4000-8000-000000000002', app_metadata: { atlas_role: 'admin' }, user_metadata: {} } },
        error: null,
      }),
    },
  }
  const auth = await authenticateSewpRequest({ headers: { authorization: 'Bearer valid' } }, authClient)
  assert.equal(requirePermission(auth, 'sewp.rfq.override_transition').ok, true)
})
