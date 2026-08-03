import { randomUUID } from 'node:crypto'
import { authenticateSewpRequest } from './sewp-auth.mjs'

export function validatePassword(password) {
  const errors = []
  if (typeof password !== 'string' || password.length < 12) errors.push('Password must be at least 12 characters.')
  if (!/[A-Z]/.test(password || '')) errors.push('Password must contain an uppercase letter.')
  if (!/[a-z]/.test(password || '')) errors.push('Password must contain a lowercase letter.')
  if (!/[0-9]/.test(password || '')) errors.push('Password must contain a number.')
  if (!/[^A-Za-z0-9]/.test(password || '')) errors.push('Password must contain a special character.')
  return errors
}

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

export async function handleAtlasAuthApi({ request, response, pathname, sendJson, readJsonBody, supabase, passwordAuthClient }) {
  if (!pathname.startsWith('/api/auth/')) return false
  if (!supabase) { sendJson(response, 503, { error: 'Authentication service failure.' }); return true }

  try {
    if (request.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJsonBody(request)
      const login = String(body.login || '').trim()
      const password = String(body.password || '')
      if (!login || !password) { sendJson(response, 400, { error: 'Username or email and password are required.' }); return true }
      let email = login
      let profile = null
      if (!login.includes('@')) {
        const result = await supabase.from('atlas_user_profiles').select('*').ilike('username', normalizeUsername(login)).maybeSingle()
        if (result.error || !result.data) { sendJson(response, 400, { error: 'Invalid login credentials.' }); return true }
        profile = result.data
        email = profile.email
      } else {
        const result = await supabase.from('atlas_user_profiles').select('*').ilike('email', login).maybeSingle()
        profile = result.data || null
      }
      if (profile?.is_active === false) { sendJson(response, 403, { error: 'This Atlas account is inactive.' }); return true }
      if (!passwordAuthClient) { sendJson(response, 503, { error: 'Authentication service failure.' }); return true }
      const result = await passwordAuthClient.auth.signInWithPassword({ email, password })
      if (result.error || !result.data?.session || !result.data.user) {
        sendJson(response, 400, { error: 'Invalid login credentials.' }); return true
      }
      if (result.data.user.app_metadata?.active === false) {
        await passwordAuthClient.auth.signOut()
        sendJson(response, 403, { error: 'This Atlas account is inactive.' }); return true
      }
      sendJson(response, 200, {
        accessToken: result.data.session.access_token,
        refreshToken: result.data.session.refresh_token,
      })
      return true
    }

    const auth = await authenticateSewpRequest(request, supabase)
    if (!auth.ok) { sendJson(response, auth.status, { error: auth.error }); return true }
    const actorProfile = await getProfile(supabase, auth.user.id)
    const isAdmin = auth.user.role === 'admin' || actorProfile?.role === 'admin'

    if (request.method === 'GET' && pathname === '/api/auth/users') {
      if (!isAdmin) { sendJson(response, 403, { error: 'Insufficient administrator permission.' }); return true }
      const { data, error } = await supabase.from('atlas_user_profiles').select('*').order('display_name')
      if (error) throw new Error('Unable to load Atlas profiles.')
      sendJson(response, 200, { users: (data || []).map(toPublicProfile) })
      return true
    }

    if (request.method === 'POST' && pathname === '/api/auth/users') {
      if (!isAdmin) { sendJson(response, 403, { error: 'Insufficient administrator permission.' }); return true }
      const body = await readJsonBody(request)
      const input = validateUserInput(body)
      if (input.error) { sendJson(response, 400, { error: input.error }); return true }
      const duplicate = await findDuplicate(supabase, input.value.username, input.value.email)
      if (duplicate) { sendJson(response, 409, { error: duplicate }); return true }
      const created = await supabase.auth.admin.createUser({
        email: input.value.email,
        password: input.value.password,
        email_confirm: true,
        user_metadata: {
          username: input.value.username, full_name: input.value.displayName,
          first_name: input.value.firstName, last_name: input.value.lastName,
          title: input.value.title, phone: input.value.phone,
        },
        app_metadata: { atlas_role: input.value.role, active: input.value.active },
      })
      if (created.error || !created.data.user) {
        sendJson(response, duplicateStatus(created.error?.message), { error: safeAuthCreateError(created.error?.message) }); return true
      }
      const authUserId = created.data.user.id
      const now = new Date().toISOString()
      const profileRow = {
        auth_user_id: authUserId, username: input.value.username, first_name: input.value.firstName,
        last_name: input.value.lastName, display_name: input.value.displayName, email: input.value.email,
        role: input.value.role, title: input.value.title, phone: input.value.phone, is_active: input.value.active,
        created_at: now, created_by: auth.user.id, updated_at: now, updated_by: auth.user.id,
      }
      const profileResult = await supabase.from('atlas_user_profiles').insert(profileRow).select('*').single()
      if (profileResult.error) {
        await supabase.auth.admin.deleteUser(authUserId)
        sendJson(response, 500, { error: 'Profile creation failure. The incomplete authentication account was rolled back.' })
        return true
      }
      await audit(supabase, auth.user, 'user.created', 'user', authUserId, {
        username: input.value.username, role: input.value.role, active: input.value.active,
      })
      sendJson(response, 201, { user: toPublicProfile(profileResult.data), message: 'User created successfully. The user can now sign in to Atlas.' })
      return true
    }

    const userMatch = pathname.match(/^\/api\/auth\/users\/([0-9a-f-]+)$/i)
    if (request.method === 'PATCH' && userMatch) {
      if (!isAdmin) { sendJson(response, 403, { error: 'Insufficient administrator permission.' }); return true }
      const targetId = userMatch[1]
      const current = await getProfile(supabase, targetId)
      if (!current) { sendJson(response, 404, { error: 'Atlas user profile not found.' }); return true }
      const body = await readJsonBody(request)
      const patch = {}
      if (typeof body.active === 'boolean') patch.is_active = body.active
      if (body.role !== undefined) {
        const role = normalizeRole(body.role)
        if (!role) { sendJson(response, 400, { error: 'Invalid role.' }); return true }
        patch.role = role
      }
      for (const [inputKey, column] of [['title', 'title'], ['phone', 'phone']]) {
        if (typeof body[inputKey] === 'string') patch[column] = body[inputKey].trim()
      }
      if (!Object.keys(patch).length) { sendJson(response, 400, { error: 'No supported profile changes were provided.' }); return true }
      patch.updated_at = new Date().toISOString()
      patch.updated_by = auth.user.id
      patch.version = Number(current.version || 1) + 1
      const authMetadata = {
        ...(body.role !== undefined ? { atlas_role: patch.role } : {}),
        ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
      }
      const authUpdate = await supabase.auth.admin.updateUserById(targetId, { app_metadata: { ...authMetadata } })
      if (authUpdate.error) { sendJson(response, 502, { error: 'Authentication service failure.' }); return true }
      const updated = await supabase.from('atlas_user_profiles').update(patch).eq('auth_user_id', targetId).select('*').single()
      if (updated.error) { sendJson(response, 500, { error: 'Profile update failure.' }); return true }
      for (const event of changedEvents(current, updated.data)) await audit(supabase, auth.user, event, 'user', targetId, {})
      sendJson(response, 200, { user: toPublicProfile(updated.data) })
      return true
    }

    const resetMatch = pathname.match(/^\/api\/auth\/users\/([0-9a-f-]+)\/password-reset$/i)
    if (request.method === 'POST' && resetMatch) {
      if (!isAdmin) { sendJson(response, 403, { error: 'Insufficient administrator permission.' }); return true }
      const target = await getProfile(supabase, resetMatch[1])
      if (!target) { sendJson(response, 404, { error: 'Atlas user profile not found.' }); return true }
      const reset = await passwordAuthClient?.auth.resetPasswordForEmail(target.email)
      if (reset?.error) { sendJson(response, 502, { error: 'Authentication service failure.' }); return true }
      await audit(supabase, auth.user, 'user.password_reset_initiated', 'user', target.auth_user_id, {})
      sendJson(response, 202, { message: 'Password reset initiated.' })
      return true
    }

    sendJson(response, 404, { error: 'Authentication route not found.' })
  } catch {
    sendJson(response, 500, { error: 'Authentication service failure.' })
  }
  return true
}

