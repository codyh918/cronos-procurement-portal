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
}

export type CatalogSearch = {
  q?: string; page?: number; pageSize?: number; manufacturer?: string[]; category?: string[]; supplier?: string[]
  minPrice?: number | null; maxPrice?: number | null; leadTimeDays?: number | null; purchasable?: boolean | null
  inStock?: boolean | null; taaCompliant?: boolean | null; serialRequired?: boolean | null; active?: boolean | null
}

export type ImportSummary = {
  batchId: string; sourceFile: string; totalRows: number; newProducts: number; updatedProducts: number
  duplicateRecords: number; errors: Array<{ row: number; error: string }>; skippedRows: number; priceChanges: number
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

export function loadCatalogProduct(id: string) {
  return catalogRequest<{ product: CatalogProduct; pricingHistory: Array<Record<string, unknown>>; auditTrail: Array<Record<string, unknown>>; relatedProducts: CatalogProduct[] }>(`/api/catalog/products/${id}`)
}

export function updateCatalogProduct(id: string, changes: Record<string, unknown>) {
  return catalogRequest<{ product: CatalogProduct }>(`/api/catalog/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
}

export function importCatalog(file: File) {
  return catalogRequest<ImportSummary>(`/api/catalog/import?filename=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
}

export async function suggestCatalogProducts(query: string, limit = 8) {
  if (query.trim().length < 2) return []
  return (await searchCatalog({ q: query, pageSize: limit })).products
}
