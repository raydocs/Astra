import "@/utils/zod-config"
import "@/assets/astra-extension.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { browser } from "#imports"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import App from "./App"

function PopupErrorFallback() {
  return (
    <div style={{ padding: 16, color: "var(--astra-text-primary, #111827)", fontSize: 13, minWidth: 320 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Astra popup hit an error.</div>
      <div style={{ color: "var(--astra-text-muted, #64748b)", fontSize: 12, lineHeight: 1.45 }}>
        Reload the popup to try again, or open settings if you need to adjust provider or site configuration.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
        >
          Reload popup
        </button>
        <button
          type="button"
          onClick={() => { void browser.runtime.openOptionsPage() }}
          style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
        >
          Open settings
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<PopupErrorFallback />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
