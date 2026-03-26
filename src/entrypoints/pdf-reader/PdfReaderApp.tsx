/**
 * Astra PDF Reader — bilingual PDF translation.
 *
 * Opens PDF files, extracts text blocks page-by-page using pdf.js,
 * translates them, and renders bilingual side-by-side view.
 *
 * Usage: chrome-extension://<id>/pdf-reader/index.html?url=<pdf-url>
 *        or drag-and-drop a local PDF file.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { extractPdfPages, type PdfPage } from "./pdf-extractor"
import { translatePdfPage, type TranslatedBlock } from "./pdf-translator"

type ReaderPhase = "idle" | "loading" | "translating" | "done" | "error"

interface PageState {
  page: PdfPage
  translations: TranslatedBlock[]
  phase: "pending" | "translating" | "done" | "error"
}

export function PdfReaderApp() {
  const [phase, setPhase] = useState<ReaderPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pages, setPages] = useState<PageState[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadGenRef = useRef(0)

  // Check for URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pdfUrl = params.get("url")
    if (pdfUrl) {
      void loadPdfFromUrl(pdfUrl)
    }
  }, [])

  const loadPdfFromUrl = async (url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        setPhase("error")
        setError("Only http and https PDF URLs are supported.")
        return
      }
      setPhase("loading")
      setFileName(url.split("/").pop() ?? "document.pdf")
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      await processPdf(new Uint8Array(arrayBuffer))
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to load PDF")
    }
  }

  const handleFileDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file?.type === "application/pdf") {
      void loadFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void loadFile(file)
  }, [])

  const loadFile = async (file: File) => {
    setPhase("loading")
    setFileName(file.name)
    const arrayBuffer = await file.arrayBuffer()
    await processPdf(new Uint8Array(arrayBuffer))
  }

  const processPdf = async (data: Uint8Array) => {
    try {
      loadGenRef.current += 1
      const gen = loadGenRef.current

      const pdfPages = await extractPdfPages(data)
      const pageStates: PageState[] = pdfPages.map((page: PdfPage) => ({
        page,
        translations: [],
        phase: "pending",
      }))
      setPages(pageStates)
      setProgress({ current: 0, total: pdfPages.length })
      setPhase("translating")

      // Translate pages sequentially (abort if a new PDF is loaded)
      for (let i = 0; i < pdfPages.length; i++) {
        if (loadGenRef.current !== gen) return
        setProgress({ current: i + 1, total: pdfPages.length })

        try {
          const translations = await translatePdfPage(pdfPages[i])
          setPages((prev) => {
            const next = [...prev]
            next[i] = { ...next[i], translations, phase: "done" }
            return next
          })
        } catch {
          setPages((prev) => {
            const next = [...prev]
            next[i] = { ...next[i], phase: "error" }
            return next
          })
        }
      }

      setPhase("done")
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to parse PDF")
    }
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 18, color: "#6366f1" }}>Astra PDF Reader</h1>
        {fileName && <span style={{ fontSize: 13, color: "#64748b" }}>{fileName}</span>}
        {phase === "translating" && (
          <span style={{ fontSize: 12, color: "#6366f1" }}>
            Translating page {progress.current}/{progress.total}...
          </span>
        )}
      </header>

      {phase === "idle" && (
        <div
          style={dropZoneStyle}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 48, marginBottom: 16 }}>PDF</div>
          <div style={{ fontSize: 16, color: "#334155" }}>
            Drop a PDF file here or click to select
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
            Astra will extract text, translate it, and display bilingual content
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ padding: 24, color: "#b45309", textAlign: "center" }}>
          {error}
        </div>
      )}

      {phase === "loading" && (
        <div style={{ padding: 24, textAlign: "center", color: "#6366f1" }}>
          Loading PDF...
        </div>
      )}

      {(phase === "translating" || phase === "done") && (
        <div style={pagesContainerStyle}>
          {pages.map((pageState, index) => (
            <div key={index} style={pageStyle}>
              <div style={pageHeaderStyle}>Page {index + 1}</div>
              {pageState.page.blocks.map((block, bi) => {
                const translation = pageState.translations.find(
                  (t) => t.sourceIndex === bi,
                )
                return (
                  <div key={bi} style={blockStyle}>
                    <div style={sourceTextStyle}>{block.text}</div>
                    {translation ? (
                      <div style={translationTextStyle}>{translation.translation}</div>
                    ) : pageState.phase === "translating" ? (
                      <div style={loadingStyle}>...</div>
                    ) : null}
                  </div>
                )
              })}
              {pageState.phase === "error" && (
                <div style={{ color: "#b45309", fontSize: 13, padding: 8 }}>
                  Translation failed for this page
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  maxWidth: 800,
  margin: "0 auto",
  padding: 16,
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #e2e8f0",
  marginBottom: 16,
}

const dropZoneStyle: React.CSSProperties = {
  border: "2px dashed #cbd5e1",
  borderRadius: 12,
  padding: "64px 24px",
  textAlign: "center",
  cursor: "pointer",
  transition: "border-color 0.2s",
}

const pagesContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
}

const pageStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
}

const pageHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 12,
  fontWeight: 600,
}

const blockStyle: React.CSSProperties = {
  marginBottom: 12,
  paddingBottom: 12,
  borderBottom: "1px solid #f1f5f9",
}

const sourceTextStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "#1e293b",
}

const translationTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: "#6366f1",
  marginTop: 4,
  paddingLeft: 8,
  borderLeft: "2px solid #6366f1",
}

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
  marginTop: 4,
}
