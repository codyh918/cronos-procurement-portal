import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
  if (!supabase) return

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
    await saveRemoteRecord(recordType, recordKey, local)
  }

  return local
}

export function saveLocalAndRemoteCollection<T>(storageKey: string, recordType: string, recordKey: string, items: T[], eventName?: string) {
  window.localStorage.setItem(storageKey, JSON.stringify(items))
  if (eventName) window.dispatchEvent(new Event(eventName))
  void saveRemoteRecord(recordType, recordKey, items)
}

export function readLocalCollection<T>(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}
