<template>
  <aside class="sidebar" :class="{ 'is-admin-session': session?.role === 'Admin' }">
    <div class="sidebar-bg" />
    <div class="sidebar-brand">
      <div class="cronos-logo-spin" aria-label="Cronos logo">
        <img src="/cronos-logo.jpg" alt="Cronos" />
      </div>
      <p class="brand-primary">Sales &amp; Procurement</p>
      <p class="brand-secondary">Solutions</p>
    </div>

    <nav class="sidebar-nav" aria-label="Procurement navigation">
      <div class="role-label">{{ effectiveRole }} View</div>
      <RouterLink
        v-for="item in navItems"
        :key="item.href"
        :to="item.href"
        class="nav-link"
        :class="{ active: isActive(item) }"
        @click="handleNavClick($event, item)"
      >
        <component :is="item.icon" :size="19" :stroke-width="2.1" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-user">
      <label v-if="session?.role === 'Admin'" class="preview-role-field">
        <span>Preview Role</span>
        <select :value="previewRole ?? ''" @change="setPreview(inputValue($event) as AppRole | '')">
          <option value="">Admin</option>
          <option v-for="role in previewableRoles" :key="role" :value="role">{{ role }}</option>
        </select>
      </label>
      <button
        v-if="session?.role === 'Admin'"
        class="account-link"
        type="button"
        title="Manage users, roles, and passwords"
        @click="openAdmin"
      >
        <div class="avatar">{{ initials }}</div>
        <div class="user-copy">
          <p>{{ session?.name ?? 'Signed In' }}</p>
          <span>Admin</span>
        </div>
      </button>
      <div v-else class="account-link">
        <div class="avatar">{{ initials }}</div>
        <div class="user-copy">
          <p>{{ session?.name ?? 'Signed In' }}</p>
          <span>{{ session?.role ?? 'User' }}</span>
        </div>
      </div>
      <button v-if="session?.role === 'Admin'" class="manage-users-button" type="button" @click="openAdmin">
        <Settings :size="14" />
        Manage Users
      </button>
      <button class="sign-out-button" type="button" @click="logoutUser">Sign out</button>
      <button class="theme-button" type="button" aria-label="Toggle theme" @click="toggleTheme">
        <component :is="themeIcon" :size="16" />
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BarChart3,
  Bot,
  Building2,
  ClipboardList,
  Database,
  FileText,
  Moon,
  PackageSearch,
  Settings,
  ShoppingCart,
  Sun,
  Users,
} from '@lucide/vue'
import { appRoles, fetchSession, getEffectiveRole, getRolePreview, logoutUser, setRolePreview } from '../services/auth'
import type { AppRole, NavItem, UserSession } from '../types'

const route = useRoute()
const router = useRouter()
const theme = ref(document.documentElement.dataset.theme ?? 'light')
const session = ref<UserSession | null>(null)
const previewRole = ref<AppRole | null>(null)
const themeIcon = computed(() => (theme.value === 'dark' ? Sun : Moon))
const effectiveRole = computed(() => getEffectiveRole(session.value) ?? 'Procurement Team')
const previewableRoles = computed(() => appRoles.filter(role => role !== 'Admin'))
const initials = computed(() =>
  (session.value?.name ?? 'User')
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const dashboardItem: NavItem = { href: '/', match: '/', label: 'Dashboard', icon: BarChart3 }
const atlasItem: NavItem = { href: '#assistant', match: '#assistant', label: 'Atlas', icon: Bot }
const navByRole: Record<AppRole, NavItem[]> = {
  Admin: [
    dashboardItem,
    { href: '/projects', match: '/projects', label: 'Projects', icon: ClipboardList },
    { href: '/quotes', match: '/quotes', label: 'Quotes', icon: FileText },
    { href: '/purchase-orders', match: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/admin/orders', match: '/admin/orders', label: 'Customer Orders', icon: PackageSearch },
    { href: '/catalog', match: '/catalog', label: 'Catalog', icon: Database },
    { href: '/vendors', match: '/vendors', label: 'Vendors', icon: Users },
    { href: '/customers', match: '/customers', label: 'Customers', icon: Building2 },
    atlasItem,
    { href: '/admin', match: '/admin', label: 'Administrative', icon: Settings },
  ],
  'Procurement Team': [
    dashboardItem,
    { href: '/projects', match: '/projects', label: 'Projects', icon: ClipboardList },
    { href: '/quotes', match: '/quotes', label: 'Quotes', icon: FileText },
    { href: '/purchase-orders', match: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/admin/orders', match: '/admin/orders', label: 'Customer Orders', icon: PackageSearch },
    { href: '/catalog', match: '/catalog', label: 'Catalog', icon: Database },
    { href: '/vendors', match: '/vendors', label: 'Vendors', icon: Users },
    atlasItem,
  ],
  Accounting: [
    dashboardItem,
    { href: '/projects', match: '/projects', label: 'Projects', icon: ClipboardList },
    { href: '/purchase-orders', match: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/customers', match: '/customers', label: 'Customers', icon: Building2 },
    atlasItem,
  ],
  Executive: [
    dashboardItem,
    { href: '/projects', match: '/projects', label: 'Projects', icon: ClipboardList },
    { href: '/purchase-orders', match: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/customers', match: '/customers', label: 'Customers', icon: Building2 },
    atlasItem,
  ],
}

const navItems = computed(() =>
  dedupeNav(navByRole[effectiveRole.value] ?? navByRole['Procurement Team']),
)

onMounted(() => {
  refreshSession()
  window.addEventListener('cronos:session-changed', refreshSession)
  window.addEventListener('cronos:role-preview-changed', refreshSession)
})

onUnmounted(() => {
  window.removeEventListener('cronos:session-changed', refreshSession)
  window.removeEventListener('cronos:role-preview-changed', refreshSession)
})

function isActive(item: NavItem) {
  if (item.match === '#assistant') return false
  return item.match === '/' ? route.path === '/' : route.path.startsWith(item.match)
}

function handleNavClick(event: MouseEvent, item: NavItem) {
  if (item.match !== '#assistant') return
  event.preventDefault()
  window.dispatchEvent(new Event('cronos:open-assistant'))
}

function refreshSession() {
  session.value = fetchSession()
  previewRole.value = getRolePreview()
}

function setPreview(role: AppRole | '') {
  setRolePreview(role)
  refreshSession()
}

function inputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLSelectElement ? target.value : ''
}

function dedupeNav(items: NavItem[]) {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

function openAdmin() {
  router.push('/admin')
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  localStorage.setItem('cronos.theme', theme.value)
}
</script>
