# Atlas quote save and approval fix — September 16, 2026

This update fixes conflicts when teammates save different quotes in the same opportunity and refreshes stale approval statuses when opening an opportunity or returning to its tab.

## Install

1. Extract GITHUB-SINGLE-UPLOAD-atlas-quote-approval-fix.zip.
2. Open https://github.com/codyh918/cronos-procurement-portal/upload/main.
3. Upload all FIVE extracted files together to the repository root and commit the upload. Upload the files themselves, not the ZIP or enclosing folder.
4. Wait for the Railway deployment to become Active.
5. Have everyone close older Atlas tabs and reopen Atlas with Ctrl+Shift+R.

The five files are package.json, package-lock.json, atlas-prepare-release.mjs, atlas-managed-funds-release.json, and README-UPLOAD.md. No new SQL migration is needed for this fix. Existing Managed Funds migrations remain required for Managed Funds.

## Behavior

- Ordinary quote edits, approvals, creation and deletion are applied to the latest opportunity, preserving changes to other quotes, approvals, notes and unrelated purchase orders.
- If the SAME quote changed, was deleted, or a linked purchase order changed before an edit/deletion, Atlas still stops the save. The editor keeps the unsaved draft. Copy needed edits before reloading and reviewing the latest saved quote.
- Conditional Supabase writes retain concurrency protection. New quote numbers are recalculated on a retry to prevent duplicates.
- The opportunity and quote screens reload project data on opening and when focus returns. The opportunity screen now updates when fresh data arrives.
- Approval buttons show a pending state and prevent overlapping approval/save/delete/PDF actions. A failed approval does not become a saved approval in the browser.
- Managed Funds keeps its authenticated API and financial revision checks. An older quote draft cannot adopt a newer cached revision to overwrite current data.

This package includes the previous quote-persistence release. The build helper preserves source edits it does not recognize; review any 'Keeping later source edit' build messages for the modified files if your repository has newer changes.

## Validation

Local server regression tests, type checking, a production build, and browser scenarios using the actual quote services and Vue screens were run. Database/API traffic in browser testing was simulated; production quotes were not changed. The build helper and archive checksums are verified separately.

This update prevents future conflicts and stale displays. It does not reconstruct historical approvals or automatically approve existing quotes. This package has not been deployed by Codex.
