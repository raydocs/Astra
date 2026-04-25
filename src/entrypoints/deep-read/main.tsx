import "@/utils/zod-config"
import React from "react"
import ReactDOM from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import DeepReadApp from "./DeepReadApp"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DeepReadApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
