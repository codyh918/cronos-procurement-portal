import { VENDOR_OPTIONS } from './vendors'

const STORAGE_KEY = 'cronos.vendorDirectory'

export type VendorStatus = 'Active' | 'Inactive' | 'Preferred'

export type VendorDirectoryRecord = {
  vendorId: string
  vendor: string
  dbaName: string
  status: VendorStatus
  website: string
  primaryContact: string
  secondaryContact: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
  cageCode: string
  uei: string
  duns: string
  taxId: string
  paymentTerms: string
  leadTime: string
  preferredVendor: boolean
  manufacturerAuthorization: string
  smallBusinessType: string
  accountNumber: string
  notes: string
  oems: string[]
  products: string[]
  createdDate: string
  lastUpdated: string
  createdBy: string
}

const WEBSITE_BY_VENDOR: Record<string, string> = {
  '45Drives Enterprise': 'https://www.45drives.com',
  'Accu-Tech': 'https://www.accu-tech.com',
  Adder: 'https://www.adder.com',
  Adobe: 'https://www.adobe.com',
  Almo: 'https://www.exertisalmo.com',
  Amazon: 'https://www.amazon.com',
  'Amazon Business': 'https://business.amazon.com',
  Anixter: 'https://www.anixter.com',
  Apantac: 'https://www.apantac.com',
  'Audio Technica': 'https://www.audio-technica.com',
  'B&H': 'https://www.bhphotovideo.com',
  Biamp: 'https://www.biamp.com',
  'Brady ID': 'https://www.bradyid.com',
  Carahsoft: 'https://www.carahsoft.com',
  'CDW-G': 'https://www.cdwg.com',
  Cisco: 'https://www.cisco.com',
  Compunetix: 'https://www.compunetix.com',
  Crestron: 'https://www.crestron.com',
  'D&H': 'https://www.dandh.com',
  'D&H (Cisco)': 'https://www.dandh.com',
  Digikey: 'https://www.digikey.com',
  DLT: 'https://www.dlt.com',
  Extron: 'https://www.extron.com',
  Fastenal: 'https://www.fastenal.com',
  FS: 'https://www.fs.com',
  Grainger: 'https://www.grainger.com',
  'GPO Display': 'https://www.gpodisplay.com',
  Haivision: 'https://www.haivision.com',
  'Home Depot': 'https://www.homedepot.com',
  Icron: 'https://www.icron.com',
  'L-Com': 'https://www.l-com.com',
  Legrand: 'https://www.legrandav.com',
  "Lowe's": 'https://www.lowes.com',
  Markertek: 'https://www.markertek.com',
  Masterclock: 'https://www.masterclock.com',
  'McMaster-Carr': 'https://www.mcmaster.com',
  MSC: 'https://www.mscdirect.com',
  Newegg: 'https://www.newegg.com',
  'Northern Tool': 'https://www.northerntool.com',
  'PDU Cables': 'https://www.pducables.com',
  'Planet Tech': 'https://planetechusa.com',
  'Planet Technology': 'https://planetechusa.com',
  Planar: 'https://www.planar.com',
  Provantage: 'https://www.provantage.com',
  Radwell: 'https://www.radwell.com',
  RS: 'https://www.rs-online.com',
  Synnex: 'https://www.tdsynnex.com',
  'TD Synnex': 'https://www.tdsynnex.com',
  Tessco: 'https://www.tessco.com',
  'TOA Electronics': 'https://www.toaelectronics.com',
  'True Cable': 'https://www.truecable.com',
  TrueCable: 'https://www.truecable.com',
  Uline: 'https://www.uline.com',
  Vetra: 'https://www.vetra.com',
  Walmart: 'https://www.walmart.com',
  'West Penn': 'https://www.westpennwire.com',
  Zoro: 'https://www.zoro.com',
}

