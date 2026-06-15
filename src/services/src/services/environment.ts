export function getAppBaseUrl() {
  const configuredUrl = String(import.meta.env.VITE_APP_URL ?? '').trim().replace(/\/+$/, '')
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined') return window.location.origin

  return 'http://localhost:5002'
}
