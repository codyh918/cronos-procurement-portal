# Cronos Procurement App

Standalone Vue 3 / TypeScript procurement application for Cronos purchasing, quoting, purchase orders, receiving, customer order tracking, catalog lookup, and export workflows.

This repo contains the extracted procurement app from the larger Cronos execution platform. The prior Next.js/Prisma implementation has been replaced on this branch by the Vue migration.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5002`.

## Verification

```bash
npm run type-check
npm run build
```

## Handoff

See [docs/PROCUREMENT_VUE_HANDOFF_2026-06-10.md](docs/PROCUREMENT_VUE_HANDOFF_2026-06-10.md) for the migration summary, known follow-up work, and suggested next-session prompt.
