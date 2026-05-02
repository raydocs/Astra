import "@/utils/zod-config"
import "@/assets/astra-extension.css"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { ImageTranslateApp } from "./ImageTranslateApp"

const container = document.getElementById("root")!
createRoot(container).render(<ErrorBoundary><ImageTranslateApp /></ErrorBoundary>)
