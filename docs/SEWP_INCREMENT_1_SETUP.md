# SEWP Increment 1 Setup

Increment 1 establishes the database and authenticated server boundary. It does not yet expose the SEWP portal UI or document upload endpoints.

## Apply the migration

Apply `migrations/20260722_create_sewp_rfq_foundation.sql` through the normal Supabase migration workflow. Review it in a non-production Supabase project first.

The migration creates:

- RFQ, contacts, documents, amendments, assignments, tasks, notifications, saved views, stage history, and audit tables.
- Extraction runs, extracted fields, requirements, BOM lines, citations, corrections, AI summaries, and execution logs.
- Permission records and per-user permission grants.
- Optimistic-lock stage-transition and opportunity-number functions.
- A private `sewp-rfq-documents` Storage bucket with a 25 MB per-file limit.
- Read-only permission-aware RLS policies. Mutations are intentionally server-mediated.

## Configure Supabase Auth

1. Create/migrate Atlas users in Supabase Auth.
2. Set `app_metadata.atlas_role` to `admin` or `procurement`.
3. Optionally set `app_metadata.atlas_permissions` to an array of explicit permission keys.
4. Existing Atlas profiles remain available for display and assignments, but SEWP API authorization uses the verified Supabase user ID and access token.

## Railway server variables

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SERVICE_ROLE_KEY
SEWP_STORAGE_BUCKET=sewp-rfq-documents
SEWP_MAX_FILE_BYTES=26214400
SEWP_MAX_RFQ_UPLOAD_BYTES=104857600
SEWP_MAX_FILES_PER_RFQ=20
```

Keep the existing browser variables for Supabase Auth:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable.

## Health check

After deployment:

```text
GET /api/sewp-rfqs/health
```

The response reports configuration status and the mandatory non-CUI warning. It never exposes credentials.

## Tests

```bash
npm run test:server
npm run type-check
npm run build
```

## Current limitations

- The migration has been authored but cannot be applied or integration-tested without access to the target Supabase project.
- Existing users must exist in Supabase Auth before they can call SEWP APIs.
- File upload and extraction endpoints begin in Increment 2/4 and are not enabled by this foundation.
- Malware scanning is not configured.
- The deployment is not approved for CUI.
