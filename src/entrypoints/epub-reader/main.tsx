import { createRoot } from "react-dom/client"
import { EpubReaderApp } from "./EpubReaderApp"

const container = document.getElementById("root")!
createRoot(container).render(<EpubReaderApp />)
