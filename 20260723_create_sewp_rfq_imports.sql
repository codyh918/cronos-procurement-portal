# RFQ Email Import deployment

This bundle contains the deterministic Phase 1 SEWP RFQ email importer.

## Deploy

1. Copy the bundle contents into the root of the connected GitHub repository, preserving directories.
2. Commit and push the changes.
3. Apply `migrations/20260723_create_sewp_rfq_imports.sql` to the Supabase project after the existing `20260722_create_sewp_rfq_foundation.sql` migration.
4. Confirm Railway has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
5. Confirm the frontend build has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Redeploy Railway.
7. Test `/sewp-rfqs/import` using an authenticated Supabase user with SEWP permissions.

Do not upload the sample Outlook message, extracted attachments, `.env`, service-role keys, logs, `node_modules`, or local build output to GitHub.
