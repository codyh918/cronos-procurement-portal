export const SEWP_STAGES = [
  'New',
  'Intake in Progress',
  'Intake Review Required',
  'Bid/No-Bid Review',
  'Approved to Pursue',
  'Vendor RFQs in Progress',
  'Waiting on Vendor Pricing',
  'Pricing Analysis',
  'Technical Review',
  'Compliance Review',
  'Internal Approval',
  'Ready for Submission',
  'Submitted',
  'Clarification or Amendment',
  'Awarded',
  'Lost',
  'No-Bid',
  'Cancelled',
]

export function validateCreateRfq(input) {
  const errors = []
  if (!isObject(input)) return { ok: false, errors: ['Request body must be a JSON object.'] }

  const title = cleanText(input.title, 300)
  const officialRfqNumber = cleanText(input.officialRfqNumber, 120)
  const source = cleanText(input.source, 80) || 'Manual'
  const responseDueAt = optionalIsoDate(input.responseDueAt, errors, 'responseDueAt')
  const questionsDueAt = optionalIsoDate(input.questionsDueAt, errors, 'questionsDueAt')

  if (!title) errors.push('title is required.')
  if (!officialRfqNumber) errors.push('officialRfqNumber is required.')

  return {
    ok: errors.length === 0,
    errors,
    value: {
      title,
      officialRfqNumber,
      source,
      agency: cleanText(input.agency, 200),
      customerOrganization: cleanText(input.customerOrganization, 250),
      category: cleanText(input.category, 120),
      setAside: cleanText(input.setAside, 120),
      priority: ['Low', 'Normal', 'High', 'Critical'].includes(input.priority) ? input.priority : 'Normal',
      responseDueAt,
      questionsDueAt,
      responseTimeZone: cleanText(input.responseTimeZone, 80) || 'America/New_York',
      estimatedValue: optionalNonnegativeNumber(input.estimatedValue, errors, 'estimatedValue'),
      ownerUserId: optionalUuid(input.ownerUserId, errors, 'ownerUserId'),
      backupOwnerUserId: optionalUuid(input.backupOwnerUserId, errors, 'backupOwnerUserId'),
      notes: cleanText(input.notes, 5000),
    },
  }
}

export function validatePagination(url) {
  const page = boundedInteger(url.searchParams.get('page'), 1, 1, 100000)
  const pageSize = boundedInteger(url.searchParams.get('pageSize'), 25, 1, 100)
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 }
}

export function validateStageTransition(input) {
  const targetStage = cleanText(input?.targetStage, 80)
  const justification = cleanText(input?.justification, 2000)
  const expectedVersion = Number(input?.expectedVersion)
  const errors = []
  if (!SEWP_STAGES.includes(targetStage)) errors.push('targetStage is invalid.')
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) errors.push('expectedVersion must be a positive integer.')
  return { ok: !errors.length, errors, value: { targetStage, justification, expectedVersion } }
}

export function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength)
}

function optionalIsoDate(value, errors, field) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    errors.push(`${field} must be a valid ISO date/time.`)
    return null
  }
  return date.toISOString()
}

function optionalNonnegativeNumber(value, errors, field) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors.push(`${field} must be a nonnegative number.`)
    return null
  }
  return parsed
}

function optionalUuid(value, errors, field) {
  if (value === undefined || value === null || value === '') return null
  const normalized = String(value).toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    errors.push(`${field} must be a UUID.`)
    return null
  }
  return normalized
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
