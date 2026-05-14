import "@/utils/zod-config"
import "@/assets/astra-extension.css"
import React from "react"
import ReactDOM from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import PrimitiveGalleryApp from "./PrimitiveGalleryApp"
import "./primitive-gallery.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PrimitiveGalleryApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
