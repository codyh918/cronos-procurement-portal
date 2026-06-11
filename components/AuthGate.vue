<template>
  <slot v-if="!requiresAuth || session" />

  <div v-else class="auth-gate-page">
    <form class="auth-card" @submit.prevent="login">
      <div class="auth-heading">
        <span>
          <LockKeyhole :size="22" />
        </span>
        <div>
          <h1>Cronos Login</h1>
          <p>Sign in to Sales &amp; Procurement.</p>
        </div>
      </div>

      <label class="auth-field">
        <span>Email</span>
        <input v-model="email" type="email" />
      </label>

      <label class="auth-field">
        <span>Password</span>
        <input v-model="password" type="password" />
      </label>

      <p v-if="message" class="auth-error">{{ message }}</p>

      <button type="submit">Sign In</button>

      <div class="auth-note">
        <p>Use the admin account seeded in PostgreSQL.</p>
        <p>Default local seed: cody.hibbard@cronosllc.com / admin</p>
        <p>Change the password before production use.</p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { LockKeyhole } from '@lucide/vue'
import { ensureDefaultAdminSession, fetchSession, loginUser } from '../services/auth'
import type { UserSession } from '../types'

const requiresAuth = import.meta.env.VITE_REQUIRE_AUTH === '1'
const session = ref<UserSession | null>(null)
const email = ref('cody.hibbard@cronosllc.com')
const password = ref('')
const message = ref('')

onMounted(() => {
  refreshSession()
  window.addEventListener('cronos:session-changed', refreshSession)
})

onUnmounted(() => {
  window.removeEventListener('cronos:session-changed', refreshSession)
})

function refreshSession() {
  session.value = requiresAuth ? fetchSession() : ensureDefaultAdminSession()
}

function login() {
  try {
    session.value = loginUser(email.value, password.value)
    message.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Login failed. Check the email, password, and active status.'
  }
}
</script>
