import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, normalize, sep } from 'node:path'
import { createServer } from 'node:http'
import { handleSewpApi } from './server/sewp-api.mjs'
import { handleDataApi } from './server/data-api.mjs'
import { getSewpSupabase } from './server/sewp-supabase.mjs'
import { getSupabasePasswordAuthClient } from './server/sewp-supabase.mjs'
import { handleAtlasAuthApi } from './server/atlas-auth-api.mjs'
import { handleCatalogApi } from './server/catalog-api.mjs'

const port = Number(process.env.PORT || 4173)
const root = join(process.cwd(), 'dist')
const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
const atlasPurchaseOrders = new Map()
const cimsOutboundEvents = new Map()
const barcodeScanEvents = []
const labelPrintJobs = []
const integrationSyncLogs = []

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function resolvePath(url = '/') {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  const requested = normalize(join(root, pathname))
  if (requested !== root && !requested.startsWith(rootPrefix)) return join(root, 'index.html')

  if (existsSync(requested) && statSync(requested).isFile()) return requested

  return join(root, 'index.html')
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(payload))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', chunk => {
      raw += chunk
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function readBufferBody(request, maximumBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > maximumBytes) {
        reject(new Error('Request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function appendSyncLog({ direction, entity, externalId, status = 'Pending', message }) {
  const log = {
    id: `sync-${Date.now()}-${integrationSyncLogs.length + 1}`,
    direction,
    entity,
    externalId,
    status,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
    message,
  }
  integrationSyncLogs.unshift(log)
  return log
}

async function handleCimsApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/cims/health') {
    sendJson(response, 200, {
      service: 'Cronos Inventory Management System',
      status: 'ok',
      atlasIntegration: 'webhook-ready',
      warehouses: ['Lexington Park, MD', 'Evans, GA', 'Virginia Beach, VA'],
    })
    return true
  }

  if (request.method === 'GET' && pathname === '/api/cims/integration/logs') {
    sendJson(response, 200, { logs: integrationSyncLogs })
    return true
  }

  if (request.method === 'POST' && pathname === '/api/cims/barcodes/scan') {
    try {
      const payload = await readJsonBody(request)
      if (!payload.scannedValue) {
        sendJson(response, 400, { error: 'scannedValue is required' })
        return true
      }
      const event = {
        id: `scan-${Date.now()}-${barcodeScanEvents.length + 1}`,
        scannedValue: payload.scannedValue,
        scanSource: payload.scanSource || 'Manual',
        matchType: payload.matchType || null,
        matchedExternalId: payload.matchedExternalId || null,
        warehouseCode: payload.warehouseCode || null,
        result: payload.result || 'No Match',
        occurredAt: new Date().toISOString(),
      }
      barcodeScanEvents.unshift(event)
      sendJson(response, 201, { status: 'logged', event })
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON payload' })
    }
    return true
  }

  if (request.method === 'POST' && pathname === '/api/cims/labels/print') {
    try {
      const payload = await readJsonBody(request)
      if (!payload.labelType || !payload.barcodeValue || !payload.labelSize) {
        sendJson(response, 400, { error: 'labelType, barcodeValue, and labelSize are required' })
        return true
      }
      const job = {
        id: `label-${Date.now()}-${labelPrintJobs.length + 1}`,
        labelType: payload.labelType,
        labelSize: payload.labelSize,
        barcodeValue: payload.barcodeValue,
        entityType: payload.entityType || 'unknown',
        entityExternalId: payload.entityExternalId || null,
        reprint: Boolean(payload.reprint),
        printedAt: new Date().toISOString(),
      }
      labelPrintJobs.unshift(job)
      appendSyncLog({
        direction: 'CIMS to Atlas',
        entity: 'label_print',
        externalId: job.barcodeValue,
        status: 'Synced',
        message: `${job.labelType} ${job.reprint ? 'reprinted' : 'printed'} for audit history.`,
      })
      sendJson(response, 201, { status: 'printed', job })
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON payload' })
    }
    return true
  }

  if (request.method === 'POST' && pathname === '/api/cims/webhooks/atlas/purchase-order') {
    try {
      const payload = await readJsonBody(request)
      if (!payload.externalId && !payload.poNumber) {
        sendJson(response, 400, { error: 'externalId or poNumber is required' })
        return true
      }

      const externalId = payload.externalId || payload.poNumber
      const existing = atlasPurchaseOrders.get(externalId)
      atlasPurchaseOrders.set(externalId, {
        ...existing,
        ...payload,
        externalId,
        receivedFromAtlasAt: new Date().toISOString(),
      })

      const log = appendSyncLog({
        direction: 'Atlas to CIMS',
        entity: 'purchase_order',
        externalId,
        status: 'Synced',
        message: existing ? 'Atlas PO update merged by external ID.' : 'Atlas PO created in CIMS receiving queue.',
      })

      sendJson(response, existing ? 200 : 201, {
        status: existing ? 'updated' : 'created',
        externalId,
        syncLogId: log.id,
      })
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON payload' })
    }
    return true
  }

  if (request.method === 'POST' && pathname === '/api/cims/webhooks/atlas/status') {
    try {
      const payload = await readJsonBody(request)
      if (!payload.eventType || !payload.externalId) {
        sendJson(response, 400, { error: 'eventType and externalId are required' })
        return true
      }

      cimsOutboundEvents.set(payload.externalId, {
        ...payload,
        queuedForAtlasAt: new Date().toISOString(),
      })
      const log = appendSyncLog({
        direction: 'CIMS to Atlas',
        entity: payload.eventType,
        externalId: payload.externalId,
        status: 'Pending',
        message: 'Outbound warehouse event queued for Atlas acknowledgement.',
      })

      sendJson(response, 202, { status: 'queued', syncLogId: log.id })
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON payload' })
    }
    return true
  }

  if (request.method === 'POST' && pathname === '/api/cims/sync/retry') {
    try {
      const payload = await readJsonBody(request)
      const retryable = integrationSyncLogs.filter(log => !payload.externalId || log.externalId === payload.externalId)
      retryable.forEach(log => {
        if (log.status !== 'Synced') {
          log.status = 'Pending'
          log.attempts += 1
          log.lastAttemptAt = new Date().toISOString()
          log.message = 'Manual retry requested from CIMS admin.'
        }
      })
      sendJson(response, 202, { status: 'retry-queued', count: retryable.length })
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON payload' })
    }
    return true
  }

  return false
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  if (await handleAtlasAuthApi({ request, response, pathname, sendJson, readJsonBody, supabase: getSewpSupabase(), passwordAuthClient: getSupabasePasswordAuthClient() })) return
  if (await handleCatalogApi({ request, response, pathname, sendJson, readJsonBody, readBufferBody, supabase: getSewpSupabase() })) return
  if (await handleDataApi({ request, response, pathname, sendJson, readJsonBody, supabase: getSewpSupabase() })) return
  if (await handleSewpApi({ request, response, pathname, sendJson, readJsonBody, readBufferBody })) return
  if (pathname.startsWith('/api/cims/') && await handleCimsApi(request, response, pathname)) return

  const filePath = resolvePath(request.url)
  const contentType = contentTypes[extname(filePath)] || 'application/octet-stream'

  response.setHeader('Content-Type', contentType)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  createReadStream(filePath)
    .on('error', () => {
      response.statusCode = 404
      response.end('Not found')
    })
    .pipe(response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Cronos Procurement app listening on port ${port}`)
})
