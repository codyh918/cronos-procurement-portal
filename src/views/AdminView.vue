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

    <section class="admin-card admin-sync-card td-synnex-card">
      <div class="admin-card-heading">
        <div>
          <p class="integration-eyebrow">Settings / Integrations</p>
          <h2>TD SYNNEX</h2>
          <p>Secure Sandbox authentication and Price &amp; Availability testing.</p>
        </div>
        <span class="integration-status" :class="tdStatusClass">{{ tdStatus?.connectionStatus || 'Not Connected' }}</span>
      </div>

      <div class="integration-detail-grid">
        <div><span>Environment</span><strong>Sandbox</strong></div>
        <div><span>Integration</span><strong>{{ tdStatus?.enabled ? 'Enabled' : 'Disabled' }}</strong></div>
        <div><span>Credentials</span><strong>{{ tdStatus?.configured ? 'Configured' : 'Missing' }}</strong></div>
        <div><span>Token</span><strong>{{ tdStatus?.tokenStatus || 'Not Cached' }}</strong></div>
        <div><span>API base URL</span><strong>{{ tdStatus?.apiBaseUrl || 'https://api-uat.us.tdsynnex.com' }}</strong></div>
        <div><span>Last successful connection</span><strong>{{ formatIntegrationDate(tdStatus?.lastSuccessfulConnection) }}</strong></div>
        <div><span>Last failed connection</span><strong>{{ formatIntegrationDate(tdStatus?.lastFailedConnection) }}</strong></div>
        <div><span>Last pricing lookup</span><strong>{{ formatIntegrationDate(tdStatus?.lastPricingLookup) }}</strong></div>
      </div>

      <button class="secondary-action admin-save-button" type="button" :disabled="testingTdConnection" @click="runTdConnectionTest">
        {{ testingTdConnection ? 'Testing…' : 'Test Connection' }}
      </button>
      <p v-if="tdMessage" class="sync-message" :class="{ success: tdMessageOk }">{{ tdMessage }}</p>

      <div class="integration-lookup">
        <div class="admin-card-heading">
          <h3>Test Product Lookup</h3>
          <p>Search Sandbox Price &amp; Availability by manufacturer part number. This does not update the Atlas catalog.</p>
        </div>
        <label class="admin-field">
          <span>Manufacturer Part Number</span>
          <input v-model="tdPartNumber" autocomplete="off" placeholder="XTM1U-G" @keyup.enter="runTdLookup" />
        </label>
        <button class="primary-action admin-create-button" type="button" :disabled="searchingTd || !tdPartNumber.trim()" @click="runTdLookup">
          {{ searchingTd ? 'Searching…' : 'Search TD SYNNEX' }}
        </button>
        <p v-if="tdLookupMessage" class="sync-message" :class="{ success: tdLookupResults.length > 0 }">{{ tdLookupMessage }}</p>

        <article v-for="result in tdLookupResults" :key="`${result.tdSynnexSku}-${result.manufacturerPartNumber}`" class="integration-result">
          <div class="admin-card-heading">
            <h3>TD SYNNEX Price &amp; Availability</h3>
            <span class="integration-status" :class="{ connected: result.pricingStatus === 'Verified' }">{{ result.pricingStatus }}</span>
          </div>
          <div class="integration-detail-grid">
            <div><span>Manufacturer</span><strong>{{ result.manufacturer || 'Not returned' }}</strong></div>
            <div><span>Part Number</span><strong>{{ result.manufacturerPartNumber || 'Not returned' }}</strong></div>
            <div><span>TD SYNNEX SKU</span><strong>{{ result.tdSynnexSku || 'Not returned' }}</strong></div>
            <div><span>Your Cost</span><strong>{{ result.unitCost === null ? 'Not returned' : formatMoney(result.unitCost) }}</strong></div>
            <div><span>Available</span><strong>{{ result.availableQuantity ?? 'Not returned' }}</strong></div>
            <div><span>Availability</span><strong>{{ result.availabilityStatus || 'Not returned' }}</strong></div>
            <div><span>Source</span><strong>{{ result.source }}</strong></div>
            <div><span>Verified</span><strong>{{ formatIntegrationDate(result.verifiedAt) }}</strong></div>
          </div>
          <p class="integration-description">{{ result.description || 'TD SYNNEX did not return a description.' }}</p>
          <div v-if="result.warehouseAvailability.length" class="warehouse-list">
            <span v-for="warehouse in result.warehouseAvailability" :key="`${result.tdSynnexSku}-${warehouse.warehouseNumber}`">
              Warehouse {{ warehouse.warehouseNumber ?? '—' }}: {{ warehouse.quantity ?? '—' }}<template v-if="warehouse.city"> · {{ warehouse.city }}</template>
            </span>
          </div>
        </article>
      </div>
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
        <p>Create secure Atlas logins for Administrators, Procurement, Engineering, or Sales users.</p>
      </div>
      <div class="admin-form-grid">
        <label class="admin-field">
          <span>Username</span>
          <input v-model="newUser.username" autocomplete="off" placeholder="firstname.lastname" />
        </label>
        <label class="admin-field">
          <span>First Name</span>
          <input v-model="newUser.firstName" autocomplete="off" />
        </label>
        <label class="admin-field">
          <span>Last Name</span>
          <input v-model="newUser.lastName" autocomplete="off" />
        </label>
        <label class="admin-field">
          <span>Email</span>
          <input v-model="newUser.email" type="email" placeholder="email@cronos..." />
        </label>
        <label class="admin-field">
          <span>Password</span>
          <div class="credential-input-row">
            <input v-model="newUser.password" type="password" autocomplete="new-password" placeholder="At least 12 characters" />
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
      <p class="sync-message">Password requires 12+ characters with uppercase, lowercase, number, and special character.</p>
      <button class="primary-action admin-create-button" type="button" :disabled="creatingUser" @click="createUser">
        <Plus :size="17" />
        {{ creatingUser ? 'Creating User…' : 'Add User' }}
      </button>
    </section>

    <div class="data-table-frame">
      <div class="table-scroll">
        <table class="data-table admin-users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Title</th>
              <th>Phone</th>
              <th>Status</th>
              <th>2FA</th>
              <th>Password Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="users.length === 0">
              <td colspan="10">&nbsp;</td>
            </tr>
            <tr v-for="user in users" :key="user.id">
              <td>
                {{ user.name }}
              </td>
              <td>
                {{ user.username || 'Not linked' }}
              </td>
              <td>
                {{ user.email }}
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
                <span>{{ user.twoFactorEnabled ? 'Enabled' : 'Not configured' }}</span>
              </td>
              <td>
                <button class="secondary-action admin-save-button" type="button" @click="sendPasswordReset(user.id)">Send reset</button>
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
import { KeyRound, Plus, Save } from '@lucide/vue'
import {
  appRoles,
  cacheUsers,
  fetchSession,
  getRolePreview,
  loadUsers,
  setRolePreview,
} from '../services/auth'
import { createAtlasUser, initiateAtlasPasswordReset, listAtlasUsers, updateAtlasUser, type CreateAtlasUserInput } from '../services/authAdminApi'
import { getRemoteConfigStatus, listLocalCollectionBackups, restoreLocalCollectionBackup, testRemoteConnection } from '../services/remoteRecords'
import { getTdSynnexStatus, searchTdSynnex, testTdSynnexConnection, type TdSynnexIntegrationStatus, type TdSynnexPriceAvailability } from '../services/tdSynnexApi'
import type { AppRole, UserProfile, UserSession } from '../types'

