import React from "react"
import ReactDOM from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import OptionsApp from "./OptionsApp"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <OptionsApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
