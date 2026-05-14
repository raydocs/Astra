import "@/utils/zod-config"
import { StrictMode } from "react"
import ReactDOM from "react-dom/client"

import { AstraWebApp } from "./app"
import "./styles.css"

if (!document.documentElement.dataset.astraTheme) {
  document.documentElement.dataset.astraTheme = "light"
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AstraWebApp />
  </StrictMode>,
)
