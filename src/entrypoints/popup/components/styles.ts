import type React from "react"

/**
 * Popup shared style objects.
 *
 * Iteration #2: Interactive elements (buttons, inputs, status cards) should now use
 * className="astra-btn-primary/secondary/danger", className="astra-input", className="astra-card"
 * from astra-extension.css. The style objects below are retained for any residual spreads
 * and for non-interactive text/layout tokens. Color values now reference CSS custom properties.
 */

/** @deprecated Prefer className="astra-btn-primary" */
export const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "var(--astra-brand)",
  color: "var(--astra-text-on-brand)",
  border: "1px solid transparent",
  borderRadius: "var(--astra-radius-md)",
  cursor: "pointer",
  fontSize: "var(--astra-text-base)",
  fontWeight: 500,
}

// btnSecondary — removed (unused; prefer className="astra-btn-secondary")
// btnDisabled — removed (prefer native disabled attribute on astra-btn-* classes)

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--astra-text-xs)",
  color: "var(--astra-text-secondary)",
  marginBottom: 4,
  marginTop: 8,
}

/** @deprecated Prefer className="astra-input" */
export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--astra-space-2) var(--astra-space-3)",
  border: "1px solid var(--astra-border)",
  borderRadius: "var(--astra-radius-sm)",
  fontSize: "var(--astra-text-sm)",
  boxSizing: "border-box",
}

/** @deprecated Prefer className="astra-card" */
export const statusCardStyle: React.CSSProperties = {
  marginBottom: 12,
  background: "var(--astra-bg-card)",
  border: "1px solid var(--astra-border)",
  borderRadius: "var(--astra-radius-md)",
  padding: 10,
}

export const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: "var(--astra-text-xs)",
  color: "var(--astra-text-secondary)",
  marginBottom: 4,
}

export const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: "var(--astra-text-sm)",
  color: "var(--astra-text-primary)",
  marginBottom: 8,
}

export const warningStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: "var(--astra-text-xs)",
  color: "var(--astra-warning)",
  background: "var(--astra-warning-bg)",
  border: "1px solid var(--astra-warning-border)",
  borderRadius: "var(--astra-radius-sm)",
  padding: "8px 10px",
}
