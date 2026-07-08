import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const checks = [
  {
    file: 'src/services/pdfExports.ts',
    patterns: [
      'createDocumentAudit',
      'validateQuoteDocument',
      'validatePurchaseOrderDocument',
      'finishDocumentAudit',
      'normalizeQuoteLineForDocument',
      'normalizePurchaseOrderLineForDocument',
    ],
  },
  {
    file: 'src/services/workbookExports.ts',
    patterns: [
      'createDocumentAudit',
      'validateQuoteDocument',
      'validatePurchaseOrderLines',
      'validateQuoteLines',
      'finishDocumentAudit',
      'documentValue',
    ],
  },
  {
    file: 'src/services/exportData.ts',
    patterns: ['createDocumentAudit', 'finishDocumentAudit', 'documentValue'],
  },
  {
    file: 'docs/ATLAS_DOCUMENT_GENERATION_AUDIT.md',
    patterns: [
      'Customer Quote PDF',
      'Purchase Order PDF',
      'Vendor RFQ Workbook',
      'Root Causes',
      'Corrective Actions',
    ],
  },
]

const failures = []

for (const check of checks) {
  const text = readFileSync(join(root, check.file), 'utf8')
  for (const pattern of check.patterns) {
    if (!text.includes(pattern)) failures.push(`${check.file} is missing ${pattern}`)
  }
}

if (failures.length) {
  console.error('Atlas document validation failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Atlas document validation passed.')
