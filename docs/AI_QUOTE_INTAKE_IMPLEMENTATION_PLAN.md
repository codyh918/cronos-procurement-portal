# AI Quote Intake Agent: Repository Assessment and Implementation Plan

Date: 2026-07-21

## Scope of this document

This is the Stage 1 repository assessment and implementation plan. No Quote Intake production code is included in this stage. The proposed work extends the existing Atlas application rather than creating a separate application.

## 1. Current frontend architecture

- Vue 3 single-page application using TypeScript and Vite.
- Vue Router provides authenticated application routes under `AppShell`.
- The UI is organized into `src/views`, `src/components`, `src/services`, `src/router`, and shared types in `src/types.ts`.
- Styling is primarily in `src/style.css`, with additional scoped style modules under `src/styles`.
- Navigation and role visibility are defined in `src/roles.ts`; route enforcement is in `src/router/index.ts`.
- State is service-oriented rather than Pinia-oriented: most business records are read from browser local storage and asynchronously synchronized to Supabase.
- Both Admin and Procurement Team roles can access core project, quote, PO, vendor, and catalog workflows. Admin-only routes currently cover user, role, settings, and audit screens.

## 2. Current backend and API architecture

- `server.mjs` is a small Node HTTP server. It serves the Vite `dist` directory with SPA fallback.
- It exposes a handful of in-memory `/api/cims/*` endpoints for CIMS health, barcode scans, label jobs, and integration events.
- It does not provide general Atlas CRUD APIs, multipart uploads, durable jobs, server-side authentication, or OpenAI integration.
- JSON request bodies are limited to approximately 1 MB, but there is no general middleware, router framework, or multipart parser.
- Most Atlas data access occurs directly from the browser through `@supabase/supabase-js`.

Implication: Quote Intake requires expanding the existing Node server into a secure API layer. OpenAI keys, privileged database writes, upload validation, approval transactions, and document processing must not run in Vite/browser code.

## 3. Current database and data model

### Primary Atlas persistence

- PostgreSQL through Supabase.
- Shared Atlas records are stored in one generic `public.app_records` table with `record_type`, `record_key`, and a JSONB `data` payload.
- Projects contain nested quotes, quote lines, purchase orders, and inventory in project JSON documents.
- Customers and customer addresses use separate logical record types but remain JSON payloads in `app_records`.
- Vendor directory and part catalog data are primarily browser-local; not all of this data is normalized in PostgreSQL.
- Authentication is application-managed. User records, including password material, are synchronized through `app_records`; Supabase Auth is not currently used.

### Existing application entities

- Project: nested `Project` object in `projects/all`.
- Quote: nested `CustomerQuote` within a project.
- Quote lines: nested `QuoteLine[]` within a quote and project.
- Customer: `customers/all` JSON collection.
- Customer addresses: `customer_addresses/all` JSON collection.
- Vendors: browser-local vendor directory and vendor service data; no normalized Atlas vendor table was found.
- Products/catalog: browser-local part catalog seeded from `src/data/part-catalog-seed.json`; no normalized Atlas product table was found.
- Documents: generated PDFs/XLSX files are created client-side. No durable Atlas document table or storage workflow was found.

### Existing SQL migration

- `migrations/20260706_create_cims_schema.sql` defines normalized CIMS tables, including synchronized projects/vendors/POs, attachments, audit logs, and integration logs.
- These tables are documented as CIMS-specific and are not the current Atlas quote/project persistence model.
- The CIMS `attachments` table stores metadata and a storage URL but no active upload implementation was found in Atlas.

Implication: Quote Intake should use new normalized PostgreSQL tables and Supabase Storage, while approval should invoke a controlled adapter that updates the existing Atlas project JSON model transactionally. It should not store the workflow solely in `app_records` or browser state.

## 4. Current file-upload functionality

- `NewQuoteView.vue` contains browser file inputs for material-list and vendor-pricing imports.
- `src/services/quoteImport.ts` parses CSV, TXT, XLSX, some legacy XLS representations, and selectable-text PDF files entirely in the browser.
- XLSX parsing reads the first worksheet from ZIP/XML internals. It does not currently preserve all worksheets, merged cells, cell provenance, or formulas.
- Legacy binary XLS support is incomplete and advises users to resave unsupported files.
- PDF parsing uses `pdfjs-dist` text extraction; there is no OCR path for scanned PDFs.
- DOCX is not supported.
- Imported files are not durably stored, checksummed, quarantined, or represented as source-document records.
- There is no server-side filename sanitization, MIME sniffing, file-size enforcement, malware scanning, or executable-file rejection.

## 5. Current quote-creation workflow

