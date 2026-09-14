import { randomUUID } from 'node:crypto'
import { authenticateSewpRequest } from './sewp-auth.mjs'
import { applyManagedFundsCommand, initializeManagedFunds, reconcileManagedProject, canManageFunds, isManagedFunds } from '../src/domain/managedFunds.mjs'

const migrationActor = { id: 'atlas-managed-funds-migration', name: 'Atlas legacy migration', role: 'admin' }
export class ManagedFundsRepository {
  constructor(supabase) { this.db = supabase }
  async project(id) {
    const { data, error } = await this.db.from('app_records').select('data').eq('record_type', 'projects').eq('record_key', 'all').maybeSingle()
    if (error) throw error
    return (Array.isArray(data?.data) ? data.data : []).find(p => p.id === id)
  }
  async state(id) {
    const { data, error } = await this.db.from('atlas_managed_funds').select('state,revision').eq('project_id', id).maybeSingle()
    if (error) { const e = new Error('Managed Funds persistence is unavailable. Apply the Managed Funds database migration.'); e.status = 503; throw e }
    return data ? { ...data.state, revision: data.revision } : null
  }
  async commit(id, previousProject, project, state, expectedRevision) {
    const clean = value => { if (!value) return null; const { managedFunds, ...rest } = value; return rest }
    const { data, error } = await this.db.rpc('atlas_commit_managed_funds', { p_project_id: id, p_expected_revision: expectedRevision, p_previous_project: clean(previousProject), p_project: clean(project), p_state: state })
    if (error) { const e = new Error(/conflict/i.test(error.message) ? 'This project changed in another session. Reload before retrying.' : error.message); e.status = /conflict/i.test(error.message) ? 409 : 400; throw e }
    return data
  }
  async load(id) {
    const project = await this.project(id)
    if (!project || !isManagedFunds(project)) { const e = new Error('Managed Funds project not found.'); e.status = 404; throw e }
    let state = await this.state(id)
    if (!state) {
      const initialized = initializeManagedFunds(project, migrationActor)
      try { await this.commit(id, project, initialized.project, initialized.state, -1) }
      catch (e) { if (e.status !== 409) throw e }
      state = await this.state(id)
      if (!state) throw new Error('Managed Funds initialization failed.')
      return { project: await this.project(id), state }
    }
    return { project, state }
  }
}

