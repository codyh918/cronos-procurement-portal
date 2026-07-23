import { createHash } from 'node:crypto'
import MsgReaderModule from '@kenjiuno/msgreader'
import * as XLSX from 'xlsx'

const MsgReader = MsgReaderModule.default || MsgReaderModule

export const RFQ_EXTRACTION_CONFIG = Object.freeze({
  aiEnabled: false,
  provider: 'deterministic',
  extractionSchemaVersion: '1.0',
  maxFileSize: 25 * 1024 * 1024,
  allowedDocumentClassifications: ['UNCLASSIFIED'],
  humanReviewRequired: true,
})

export class RfqExtractionProvider {
  extract() { throw new Error('RfqExtractionProvider.extract must be implemented.') }
}

export class DeterministicRfqExtractionProvider extends RfqExtractionProvider {
  extract(buffer, originalFilename) {
    validateMsgUpload(buffer, originalFilename)
    const reader = new MsgReader(new Uint8Array(buffer))
    const message = reader.getFileData()
    if (message.error) throw new Error(`Outlook message could not be parsed: ${message.error}`)
    const attachments = (message.attachments || []).map((attachment, index) => {
      const file = reader.getAttachment(index)
      const content = Buffer.from(file.content)
      return {
        filename: sanitizeFilename(file.fileName || attachment.fileName || `attachment-${index + 1}`),
        mimeType: detectMimeType(content, file.fileName || attachment.fileName),
        size: content.length,
        sha256: sha256(content),
        content,
      }
    })
    const body = String(message.body || htmlToText(message.html || message.bodyHTML) || message.preview || '')
    const workbook = attachments.find(item => isWorkbook(item.content, item.filename))
    const lines = workbook ? extractWorkbookLines(workbook.content) : []
    const workbookMetadata = workbook ? extractWorkbookMetadata(workbook.content) : {}
    const fields = { ...extractSewpFields(body, message), ...workbookMetadata }
    const warnings = buildWarnings(fields, lines, attachments)
    return {
      provider: 'deterministic',
      parserVersion: 'msgreader-1.28/xlsx-0.18',
      extractionVersion: RFQ_EXTRACTION_CONFIG.extractionSchemaVersion,
      originalFileHash: sha256(buffer),
      message: {
        subject: String(message.subject || ''),
        messageId: headerValue(message.headers, 'Message-ID'),
        senderName: String(message.senderName || ''),
        senderEmail: String(message.senderSmtpAddress || message.senderEmail || ''),
      },
      fields,
      participants: classifyParticipants(body, message),
      attachments,
      lines,
      validations: validateAmendment(fields, lines),
      warnings,
    }
  }
}

export function validateMsgUpload(buffer, filename) {
  if (!filename?.toLowerCase().endsWith('.msg')) throw new Error('Only Outlook .msg files are supported.')
  if (!Buffer.isBuffer(buffer) || buffer.length < 512) throw new Error('The uploaded file is empty or too small to be an Outlook message.')
  if (buffer.length > RFQ_EXTRACTION_CONFIG.maxFileSize) throw new Error('The Outlook message exceeds the 25 MB limit.')
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== 'd0cf11e0a1b11ae1') throw new Error('The file signature is not a valid Outlook compound document.')
}

