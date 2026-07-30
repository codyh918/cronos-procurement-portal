import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { extractSewpFields, extractWorkbookLines, validateMsgUpload } from '../rfq-extraction.mjs'

test('rejects unsupported files and invalid MSG signatures', () => {
  assert.throws(() => validateMsgUpload(Buffer.alloc(600), 'mail.pdf'), /Only Outlook/)
  assert.throws(() => validateMsgUpload(Buffer.alloc(600), 'mail.msg'), /signature/)
})

test('extracts machine-readable SEWP values without AI', () => {
  const fields = extractSewpFields(`Request ID: 380851
Agency: Department of Defense
Reply By Date: 23-JUL-2026 11:00
TAA Required: Yes
Partial Quotes Allowed: No
Government POC First Name: Marlene
Government POC Last Name: Adams
Government POC Email: marlene@example.mil`)
  assert.equal(fields.request_id, '380851')
  assert.equal(fields.taa_required, true)
  assert.equal(fields.partial_quotes_allowed, false)
  assert.equal(fields.government_poc_first_name, 'Marlene')
})

test('detects Excel headers, preserves identifiers, blanks, order, and source cells', () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Equipment list'],
    ['CLIN', 'Manufacturer', 'Manufacturer Part Number', 'Description', 'Quantity', 'Unit of Issue'],
    ['0010', '', '000123', 'Widget', '2,405', 'EA'],
    ['0020', 'Acme', 'CBL-4K', 'Cable', 1, 'EA'],
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, 'Equipment')
  const lines = extractWorkbookLines(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
  assert.equal(lines.length, 2)
  assert.equal(lines[0].clin, '0010')
  assert.equal(lines[0].manufacturerPartNumber, '000123')
  assert.equal(lines[0].manufacturer, '')
  assert.equal(lines[0].quantity, 2405)
  assert.equal(lines[0].sourceCells.clin, 'A3')
})
