import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppRole, UserProfile } from '../types'

let client: SupabaseClient | null | undefined

export function hasSupabaseAuth() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export async function signInWithSupabase(email: string, password: string): Promise<UserProfile> {
  const supabase = getSupabaseAuthClient()
  if (!supabase) throw new Error('Supabase Auth is not configured.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.user) throw new Error(error?.message || 'Invalid email or password.')

  const metadata = data.user.user_metadata || {}
  const appMetadata = data.user.app_metadata || {}
  const role = normalizeAppRole(appMetadata.atlas_role || metadata.atlas_role || metadata.role)
  return {
    id: data.user.id,
    name: String(metadata.full_name || metadata.name || data.user.email || 'Atlas User'),
    email: data.user.email || email.trim().toLowerCase(),
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
