import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppRole, UserProfile } from '../types'

let client: SupabaseClient | null | undefined

export function hasSupabaseAuth() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export async function signInWithSupabase(login: string, password: string): Promise<UserProfile> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: login.trim(), password }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; accessToken?: string; refreshToken?: string }
  if (!response.ok || !payload.accessToken || !payload.refreshToken) throw new Error(payload.error || 'Invalid login credentials.')
  const { data, error } = await supabase.auth.setSession({ access_token: payload.accessToken, refresh_token: payload.refreshToken })
  if (error || !data.user) throw new Error(error?.message || 'Invalid email or password.')

  const metadata = data.user.user_metadata || {}
  const appMetadata = data.user.app_metadata || {}
  const role = normalizeAppRole(appMetadata.atlas_role || metadata.atlas_role || metadata.role)
  return {
    id: data.user.id,
    supabaseAuthUserId: data.user.id,
    username: String(metadata.username || ''),
    firstName: String(metadata.first_name || ''),
    lastName: String(metadata.last_name || ''),
    name: String(metadata.full_name || metadata.name || data.user.email || 'Atlas User'),
    email: data.user.email || '',
    role,
    title: String(metadata.title || ''),
    phone: String(metadata.phone || data.user.phone || ''),
    active: appMetadata.active !== false,
  }
}

export async function getSupabaseAccessToken() {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return ''
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export async function signOutSupabase() {
  await getSupabaseAuthClient()?.auth.signOut()
}

export async function validateSupabaseAccess() {
  const supabase = getSupabaseAuthClient()
  if (!supabase) return false
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user || data.user.app_metadata?.active === false) {
    await supabase.auth.signOut()
    return false
  }
  return true
}

function getSupabaseAuthClient() {
  if (client !== undefined) return client
  client = hasSupabaseAuth()
    ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null
  return client
}

function normalizeAppRole(value: unknown): AppRole {
  return String(value || '').trim().toLowerCase() === 'admin' ? 'Admin' : 'Procurement Team'
}
