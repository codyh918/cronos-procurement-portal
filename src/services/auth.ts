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

export const appRoles: AppRole[] = ['Admin', 'Procurement Team', 'Engineering', 'Sales']

export type PendingLogin = {
  id: string
  username?: string
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

export async function beginLogin(email: string, password: string): Promise<PendingLogin> {
  if (hasSupabaseAuth()) {
    const secureUser = await signInWithSupabase(email, password)
    const users = readStoredUsers()
    const updated = sortUsers([secureUser, ...users.filter(user => user.id !== secureUser.id && user.email.toLowerCase() !== secureUser.email.toLowerCase())])
    saveUsers(updated)
    pendingSupabaseSession = toSession(secureUser)
    return toPendingLogin(secureUser)
  }
  throw new Error('Supabase Auth is not configured.')
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

export function cacheUsers(users: UserProfile[]) {
  const safeUsers = sortUsers(users.map(redactPassword))
  saveUsers(safeUsers)
  return safeUsers
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
  if (value === 'engineering') return 'engineering'
  if (value === 'sales') return 'sales'
  return 'procurement'
}

function readStoredUsers() {
  void hydrateUsers()
  const users = readLocalCollection<UserProfile>(USERS_KEY)
  return sortUsers(users.map(redactPassword))
}

function hydrateUsers(force = false) {
  if (typeof window === 'undefined') return Promise.resolve([] as UserProfile[])
  if (usersHydration && !force) return usersHydration

  usersHydration = hydrateLocalCollection<UserProfile>(USERS_KEY, USERS_REMOTE_TYPE, USERS_REMOTE_KEY, {
    eventName: 'cronos:users-changed',
    normalize: users => sortUsers(users.map(redactPassword)),
  })
  return usersHydration
}

function saveUsers(users: UserProfile[]) {
  saveLocalAndRemoteCollection(USERS_KEY, USERS_REMOTE_TYPE, USERS_REMOTE_KEY, users.map(redactPassword), 'cronos:users-changed')
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
  const safeUser = { ...user } as UserProfile & { password?: unknown }
  delete safeUser.password
  return safeUser
}

function toPendingLogin(user: UserProfile): PendingLogin {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
  }
}

function toSession(user: UserProfile): UserSession {
  return {
    id: user.id,
    username: user.username,
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
