/**
 * Detects when the browser opens a PDF and shows a banner
 * offering to open it in Astra PDF Reader.
 */

import { browser } from "#imports"

const BANNER_ID = "astra-pdf-banner"

function isPdfPage(): boolean {
  // Check URL extension
  if (window.location.pathname.toLowerCase().endsWith(".pdf")) return true

  // Check for Chrome's built-in PDF viewer embed
  const embed = document.querySelector('embed[type="application/pdf"]')
  if (embed) return true

  // Check content-type via meta or document type
  const contentType = document.contentType
  if (contentType === "application/pdf") return true

  return false
}

function getReaderUrl(): string {
  const pdfUrl = window.location.href
  return `${browser.runtime.getURL("/pdf-reader/index.html" as "/popup.html")}?url=${encodeURIComponent(pdfUrl)}`
}

function createBanner(): HTMLDivElement {
  const banner = document.createElement("div")
  banner.id = BANNER_ID
  Object.assign(banner.style, {
    position: "fixed",
    top: "8px",
    right: "8px",
    zIndex: "2147483647",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    fontSize: "13px",
    color: "#334155",
    maxWidth: "360px",
  })

  const icon = document.createElement("span")
  icon.textContent = "PDF"
  Object.assign(icon.style, {
    background: "#6366f1",
    color: "#fff",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "11px",
    fontWeight: "700",
    flexShrink: "0",
  })

  const text = document.createElement("span")
  text.textContent = "Open in Astra Reader for bilingual translation"
  text.style.flex = "1"

  const openBtn = document.createElement("button")
  openBtn.textContent = "Open"
  Object.assign(openBtn.style, {
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: "0",
  })
  openBtn.addEventListener("click", () => {
    window.open(getReaderUrl(), "_blank")
    banner.remove()
  })

  const dismissBtn = document.createElement("button")
  dismissBtn.textContent = "\u00d7"
  Object.assign(dismissBtn.style, {
    background: "transparent",
    border: "none",
    color: "var(--astra-text-hint)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: "1",
    flexShrink: "0",
  })
  dismissBtn.addEventListener("click", () => banner.remove())

  banner.appendChild(icon)
  banner.appendChild(text)
  banner.appendChild(openBtn)
  banner.appendChild(dismissBtn)

  return banner
}

export function detectAndShowPdfBanner(): void {
  // Don't show if already showing or if we're already in the reader
  if (document.getElementById(BANNER_ID)) return
  if (window.location.href.includes("pdf-reader/index.html")) return

  if (isPdfPage()) {
    // Small delay to let the page render first
    setTimeout(() => {
      if (!document.getElementById(BANNER_ID)) {
        document.documentElement.appendChild(createBanner())
      }
    }, 500)
  }
}
