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

export async function uploadSewpRfqEmail(file: File) {
  const accessToken = await getSupabaseAccessToken()
  if (!accessToken) throw new Error('Secure Atlas authentication is required to use the SEWP RFQ Portal.')
  const response = await fetch('/api/sewp-rfqs/imports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Atlas-Filename': encodeURIComponent(file.name), 'Content-Type': 'application/vnd.ms-outlook' },
    body: file,
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || `SEWP import failed (${response.status}).`)
  return payload as { import: SewpRfqImport }
}

export function updateSewpRfqImport(id: string, extractionData: SewpRfqImport['extraction_data'], readyForApproval = false) {
  return sewpApiRequest<{ import: SewpRfqImport }>(`/api/sewp-rfqs/imports/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ extractionData, readyForApproval }),
  })
}

export function approveSewpRfqImport(id: string, idempotencyKey: string) {
  return sewpApiRequest<{ result: { rfqId: string; projectId: string; projectNumber: string } }>(`/api/sewp-rfqs/imports/${encodeURIComponent(id)}/approve`, {
    method: 'POST', body: JSON.stringify({ idempotencyKey }),
  })
}

export interface SewpImportLine {
  originalOrder: number; originalExcelRow: number; clin: string; brandNameOrEqual: string
  manufacturer: string; manufacturerPartNumber: string; description: string; quantity: number | null
  unitOfIssue: string; unitPrice: number | null; extendedAmount: number | null; notes: string
  worksheetName: string; sourceCells: Record<string, string>
}
export interface SewpRfqImport {
  id: string; status: string; original_filename: string
  extraction_data: {
    fields: Record<string, string | boolean | null>
    lines: SewpImportLine[]
    warnings: Array<{ severity: string; category: string; message: string; affectedField?: string }>
    validations: Array<{ status: string; message: string }>
    attachments: Array<{ filename: string; size: number; sha256: string; mimeType: string }>
  }
}
