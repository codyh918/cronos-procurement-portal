import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { catalogPriceEligibility, parseCatalogWorkbook } from '../catalog-api.mjs'

test('catalog import maps MEL products, inherits categories, and ignores project tracking rows', () => {
  const rows = [
    ['Record Type Indicator (1)', 'Item No', 'U/I', 'P/N Desc (45)', 'Part No (30)', 'Manufacturer (50)', 'Supplier', 'Supplier Part No (20)', 'Supplier Lead Time', 'Budget Unit Price', 'Purchasable', 'FSC Code', 'Proc Status', 'DPAS', 'Require Serial?'],
    [1, '1', '', '40-48" Displays'],
    [2, '1.1', 'EA', '43" 4K commercial display', 'QE43T', 'Samsung', 'TD SYNNEX', '12345', '14 days', 525, 'Y', '6730', 'P-I', 'DO', 'Yes'],
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'BLANK')
  const parsed = parseCatalogWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), 'catalog.xlsx')
  assert.equal(parsed.products.length, 1)
  assert.equal(parsed.products[0].category, '40-48" Displays')
  assert.equal(parsed.products[0].manufacturerPartNumber, 'QE43T')
  assert.equal(parsed.products[0].currentCost, 525)
  assert.equal(parsed.products[0].purchasable, true)
  assert.equal(parsed.skipped, 1)
})

test('catalog import uses manufacturer plus part number as a case-insensitive duplicate key', () => {
  const csv = Buffer.from('Manufacturer,Part Number,Description,Current Cost\nCisco,CS-CODEC-EQ,Codec EQ,100\ncisco,cs-codec-eq,Updated Codec EQ,125\n')
  const parsed = parseCatalogWorkbook(csv, 'catalog.csv')
  assert.equal(parsed.products.length, 1)
  assert.equal(parsed.duplicates, 1)
  assert.equal(parsed.products[0].currentCost, 125)
})

test('catalog import trims manufacturer and part number before duplicate comparison', () => {
  const csv = Buffer.from('Manufacturer,Part Number,Description,Current Cost\n Crestron , CP4N ,Controller,100\ncrestron,CP4N,Controller,100\n')
  const parsed = parseCatalogWorkbook(csv, 'catalog.csv')
  assert.equal(parsed.products.length, 1)
  assert.equal(parsed.duplicates, 1)
  assert.equal(parsed.products[0].manufacturer, 'crestron')
  assert.equal(parsed.products[0].manufacturerPartNumber, 'CP4N')
})

test('unchanged import rows do not create price history merely because the batch is verified', () => {
  const source = fs.readFileSync(new URL('../catalog-api.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /verification\.verifyPricing \|\| money\(current\.current_cost\)/)
  assert.match(source, /if \(priceChanged\) \{ prices\.push/)
  assert.match(source, /unchangedProducts \+= 1/)
})

test('catalog duplicate lookup delegates normalized matching to the database', () => {
  const source = fs.readFileSync(new URL('../catalog-api.mjs', import.meta.url), 'utf8')
  assert.match(source, /\.rpc\('atlas_catalog_match_products', \{ p_keys:/)
  assert.match(source, /\.rpc\('atlas_catalog_upsert_products', \{ p_rows:/)
})

test('only current verified catalog prices meeting the quantity basis are applicable', () => {
  const now = Date.parse('2026-08-06T12:00:00Z')
  assert.equal(catalogPriceEligibility({ pricing_status: 'Verified', expiration_date: '2026-08-10T00:00:00Z', quantity_basis: 5 }, 5, now).applicable, true)
  for (const pricing_status of ['Unverified', 'Pending Verification', 'Rejected']) {
    assert.equal(catalogPriceEligibility({ pricing_status, expiration_date: '2026-08-10T00:00:00Z', quantity_basis: null }, 1, now).applicable, false)
  }
  assert.equal(catalogPriceEligibility({ pricing_status: 'Verified', expiration_date: '2026-08-01T00:00:00Z', quantity_basis: null }, 1, now).display_status, 'Expired')
  assert.equal(catalogPriceEligibility({ pricing_status: 'Verified', expiration_date: null, quantity_basis: 10 }, 2, now).applicable, false)
})
