import type { AppRole, UserProfile, UserSession } from '../types'

const USERS_KEY = 'cronos.users'
const SESSION_KEY = 'cronos.session'
const ROLE_PREVIEW_KEY = 'cronos.rolePreview'

export const appRoles: AppRole[] = ['Admin', 'Procurement Team', 'Accounting', 'Executive']

const seededAdmin: UserProfile = {
  id: 'seed-admin-cody',
  name: 'Cody Hibbard',
  email: 'cody.hibbard@cronosllc.com',
  password: 'CronosAdmin!2026',
  role: 'Admin',
  title: 'Administrator',
  phone: '',
  active: true,
}

export type PendingLogin = {
  id: string
  name: string
  email: string
  role: AppRole
  title: string
  twoFactorEnabled: boolean
  setupSecret?: string
  setupUri?: string
}

export function fetchSession(): UserSession | null {
  const session = readJson<UserSession | null>(SESSION_KEY, null)
  if (!session) return null

  const user = readStoredUsers().find(item => item.id === session.id || item.email.toLowerCase() === session.email.toLowerCase())
  if (!user?.active) {
    setSession(null)
    return null
  }

  const syncedSession = toSession(user)
  if (
    syncedSession.id !== session.id ||
    syncedSession.name !== session.name ||
    syncedSession.email !== session.email ||
    syncedSession.role !== session.role ||
    syncedSession.title !== session.title
  ) {
    setSession(syncedSession)
  }

  return syncedSession
}

export function ensureDefaultAdminSession() {
  const session = fetchSession()
  if (session) return session

  const admin = readStoredUsers().find(user => user.email.toLowerCase() === seededAdmin.email)
  if (!admin) return null

  const adminSession = toSession(admin)
  setSession(adminSession)
  return adminSession
}

export function loginUser(email: string, password: string) {
  const user = findActiveUser(email, password)
  const session = toSession(user)
  setSession(session)
  return session
}

export function beginLogin(email: string, password: string): PendingLogin {
  const user = findActiveUser(email, password)
  if (!user.twoFactorSecret) {
    const secret = generateTotpSecret()
    const users = readStoredUsers().map(item => (item.id === user.id ? { ...item, twoFactorSecret: secret, twoFactorEnabled: false } : item))
    saveUsers(users)
    return toPendingLogin({ ...user, twoFactorSecret: secret, twoFactorEnabled: false })
  }

  return toPendingLogin(user)
}

export async function completeLogin(userId: string, code: string) {
  const users = readStoredUsers()
  const user = users.find(item => item.id === userId)
  if (!user?.active || !user.twoFactorSecret) {
    throw new Error('Invalid email or password.')
  }

  const verified = await verifyTotpCode(user.twoFactorSecret, code)
  if (!verified) {
    throw new Error('Invalid authenticator code.')
  }

  if (!user.twoFactorEnabled) {
    saveUsers(users.map(item => (item.id === user.id ? { ...item, twoFactorEnabled: true } : item)))
  }

  const session = toSession(user)
  setSession(session)
  return session
}

export function setSession(session: UserSession | null) {
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(SESSION_KEY)
  }
  window.dispatchEvent(new Event('cronos:session-changed'))
}

export function logoutUser() {
  setSession(null)
}

export function loadUsers() {
  return readStoredUsers().map(redactPassword)
}

export function addUser(input: Omit<UserProfile, 'id'>) {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const password = String(input.password ?? '')

  if (!name || !email || password.length < 8) {
    throw new Error('Name, email, and a password of at least 8 characters are required.')
  }

  const users = readStoredUsers()
  if (users.some(user => user.email.toLowerCase() === email)) {
    throw new Error('A user with that email already exists.')
  }

  const created: UserProfile = {
    ...input,
    id: crypto.randomUUID(),
    name,
    email,
    title: input.title.trim(),
    phone: input.phone.trim(),
    active: input.active !== false,
  }
  const updated = sortUsers([...users, created])
  saveUsers(updated)
  return updated.map(redactPassword)
}

export function updateUser(userId: string, updates: Partial<UserProfile>) {
  const users = readStoredUsers()
  let matched = false
  const updated = users.map(user => {
    if (user.id !== userId) return user
    matched = true
    const password = typeof updates.password === 'string' ? updates.password.trim() : ''
    return {
      ...user,
      name: typeof updates.name === 'string' ? updates.name.trim() : user.name,
      email: typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : user.email,
      password: password ? password : user.password,
      twoFactorSecret: Object.prototype.hasOwnProperty.call(updates, 'twoFactorSecret') ? updates.twoFactorSecret : user.twoFactorSecret,
      twoFactorEnabled: updates.twoFactorEnabled ?? user.twoFactorEnabled,
      role: updates.role ?? user.role,
      title: typeof updates.title === 'string' ? updates.title.trim() : user.title,
      phone: typeof updates.phone === 'string' ? updates.phone.trim() : user.phone,
      active: typeof updates.active === 'boolean' ? updates.active : user.active,
    }
  })

  if (!matched) throw new Error('Unable to update user.')

  const sorted = sortUsers(updated)
  saveUsers(sorted)
  syncSessionAfterUserUpdate(sorted)
  return sorted.map(redactPassword)
}

