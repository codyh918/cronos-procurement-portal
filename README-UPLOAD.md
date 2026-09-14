# Atlas Managed Funds — one GitHub upload

1. Extract GITHUB-SINGLE-UPLOAD-managed-funds.zip.
2. Open [your GitHub upload page](https://github.com/codyh918/cronos-procurement-portal/upload/main).
3. Select ALL FIVE extracted files and upload them together at the repository root.
4. Commit with: Install Managed Funds complete release.
5. Let Railway finish the deployment, then open a Managed Funds project.

No folder uploads or individual destination steps are needed. Upload the five files, not the ZIP or outer folder. This replaces the earlier Managed Funds upload packages.

The SQL migration already succeeded. Do not rerun SQL for this upload.

Files to upload together:
- package.json
- package-lock.json
- atlas-prepare-release.mjs
- atlas-managed-funds-release.json
- README-UPLOAD.md

How it works:
Railway already runs npm run build. The build script first restores the 29 packaged source, migration, test, and documentation files into their correct directories, then builds the application. The release includes the corrected server entry and router, the Managed Funds API and UI, and the missing tracking dependency. The two package files complete the 31-file corrected release.

The helper checks every file checksum and destination before writing. It updates missing files and exact previous versions captured from GitHub. It preserves later edits at the correct source paths and never deletes files or connects to the database.

Maintenance:
Keep the helper and release JSON in the repository while using this build command. The restored directories exist in the build output; uploading this package does not directly rearrange GitHub's source tree. To return to a conventional source layout later, run npm run prepare:release in a checkout, commit the restored files, and change the build command back to vite build before removing the helper and release JSON. Edit canonical files such as src/views/ManagedFundsView.vue for later changes; older misplaced files at the repository root are not used by the application.

Verification:
The five root files were overlaid onto GitHub commit 13414668579bfb51f033151a73d5051e92c44ed6, reproducing the exact upload procedure. The helper restored all 29 files, and a repeat build made no further changes. Six installer tests passed on Node 20.20.2, and all 15 Managed Funds tests passed on Node 22.20.0. The exact npm run build command passed on Node 20.20.2. The server started on Node 20.20.2 with no startup errors, returned HTTP 200 for the root and Managed Funds page, and returned HTTP 401 for an unauthenticated Managed Funds API request.

The existing large-bundle warning remains. The GitHub source also contains unrelated misplaced duplicate files that affect repository-wide type checking; the corrected application itself previously passed its application-entry type check. Production success still depends on the Railway deployment completing and the existing Supabase environment configuration.
