# Atlas SEWP RFQ Portal: Phase 1A and 1B Implementation Plan

Date: 2026-07-22

## Purpose

This document completes the required pre-code assessment and plan for the first Atlas SEWP RFQ Portal release. Scope is limited to:

- Phase 1A: portal foundation, dashboard, work queue, RFQ workspace, document intake, assignment, deadlines, tasks, lifecycle, and audit trail.
- Phase 1B: deterministic document extraction, AI-assisted intake, AI summary, human verification, requirements checklist, BOM extraction, and source citations.

Vendor pricing, response-package generation, submission automation, award conversion, and post-award PO creation are outside this implementation increment.

## Current Atlas architecture

### Frontend

- Vue 3, TypeScript, and Vite single-page application.
- Vue Router routes render inside the existing `AppShell`, which retains the Cronos-branded `Sidebar` and Atlas Assistant.
- Role-aware navigation is defined in `src/roles.ts`; route guards are defined in `src/router/index.ts`.
- Shared UI includes `AppShell`, `Sidebar`, `DataTable`, `StatusBadge`, `FormField`, `TrackingField`, `Panel`, and dashboard display components.
- The design system is primarily in `src/style.css` and existing CSS token/style modules.
- Core application state is service-based, with browser local storage used as a cache and Supabase synchronization handled by `src/services/remoteRecords.ts`.

### Authentication and authorization

- Atlas has application-managed Admin and Procurement Team roles.
- The browser session is stored in local storage and is not a server-verifiable security token.
- Admin route restrictions exist in the UI/router, but there is no secure backend permission enforcement for general Atlas records.
- Supabase Auth is not currently enabled.

### Backend

- `server.mjs` is a minimal Node HTTP server serving `dist` with SPA fallback.
- It includes a small set of in-memory CIMS endpoints but no general Atlas API framework, multipart upload handling, persistent jobs, or server-side Atlas authorization.
- Sensitive server capabilities such as OpenAI, privileged Storage, transactional workflow updates, and enforceable permissions do not exist yet.

### Database

- Supabase PostgreSQL is the current platform.
- Atlas projects and their nested quotes, quote lines, POs, and inventory are stored as JSONB collections in `public.app_records`.
- Customers and addresses are separate logical collections in the same generic table.
- The vendor directory and part catalog are primarily browser-local rather than normalized production tables.
- A normalized CIMS migration exists, but it is explicitly a separate warehouse schema and is not the Atlas RFQ/project persistence model.
- There are no SEWP RFQ tables.

### Existing tasks, notifications, and audit behavior

- The main dashboard has task and alert UI that can be reused conceptually and visually.
- Procurement task overrides are browser-local and are not suitable as the durable SEWP task system.
- No general persistent notification service exists.
- The Audit Log route is currently a placeholder.
- CIMS and document-generation code contain limited in-memory/console audit behavior, not a complete Atlas audit system.

### Existing document and quote capabilities

- `NewQuoteView.vue` imports CSV, TXT, XLSX, some XLS variants, and selectable PDF text in the browser.
- Existing import logic does not preserve uploaded originals, all worksheets, complete provenance, versions, field confidence, or correction history.
- DOCX and OCR are not supported.
- Quote and PO PDFs use jsPDF. XLSX generation uses JSZip and custom workbook XML.
- Vendor RFQ workbooks and vendor-price imports already exist and can be integrated in a later phase.

### Existing AI behavior

- Atlas Assistant is a deterministic browser-side rules engine, not a model integration.
- No OpenAI SDK, Agents SDK, OCR service, durable worker, or background-job framework exists.

## Architectural conclusion

The SEWP portal must remain inside the current Vue/Atlas shell, but Phase 1A/1B cannot safely use the current browser-only persistence model for sensitive uploads and AI processing. The existing Node process should be extended with modular server-side APIs rather than replaced, and normalized Supabase tables/private Storage should become the system of record for SEWP workflows.

The portal must display this warning at upload points:

