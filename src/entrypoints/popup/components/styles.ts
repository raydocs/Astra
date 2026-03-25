import type React from "react"

export const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
}

export const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
}

export const btnDisabled: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
}

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#64748b",
  marginBottom: 4,
  marginTop: 8,
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e2e8f0",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
}

export const statusCardStyle: React.CSSProperties = {
  marginBottom: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
}

export const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  color: "#334155",
  marginBottom: 4,
}

export const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#334155",
  marginBottom: 8,
}

export const warningStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: "#b45309",
  background: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: 6,
  padding: "8px 10px",
}
