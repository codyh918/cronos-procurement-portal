import type { Project } from '../types'
import { loadUsers } from './auth'

export type DocumentContact = {
  name: string
  title: string
  email: string
  phone: string
  company: string
  cageCode: string
}

export const DEFAULT_CRONOS_CONTACT: DocumentContact = {
  name: 'Cronos Procurement Team',
  title: 'Procurement',
  email: 'procurement@cronosllc.com',
  phone: '',
  company: 'CRONOS LLC',
  cageCode: '8NPB1',
}

export function getProjectDocumentContact(project?: Project): DocumentContact {
  const assignedId = project?.assignedUserIds?.[0]
  if (!assignedId) return DEFAULT_CRONOS_CONTACT

  const assignedUser = loadUsers().find(user => user.id === assignedId && user.active !== false)
  if (!assignedUser) return DEFAULT_CRONOS_CONTACT

  return {
    name: assignedUser.name || DEFAULT_CRONOS_CONTACT.name,
    title: assignedUser.title || DEFAULT_CRONOS_CONTACT.title,
    email: assignedUser.email || DEFAULT_CRONOS_CONTACT.email,
    phone: assignedUser.phone || DEFAULT_CRONOS_CONTACT.phone,
    company: DEFAULT_CRONOS_CONTACT.company,
    cageCode: DEFAULT_CRONOS_CONTACT.cageCode,
  }
}

export function documentContactLines(contact: DocumentContact) {
  return [
    contact.name,
    contact.title,
    contact.email,
    contact.phone,
    contact.company,
    contact.cageCode ? `Cage Code: ${contact.cageCode}` : '',
  ].filter(Boolean)
}