export function validateUserInput(body) {
  const username = normalizeUsername(body.username)
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const role = normalizeRole(body.role)
  if (!username || !firstName || !lastName || !email || !password || !role) return { error: 'Missing required information.' }
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) return { error: 'Username must be 3-64 characters using letters, numbers, dots, underscores, or hyphens.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'A valid email is required.' }
  const passwordErrors = validatePassword(password)
  if (passwordErrors.length) return { error: passwordErrors.join(' ') }
  return { value: {
    username, firstName, lastName, displayName: `${firstName} ${lastName}`.trim(), email, password, role,
    title: String(body.title || '').trim(), phone: String(body.phone || '').trim(), active: body.active !== false,
  } }
}
function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase()
  if (role === 'admin') return 'admin'
  if (role === 'procurement' || role === 'procurement team') return 'procurement'
  if (role === 'engineering' || role === 'engineer') return 'engineering'
  if (role === 'sales') return 'sales'
  return ''
}
async function getProfile(supabase, id) {
  const { data } = await supabase.from('atlas_user_profiles').select('*').eq('auth_user_id', id).maybeSingle()
  return data || null
}
async function findDuplicate(supabase, username, email) {
  const [usernameResult, emailResult] = await Promise.all([
    supabase.from('atlas_user_profiles').select('auth_user_id').ilike('username', username).maybeSingle(),
    supabase.from('atlas_user_profiles').select('auth_user_id').ilike('email', email).maybeSingle(),
  ])
  if (usernameResult.data) return 'Duplicate username.'
  if (emailResult.data) return 'Duplicate email.'
  return ''
}
function toPublicProfile(row) {
  return {
    id: row.auth_user_id, supabaseAuthUserId: row.auth_user_id, username: row.username,
    firstName: row.first_name, lastName: row.last_name, name: row.display_name, email: row.email,
    role: ({ admin: 'Admin', procurement: 'Procurement Team', engineering: 'Engineering', sales: 'Sales' })[row.role] || 'Procurement Team', title: row.title, phone: row.phone,
    active: row.is_active, createdAt: row.created_at, createdBy: row.created_by,
  }
}
function changedEvents(before, after) {
  const events = []
  if (before.is_active !== after.is_active) events.push(after.is_active ? 'user.activated' : 'user.deactivated')
  if (before.role !== after.role) events.push('user.role_changed')
  return events
}
async function audit(supabase, actor, action, entityType, entityId, metadata) {
  await supabase.from('atlas_audit_events').insert({
    action, entity_type: entityType, entity_id: entityId, actor_user_id: actor.id,
    actor_username: actor.username || actor.name || actor.email, request_id: randomUUID(), metadata,
  })
}
function duplicateStatus(message = '') { return /already|registered|duplicate/i.test(message) ? 409 : 502 }
function safeAuthCreateError(message = '') {
  if (/already|registered|duplicate/i.test(message)) return 'Duplicate email.'
  return 'Authentication service failure.'
}