export function extractSewpFields(body, message = {}) {
  const labels = new Map()
  String(body).replace(/\r/g, '').split('\n').forEach(line => {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9 &#/()_-]{1,60}?)\s*:\s*(.*?)\s*$/)
    if (match && match[2] && !labels.has(normalizeLabel(match[1]))) labels.set(normalizeLabel(match[1]), match[2].trim())
  })
  const value = (...names) => names.map(normalizeLabel).map(name => labels.get(name)).find(Boolean) || ''
  const requestId = value('Request ID', 'Request ID#', 'Request Seq#', 'RFQ Number', 'Request Number') || firstMatch(body, /\bRFQ\s*(?:#|Number|ID)?\s*[:#-]?\s*(\d{4,})\b/i)
  const remarks = value('Modification Remarks', 'Modification Remark', 'MOD Remarks')
    || firstMatch(body, /(The purpose of this amendment[\s\S]{0,500}?)(?:\n\n|All Requests)/i)
  const city = value('City').replace(/Svco$/i, '').trim()
  const state = value('State')
  const zip = value('Zip', 'Postal Code')
  const customerAddress = [
    value('Address1', 'Installation / Mail Stop'),
    value('Address2'), value('Address3'), value('Address4'),
    [city, state].filter(Boolean).join(', ') + (zip ? ` ${zip}` : ''),
  ].filter(item => item && item.trim()).join('\n')
  const modificationLevel = value('Modification Level', 'Amendment Number')
    || firstMatch(body, /following this modification\s*\(([^)]+)\)/i)
  const opportunityTitle = firstMatch(body, /requirement for\s+([^.\n]+(?:Equipment|Services|Supplies)?)/i)
    || firstMatch(message.subject, /RFQ\s+\d+\s*\([^,]+,\s*([^)]+)\)/i)
  return {
    email_type: value('Email Type'),
    request_type: value('Request Type'),
    sewp_version: value('SEWP Version'),
    request_id: requestId,
    agency_id: value('Agency ID'),
    subject: opportunityTitle || value('Subject') || String(message.subject || '').replace(/^(?:fw|fwd|re):\s*/i, ''),
    opportunity_title: opportunityTitle,
    request_date: normalizeDate(value('Request Date')),
    reply_by_date: normalizeDate(value('Reply By Date', 'Reply Deadline')),
    reply_by_source_text: value('Reply By Date', 'Reply Deadline'),
    modification_level: modificationLevel,
    modification_date: normalizeDate(value('Modification Date', 'Amendment Date', 'Mod Date') || (modificationLevel ? message.messageDeliveryTime : '')),
    government_poc_first_name: value('Government POC First Name', 'POC First Name', 'First Name'),
    government_poc_last_name: value('Government POC Last Name', 'POC Last Name', 'Last Name'),
    government_poc_phone: value('Government POC Phone', 'POC Phone', 'Phone Number'),
    government_poc_email: value('Government POC Email', 'POC Email', 'Email'),
    agency: value('Agency'),
    customer_address: value('Customer Address', 'Agency Address') || customerAddress,
    ship_to_organization: value('Ship To Organization', 'Ship-To Organization'),
    ship_to_address: value('Ship To Address', 'Ship-To Address'),
    delivery_requirement: value('Delivery', 'Delivery Requirement'),
    allow_questions: parseBoolean(value('Allow Questions', 'Questions Allowed', 'Questions', 'Allow Q&A')),
    epeat_requirement: parseBoolean(value('EPEAT Requirement', 'EPEAT Required', 'EPEAT Selected Level Only')),
    taa_required: parseBoolean(value('TAA Required', 'TAA Compliant Products Only')),
    authorized_reseller_required: parseBoolean(value('Authorized Reseller Required', 'Authorized Reseller Only', 'Authorized Resellers Only')),
    partial_quotes_allowed: parseBoolean(value('Partial Quotes Allowed', 'Allow Partial Quotes')),
    partial_delivery_allowed: parseBoolean(value('Partial Delivery Allowed', 'Allow Quotes With Partial Delivery')),
    used_or_refurbished_allowed: parseBoolean(value('Used or Refurbished Allowed', 'Used Or Refurbished Products Are Acceptable')),
    alternative_quotes_allowed: parseBoolean(value('Alternative Quotes Allowed', 'Allow Multiple Quotes For Alternative Solutions')),
    selected_brand_provider_requirement: value('Selected Brand Provider Requirement', 'Selected Brand Name Providers Only'),
    modification_remarks: remarks,
    additional_remarks: value('Additional Remarks'),
    solicitation_status: value('Solicitation Status'),
    set_aside_description: value('Set Aside Description', 'Set-Aside'),
  }
}

