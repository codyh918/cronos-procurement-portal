import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('production starts the full Atlas API server', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  const railwayConfig = JSON.parse(await readFile(new URL('../../railway.json', import.meta.url), 'utf8'))

  assert.equal(packageJson.scripts.start, 'node server.mjs')
  assert.equal(railwayConfig.deploy.startCommand, 'npm run start')
  assert.equal(railwayConfig.deploy.healthcheckPath, '/')
})
