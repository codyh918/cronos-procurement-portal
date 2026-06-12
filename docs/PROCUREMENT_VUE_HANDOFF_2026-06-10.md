# Cronos Procurement Vue Handoff - June 10, 2026

## Copy/Paste Prompt For Next Teammate

You are taking over the Cronos Execution Platform procurement migration. The active repo is a Vue/Vite monorepo at `cronos-execution-platform`. The procurement app has been ported from the previous Next/React procurement baseline into `procurement/` as a Vue 3 + TypeScript app. The local running URL used during review was `http://127.0.0.1:5003`.

Please continue from the current working tree, not from the old committed procurement JS files. Many procurement files are currently untracked because this is an active migration snapshot. Do not restore deleted legacy files unless intentionally rolling back the Vue port.

Your first priorities:

1. Review the current `git status` and preserve the Vue/TypeScript procurement migration files.
2. Run `npm run type-check --workspace=cronos-procurement`.
3. Run `npm run build --workspace=cronos-procurement`.
4. Browser-test the app at `http://127.0.0.1:5003` or start the procurement dev server with `npm run dev --workspace=cronos-procurement` if needed.
5. Continue final parity and hardening work: export visual QA, auth hardening, targeted tests, dependency audit cleanup, and dead-code cleanup.

Key context: core procurement functionality is back in Vue. The last work completed was pixel/parity and workflow verification across dense project, quote, PO, customer order, receiving, export, and role dashboards. The remaining work is release polish, test coverage, production hardening, and cleanup.

## What Was Done

### Vue Procurement Port

- Rebuilt the procurement app as Vue 3 + TypeScript.
- Added Vue entry/config files:
  - `procurement/src/main.ts`
  - `procurement/src/router/index.ts`
  - `procurement/tsconfig.json`
  - `procurement/vite.config.ts`
- Replaced the old small JS procurement shell with a full Vue workflow app.
- Deleted/migrated old legacy procurement files:
  - `procurement/src/main.js`
  - `procurement/src/router/index.js`
  - `procurement/src/views/HomeView.vue`
  - `procurement/src/views/ProjectMaterialsView.vue`
  - `procurement/vite.config.js`

### Major Procurement Views Now Present

- Dashboard
- Projects
- New/Edit Project
- Project Detail
- Quotes
- New/Edit Quote
- Purchase Orders
- Purchase Order Detail
- Customer Orders
- Customer Order Detail
- Customer Order Items
- Customer Tracking Link admin view
- Public order lookup
- Public token tracking page
- Catalog
- Vendors
- Customers
- Receiving
- Kitting
- Shipping
- Admin

### Services And Data Work

- Added local project persistence and migration-friendly data services.
- Added customer order tracking services.
- Added vendor directory and vendor RFQ response services.
- Added quote import services.
- Added workbook/PDF export services.
- Added receiving/inventory logic.
- Added part catalog seed data.
- Added tracking data for project/checkbook style imports.
- Added role/session handling for local demo auth.

### Pixel/Parity Work Completed

Compared the Vue app against the previous Next/React procurement baseline from:

`/Users/mills/Downloads/OneDrive_2026-06-09.zip`

The archive did not include the full Next static CSS/chunk files required for true screenshot-to-screenshot old-app rendering, so parity was checked using the old source/class structure, generated route shells, and live Vue screenshots.

Fixed layout issues in `procurement/src/style.css`:

- Constrained table-heavy views so dense tables scroll inside cards instead of widening the full page.
- Fixed vendor directory overflow.
- Fixed dashboard table overflow on mobile.
- Fixed quote edit page overflow.
- Fixed PO detail desktop/mobile overflow.
- Fixed mobile admin dashboard layout so role dashboard sections stack instead of using the desktop side rail.

### Workflow/Export Verification Completed

Using seeded Playwright data, the following were verified:

- Quote PDF export
- Vendor RFQ workbook export, including multiple vendor XLSX files
- Project tracking XLSX export
- Customer tracking PDF export
- PO PDF export
- PO customer update PDF export
- Procurement dashboard CSV export
- Public customer tracking link route
- Receiving workflow:
  - Selected pending PO line
  - Received quantity
  - Inventory item created
  - PO line quantity/status updated
