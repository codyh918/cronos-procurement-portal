Atlas Quote Table Top Scrollbar Upload Folder

Copy these files into the matching paths in the GitHub repository:

- src/components/QuoteLinesEditor.vue
- src/style.css

Change summary:
- Adds a synchronized top horizontal scrollbar to the editable quote line-item table.
- Keeps the existing bottom/table horizontal scrollbar.
- Synchronizes top scrollbar, table scrollbar, trackpad horizontal scrolling, and keyboard/scrollbar movement.
- Makes quote table headers sticky while scrolling vertically.
- Preserves existing quote table column widths and quote editing behavior.

Verification run locally:
- npm run type-check
- npm run validate:documents
- npm run build

Note:
- npm run lint could not be run because this project does not define a lint script.
