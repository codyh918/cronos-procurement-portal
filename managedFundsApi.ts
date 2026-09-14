import { getSupabaseAccessToken } from './supabaseAuth'
import type { Project } from '../types'
import type { FundsActor, FundsCommand, FundsState } from '../domain/managedFunds.mjs'
export type FundsWorkspace = { project: Project; state: FundsState; actor: FundsActor }
export type FundsError = Error & { status?: number; funding?: Record<string, number> }
const cacheKey = (id: string) => `cronos.managed-funds.${id}`
export function cachedFunds(id: string): FundsState | undefined {
  try { return JSON.parse(window.localStorage.getItem(cacheKey(id)) || 'null') || undefined } catch { return undefined }
}
export function cacheFunds(workspace: FundsWorkspace) {
  const project = { ...workspace.project, managedFundsRevision: workspace.state.revision }
  try {
    window.localStorage.setItem(cacheKey(project.id), JSON.stringify(workspace.state))
    const projects: Project[] = JSON.parse(window.localStorage.getItem('cronos.projects') || '[]')
    window.localStorage.setItem('cronos.projects', JSON.stringify(projects.some(p => p.id === project.id) ? projects.map(p => p.id === project.id ? project : p) : [project, ...projects]))
    window.dispatchEvent(new Event('cronos:projects-changed'))
  } catch { /* The authoritative server response remains available if browser storage is full. */ }
  return { ...workspace, project: { ...project, managedFunds: workspace.state } }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('Sign in to Atlas to use Managed Funds.')
  const response = await fetch(`/api/managed-funds/${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
  const body = await response.json().catch(() => ({ error: 'Managed Funds service is unavailable.' }))
  if (!response.ok) { const error: FundsError = new Error(body.error || 'Managed Funds request failed.'); error.status = response.status; error.funding = body.funding; throw error }
  return body
}
export async function loadFundsWorkspace(projectId: string) { return cacheFunds(await request<FundsWorkspace>(encodeURIComponent(projectId))) }
export async function saveFundsProject(project: Project) {
  const { managedFunds, ...record } = project
  return cacheFunds(await request<FundsWorkspace>(`${encodeURIComponent(project.id)}/project`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: record, revision: project.managedFundsRevision ?? managedFunds?.revision ?? -1 }) }))
}
export async function runFundsCommand(projectId: string, revision: number, command: FundsCommand) {
  return cacheFunds(await request<FundsWorkspace>(`${encodeURIComponent(projectId)}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, command }) }))
}
export async function uploadFundsDocument(projectId: string, actionId: string, revision: number, file: File, kind: string) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Supporting documents must be 20 MB or smaller.')
  const query = new URLSearchParams({ actionId, name: file.name, kind, revision: String(revision) })
  return cacheFunds(await request<FundsWorkspace>(`${encodeURIComponent(projectId)}/documents?${query}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file }))
}
export async function downloadFundsDocument(projectId: string, documentId: string) {
  const result = await request<{ url: string }>(`${encodeURIComponent(projectId)}/document-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId }) })
  const a = document.createElement('a'); a.href = result.url; a.rel = 'noopener'; a.click()
}
