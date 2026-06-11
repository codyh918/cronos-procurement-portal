/* ──────────────────────────────────────────────────────────────────
   @dash1/tokens — Shared design tokens for the Cronos Execution Platform.

   CXP uses a calm command-center visual language:
   - Dark graphite backgrounds with slightly lifted translucent surfaces
   - Soft luminous accents used by product role, not entire-page color washes
   - Light gray text (#e8edf7) with muted secondaries
   - System sans-serif font, monospace for codes / IDs
   - Soft 12px corners on cards, 8px on inputs/buttons

   Per-product accents (project-mgmt blue, procurement amber, warehouse
   violet, etc.) are layered on top by each app's own stylesheet.

   Usage:
     import '@dash1/tokens'                // alias for tokens.css
     import '@dash1/tokens/tokens.css'     // explicit
     import '@dash1/tokens/reset.css'      // optional CSS reset
   ────────────────────────────────────────────────────────────────── */

:root {
  /* ── Surface palette ────────────────────────────────────────────── */
  --bg: #090d12;
  --surface: #121821;
  /* --surface-2 — subtle lift over --surface for nested panels (helper
     cards inside group cards, switching builder sub-sections, etc.).
     Lighter than --surface in dark mode, darker than --surface in light. */
  --surface-2: #16202c;
  --surface-glass: rgba(18, 24, 33, 0.82);
  --card: #171f2b;
  --readonly: #141b25;
  --border: #283241;
  --border-hover: #3a485c;

  /* ── Text scale ────────────────────────────────────────────────── */
  --text: #e8edf7;
  --text-muted: #9aa7b8;
  --text-subtle: #667386;
  /* Legacy aliases used by av-cxp-vue / rom-tool source CSS. */
  --muted: var(--text-muted);
  --faint: var(--text-subtle);

  /* ── Brand + accent palette ────────────────────────────────────── */
  --accent: #60a5fa; /* luminous cobalt — neutral primary */
  --accent-hover: #3b82f6;
  --accent-rgb: 96, 165, 250;
  --accent-dim: rgba(96, 165, 250, 0.13);
  --accent-border: rgba(96, 165, 250, 0.42);
  --info: #3b82f6;
  --warn: #f59e0b;
  --danger: #ef4444;
  --required: #a8645f;
  --required-rgb: 168, 100, 95;
  --navy: #0b1018; /* ribbon bg — graphite command rail */
  --purple: #a78bfa;
  --orange: #f59e0b;

  /* Utility status hues used by dashboard widgets + per-tool theming. */
  --blue: #3b82f6;
  --green: #22c55e;
  --amber: #f59e0b;
  --red: #ef4444;
  --violet: #8b5cf6;

  /* ── MEL group stripe palette ──────────────────────────────────────
     Per-group accent stripes for MEL Standard mode group headers.
     Each value is intentionally distinct from adjacent groups so the
     vertical stripe reads cleanly when groups are stacked. */
  --stripe-signage: #f59e0b; /* amber */
  --stripe-displays: #3b82f6; /* cobalt */
  --stripe-sources: #06b6d4; /* cyan */
  --stripe-vtc: #10b981; /* emerald */
  --stripe-switching: #a78bfa; /* violet */
  --stripe-audio: #c084fc; /* purple */
  --stripe-control: #6366f1; /* indigo */
  --stripe-network: #64748b; /* steel */
  --stripe-kvm: #94a3b8; /* slate */
  --stripe-rack: #d97706; /* orange */
  --stripe-power: #ef4444; /* red */
  --stripe-cabling: #9ca3af; /* gray */
  --stripe-bulk: #6b7280; /* gray-dark */

  /* ── Status surface pairs (bg + border) — dark-tuned ───────────── */
  --green-bg: rgba(34, 197, 94, 0.12);
  --green-border: rgba(34, 197, 94, 0.4);
  --orange-bg: rgba(245, 158, 11, 0.12);
  --orange-border: rgba(245, 158, 11, 0.4);

  /* ── Typography ────────────────────────────────────────────────── */
  --font-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font: var(--font-base);
  --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', monospace;
  --fs-xs: 10px;
  --fs-sm: 11px;
  --fs-md: 12px;
  --fs-lg: 13px;
  --fs-xl: 15px;
  --fs-2xl: 20px;
  --fs-3xl: 26px;
  --lh-tight: 1.2;
  --lh-base: 1.45;
  --lh-loose: 1.6;

  /* ── Spacing scale ─────────────────────────────────────────────── */
  --space-1: 4px;
  --space-2: 6px;
  --space-3: 8px;
  --space-4: 10px;
  --space-5: 12px;
  --space-6: 14px;
  --space-7: 16px;
  --space-8: 20px;
  --space-9: 24px;

  /* ── Radius scale — softer corners across the CXP family ───────── */
  --radius-sm: 8px;
  --radius: 8px; /* default for buttons + inputs */
  --radius-md: 10px;
  --radius-lg: 12px; /* cards and panels */
  --radius-pill: 999px;

  /* ── Elevation ─────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.34);
  --shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
  --glow: 0 0 0 1px rgba(var(--accent-rgb), 0.18), 0 0 26px rgba(var(--accent-rgb), 0.14);

  /* ── Motion ────────────────────────────────────────────────────── */
  --transition-fast: 0.12s;
  --transition: 0.15s;

  /* ── Color scheme hint ─────────────────────────────────────────── */
  color-scheme: dark;
}

