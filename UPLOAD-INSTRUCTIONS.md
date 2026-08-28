# MEL Vendor Population Fix

Upload the contents of this folder to the root of the existing Atlas repository, preserving the included paths.

This update prevents MEL imports and RFQ package preparation from guessing vendors through broad manufacturer or product-keyword matching. Imported MEL vendors remain blank unless supplied through an explicit user selection or verified catalog/pricing source.

Verification completed before packaging:

- `npm run type-check`
- `npm run test:server` — 108 tests passed
- `npm run build`

Merge this folder's contents into the repository root; do not upload the outer folder as a nested application directory.
