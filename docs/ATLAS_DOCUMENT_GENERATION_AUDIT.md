# Atlas Document Generation Audit

Date: 2026-07-08

## Scope

This audit covers the current Atlas-generated outputs in the Vue procurement app:

| Document | File | Template / Renderer | Data source | Library | Issues found | Corrective action |
| --- | --- | --- | --- | --- | --- | --- |
| Customer Quote PDF | `src/services/pdfExports.ts` | Cronos letterhead, metadata grid, info boxes, line table, totals | `CustomerQuote`, `Project` | `jspdf` | Field fallback varied by row; missing shipping/part values could be blank or `-`; validation was not centralized | Added shared document audit, quote validation, normalized line values, controlled `N/A`, existing dynamic table heights retained |
| Purchase Order PDF | `src/services/pdfExports.ts` | Cronos letterhead, metadata grid, vendor/ship/bill/POC blocks, line table, total | `PurchaseOrder`, `Project` | `jspdf` | Missing vendor/project/terms/part numbers were not logged consistently | Added PO validation, normalized PO line values, controlled placeholder rendering, audit lifecycle logging |
| Customer Tracking Update PDF | `src/services/pdfExports.ts` | Atlas header/footer, key-value block, tracking line table | `PurchaseOrder`, `Project` | `jspdf` | Shared validation was absent; line item missing-data issues were silent | Added PO validation and audit lifecycle logging |
| Checkbook Financial Report PDF | `src/services/pdfExports.ts` | Atlas header/footer, key-value block, financial table | `Project`, checkbook summary | `jspdf` | Project metadata validation was absent | Added project validation and audit lifecycle logging |
| Customer Consolidated Tracking PDF | `src/services/pdfExports.ts` | Landscape report header/footer, summary cards, tracking table | `Project.purchaseOrders` | `jspdf` | Project metadata validation was absent | Added project validation and audit lifecycle logging |
| Project Tracking Workbook | `src/services/workbookExports.ts` | Summary tab and project detail tab | `Project.purchaseOrders` | `jszip` OpenXML | PO line fields could be blank without audit; part-number failures were silent | Added project and PO line validation, normalized PO line values |
| Checkbook Financial Workbook | `src/services/workbookExports.ts` | Financial summary and PO detail tabs | `Project`, checkbook summary | `jszip` OpenXML | Missing project/customer/PO detail fields were emitted inconsistently | Added project validation and controlled value mapping |
| Customer Quote Workbook | `src/services/workbookExports.ts` | Cronos quote workbook with logo, metadata, line rows, totals | `CustomerQuote`, `Project` | `jszip` OpenXML | Missing customer/contact/part fields could emit blanks; formula rows depended on line placement | Added quote validation, normalized line values, controlled placeholders for data cells |
| Vendor RFQ Workbook | `src/services/workbookExports.ts` | RFQ tab, Summary tab, Instructions tab | `Project`, `QuoteLine[]`, vendor directory | `jszip` OpenXML | Vendor/contact/project fields and part numbers were not audited before export | Added project and quote line validation, normalized line values, controlled metadata placeholders |
| Data Export CSV | `src/services/exportData.ts` | Dataset/count CSV | Browser Blob | Native CSV | No generation audit trail | Added CSV audit lifecycle logging and controlled dataset labels |
| Public Order Print / Save PDF | `src/components/PublicOrderStatus.vue` | Browser print view | `CustomerOrder` | Browser print | Not a file generator; layout depends on browser print styles | Inventory item noted; future work should add print stylesheet validation |

## Root Causes

1. Missing-field handling was scattered across export functions. Some values used `''`, others used `'-'`, and some rows were omitted entirely.
2. Document generation did not have a central audit lifecycle, so missing fields, null values, and rendering warnings were not visible during development.
3. Line item validation was not shared, which allowed part numbers or descriptions to disappear in one output even if another output looked correct.
4. PDF and workbook generators used shared visual primitives in places, but data normalization remained document-specific.
5. Automated validation did not exist, so regressions such as missing validation hooks or untracked output changes could pass type-check/build.

## Corrective Actions

1. Added `src/services/documentGeneration.ts` as the shared document generation layer.
2. Added `DOCUMENT_PLACEHOLDER = "N/A"` and shared `documentValue` helpers.
3. Added quote, PO, project, quote-line, and PO-line validators.
4. Added generation lifecycle logging for all current PDF, workbook, and CSV exports.
5. Normalized quote and PO line values before rendering PDFs and workbook rows.
6. Preserved existing dynamic PDF row-height, page-break, table-header repeat, and no-wrap currency behavior.
7. Added `scripts/validate-documents.mjs` and `npm run validate:documents` to enforce that the main document generators remain wired into validation/audit helpers.

## Layout Audit Summary

Current PDF tables use fixed printable bounds, dynamic text measurement, dynamic row heights, and repeated headers after page breaks. Numeric and currency columns are right-aligned. Description/vendor/customer fields wrap; identifiers and currency are constrained to avoid split values.

Current workbooks define column widths, wrapped description styles, frozen header rows where applicable, currency number formats, and RFQ table filters. The workbook writer preserves intentional layout blanks while requiring data fields to be normalized before output.

## Remaining Manual QA

The automated validation script confirms wiring and audit coverage. It does not render and visually diff real PDFs/XLSX files because the app generates documents in-browser. Manual QA should still generate:

- Quote PDF and quote workbook with long part numbers, long descriptions, shipping address, and customer contact data.
- Purchase Order PDF with edited terms and large currency values.
- Vendor RFQ workbook with several vendors and long descriptions.
- Project Tracking workbook and Customer Tracking PDF with multi-page PO lines.
- Checkbook PDF/XLSX for a checkbook project.

## Files Modified

- `src/services/documentGeneration.ts`
- `src/services/pdfExports.ts`
- `src/services/workbookExports.ts`
- `src/services/exportData.ts`
- `scripts/validate-documents.mjs`
- `package.json`
- `docs/ATLAS_DOCUMENT_GENERATION_AUDIT.md`

## Verification Commands

- `npm run validate:documents`
- `npm run type-check`
- `npm run build`