export async function handleManagedFundsApi({ request, response, pathname, sendJson, readJsonBody, readBufferBody, supabase, repository }) {
  if (!pathname.startsWith('/api/managed-funds')) return false
  const auth = await authenticateSewpRequest(request, supabase)
  if (!auth.ok) { sendJson(response, auth.status, { error: auth.error }); return true }
  // Privileged financial roles come exclusively from server-managed metadata.
  // authenticateSewpRequest also supports legacy user_metadata roles for other modules.
  const token = request.headers.authorization.replace(/^Bearer\s+/i, '')
  const verified = await supabase.auth.getUser(token)
  const trusted = verified.data?.user?.app_metadata || {}
  const actor = { ...auth.user, role: trusted.atlas_role || 'engineering', permissions: Array.isArray(trusted.atlas_permissions) ? trusted.atlas_permissions : [] }
  if (!canManageFunds(actor, 'view')) { sendJson(response, 403, { error: 'Managed Funds access is not permitted.' }); return true }
  const repo = repository || new ManagedFundsRepository(supabase)
  try {
    const match = pathname.match(/^\/api\/managed-funds\/([^/]+)(?:\/(commands|project|documents|document-link))?$/)
    if (!match) { sendJson(response, 404, { error: 'Managed Funds route not found.' }); return true }
    const projectId = decodeURIComponent(match[1]), operation = match[2]
    if (operation === 'project' && request.method === 'PUT') {
      const body = await readJsonBody(request, 25 * 1024 * 1024)
      if (!body.project || body.project.id !== projectId || !isManagedFunds(body.project)) throw new Error('Invalid Managed Funds project.')
      const previous = await repo.project(projectId)
      const currentState = await repo.state(projectId)
      if (!previous || !isManagedFunds(previous)) {
        if (!canManageFunds(actor, 'funding')) { sendJson(response, 403, { error: 'Permission required: atlas.managed_funds.funding' }); return true }
        const initial = initializeManagedFunds(body.project, actor)
        await repo.commit(projectId, previous, initial.project, initial.state, -1)
      } else {
        const loaded = currentState ? { project: previous, state: currentState } : await repo.load(projectId)
        if (body.revision !== loaded.state.revision) { sendJson(response, 409, { error: 'This project changed. Reload before saving.' }); return true }
        const reconciled = reconcileManagedProject(loaded.state, loaded.project, body.project, actor)
        await repo.commit(projectId, loaded.project, reconciled.project, reconciled.state, loaded.state.revision)
      }
      sendJson(response, 200, { ...(await repo.load(projectId)), actor }); return true
    }
    const loaded = await repo.load(projectId)
    if (!operation && request.method === 'GET') { sendJson(response, 200, { ...loaded, actor }); return true }
    if (operation === 'commands' && request.method === 'POST') {
      const body = await readJsonBody(request)
      const existing = loaded.state.commands.find(c => c.id === body.command?.id)
      // Check idempotency before revision so a lost success response can be retried safely.
      if (!existing && body.revision !== loaded.state.revision) { sendJson(response, 409, { error: 'This project changed. Reload before retrying.' }); return true }
      if (body.command?.type === 'document') throw new Error('Use the upload endpoint for supporting documents.')
      if (body.command?.type === 'draft_invoice') body.command.input.projectNumber = loaded.project.projectNumber
      const next = applyManagedFundsCommand(loaded.state, body.command, actor, { project: loaded.project })
      if (!existing) await repo.commit(projectId, loaded.project, loaded.project, next, loaded.state.revision)
      sendJson(response, 200, { ...(await repo.load(projectId)), actor }); return true
    }
    if (operation === 'documents' && request.method === 'POST') {
      if (!canManageFunds(actor, 'edit')) { sendJson(response, 403, { error: 'Document upload permission required.' }); return true }
      const query = new URL(request.url, 'http://localhost').searchParams
      const actionId = query.get('actionId'), name = query.get('name') || 'Supporting document', kind = query.get('kind') || 'Supporting document'
      if (!loaded.state.actions.some(a => a.id === actionId)) throw new Error('Action not found.')
      if (Number(query.get('revision')) !== loaded.state.revision) { sendJson(response, 409, { error: 'This project changed. Reload before uploading.' }); return true }
      const ext = name.split('.').pop().toLowerCase()
      if (!['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'xlsx', 'docx', 'msg', 'eml'].includes(ext)) throw new Error('Unsupported document format.')
      const buffer = await readBufferBody(request, 20 * 1024 * 1024)
      if (!buffer.length) throw new Error('Document is empty.')
      const storagePath = `${projectId}/${actionId}/${randomUUID()}.${ext}`
      const bucket = supabase.storage.from('atlas-managed-funds')
      const upload = await bucket.upload(storagePath, buffer, { contentType: request.headers['content-type'] || 'application/octet-stream', upsert: false })
      if (upload.error) throw upload.error
      try {
        const next = applyManagedFundsCommand(loaded.state, { id: randomUUID(), type: 'document', actionId, input: { name, kind, storagePath, size: buffer.length } }, actor)
        await repo.commit(projectId, loaded.project, loaded.project, next, loaded.state.revision)
      } catch (e) { await bucket.remove([storagePath]); throw e }
      sendJson(response, 201, { ...(await repo.load(projectId)), actor }); return true
    }
    if (operation === 'document-link' && request.method === 'POST') {
      const body = await readJsonBody(request), document = loaded.state.documents.find(d => d.id === body.documentId)
      if (!document) throw new Error('Document not found.')
      const { data, error } = await supabase.storage.from('atlas-managed-funds').createSignedUrl(document.storagePath, 120, { download: document.name })
      if (error) throw error
      sendJson(response, 200, { url: data.signedUrl }); return true
    }
    sendJson(response, 405, { error: 'Method not allowed.' })
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message || 'Managed Funds operation failed.', ...(error.details ? { funding: error.details } : {}) })
  }
  return true
}
