import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizeUsername, validatePassword, validateUserInput } from '../atlas-auth-api.mjs'
import { authenticateSewpRequest, requirePermission } from '../sewp-auth.mjs'

test('strong Atlas passwords are accepted and weak passwords are rejected', () => {
  assert.deepEqual(validatePassword('GoodPassword1!'), [])
  assert.ok(validatePassword('short').length >= 4)
})

test('usernames are trimmed, case-insensitive, and validated', () => {
  assert.equal(normalizeUsername('  Kara.Young  '), 'kara.young')
  assert.equal(validateUserInput({
    username: ' Kara.Young ', firstName: 'Kara', lastName: 'Young',
    email: 'Kara.Young@cronosllc.com', password: 'GoodPassword1!',
    role: 'Procurement Team',
  }).value.username, 'kara.young')
})

test('missing user fields and invalid passwords receive clear validation errors', () => {
  assert.equal(validateUserInput({}).error, 'Missing required information.')
  assert.match(validateUserInput({
    username: 'user', firstName: 'Test', lastName: 'User', email: 'user@example.com',
    password: 'weak', role: 'Procurement Team',
  }).error, /12 characters/)
})

test('inactive identities are denied before application permissions are evaluated', async () => {
  const auth = await authenticateSewpRequest({ headers: { authorization: 'Bearer token' } }, {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'user@example.com', app_metadata: { active: false } } }, error: null }) },
  })
  assert.equal(auth.ok, false)
  assert.equal(auth.status, 403)
})

test('every active Atlas role receives vendor-create permission while user administration stays admin-only', async () => {
  for (const role of ['admin', 'procurement', 'executive', 'warehouse', 'read-only']) {
    const auth = await authenticateSewpRequest({ headers: { authorization: 'Bearer token' } }, {
      auth: { getUser: async () => ({ data: { user: { id: role, email: `${role}@example.com`, app_metadata: { atlas_role: role, active: true } } }, error: null }) },
    })
    assert.equal(requirePermission(auth, 'atlas.vendor.create').ok, true)
    assert.equal(requirePermission(auth, 'atlas.user.create').ok, role === 'admin')
  }
})

test('frontend contains no service-role key and no persisted default password', async () => {
  const frontendFiles = [
    'src/services/supabaseAuth.ts', 'src/services/auth.ts', 'src/services/authAdminApi.ts',
    'src/views/AdminView.vue', 'src/components/AuthGate.vue',
  ]
  const source = (await Promise.all(frontendFiles.map(file => readFile(file, 'utf8')))).join('\n')
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i)
  assert.doesNotMatch(source, /CronosAdmin|seededAdmin/)
})

test('Admin UI creates users through the server API and does not retain created passwords', async () => {
  const source = await readFile('src/views/AdminView.vue', 'utf8')
  const serverSource = await readFile('server/atlas-auth-api.mjs', 'utf8')
  assert.match(source, /createAtlasUser/)
  assert.doesNotMatch(source, /createdCredentials|Temporary password:|addUser\(/)
  assert.match(serverSource, /User created successfully\. The user can now sign in to Atlas\./)
})
