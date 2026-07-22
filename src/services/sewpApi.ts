import { getSupabaseAccessToken } from './supabaseAuth'

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
