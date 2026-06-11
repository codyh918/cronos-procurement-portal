<template>
  <slot v-if="session" />

  <div v-else class="auth-gate-page">
    <form class="auth-card" @submit.prevent="submit">
      <div class="auth-heading">
        <span>
          <LockKeyhole :size="22" />
        </span>
        <div>
          <h1>{{ pendingLogin ? 'Two-Factor Verification' : 'Cronos Login' }}</h1>
          <p>{{ pendingLogin ? 'Enter the 6-digit code from your authenticator app.' : 'Sign in to access the procurement workspace.' }}</p>
        </div>
      </div>

      <template v-if="!pendingLogin">
        <label class="auth-field">
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="username" />
        </label>

        <label class="auth-field">
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="current-password" />
        </label>
      </template>

      <template v-else>
        <div v-if="pendingLogin.setupSecret" class="auth-setup-panel">
          <h2>Set up authenticator</h2>
          <p>Add this account in Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.</p>
          <label class="auth-field">
            <span>Setup key</span>
            <input :value="formatSecret(pendingLogin.setupSecret)" readonly />
          </label>
          <a v-if="pendingLogin.setupUri" class="auth-setup-link" :href="pendingLogin.setupUri">Open in authenticator app</a>
        </div>

        <label class="auth-field">
          <span>Authenticator Code</span>
          <input v-model="twoFactorCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" />
        </label>
      </template>

      <p v-if="message" class="auth-error">{{ message }}</p>

      <button type="submit">{{ pendingLogin ? 'Verify & Sign In' : 'Continue' }}</button>
      <button v-if="pendingLogin" class="auth-secondary-button" type="button" @click="resetLogin">Use a different login</button>

      <div class="auth-note">
        <p>Access is restricted to active Cronos users.</p>
        <p>Two-factor authentication is required before the workspace opens.</p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { LockKeyhole } from '@lucide/vue'
import { beginLogin, completeLogin, fetchSession } from '../services/auth'
import type { PendingLogin } from '../services/auth'
import type { UserSession } from '../types'

const session = ref<UserSession | null>(null)
const email = ref('')
const password = ref('')
const twoFactorCode = ref('')
const pendingLogin = ref<PendingLogin | null>(null)
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
  if (pendingLogin.value) {
    await verifyTwoFactor()
  } else {
    startLogin()
  }
}

function startLogin() {
  try {
    pendingLogin.value = beginLogin(email.value, password.value)
    twoFactorCode.value = ''
    message.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Login failed. Check the email, password, and active status.'
  }
}

async function verifyTwoFactor() {
  if (!pendingLogin.value) return
  try {
    session.value = await completeLogin(pendingLogin.value.id, twoFactorCode.value)
    pendingLogin.value = null
    password.value = ''
    twoFactorCode.value = ''
    message.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Authenticator verification failed.'
  }
}

function resetLogin() {
  pendingLogin.value = null
  password.value = ''
  twoFactorCode.value = ''
  message.value = ''
}

function formatSecret(secret: string) {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}
</script>