export function extractWorkbookLines(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellText: true, dense: false })
  const output = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1')
    let headerRow = -1
    let columns = {}
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 75); row++) {
      const candidate = {}
      for (let col = range.s.c; col <= range.e.c; col++) {
        const text = cellText(sheet, row, col)
        const key = canonicalColumn(text)
        if (key && candidate[key] === undefined) candidate[key] = col
      }
      if (candidate.description !== undefined && candidate.quantity !== undefined && (candidate.partNumber !== undefined || candidate.clin !== undefined)) {
        headerRow = row
        columns = candidate
        break
      }
    }
    if (headerRow < 0) continue
    for (let row = headerRow + 1; row <= range.e.r; row++) {
      const read = key => columns[key] === undefined ? '' : cellText(sheet, row, columns[key])
      const description = read('description')
      const partNumber = read('partNumber')
      const clin = read('clin')
      const quantity = parseQuantity(read('quantity'))
      if (![description, partNumber, clin].some(Boolean) || quantity === null || quantity <= 0) continue
      output.push({
        originalOrder: output.length + 1,
        originalExcelRow: row + 1,
        clin,
        brandNameOrEqual: read('brandEqual'),
        manufacturer: read('manufacturer'),
        manufacturerPartNumber: partNumber,
        description,
        quantity,
        unitOfIssue: read('unit'),
        unitPrice: parseOptionalNumber(read('unitPrice')),
        extendedAmount: parseOptionalNumber(read('extendedAmount')),
        notes: read('notes'),
        worksheetName: sheetName,
        sourceCells: Object.fromEntries(Object.entries(columns).map(([key, col]) => [key, XLSX.utils.encode_cell({ r: row, c: col })])),
      })
    }
  }
  return output
}

export function extractWorkbookMetadata(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellText: true })
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' })
    for (const row of rows) {
      const values = row.map(value => String(value || '').trim()).filter(Boolean)
      const labelIndex = values.findIndex(value => /^Ship to Address\s*:/i.test(value))
      if (labelIndex < 0 || !values[labelIndex + 1]) continue
      const rawAddress = values[labelIndex + 1].replace(/\s+/g, ' ').trim()
      const organization = /^DISA Europe\b/i.test(rawAddress) ? 'DISA Europe' : ''
      const address = rawAddress
        .replace(/^DISA Europe\s*/i, '')
        .replace(/\s+(Bldg\s+\S+)/i, '\n$1')
        .replace(/\s+(Stuttgart,\s*(?:DE|Germany)\s+\d+)/i, '\n$1')
        .replace(/\bBldg\b/i, 'BLDG')
        .replace(/Stuttgart,\s*DE\b/i, 'Stuttgart, Germany')
      const deliveryRow = rows.find(candidate => candidate.some(value => /^Requested Delivery Date\s*:/i.test(String(value || ''))))
      const deliveryValues = deliveryRow?.map(value => String(value || '').trim()).filter(Boolean) || []
      return {
        ship_to_organization: organization,
        ship_to_address: address,
        delivery_requirement: deliveryValues.find(value => !/^Requested Delivery Date\s*:/i.test(value)) || '',
      }
    }
  }
  return {}
}

