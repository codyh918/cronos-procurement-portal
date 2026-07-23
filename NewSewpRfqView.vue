import { randomUUID } from 'node:crypto'
import { DeterministicRfqExtractionProvider, RFQ_EXTRACTION_CONFIG } from './rfq-extraction.mjs'
import { requirePermission } from './sewp-auth.mjs'

const provider = new DeterministicRfqExtractionProvider()

export async function handleSewpImportApi(context) {
  const { request, response, pathname, sendJson, readJsonBody, readBufferBody, supabase, auth, requestId } = context
  if (!pathname.startsWith('/api/sewp-rfqs/imports')) return false

  if (request.method === 'POST' && pathname === '/api/sewp-rfqs/imports') {
    const allowed = requirePermission(auth, 'sewp.rfq.upload')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    const filename = decodeURIComponent(String(request.headers['x-atlas-filename'] || ''))
    try {
      const buffer = await readBufferBody(request, RFQ_EXTRACTION_CONFIG.maxFileSize)
      const extraction = provider.extract(buffer, filename)
      const duplicate = await supabase.from('sewp_rfq_imports').select('id,status,created_rfq_id,created_project_id')
        .eq('original_file_hash', extraction.originalFileHash).maybeSingle()
      if (duplicate.error) return dbError(response, sendJson, duplicate.error, requestId)
      if (duplicate.data) {
        sendJson(response, 409, { error: 'This exact Outlook message has already been imported.', duplicate: duplicate.data, requestId })
        return true
      }
      const importId = randomUUID()
      const originalKey = `imports/${importId}/original/${safeFilename(filename)}`
      const upload = await supabase.storage.from('sewp-rfq-documents').upload(originalKey, buffer, {
        contentType: 'application/vnd.ms-outlook', upsert: false,
      })
      if (upload.error) return dbError(response, sendJson, upload.error, requestId)
      const attachmentRows = []
      try {
        for (const attachment of extraction.attachments) {
          const key = `imports/${importId}/attachments/${randomUUID()}-${safeFilename(attachment.filename)}`
          const stored = await supabase.storage.from('sewp-rfq-documents').upload(key, attachment.content, {
            contentType: attachment.mimeType, upsert: false,
          })
          if (stored.error) throw stored.error
          attachmentRows.push({
            import_id: importId, filename: attachment.filename, mime_type: attachment.mimeType,
            file_size: attachment.size, file_hash: attachment.sha256, storage_key: key,
            document_type: /\.(xlsx|xls)$/i.test(attachment.filename) ? 'equipment_list' : 'supporting',
            parse_status: 'completed',
          })
        }
        const extractionData = {
          ...extraction,
          attachments: extraction.attachments.map(({ content, ...metadata }) => metadata),
        }
        const inserted = await supabase.from('sewp_rfq_imports').insert({
          id: importId, status: 'review_required', original_filename: filename,
          original_file_size: buffer.length,
          original_file_hash: extraction.originalFileHash, original_storage_key: originalKey,
          message_subject: extraction.message.subject, message_id: extraction.message.messageId || null,
          sewp_request_id: extraction.fields.request_id || null, agency_id: extraction.fields.agency_id || null,
          modification_level: extraction.fields.modification_level || null, imported_by: auth.user.id,
          parser_version: extraction.parserVersion, extraction_version: extraction.extractionVersion,
          extraction_data: extractionData, warnings: extraction.warnings,
        }).select('*').single()
        if (inserted.error) throw inserted.error
        if (attachmentRows.length) {
          const attachments = await supabase.from('sewp_rfq_import_attachments').insert(attachmentRows)
          if (attachments.error) throw attachments.error
        }
        await audit(supabase, auth.user.id, 'rfq_import.uploaded', importId, requestId, { filename, sha256: extraction.originalFileHash })
        sendJson(response, 201, { import: inserted.data, requestId })
      } catch (error) {
        await cleanupStorage(supabase, originalKey, attachmentRows.map(row => row.storage_key))
        throw error
      }
    } catch (error) {
      sendJson(response, error?.message === 'Request body too large' ? 413 : 400, { error: safeError(error), requestId })
    }
    return true
  }

  const detail = pathname.match(/^\/api\/sewp-rfqs\/imports\/([0-9a-f-]+)$/i)
  if (detail && request.method === 'GET') {
    const allowed = requirePermission(auth, 'sewp.rfq.view')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    const result = await supabase.from('sewp_rfq_imports').select('*,sewp_rfq_import_attachments(*)').eq('id', detail[1]).maybeSingle()
    if (result.error) return dbError(response, sendJson, result.error, requestId)
    if (!result.data) return sendJson(response, 404, { error: 'RFQ import not found.', requestId }), true
    sendJson(response, 200, { import: result.data, requestId })
    return true
  }

  if (detail && request.method === 'PATCH') {
    const allowed = requirePermission(auth, 'sewp.rfq.verify_fields')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    try {
      const body = await readJsonBody(request)
      const current = await supabase.from('sewp_rfq_imports').select('status,extraction_data').eq('id', detail[1]).maybeSingle()
      if (current.error) return dbError(response, sendJson, current.error, requestId)
      if (!current.data || !['review_required', 'ready_for_approval'].includes(current.data.status)) {
        sendJson(response, 409, { error: 'Only an import under review can be changed.', requestId }); return true
      }
      const extraction = mergeEditable(current.data.extraction_data, body.extractionData)
      const updated = await supabase.from('sewp_rfq_imports').update({
        extraction_data: extraction, status: body.readyForApproval ? 'ready_for_approval' : 'review_required', updated_at: new Date().toISOString(),
      }).eq('id', detail[1]).select('*').single()
      if (updated.error) return dbError(response, sendJson, updated.error, requestId)
      await audit(supabase, auth.user.id, 'rfq_import.corrected', detail[1], requestId)
      sendJson(response, 200, { import: updated.data, requestId })
    } catch (error) { sendJson(response, 400, { error: safeError(error), requestId }) }
    return true
  }

  const approve = pathname.match(/^\/api\/sewp-rfqs\/imports\/([0-9a-f-]+)\/approve$/i)
  if (approve && request.method === 'POST') {
    const allowed = requirePermission(auth, 'sewp.rfq.create')
    if (!allowed.ok) return deny(response, sendJson, allowed, requestId)
    try {
      const body = await readJsonBody(request)
      if (!body.idempotencyKey || String(body.idempotencyKey).length > 100) {
        sendJson(response, 400, { error: 'A valid idempotency key is required.', requestId }); return true
      }
      const result = await supabase.rpc('approve_sewp_rfq_import', {
        p_import_id: approve[1], p_actor_user_id: auth.user.id,
        p_idempotency_key: body.idempotencyKey, p_request_id: requestId,
      })
      if (result.error) return dbError(response, sendJson, result.error, requestId)
      sendJson(response, 201, { result: result.data, requestId })
    } catch (error) { sendJson(response, 400, { error: safeError(error), requestId }) }
    return true
  }
  return false
}

