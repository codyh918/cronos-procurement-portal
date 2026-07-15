Atlas Government Project Lead Upload Folder

Copy these files into the matching paths in the GitHub repository:

- src/types.ts
- src/views/NewProjectView.vue
- src/views/EditProjectView.vue
- src/views/ProjectDetailView.vue
- src/services/localProjects.ts
- src/services/procurementDashboard.ts

Change summary:
- Adds Government Project Lead to the project data model.
- Adds the field on New Project and Edit Project screens.
- Preserves older projects by defaulting missing Government Project Lead values to blank.
- Shows Government Lead on the Project Detail summary tiles.

Verification run locally:
- npm run type-check
- npm run validate:documents
- npm run build
