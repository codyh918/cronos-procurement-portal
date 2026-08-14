import test from 'node:test'
import assert from 'node:assert/strict'
import { createPdfDocument, resolveJsPdfConstructor } from '../../src/services/pdfRuntime.mjs'

class MockPdf {}

test('resolves supported jsPDF module export shapes', () => {
  assert.equal(resolveJsPdfConstructor({ jsPDF: MockPdf }), MockPdf)
  assert.equal(resolveJsPdfConstructor({ default: { jsPDF: MockPdf } }), MockPdf)
  assert.equal(resolveJsPdfConstructor({ default: MockPdf }), MockPdf)
})

test('reports a useful error when jsPDF is unavailable', () => {
  assert.throws(() => resolveJsPdfConstructor({}), /PDF generator could not be loaded/)
})

test('creates a real PDF document in the installed runtime', async () => {
  const doc = await createPdfDocument({ unit: 'pt', format: 'letter' })
  doc.text('Atlas quote PDF smoke test', 40, 40)
  assert.ok(doc.output('arraybuffer').byteLength > 100)
})
