import { getSupabaseAccessToken } from './supabaseAuth'
export type PilotCollection = 'customers' | 'customer-addresses' | 'vendors'
export async function replacePilotCollection<T>(collection: PilotCollection, records: T[]) {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('An authenticated session is required to save business data.')
  const response = await fetch(`/api/data/${collection}/bulk`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error || `Unable to save ${collection}.`)
}

export async function createVendorRecord<T>(vendor: T, duplicateOverride = false) {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('You must be signed in to add a vendor.')
  const response = await fetch('/api/data/vendors', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendor, duplicateOverride }),
  })
  const payload = await response.json().catch(() => ({})) as {
    error?: string; vendor?: T; message?: string; possibleDuplicate?: { legal_name?: string }
  }
  if (!response.ok) {
    const error = new Error(payload.error || 'Unable to add vendor.') as Error & { status?: number; possibleDuplicate?: { legal_name?: string } }
    error.status = response.status
    error.possibleDuplicate = payload.possibleDuplicate
    throw error
  }
  return { vendor: payload.vendor as T, message: payload.message || 'Vendor added.' }
}
