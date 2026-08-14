import { getSupabaseAccessToken } from './supabaseAuth'

export type TdSynnexIntegrationStatus = {
  provider: 'TD SYNNEX'
  environment: 'sandbox'
  apiBaseUrl: string
  enabled: boolean
  configured: boolean
  connectionStatus: 'Connected' | 'Not Connected' | 'Error'
  lastSuccessfulConnection: string | null
  lastFailedConnection: string | null
  lastPricingLookup: string | null
  lastError: string | null
  tokenStatus: 'Cached' | 'Refreshing' | 'Not Cached'
  tokenExpiresAt: string | null
}

export type TdSynnexPriceAvailability = {
  manufacturer: string | null
  manufacturerPartNumber: string | null
  tdSynnexSku: string | null
  description: string | null
  unitCost: number | null
  currency: string | null
  availableQuantity: number | null
  availabilityStatus: string | null
  pricingStatus: 'Verified' | 'Unverified' | 'Product Not Found'
  warehouseAvailability: Array<{
    warehouseNumber: number | null
    city: string | null
    postalCode: string | null
    quantity: number | null
    onOrderQuantity: number | null
    estimatedArrivalDate: string | null
  }>
  source: 'TD SYNNEX'
  environment: 'sandbox'
  verifiedAt: string
}

async function integrationRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('An authenticated Atlas session is required.')
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'TD SYNNEX request failed.')
  return payload
}

export async function getTdSynnexStatus() {
  return (await integrationRequest<{ integration: TdSynnexIntegrationStatus }>('/api/integrations/td-synnex/status')).integration
}

export async function testTdSynnexConnection() {
  return integrationRequest<{ ok: true; message: string; status: TdSynnexIntegrationStatus }>('/api/integrations/td-synnex/test', { method: 'POST', body: '{}' })
}

export async function searchTdSynnex(manufacturerPartNumber: string) {
  return integrationRequest<{ results: TdSynnexPriceAvailability[]; requestedPartNumbers: string[]; verifiedAt: string }>('/api/integrations/td-synnex/price-availability', {
    method: 'POST',
    body: JSON.stringify({ manufacturerPartNumber }),
  })
}
