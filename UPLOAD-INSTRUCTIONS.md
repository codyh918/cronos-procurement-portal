# Atlas Material Tracking Git Upload

Upload the contents of this folder to the root of the existing Atlas repository, preserving the included paths.

This package includes the Material Tracking redesign, four customer-facing statuses, explicit delivery confirmation and audit history, Quote/MEL grouping, customer Excel/PDF report updates, and MEL ingestion regression coverage.

Verification completed before packaging:

- `npm run type-check`
- `npm run test:server` — 107 tests passed
- `npm run build`

Do not upload this outer folder as a nested application directory. Merge its contents into the repository root.
