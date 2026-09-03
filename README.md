# Save Quote Before PDF Export

## Changed file

- `src/views/NewQuoteView.vue`

## Behavior

Atlas now saves the current quote lines and pricing to Supabase before generating a PDF. PDF export stops when the save fails, preventing an exported PDF from containing pricing that was never persisted.

## Validation

- `npm run type-check`
- `npm run build`