> Do not upload CUI. This Atlas deployment and its AI service have not been formally approved for CUI handling.

The implementation must not claim CUI compliance.

## Components and services to reuse

- `AppShell.vue` and `Sidebar.vue`: preserve native Atlas navigation and branding.
- `roles.ts` and router guards: extend navigation and UI permissions.
- `DataTable.vue`: reuse visual conventions; create a purpose-built SEWP queue table wrapper for sorting, pagination, filters, selectable rows, column preferences, and bulk actions.
- `StatusBadge.vue`: extend mappings for RFQ lifecycle, health, verification, and AI statuses.
- `FormField.vue`, `TrackingField.vue`, `Panel.vue`: use throughout edit/review forms.
- Dashboard cards/badges/empty states: reuse patterns from `DashboardView.vue`.
- `quoteImport.ts`: reuse parsing lessons, but move deterministic extraction server-side and preserve provenance.
- `pdfExports.ts`, `workbookExports.ts`, and document audit helpers: reuse visual/document conventions for later exports; Phase 1A/1B needs only approved operational exports and document previews.
- `vendorDirectory.ts`: read-only adapter in Phase 1; vendor normalization and vendor pricing remain later-phase work.
- Existing user list: use as display/assignment source after server-verifiable identity is established.

## Phase 1 routes

All routes remain children of the existing Atlas `AppShell`:

- `/sewp-rfqs` redirects to `/sewp-rfqs/dashboard`.
- `/sewp-rfqs/dashboard`
- `/sewp-rfqs/work-queue`
- `/sewp-rfqs/new`
- `/sewp-rfqs/:rfqId`
- `/sewp-rfqs/:rfqId/documents`
- `/sewp-rfqs/:rfqId/bom`
- `/sewp-rfqs/:rfqId/compliance`
- `/sewp-rfqs/:rfqId/audit`

Routes use the database UUID `rfqId`; the displayed SEWP RFQ number is never the primary route identifier.

Later routes for vendor pricing, pricing, submission, reports, and settings should not be activated until their phases are implemented.

## Phase 1A data model

Create a new migration rather than adding records to frontend seed data.

### Core tables

1. `sewp_rfqs`
   - UUID ID, Atlas opportunity number, official SEWP RFQ number, title, agency/customer, source, category, set-aside, lifecycle stage, health, priority, AI status, received/question/response timestamps with time zone, estimated value, owner/backup owner, next action, optimistic-lock version, created/updated metadata, soft-delete/cancel metadata.
   - Unique indexes for opportunity number and a normalized official-number/source combination.

2. `sewp_rfq_contacts`
   - Government/customer contacts by RFQ, contact type, name, organization, email, phone, verification state, and provenance.

3. `sewp_rfq_documents`
   - RFQ ID, category, sanitized display name, private Storage object key, detected MIME, size, SHA-256, version, parent document/version, amendment link, processing status, uploaded-by/time, and immutable original-file flag.

4. `sewp_rfq_assignments`
   - Owner role, assigned user, active dates, assignment reason, and audit linkage.

5. `sewp_rfq_tasks`
   - Type, priority, owner, due timestamp, status, notes, deduplication key, related record, completion metadata, and escalation metadata.

6. `sewp_rfq_stage_history`
   - From/to stage, actor, timestamp, justification, related approval, and record version.

7. `sewp_rfq_audit_events`
   - Append-only action log with actor type/user/agent, prior/new JSON values, reason, entity type/ID, document reference, request/trace ID, and timestamp.

8. `sewp_rfq_saved_views`
   - User-owned queue filters, sort, visible columns, default flag, and version.

9. `sewp_rfq_notifications`
   - Durable deduplicated alert records for assignments, deadlines, blocked state, and review work. Delivery is in-app only for this phase.

### Workflow controls

- Define the 18 required lifecycle stages in a constrained enum/check table.
- Define permitted stage transitions in a database-backed transition table or server configuration covered by tests.
- Mandatory transitions require specific permission and, where applicable, completed reviews.
- Exceptional transitions require a reason and explicit override permission.
- Every update uses the record version to prevent stale writes.

