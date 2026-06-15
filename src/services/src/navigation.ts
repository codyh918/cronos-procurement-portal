import { adminOnlyPaths, getNavigationItemsForRole } from './roles'
import type { CanonicalRole } from './types'

export const allRoles: CanonicalRole[] = ['admin', 'procurement']

export function getNavigationForRole(role: CanonicalRole) {
  return getNavigationItemsForRole(role)
}

export function getAllowedRolesForPath(path: string) {
  if (adminOnlyPaths.some(item => path === item || path.startsWith(`${item}/`))) {
    return ['admin'] as CanonicalRole[]
  }

  if (
    path === '/' ||
    path.startsWith('/projects') ||
    path.startsWith('/quotes') ||
    path.startsWith('/purchase-orders') ||
    path.startsWith('/vendors') ||
    path.startsWith('/catalog') ||
    path.startsWith('/account')
  ) {
    return ['admin', 'procurement'] as CanonicalRole[]
  }

  return undefined
}
