# Managed Funds customer reports - one GitHub upload

1. Extract GITHUB-SINGLE-UPLOAD-managed-funds-customer-reports.zip.
2. Open [your GitHub upload page](https://github.com/codyh918/cronos-procurement-portal/upload/main).
3. Upload all FIVE extracted files together to the repository root and commit.
4. Wait for the Railway deployment to become Active, then refresh Atlas with Ctrl+Shift+R.
5. Open a Managed Funds opportunity and choose Customer Reports. Select Financial PDF or Financial Excel. Open an individual Action's Customer Reports tab for an Action-only report.

Upload package.json, package-lock.json, atlas-prepare-release.mjs, atlas-managed-funds-release.json and README-UPLOAD.md. Upload the files themselves, not their enclosing folder or the ZIP.

No SQL changes are needed. This release includes the preceding quote-persistence, Managed Funds and login-storage fixes.

## Included

- Customer financial reports in PDF and Excel: Action/quote reference, manufacturer, part, description, quantity, customer unit price and line amount.
- Funding balances and Action-level commitments, bill amounts, net invoiced, paid and outstanding balances.
- Shipping, contract fees, direct expense charges, and clearly labeled unitemized amounts to reconcile detail to the current Action bill amount.
- Customer pricing only. Vendor costs, margins and internal notes are excluded.
- Material tracking PDF and Excel downloads beside the financial reports.
- Each download reloads the latest saved data; an unavailable server stops the export.

Invoices and payments are recorded by Action, so they are not allocated to individual material lines. Unapproved quotes are excluded from line pricing. A missing customer price is shown explicitly. Funding totals cover the whole opportunity even when the line report is scoped to one Action.

## Verification

All 177 server regression tests passed, including ten tests for the new customer reports. Browser checks passed for both report formats, fresh server data, Action scope, exclusion of internal costs, and failed-read handling. Sample PDF pages were rendered for layout review and checked for complete long descriptions. The package was installed over the verified GitHub source at commit fad14af37036e5de6db6f6257ae7c22cc6021d99. Type checking passed for the workspace and GitHub application entry point, and the production Vite build passed on Node 20.20.2. The existing large-bundle warning remains. Testing used sample data and did not change production records.

Keep the release helper and JSON in the repository while using this build command. The helper restores files to their required paths and preserves unrecognized later source edits.
