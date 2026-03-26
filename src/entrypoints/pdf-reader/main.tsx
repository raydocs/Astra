import { createRoot } from "react-dom/client"
import { PdfReaderApp } from "./PdfReaderApp"

const container = document.getElementById("root")!
createRoot(container).render(<PdfReaderApp />)
