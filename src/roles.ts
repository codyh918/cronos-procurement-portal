import {
  BarChart3,
  BotMessageSquare,
  ClipboardList,
  Database,
  FileText,
  FileSearch,
  KeyRound,
  ListChecks,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
} from '@lucide/vue'
import type { CanonicalRole, NavItem } from './types'

export type AppPermission = 'manageUsers' | 'manageRoles' | 'manageSettings' | 'viewAuditLog'

export type RoleConfig = {
  name: CanonicalRole
  label: string
  workspaceLabel: string
  defaultLandingPage: string
  permissions: AppPermission[]
  allowedNavigationItems: string[]
}

export const navigationRegistry: Record<string, NavItem> = {
  dashboard: { href: '/', match: '/', label: 'Dashboard', icon: BarChart3 },
  projects: { href: '/projects', match: '/projects', label: 'Projects', icon: ClipboardList },
  quotes: { href: '/quotes', match: '/quotes', label: 'Quotes', icon: FileText },
  purchaseOrders: { href: '/purchase-orders', match: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
  sewpRfqs: { href: '/sewp-rfqs/dashboard', match: '/sewp-rfqs', label: 'SEWP RFQ Portal', icon: FileSearch },
  vendors: { href: '/vendors', match: '/vendors', label: 'Vendors', icon: Users },
  catalog: { href: '/catalog', match: '/catalog', label: 'Product Catalog', icon: Database },
  atlasAssistant: { href: '#assistant', match: '#assistant', label: 'Atlas Assistant', icon: BotMessageSquare },
  manageUsers: { href: '/users', match: '/users', label: 'Manage Users', icon: Users },
  roles: { href: '/roles', match: '/roles', label: 'Roles & Permissions', icon: ShieldCheck },
  settings: { href: '/settings', match: '/settings', label: 'Settings', icon: Settings },
  auditLog: { href: '/audit-log', match: '/audit-log', label: 'Audit Log', icon: ListChecks },
}

export const roleConfigs: Record<CanonicalRole, RoleConfig> = {
  procurement: {
    name: 'procurement',
    label: 'Procurement Team Member',
    workspaceLabel: 'Procurement Workspace',
    defaultLandingPage: '/',
    permissions: [],
    allowedNavigationItems: ['dashboard', 'projects', 'quotes', 'purchaseOrders', 'sewpRfqs', 'vendors', 'catalog', 'atlasAssistant'],
  },
  admin: {
    name: 'admin',
    label: 'Admin',
    workspaceLabel: 'Admin Console',
    defaultLandingPage: '/',
    permissions: ['manageUsers', 'manageRoles', 'manageSettings', 'viewAuditLog'],
    allowedNavigationItems: [
      'dashboard',
      'projects',
      'quotes',
      'purchaseOrders',
      'sewpRfqs',
      'vendors',
      'catalog',
      'atlasAssistant',
      'manageUsers',
      'roles',
      'settings',
      'auditLog',
    ],
  },
  engineering: {
    name: 'engineering',
    label: 'Engineering',
    workspaceLabel: 'Engineering Workspace',
    defaultLandingPage: '/catalog',
    permissions: [],
    allowedNavigationItems: ['dashboard', 'projects', 'catalog', 'atlasAssistant'],
  },
  sales: {
    name: 'sales',
    label: 'Sales',
    workspaceLabel: 'Sales Workspace',
    defaultLandingPage: '/catalog',
    permissions: [],
    allowedNavigationItems: ['dashboard', 'projects', 'quotes', 'catalog', 'atlasAssistant'],
  },
}

export const appRoleLabels = {
  admin: 'Admin',
  procurement: 'Procurement Team',
  engineering: 'Engineering',
  sales: 'Sales',
} as const

export const adminOnlyPaths = ['/users', '/roles', '/settings', '/audit-log', '/admin', '/admin/orders']

export function getRoleConfig(role: CanonicalRole) {
  return roleConfigs[role] ?? roleConfigs.procurement
}

export function getNavigationItemsForRole(role: CanonicalRole) {
  return getRoleConfig(role).allowedNavigationItems.map(key => navigationRegistry[key]).filter(Boolean)
}

export function hasPermission(role: CanonicalRole, permission: AppPermission) {
  return getRoleConfig(role).permissions.includes(permission)
}

export const roleIcon = KeyRound
