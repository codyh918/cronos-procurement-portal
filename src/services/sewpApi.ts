import { getSupabaseAccessToken } from './supabaseAuth'
import type { SewpCreateInput, SewpRfq, SewpStage } from '../types/sewp'

export async function sewpApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getSupabaseAccessToken()
  if (!accessToken) throw new Error('Secure Atlas authentication is required to use the SEWP RFQ Portal.')

  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || `SEWP request failed (${response.status}).`)
  return payload
}

export function listSewpRfqs(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return sewpApiRequest<{ records: SewpRfq[]; total: number }>(`/api/sewp-rfqs${query}`)
}

export function getSewpRfq(id: string) {
  return sewpApiRequest<{ record: SewpRfq }>(`/api/sewp-rfqs/${encodeURIComponent(id)}`)
}

export function createSewpRfq(input: SewpCreateInput) {
  return sewpApiRequest<{ record: SewpRfq }>('/api/sewp-rfqs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function transitionSewpRfq(id: string, targetStage: SewpStage, expectedVersion: number, justification = '') {
  return sewpApiRequest<{ record: SewpRfq }>(`/api/sewp-rfqs/${encodeURIComponent(id)}/stage-transitions`, {
    method: 'POST',
    body: JSON.stringify({ targetStage, expectedVersion, justification }),
  })
}
