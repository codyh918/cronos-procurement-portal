import type { Project } from '../types'

export type StructuredCustomer = {
  companyName: string
  attention: string
  streetAddress1: string
  streetAddress2: string
  city: string
  state: string
  zipCode: string
  country: string
  email: string
  phone: string
  customerNumber: string
  website: string
}

export function structuredCustomerFromProject(project?: Project, fallbackCompany = ''): StructuredCustomer {
  const parsed = parseLegacyAddress(project?.deliveryAddress ?? '')
  return {
    companyName: clean(project?.customer || fallbackCompany),
    attention: clean(project?.customerContactName),
    streetAddress1: clean(project?.customerAddress1 || parsed.streetAddress1),
    streetAddress2: clean(project?.customerAddress2 || parsed.streetAddress2),
    city: clean(project?.customerCity || parsed.city),
    state: clean(project?.customerState || parsed.state).toUpperCase(),
    zipCode: clean(project?.customerZip || parsed.zipCode),
    country: clean(project?.customerCountry),
    email: clean(project?.customerEmail),
    phone: clean(project?.customerPhone),
    customerNumber: clean(project?.customerNumber),
    website: clean(project?.customerWebsite),
  }
}

export function formatCustomerAddressLines(customer: StructuredCustomer) {
  return [
    customer.streetAddress1,
    customer.streetAddress2,
    [customer.city, [customer.state, customer.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    customer.country,
  ].map(clean).filter(Boolean)
}

export function formatCustomerBlockLines(project?: Project, fallbackCompany = '') {
  const customer = structuredCustomerFromProject(project, fallbackCompany)
  const lines = [customer.companyName]
  if (customer.attention && !sameText(customer.attention, customer.companyName)) {
    lines.push('Attention:', customer.attention)
  }
  lines.push(...formatCustomerAddressLines(customer))
  if (customer.email) lines.push('Email:', customer.email)
  if (customer.phone) lines.push('Phone:', customer.phone)
  if (customer.customerNumber) lines.push(`Customer Number: ${customer.customerNumber}`)
  if (customer.website) lines.push(customer.website)
  return lines.filter(Boolean)
}

export function normalizeCustomerFields(project: Project): Project {
  const parsed = parseLegacyAddress(project.deliveryAddress ?? '')
  return {
    ...project,
    customerAddress1: project.customerAddress1 ?? parsed.streetAddress1,
    customerAddress2: project.customerAddress2 ?? parsed.streetAddress2,
    customerCity: project.customerCity ?? parsed.city,
    customerState: project.customerState ?? parsed.state,
    customerZip: project.customerZip ?? parsed.zipCode,
    customerCountry: project.customerCountry ?? '',
    customerNumber: project.customerNumber ?? '',
    customerWebsite: project.customerWebsite ?? '',
  }
}

export function customerAddressIsComplete(project: Pick<Project, 'customer' | 'customerAddress1' | 'customerCity' | 'customerState' | 'customerZip'>) {
  return Boolean(project.customer?.trim() && project.customerAddress1?.trim() && project.customerCity?.trim() && project.customerState?.trim() && project.customerZip?.trim())
}

function parseLegacyAddress(value: string) {
  const lines = value.split(/\r?\n/).map(clean).filter(Boolean)
  const cityStateZip = parseCityStateZip(lines.at(-1) ?? '')
  const addressLines = cityStateZip.matched ? lines.slice(0, -1) : lines
  return {
    streetAddress1: addressLines[0] ?? '',
    streetAddress2: addressLines.slice(1).join(', '),
    city: cityStateZip.city,
    state: cityStateZip.state,
    zipCode: cityStateZip.zipCode,
  }
}

function parseCityStateZip(value: string) {
  const match = value.match(/^(.+?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/)
  if (!match) return { city: '', state: '', zipCode: '', matched: false }
  return { city: clean(match[1]), state: clean(match[2]).toUpperCase(), zipCode: clean(match[3]), matched: true }
}

function clean(value: unknown) {
  return String(value ?? '').trim()
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}
