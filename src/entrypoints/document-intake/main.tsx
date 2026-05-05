import "@/utils/zod-config"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import DocumentIntakeApp from "./DocumentIntakeApp"

const container = document.getElementById("root")!
createRoot(container).render(<ErrorBoundary><DocumentIntakeApp /></ErrorBoundary>)
