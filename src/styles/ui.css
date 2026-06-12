/* @dash1/ui/style.css — base styles for primitive components.
   Each component also ships its own scoped style block, but a few
   patterns (focus rings, table conventions) are easier to define
   once at the package level. */

@import './tokens.css';

/* Universal focus ring shared across all interactive primitives. */
.dash-focus-ring:focus,
.dash-focus-ring:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.15);
}

body {
  background:
    linear-gradient(135deg, rgba(var(--accent-rgb), 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 42%), var(--bg);
  color: var(--text);
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.btn,
.btn-primary,
.btn-secondary,
.btn-ghost,
.btn-danger,
.btn-cancel,
.btn-create,
.btn-save,
.btn-delete,
.btn-add,
.btn-edit,
.btn-submit,
.btn-receive,
.btn-receive-new,
.btn-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 32px;
  padding: 6px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-sm);
  font-weight: 700;
  line-height: 1;
  transition:
    background var(--transition),
    border-color var(--transition),
    color var(--transition),
    box-shadow var(--transition),
    transform var(--transition);
}

.btn:hover,
.btn-primary:hover,
.btn-secondary:hover,
.btn-ghost:hover,
.btn-danger:hover,
.btn-cancel:hover,
.btn-create:hover,
.btn-save:hover,
.btn-delete:hover,
.btn-add:hover,
.btn-edit:hover,
.btn-submit:hover,
.btn-receive:hover,
.btn-receive-new:hover,
.btn-back:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.btn:disabled,
.btn-primary:disabled,
.btn-secondary:disabled,
.btn-ghost:disabled,
.btn-danger:disabled,
.btn-save:disabled,
.btn-submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn-primary,
.btn-create,
.btn-save,
.btn-add,
.btn-submit,
.btn-receive,
.btn-receive-new {
  border-color: var(--accent);
  background: linear-gradient(180deg, var(--accent), var(--accent-hover));
  color: #fff;
  box-shadow: 0 0 18px rgba(var(--accent-rgb), 0.18);
}

.btn-secondary,
.btn-cancel,
.btn-back,
.btn-edit {
  background: rgba(255, 255, 255, 0.035);
}

.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-muted);
}

.btn-danger,
.btn-delete {
  border-color: rgba(251, 113, 133, 0.36);
  background: rgba(251, 113, 133, 0.1);
  color: var(--danger);
}

.card,
.dash-panel-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

.pill,
.badge,
.mode-badge,
.conn-badge,
.dash-nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 22px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(var(--accent-rgb), 0.28);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.badge-open,
.badge-scheduled,
.badge-in_progress,
.badge-active,
.badge-complete,
.badge-received,
.badge-staged,
.badge-supabase,
.conn-green,
.badge-green {
  border-color: rgba(45, 212, 191, 0.34);
  background: rgba(45, 212, 191, 0.12);
  color: var(--green);
}

.badge-draft,
.badge-on_hold,
.badge-local,
.conn-amber,
.badge-amber {
  border-color: rgba(251, 191, 36, 0.34);
  background: rgba(251, 191, 36, 0.12);
  color: var(--amber);
}

.badge-cancelled,
.badge-expired,
.badge-blocked,
.badge-danger {
  border-color: rgba(251, 113, 133, 0.34);
  background: rgba(251, 113, 133, 0.12);
  color: var(--danger);
}

.dash-command-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: var(--space-3) var(--space-5);
  background: var(--surface-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  backdrop-filter: blur(14px);
}

.dash-table {
  width: 100%;
  border-collapse: collapse;
}

.dash-table th,
.dash-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.dash-table th {
  color: var(--text-muted);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