function mergeEditable(current, proposed) {
  if (!proposed || typeof proposed !== 'object' || Array.isArray(proposed)) throw new Error('extractionData must be an object.')
  return { ...current, fields: { ...current.fields, ...(proposed.fields || {}) }, lines: Array.isArray(proposed.lines) ? proposed.lines : current.lines }
}
function safeFilename(value) { return String(value || 'email.msg').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 180) }
function safeError(error) { return error instanceof Error ? error.message.replace(/[\r\n]+/g, ' ').slice(0, 300) : 'Import failed.' }
function deny(response, sendJson, allowed, requestId) { sendJson(response, allowed.status, { error: allowed.error, requestId }); return true }
function dbError(response, sendJson, error, requestId) { console.error('SEWP import database operation failed', { requestId, code: error?.code }); sendJson(response, 500, { error: 'The RFQ import database operation failed.', requestId }); return true }
async function cleanupStorage(supabase, original, attachments) { await supabase.storage.from('sewp-rfq-documents').remove([original, ...attachments]) }
async function audit(supabase, actor, action, entityId, requestId, value = null) {
  await supabase.from('sewp_rfq_audit_events').insert({ actor_type: 'User', actor_user_id: actor, action, entity_type: 'rfq_import', entity_id: entityId, new_value: value, request_id: requestId })
}
