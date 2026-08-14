const DEFAULT_TOKEN_URL = 'https://sso.us.tdsynnex.com/oauth2/v1/token'
const DEFAULT_API_BASE_URL = 'https://api-uat.us.tdsynnex.com'
const PRICE_AVAILABILITY_PATH = '/api/v1/webservice/json/GetPriceAvailability'
const TOKEN_SAFETY_BUFFER_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15_000

export class TdSynnexError extends Error {
  constructor(message, { code = 'TD_SYNNEX_ERROR', status = 502, retryable = false } = {}) {
    super(message)
    this.name = 'TdSynnexError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

export function createTdSynnexService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  logger = console,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const config = loadConfig(env)
  let tokenCache = null
  let tokenRequest = null
  const activity = {
    lastSuccessfulConnection: null,
    lastFailedConnection: null,
    lastPricingLookup: null,
    lastError: null,
  }

  function status() {
    const currentTime = now()
    return {
      provider: 'TD SYNNEX',
      environment: config.environment,
      apiBaseUrl: config.apiBaseUrl,
      enabled: config.enabled,
      configured: config.configured,
      connectionStatus: activity.lastSuccessfulConnection && (!activity.lastFailedConnection || activity.lastSuccessfulConnection > activity.lastFailedConnection) ? 'Connected' : activity.lastFailedConnection ? 'Error' : 'Not Connected',
      lastSuccessfulConnection: activity.lastSuccessfulConnection,
      lastFailedConnection: activity.lastFailedConnection,
      lastPricingLookup: activity.lastPricingLookup,
      lastError: activity.lastError,
      tokenStatus: tokenCache && tokenCache.expiresAt - TOKEN_SAFETY_BUFFER_MS > currentTime ? 'Cached' : tokenRequest ? 'Refreshing' : 'Not Cached',
      tokenExpiresAt: tokenCache?.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null,
    }
  }

  async function getAccessToken({ forceRefresh = false } = {}) {
    requireConfigured(config)
    if (!forceRefresh && tokenCache && tokenCache.expiresAt - TOKEN_SAFETY_BUFFER_MS > now()) return tokenCache.accessToken
    if (tokenRequest) return tokenRequest

    tokenRequest = requestToken()
    try {
      return await tokenRequest
    } finally {
      tokenRequest = null
    }
  }

  async function requestToken() {
    const startedAt = now()
    try {
      const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: config.clientId, client_secret: config.clientSecret })
      const response = await timedFetch(fetchImpl, config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      }, timeoutMs)
      const payload = await jsonPayload(response)
      if (!response.ok || !payload?.access_token) throw oauthError(response.status)

