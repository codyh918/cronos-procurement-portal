<template>
  <section v-if="!isAdmin" class="admin-access-card">
    <h1>Admin access required</h1>
    <p>Only Admin users can add users and manage profiles.</p>
  </section>

  <div v-else class="admin-page">
    <header class="receiving-heading">
      <h1>Admin Settings</h1>
      <p>Manage Cronos logins, roles, and user profiles.</p>
    </header>

    <div v-if="message" class="save-message">{{ message }}</div>

    <section class="summary-grid admin-summary-grid">
      <div class="summary-card">
        <p>Users</p>
        <strong>{{ users.length }}</strong>
      </div>
      <div class="summary-card">
        <p>Active Users</p>
        <strong>{{ activeUserCount }}</strong>
      </div>
      <div class="summary-card">
        <p>Roles</p>
        <strong>{{ appRoles.length }}</strong>
      </div>
    </section>

    <section class="admin-card admin-role-preview">
      <div>
        <h2>Role Preview</h2>
        <p>Switch the interface to see what Procurement Team or Accounting users see.</p>
      </div>
      <label class="admin-field admin-preview-field">
        <span>View App As</span>
        <select :value="previewRole ?? ''" @change="changePreviewRole(inputValue($event) as AppRole | '')">
          <option value="">Admin</option>
          <option v-for="role in previewableRoles" :key="role" :value="role">{{ role }}</option>
        </select>
      </label>
    </section>

    <section class="admin-card">
      <div class="admin-card-heading">
        <h2>Add User</h2>
        <p>Create logins for Admin, Procurement Team, or Accounting users.</p>
      </div>
      <div class="admin-form-grid">
        <label class="admin-field">
          <span>Name</span>
          <input v-model="newUser.name" placeholder="Full name" />
        </label>
        <label class="admin-field">
          <span>Email</span>
          <input v-model="newUser.email" type="email" placeholder="email@cronos..." />
        </label>
        <label class="admin-field">
          <span>Password</span>
          <div class="credential-input-row">
            <input v-model="newUser.password" type="text" placeholder="Temporary password" />
            <button class="secondary-action icon-only-button" type="button" title="Generate password" @click="newUser.password = generatePassword()">
              <KeyRound :size="16" />
            </button>
          </div>
        </label>
        <label class="admin-field">
          <span>Role</span>
          <select v-model="newUser.role">
            <option v-for="role in appRoles" :key="role" :value="role">{{ role }}</option>
          </select>
        </label>
        <label class="admin-field">
          <span>Title</span>
          <input v-model="newUser.title" placeholder="Job title" />
        </label>
        <label class="admin-field">
          <span>Phone</span>
          <input v-model="newUser.phone" type="tel" placeholder="Phone" />
        </label>
      </div>
      <button class="primary-action admin-create-button" type="button" @click="createUser">
        <Plus :size="17" />
        Add User
      </button>
      <div v-if="createdCredentials" class="credential-card">
        <div>
          <h3>Login Created</h3>
          <p>{{ createdCredentials.name }} can sign in with these credentials.</p>
        </div>
        <pre>{{ credentialText }}</pre>
        <button class="secondary-action admin-save-button" type="button" @click="copyCredentials">
          <Copy :size="14" />
          Copy Login
        </button>
      </div>
    </section>

    <div class="data-table-frame">
      <div class="table-scroll">
        <table class="data-table admin-users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Title</th>
              <th>Phone</th>
              <th>Status</th>
              <th>2FA</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="users.length === 0">
              <td colspan="9">&nbsp;</td>
            </tr>
            <tr v-for="user in users" :key="user.id">
              <td>
                <input class="cell-input w-44" :value="user.name" @blur="saveUser(user.id, { name: inputValue($event) })" />
              </td>
              <td>
                <input class="cell-input w-44" :value="user.email" type="email" @blur="saveUser(user.id, { email: inputValue($event) })" />
              </td>
              <td>
                <select class="cell-input w-44" :value="user.role" @change="saveUser(user.id, { role: inputValue($event) as AppRole })">
                  <option v-for="role in appRoles" :key="role" :value="role">{{ role }}</option>
                </select>
              </td>
              <td>
                <input class="cell-input w-44" :value="user.title" @blur="saveUser(user.id, { title: inputValue($event) })" />
              </td>
              <td>
                <input class="cell-input w-44" :value="user.phone" type="tel" @blur="saveUser(user.id, { phone: inputValue($event) })" />
              </td>
              <td>
                <select class="cell-input w-28" :value="user.active ? 'active' : 'inactive'" @change="saveUser(user.id, { active: inputValue($event) === 'active' })">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </td>
              <td>
                <button class="secondary-action admin-save-button" type="button" @click="resetTwoFactor(user.id)">
                  {{ user.twoFactorEnabled ? 'Reset 2FA' : 'Setup Pending' }}
                </button>
              </td>
              <td>
                <input class="cell-input w-44" type="password" placeholder="New password" @blur="savePassword(user.id, inputValue($event), $event)" />
              </td>
              <td>
                <button class="secondary-action admin-save-button" type="button" @click="saveUser(user.id, user)">
                  <Save :size="14" />
                  Save
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Copy, KeyRound, Plus, Save } from '@lucide/vue'
import {
  addUser,
  appRoles,
  fetchSession,
  getRolePreview,
  loadUsers,
  resetUserTwoFactor,
  setRolePreview,
  updateUser,
} from '../services/auth'
import type { AppRole, UserProfile, UserSession } from '../types'

