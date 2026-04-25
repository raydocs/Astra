import type React from "react"

export const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "linear-gradient(135deg, #9a3412 0%, #ea580c 52%, #fb923c 100%)",
  color: "#fff7ed",
  border: "1px solid #c2410c",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
}

export const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
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
  color: "#7c2d12",
  marginBottom: 4,
  marginTop: 8,
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #fed7aa",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
}

export const statusCardStyle: React.CSSProperties = {
  marginBottom: 12,
  background: "#fffaf3",
  border: "1px solid #fed7aa",
  borderRadius: 8,
  padding: 10,
}

export const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  color: "#7c2d12",
  marginBottom: 4,
}

export const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#7c2d12",
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
