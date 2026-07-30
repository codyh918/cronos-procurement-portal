export function loadSewpConfig(env = process.env) {
  return {
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL || '',
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '',
    storageBucket: env.SEWP_STORAGE_BUCKET || 'sewp-rfq-documents',
    maxFileBytes: positiveInteger(env.SEWP_MAX_FILE_BYTES, 25 * 1024 * 1024),
    maxRfqUploadBytes: positiveInteger(env.SEWP_MAX_RFQ_UPLOAD_BYTES, 100 * 1024 * 1024),
    maxFilesPerRfq: positiveInteger(env.SEWP_MAX_FILES_PER_RFQ, 20),
  }
}

export function sewpConfigStatus(config = loadSewpConfig()) {
  return {
    databaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
    storageBucket: config.storageBucket,
    maxFileBytes: config.maxFileBytes,
    maxRfqUploadBytes: config.maxRfqUploadBytes,
    maxFilesPerRfq: config.maxFilesPerRfq,
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}
