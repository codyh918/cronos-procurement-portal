Atlas Checkbook Quote Excel Budget Upload Folder

Copy this file into the matching path in the GitHub repository:

- src/services/workbookExports.ts

Change summary:
- Checkbook project quote Excel exports now show:
  - Total Material Budget
  - Total Material Quoted
  - Balance Remaining
- The rows are added under the quote totals and only appear for Checkbook type projects.
- Non-checkbook quote Excel exports keep their existing layout.

Verification run locally:
- npm run type-check
- npm run validate:documents
- npm run build