:root[data-theme='light'] {
  --bg: #f7f5ee;
  --surface: #ffffff;
  --surface-2: #fbf9f1;
  --surface-glass: rgba(255, 255, 255, 0.85);
  --card: #ffffff;
  --readonly: #f3f1e8;
  --border: #d8d6cd;
  --border-hover: #bdb8aa;

  --text: #1a1a1a;
  --text-muted: #6f6f6a;
  --text-subtle: #a4a299;
  --muted: var(--text-muted);
  --faint: var(--text-subtle);

  --navy: #1a3560;
  --green-bg: rgba(34, 197, 94, 0.13);
  --green-border: rgba(34, 197, 94, 0.35);
  --orange-bg: rgba(245, 158, 11, 0.13);
  --orange-border: rgba(245, 158, 11, 0.35);

  --shadow-sm: 0 1px 2px rgba(26, 39, 68, 0.08);
  --shadow: 0 4px 14px rgba(26, 39, 68, 0.14);
  color-scheme: light;
}

:root[data-theme='dark'] {
  --bg: #090d12;
  --surface: #121821;
  --surface-2: #16202c;
  --surface-glass: rgba(18, 24, 33, 0.82);
  --card: #171f2b;
  --readonly: #141b25;
  --border: #283241;
  --border-hover: #3a485c;

  --text: #e8edf7;
  --text-muted: #9aa7b8;
  --text-subtle: #667386;
  --muted: var(--text-muted);
  --faint: var(--text-subtle);

  --navy: #0b1018;
  --green-bg: rgba(34, 197, 94, 0.12);
  --green-border: rgba(34, 197, 94, 0.4);
  --orange-bg: rgba(245, 158, 11, 0.12);
  --orange-border: rgba(245, 158, 11, 0.4);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.34);
  --shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
  --glow: 0 0 0 1px rgba(var(--accent-rgb), 0.18), 0 0 26px rgba(var(--accent-rgb), 0.14);
  color-scheme: dark;
}

/* ── Accent templates ──────────────────────────────────────────────
   Apps can switch templates by setting `data-color-template` on <html>.
   The structural palette stays stable; only accents and action emphasis move. */
:root[data-color-template='cobalt'] {
  --accent: #60a5fa;
  --accent-hover: #3b82f6;
  --accent-rgb: 96, 165, 250;
  --accent-dim: rgba(96, 165, 250, 0.13);
  --accent-border: rgba(96, 165, 250, 0.42);
  --info: #60a5fa;
}

:root[data-color-template='indigo'] {
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-rgb: 99, 102, 241;
  --accent-dim: rgba(99, 102, 241, 0.13);
  --accent-border: rgba(99, 102, 241, 0.42);
  --info: #818cf8;
}

:root[data-color-template='violet'] {
  --accent: #a78bfa;
  --accent-hover: #8b5cf6;
  --accent-rgb: 167, 139, 250;
  --accent-dim: rgba(167, 139, 250, 0.13);
  --accent-border: rgba(167, 139, 250, 0.42);
  --info: #c4b5fd;
}

:root[data-color-template='cyan'] {
  --accent: #0891b2;
  --accent-hover: #0e7490;
  --accent-rgb: 8, 145, 178;
  --accent-dim: rgba(8, 145, 178, 0.13);
  --accent-border: rgba(8, 145, 178, 0.42);
  --info: #06b6d4;
}

:root[data-color-template='amber'] {
  --accent: #fbbf24;
  --accent-hover: #f59e0b;
  --accent-rgb: 251, 191, 36;
  --accent-dim: rgba(251, 191, 36, 0.14);
  --accent-border: rgba(251, 191, 36, 0.42);
  --info: #3b82f6;
}

:root[data-color-template='rose'] {
  --accent: #e11d48;
  --accent-hover: #be123c;
  --accent-rgb: 225, 29, 72;
  --accent-dim: rgba(225, 29, 72, 0.12);
  --accent-border: rgba(225, 29, 72, 0.42);
  --info: #3b82f6;
}

:root[data-color-template='steel'] {
  --accent: #64748b;
  --accent-hover: #475569;
  --accent-rgb: 100, 116, 139;
  --accent-dim: rgba(100, 116, 139, 0.15);
  --accent-border: rgba(100, 116, 139, 0.45);
  --info: #38bdf8;
}

:root[data-color-template='teal'] {
  --accent: #2dd4bf;
  --accent-hover: #14b8a6;
  --accent-rgb: 45, 212, 191;
  --accent-dim: rgba(45, 212, 191, 0.13);
  --accent-border: rgba(45, 212, 191, 0.42);
  --info: #3b82f6;
}
