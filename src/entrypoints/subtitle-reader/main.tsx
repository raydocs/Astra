import { createRoot } from "react-dom/client"
import { SubtitleReaderApp } from "./SubtitleReaderApp"

const container = document.getElementById("root")!
createRoot(container).render(<SubtitleReaderApp />)
