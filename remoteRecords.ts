import seedCatalog from '../data/part-catalog-seed.json'
import type { Project, PurchaseOrder } from '../types'

const STORAGE_KEY = 'cronos.partCatalog'

export type PartPriceRecord = {
  id: string
  partNumber: string
  manufacturer: string
  description: string
  vendor: string
  unitCost: number
  quantityOrdered: number
  poNumber: string
  projectId: string
  projectNumber: string
  projectName: string
  quoteId?: string
  dateIssued: string
  recordedAt: string
}

export function loadPartCatalog() {
  const seedRecords = (seedCatalog as PartPriceRecord[]).map(normalizeRecord)

  try {
    return dedupeRecords([...loadStoredPartCatalog(), ...seedRecords]).filter(record => record.partNumber)
  } catch {
    return seedRecords
  }
}

export function savePartCatalog(records: PartPriceRecord[]) {
  const normalized = dedupeRecords(records.map(normalizeRecord))
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function recordPurchaseOrdersInCatalog(project: Project, purchaseOrders: PurchaseOrder[]) {
  const existing = loadStoredPartCatalog()
  const records = purchaseOrders.flatMap(po =>
    po.lines.map(line => ({
      id: `${po.poNumber}:${line.id}`,
      partNumber: line.partNumber.trim(),
      manufacturer: (line.manufacturer ?? '').trim(),
      description: line.description.trim(),
      vendor: po.vendor.trim(),
      unitCost: normalizeMoney(line.unitCost),
      quantityOrdered: line.quantityOrdered,
      poNumber: po.poNumber,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      quoteId: po.quoteId,
      dateIssued: po.dateIssued,
      recordedAt: new Date().toISOString(),
    })),
  )

  return savePartCatalog([...records, ...existing])
}

export function rebuildPartCatalogFromProjects(projects: Project[]) {
  const records = projects.flatMap(project =>
    project.purchaseOrders.flatMap(po =>
      po.lines.map(line => ({
        id: `${po.poNumber}:${line.id}`,
        partNumber: line.partNumber.trim(),
        manufacturer: (line.manufacturer ?? '').trim(),
        description: line.description.trim(),
        vendor: po.vendor.trim(),
        unitCost: normalizeMoney(line.unitCost),
        quantityOrdered: line.quantityOrdered,
        poNumber: po.poNumber,
        projectId: project.id,
        projectNumber: project.projectNumber,
        projectName: project.projectName,
        quoteId: po.quoteId,
        dateIssued: po.dateIssued,
        recordedAt: new Date().toISOString(),
      })),
    ),
  )

  return savePartCatalog([...records, ...loadStoredPartCatalog()])
}

export function findLatestPartPrice(partNumber: string) {
  const normalized = normalizePartNumber(partNumber)
  if (!normalized) return undefined

  return loadPartCatalog()
    .filter(record => normalizePartNumber(record.partNumber) === normalized)
    .sort((a, b) => new Date(b.dateIssued || b.recordedAt).getTime() - new Date(a.dateIssued || a.recordedAt).getTime())[0]
}

export function findPartPriceSuggestions(query: string, limit = 8) {
  const normalized = normalizePartNumber(query)
  if (!normalized || normalized.length < 2) return []

  return getPartCatalogSummary(loadPartCatalog())
    .filter(record => {
      const searchable = [record.partNumber, record.manufacturer, record.description, record.vendor].join(' ')
      return normalizePartNumber(searchable).includes(normalized)
    })
    .slice(0, limit)
}

export function getPartCatalogSummary(records: PartPriceRecord[]) {
  const latestByPart = new Map<string, PartPriceRecord>()

  records
    .slice()
    .sort((a, b) => new Date(b.dateIssued || b.recordedAt).getTime() - new Date(a.dateIssued || a.recordedAt).getTime())
    .forEach(record => {
      const key = normalizePartNumber(record.partNumber)
      if (key && !latestByPart.has(key)) latestByPart.set(key, record)
    })

  return Array.from(latestByPart.values())
}

function dedupeRecords(records: PartPriceRecord[]) {
  const seen = new Set<string>()
  return records.filter(record => {
    const key = record.id || `${record.poNumber}:${record.partNumber}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function loadStoredPartCatalog() {
  try {
    return (JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as PartPriceRecord[]).map(normalizeRecord)
  } catch {
    return []
  }
}

function normalizeRecord(record: PartPriceRecord): PartPriceRecord {
  return {
    ...record,
    partNumber: record.partNumber ?? '',
    manufacturer: record.manufacturer ?? '',
    description: record.description ?? '',
    vendor: record.vendor ?? '',
    unitCost: normalizeMoney(record.unitCost),
    quantityOrdered: Number.isFinite(record.quantityOrdered) ? record.quantityOrdered : 0,
    recordedAt: record.recordedAt ?? record.dateIssued ?? new Date().toISOString(),
  }
}

function normalizePartNumber(value: string) {
  return value.trim().toLowerCase()
}

function normalizeMoney(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100) : 0
}
