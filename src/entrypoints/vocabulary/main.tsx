import "@/utils/zod-config"
import React from "react"
import ReactDOM from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import VocabularyApp from "./VocabularyApp"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <VocabularyApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