const PROFILE_BY_VENDOR: Record<string, { oems: string[]; products: string[] }> = {
  '45Drives Enterprise': { oems: ['45Drives'], products: ['storage servers', 'NAS', 'Ceph storage'] },
  'Accu-Tech': { oems: ['Belden', 'CommScope', 'Leviton', 'Panduit'], products: ['cabling', 'network infrastructure', 'fiber', 'racks'] },
  ACG: { oems: [], products: ['AV equipment', 'systems integration supply'] },
  Adder: { oems: ['Adder'], products: ['KVM', 'IP KVM', 'extenders'] },
  Adobe: { oems: ['Adobe'], products: ['Acrobat', 'Creative Cloud', 'software licensing'] },
  Almo: { oems: ['Samsung', 'LG', 'Sharp', 'NEC', 'Peerless-AV'], products: ['pro AV', 'displays', 'mounts'] },
  Amazon: { oems: ['Amazon Basics'], products: ['general supplies', 'electronics', 'tools'] },
  'Amazon Business': { oems: ['Amazon Basics'], products: ['general supplies', 'electronics', 'tools'] },
  Anixter: { oems: ['Belden', 'CommScope', 'Panduit', 'Leviton'], products: ['wire', 'cable', 'security', 'network infrastructure'] },
  Apantac: { oems: ['Apantac'], products: ['multiviewers', 'video processing', 'KVM over IP'] },
  'Audio Technica': { oems: ['Audio-Technica'], products: ['microphones', 'headphones', 'wireless audio'] },
  'AV Pro Supply': { oems: ['Blackmagic Design', 'AJA', 'Kramer', 'Chief'], products: ['pro AV', 'video production', 'mounts'] },
  'B&H': { oems: ['Sony', 'Canon', 'Blackmagic Design', 'AJA', 'Sennheiser'], products: ['photo', 'video', 'pro AV', 'computers'] },
  Biamp: { oems: ['Biamp'], products: ['DSP', 'conferencing audio', 'amplifiers', 'speakers'] },
  'Brady ID': { oems: ['Brady'], products: ['labels', 'wire markers', 'printers'] },
  'Cable Wholesale': { oems: ['CableWholesale'], products: ['cables', 'adapters', 'bulk wire'] },
  Carahsoft: { oems: ['Adobe', 'Autodesk', 'Red Hat', 'VMware', 'Google', 'ServiceNow', 'Salesforce', 'Atlassian'], products: ['public sector software', 'cloud', 'cybersecurity', 'IT services'] },
  'CDW-G': { oems: ['Cisco', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'APC'], products: ['IT hardware', 'software', 'networking', 'end-user devices'] },
  Cisco: { oems: ['Cisco', 'Meraki'], products: ['switches', 'routers', 'wireless', 'collaboration'] },
  Crestron: { oems: ['Crestron'], products: ['AV control', 'room scheduling', 'DM NVX', 'switchers'] },
  'D&H': { oems: ['Acer', 'ASUS', 'Belkin', 'Dell', 'Eaton', 'HP', 'Lenovo', 'Logitech', 'Microsoft', 'Samsung', 'StarTech'], products: ['IT distribution', 'computers', 'peripherals', 'networking'] },
  'D&H (Cisco)': { oems: ['Cisco', 'Meraki'], products: ['Cisco networking', 'switches', 'wireless'] },
  Digikey: { oems: ['Molex', 'Amphenol', 'TE Connectivity', 'Phoenix Contact', 'Mean Well'], products: ['electronic components', 'connectors', 'power supplies'] },
  Extron: { oems: ['Extron'], products: ['AV control', 'signal switching', 'AV over IP', 'scalers', 'extenders'] },
  Grainger: { oems: ['Grainger'], products: ['MRO', 'tools', 'safety', 'facility supplies'] },
  Legrand: { oems: ['Legrand', 'Chief', 'Middle Atlantic', 'C2G', 'Vaddio', 'Luxul'], products: ['racks', 'mounts', 'cables', 'AV infrastructure'] },
  Markertek: { oems: ['Neutrik', 'Canare', 'Belden', 'AJA', 'Blackmagic Design'], products: ['broadcast', 'AV cables', 'connectors', 'production'] },
  'McMaster-Carr': { oems: ['McMaster-Carr'], products: ['hardware', 'fasteners', 'raw materials', 'industrial supplies'] },
  Planar: { oems: ['Planar'], products: ['LCD displays', 'LED video walls', 'touch displays'] },
  Provantage: { oems: ['Cisco', 'HP', 'Lenovo', 'Dell', 'Logitech', 'StarTech'], products: ['IT hardware', 'software', 'peripherals'] },
  'TD Synnex': { oems: ['Cisco', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Samsung', 'APC', 'Adobe', 'AMD'], products: ['IT distribution', 'software', 'hardware', 'networking'] },
  Synnex: { oems: ['Cisco', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Samsung', 'APC'], products: ['IT distribution', 'software', 'hardware', 'networking'] },
  Uline: { oems: ['Uline'], products: ['shipping supplies', 'warehouse supplies', 'packing'] },
  'West Penn': { oems: ['West Penn Wire'], products: ['wire', 'cable', 'AV cabling'] },
  Zoro: { oems: ['Zoro'], products: ['MRO', 'tools', 'safety', 'industrial supplies'] },
}

export function loadVendorDirectory() {
  const stored = loadStoredRecords()
  const storedByVendor = new Map(stored.map(record => [normalize(record.vendor), record]))
  const vendorNames = uniqueVendorNames([...VENDOR_OPTIONS, ...stored.map(record => record.vendor)])

  return vendorNames.map(vendor => {
    const profile = PROFILE_BY_VENDOR[vendor]
    const storedRecord = storedByVendor.get(normalize(vendor))

    return normalizeRecord({
      status: 'Active',
      website: WEBSITE_BY_VENDOR[vendor] ?? '',
      primaryContact: '',
      email: '',
      phone: '',
      accountNumber: '',
      notes: '',
      ...storedRecord,
      vendor,
      oems: profile?.oems ?? storedRecord?.oems ?? [],
      products: profile?.products ?? storedRecord?.products ?? [],
    })
  })
}

export function createEmptyVendorRecord(vendor: string): VendorDirectoryRecord {
  const now = new Date().toISOString()
  return normalizeRecord({
    vendorId: nextVendorId(),
    vendor,
    dbaName: '',
    status: 'Active',
    website: '',
    primaryContact: '',
    secondaryContact: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    cageCode: '',
    uei: '',
    duns: '',
    taxId: '',
    paymentTerms: '',
    leadTime: '',
    preferredVendor: false,
    manufacturerAuthorization: '',
    smallBusinessType: '',
    accountNumber: '',
    notes: '',
    oems: [],
    products: [],
    createdDate: now,
    lastUpdated: now,
    createdBy: '',
  })
}

export function saveVendorDirectory(records: VendorDirectoryRecord[]) {
  const normalized = records.map(normalizeRecord)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

function loadStoredRecords() {
  try {
    return (JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as VendorDirectoryRecord[]).map(normalizeRecord)
  } catch {
    return []
  }
}

function normalizeRecord(record: Partial<VendorDirectoryRecord> & { vendor: string }): VendorDirectoryRecord {
  const now = new Date().toISOString()
  return {
    vendorId: record.vendorId || nextVendorId(),
    vendor: record.vendor,
    dbaName: record.dbaName ?? '',
    status: record.status ?? 'Active',
    website: record.website ?? '',
    primaryContact: record.primaryContact ?? '',
    secondaryContact: record.secondaryContact ?? '',
    email: record.email ?? '',
    phone: record.phone ?? '',
    addressLine1: record.addressLine1 ?? '',
    addressLine2: record.addressLine2 ?? '',
    city: record.city ?? '',
    state: record.state ?? '',
    zipCode: record.zipCode ?? '',
    country: record.country ?? '',
    cageCode: record.cageCode ?? '',
    uei: record.uei ?? '',
    duns: record.duns ?? '',
    taxId: record.taxId ?? '',
    paymentTerms: record.paymentTerms ?? '',
    leadTime: record.leadTime ?? '',
    preferredVendor: Boolean(record.preferredVendor || record.status === 'Preferred'),
    manufacturerAuthorization: record.manufacturerAuthorization ?? '',
    smallBusinessType: record.smallBusinessType ?? '',
    accountNumber: record.accountNumber ?? '',
    notes: record.notes ?? '',
    oems: record.oems ?? [],
    products: record.products ?? [],
    createdDate: record.createdDate ?? now,
    lastUpdated: record.lastUpdated ?? now,
    createdBy: record.createdBy ?? '',
  }
}

function nextVendorId() {
  return `V-${String(Date.now()).slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function uniqueVendorNames(values: readonly string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}