export function resetUserTwoFactor(userId: string) {
  const users = readStoredUsers()
  const updated = users.map(user => (user.id === userId ? { ...user, twoFactorSecret: undefined, twoFactorEnabled: false } : user))
  saveUsers(updated)
  syncSessionAfterUserUpdate(updated)
  return updated.map(redactPassword)
}

export function getRolePreview() {
  const value = window.localStorage.getItem(ROLE_PREVIEW_KEY) as AppRole | null
  return value && appRoles.includes(value) ? value : null
}

export function setRolePreview(role: AppRole | '') {
  if (role) {
    window.localStorage.setItem(ROLE_PREVIEW_KEY, role)
  } else {
    window.localStorage.removeItem(ROLE_PREVIEW_KEY)
  }
  window.dispatchEvent(new Event('cronos:role-preview-changed'))
}

export function getEffectiveRole(session: UserSession | null = fetchSession()) {
  if (!session) return null
  return session.role === 'Admin' ? getRolePreview() ?? session.role : session.role
}

function readStoredUsers() {
  const users = readJson<UserProfile[]>(USERS_KEY, [])
  const normalized = ensureSeededAdmin(users)
  if (JSON.stringify(normalized) !== JSON.stringify(users)) {
    saveUsers(normalized)
  }
  return normalized
}

function findActiveUser(email: string, password: string) {
  const user = readStoredUsers().find(item => item.email.toLowerCase() === email.trim().toLowerCase())
  if (!user?.active || user.password !== password) {
    throw new Error('Invalid email or password.')
  }
  return user
}

function saveUsers(users: UserProfile[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function sortUsers(users: UserProfile[]) {
  return [...users].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function redactPassword(user: UserProfile): UserProfile {
  const { password: _password, ...safeUser } = user
  return safeUser
}

function ensureSeededAdmin(users: UserProfile[]) {
  const existing = users.find(user => user.email.toLowerCase() === seededAdmin.email)
  if (!existing) return sortUsers([seededAdmin, ...users])

  return sortUsers(
    users.map(user => {
      const role = appRoles.includes(user.role) ? user.role : 'Procurement Team'
      return user.email.toLowerCase() === seededAdmin.email
        ? {
            ...user,
            id: user.id || seededAdmin.id,
            name: user.name || seededAdmin.name,
            email: seededAdmin.email,
            password: !user.password || user.password === 'admin' ? seededAdmin.password : user.password,
            role: 'Admin',
            title: user.title || seededAdmin.title,
            phone: user.phone ?? seededAdmin.phone,
            active: true,
          }
        : {
            ...user,
            role,
            twoFactorEnabled: user.twoFactorEnabled ?? false,
          }
    }),
  )
}

function toPendingLogin(user: UserProfile): PendingLogin {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    setupSecret: user.twoFactorEnabled ? undefined : user.twoFactorSecret,
    setupUri: user.twoFactorEnabled || !user.twoFactorSecret ? undefined : buildOtpAuthUri(user),
  }
}

function toSession(user: UserProfile): UserSession {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
  }
}

function generateTotpSecret() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

function buildOtpAuthUri(user: UserProfile) {
  const issuer = 'Cronos Procurement'
  const label = `${issuer}:${user.email}`
  const params = new URLSearchParams({
    secret: user.twoFactorSecret ?? '',
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

async function verifyTotpCode(secret: string, code: string) {
  const cleanCode = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(cleanCode)) return false

  const timestep = Math.floor(Date.now() / 1000 / 30)
  const expectedCodes = await Promise.all([-1, 0, 1].map(offset => generateTotpCode(secret, timestep + offset)))
  return expectedCodes.includes(cleanCode)
}

async function generateTotpCode(secret: string, counter: number) {
  const key = await crypto.subtle.importKey('raw', decodeBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const counterBytes = new ArrayBuffer(8)
  const view = new DataView(counterBytes)
  view.setUint32(4, counter, false)
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes))
  const offset = signature[signature.length - 1] & 0x0f
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff)
  return String(binary % 1000000).padStart(6, '0')
}

function decodeBase32(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = secret.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of clean) {
    const index = alphabet.indexOf(char)
    if (index === -1) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(bytes)
}

function syncSessionAfterUserUpdate(users: UserProfile[]) {
  const session = fetchSession()
  if (!session) return

  const user = users.find(item => item.id === session.id)
  if (!user || !user.active) {
    setSession(null)
    return
  }

  setSession(toSession(user))
}