type NewUserForm = Omit<UserProfile, 'id'>

const emptyUser: NewUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'Procurement Team',
  title: '',
  phone: '',
  active: true,
}

const users = ref<UserProfile[]>([])
const session = ref<UserSession | null>(null)
const previewRole = ref<AppRole | null>(null)
const message = ref('')
const createdCredentials = ref<{ name: string; email: string; password: string; role: AppRole } | null>(null)
const newUser = reactive<NewUserForm>({ ...emptyUser })

const isAdmin = computed(() => session.value?.role === 'Admin')
const activeUserCount = computed(() => users.value.filter(user => user.active).length)
const previewableRoles = computed(() => appRoles.filter(role => role !== 'Admin'))
const credentialText = computed(() =>
  createdCredentials.value
    ? `Cronos Procurement App\nURL: ${window.location.origin}\nName: ${createdCredentials.value.name}\nEmail: ${createdCredentials.value.email}\nTemporary password: ${createdCredentials.value.password}\nRole: ${createdCredentials.value.role}`
    : '',
)

onMounted(() => {
  refreshAdminState()
  window.addEventListener('cronos:session-changed', refreshAdminState)
  window.addEventListener('cronos:role-preview-changed', refreshAdminState)
})

onUnmounted(() => {
  window.removeEventListener('cronos:session-changed', refreshAdminState)
  window.removeEventListener('cronos:role-preview-changed', refreshAdminState)
})

function refreshAdminState() {
  session.value = fetchSession()
  previewRole.value = getRolePreview()
  users.value = loadUsers()
}

function changePreviewRole(role: AppRole | '') {
  setRolePreview(role)
  previewRole.value = role || null
}

function createUser() {
  try {
    if (!newUser.name.trim() || !newUser.email.trim() || !String(newUser.password ?? '').trim()) {
      window.alert('Name, email, and password are required.')
      return
    }

    const credentials = {
      name: newUser.name.trim(),
      email: newUser.email.trim().toLowerCase(),
      password: String(newUser.password ?? ''),
      role: newUser.role,
    }
    users.value = addUser({ ...newUser })
    createdCredentials.value = credentials
    message.value = `${credentials.name} added.`
    Object.assign(newUser, emptyUser)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to add user.')
  }
}

function saveUser(userId: string, updates: Partial<UserProfile>) {
  try {
    users.value = updateUser(userId, updates)
    message.value = 'User profile updated.'
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to update user.')
  }
}

function savePassword(userId: string, value: string, event: Event) {
  if (!value) return
  saveUser(userId, { password: value })
  const target = event.target
  if (target instanceof HTMLInputElement) target.value = ''
}

function resetTwoFactor(userId: string) {
  if (!window.confirm('Reset two-factor authentication for this user? They will set up a new authenticator code at their next sign-in.')) return
  users.value = resetUserTwoFactor(userId)
  message.value = 'Two-factor authentication reset.'
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

async function copyCredentials() {
  if (!credentialText.value) return
  try {
    await navigator.clipboard.writeText(credentialText.value)
    message.value = 'Login copied.'
  } catch {
    window.alert('Copy failed. Select the login text and copy it manually.')
  }
}

function inputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : ''
}
</script>
