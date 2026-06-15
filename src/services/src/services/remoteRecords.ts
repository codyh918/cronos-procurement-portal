import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAppBaseUrl } from './environment'

let client: SupabaseClient | null | undefined

function getClient() {
  if (client !== undefined) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  client = url && key ? createClient(url, key) : null
  return client
}

export function hasRemoteRecords() {
  return Boolean(getClient())
}

export function getRemoteConfigStatus() {
  return {
    hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
    hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
    ready: Boolean(getClient()),
  }
}

export async function loadRemoteRecord<T>(recordType: string, recordKey: string): Promise<T | null> {
  const supabase = getClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('app_records')
    .select('data')
    .eq('record_type', recordType)
    .eq('record_key', recordKey)
    .maybeSingle()

  if (error) {
    console.warn(`Unable to load ${recordType}:${recordKey} from Supabase`, error)
    return null
  }

  return (data?.data as T | undefined) ?? null
}

export async function saveRemoteRecord<T>(recordType: string, recordKey: string, data: T) {
  const supabase = getClient()
  if (!supabase) {
    throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Railway variables.')
  }

  const { error } = await supabase.from('app_records').upsert(
    {
      record_type: recordType,
      record_key: recordKey,
      data,
    },
    { onConflict: 'record_type,record_key' },
  )

  if (error) {
    console.warn(`Unable to save ${recordType}:${recordKey} to Supabase`, error)
    throw new Error(error.message)
  }
}

export async function testRemoteConnection() {
  const status = getRemoteConfigStatus()
  if (!status.ready) {
    return {
      ok: false,
      message: `Supabase config missing. URL: ${status.hasUrl ? 'found' : 'missing'}, key: ${status.hasKey ? 'found' : 'missing'}.`,
    }
  }

  try {
    await saveRemoteRecord('diagnostics', 'last_test', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      origin: getAppBaseUrl(),
    })
    return { ok: true, message: 'Supabase write succeeded. Check app_records for diagnostics / last_test.' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Supabase write failed.',
    }
  }
}

export async function hydrateLocalCollection<T>(
  storageKey: string,
  recordType: string,
  recordKey: string,
  options: {
    eventName?: string
    normalize?: (items: T[]) => T[]
  } = {},
) {
  const remote = await loadRemoteRecord<T[]>(recordType, recordKey)
  if (Array.isArray(remote)) {
    const normalized = options.normalize ? options.normalize(remote) : remote
    window.localStorage.setItem(storageKey, JSON.stringify(normalized))
    if (options.eventName) window.dispatchEvent(new Event(options.eventName))
    return normalized
  }

  const local = readLocalCollection<T>(storageKey)
  if (local.length) {
    try {
      await saveRemoteRecord(recordType, recordKey, local)
    } catch {
      // Keep the local cache usable even if the remote write is temporarily unavailable.
    }
  }

  return local
}

export function saveLocalAndRemoteCollection<T>(storageKey: string, recordType: string, recordKey: string, items: T[], eventName?: string) {
  window.localStorage.setItem(storageKey, JSON.stringify(items))
  if (eventName) window.dispatchEvent(new Event(eventName))
  void saveRemoteRecord(recordType, recordKey, items).catch(error => {
    window.dispatchEvent(new CustomEvent('cronos:remote-sync-error', { detail: error instanceof Error ? error.message : 'Supabase sync failed.' }))
  })
}

export function readLocalCollection<T>(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}
