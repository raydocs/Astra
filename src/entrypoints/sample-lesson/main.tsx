import "@/utils/zod-config"
import "@/assets/astra-extension.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import SampleLessonApp from "./SampleLessonApp"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SampleLessonApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
