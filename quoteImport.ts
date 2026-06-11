const exportKeys = [
  ['Projects', 'cronos.projects'],
  ['Customer Orders', 'cronos.customerOrders'],
  ['Vendor Directory', 'cronos.vendorDirectory'],
  ['Part Catalog', 'cronos.partCatalog'],
  ['Users', 'cronos.users'],
  ['Public Lookup Audit', 'cronos.publicLookupAuditLog'],
]

export function downloadExportCsv() {
  const rows = [
    ['Dataset', 'Records'],
    ...exportKeys.map(([label, key]) => [label, String(recordCount(key))]),
  ]
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'cronos-export.csv'
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function recordCount(key: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(value) ? value.length : value ? 1 : 0
  } catch {
    return 0
  }
}

function toCsv(rows: string[][]) {
  return rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
}
