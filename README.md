# Quote Spreadsheet Save Fix

## Changed file

- `src/services/localProjects.ts`

## Behavior

Atlas now sanitizes and compacts spreadsheet/CSV import provenance before saving quote lines. This prevents oversized or invalid project JSON from blocking Design & Install quote saves while retaining the source filename, worksheet, row coordinates, normalized values, confidence scores, and relevant populated source cells.

## Validation

- `npm run type-check`
- `npm run build`

