# Atlas Weekly Procurement Sync — Git Upload

This folder contains the files required for the Procurement Leader Dashboard and Weekly Procurement Sync release.

Upload the **contents** of this folder into the production repository root while preserving the included paths. Do not upload this wrapper directory itself.

## Deployment order

1. In the production Supabase SQL Editor, run `migrations/20260812_create_weekly_procurement_sync.sql`.
2. Upload `src` and `server` into the corresponding repository directories.
3. Commit and push the changes so Railway starts a deployment.
4. Confirm `npm run type-check`, `npm run test:server`, and `npm run build` pass.
5. Sign in as Cody Hibbard and verify that the Procurement Weekly Sync dashboard appears.
6. Sign in as another procurement user and verify that the existing operational dashboard remains unchanged.
7. Test creating a note, action, and discussion flag; refresh the page and confirm they persist.

## Included files

- `src/components/dashboard/ProcurementLeadershipDashboard.vue`
- `src/services/weeklyProcurement.ts`
- `src/services/auth.ts`
- `src/views/DashboardView.vue`
- `migrations/20260812_create_weekly_procurement_sync.sql`
- `server/tests/weekly-procurement.test.mjs`

## Access behavior

Dashboard selection is centralized through `hasProcurementLeadershipDashboardAccess`. Cody's known Atlas email/username identities receive the leader dashboard. Other users continue to receive their existing dashboard.

## Persistence

Apply the migration before deployment for normalized production tables and indexes. The application service also uses Atlas's existing local-first `app_records` synchronization path, which keeps the dashboard usable during temporary remote connectivity failures.

## Verification completed

- TypeScript type-check: passed
- Server tests: 46 passed, 0 failed
- Production Vite build: passed

