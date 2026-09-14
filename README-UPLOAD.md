# Atlas quote persistence fix — one GitHub upload

1. Extract GITHUB-SINGLE-UPLOAD-atlas-quote-persistence-fix.zip.
2. Open [the GitHub upload page](https://github.com/codyh918/cronos-procurement-portal/upload/main).
3. Select all FIVE extracted files and upload them together to the repository root. Commit the upload.
4. Wait for the resulting Railway deployment to become Active.
5. Close older Atlas tabs, then reopen Atlas and refresh with Ctrl+Shift+R.

Upload these files: package.json, package-lock.json, atlas-prepare-release.mjs, atlas-managed-funds-release.json, README-UPLOAD.md. Upload the files themselves, not the ZIP or its enclosing folder.

No SQL changes are needed. This package includes the existing Managed Funds and login storage fixes.

## What this fixes

- Refresh uses the Supabase collection instead of merging old browser quotes, lines, or deleted projects back into it.
- A failed remote read shows a sync error and never uploads the browser cache automatically.
- Quote edits, deletions, and approval changes wait for Supabase confirmation before updating the saved browser copy. Failed deletions keep the quote visible with an error.
- Saves replace changed projects only, preserve unrelated server projects, and reject a stale edit if the same project changed in Supabase. Conditional writes retry concurrent changes without an unconditional overwrite.
- The quote editor refreshes unchanged drafts from Supabase. An unsaved draft stays intact and gets a conflict message if it would overwrite newer server data.
- Managed Funds continues to use its authenticated API and retain its financial history.

If a project changed in another tab, reload Atlas, review the latest copy, and retry the change. This release prevents future stale-cache replay; it does not infer which quotes were intended to be deleted before installation. Delete any such quotes after the deployment is active.

The build helper restores each release file to its required directory and preserves unrecognized later source edits. Keep the helper and release JSON in the repository while using this build command.

## Verification

The 161 existing server regression tests and six new persistence tests passed locally. Nine headless Edge checks passed using the actual quote services and editor against a simulated Supabase endpoint, covering refresh, edits, deletion, write failures, read failures, concurrent writes and stale drafts, with no page errors. Type checking passed for both the workspace and the application entry point in the GitHub snapshot. All 421 GitHub source files were verified against their recorded hashes before overlaying this package. All 40 installed release files matched their SHA-256 checksums. The exact upload passed the production Vite build on Node 20.20.2; the existing large-bundle warning remains. No production quotes were modified during testing.
