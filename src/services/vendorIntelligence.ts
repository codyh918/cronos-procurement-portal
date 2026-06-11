import { VENDOR_OPTIONS } from './vendors'

export type VendorProfile = {
  vendor: (typeof VENDOR_OPTIONS)[number]
  oems: string[]
  products: string[]
  keywords: string[]
}

export const VENDOR_PROFILES: VendorProfile[] = [
  profile('45Drives Enterprise', ['45Drives'], ['storage servers', 'NAS', 'Ceph storage'], ['45drives', 'storinator', 'storage']),
  profile('Accu-Tech', ['Belden', 'CommScope', 'Leviton', 'Panduit'], ['cabling', 'network infrastructure', 'fiber', 'racks'], ['accu-tech', 'accutech', 'belden', 'commscope', 'panduit', 'fiber']),
  profile('ACG', [], ['AV equipment', 'systems integration supply'], ['acg']),
  profile('Adder', ['Adder'], ['KVM', 'IP KVM', 'extenders'], ['adder', 'kvm', 'ipeps', 'alink']),
  profile('Adobe', ['Adobe'], ['Acrobat', 'Creative Cloud', 'software licensing'], ['adobe', 'acrobat', 'creative cloud']),
  profile('Almo', ['Samsung', 'LG', 'Sharp', 'NEC', 'Peerless-AV'], ['pro AV', 'displays', 'mounts'], ['almo', 'display', 'commercial tv']),
  profile('Amazon', ['Amazon Basics'], ['general supplies', 'electronics', 'tools'], ['amazon']),
  profile('Amazon Business', ['Amazon Basics'], ['general supplies', 'electronics', 'tools'], ['amazon business', 'amazon']),
  profile('Anixter', ['Belden', 'CommScope', 'Panduit', 'Leviton'], ['wire', 'cable', 'security', 'network infrastructure'], ['anixter', 'belden', 'commscope', 'panduit']),
  profile('Apantac', ['Apantac'], ['multiviewers', 'video processing', 'KVM over IP'], ['apantac', 'multiviewer']),
  profile('Audio Technica', ['Audio-Technica'], ['microphones', 'headphones', 'wireless audio'], ['audio-technica', 'audiotechnica', 'microphone']),
  profile('AV Pro Supply', ['Blackmagic Design', 'AJA', 'Kramer', 'Chief'], ['pro AV', 'video production', 'mounts'], ['av pro', 'blackmagic', 'aja', 'kramer']),
  profile('B&H', ['Sony', 'Canon', 'Blackmagic Design', 'AJA', 'Sennheiser'], ['photo', 'video', 'pro AV', 'computers'], ['b&h', 'bhphoto', 'camera', 'video']),
  profile('Biamp', ['Biamp'], ['DSP', 'conferencing audio', 'amplifiers', 'speakers'], ['biamp', 'tesira', 'devio', 'vocia']),
  profile('Brady ID', ['Brady'], ['labels', 'wire markers', 'printers'], ['brady', 'label', 'bmp']),
  profile('Cable Wholesale', ['CableWholesale'], ['cables', 'adapters', 'bulk wire'], ['cable wholesale', 'cable']),
  profile('Carahsoft', ['Adobe', 'Autodesk', 'Red Hat', 'VMware', 'Google', 'ServiceNow', 'Salesforce', 'Atlassian'], ['public sector software', 'cloud', 'cybersecurity', 'IT services'], ['carahsoft', 'software', 'subscription', 'license', 'autodesk', 'red hat', 'vmware']),
  profile('CDW-G', ['Cisco', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'APC'], ['IT hardware', 'software', 'networking', 'end-user devices'], ['cdw', 'cdw-g', 'laptop', 'server', 'switch']),
  profile('Celadon', [], ['technical products', 'specialty procurement'], ['celadon']),
  profile('Cisco', ['Cisco', 'Meraki'], ['switches', 'routers', 'wireless', 'collaboration'], ['cisco', 'meraki', 'catalyst', 'nexus']),
  profile('Collins', ['Collins Aerospace'], ['aerospace', 'communications'], ['collins']),
  profile('Compunetix', ['Compunetix'], ['conferencing', 'mission voice', 'collaboration systems'], ['compunetix']),
  profile('Crestron', ['Crestron'], ['AV control', 'room scheduling', 'DM NVX', 'switchers'], ['crestron', 'dm-nvx', 'dmps', 'tsw']),
  profile('CTG Federal', [], ['federal IT', 'services', 'procurement'], ['ctg federal']),
  profile('D&H', ['Acer', 'ASUS', 'Belkin', 'Dell', 'Eaton', 'HP', 'Lenovo', 'Logitech', 'Microsoft', 'Samsung', 'StarTech'], ['IT distribution', 'computers', 'peripherals', 'networking'], ['d&h', 'dandh', 'notebook', 'desktop', 'peripheral']),
  profile('D&H (Cisco)', ['Cisco', 'Meraki'], ['Cisco networking', 'switches', 'wireless'], ['cisco', 'meraki', 'catalyst']),
  profile('Digikey', ['Molex', 'Amphenol', 'TE Connectivity', 'Phoenix Contact', 'Mean Well'], ['electronic components', 'connectors', 'power supplies'], ['digikey', 'molex', 'connector', 'capacitor', 'resistor']),
  profile('DLT', ['Autodesk', 'Oracle', 'Red Hat', 'SolarWinds', 'Quest'], ['public sector software', 'cloud', 'cybersecurity'], ['dlt', 'software', 'autodesk', 'solarwinds']),
  profile('Extron', ['Extron'], ['AV control', 'signal switching', 'AV over IP', 'scalers', 'extenders'], ['extron', 'dtp', 'xtp', 'nav', 'ipcp', 'touchlink']),
  profile('Fastenal', ['Fastenal'], ['fasteners', 'industrial supplies', 'safety'], ['fastenal', 'bolt', 'screw', 'fastener']),
  profile('FS', ['FS'], ['fiber optics', 'network switches', 'transceivers'], ['fs.com', 'fiberstore', 'sfp', 'transceiver']),
  profile('Grainger', ['Grainger'], ['MRO', 'tools', 'safety', 'facility supplies'], ['grainger', 'mro', 'tool']),
  profile('GPO Display', ['GPO Display'], ['video walls', 'LCD displays', 'touch displays'], ['gpo display', 'video wall']),
  profile('Haivision', ['Haivision'], ['video streaming', 'encoders', 'decoders', 'SRT'], ['haivision', 'makito', 'srt']),
  profile('Home Depot', ['Husky', 'Milwaukee', 'DeWalt'], ['building supplies', 'tools', 'hardware'], ['home depot', 'depot', 'tool']),
  profile('Icron', ['Icron'], ['USB extenders', 'KVM extension'], ['icron', 'usb extender', 'raven']),
  profile('L-Com', ['L-com'], ['cables', 'connectors', 'antennas', 'enclosures'], ['l-com', 'lcom', 'cable', 'connector']),
  profile('Legrand', ['Legrand', 'Chief', 'Middle Atlantic', 'C2G', 'Vaddio', 'Luxul'], ['racks', 'mounts', 'cables', 'AV infrastructure'], ['legrand', 'middle atlantic', 'chief', 'c2g', 'vaddio', 'luxul']),
  profile('Lowe\'s', ['Kobalt', 'Craftsman'], ['building supplies', 'tools', 'hardware'], ['lowe', 'lowes', 'tool']),
  profile('Markertek', ['Neutrik', 'Canare', 'Belden', 'AJA', 'Blackmagic Design'], ['broadcast', 'AV cables', 'connectors', 'production'], ['markertek', 'neutrik', 'canare', 'broadcast']),
  profile('Masterclock', ['Masterclock'], ['timecode', 'NTP clocks', 'timing systems'], ['masterclock', 'ntp clock', 'timecode']),
  profile('McMaster-Carr', ['McMaster-Carr'], ['hardware', 'fasteners', 'raw materials', 'industrial supplies'], ['mcmaster', 'hardware', 'fastener']),
  profile('MSC', ['MSC'], ['industrial supplies', 'metalworking', 'MRO'], ['msc', 'industrial']),
  profile('Newegg', ['ASUS', 'MSI', 'Gigabyte', 'Intel', 'AMD'], ['computers', 'components', 'electronics'], ['newegg', 'motherboard', 'pc']),
  profile('Northern Tool', ['Ironton', 'Klutch', 'NorthStar'], ['tools', 'shop equipment', 'industrial supplies'], ['northern tool', 'klutch', 'ironton']),
  profile('PDU Cables', ['PDU Cables'], ['power cables', 'PDU cords', 'IEC cables'], ['pdu cables', 'iec', 'power cord']),
  profile('Planet Tech', ['Planet Technology'], ['network switches', 'industrial networking', 'PoE'], ['planet', 'poe switch']),
  profile('Planet Technology', ['Planet Technology'], ['network switches', 'industrial networking', 'PoE'], ['planet', 'poe switch']),
  profile('Planar', ['Planar'], ['LCD displays', 'LED video walls', 'touch displays'], ['planar', 'leyard', 'video wall']),
  profile('Provantage', ['Cisco', 'HP', 'Lenovo', 'Dell', 'Logitech', 'StarTech'], ['IT hardware', 'software', 'peripherals'], ['provantage', 'computer', 'networking']),
  profile('Radwell', ['Allen-Bradley', 'Siemens', 'Omron'], ['industrial automation', 'replacement parts', 'MRO'], ['radwell', 'plc', 'automation']),
  profile('RS', ['RS Pro', 'Arduino', 'Phoenix Contact', 'Schneider Electric'], ['electronics', 'industrial supplies', 'automation'], ['rs', 'rs pro', 'automation']),
  profile('Sentinal Connector', ['Sentinel Connector'], ['connectors', 'cables'], ['sentinal', 'sentinel', 'connector']),
  profile('Sentinel Connector', ['Sentinel Connector'], ['connectors', 'cables'], ['sentinal', 'sentinel', 'connector']),
  profile('Synnex', ['Cisco', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Samsung', 'APC'], ['IT distribution', 'software', 'hardware', 'networking'], ['synnex', 'td synnex', 'computer', 'networking']),
  profile('TD Synnex', ['Cisco', 'Dell', 'HP', 'Lenovo', 'Microsoft', 'Samsung', 'APC', 'Adobe', 'AMD'], ['IT distribution', 'software', 'hardware', 'networking'], ['td synnex', 'synnex', 'computer', 'networking']),
  profile('Tessco', ['CommScope', 'Times Microwave', 'PCTEL'], ['wireless', 'telecom', 'antennas', 'cabling'], ['tessco', 'antenna', 'wireless']),
  profile('TOA Electronics', ['TOA'], ['paging', 'public address', 'amplifiers', 'speakers'], ['toa', 'paging', 'speaker']),
  profile('True Cable', ['trueCABLE'], ['bulk Ethernet cable', 'keystone jacks', 'network cabling'], ['true cable', 'truecable', 'cat6', 'cat6a']),
  profile('TrueCable', ['trueCABLE'], ['bulk Ethernet cable', 'keystone jacks', 'network cabling'], ['true cable', 'truecable', 'cat6', 'cat6a']),
  profile('Uline', ['Uline'], ['shipping supplies', 'warehouse supplies', 'packing'], ['uline', 'shipping', 'box']),
  profile('Vanguard', [], ['specialty equipment', 'technical supplies'], ['vanguard']),
  profile('Vetra', ['Vetra'], ['KVM', 'video extenders', 'secure switching'], ['vetra', 'kvm']),
  profile('Walmart', ['onn.'], ['general supplies', 'electronics'], ['walmart']),
  profile('West Penn', ['West Penn Wire'], ['wire', 'cable', 'AV cabling'], ['west penn', 'wire']),
  profile('Zoro', ['Zoro'], ['MRO', 'tools', 'safety', 'industrial supplies'], ['zoro', 'mro', 'tool']),
]

export function recommendVendorForPart(partNumber: string, manufacturer = '', description = '') {
  const text = normalize(`${partNumber} ${manufacturer} ${description}`)
  if (!text) return ''

  const directVendor = VENDOR_PROFILES.find(vendor =>
    [vendor.vendor, ...vendor.oems, ...vendor.keywords].some(keyword => keyword && text.includes(normalize(keyword))),
  )

  return directVendor?.vendor ?? ''
}

export function getOemSuggestions(query: string) {
  const term = normalize(query)
  if (!term || term.length < 2) return []

  return VENDOR_PROFILES.flatMap(profile =>
    profile.oems
      .filter(oem => normalize(oem).includes(term))
      .map(oem => ({ oem, vendor: profile.vendor, products: profile.products.join(', ') })),
  ).slice(0, 10)
}

export function getVendorProfile(vendor: string) {
  return VENDOR_PROFILES.find(profile => normalize(profile.vendor) === normalize(vendor))
}

function profile(vendor: (typeof VENDOR_OPTIONS)[number], oems: string[], products: string[], keywords: string[]): VendorProfile {
  return { vendor, oems, products, keywords }
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}
