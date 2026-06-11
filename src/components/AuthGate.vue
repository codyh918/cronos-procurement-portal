<template>
  <slot v-if="session" />

  <div v-else class="auth-gate-page">
    <form class="auth-card" @submit.prevent="submit">
      <div class="auth-heading">
        <span>
          <LockKeyhole :size="22" />
        </span>
        <div>
          <h1>Cronos Login</h1>
          <p>Sign in to access the procurement workspace.</p>
        </div>
      </div>

      <label class="auth-field">
        <span>Email</span>
        <input v-model="email" type="email" autocomplete="username" />
      </label>

      <label class="auth-field">
        <span>Password</span>
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>

      <p v-if="message" class="auth-error">{{ message }}</p>

      <button type="submit">Sign In</button>

      <div class="auth-note">
        <p>Access is restricted to active Cronos users.</p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { LockKeyhole } from '@lucide/vue'
import { beginLogin, completeLogin, fetchSession } from '../services/auth'
import type { UserSession } from '../types'

const session = ref<UserSession | null>(null)
const email = ref('')
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
  session.value = fetchSession()
}

async function submit() {
  try {
    const pendingLogin = await beginLogin(email.value, password.value)
    session.value = await completeLogin(pendingLogin.id)
    password.value = ''
    message.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Login failed. Check the email, password, and active status.'
  }
}
</script>
