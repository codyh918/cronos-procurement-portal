# Atlas Product Catalog Redesign — Git Upload

This folder contains only the files changed for the August 11, 2026 Product Catalog release. Copy or upload these files into the repository root while preserving the included directory structure.

## Deployment order

1. In the production Supabase SQL Editor, run `migrations/20260811_catalog_database_redesign.sql`.
2. Upload the remaining files to the matching paths in the production GitHub repository.
3. Commit and push the changes so Railway starts a new deployment.
4. Confirm Railway completes `npm run build` and starts the service with `npm run start`.
5. Test Products, Pricing Imports, Needs Verification, Price Changes, and an unchanged catalog reimport.

## Included application files

- `src/views/CatalogView.vue`
- `src/services/productCatalogApi.ts`
- `server/catalog-api.mjs`
- `server/tests/catalog-import.test.mjs`
- `migrations/20260811_catalog_database_redesign.sql`

Do not upload this wrapper directory itself into the repository. Upload its contents so `src`, `server`, and `migrations` merge with the existing repository directories.
