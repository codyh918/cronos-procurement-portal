<template>
  <aside class="sidebar" :class="{ 'is-admin-session': isAdmin }">
    <div class="sidebar-bg" />
    <div class="sidebar-brand">
      <div class="cronos-logo-spin" aria-label="Cronos logo">
        <img src="/cronos-logo.jpg" alt="Cronos" />
      </div>
    </div>

    <nav class="sidebar-nav" aria-label="Procurement navigation">
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
      <div class="profile-menu-wrap">
        <button class="profile-card" type="button" aria-haspopup="menu" :aria-expanded="profileMenuOpen" @click="toggleProfileMenu">
          <span class="profile-name">{{ session?.name ?? 'Signed In' }}</span>
          <ChevronDown :size="16" class="profile-chevron" :class="{ open: profileMenuOpen }" />
        </button>

        <div v-if="profileMenuOpen" class="profile-menu" role="menu">
          <RouterLink class="profile-menu-item" to="/account" role="menuitem" @click="closeProfileMenu">
            Account Settings
          </RouterLink>
          <RouterLink v-if="isAdmin" class="profile-menu-item" to="/users" role="menuitem" @click="closeProfileMenu">
            Manage Users
          </RouterLink>
          <RouterLink v-if="canSwitchRole" class="profile-menu-item" to="/roles" role="menuitem" @click="closeProfileMenu">
            Switch Role
          </RouterLink>
          <button class="profile-menu-item" type="button" role="menuitem" @click="signOut">Sign Out</button>
        </div>
      </div>

      <button class="theme-button" type="button" aria-label="Toggle theme" @click="toggleTheme">
        <component :is="themeIcon" :size="16" />
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Moon, Sun } from '@lucide/vue'
import { getNavigationForRole } from '../navigation'
import { fetchSession, getEffectiveRole, logoutUser, normalizeRole } from '../services/auth'
import type { NavItem, UserSession } from '../types'

const route = useRoute()
const theme = ref(document.documentElement.dataset.theme ?? 'light')
const session = ref<UserSession | null>(null)
const profileMenuOpen = ref(false)
const themeIcon = computed(() => (theme.value === 'dark' ? Sun : Moon))
const effectiveRole = computed(() => getEffectiveRole(session.value) ?? 'Procurement Team')
const canonicalRole = computed(() => normalizeRole(effectiveRole.value))
const isAdmin = computed(() => session.value?.role === 'Admin')
const canSwitchRole = computed(() => isAdmin.value || import.meta.env.DEV)
const navItems = computed(() => dedupeNav(getNavigationForRole(canonicalRole.value)))

onMounted(() => {
  refreshSession()
  window.addEventListener('cronos:session-changed', refreshSession)
  window.addEventListener('cronos:role-preview-changed', refreshSession)
  window.addEventListener('click', closeOnOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('cronos:session-changed', refreshSession)
  window.removeEventListener('cronos:role-preview-changed', refreshSession)
  window.removeEventListener('click', closeOnOutsideClick)
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
}

function dedupeNav(items: NavItem[]) {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

function toggleProfileMenu(event: MouseEvent) {
  event.stopPropagation()
  profileMenuOpen.value = !profileMenuOpen.value
}

function closeProfileMenu() {
  profileMenuOpen.value = false
}

function closeOnOutsideClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element) || !target.closest('.profile-menu-wrap')) {
    closeProfileMenu()
  }
}

function signOut() {
  closeProfileMenu()
  logoutUser()
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  localStorage.setItem('cronos.theme', theme.value)
}
</script>
