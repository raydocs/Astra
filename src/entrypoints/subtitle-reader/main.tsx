import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { SubtitleReaderApp } from "./SubtitleReaderApp"

const container = document.getElementById("root")!
createRoot(container).render(<ErrorBoundary><SubtitleReaderApp /></ErrorBoundary>)
