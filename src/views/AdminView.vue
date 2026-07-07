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
        <p>Switch the interface to see what Procurement Team users see.</p>
      </div>
      <label class="admin-field admin-preview-field">
        <span>View App As</span>
        <select :value="previewRole ?? ''" @change="changePreviewRole(inputValue($event) as AppRole | '')">
          <option value="">Admin</option>
          <option v-for="role in previewableRoles" :key="role" :value="role">{{ role }}</option>
        </select>
      </label>
    </section>

    <section class="admin-card admin-sync-card">
      <div class="admin-card-heading">
        <h2>Database Sync</h2>
        <p>Test the Supabase connection used for shared team data.</p>
      </div>
      <div class="sync-status-grid">
        <span :class="{ active: remoteStatus.hasUrl }">URL {{ remoteStatus.hasUrl ? 'found' : 'missing' }}</span>
        <span :class="{ active: remoteStatus.hasKey }">Key {{ remoteStatus.hasKey ? 'found' : 'missing' }}</span>
        <span :class="{ active: remoteStatus.ready }">Client {{ remoteStatus.ready ? 'ready' : 'not ready' }}</span>
      </div>
      <button class="secondary-action admin-save-button" type="button" @click="runSyncTest">
        Test Supabase Write
      </button>
      <p v-if="syncMessage" class="sync-message" :class="{ success: syncOk }">{{ syncMessage }}</p>
    </section>

    <section class="admin-card admin-sync-card">
      <div class="admin-card-heading">
        <h2>Project Data Recovery</h2>
        <p>Restore the latest browser backup if shared sync ever replaces projects with an empty record.</p>
      </div>
      <div class="sync-status-grid">
        <span :class="{ active: projectBackupCount > 0 }">Backups {{ projectBackupCount }}</span>
        <span :class="{ active: latestProjectBackupRecords > 0 }">Latest records {{ latestProjectBackupRecords }}</span>
      </div>
      <button class="secondary-action admin-save-button" type="button" :disabled="!latestProjectBackup" @click="restoreLatestProjectBackup">
        Restore Latest Project Backup
      </button>
      <p v-if="recoveryMessage" class="sync-message" :class="{ success: recoveryOk }">{{ recoveryMessage }}</p>
    </section>

    <section class="admin-card">
      <div class="admin-card-heading">
        <h2>Add User</h2>
        <p>Create logins for Admin or Procurement Team users.</p>
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
import { getAppBaseUrl } from '../services/environment'
import { getRemoteConfigStatus, listLocalCollectionBackups, restoreLocalCollectionBackup, testRemoteConnection } from '../services/remoteRecords'
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
const remoteStatus = ref(getRemoteConfigStatus())
const syncMessage = ref('')
const syncOk = ref(false)
const projectBackups = ref<ReturnType<typeof listLocalCollectionBackups>>([])
const recoveryMessage = ref('')
const recoveryOk = ref(false)

const isAdmin = computed(() => session.value?.role === 'Admin')
const activeUserCount = computed(() => users.value.filter(user => user.active).length)
const previewableRoles = computed(() => appRoles.filter(role => role !== 'Admin'))
const projectBackupCount = computed(() => projectBackups.value.length)
const latestProjectBackup = computed(() => projectBackups.value[0])
const latestProjectBackupRecords = computed(() => latestProjectBackup.value?.records ?? 0)
const credentialText = computed(() =>
  createdCredentials.value
    ? `Cronos Procurement App\nURL: ${getAppBaseUrl()}\nName: ${createdCredentials.value.name}\nEmail: ${createdCredentials.value.email}\nTemporary password: ${createdCredentials.value.password}\nRole: ${createdCredentials.value.role}`
    : '',
)

onMounted(() => {
  refreshAdminState()
  window.addEventListener('cronos:session-changed', refreshAdminState)
  window.addEventListener('cronos:role-preview-changed', refreshAdminState)
  window.addEventListener('cronos:users-changed', refreshAdminState)
})

onUnmounted(() => {
  window.removeEventListener('cronos:session-changed', refreshAdminState)
  window.removeEventListener('cronos:role-preview-changed', refreshAdminState)
  window.removeEventListener('cronos:users-changed', refreshAdminState)
})

function refreshAdminState() {
  session.value = fetchSession()
  previewRole.value = getRolePreview()
  users.value = loadUsers()
  remoteStatus.value = getRemoteConfigStatus()
  projectBackups.value = listLocalCollectionBackups('cronos.projects')
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

async function runSyncTest() {
  remoteStatus.value = getRemoteConfigStatus()
  syncMessage.value = 'Testing Supabase...'
  syncOk.value = false
  const result = await testRemoteConnection()
  syncOk.value = result.ok
  syncMessage.value = result.message
}

async function restoreLatestProjectBackup() {
  if (!latestProjectBackup.value) return
  if (!window.confirm(`Restore ${latestProjectBackup.value.records} project records from the latest browser backup? This will replace the current project list and sync it to Supabase.`)) return

  recoveryMessage.value = 'Restoring project backup...'
  recoveryOk.value = false
  try {
    const restored = await restoreLocalCollectionBackup('cronos.projects', latestProjectBackup.value.key, 'projects', 'all', 'cronos:projects-changed')
    recoveryOk.value = true
    recoveryMessage.value = `Restored ${restored.length} project records. Refresh the Quotes page to reload saved quotes.`
    projectBackups.value = listLocalCollectionBackups('cronos.projects')
  } catch (error) {
    recoveryMessage.value = error instanceof Error ? error.message : 'Unable to restore project backup.'
  }
}

function inputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.value : ''
}
</script>
