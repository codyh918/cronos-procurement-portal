import { randomUUID } from 'node:crypto'
import { authenticateSewpRequest, requirePermission } from './sewp-auth.mjs'
import { DataValidationError, SupabasePilotRepository } from './data-repositories.mjs'
export async function handleDataApi({ request, response, pathname, sendJson, readJsonBody, supabase }) {
  if (!pathname.startsWith('/api/data/')) return false
  const auth = await authenticateSewpRequest(request, supabase)
  const permission = request.method === 'POST' && pathname === '/api/data/vendors' ? 'atlas.vendor.create' : request.method === 'GET' ? 'atlas.data.view' : 'atlas.data.write'
  const allowed = requirePermission(auth, permission)
  if (!allowed.ok) { sendJson(response, allowed.status, { error: allowed.error }); return true }
  if (!supabase) { sendJson(response, 503, { error: 'Atlas data persistence is not configured.' }); return true }
  if (request.method === 'POST' && pathname === '/api/data/vendors') {
    try {
      const profile = await supabase.from('atlas_user_profiles').select('is_active,username,display_name').eq('auth_user_id', auth.user.id).maybeSingle()
      if (profile.data?.is_active === false) { sendJson(response, 403, { error: 'This Atlas account is inactive.' }); return true }
      const body = await readJsonBody(request)
      const repository = new SupabasePilotRepository(supabase)
      const vendor = await repository.createVendor(body.vendor || {}, {
        ...auth.user, username: profile.data?.username || auth.user.username,
        name: profile.data?.display_name || auth.user.name,
      }, body.duplicateOverride === true)
      sendJson(response, 201, { vendor, message: `${vendor.vendor} added to the vendor directory.` })
    } catch (error) {
      sendJson(response, error instanceof DataValidationError ? error.status : 400, {
        error: error instanceof Error ? error.message : 'Vendor creation failed.',
        ...(error instanceof DataValidationError ? error.details : {}),
      })
    }
    return true
  }
  const match = pathname.match(/^\/api\/data\/(customers|customer-addresses|vendors)\/(bulk|reconcile|export)$/)
  if (!match) { sendJson(response, 404, { error: 'Data route not found.' }); return true }
  const [, collection, action] = match
  const repository = new SupabasePilotRepository(supabase)
  try {
    if (request.method === 'PUT' && action === 'bulk') {
      const body = await readJsonBody(request)
      if (!Array.isArray(body.records)) throw new Error('records must be an array')
      sendJson(response, 200, { ...(await repository.replaceCollection(collection, body.records, auth.user.id)), requestId: randomUUID() })
      return true
    }
    if (request.method === 'GET' && action === 'reconcile') {
      sendJson(response, 200, await repository.reconcile(collection)); return true
    }
    if (request.method === 'GET' && action === 'export') {
      sendJson(response, 200, { schemaVersion: 'atlas-portable-v1', exportedAt: new Date().toISOString(), entity: collection, records: await repository.exportCollection(collection) })
      return true
    }
    sendJson(response, 405, { error: 'Method not allowed.' })
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Data operation failed.' })
  }
  return true
}
