import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { PdfReaderApp } from "./PdfReaderApp"

const container = document.getElementById("root")!
createRoot(container).render(<ErrorBoundary><PdfReaderApp /></ErrorBoundary>)
