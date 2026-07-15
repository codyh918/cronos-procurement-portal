Atlas Project Edit Sync Fix Upload Folder

Copy these files into the matching paths in the GitHub repository:

- src/services/remoteRecords.ts
- src/services/localProjects.ts
- src/types.ts

Fix summary:
- Project saves now sync only the changed project ID instead of replacing the entire shared project collection.
- Late remote hydration no longer overwrites a fresh local edit.
- Project records now support optional createdAt and updatedAt metadata.

Verification run locally:
- npm run type-check
- npm run validate:documents
- npm run build
