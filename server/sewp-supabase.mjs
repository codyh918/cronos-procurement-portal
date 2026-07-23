import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { loadSewpConfig } from './sewp-config.mjs'

let client

export function getSewpSupabase() {
  if (client !== undefined) return client
  const config = loadSewpConfig()
  client = config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        realtime: { transport: WebSocket },
      })
    : null
  return client
}