      const expiresIn = positiveNumber(payload.expires_in, 7200)
      tokenCache = { accessToken: payload.access_token, expiresAt: now() + expiresIn * 1000 }
      activity.lastSuccessfulConnection = new Date(now()).toISOString()
      activity.lastError = null
      log(logger, 'info', 'authentication.success', { durationMs: now() - startedAt, responseStatus: response.status })
      return tokenCache.accessToken
    } catch (error) {
      tokenCache = null
      const safeError = normalizeError(error)
      activity.lastFailedConnection = new Date(now()).toISOString()
      activity.lastError = safeError.message
      log(logger, 'error', 'authentication.failure', { durationMs: now() - startedAt, code: safeError.code })
      throw safeError
    }
  }

  async function testConnection() {
    await getAccessToken({ forceRefresh: true })
    return { ok: true, message: 'Connected to TD SYNNEX Sandbox', status: status() }
  }

  async function getPriceAvailability(partNumbers) {
    requireConfigured(config)
    const normalizedPartNumbers = validatePartNumbers(partNumbers)
    const startedAt = now()
    const requestBody = {
      version: '3.0',
      skuList: normalizedPartNumbers.map((mfgPN, index) => ({ mfgPN, lineNumber: index + 1 })),
    }

    try {
      let token = await getAccessToken()
      let response = await priceRequest(token, requestBody)
      if (response.status === 401) {
        tokenCache = null
        token = await getAccessToken({ forceRefresh: true })
        response = await priceRequest(token, requestBody)
      }
      const payload = await jsonPayload(response)
      if (!response.ok) throw responseError(response.status)
      throwForBusinessError(payload)

      const records = Array.isArray(payload?.PriceAvailabilityList) ? payload.PriceAvailabilityList : []
      const results = records.map(normalizePriceAvailability)
      activity.lastPricingLookup = new Date(now()).toISOString()
      activity.lastError = null
      log(logger, 'info', 'price_availability.success', {
        durationMs: now() - startedAt,
        responseStatus: response.status,
        partNumbers: normalizedPartNumbers,
        resultCount: results.length,
      })
      return { results, requestedPartNumbers: normalizedPartNumbers, verifiedAt: activity.lastPricingLookup }
    } catch (error) {
      const safeError = normalizeError(error)
      activity.lastError = safeError.message
      log(logger, 'error', 'price_availability.failure', {
        durationMs: now() - startedAt,
        code: safeError.code,
        partNumbers: normalizedPartNumbers,
      })
      throw safeError
    }
  }

  async function priceRequest(token, body) {
    return timedFetch(fetchImpl, `${config.apiBaseUrl}${PRICE_AVAILABILITY_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }, timeoutMs)
  }

  return { getAccessToken, testConnection, getPriceAvailability, status }
}

export const tdSynnexService = createTdSynnexService()

export function normalizePriceAvailability(item = {}) {
  const warehouseAvailability = Array.isArray(item.AvailabilityByWarehouse)
    ? item.AvailabilityByWarehouse.map(entry => ({
        warehouseNumber: finiteNumber(entry?.warehouseInfo?.number),
        city: stringOrNull(entry?.warehouseInfo?.city),
        postalCode: stringOrNull(entry?.warehouseInfo?.zipcode),
        quantity: finiteNumber(entry?.qty),
        onOrderQuantity: finiteNumber(entry?.onOrderQuantity),
        estimatedArrivalDate: stringOrNull(entry?.estimatedArrivalDate),
      }))
    : []
  const status = stringOrNull(item.status)
  return {
    manufacturer: null,
    manufacturerPartNumber: stringOrNull(item.mfgPN),
    tdSynnexSku: item.synnexSKU === null || item.synnexSKU === undefined ? null : String(item.synnexSKU),
    description: stringOrNull(item.description),
    unitCost: moneyOrNull(item.price),
    currency: null,
    availableQuantity: finiteNumber(item.totalQuantity),
    availabilityStatus: status,
    pricingStatus: status?.toLowerCase() === 'active' && moneyOrNull(item.price) !== null ? 'Verified' : status?.toLowerCase() === 'not found' ? 'Product Not Found' : 'Unverified',
    warehouseAvailability,
    source: 'TD SYNNEX',
    environment: 'sandbox',
    verifiedAt: new Date().toISOString(),
  }
}

function loadConfig(env) {
  const environment = String(env.TD_SYNNEX_ENVIRONMENT || 'sandbox').trim().toLowerCase()
  const tokenUrl = String(env.TD_SYNNEX_TOKEN_URL || DEFAULT_TOKEN_URL).trim().replace(/\/$/, '')
  const apiBaseUrl = String(env.TD_SYNNEX_API_BASE_URL || DEFAULT_API_BASE_URL).trim().replace(/\/$/, '')
  const clientId = String(env.TD_SYNNEX_CLIENT_ID || '').trim()
  const clientSecret = String(env.TD_SYNNEX_CLIENT_SECRET || '').trim()
  const enabled = environment === 'sandbox'
  return { environment, tokenUrl, apiBaseUrl, clientId, clientSecret, enabled, configured: enabled && Boolean(clientId && clientSecret) }
}

function requireConfigured(config) {
  if (config.environment !== 'sandbox') throw new TdSynnexError('Only the TD SYNNEX Sandbox environment is supported.', { code: 'ENVIRONMENT_NOT_ALLOWED', status: 503 })
  if (!config.configured) throw new TdSynnexError('TD SYNNEX Sandbox credentials are not configured.', { code: 'NOT_CONFIGURED', status: 503 })
}

function validatePartNumbers(values) {
  if (!Array.isArray(values) || values.length === 0) throw new TdSynnexError('At least one manufacturer part number is required.', { code: 'INVALID_PART_NUMBER', status: 400 })
  if (values.length > 100) throw new TdSynnexError('TD SYNNEX accepts no more than 100 products per request.', { code: 'TOO_MANY_PRODUCTS', status: 400 })
  const normalized = values.map(value => String(value || '').trim())
  if (normalized.some(value => !value || value.length > 100)) throw new TdSynnexError('Enter a valid manufacturer part number.', { code: 'INVALID_PART_NUMBER', status: 400 })
  return [...new Set(normalized)]
}

async function timedFetch(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw new TdSynnexError('TD SYNNEX did not respond before the request timed out.', { code: 'TIMEOUT', status: 504, retryable: true })
    throw new TdSynnexError('TD SYNNEX is temporarily unavailable.', { code: 'UPSTREAM_UNAVAILABLE', status: 503, retryable: true })
  } finally {
    clearTimeout(timeout)
  }
}

async function jsonPayload(response) {
  try { return await response.json() } catch { return null }
}

function oauthError(status) {
  if ([400, 401, 403].includes(status)) return new TdSynnexError('TD SYNNEX rejected the Sandbox credentials.', { code: 'AUTHENTICATION_FAILED', status: 502 })
  return responseError(status)
}

function responseError(status) {
  if (status === 401) return new TdSynnexError('TD SYNNEX authorization failed after token refresh.', { code: 'UNAUTHORIZED', status: 502 })
  if (status === 429) return new TdSynnexError('TD SYNNEX rate limit reached. Try again shortly.', { code: 'RATE_LIMITED', status: 429, retryable: true })
  if (status >= 500) return new TdSynnexError('TD SYNNEX is temporarily unavailable.', { code: 'UPSTREAM_UNAVAILABLE', status: 503, retryable: true })
  return new TdSynnexError('TD SYNNEX could not process the request.', { code: 'UPSTREAM_REQUEST_FAILED', status: 502 })
}

function throwForBusinessError(payload) {
  const rootMessage = stringOrNull(payload?.errorMessage) || stringOrNull(payload?.errorDetail)
  const rows = Array.isArray(payload?.PriceAvailabilityList) ? payload.PriceAvailabilityList : []
  const rowMessage = rows.map(row => stringOrNull(row?.errorMessage) || stringOrNull(row?.errorDetail)).find(Boolean)
  const message = rootMessage || rowMessage
  if (message) throw new TdSynnexError('TD SYNNEX returned a business validation error.', { code: 'BUSINESS_ERROR', status: 422 })
}

function normalizeError(error) {
  return error instanceof TdSynnexError ? error : new TdSynnexError('TD SYNNEX request failed.', { code: 'TD_SYNNEX_ERROR', status: 502 })
}

function log(logger, level, event, details) {
  const method = typeof logger?.[level] === 'function' ? logger[level].bind(logger) : logger?.log?.bind(logger)
  method?.(JSON.stringify({ integration: 'td_synnex', environment: 'sandbox', event, timestamp: new Date().toISOString(), ...details }))
}

function stringOrNull(value) { const text = String(value ?? '').trim(); return text || null }
function finiteNumber(value) { if (value === null || value === undefined || value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null }
function moneyOrNull(value) { if (value === null || value === undefined || value === '') return null; const number = Number(value); return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : null }
function positiveNumber(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback }
