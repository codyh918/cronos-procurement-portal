# Cody Procurement Leadership Dashboard

Upload this folder's contents into the production GitHub repository root while preserving the included paths.

Included files:

- `src/components/dashboard/ProcurementLeadershipDashboard.vue`
- `src/views/DashboardView.vue`
- `src/services/auth.ts`

No database migration or new environment variable is required.

The new dashboard is selected only when the authenticated session matches Cody Hibbard through the centralized `hasProcurementLeadershipDashboardAccess` helper. All other users continue to render the existing operational dashboard.

After uploading, commit and push the files. Railway should automatically build and deploy the update.
