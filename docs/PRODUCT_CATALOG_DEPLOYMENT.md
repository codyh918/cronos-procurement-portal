# Atlas Product Catalog deployment

## Database deployment

Apply these migrations in order in the Supabase SQL Editor:

1. `migrations/20260731_create_product_catalog.sql`
2. `migrations/20260731_seed_product_catalog.sql`

The first migration creates normalized product, pricing-history, import-batch, and catalog-audit tables; indexed full-text and trigram search; row-level security; and Engineering/Sales role support.

The seed migration imports 533 unique products from `Sponsor_FY_MEL_Template_CH_7.30.2026_Costs_Removed.xlsx`. It records 9 duplicate source rows, 102 incomplete rows, and 242 category/blank/non-product rows in the import summary. Project-specific quantity, destination, funding, contract, order, and tracking fields are not imported.

## Application deployment

Deploy the updated application after both migrations succeed. No new Railway variables are required beyond the existing Supabase configuration.

Administrators can upload `.xlsx` or `.csv` files from Product Catalog. Imports use case-insensitive Manufacturer + Part Number keys. Existing products are updated, new products are inserted, and every price change is appended to pricing history.

## Verification

1. Sign in as an administrator and open Product Catalog.
2. Confirm the catalog reports 533 initial products.
3. Search for `Samsung 40 display`, `Cisco codec`, `Crestron NVX`, `55 inch`, and `Core 110f`.
4. Open a product and verify current cost, source file, pricing history, and related products.
5. Create a quote and type a catalog part number; verify manufacturer, description, cost, supplier, supplier part number, and lead time suggestions.
6. Re-import the source workbook and confirm products are updated rather than duplicated.
7. Review the import summary and pricing-change report data.
