import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createTdSynnexService, normalizePriceAvailability, TdSynnexError } from '../td-synnex-service.mjs'

const ENV = {
  TD_SYNNEX_CLIENT_ID: 'sandbox-client',
  TD_SYNNEX_CLIENT_SECRET: 'sandbox-secret',
  TD_SYNNEX_TOKEN_URL: 'https://sso.us.tdsynnex.com/oauth2/v1/token',
  TD_SYNNEX_API_BASE_URL: 'https://api-uat.us.tdsynnex.com',
  TD_SYNNEX_ENVIRONMENT: 'sandbox',
}
const silentLogger = { info() {}, error() {}, log() {} }
const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })

test('OAuth uses client credentials form fields without exposing them in status', async () => {
  let request
  const service = createTdSynnexService({ env: ENV, logger: silentLogger, fetchImpl: async (url, init) => { request = { url, init }; return json({ access_token: 'token-1', expires_in: 7200 }) } })
  assert.equal(await service.getAccessToken(), 'token-1')
  assert.equal(request.url, ENV.TD_SYNNEX_TOKEN_URL)
  assert.equal(request.init.headers['Content-Type'], 'application/x-www-form-urlencoded')
  assert.equal(request.init.body.get('grant_type'), 'client_credentials')
  assert.equal(request.init.body.get('client_id'), ENV.TD_SYNNEX_CLIENT_ID)
  assert.equal(request.init.body.get('client_secret'), ENV.TD_SYNNEX_CLIENT_SECRET)
  assert.doesNotMatch(JSON.stringify(service.status()), /sandbox-client|sandbox-secret|token-1/)
})

test('token is cached and simultaneous callers share one token request', async () => {
  let calls = 0
  const service = createTdSynnexService({ env: ENV, logger: silentLogger, fetchImpl: async () => { calls += 1; await new Promise(resolve => setTimeout(resolve, 10)); return json({ access_token: 'shared', expires_in: 7200 }) } })
  assert.deepEqual(await Promise.all([service.getAccessToken(), service.getAccessToken(), service.getAccessToken()]), ['shared', 'shared', 'shared'])
  assert.equal(calls, 1)
  assert.equal(await service.getAccessToken(), 'shared')
  assert.equal(calls, 1)
})

test('token refreshes inside the five-minute safety buffer', async () => {
  let time = 1_000_000
  let calls = 0
  const service = createTdSynnexService({ env: ENV, logger: silentLogger, now: () => time, fetchImpl: async () => json({ access_token: `token-${++calls}`, expires_in: 7200 }) })
  assert.equal(await service.getAccessToken(), 'token-1')
  time += 7200 * 1000 - 4 * 60 * 1000
  assert.equal(await service.getAccessToken(), 'token-2')
})

test('authentication failure is sanitized', async () => {
  const service = createTdSynnexService({ env: ENV, logger: silentLogger, fetchImpl: async () => json({ error: 'invalid_client', client_secret: ENV.TD_SYNNEX_CLIENT_SECRET }, 401) })
  await assert.rejects(service.getAccessToken(), error => error instanceof TdSynnexError && error.code === 'AUTHENTICATION_FAILED' && !error.message.includes(ENV.TD_SYNNEX_CLIENT_SECRET))
})

test('successful manufacturer-part lookup uses documented schema and normalizes response', async () => {
  const requests = []
  const service = createTdSynnexService({ env: ENV, logger: silentLogger, fetchImpl: async (url, init) => {
    requests.push({ url, init })
    if (url.includes('/token')) return json({ access_token: 'price-token', expires_in: 7200 })
    return json({ version: 2, PriceAvailabilityList: [{ synnexSKU: 439866, mfgPN: 'XTM1U-G', status: 'Active', description: 'Display mount', price: '281.86', totalQuantity: 30, AvailabilityByWarehouse: [{ warehouseInfo: { number: 3, city: 'Fremont,CA', zipcode: '94538' }, qty: 30 }] }], errorMessage: null, errorDetail: null })
  } })
  const response = await service.getPriceAvailability(['XTM1U-G'])
  const upstreamBody = JSON.parse(requests[1].init.body)
  assert.deepEqual(upstreamBody, { version: '3.0', skuList: [{ mfgPN: 'XTM1U-G', lineNumber: 1 }] })
  assert.equal(requests[1].init.headers.Authorization, 'Bearer price-token')
  assert.equal(response.results[0].unitCost, 281.86)
  assert.equal(response.results[0].availableQuantity, 30)
  assert.equal(response.results[0].source, 'TD SYNNEX')
  assert.equal(response.results[0].environment, 'sandbox')
  assert.equal(response.results[0].manufacturer, null)
  assert.equal(response.results[0].currency, null)
})

test('not-found product is normalized without invented pricing', () => {
  const result = normalizePriceAvailability({ mfgPN: 'MISSING', status: 'Not found', price: null, totalQuantity: null })
  assert.equal(result.pricingStatus, 'Product Not Found')
  assert.equal(result.unitCost, null)
  assert.equal(result.availableQuantity, null)
})

test('HTTP 200 business errors are rejected', async () => {
  const service = sequentialService([json({ access_token: 'token', expires_in: 7200 }), json({ errorMessage: 'ValidateVersion', errorDetail: 'invalid' })])
  await assert.rejects(service.getPriceAvailability(['ABC']), error => error.code === 'BUSINESS_ERROR')
})

test('HTTP 401 refreshes the token once and rejects a second unauthorized response', async () => {
  const service = sequentialService([json({ access_token: 'one', expires_in: 7200 }), json({}, 401), json({ access_token: 'two', expires_in: 7200 }), json({}, 401)])
  await assert.rejects(service.getPriceAvailability(['ABC']), error => error.code === 'UNAUTHORIZED')
})

test('HTTP 429 returns a safe retryable rate-limit error', async () => {
  const service = sequentialService([json({ access_token: 'token', expires_in: 7200 }), json({}, 429)])
  await assert.rejects(service.getPriceAvailability(['ABC']), error => error.code === 'RATE_LIMITED' && error.retryable)
})

test('TD SYNNEX timeout returns a safe timeout error', async () => {
  const service = createTdSynnexService({ env: ENV, logger: silentLogger, timeoutMs: 5, fetchImpl: async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) })
  await assert.rejects(service.getAccessToken(), error => error.code === 'TIMEOUT' && error.status === 504)
})

test('normalization preserves documented warehouse fields', () => {
  const result = normalizePriceAvailability({ synnexSKU: 123, mfgPN: 'ABC', status: 'Active', price: '10.50', totalQuantity: 7, AvailabilityByWarehouse: [{ warehouseInfo: { number: 8, city: 'Clearwater,FL', zipcode: '33760' }, qty: 7, onOrderQuantity: 2, estimatedArrivalDate: '20260901' }] })
  assert.deepEqual(result.warehouseAvailability[0], { warehouseNumber: 8, city: 'Clearwater,FL', postalCode: '33760', quantity: 7, onOrderQuantity: 2, estimatedArrivalDate: '20260901' })
})

test('frontend integration files contain no credential or bearer-token values', async () => {
  const frontend = await readFile('src/services/tdSynnexApi.ts', 'utf8') + await readFile('src/views/AdminView.vue', 'utf8')
  assert.doesNotMatch(frontend, /TD_SYNNEX_CLIENT_SECRET|TD_SYNNEX_CLIENT_ID|access_token|Bearer <|sandbox-secret/)
})

function sequentialService(responses) {
  let index = 0
  return createTdSynnexService({ env: ENV, logger: silentLogger, fetchImpl: async () => responses[index++] })
}