## Phase 1B data model

1. `sewp_rfq_extraction_runs`
   - RFQ/document set, provider, model/config version, status, attempt, timeout, token/input metrics without full sensitive content, trace ID, error category, and timestamps.

2. `sewp_rfq_extracted_fields`
   - Field key, proposed value JSON, confidence, verification status, reviewer, verified value JSON, verified version, and conflict state.

3. `sewp_rfq_source_citations`
   - Extracted field/requirement/line association, document ID/version, page, worksheet, row/cell, section, bounded source excerpt, and extraction chunk ID.

4. `sewp_rfq_requirements`
   - Requirement category, text, applicability, AI proposal state, human status, compliance status, assigned reviewer, source, and version.

5. `sewp_rfq_line_items`
   - Line/CLIN, original requested part number, proposed normalized part number, approved quoted part number, manufacturer, description, quantity/UOM, configuration, required flag, TAA/COO/warranty/delivery/service data, notes, verification status, source, version, and deleted-draft marker.

6. `sewp_rfq_ai_summaries`
   - Versioned generated summary, confidence/warnings, source extraction run, human review status, reviewer, and timestamp.

7. `sewp_rfq_field_corrections`
   - Append-only original/proposed/corrected values, user, reason, timestamp, field version, and source run.

8. `sewp_rfq_ai_execution_logs`
   - Agent identity, provider, operation, trace ID, status, latency, retry count, redacted error, and hashes/IDs rather than full document content.

## Storage plan

- Create a private Supabase Storage bucket dedicated to SEWP RFQ documents.
- Use UUID-based object keys; never use user filenames as paths.
- Keep sanitized filenames as database metadata.
- Validate extension, declared MIME, magic bytes, maximum file size, total RFQ upload size, and file count on the server.
- Reject executable content, macro-enabled Office documents in Phase 1, mismatched types, unsupported archives, and path traversal.
- Store original files immutably. New uploads create versions rather than overwriting objects.
- Provide short-lived signed URLs only after backend authorization.
- Scanned/image-only PDFs are detected and flagged for additional processing; Phase 1B does not silently treat them as complete extractions.
- Malware scanning is strongly recommended before production use and must be documented as a limitation if unavailable.

## API boundary

Extend the existing Node service through modules under `server/`:

- `POST /api/sewp-rfqs`
- `GET /api/sewp-rfqs`
- `GET/PATCH /api/sewp-rfqs/:rfqId`
- `POST /api/sewp-rfqs/:rfqId/documents`
- `GET /api/sewp-rfqs/:rfqId/documents`
- `GET /api/sewp-rfqs/:rfqId/documents/:documentId/source`
- `POST /api/sewp-rfqs/:rfqId/process`
- `GET /api/sewp-rfqs/:rfqId/extractions/latest`
- `PATCH /api/sewp-rfqs/:rfqId/verification`
- `POST /api/sewp-rfqs/:rfqId/reprocess`
- `POST /api/sewp-rfqs/:rfqId/stage-transitions`
- CRUD endpoints for assignments, tasks, requirements, draft BOM lines, saved views, and notifications.
- `GET /api/sewp-rfqs/:rfqId/audit`

Every mutating endpoint must validate authorization, input schema, record version, workflow transition, and audit requirements server-side.

## Authentication and permissions

### Required security boundary

Adopt Supabase Auth with server-side JWT validation before enabling production uploads. The current local-storage session cannot prove identity to the server.

### Phase 1 permissions

- `sewp.rfq.view`
- `sewp.rfq.create`
- `sewp.rfq.edit`
- `sewp.rfq.assign`
- `sewp.rfq.upload`
- `sewp.rfq.review_ai`
- `sewp.rfq.verify_fields`
- `sewp.rfq.edit_bom`
- `sewp.rfq.review_requirements`
- `sewp.rfq.transition`
- `sewp.rfq.override_transition`
- `sewp.rfq.manage_tasks`
- `sewp.rfq.view_audit`

