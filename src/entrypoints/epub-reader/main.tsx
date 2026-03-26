import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { EpubReaderApp } from "./EpubReaderApp"

const container = document.getElementById("root")!
createRoot(container).render(<ErrorBoundary><EpubReaderApp /></ErrorBoundary>)
