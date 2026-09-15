# Managed Funds Charge Type - GitHub upload

1. Open https://github.com/codyh918/cronos-procurement-portal/upload/main.
2. Upload all FIVE files from this folder together at the repository root:
   - package.json
   - package-lock.json
   - atlas-prepare-release.mjs
   - atlas-managed-funds-release.json
   - README-UPLOAD.md
3. Commit with: Add editable Managed Funds Charge Types.
4. Wait for Railway to finish deploying, then refresh Atlas with Ctrl+Shift+R.
5. Open project 26-087 > MF-002 Nine30 PO > Overview. Select Subcontractor Labor and click Save Charge Type.
6. Refresh and download the Customer Financial Report / Line Item Detail Excel to verify the live correction and unchanged $315,000 amount and project balance.

Upload the five files themselves, not this enclosing folder or the ZIP.
No additional SQL migration is required if Managed Funds is already installed.

This cumulative release includes the preceding Managed Funds, customer report, quote-persistence and login-storage fixes. During npm run build the release helper restores files to their required source paths. Existing financial records remain intact. Charge Type is editable per Action even after POs, invoices, or completion, and changes are recorded in the audit history. Reports and financial summaries use the current saved classification.

The source passed 31 focused tests, browser acceptance checks using a local PostgreSQL fixture, TypeScript checks, and a production build. The supplied Nine30 case was verified locally with unchanged financial postings, PO, invoice, amount and balance. No live project record was changed by preparing this package.

Keep the helper and release JSON in the repository while using this build command. The installer preserves unrecognized later source edits; review any 'Keeping later source edit' messages in deployment logs.