The initial Atlas Admin and Procurement Team roles can be mapped to permission bundles for migration compatibility, while the database/API model supports the future specialist roles from the specification.

Permissions must be enforced in the UI, API, database RLS, private Storage access, and exports.

## AI and deterministic extraction design

### Deterministic processing first

- CSV/TXT: preserve physical lines and row numbers.
- XLSX/XLS: preserve worksheets, merged cells, row/cell addresses, raw display values, and exact part-number strings.
- DOCX: extract paragraphs and tables with section/table/row references.
- PDF: extract selectable text by page and retain layout-aware blocks.
- Detect image-only/scanned PDFs and mark `Needs Review` or `Additional processing required`.
- De-duplicate repeated headers/footers and enforce input budgets before model execution.

### Provider abstraction

- `SewpIntakeProvider` interface with `mock` and `openai` implementations.
- Mock provider is the development/test default and uses fixture responses.
- Real provider runs only server-side and is selected by environment variable.
- Verify the current official OpenAI server API/SDK immediately before Phase 1B implementation.
- Validate structured output against strict runtime schemas before database writes.
- Treat document text as untrusted. Embedded instructions cannot modify system behavior.
- The agent has no email, submission, pricing approval, PO, customer communication, or external-system tools.

### Verification rules

- AI results begin as `AI Proposed`, `Needs Review`, `Not Found`, or `Conflicting Information`.
- Only a human with permission can set `Human Verified`.
- `Not found in the uploaded documents` is used instead of guesses.
- Human-verified data is immutable to later AI runs unless a human explicitly accepts a cited conflict.
- Exact requested part numbers are preserved. Normalized/replacement part numbers use separate fields.
- Every proposed value must include confidence and at least one valid source citation or be explicitly marked unsupported/not found.

## Phase 1A UI

### Primary navigation

- Add `SEWP RFQ Portal` beside existing core modules through `navigationRegistry` and role configuration.
- Use the existing Cronos sidebar/logo and Atlas shell at all portal routes.

### Portal dashboard

- Urgent cards first: Due Within 4 Hours, Due Today, Due Within 24 Hours, Unassigned, Review Required, Submission Blocked.
- Secondary cards: new today, waiting states, ready state, no-bid recommendation, recently awarded.
- Lightweight native summaries for received-by-day, stage, owner, agency, and approaching deadlines.
- Cards link to encoded work-queue filters.

### Work queue

- Full-row navigation by database RFQ ID.
- Server-side pagination/filter/sort for high-volume use.
- Search, required filters, saved/default views, column chooser, refresh/reset, and approved bulk assignment/stage actions.
- Excel/PDF operational exports from the filtered result set.
- Time remaining is calculated from the authoritative due timestamp/time zone and rendered with overdue/urgency state.

### RFQ workspace

- Native Atlas header, current-stage badge, lifecycle tracker, deadlines/health panel, assignments, next action, tabs, and audit metadata.
- Tabs implemented in Phase 1: Overview, Documents, Intake Review, BOM, Requirements, Tasks, Audit.
- Manual RFQ creation includes duplicate-number detection and clear validation.
- Loading, empty, error, warning, success, concurrency-conflict, and permission-denied states are required.

## Phase 1B UI

- Source-document panel with document/version selection and page/worksheet navigation when supported.
- AI-generated summary clearly labeled as requiring human verification.
- Extracted-field review grouped by RFQ identity, customer/contact, dates, delivery, submission, and contract/compliance information.
- Each field shows AI status, confidence, citation, proposed value, verified value, reviewer, and review date.
- BOM grid preserves original/normalized/approved part-number columns and exposes duplicate/conflict/missing warnings.
- Requirement checklist allows AI proposal but reserves verified/certified statuses for authorized humans.
- Reprocess creates a new run and proposal version; it never overwrites verified values.

## Tasks and notifications

