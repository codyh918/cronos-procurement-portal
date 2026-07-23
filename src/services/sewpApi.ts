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

export function deleteSewpRfq(id: string) {
  return sewpApiRequest<{ record: Pick<SewpRfq, 'id' | 'official_rfq_number' | 'atlas_opportunity_number' | 'current_stage' | 'version'> & { deleted_at: string } }>(
    `/api/sewp-rfqs/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export interface DeletedSewpRfq {
  id: string
  atlas_opportunity_number: string
  official_rfq_number: string
  title: string
  agency: string | null
  current_stage: SewpStage
  deleted_at: string
  atlas_project_id: string | null
  import_id: string | null
}

export function listDeletedSewpRfqs() {
  return sewpApiRequest<{ records: DeletedSewpRfq[] }>('/api/sewp-rfqs/deleted')
}

export function restoreSewpRfq(id: string) {
  return sewpApiRequest<{ record: SewpRfq }>(`/api/sewp-rfqs/${encodeURIComponent(id)}/restore`, { method: 'POST' })
}

export function permanentlyDeleteSewpRfq(id: string) {
  return sewpApiRequest<{ result: { rfqId: string; officialRfqNumber: string; projectId: string | null; importId: string | null }; storageWarnings: string[] }>(
    `/api/sewp-rfqs/${encodeURIComponent(id)}/permanent`,
    { method: 'DELETE' },
  )
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

export function getSewpWorkspace(id: string) {
  return sewpApiRequest<SewpWorkspace>(`/api/sewp-rfqs/${encodeURIComponent(id)}/workspace`)
}

export function getSewpDocumentDownload(id: string, documentId: string) {
  return sewpApiRequest<{ url: string; expiresIn: number }>(
    `/api/sewp-rfqs/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download`,
    { method: 'POST' },
  )
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

export interface SewpWorkspace {
  documents: Array<{ id: string; category: string; display_name: string; detected_mime_type: string; file_size_bytes: number; sha256: string; document_version: number; processing_status: string; uploaded_at: string }>
  lines: Array<{ id: string; line_number: string; clin: string; manufacturer: string; requested_part_number: string; description: string; quantity: number; unit_of_measure: string; notes: string; review_status: string }>
  requirements: Array<{ id: string; category: string; requirement_text: string; applicability: string; human_status: string; reviewed_at: string | null }>
  tasks: Array<{ id: string; task_type: string; title: string; priority: string; due_at: string | null; status: string; notes: string; completed_at: string | null }>
  auditEvents: Array<{ id: string; action: string; entity_type: string; reason: string | null; occurred_at: string; actor_type: string }>
  stageHistory: Array<{ id: string; from_stage: string | null; to_stage: string; justification: string | null; occurred_at: string; rfq_version: number }>
  project: null | { id: string; project_number: string; project_name: string; status: string; vehicle: string; government_customer: Record<string, string>; customer_address: { formatted?: string }; shipping_information: { organization?: string; address?: string }; reply_deadline: string | null; requirements: Record<string, unknown> }
  import: null | { id: string; status: string; fields: Record<string, string | boolean | null>; warnings: Array<{ severity: string; category: string; message: string }>; approvedAt: string | null }
}
