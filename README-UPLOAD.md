# Atlas login storage fix — one upload

1. Extract GITHUB-SINGLE-UPLOAD-atlas-login-storage-fix.zip.
2. Open [your GitHub upload page](https://github.com/codyh918/cronos-procurement-portal/upload/main).
3. Upload all FIVE extracted files together to the repository root and commit.
4. Wait for the new Railway deployment to become Active.
5. Refresh Atlas with Ctrl+Shift+R and sign in again.

No SQL changes, password reset, site-data clearing, or folder uploads are required. This package includes the complete corrected Managed Funds release and the login fix.

The upload files are package.json, package-lock.json, atlas-prepare-release.mjs, atlas-managed-funds-release.json, and README-UPLOAD.md. Upload these files, not their enclosing folder or the ZIP.

## What changed

Login tokens, the Atlas session, the signed-in users cache, and the remembered email can be saved even when localStorage is full. Authentication and record access now share one Supabase client and its storage adapter.

On a quota error, the adapter first removes only confirmed server-backed Managed Funds caches and backup copies whose exact contents are still present in the current local collection. It preserves current projects, unique backups, and local drafts. If persistent storage remains full, it uses sessionStorage for the current tab. If browser storage is blocked entirely, it uses memory for the current page. In fallback mode you may need to sign in again after closing the tab; no password is stored by this adapter.

The build helper still restores files to their proper source paths before running Vite. Keep the helper and release JSON in the repository while using this build command. Later edits at canonical source paths are preserved.

## Verification

All 161 local server regression tests passed, including eight tests for this storage fix. A headless Edge test filled localStorage to its actual quota and verified the real Atlas login form, page reload, dashboard, authenticated record request, and logout with mock authentication. The test preserved the unique local project and backup and recorded no page errors. The exact single-upload package passed the production npm build on Node 20.20.2 and type checking for the application's entry point. The pre-existing large-bundle warning and repository-wide errors from misplaced duplicate source files remain outside this fix.
