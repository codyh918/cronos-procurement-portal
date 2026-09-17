# Atlas confirmed-save fix — September 17, 2026

This package extends and supersedes ATLAS-APPROVAL-FIX-2026-09-16.zip. It uses the existing Railway app and Supabase database. It has not been deployed. Both the database migration and the app upload are required.

A successful Save means the database confirmed the write. Failed saves report an error and retain form input. An outdated browser cannot replace the full project list or silently overwrite a newer directory/collection revision.

## Install

1. Extract **ATLAS-CONFIRMED-SAVES-FIX-2026-09-17.zip**. Use a short maintenance window; finish pending work and close old Atlas tabs.
2. Run the entire **1-SUPABASE-MIGRATION.sql** in the existing production Supabase project's SQL Editor. It runs as one transaction. If it fails, do not deploy; retain the error for correction. It initializes the directory schema if it is wholly absent, preserves existing records, installs versioned project saves, freezes the legacy project snapshot, and guards the other business collections. Existing Managed Funds tables must already be installed; this package does not reset their ledgers.
3. Upload the **five files inside 2-GITHUB-UPLOAD** to the root of the existing repository at https://github.com/codyh918/cronos-procurement-portal/upload/main, replacing those filenames together. Upload the files, not the folder or ZIP. Commit them together. The build helper installs the reviewed source payload and stops if it finds incompatible newer edits.
4. Wait for the Railway deployment to become **Active**. Reload Atlas with **Ctrl+Shift+R**. Every user must reload old tabs. Old builds will be unable to save protected records after the migration.
5. Run **3-VERIFY.sql**, which is read-only. Confirm both save functions, the collection guard, and the project table exist. Compare project counts with the pre-cutover legacy count, allowing for deliberate creations/deletions after installation.
6. In Atlas, make an intended small edit to a project and a PO. Wait for **Saved to database**, reload, and confirm the values in a second tab. Verify an intended weekly note in the same way. Do not repeat financial actions merely as a test.

## Coverage

- Projects: creation, editing, archiving, deletion, quotes, approval, PO generation, PO/header/line/tracking edits and imports use confirmed project writes. Stable new-project draft IDs help prevent duplicate retries. Old collection replacement is blocked; deletes retain tombstones.
- Customer orders and tracking-token changes await database confirmation. Per-record comparison preserves unrelated remote orders. Opening Customer Orders retries synchronization of derived copies from approved projects; failures are reported separately from the saved project.
- Customers and addresses read the same normalized tables they write. Older database directory records remain visible as a frozen fallback until edited into the normalized tables. Directory changes run in one database transaction with version checks and audit history.
- Vendor edits and imports await the directory API. Existing vendor creation already awaited its API. Failed import/edit forms retain their input.
- Weekly actions, notes, flags, overrides and meeting snapshots await a guarded database save. The note/action form clears only after confirmation. Procurement task edits and vendor import logs are saved in Supabase.
- Save status is visible on the updated screens. Navigation waits for pending saves; PO PDF exports wait for edits and then use the confirmed PO. Browser cache failures cannot turn a confirmed database save into a local-only success. Price lookup can derive current prices from confirmed purchase orders after reopening.
- Managed Funds, CIMS, SEWP and account administration retain their existing authenticated database APIs. User profiles returned by those APIs are cached without issuing another blind browser write. Display preferences and generated dashboard suggestions remain local caches.

## Data preservation and limitations

This prevents the identified save/overwrite failures; it does not recover project **25-08**, prove why it disappeared, or recreate a previously sent PO. There is no automatic restoration or reapproval of missing work.

The frozen legacy projects row is a cutover snapshot, not the current project store. Do not reinstall old writer functions, roll back to the old app, or copy the frozen collection over current rows. A deployment failure should be corrected while keeping the matching migration and records in place.

The project is the authoritative saved record for its quotes and POs. Customer tracking copies are derived and may report a separate synchronization error; the primary project remains committed. Directory creation while saving a project can commit before a later project-save failure; Atlas does not claim the project was saved in that case.

Database confirmation is different from disaster-recovery backups. This package does not purchase a plan or enable provider backups. The existing provider plan's backup limits remain unchanged.

See **VALIDATION.md** for the checks performed against the packaged source.
