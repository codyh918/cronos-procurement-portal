GITHUB ROOT UPLOAD - ATLAS USER DELETE FIX

1. Extract this ZIP on your computer.
2. Open this GitHub page:
   https://github.com/codyh918/cronos-procurement-portal/upload/main
3. Drag the THREE ENTIRE FOLDERS named src, server, and migrations onto the
   GitHub upload page. Do not open the folders and select loose files.
4. GitHub's pending-file list must show these exact paths:
   src/views/AdminView.vue
   src/services/authAdminApi.ts
   src/style.css
   server/atlas-auth-api.mjs
   server/tests/atlas-identity.test.mjs
   migrations/20260910_enable_atlas_user_deletion.sql
5. If the pending list shows AdminView.vue, authAdminApi.ts, style.css, or
   atlas-auth-api.mjs without their folders, cancel. Those paths are wrong.
6. Commit directly to main with: Add Atlas user deletion
7. Wait for Railway to finish deploying, then hard-refresh Atlas with
   Ctrl+Shift+R.

The Supabase migration has already succeeded. Do not run it again.
