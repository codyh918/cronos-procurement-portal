const ROLE_PERMISSIONS = {
  admin: ['*'],
  procurement: [
    'atlas.data.view',
    'atlas.data.write',
    'atlas.vendor.create',
    'sewp.rfq.view',
    'sewp.rfq.create',
    'sewp.rfq.edit',
    'sewp.rfq.upload',
    'sewp.rfq.review_ai',
    'sewp.rfq.verify_fields',
    'sewp.rfq.edit_bom',
    'sewp.rfq.review_requirements',
    'sewp.rfq.transition',
    'sewp.rfq.manage_tasks',
    'sewp.rfq.view_audit',
    'atlas.catalog.view',
  ],
  engineering: ['atlas.data.view', 'atlas.catalog.view'],
  sales: ['atlas.data.view', 'atlas.catalog.view'],
}

export async function authenticateSewpRequest(request, authClient) {
  const authorization = request.headers.authorization || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) return { ok: false, status: 401, error: 'A Supabase access token is required.' }
  if (!authClient) return { ok: false, status: 503, error: 'SEWP authentication is not configured.' }

  const { data, error } = await authClient.auth.getUser(match[1])
  if (error || !data?.user) return { ok: false, status: 401, error: 'The access token is invalid or expired.' }
  if (data.user.app_metadata?.active === false) return { ok: false, status: 403, error: 'This Atlas account is inactive.' }

  const role = normalizeRole(data.user.app_metadata?.atlas_role || data.user.user_metadata?.atlas_role || data.user.user_metadata?.role)
  const explicitPermissions = Array.isArray(data.user.app_metadata?.atlas_permissions)
    ? data.user.app_metadata.atlas_permissions.filter(item => typeof item === 'string')
    : []
  const permissions = new Set([...(ROLE_PERMISSIONS[role] || []), ...explicitPermissions])

  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email || '',
      username: String(data.user.user_metadata?.username || ''),
      name: String(data.user.user_metadata?.full_name || data.user.email || ''),
      role,
      permissions,
    },
  }
}

export function requirePermission(authResult, permission) {
  if (!authResult.ok) return authResult
  if (authResult.user.permissions.has('*') || authResult.user.permissions.has(permission)) return authResult
  return { ok: false, status: 403, error: `Permission required: ${permission}` }
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase()
  if (['admin', 'procurement', 'engineering', 'sales'].includes(role)) return role
  return 'procurement'
}
