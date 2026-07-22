import { randomUUID } from 'node:crypto'
import { authenticateSewpRequest, requirePermission } from './sewp-auth.mjs'
import { loadSewpConfig, sewpConfigStatus } from './sewp-config.mjs'
import { getSewpSupabase } from './sewp-supabase.mjs'
import { validateCreateRfq, validatePagination, validateStageTransition } from './sewp-validation.mjs'

export async function handleSewpApi({ request, response, pathname, sendJson, readJsonBody }) {
  if (!pathname.startsWith('/api/sewp-rfqs')) return false

  const requestId = randomUUID()
  response.setHeader('X-Request-Id', requestId)

  if (request.method === 'GET' && pathname === '/api/sewp-rfqs/health') {
    sendJson(response, 200, {
      service: 'Atlas SEWP RFQ API',
      status: 'ok',
      requestId,
      configuration: sewpConfigStatus(),
      cuiApproved: false,
      warning: 'Do not upload CUI. This environment has not been formally approved for CUI handling.',
    })
    return true
  }

  const supabase = getSewpSupabase()
  const auth = await authenticateSewpRequest(request, supabase)
  if (!auth.ok) {
    sendJson(response, auth.status, { error: auth.error, requestId })
    return true
  }
  if (!supabase) {
    sendJson(response, 503, { error: 'SEWP database service is not configured.', requestId })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/sewp-rfqs') {
    const allowed = requirePermission(auth, 'sewp.rfq.view')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    const url = new URL(request.url || '/', 'http://localhost')
    const page = validatePagination(url)
    let query = supabase
      .from('sewp_rfqs')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('response_due_at', { ascending: true, nullsFirst: false })
      .range(page.from, page.to)
    const search = url.searchParams.get('search')?.trim()
    if (search) query = query.or(`official_rfq_number.ilike.%${escapeFilter(search)}%,atlas_opportunity_number.ilike.%${escapeFilter(search)}%,title.ilike.%${escapeFilter(search)}%`)
    const { data, error, count } = await query
    if (error) return databaseError(response, sendJson, error, requestId)
    sendJson(response, 200, { records: data || [], page: page.page, pageSize: page.pageSize, total: count || 0, requestId })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/sewp-rfqs') {
    const allowed = requirePermission(auth, 'sewp.rfq.create')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    try {
      const validation = validateCreateRfq(await readJsonBody(request))
      if (!validation.ok) {
        sendJson(response, 400, { error: 'Invalid RFQ.', details: validation.errors, requestId })
        return true
      }
      const input = validation.value
      const opportunityNumber = await nextOpportunityNumber(supabase)
      const row = {
        atlas_opportunity_number: opportunityNumber,
        official_rfq_number: input.officialRfqNumber,
        title: input.title,
        agency: input.agency || null,
        customer_organization: input.customerOrganization || null,
        source: input.source,
        category: input.category || null,
        set_aside: input.setAside || null,
        priority: input.priority,
        response_due_at: input.responseDueAt,
        questions_due_at: input.questionsDueAt,
        response_time_zone: input.responseTimeZone,
        estimated_value: input.estimatedValue,
        owner_user_id: input.ownerUserId,
        backup_owner_user_id: input.backupOwnerUserId,
        notes: input.notes || null,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      }
      const { data, error } = await supabase.from('sewp_rfqs').insert(row).select('*').single()
      if (error?.code === '23505') {
        sendJson(response, 409, { error: 'An RFQ with this SEWP number and source already exists.', requestId })
        return true
      }
      if (error) return databaseError(response, sendJson, error, requestId)
      await writeAudit(supabase, {
        rfqId: data.id,
        actorUserId: auth.user.id,
        action: 'rfq.created',
        entityType: 'sewp_rfq',
        entityId: data.id,
        newValue: data,
        requestId,
      })
      sendJson(response, 201, { record: data, requestId })
    } catch (error) {
      sendJson(response, error?.message === 'Request body too large' ? 413 : 400, { error: 'Unable to read the request body.', requestId })
    }
    return true
  }

  const transitionMatch = pathname.match(/^\/api\/sewp-rfqs\/([0-9a-f-]+)\/stage-transitions$/i)
  if (request.method === 'POST' && transitionMatch) {
    const allowed = requirePermission(auth, 'sewp.rfq.transition')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    const validation = validateStageTransition(await readJsonBody(request))
    if (!validation.ok) {
      sendJson(response, 400, { error: 'Invalid stage transition.', details: validation.errors, requestId })
      return true
    }
    const { data, error } = await supabase.rpc('transition_sewp_rfq_stage', {
      p_rfq_id: transitionMatch[1],
      p_target_stage: validation.value.targetStage,
      p_expected_version: validation.value.expectedVersion,
      p_justification: validation.value.justification || null,
      p_actor_user_id: auth.user.id,
      p_request_id: requestId,
    })
    if (error) return databaseError(response, sendJson, error, requestId)
    sendJson(response, 200, { record: data, requestId })
    return true
  }

  sendJson(response, 404, { error: 'SEWP API route not found.', requestId })
  return true
}

async function nextOpportunityNumber(supabase) {
  const year = new Date().getUTCFullYear()
  const { data, error } = await supabase.rpc('next_sewp_opportunity_number', { p_year: year })
  if (error) throw error
  return data
}

async function writeAudit(supabase, input) {
  const { error } = await supabase.from('sewp_rfq_audit_events').insert({
    rfq_id: input.rfqId,
    actor_type: 'User',
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    previous_value: input.previousValue || null,
    new_value: input.newValue || null,
    request_id: input.requestId,
  })
  if (error) throw error
}

function deny(response, sendJson, result, requestId) {
  sendJson(response, result.status, { error: result.error, requestId })
  return true
}

function databaseError(response, sendJson, error, requestId) {
  console.error('[SEWP API] database operation failed', { requestId, code: error.code, message: error.message })
  sendJson(response, 500, { error: 'The SEWP operation could not be completed.', requestId })
  return true
}

function escapeFilter(value) {
  return value.replace(/[%_,()]/g, '')
}