- Use normalized SEWP task and notification records, not the existing browser-local task override store.
- Initial automated task types: review new RFQ, verify extraction, complete bid/no-bid review, review missing documents, and deadline escalation.
- Use deterministic deduplication keys to prevent duplicate notifications.
- Add SEWP task/alert adapters to the existing Atlas dashboard after the SEWP source of truth is operational.
- No email delivery is included in Phase 1A/1B.

## Testing plan

Add a test runner and cover:

- API authentication and each permission boundary.
- Invalid, mismatched, executable, macro-enabled, and oversized uploads.
- Private document access and signed URL authorization.
- RFQ duplicate detection and opportunity-number generation.
- Stage transition rules, required justifications, and stale-version rejection.
- Task/notification deduplication and deadline calculations across time zones.
- PDF, spreadsheet, DOCX, CSV, and TXT extraction with provenance.
- Scanned-PDF detection.
- Exact part-number preservation.
- Missing values, conflicts, duplicates, and low confidence.
- Structured output validation and malicious document instructions.
- Mock provider, temporary failure retries, timeout, and failed extraction status.
- Human verification, correction history, reprocessing, and verified-value preservation.
- Audit events for all material actions.
- Responsive queue/workspace behavior and route authorization.
- Regression type-check and production build.

## Environment variables

Server-only variables must not use the `VITE_` prefix:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SEWP_STORAGE_BUCKET`
- `SEWP_AI_PROVIDER=mock|openai`
- `OPENAI_API_KEY`
- `OPENAI_SEWP_MODEL`
- `SEWP_MAX_FILE_BYTES`
- `SEWP_MAX_RFQ_UPLOAD_BYTES`
- `SEWP_MAX_FILES_PER_RFQ`
- `SEWP_PROCESSING_TIMEOUT_MS`
- `SEWP_AI_TIMEOUT_MS`
- `SEWP_AI_MAX_RETRIES`

Supabase Auth issuer/audience configuration or an equivalent server-verifiable session mechanism is also required.

## Implementation sequence

### Increment 1: Security and persistence foundation

- Supabase Auth/JWT validation decision and implementation.
- Phase 1 migrations, private bucket, RLS, permission mapping, API scaffolding, runtime validation, audit writer, and tests.

### Increment 2: Phase 1A core workflow

- Navigation/routes, RFQ CRUD, assignment, lifecycle transitions, deadlines, documents/versioning, tasks, notifications, audit, and manual creation.

### Increment 3: Phase 1A operations UI

- Dashboard, work queue, saved views, filtering/sorting/pagination, bulk actions, operational exports, responsive QA.

### Increment 4: Phase 1B deterministic extraction and mock AI

- Extractors, provenance model, scanned-file detection, mock provider, fixtures, schema validation, conflict/duplicate logic, and processing state.

### Increment 5: Phase 1B review UI

- Summary, source viewer, field verification, requirements, BOM, citations, corrections, reprocessing, and audit history.

### Increment 6: Real AI provider and final validation

- Official OpenAI integration behind the provider flag, timeouts/retries/tracing, security review, full test suite, migration/setup documentation, production build, and manual acceptance validation.

Each increment must pass its tests before the next begins. Vendor pricing and later phases remain disabled until Phase 1A/1B human controls are accepted.

## Blocking decisions before feature code

1. Approve Supabase Auth as the production identity boundary, or specify another server-verifiable identity system.
2. Confirm whether current users will be migrated into Supabase Auth or linked to new Auth identities while retaining Atlas profile/role records.
3. Confirm initial per-file, per-RFQ, and retention limits.
4. Confirm whether production malware scanning is available; otherwise record it as a launch blocker or explicit security limitation.
5. Confirm the initial authorized role mapping for RFQ creation, assignment, AI verification, and lifecycle overrides.

## Recommended next step

Begin Increment 1 only after the identity decision is approved. The safest default is Supabase Auth plus server-side JWT verification, normalized PostgreSQL tables, RLS, private Storage, and a server-held service-role key. This establishes the security boundary required for all Phase 1A/1B work without replacing the existing Atlas application.
