import { authenticateSewpRequest, requirePermission } from './sewp-auth.mjs'
import { tdSynnexService, TdSynnexError } from './td-synnex-service.mjs'

export async function handleTdSynnexApi({ request, response, pathname, sendJson, readJsonBody, authClient, service = tdSynnexService }) {
  if (!pathname.startsWith('/api/integrations/td-synnex')) return false

  const auth = await authenticateSewpRequest(request, authClient)
  const allowed = requirePermission(auth, 'atlas.integration.manage')
  if (!allowed.ok) { sendJson(response, allowed.status, { error: allowed.error }); return true }

  try {
    if (request.method === 'GET' && pathname === '/api/integrations/td-synnex/status') {
      sendJson(response, 200, { integration: service.status() })
      return true
    }
    if (request.method === 'POST' && pathname === '/api/integrations/td-synnex/test') {
      sendJson(response, 200, await service.testConnection())
      return true
    }
    if (request.method === 'POST' && pathname === '/api/integrations/td-synnex/price-availability') {
      const body = await readJsonBody(request)
      const partNumbers = Array.isArray(body.partNumbers) ? body.partNumbers : [body.manufacturerPartNumber]
      sendJson(response, 200, await service.getPriceAvailability(partNumbers))
      return true
    }
    sendJson(response, 404, { error: 'TD SYNNEX integration route not found.' })
  } catch (error) {
    const safeError = error instanceof TdSynnexError ? error : new TdSynnexError('TD SYNNEX request failed.')
    sendJson(response, safeError.status, { error: safeError.message, code: safeError.code, retryable: safeError.retryable })
  }
  return true
}

