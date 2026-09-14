# Managed Funds implementation plan

## Inspection (2026-09-14, before implementation)

- Projects are JSON objects in `app_records` (`projects/all`), cached in localStorage by `remoteRecords.ts` and normalized in `localProjects.ts`. The data foundation SQL covers customers/vendors, not a relational project financial ledger.
- The old Checkbook summary subtracts PO customer values from `checkbookStartingBalance`. It cannot distinguish commitments, incurred costs, or invoices. The original field must remain intact for compatibility and migration evidence.
- Customer quotes live in `Project.quotes`; POs link via `quoteId`. Quote lines already support multiple vendors, RFQ workbook generation and vendor-response import. `generateVendorPurchaseOrders` groups by vendor.
- Tracking uses project PO/line identifiers, `materialShipments`, and `materialTrackingActivity`; `MaterialTrackingPanel` provides shipment/receiving workflows.
- Customer/vendor masters, customer address snapshots, PDF/workbook output, and Supabase bearer-token authentication already exist. No persistent customer invoice entity or invoice issuing workflow was found.
- Existing roles are Admin, Procurement Team, Sales, Engineering. Privileged API calls authenticate with Supabase. Existing project writes are browser-to-Supabase collection saves, which are not sufficient for financial concurrency or authorization.
- Historical activity exists for tracking and document generation, but there is no immutable financial audit ledger.

## Implementation sequence

1. Implement a shared financial command model using integer cents, separate action/procurement/billing states, invoice allocations, append-only financial postings, permissions, and audit entries.
2. Persist through an authenticated API and service-only PostgreSQL compare-and-swap transaction. Store project-scoped state and relational action/transaction/invoice/allocation projections together. Protect enrolled project records from legacy client financial writes.
3. Migrate old projects without deleting any source fields. Back up original records in SQL, normalize type on read, and map quotes/POs to actions on enrollment. Preserve unsupported legacy data and create review issues. Do not infer invoices or incurred costs from POs.
4. Add a dedicated dashboard, searchable/filterable/exportable ledger, action detail workspace, uploads, consolidated/standalone billing, adjustments, modifications, and management overrides. Reuse existing procurement screens with action context and existing material tracking.
5. Test domain commands, persistence/authorization failure paths, migration/retry/concurrency, invoice allocation controls, existing material tracking and quote/PO calculations. Run full server tests, type check, build, and document validation.

## Financial policy

Customer funding commitments reserve approved customer bill amounts (not supplier cost). Completion does not release consumed funding. Cancellation releases only commitments that can safely be released; posted invoices/costs require explicit corrections. Actual costs are recorded from vendor invoices/receipts, never inferred merely from PO issuance. Customer credits reduce net customer invoiced amounts; vendor credits reduce actual cost; commitment corrections are explicit. Draft invoice allocations reserve billable capacity. Original funding is immutable; funding changes are signed transactions. Finance permissions and overrides default to Admin; every override requires a reason.

## Deployment and rollback

Apply the dated Managed Funds SQL migration before deploying the application. The API requires the existing server-side Supabase URL and service-role key; the browser uses a Supabase access token. Financial writes fail closed if persistence is unavailable. SQL source backups and financial history are retained on rollback; the rollback script restores legacy labels only where safe and never drops financial data. Production database execution is separate from local implementation validation.