1. A user opens a project and navigates to the new quote route.
2. The user manually adds line items or imports a material list in the browser.
3. Imported rows are converted directly into editable `QuoteLine` objects using heuristic header matching.
4. The user may add vendor assignment, costs, markup/margin, quote name, shipping, contract fee, and expiration.
5. `createQuoteForProject` or `updateQuoteForProject` writes the quote into the nested project object.
6. Quote approval is a separate explicit user action through `setQuoteApprovalStatus`.
7. Approved quotes can generate vendor purchase orders through existing project services.

The current importer has no extraction session, field confidence, provenance, conflict detection, correction history, or approval boundary between extracted data and quote creation.

## 6. Existing AI, OCR, document-processing, and job integrations

- `Atlas Assistant` is a deterministic, browser-side rules engine. It does not call an AI model.
- No OpenAI SDK, Agents SDK, model API, OCR library, or prompt framework is installed.
- PDF generation uses jsPDF; PDF text import uses pdfjs-dist.
- XLSX import/export uses JSZip and custom workbook XML handling.
- No DOCX parser is installed.
- No durable background-job system exists.
- CIMS has in-memory retry/log concepts, but they are not a persistent job queue and are lost on server restart.
- No automated test framework or existing test suite was found.

## Security assessment

The current application is not ready to receive sensitive quote documents through a privileged AI workflow without backend changes:

- Browser-managed authentication cannot securely authorize a server-side upload or OpenAI request by itself.
- The Supabase anon key is intentionally public and current `app_records` access depends on broad policies/grants.
- There is no server-held service credential, signed session token, row-level ownership enforcement, or secure document bucket workflow.
- The implementation must display: **Do not upload CUI. This environment and its AI service have not been formally approved for CUI handling.**
- The project must not claim CUI compliance. A future CUI boundary should be documented but left disabled.

## Proposed architecture within Atlas

### Frontend

- Add `/quote-intake` and `/quote-intake/:sessionId` routes inside the existing `AppShell`.
- Add an `AI Quote Intake` navigation item to the existing role registry.
- Add views/components under the existing `src/views` and `src/components` structure.
- Use the existing visual system and project/quote services only at the final approval boundary.
- Keep all uploaded content and AI calls off the browser except for the upload stream and API responses required by the review UI.

### Server

- Extend `server.mjs` through focused server modules under a new `server/` directory rather than replacing the deployment architecture.
- Add authenticated `/api/quote-intake/*` endpoints for session creation, uploads, processing, review updates, approval, rejection, reprocessing, source retrieval, and audit history.
- Introduce explicit body/file limits, multipart parsing, MIME and extension allowlists, filename sanitization, magic-byte checks, timeouts, retries, request IDs, and redacted logs.
- Use a server-only Supabase service client and server-only OpenAI client.
- Use a database-backed job claim/status model initially. The Railway web process can execute short jobs asynchronously with durable status; a separate worker can be introduced later without changing the schema.

### Storage

- Use a private Supabase Storage bucket for original documents.
- Store randomized object keys; keep sanitized display names only as metadata.
- Serve source documents through short-lived signed URLs after authorization checks.
- Store hashes, detected MIME types, sizes, extraction status, and retention metadata.

### AI provider boundary

- Define a `QuoteIntakeProvider` interface with mock and OpenAI implementations.
- Default local development to the fixture-backed mock provider.
- Select the provider and model only through server environment variables.
- Validate every provider response against one strict runtime schema before persistence.
- Treat extracted document text as untrusted data and wrap it in fixed agent instructions that explicitly ignore embedded instructions.
- The provider may produce Draft/Review-required extraction results only. Approval remains a separate user-authenticated endpoint.

## Staged implementation plan

### Stage 2: Schema, interfaces, and security boundaries

1. Add SQL migrations for:
   - `quote_intake_sessions`
   - `quote_intake_documents`
   - `quote_intake_extraction_runs`
   - `quote_intake_quote_fields`
   - `quote_intake_line_items`
   - `quote_intake_source_references`
   - `quote_intake_corrections`
   - `quote_intake_review_decisions`
   - `quote_intake_execution_logs`
2. Store confidence on each field/line value and source references as normalized child records.
3. Add enums/check constraints for Uploaded, Processing, Extraction complete, Review required, Approved, Rejected, and Processing failed.
4. Add immutable original-value columns and append-only correction/review/audit tables.
5. Add ownership, timestamps, status-transition checks, indexes, and RLS/service-role policies.
6. Define TypeScript domain types and strict runtime schemas.
7. Define the authenticated API contract and explicit status-transition state machine.
8. Add a permission such as `useQuoteIntake`, initially granted to Admin and Procurement Team roles unless product policy says otherwise.

### Stage 3: Secure upload and deterministic extraction

1. Add private storage bucket setup and server-side upload endpoints.
2. Validate supported extension, detected MIME signature, per-file size, total session size, filename, and file count.
3. Reject executables, archives outside the supported document containers, macro-enabled Office formats, and type mismatches.
4. Extract:
   - CSV/TXT with preserved line/row references.
   - XLSX/XLS with worksheet names, rows, merged-cell handling, and cell references.
   - DOCX paragraphs and tables with section/table/row references.
   - Selectable PDF text with page references.
