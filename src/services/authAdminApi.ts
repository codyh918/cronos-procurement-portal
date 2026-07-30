import type { AppRole, UserProfile } from '../types'
import { getSupabaseAccessToken } from './supabaseAuth'

export type CreateAtlasUserInput = {
  username: string
  firstName: string
  lastName: string
  email: string
  password: string
  role: AppRole
  title: string
  phone: string
  active: boolean
}

async function authRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('Authentication service failure.')
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Authentication service failure.')
  return payload
}

export async function listAtlasUsers() {
  return (await authRequest<{ users: UserProfile[] }>('/api/auth/users')).users
}

export async function createAtlasUser(input: CreateAtlasUserInput) {
  return authRequest<{ user: UserProfile; message: string }>('/api/auth/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateAtlasUser(userId: string, updates: { role?: AppRole; active?: boolean; title?: string; phone?: string }) {
  return (await authRequest<{ user: UserProfile }>(`/api/auth/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })).user
}

export async function initiateAtlasPasswordReset(userId: string) {
  return authRequest<{ message: string }>(`/api/auth/users/${userId}/password-reset`, { method: 'POST', body: '{}' })
}
