# Atlas checkbook report update

Replace the three files under src/services in the Atlas source repository, then build and deploy using the existing deployment process.

Both XLSX and PDF checkbook exports now show individual ordered items with customer unit and extended prices. Requestor, PO number, and vendor columns are removed. Styling follows the material tracking reports, with navy headings, project metadata, financial summaries, and a landscape detail report. Excel includes filters, frozen headers, and formulas for totals.

Customer pricing comes from the linked quote line, multiplied by the ordered quantity. Supplier costs are never used as customer-price fallbacks. Missing quote links display Price needed, and totals are explicitly provisional. Shipping and contract fees are excluded from these line-item totals. The existing dashboard summary is unchanged.

Validation: TypeScript check and production build passed. Customer markup/margin, ordered quantity, missing prices, empty project, XLSX formulas, and PDF export were checked. Both workbook sheets and the PDF were visually reviewed. Build retains the existing large-chunk warning.

This package does not deploy the live site.
