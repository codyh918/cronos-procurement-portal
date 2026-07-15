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
  const localRawAtStart = window.localStorage.getItem(storageKey) ?? '[]'
  const local = readLocalCollection<T>(storageKey)
  const remote = await loadRemoteRecord<T[]>(recordType, recordKey)
  const localRawAfterRemoteLoad = window.localStorage.getItem(storageKey) ?? '[]'

  if (localRawAfterRemoteLoad !== localRawAtStart) {
    const currentLocal = readLocalCollection<T>(storageKey)
    if (currentLocal.length) {
      try {
        await saveRemoteRecord(recordType, recordKey, currentLocal)
      } catch {
        // Keep the local cache usable even if the remote write is temporarily unavailable.
      }
    }
    return currentLocal
  }

  if (Array.isArray(remote)) {
    const normalized = options.normalize ? options.normalize(remote) : remote
    if (!normalized.length && local.length) {
      console.warn(`Remote ${recordType}:${recordKey} is empty; preserving non-empty local ${storageKey}.`)
      try {
        await saveRemoteRecord(recordType, recordKey, local)
      } catch {
        // Keep the local cache usable even if the remote write is temporarily unavailable.
      }
      return local
    }
    backupLocalCollection(storageKey, `before-hydrate-${recordType}`)
    window.localStorage.setItem(storageKey, JSON.stringify(normalized))
    if (options.eventName) window.dispatchEvent(new Event(options.eventName))
    return normalized
  }

  if (local.length) {
    try {
      await saveRemoteRecord(recordType, recordKey, local)
    } catch {
      // Keep the local cache usable even if the remote write is temporarily unavailable.
    }
  }

  return local
}

type CollectionSyncOptions = {
  mergeById?: boolean
  changedIds?: string[]
}

export function saveLocalAndRemoteCollection<T>(
  storageKey: string,
  recordType: string,
  recordKey: string,
  items: T[],
  eventName?: string,
  options: CollectionSyncOptions = {},
) {
  backupLocalCollection(storageKey, `before-save-${recordType}`)
  window.localStorage.setItem(storageKey, JSON.stringify(items))
  if (eventName) window.dispatchEvent(new Event(eventName))
  void saveRemoteCollection(recordType, recordKey, items, options).catch(error => {
    window.dispatchEvent(new CustomEvent('cronos:remote-sync-error', { detail: error instanceof Error ? error.message : 'Supabase sync failed.' }))
  })
}

async function saveRemoteCollection<T>(recordType: string, recordKey: string, items: T[], options: CollectionSyncOptions) {
  if (!options.mergeById || !options.changedIds?.length) {
    await saveRemoteRecord(recordType, recordKey, items)
    return
  }

  const remote = await loadRemoteRecord<T[]>(recordType, recordKey)
  const merged = Array.isArray(remote) ? mergeCollectionByChangedIds(remote, items, options.changedIds) : items
  await saveRemoteRecord(recordType, recordKey, merged)
}

function mergeCollectionByChangedIds<T>(remoteItems: T[], localItems: T[], changedIds: string[]) {
  const changed = new Set(changedIds)
  const localById = new Map(
    localItems
      .map(item => [recordId(item), item] as const)
      .filter((entry): entry is readonly [string, T] => Boolean(entry[0])),
  )
  const seen = new Set<string>()
  const merged = remoteItems.map(item => {
    const id = recordId(item)
    if (!id || !changed.has(id)) return item
    seen.add(id)
    return localById.get(id) ?? item
  })

  localItems.forEach(item => {
    const id = recordId(item)
    if (id && changed.has(id) && !seen.has(id)) {
      merged.push(item)
    }
  })

  return merged
}

function recordId(item: unknown) {
  if (!item || typeof item !== 'object' || !('id' in item)) return ''
  const id = (item as { id?: unknown }).id
  return typeof id === 'string' ? id : ''
}

export function readLocalCollection<T>(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function listLocalCollectionBackups(storageKey: string) {
  const prefix = `${storageKey}.backup.`
  return Object.keys(window.localStorage)
    .filter(key => key.startsWith(prefix) && key !== `${prefix}latest` && key !== `${prefix}latest.meta`)
    .sort()
    .reverse()
    .map(key => {
      const raw = window.localStorage.getItem(key) ?? '[]'
      return {
        key,
        createdAt: key.replace(prefix, '').replace(/-/g, ':').replace(/:(\d{3})Z$/, '.$1Z'),
        records: safeRecordCount(raw),
      }
    })
}

export async function restoreLocalCollectionBackup<T>(
  storageKey: string,
  backupKey: string,
  recordType: string,
  recordKey: string,
  eventName?: string,
) {
  const raw = window.localStorage.getItem(backupKey)
  if (!raw) throw new Error('Backup was not found in this browser.')

  const items = JSON.parse(raw) as T[]
  if (!Array.isArray(items)) throw new Error('Backup is not a valid collection.')

  backupLocalCollection(storageKey, `before-restore-${recordType}`)
  window.localStorage.setItem(storageKey, JSON.stringify(items))
  if (eventName) window.dispatchEvent(new Event(eventName))
  await saveRemoteRecord(recordType, recordKey, items)
  return items
}

function safeRecordCount(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.length : 0
  } catch {
    return 0
  }
}

function backupLocalCollection(storageKey: string, reason: string) {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw || raw === '[]') return

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupKey = `${storageKey}.backup.${timestamp}`
  const latestKey = `${storageKey}.backup.latest`
  try {
    window.localStorage.setItem(backupKey, raw)
    window.localStorage.setItem(latestKey, raw)
    window.localStorage.setItem(`${latestKey}.meta`, JSON.stringify({ reason, createdAt: new Date().toISOString() }))
    pruneBackups(storageKey, 8)
  } catch (error) {
    console.warn(`Unable to back up ${storageKey} before ${reason}.`, error)
  }
}

function pruneBackups(storageKey: string, keep: number) {
  const prefix = `${storageKey}.backup.`
  const backupKeys = Object.keys(window.localStorage)
    .filter(key => key.startsWith(prefix) && key !== `${prefix}latest` && key !== `${prefix}latest.meta`)
    .sort()

  backupKeys.slice(0, Math.max(0, backupKeys.length - keep)).forEach(key => window.localStorage.removeItem(key))
}
