import { getSupabaseAccessToken } from './supabaseAuth'

export type CatalogProduct = {
  id: string
  manufacturer: string
  manufacturer_part_number: string
  description: string
  additional_description: string
  category: string
  subcategory: string
  keywords: string[]
  budget_unit_price: number | null
  current_cost: number | null
  unit_of_measure: string
  supplier: string
  supplier_part_number: string
  fsc: string
  nsn: string
  lead_time: string
  lead_time_days: number | null
  purchasable: boolean | null
  procurement_status: string
  dpas: string
  serial_number_required: boolean | null
  taa_compliant: boolean | null
  in_stock: boolean | null
  screen_size_inches: number | null
  specifications: Record<string, unknown>
  source_file: string
  active: boolean
  updated_at: string
  pricing_status: 'Verified' | 'Expiring Soon' | 'Expired' | 'Unverified'
  current_pricing: CatalogPricing | null
}

export type CatalogPricing = { id: string; product_id: string; new_cost: number; vendor: string; source_file: string; pricing_status: string; display_status: 'Verified' | 'Expiring Soon' | 'Expired' | 'Unverified'; expiration_date: string | null; effective_date: string; verified_at: string | null; days_until_expiration: number | null }

export type CatalogSearch = {
  q?: string; page?: number; pageSize?: number; manufacturer?: string[]; category?: string[]; supplier?: string[]
  minPrice?: number | null; maxPrice?: number | null; leadTimeDays?: number | null; purchasable?: boolean | null
  inStock?: boolean | null; taaCompliant?: boolean | null; serialRequired?: boolean | null; active?: boolean | null
  pricingStatus?: string; sort?: string; direction?: 'asc' | 'desc'
}

export type ImportSummary = {
  batchId: string; sourceFile: string; totalRows: number; newProducts: number; updatedProducts: number
  duplicateRecords: number; errors: Array<{ row: number; error: string }>; skippedRows: number; priceChanges: number; unchangedProducts: number; metadataUpdatedProducts: number
}

export type CatalogImportBatch = {
  id: string; source_file: string; status: string; total_rows: number; new_products: number; updated_products: number
  unchanged_products: number; metadata_updated_products: number; duplicate_records: number; error_rows: number; skipped_rows: number; price_changes: number
  imported_at: string; imported_by: string | null; pricing_verification_status: 'Verified' | 'Unverified'; pricing_verified_at: string | null; pricing_expiration_date: string | null
}

export type VerifiedCatalogPrice = {
  id: string; product_id: string; manufacturer: string; manufacturer_part_number: string; description: string
  new_cost: number; vendor: string; effective_date: string; expiration_date: string | null; quantity_basis: number | null
  pricing_status: 'Verified' | 'Unverified' | 'Pending Verification' | 'Expired' | 'Rejected'
  display_status: 'Verified' | 'Unverified' | 'Pending Verification' | 'Expired' | 'Rejected'
  verified_at: string | null; verified_by_name: string; days_remaining: number | null; applicable: boolean; disabled_reason: string
}

async function catalogRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSupabaseAccessToken()
  if (!token) throw new Error('An authenticated Atlas session is required.')
  const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) } })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Catalog request failed.')
  return payload
}

export function searchCatalog(filters: CatalogSearch) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) value.forEach(item => params.append(key, String(item)))
    else params.set(key, String(value))
  }
  return catalogRequest<{ products: CatalogProduct[]; total: number; page: number; pageSize: number; suggestions: string[] }>(`/api/catalog/products?${params}`)
}

export function loadCatalogFacets() {
  return catalogRequest<{ manufacturers: Array<{ value: string; count: number }>; categories: Array<{ value: string; count: number }>; suppliers: Array<{ value: string; count: number }> }>('/api/catalog/facets')
}
export function loadCatalogMetrics() { return catalogRequest<{ totalProducts: number; verifiedProducts: number; expiringSoon: number; expiredProducts: number; unverifiedProducts: number; recentPriceChanges: number }>('/api/catalog/metrics') }
export function loadNeedsVerification() { return catalogRequest<{ records: Array<CatalogPricing & { atlas_products: { manufacturer: string; manufacturer_part_number: string; description: string }; days_until_expiration: number | null }> }>('/api/catalog/needs-verification') }
export function loadPriceChanges(filters: Record<string, string> = {}) { return catalogRequest<{ changes: Array<Record<string, any>>; total: number }>(`/api/catalog/pricing-changes?${new URLSearchParams(filters)}`) }

export function loadCatalogProduct(id: string) {
  return catalogRequest<{ product: CatalogProduct; pricingHistory: Array<Record<string, unknown>>; auditTrail: Array<Record<string, unknown>>; relatedProducts: CatalogProduct[] }>(`/api/catalog/products/${id}`)
}

export function updateCatalogProduct(id: string, changes: Record<string, unknown>) {
  return catalogRequest<{ product: CatalogProduct }>(`/api/catalog/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
}

export function importCatalog(file: File, options: { verifyPricing?: boolean; expirationDate?: string } = {}) {
  const params = new URLSearchParams({ filename: file.name })
  if (options.verifyPricing) { params.set('verifyPricing', 'true'); params.set('expirationDate', options.expirationDate || '') }
  return catalogRequest<ImportSummary>(`/api/catalog/import?${params}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
}

export function loadCatalogImportBatches() { return catalogRequest<{ batches: CatalogImportBatch[] }>('/api/catalog/import-batches') }
export function verifyCatalogImportBatch(batchId: string, expirationDate: string) { return catalogRequest<{ batchId: string; verifiedRecords: number; verifiedAt: string; expirationDate: string }>(`/api/catalog/import-batches/${batchId}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expirationDate }) }) }

export async function suggestCatalogProducts(query: string, limit = 8) {
  if (query.trim().length < 2) return []
  return (await searchCatalog({ q: query, pageSize: limit })).products
}

export function findVerifiedCatalogPrices(partNumber: string, manufacturer = '', quantity = 0) {
  const params = new URLSearchParams({ partNumber, manufacturer, quantity: String(quantity) })
  return catalogRequest<{ prices: VerifiedCatalogPrice[] }>(`/api/catalog/verified-prices?${params}`)
}