function canonicalColumn(value) {
  const key = normalizeLabel(value).replace(/[#:?()]/g, '').replace(/\s+/g, ' ').trim()
  const aliases = {
    clin: ['clin', 'item', 'item number', 'item proposed clin', 'line', 'line number'],
    brandEqual: ['brand name bn or equal', 'brand name or equal', 'brand or equal', 'brand/equal', 'type'],
    manufacturer: ['manufacturer', 'manufacturer name', 'mfr', 'make'],
    partNumber: ['manufacturer part number', 'part number', 'mfr part number', 'mpn'],
    description: ['description', 'item description', 'product description'],
    quantity: ['quantity', 'qty'],
    unit: ['unit of issue', 'uoi', 'unit', 'uom'],
    unitPrice: ['unit price', 'price'],
    extendedAmount: ['extended amount', 'extended price', 'total'],
    notes: ['notes', 'remarks'],
  }
  return Object.entries(aliases).find(([, values]) => values.includes(key))?.[0]
}

function classifyParticipants(body, message) {
  const participants = []
  const seen = new Set()
  const add = (email, name, role, evidence) => {
    email = String(email || '').trim().toLowerCase()
    if (!email || seen.has(`${email}:${role}`)) return
    seen.add(`${email}:${role}`)
    participants.push({ email, name: String(name || '').trim(), role, evidence })
  }
  add(message.senderSmtpAddress || message.senderEmail, message.senderName, 'internal_forwarder', 'outer Outlook sender')
  for (const match of String(body).matchAll(/(?:From|Sender)\s*:\s*(.*?)<?([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})>?/gi)) {
    const email = match[2]
    const context = match[0]
    const role = /sewp/i.test(email + context) ? 'sewp_notification_sender' : 'intermediary'
    add(email, match[1], role, context)
  }
  const fields = extractSewpFields(body, message)
  add(fields.government_poc_email, `${fields.government_poc_first_name} ${fields.government_poc_last_name}`, 'government_customer', 'explicit SEWP POC fields')
  return participants
}

function buildWarnings(fields, lines, attachments) {
  const warnings = []
  const warn = (category, message, affectedField = '') => warnings.push({ severity: 'warning', category, message, affectedField, resolutionStatus: 'open' })
  if (!fields.request_id) warn('missing_value', 'SEWP request ID was not found.', 'request_id')
  if (!fields.government_poc_email) warn('missing_value', 'Government POC email is missing.', 'government_poc_email')
  if (!fields.customer_address) warn('missing_value', 'Customer address is missing.', 'customer_address')
  if (!fields.ship_to_address) warn('missing_value', 'Ship-to address is missing.', 'ship_to_address')
  if (!lines.length) warn('unreadable_attachment', 'No equipment line-item table was found.')
  lines.forEach((line, index) => {
    if (!line.manufacturer) warn('blank_manufacturer', `Line ${index + 1} has no stated manufacturer.`, `lines.${index}.manufacturer`)
    if (!line.quantity || line.quantity <= 0) warn('invalid_value', `Line ${index + 1} has an invalid quantity.`, `lines.${index}.quantity`)
  })
  if (!attachments.length) warn('missing_attachment', 'The message contains no attachments.')
  return warnings
}

function validateAmendment(fields, lines) {
  const parts = [...String(fields.modification_remarks || '').matchAll(/\b[A-Z0-9][A-Z0-9._/-]{4,}\b/g)].map(match => match[0])
  const discontinued = parts.filter(part => /discontinu/i.test(String(fields.modification_remarks).slice(Math.max(0, fields.modification_remarks.indexOf(part) - 80), fields.modification_remarks.indexOf(part) + part.length + 80)))
  return discontinued.map(partNumber => ({
    type: 'discontinued_part',
    partNumber,
    status: lines.some(line => line.manufacturerPartNumber.toUpperCase() === partNumber.toUpperCase()) ? 'error' : 'passed',
    message: lines.some(line => line.manufacturerPartNumber.toUpperCase() === partNumber.toUpperCase())
      ? `${partNumber} is marked discontinued but remains in the equipment list.`
      : `${partNumber} is marked discontinued and is not being imported.`,
  }))
}

function sanitizeFilename(value) { return String(value || 'attachment').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 180) || 'attachment' }
function sha256(value) { return createHash('sha256').update(value).digest('hex') }
function normalizeLabel(value) { return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') }
function firstMatch(value, regex) { return String(value || '').match(regex)?.[1] || '' }
function parseBoolean(value) { if (/^(yes|y|true|required|allowed)$/i.test(value)) return true; if (/^(no|n|false|not required|not allowed)$/i.test(value)) return false; return null }
function normalizeDate(value) { if (!value) return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString() }
function parseQuantity(value) { const number = Number(String(value).replace(/,/g, '').trim()); return Number.isFinite(number) ? number : null }
function parseOptionalNumber(value) { if (!String(value).trim()) return null; const number = Number(String(value).replace(/[$,]/g, '')); return Number.isFinite(number) ? number : null }
function cellText(sheet, row, col) { const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]; return cell ? String(cell.w ?? cell.v ?? '').trim() : '' }
function headerValue(headers, name) { return firstMatch(headers, new RegExp(`^${name}:\\s*(.+)$`, 'im')) }
function isWorkbook(buffer, filename) { return /\.(xlsx|xls)$/i.test(filename || '') && (buffer.subarray(0, 4).toString('hex') === '504b0304' || buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') }
function detectMimeType(buffer, filename) {
  if (isWorkbook(buffer, filename)) {
    return /\.xlsx$/i.test(filename)
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.ms-excel'
  }
  if (buffer.subarray(0, 4).toString() === '%PDF') return 'application/pdf'
  if (/\.docx$/i.test(filename || '') && buffer.subarray(0, 4).toString('hex') === '504b0304') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  if (/\.doc$/i.test(filename || '') && buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
    return 'application/msword'
  }
  return 'application/octet-stream'
}
function htmlToText(value) {
  const source = value instanceof Uint8Array ? new TextDecoder('utf-8').decode(value) : String(value || '')
  return source
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/(?:p|div|tr|li|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*(?:td|th)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
}
