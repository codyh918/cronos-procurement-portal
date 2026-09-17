# Atlas project editor correction — September 17, 2026

This app-only update fixes the directory-ID error during project saves and the intermittent Assigned Users list. Keep the Supabase migration you have already installed. No additional SQL is required.

## Install

1. Extract ATLAS-PROJECT-EDITOR-FIX-2026-09-17.zip.
2. Upload all five files inside GITHUB-UPLOAD to the root of the existing repository: https://github.com/codyh918/cronos-procurement-portal/upload/main. Replace the matching filenames and commit them together. Upload the files, not the folder or ZIP.
3. Wait for the Railway deployment to become Active. Preserve any unsaved form text before reloading. Reload Atlas with Ctrl+Shift+R, reopen the project, and make the intended edit.
4. Under Assigned Users, select the current team members and save the project. Wait for database confirmation, then reopen it to verify the changes. The list displays a loading message and a retry option if the request fails.

## Changes

- Frozen legacy customer/address entries with repeated or missing IDs receive stable distinct IDs in the read response. The first original ID remains valid for existing project references. All source entries and fields remain in the frozen database snapshot. A later confirmed edit materializes the affected entry into its versioned table.
- Project synchronization recognizes existing customer and address links before comparing their display text. It no longer creates a second entry using the same linked ID.
- Project linking waits for the customer directory to load. Opening New Project or Edit Project no longer launches unrelated bulk customer writes.
- Assigned Users loads the current active profiles used by Admin, updates when the response arrives, and refreshes after user changes or window focus. Directory refreshes do not reset selected users. Existing assignments stay in the project even when a user is absent from the available list.
- Project details uses the same current directory to display assigned members.
- Database confirmation, revision checks, and draft retention from the previous fix remain enabled.

This package includes the previously reviewed app payload plus the correction. It does not execute a migration, reset a database, recreate project 25-08 or its PO history, or delete duplicate source data. The reviewed-source installer stops if a required file has an unrecognized newer edit.

This correction has not been deployed by Codex. See VALIDATION.md for local checks of the packaged source.