- Role dashboards:
  - Admin
  - Procurement Team
  - Accounting

Generated verification artifacts were placed in:

`/tmp/procurement-export-parity`

XLSX files passed `unzip -t`; PDFs had valid `%PDF-1.3` headers.

## Verification Commands Already Run

These commands passed:

```bash
npm run type-check --workspace=cronos-procurement
npm run build --workspace=cronos-procurement
npm run type-check
npm test
npm run build:all
npm run lint
```

Known warning:

- Vite still reports large chunk warnings because PDF/Excel tooling is bundled into large chunks. This is not a functional failure, but should be optimized later.

Known audit issue:

- `npm audit --omit=dev --audit-level=moderate` fails on `uuid <11.1.1` via `exceljs`.
- Root `package.json` has an override, but the current lockfile still resolves `uuid@8.3.2`.
- Do not blindly run `npm audit fix --force` without checking regression risk because it may downgrade `exceljs`.

## What Still Needs To Be Done

### Highest Priority

1. Add targeted procurement tests.
   - Auth/session behavior
   - Project create/edit/delete
   - Quote create/edit/approval
   - Purchase order generation
   - PO line tracking edits
   - Receiving quantity validation
   - Customer order public lookup/token route
   - Export smoke tests for PDF/XLSX/CSV

2. Harden auth before production.
   - Current procurement auth is local/demo-grade.
   - Seeded admin credentials and plaintext localStorage user records are not production-safe.
   - Move real auth/session enforcement server-side before hosted rollout.

3. Fix dependency audit.
   - Resolve the `exceljs` -> `uuid` advisory in a controlled way.
   - Verify workbook exports after dependency changes.

4. Final visual QA on generated files.
   - Open actual exported PDFs and XLSX files visually.
   - Confirm customer-facing wording, page breaks, column widths, and file names.

### Medium Priority

1. Bundle optimization.
   - Lazy-load PDF/XLSX tooling.
   - Consider dynamic imports around export buttons.
   - Consider manual chunks for `jspdf`, `pdfjs`, `html2canvas`, `jszip`, and related tooling.

2. Dead-code cleanup.
   - `procurement/src/views/PlaceholderView.vue` appears unreferenced.
   - `procurement/src/components/AppHeader.vue` appears unreferenced.
   - `dashboard/src/views/HomeView.vue` has unused `updateSelected`.

3. Clean commit preparation.
   - Review all untracked procurement files.
   - Ensure deleted legacy files are intentional.
   - Commit migration as a coherent change set.

4. Broader app coverage.
   - Smaller satellite apps still have weaker tests and fewer type-check guarantees than `av-cxp-vue`, `rom-tool`, and `platform-contracts`.

### Lower Priority

1. Refactor oversized Vue files over time.
2. Move localStorage services behind repository interfaces.
3. Add richer empty/error states for import failures.
4. Add browser-level regression screenshots for key procurement routes.

## Current Git State Notes

The working tree is not clean. This is expected for the handoff.

Important active areas:

- `procurement/` contains the Vue/TypeScript procurement migration.
- `dashboard/` has related project tracker updates.
- Root `package-lock.json` changed.
- `docs/PROJECT_TRACKER_DATAVERSE_REVIEW.md` exists as an untracked doc from prior work.

Before committing, run:

```bash
git status --short
npm run type-check --workspace=cronos-procurement
npm run build --workspace=cronos-procurement
```

## Suggested Next Work Session

1. Open the app at `http://127.0.0.1:5003/projects`.
2. Create or seed one project with:
   - Approved quote
   - At least two vendors
   - At least two POs
   - One received/partial line
   - One missing tracking line
   - One customer order tracking link
3. Click through:
   - Project detail
   - Quote edit
   - PO detail
   - Customer order detail/items/tracking link
   - Public tracking page
   - Receiving
   - Role preview selector
4. Run exports and visually inspect generated PDFs/XLSX files.
5. Add tests around any workflow that feels risky before merging.

