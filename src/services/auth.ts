import type { AppRole, UserProfile, UserSession } from '../types'
import { hydrateLocalCollection, readLocalCollection, saveLocalAndRemoteCollection } from './remoteRecords'
import { hasSupabaseAuth, signInWithSupabase, signOutSupabase } from './supabaseAuth'

const USERS_KEY = 'cronos.users'
const SESSION_KEY = 'cronos.session'
const ROLE_PREVIEW_KEY = 'cronos.rolePreview'
const CURRENT_AUTH_VERSION = 3
const USERS_REMOTE_TYPE = 'app_users'
const USERS_REMOTE_KEY = 'all'
let usersHydration: Promise<UserProfile[]> | null = null
let pendingSupabaseSession: UserSession | null = null

export const appRoles: AppRole[] = ['Admin', 'Procurement Team']

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
}

export function fetchSession(): UserSession | null {
  const session = readJson<UserSession | null>(SESSION_KEY, null)
  if (!session) return null
  if (session.authVersion !== CURRENT_AUTH_VERSION) {
    setSession(null)
    return null
  }

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
  return fetchSession()
}

export function loginUser(email: string, password: string) {
  const user = findActiveUser(email, password)
  const session = toSession(user)
  setSession(session)
  return session
}

export async function beginLogin(email: string, password: string): Promise<PendingLogin> {
  if (hasSupabaseAuth()) {
    const secureUser = await signInWithSupabase(email, password)
    const users = readStoredUsers()
    const updated = sortUsers([secureUser, ...users.filter(user => user.id !== secureUser.id && user.email.toLowerCase() !== secureUser.email.toLowerCase())])
    saveUsers(updated)
    pendingSupabaseSession = toSession(secureUser)
    return toPendingLogin(secureUser)
  }
  await hydrateUsers(true)
  const user = findActiveUser(email, password)
  return toPendingLogin(user)
}

export async function completeLogin(userId: string, _code = '') {
  if (pendingSupabaseSession?.id === userId) {
    const session = pendingSupabaseSession
    pendingSupabaseSession = null
    setSession(session)
    return session
  }
  await hydrateUsers(true)
  const users = readStoredUsers()
  const user = users.find(item => item.id === userId)
  if (!user?.active) {
    throw new Error('Invalid email or password.')
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
  void signOutSupabase()
  setSession(null)
}

export function loadUsers() {
  void hydrateUsers()
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

export function normalizeRole(role: AppRole | string | null | undefined) {
  const value = String(role ?? '').trim().toLowerCase()
  if (value === 'admin') return 'admin'
  return 'procurement'
}

function readStoredUsers() {
  void hydrateUsers()
  const users = readLocalCollection<UserProfile>(USERS_KEY)
  const normalized = ensureSeededAdmin(users)
  if (JSON.stringify(normalized) !== JSON.stringify(users)) {
    saveUsers(normalized)
  }
  return normalized
}

function hydrateUsers(force = false) {
  if (typeof window === 'undefined') return Promise.resolve([] as UserProfile[])
  if (usersHydration && !force) return usersHydration

  usersHydration = hydrateLocalCollection<UserProfile>(USERS_KEY, USERS_REMOTE_TYPE, USERS_REMOTE_KEY, {
    eventName: 'cronos:users-changed',
    normalize: ensureSeededAdmin,
  })
  return usersHydration
}

function findActiveUser(email: string, password: string) {
  const user = readStoredUsers().find(item => item.email.toLowerCase() === email.trim().toLowerCase())
  if (!user?.active || user.password !== password) {
    throw new Error('Invalid email or password.')
  }
  return user
}

function saveUsers(users: UserProfile[]) {
  saveLocalAndRemoteCollection(USERS_KEY, USERS_REMOTE_TYPE, USERS_REMOTE_KEY, users, 'cronos:users-changed')
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
  }
}

function toSession(user: UserProfile): UserSession {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    authVersion: CURRENT_AUTH_VERSION,
  }
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
