# Atlas Managed Funds — GitHub upload package

This package updates an existing Atlas repository. It contains 30 changed source, migration, test, and deployment-documentation files; it is not a standalone copy of the application.

## 1. Apply the database migration before uploading

Back up the Supabase database using your normal process. Run the contents of migrations/20260914_create_managed_funds.sql in the Supabase SQL Editor as the database owner, and confirm success before committing the application update. If GitHub commits trigger Railway deployments, this order is required.

Uploading the SQL file to GitHub does not execute it. The migration has not been applied to production as part of preparing this package.

Read docs/MANAGED_FUNDS_DEPLOYMENT.md for permissions, migration review, staging checks, and rollback limitations. The rollback file is included for reference; do not run it during installation.

## 2. Upload the extracted contents to the existing repository root

1. Extract GITHUB-ROOT-UPLOAD-managed-funds.zip.
2. Open the extracted folder containing src, server, migrations, docs, and package.json.
3. On GitHub, open your existing Atlas repository root, then select Add file > Upload files.
4. Drag these four folders and three files together into the upload area:
   - src/
   - server/
   - migrations/
   - docs/
   - server.mjs
   - package.json
   - package-lock.json
5. Confirm paths appear as src/views/ManagedFundsView.vue, server/managed-funds-api.mjs, and migrations/20260914_create_managed_funds.sql. Preserve all nested paths.
6. Commit with a message such as: Replace Checkbook with Managed Funds architecture.

Upload the contents, not the ZIP or its outer folder. The folders contain only changed files; retain other existing repository files. README-UPLOAD.md and MANAGED_FUNDS_MANIFEST.json are package instructions and verification metadata and do not need to be uploaded.

## 3. Deploy and verify

Use the existing deployment process: npm ci, npm run build, and npm start. Ensure the server has SUPABASE_URL (or the existing URL fallback) and SUPABASE_SERVICE_ROLE_KEY, and keep the service-role key server-only. Retain the existing public Vite Supabase settings for browser login.

After deployment, follow docs/MANAGED_FUNDS_DEPLOYMENT.md. An Admin should open migrated projects and reconcile historical cost/billing items in Migration Review. Verify Supabase authentication, private document storage, and financial workflows in staging.

## Package verification

The 30 release files match the SHA-256 hashes in MANAGED_FUNDS_MANIFEST.json and the previously verified local update package. Local validation completed: 153 server tests passed, type checking, production build, and PDF/Excel verification. Production deployment and real Supabase Auth/Storage verification remain pending.

No credentials, environment files, node_modules, build output, or sample invoices are included.