5. Detect image-only/scanned PDFs and mark them `Review required: additional visual/OCR processing needed` rather than pretending extraction succeeded.
6. Normalize extracted chunks, deduplicate repeated headers/footers, and enforce model-input size budgets.

### Stage 4: Mock provider and structured extraction

1. Implement the provider interface and deterministic mock provider.
2. Add the seven required fixture document scenarios and fixture JSON responses.
3. Implement strict schema validation, null/missing-field behavior, confidence thresholds, source validation, exact part-number checks, duplicate detection, and conflict detection.
4. Persist the original validated extraction before any user edits.
5. Add durable execution logs without full document content.

### Stage 5: Real OpenAI provider

1. Verify the current official server-side OpenAI API/SDK immediately before implementation.
2. Add narrowly scoped system/developer instructions in a maintainable server configuration module.
3. Use strict structured outputs matching the runtime schema.
4. Add server-only environment configuration, request timeout, bounded exponential retry for temporary errors, trace/request IDs, and redacted error handling.
5. Never send duplicate or irrelevant content; retain chunk/source identifiers so returned evidence can be verified.
6. Do not enable tool access for email, pricing, POs, vendors, or external systems.

### Stage 6: Review and approval UI

1. Add session creation with existing-project selection or Draft Project selection.
2. Add upload progress and processing status.
3. Build the source panel, editable quote fields, editable line grid, confidence display, missing/conflict/duplicate warnings, source-reference navigation, add/delete draft line actions, reprocess, reject, approve, and audit history.
4. Persist corrections as they are made; do not overwrite original extraction records.
5. On approval, perform one server-side transaction that creates/updates the draft project and creates a non-customer-approved Atlas quote.
6. Record the user, approved values, source session, timestamp, and resulting Atlas project/quote IDs.
7. Prevent repeat approval and reject invalid status transitions.

### Stage 7: Tests, documentation, and validation

1. Add a test runner and separate unit, integration, and API test layers.
2. Cover deterministic PDF/XLSX/XLS/CSV/DOCX/TXT extraction and all requested fixture scenarios.
3. Test schema rejection, exact part-number preservation, null handling, conflicts, duplicates, confidence flags, unauthorized access, invalid/oversized files, retries, mock behavior, approval state transitions, audit creation, and prompt-injection resistance.
4. Test that approval writes to the current Atlas project/quote model while no pre-approval action does.
5. Run type-check, unit/integration tests, production build, and manual end-to-end review.
6. Document setup, migrations, storage, environment variables, test commands, limitations, and recovery procedures.

## Proposed environment variables

Server-only variables must not use the `VITE_` prefix:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QUOTE_INTAKE_STORAGE_BUCKET`
- `QUOTE_INTAKE_AI_PROVIDER=mock|openai`
- `OPENAI_API_KEY`
- `OPENAI_QUOTE_INTAKE_MODEL`
- `QUOTE_INTAKE_MAX_FILE_BYTES`
- `QUOTE_INTAKE_MAX_SESSION_BYTES`
- `QUOTE_INTAKE_MAX_FILES`
- `QUOTE_INTAKE_REQUEST_TIMEOUT_MS`
- `QUOTE_INTAKE_AI_TIMEOUT_MS`
- `QUOTE_INTAKE_AI_MAX_RETRIES`

An additional server-verifiable authentication secret or Supabase Auth configuration is required before production enablement. The current browser session object is not a secure authorization credential.

## Known implementation risks and decisions required before Stage 2

1. **Authentication boundary:** adopt Supabase Auth/JWT verification or introduce a server-signed Atlas session. Supabase Auth is recommended because it aligns with database RLS and private Storage authorization.
2. **Atlas write model:** keep existing nested project JSON initially through a server adapter, or normalize the broader Atlas project/quote model first. The lowest-disruption path is an approval adapter plus optimistic concurrency on the current project JSON record.
3. **Worker execution:** short jobs can begin in the existing Railway service with durable database status; production scale and OCR should move processing to a dedicated worker.
4. **OCR/scanned documents:** initial phase should detect and flag scanned PDFs. Adding an approved OCR/vision service is a separate security and vendor decision.
5. **File scanning:** MIME/signature checks are required for the first release; production document intake should also add malware scanning before files are made available to processors.
6. **CUI:** the module must remain explicitly non-CUI until hosting, storage, logs, identity, model provider, retention, and contractual controls are formally approved.

## Stage 1 outcome

The feature is feasible within the current Atlas repository, but it should not be implemented as another browser-only importer. The next safe implementation step is Stage 2: migrations, authenticated API contracts, runtime schemas, and the server-side security boundary.
