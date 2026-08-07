Atlas Quote Save / MEL Upload Fix - CORRECT V2

This is for the Vue/Vite Atlas app that serves /assets/index-*.js on Railway.
Do NOT use the earlier Next/React patch folder for the Railway Atlas production app.

Replace these files in the Cronos Procurement App. V2 repository:
- src/views/NewQuoteView.vue
- src/services/localProjects.ts
- src/services/remoteRecords.ts
- src/services/quoteImport.ts

What changed:
- Save Quote / Save Changes now waits for the Supabase remote save.
- Save buttons show Saving... while saving.
- Supabase/config/write errors are shown on the quote page instead of failing silently.
- XLSX imports choose the worksheet with real material rows.
- Total Quantity is recognized as quantity for MEL uploads.
- Blank/MPL/summary rows are ignored before saving.

Validated on local source:
- npm run type-check passed
- npm run build passed

No .env files, dependencies, build output, logs, or secrets are included.
