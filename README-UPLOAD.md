# Atlas XLSX export fix - GitHub upload

1. Open https://github.com/codyh918/cronos-procurement-portal/upload/main.
2. Upload all FIVE files from this folder together at the repository root:
   - package.json
   - package-lock.json
   - atlas-prepare-release.mjs
   - atlas-managed-funds-release.json
   - README-UPLOAD.md
3. Commit with: Fix Excel workbook recovery warnings across Atlas exports.
4. Wait for Railway to finish deploying, then refresh Atlas with Ctrl+Shift+R.
5. Generate a new Customer Financial Report from project 26-087 and open it in Microsoft Excel. Both report sheets should open directly, with frozen rows at A13 and A7.

Upload the five files themselves, not this enclosing folder or ZIP. No SQL migration is needed for this XLSX fix. Existing downloads must be regenerated after deployment.

This cumulative release includes the previous Managed Funds Charge Type and Edit Action changes, customer reports, quote persistence and login storage fixes. Charge Type remains in Edit Action. Every active Atlas XLSX writer uses the corrected shared pane and workbook metadata helpers.

The fix covers row-only, column-only and combined freezes, matching selections and workbook views, and the required creation-date type in core workbook metadata. Values, formulas, report formatting and financial calculations are preserved.

Validation: 20 focused tests passed, including generated XLSX validation for 11 report/export types. All 11 workbooks (25 worksheets) opened normally in Microsoft Excel 16.0 build 20326 with alerts enabled and no repair mode. The full and Nine30-scoped Customer Financial Reports were identical to pre-fix output except pane/workbook views and creation metadata. TypeScript and the production build passed. Verification used local acceptance fixtures; no live project record was changed.

Keep the helper and release JSON while using this build command. The installer preserves unrecognized later edits; review any 'Keeping later source edit' messages in deployment logs. Implementation and repeatable validation commands are in docs/xlsx-export-validation.md after installation.