const emptyUser: CreateAtlasUserInput = {
  username: '',
  firstName: '',
  lastName: '',
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
const newUser = reactive<CreateAtlasUserInput>({ ...emptyUser })
const creatingUser = ref(false)
const remoteStatus = ref(getRemoteConfigStatus())
const syncMessage = ref('')
const syncOk = ref(false)
const projectBackups = ref<ReturnType<typeof listLocalCollectionBackups>>([])
const recoveryMessage = ref('')
const recoveryOk = ref(false)
const tdStatus = ref<TdSynnexIntegrationStatus | null>(null)
const testingTdConnection = ref(false)
const tdMessage = ref('')
const tdMessageOk = ref(false)
const tdPartNumber = ref('')
const searchingTd = ref(false)
const tdLookupMessage = ref('')
const tdLookupResults = ref<TdSynnexPriceAvailability[]>([])

const isAdmin = computed(() => session.value?.role === 'Admin')
const activeUserCount = computed(() => users.value.filter(user => user.active).length)
const previewableRoles = computed(() => appRoles.filter(role => role !== 'Admin'))
const projectBackupCount = computed(() => projectBackups.value.length)
const latestProjectBackup = computed(() => projectBackups.value[0])
const latestProjectBackupRecords = computed(() => latestProjectBackup.value?.records ?? 0)
const tdStatusClass = computed(() => ({ connected: tdStatus.value?.connectionStatus === 'Connected', error: tdStatus.value?.connectionStatus === 'Error' }))
onMounted(() => {
  refreshAdminState()
  void refreshUsersFromServer()
  void refreshTdStatus()
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

async function refreshUsersFromServer() {
  if (!isAdmin.value) return
  try {
    users.value = cacheUsers(await listAtlasUsers())
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to load Atlas users.'
  }
}

function changePreviewRole(role: AppRole | '') {
  setRolePreview(role)
  previewRole.value = role || null
}

async function createUser() {
  if (creatingUser.value) return
  try {
    creatingUser.value = true
    const result = await createAtlasUser({ ...newUser })
    users.value = cacheUsers([result.user, ...users.value.filter(user => user.id !== result.user.id)])
    message.value = result.message
    Object.assign(newUser, emptyUser)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to add user.')
  } finally {
    creatingUser.value = false
  }
}

async function saveUser(userId: string, updates: Partial<UserProfile>) {
  try {
    const updated = await updateAtlasUser(userId, {
      role: updates.role,
      active: updates.active,
      title: updates.title,
      phone: updates.phone,
    })
    users.value = cacheUsers(users.value.map(user => user.id === userId ? updated : user))
    message.value = 'User profile updated.'
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to update user.')
  }
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
}

async function sendPasswordReset(userId: string) {
  try {
    const result = await initiateAtlasPasswordReset(userId)
    message.value = result.message
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to initiate password reset.')
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

async function refreshTdStatus() {
  if (!isAdmin.value) return
  try {
    tdStatus.value = await getTdSynnexStatus()
  } catch (error) {
    tdMessage.value = error instanceof Error ? error.message : 'Unable to load TD SYNNEX integration status.'
  }
}

async function runTdConnectionTest() {
  if (testingTdConnection.value) return
  testingTdConnection.value = true
  tdMessage.value = 'Testing TD SYNNEX Sandbox…'
  tdMessageOk.value = false
  try {
    const result = await testTdSynnexConnection()
    tdStatus.value = result.status
    tdMessage.value = result.message
    tdMessageOk.value = true
  } catch (error) {
    tdMessage.value = error instanceof Error ? error.message : 'TD SYNNEX connection test failed.'
    await refreshTdStatus()
  } finally {
    testingTdConnection.value = false
  }
}

async function runTdLookup() {
  const partNumber = tdPartNumber.value.trim()
  if (!partNumber || searchingTd.value) return
  searchingTd.value = true
  tdLookupResults.value = []
  tdLookupMessage.value = 'Searching TD SYNNEX Sandbox…'
  try {
    const response = await searchTdSynnex(partNumber)
    tdLookupResults.value = response.results
    tdLookupMessage.value = response.results.length ? `${response.results.length} TD SYNNEX result${response.results.length === 1 ? '' : 's'} returned.` : 'Product not found in TD SYNNEX Sandbox.'
    await refreshTdStatus()
  } catch (error) {
    tdLookupMessage.value = error instanceof Error ? error.message : 'TD SYNNEX product lookup failed.'
  } finally {
    searchingTd.value = false
  }
}

function formatIntegrationDate(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
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
