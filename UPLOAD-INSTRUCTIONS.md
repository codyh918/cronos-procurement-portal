# Atlas Material Tracking Redesign

Copy the contents of this folder into the repository root, preserving the included paths, then commit and deploy through the existing Railway workflow.

This package includes:

- Grouped Material Tracking interface and shipment drawer
- Multiple and partial shipments per MEL line
- Shared shipments across multiple MEL lines
- Backward-compatible legacy tracking migration
- Shipment-aware import and export behavior
- Material Tracking regression tests
- MEL Unit Cost precedence fix from the prior upload issue

Validation completed before packaging:

- `npm run test:server`
- `npm run type-check`
- `npm run build`
