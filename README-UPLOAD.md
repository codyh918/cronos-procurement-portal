# Atlas project refresh and confirmed-save fix — September 16, 2026

This fixes the Projects list showing an old browser cache while a fresh/incognito session can see newly saved projects. It also closes a gap in the prior upload: all project types and project duplication now wait for Supabase confirmation before completing.

## Install

1. Extract GITHUB-SINGLE-UPLOAD-atlas-project-refresh-fix.zip.
2. Upload all FIVE extracted files together to the root of https://github.com/codyh918/cronos-procurement-portal/upload/main and commit them. Upload the files themselves, not the ZIP or its enclosing folder.
3. Wait for the Railway deployment to become Active.
4. Close older Atlas tabs. Reopen Atlas and press Ctrl+Shift+R once to load the new application.

Files: package.json, package-lock.json, atlas-prepare-release.mjs, atlas-managed-funds-release.json, README-UPLOAD.md. This includes the previous quote/approval fixes. No new SQL migration is required for this update.

## What changes

- Projects reloads from Supabase whenever you enter the page, return focus to its window, or return to its browser tab.
- A Refresh Projects button lets you request the latest list. Refresh failures remain visible and retain the last saved list.
- New Design & Install, Resale, and Managed Funds projects all wait for confirmation before navigating away. Save is disabled while pending, and failures keep the form entries with an inline message.
- A save response that omits the new project is treated as an unconfirmed save, not as success.
- Project duplication also waits for a confirmed save.

If a project appears in incognito, do not recreate it. In the normal window, press Ctrl+Shift+R, choose All on the Projects page, and clear any search/status/type/customer/assigned-user filters. You do not need to clear all browser data to install this fix.

## Verification

The stale-session behavior was reproduced using the previous deployed package and simulated data: the existing session missed a newly saved project while a fresh session saw it. The corrected application passed ten project browser scenarios. Quote regression tests, type checking and an exact-package production build are also checked before delivery. Browser tests use mocked Supabase/API responses; no production projects are created, deleted, or restored by these tests.

The release is based on GitHub commit 63eb8332c3c2aa9203c3619a62890ced1569f560. Its source files match the verified snapshot except for the prior release manifest/readme. The build helper preserves unrecognized later source edits; review any such messages during deployment.

This update has not been deployed by Codex. It changes display refresh and future save behavior; it does not recreate Project 26-162 or alter existing project records.
