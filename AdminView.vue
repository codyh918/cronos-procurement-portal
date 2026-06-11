export const VENDOR_OPTIONS = [
  '45Drives Enterprise',
  'Accu-Tech',
  'ACG',
  'Adder',
  'Adobe',
  'Almo',
  'Amazon',
  'Amazon Business',
  'Anixter',
  'Apantac',
  'Audio Technica',
  'AV Pro Supply',
  'B&H',
  'Biamp',
  'Brady ID',
  'Cable Wholesale',
  'Carahsoft',
  'CDW-G',
  'Celadon',
  'Cisco',
  'Collins',
  'Compunetix',
  'Crestron',
  'CTG Federal',
  'D&H',
  'D&H (Cisco)',
  'Digikey',
  'DLT',
  'Extron',
  'Fastenal',
  'FS',
  'GPO Display',
  'Grainger',
  'Haivision',
  'Home Depot',
  'Icron',
  'L-Com',
  'Legrand',
  'Lowe\'s',
  'Markertek',
  'Masterclock',
  'McMaster-Carr',
  'MSC',
  'Newegg',
  'Northern Tool',
  'PDU Cables',
  'Planet Tech',
  'Planet Technology',
  'Planar',
  'Provantage',
  'Radwell',
  'RS',
  'Sentinal Connector',
  'Sentinel Connector',
  'Synnex',
  'TD Synnex',
  'Tessco',
  'TOA Electronics',
  'True Cable',
  'TrueCable',
  'Uline',
  'Vanguard',
  'Vetra',
  'Walmart',
  'West Penn',
  'Zoro',
] as const

export function getVendorOptions(currentVendor = '') {
  const trimmed = currentVendor.trim()
  const vendors = uniqueVendors([...loadCustomVendorNames(), ...VENDOR_OPTIONS])
  return trimmed && !vendors.some(vendor => vendor.toLowerCase() === trimmed.toLowerCase()) ? [trimmed, ...vendors] : vendors
}

function loadCustomVendorNames() {
  try {
    const records = JSON.parse(window.localStorage.getItem('cronos.vendorDirectory') ?? '[]') as Array<{ vendor?: string }>
    return records.map(record => record.vendor ?? '').filter(Boolean)
  } catch {
    return []
  }
}

function uniqueVendors(values: readonly string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}
