import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeMelWorkbook, remapMelSheet } from '../../src/services/melIngestion.mjs'

const workbook = (...sheets) => ({ filename: 'customer-mel.xlsx', sheets })
const sheet = (name, rows, extra = {}) => ({ name, rows, ...extra })

test('extracts a simple MEL with primary fields', () => {
  const result = analyzeMelWorkbook(workbook(sheet('MEL', [['Qty', 'Description', 'Part Number', 'Manufacturer'], ['3', 'X-Large Fusion Tilt Wall Mount', 'XTM1U-G', 'Chief']])), { filename: 'customer-mel.xlsx' })
  assert.equal(result.items.length, 1); assert.equal(result.items[0].partNumber, 'XTM1U-G'); assert.equal(result.items[0].quantity, 3); assert.equal(result.items[0].source.sheet, 'MEL')
})

test('recognizes alternate and misspelled headers', () => {
  const result = analyzeMelWorkbook(workbook(sheet('Sheet1', [['Qty to Order', 'P/N Desc', 'Part No', 'Manufacutrer'], ['2', 'Network video endpoint', 'DM-NVX-360', 'Crestron']])))
  assert.equal(result.items[0].manufacturer, 'Crestron'); assert.equal(result.items[0].description, 'Network video endpoint')
})

test('handles reordered manufacturer model description quantity columns', () => {
  const result = analyzeMelWorkbook(workbook(sheet('Equipment', [['Manufacturer', 'Model', 'Description', 'Quantity'], ['Extron', '60-2031-11', 'Four input switcher', 4]])))
  assert.deepEqual([result.items[0].manufacturer, result.items[0].partNumber, result.items[0].quantity], ['Extron', '60-2031-11', 4])
})

test('detects a header on row eight and preserves source row lineage', () => {
  const rows = [['Project'], ['Customer'], ['Date'], [], [], ['Notes'], [], ['Quantiy', 'Part Nuber', 'Description', 'MFG'], ['5', 'TSW-1070-B-S', 'Touch screen interface', 'Crestron']]
  const result = analyzeMelWorkbook(workbook(sheet('Room 222', rows)))
  assert.equal(result.items[0].source.headerRow, 8); assert.equal(result.items[0].source.row, 9)
})

test('ignores category, subtotal, total, and blank rows', () => {
  const rows = [['Qty', 'Part Number', 'Description', 'Manufacturer'], ['', '', 'DISPLAY SYSTEM', ''], ['2', 'SC945DPH', 'Commercial display', 'Samsung'], ['', '', 'SUBTOTAL', ''], ['2', '', 'GRAND TOTAL', '']]
  const result = analyzeMelWorkbook(workbook(sheet('MEL', rows)))
  assert.equal(result.items.length, 1); assert.equal(result.items[0].partNumber, 'SC945DPH')
})

test('supports multiple tables and multiple legitimate worksheets', () => {
  const first = [['Qty', 'Part #', 'Description', 'Mfr'], ['1', 'XTM1U-G', 'Display wall mount', 'Chief'], [], ['Qty', 'Model', 'Description', 'OEM'], ['2', 'MXA920', 'Ceiling microphone', 'Shure']]
  const second = [['Manufacturer', 'Model', 'Description', 'Count'], ['Cisco', 'CS-CODEC-EQ-NR', 'Room codec', '1']]
  const result = analyzeMelWorkbook(workbook(sheet('Room 222', first), sheet('Room 226', second)))
  assert.equal(result.items.length, 3); assert.deepEqual(new Set(result.selectedSheetNames), new Set(['Room 222', 'Room 226']))
})

test('allows missing manufacturer or missing description', () => {
  const result = analyzeMelWorkbook(workbook(sheet('BOM', [['Qty', 'Part Number', 'Description', 'Manufacturer'], ['1', 'CEN-SWPOE-5AC', 'Managed PoE switch', ''], ['2', '920191-01', '', 'Poly']])))
  assert.equal(result.items.length, 2); assert.equal(result.items[0].manufacturer, ''); assert.equal(result.items[1].description, '')
})

test('preserves numeric-looking part numbers as strings including leading zeroes', () => {
  const result = analyzeMelWorkbook(workbook(sheet('MEL', [['Quantity', 'MPN', 'Item Description'], ['3.0', '0086100', 'Fiber adapter assembly']])))
  assert.equal(result.items[0].partNumber, '0086100'); assert.equal(result.items[0].quantity, 3)
})

test('clean semantic equipment sheet outranks a larger template sheet', () => {
  const template = Array.from({ length: 200 }, (_, index) => [`Template instruction ${index}`, '', '', ''])
  const equipment = [['Qty', 'P/N Desc', 'Part No', 'Manufacutrer'], ...Array.from({ length: 50 }, (_, index) => ['1', `Equipment item number ${index}`, `PART-${index + 100}`, index % 2 ? 'Chief' : 'Crestron'])]
  const result = analyzeMelWorkbook(workbook(sheet('BLANK TEMPLATE', template), sheet('Sheet1', equipment)))
  assert.equal(result.selectedSheetNames[0], 'Sheet1'); assert.equal(result.items.length, 50)
})

test('manual mapping fallback extracts a possible equipment table', () => {
  const source = sheet('Unknown', [['Amount', 'What', 'Code', 'Who'], ['3', 'X-Large Fusion Tilt Wall Mount', 'XTM1U-G', 'Chief']])
  const items = remapMelSheet(source, { 0: 'quantity', 1: 'description', 2: 'partNumber', 3: 'manufacturer' }, 0, { filename: 'manual.xlsx' })
  assert.equal(items.length, 1); assert.equal(items[0].partNumber, 'XTM1U-G'); assert.equal(items[0].confidence.overall, 1)
})

test('duplicate detection uses normalized manufacturer and part number without combining context', () => {
  const rows = [['Qty', 'Part Number', 'Description', 'Manufacturer', 'Room'], ['1', 'XTM1U-G', 'Mount', 'Chief', '101'], ['2', 'xtm1u-g', 'Mount', 'CHIEF', '102']]
  const result = analyzeMelWorkbook(workbook(sheet('MEL', rows)))
  assert.equal(result.items.filter(item => item.duplicate).length, 2); assert.notEqual(result.items[0].room, result.items[1].room)
})
