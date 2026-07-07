<template>
  <RouterView v-if="session" />

  <div v-else class="auth-gate-page">
    <section class="auth-hero-panel" aria-label="Cronos">
    </section>

    <section class="auth-form-panel">
      <form class="auth-card" @submit.prevent="submit">
        <img class="auth-logo" src="/cronos-logo.jpg" alt="Cronos" />
        <div class="auth-heading">
          <h1>Welcome back</h1>
          <p>Sign in to access your account.</p>
        </div>

        <label class="auth-field">
          <span>Email Address</span>
          <div class="auth-input-shell">
            <Mail :size="20" aria-hidden="true" />
            <input v-model="email" type="email" autocomplete="username" placeholder="name@cronos.com" />
          </div>
        </label>

        <label class="auth-field">
          <span>Password</span>
          <div class="auth-input-shell">
            <LockKeyhole :size="20" aria-hidden="true" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Password"
            />
            <button
              class="auth-icon-button"
              type="button"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" :size="19" aria-hidden="true" />
              <Eye v-else :size="19" aria-hidden="true" />
            </button>
          </div>
        </label>

        <div class="auth-options">
          <label>
            <input v-model="rememberMe" type="checkbox" />
            <span>Remember me</span>
          </label>
          <button type="button" @click="contactAdmins('password')">Forgot Password?</button>
        </div>

        <p v-if="message" class="auth-error">{{ message }}</p>

        <button class="auth-submit-button" type="submit">Sign In</button>

        <div class="auth-divider">
          <span></span>
          <em>or</em>
          <span></span>
        </div>

        <button class="auth-sso-button" type="button" @click="contactAdmins('sso')">
          <ShieldCheck :size="19" aria-hidden="true" />
          Sign in with SSO
        </button>

        <p class="auth-help">
          Need help?
          <button type="button" @click="contactAdmins('help')">Contact Admin</button>
        </p>
      </form>

      <footer class="auth-footer">
        <p>&copy; 2026 Cronos. All rights reserved.</p>
        <nav aria-label="Login footer">
          <a href="mailto:support@cronosllc.com?subject=Cronos%20privacy%20policy%20request">Privacy Policy</a>
          <span>|</span>
          <a href="mailto:support@cronosllc.com?subject=Cronos%20terms%20of%20service%20request">Terms of Service</a>
          <span>|</span>
          <button type="button" @click="contactAdmins('help')">Support</button>
        </nav>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from '@lucide/vue'
import { beginLogin, completeLogin, fetchSession, loadUsers } from '../services/auth'
import type { UserSession } from '../types'

const session = ref<UserSession | null>(null)
const email = ref('')
const password = ref('')
const message = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)

onMounted(() => {
  const rememberedEmail = window.localStorage.getItem('cronos.rememberedEmail')
  if (rememberedEmail) {
    email.value = rememberedEmail
    rememberMe.value = true
  }
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
    if (rememberMe.value) {
      window.localStorage.setItem('cronos.rememberedEmail', email.value.trim())
    } else {
      window.localStorage.removeItem('cronos.rememberedEmail')
    }
    password.value = ''
    message.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Login failed. Check the email, password, and active status.'
  }
}

function contactAdmins(reason: 'help' | 'password' | 'sso') {
  const admins = loadUsers().filter(user => user.active && user.role === 'Admin' && user.email)
  const recipients = admins.map(user => user.email).join(';')

  if (!recipients) {
    message.value = 'No active admin email addresses are configured.'
    return
  }

  const subject =
    reason === 'password'
      ? 'Cronos Atlas password assistance'
      : reason === 'sso'
        ? 'Cronos Atlas SSO access request'
        : 'Cronos Atlas access support'

  const body = [
    'Hello Admin Team,',
    '',
    'I need help accessing the Cronos Atlas procurement app.',
    '',
    `Email entered: ${email.value.trim() || '(not provided)'}`,
    '',
    'Thank you.',
  ].join('\n')

  window.location.href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
</script>

