# Managed Funds release

The project now opens a funding dashboard with five Action Types, independent action/procurement/billing statuses, transactional financial balances, consolidated or standalone customer billing, private supporting documents, financial controls, and Excel/PDF reporting.

## Deployment sequence

1. Back up the Supabase database using the normal operational process. Keep the existing source deployment available.
2. Run `migrations/20260914_create_managed_funds.sql` as the database owner. The migration runs in a transaction and can be rerun. It snapshots complete legacy project objects, maps the project label, creates protected financial tables, installs atomic save functions, and creates the private `atlas-managed-funds` storage bucket.
3. Deploy the updated source with `npm ci`, `npm run build`, and `npm start`. The production server must have the existing `SUPABASE_URL` (or configured URL fallback) and `SUPABASE_SERVICE_ROLE_KEY`. Keep service-role credentials on the server. Browser login needs the existing public Vite Supabase settings.
4. Sign in as an Admin. Open each migrated Managed Funds project. Its first authenticated load maps quotes and their related POs to material Actions; unlinked POs receive individual Actions. Numbering is allocated within a locked project revision. Original project/customer identifiers, shipment records, source documents, unknown fields, and historical data remain intact.
5. Use Migration Review to reconcile uncertain legacy cost and billing records. Review flags do not erase source data or create guessed invoices. Enter verified history as explicit cost/billing/adjustment postings, with supporting references, before closing review items.
6. Create a $1,000,000 test project in a staging environment. Verify customer quote/RFQ/PO output, uploads, consolidated invoicing, and an insufficient-funding attempt with the deployed Supabase Auth/Storage configuration.

No production database or hosted application was changed during local implementation.

## Permissions

Permissions use server-managed Supabase `app_metadata.atlas_role` and optional `app_metadata.atlas_permissions`. User-editable metadata cannot grant financial permissions. Explicit grants use `atlas.managed_funds.<permission>` and should be assigned through the existing authorized user-administration process.

| Capability | Admin | Procurement | Sales | Engineering |
|---|---|---|---|---|
| View | Yes | Yes | Yes | Yes |
| Create / edit Actions and upload documents | Yes | Yes | Yes | No |
| Approve Actions / commitments | Yes | Explicit grant | Explicit grant | No |
| Issue/change POs and update tracking | Yes | Yes | No | No |
| Record expenses | Yes | Yes | No | No |
| Draft/issue invoices and record payments | Yes | Yes | Yes | No |
| Funding modifications / adjustments / overrides | Yes | Explicit grant | Explicit grant | No |
| Cancel an eligible Action | Yes | Yes | No | No |

Permission names: `view`, `create`, `edit`, `approve`, `issue_po`, `expense`, `invoice`, `funding`, `adjust`, `override`, `cancel`. Overrides always require an explanation recorded in the audit log. A project cannot switch away from Managed Funds or be deleted through the old project workflow. Posted history cannot be deleted. Actions with POs or financial activity must be reconciled and completed rather than cancelled away.

## Accounting behavior

- All ledger money is integer USD cents. Dashboard values are sums of transactions, not editable balances.
- Original funding is immutable. Modifications are signed transactions and have unique posting references.
- Commitments reserve approved funding against an Action; completion does not release consumed funding. PO costs and incurred costs must fit within the approved commitment. Increase authorization/commitment first when additional funding is needed.
- Quote approvals and PO generation use the existing modules and require sufficient Action commitments. Actual cost is posted from vendor receipts/invoices; merely issuing a PO does not establish incurred cost.
- Customer bill amount is the total agreed sale for an Action. Expense-entry bill amounts identify the portion of that sale; they do not automatically issue an invoice or add to the agreed sale.
- Draft invoices reserve allocation capacity. Issuing posts customer invoicing exactly once. One invoice can allocate amounts across multiple Actions; one Action can have partial invoices. Voiding a draft releases its reservation while retaining the draft record. Issued invoices require credits/corrections.
- Customer credits reduce net invoicing and agreed bill amount, so a credit is not silently made billable again. Vendor credits reduce incurred cost. Commitment corrections and payment reversals are explicit adjustments. For a credit against a paid invoice, record the payment reversal/refund before posting the credit.
- Invoice PDFs preserve customer identity/address captured when the draft was created. They show original invoice total, credits, payments, and current amount due. Draft and void PDFs are clearly identified. Documents identify both project and Action.
- Financial audit entries record actor, timestamp, affected record, previous/new values, and explanation. Quote/PO edits retain their previous document values in the audit history. Uploaded documents are private, with short-lived authenticated download links.
- Action-level reports show credits both on the affected Action and on the adjustment Action for traceability. Project totals count each underlying transaction once; do not sum Action rows to reconstruct financial history. Use the Transactions sheet or project summary.

## Persistence and rollback

The authoritative project-scoped ledger lives in `atlas_managed_funds`. Its Actions, transactions, invoices, allocations, document links, documents, and audit events are projected into relational tables in the same PostgreSQL transaction as the project update. Browser cache is not authoritative. A stale revision produces a conflict and requires refresh; failed financial writes never become accepted offline postings.

The old `projects/all` collection remains the source for procurement documents. A database trigger prevents legacy browser clients from changing or deleting Managed Funds objects. Standard project saves merge only standard projects and preserve the current Managed Funds records, preventing stale collection writes from erasing financial work.

`migrations/20260914_managed_funds_rollback.sql` restores labels only for legacy projects that have not been enrolled. It retains all backups, ledgers, invoices, and documents. Projects already using the ledger must remain on the new module until an administrator completes a reconciliation/export plan. Do not drop financial tables or re-enable old collection edits as a rollback shortcut.

## Local validation

- `npm run type-check`
- `npm run build`
- `npm run test:server`
- `npm run validate:documents`

The Managed Funds tests cover all requested business scenarios through the command model and existing procurement/tracking functions, plus API permission enforcement, binary upload metadata, idempotent retries, duplicate billing, over-commitments, and simultaneous saves. The PostgreSQL test executes the actual migration in an isolated PGlite runtime and checks grants, atomic saves, relational allocation persistence, append-only protection, stale revisions, rerun safety, and rollback behavior.

Browser QA uses `tmp/managed-funds-preview` with sample data and an in-memory repository. It is isolated from production, has no production credentials, and is not part of the production server. Generated sample exports under `outputs/managed-funds` are QA evidence, not customer invoices. Real Supabase Auth/Storage and deployment verification remain staging checks.
