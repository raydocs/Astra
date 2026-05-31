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
import { upsertOwnedPdfFromFileName, upsertOwnedPdfFromRemoteUrl } from "@/utils/storage/owned-reading"
import { classifyPdfTranslationQuality, type TranslationQualitySummary } from "@/utils/ocr/image-translation"
import { summarizeTranslationPathMarkers, type TranslationPathSummary } from "@/utils/providers/routing-metadata"
import { shouldShowDebugDiagnostics } from "@/utils/dev-diagnostics"
import {
  consumeDocumentFileHandoff,
  describeDocumentFileHandoffFailure,
  DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM,
  DOCUMENT_FILE_HANDOFF_QUERY_PARAM,
  readDocumentFileBytes,
  type DocumentFileHandoffFailureReason,
} from "@/utils/reading/document-file-handoff"
import { extractPdfPages, type PdfPage, type PdfTextBlock } from "./pdf-extractor"
import { translatePdfPage, type TranslatedBlock } from "./pdf-translator"
import { useAstraTheme } from "@/utils/ui/useAstraTheme"

type ReaderPhase = "idle" | "loading" | "translating" | "done" | "error"

interface PageState {
  page: PdfPage
  translations: TranslatedBlock[]
  pathSummary?: TranslationPathSummary
  phase: "pending" | "translating" | "done" | "error"
}

function coerceHandoffFailureReason(value: string | null): DocumentFileHandoffFailureReason | null {
  if (value === "invalid" || value === "missing" || value === "expired" || value === "oversize" || value === "corrupt" || value === "storage_error") {
    return value
  }
  return null
}

const PDF_TRANSLATABLE_TEXT_MIN_LENGTH = 5

function isTranslatablePdfBlock(block: PdfTextBlock): boolean {
  return block.text.length >= PDF_TRANSLATABLE_TEXT_MIN_LENGTH
}

function qualityTierAccent(summary: TranslationQualitySummary): { border: string, background: string, color: string } {
  if (summary.tier === "tier_1") return { border: "#bbf7d0", background: "#f0fdf4", color: "#166534" }
  if (summary.tier === "tier_2") return { border: "#c7d2fe", background: "#eef2ff", color: "#3730a3" }
  return { border: "#fed7aa", background: "#fff7ed", color: "#9a3412" }
}

function QualityTierCard({ summary }: { summary: TranslationQualitySummary }) {
  const accent = qualityTierAccent(summary)
  return (
    <section
      data-testid="pdf-reader-quality-tier-card"
      data-quality-tier={summary.tier}
      role="status"
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        fontSize: 13,
        color: accent.color,
        background: accent.background,
        borderRadius: 10,
        border: `1px solid ${accent.border}`,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>Quality Tier v1 · {summary.label}</div>
      <strong>{summary.headline}</strong>
      <div style={{ marginTop: 4 }}>{summary.details.join(" · ")}</div>
    </section>
  )
}

function PathMarkerCard({ summary }: { summary: TranslationPathSummary }) {
  return (
    <section
      data-testid="pdf-reader-path-marker-card"
      data-path-marker-version={summary.version}
      data-path-marker-kinds={summary.kinds.join(" ")}
      role="status"
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        fontSize: 13,
        color: "#075985",
        background: "#f0f9ff",
        borderRadius: 10,
        border: "1px solid #bae6fd",
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>Path used · Dual Path Marker v1</div>
      <strong>{summary.label}</strong>
      <div style={{ marginTop: 4 }}>{summary.details.join(" · ")}</div>
    </section>
  )
}

export function PdfReaderApp() {
  const { astraTheme, astraDirection } = useAstraTheme()
  const [phase, setPhase] = useState<ReaderPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pages, setPages] = useState<PageState[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [reopenBanner, setReopenBanner] = useState<string | null>(null)
  const loadGenRef = useRef(0)
  const beginLoadGeneration = useCallback(() => {
    loadGenRef.current += 1
    return loadGenRef.current
  }, [])
  const isCurrentLoad = useCallback((generation: number) => loadGenRef.current === generation, [])
  const qualitySummary = (phase === "translating" || phase === "done")
    ? classifyPdfTranslationQuality(pages.map((pageState) => {
        const translatableBlockIndexes = new Set(
          pageState.page.blocks.flatMap((block, index) => isTranslatablePdfBlock(block) ? [index] : []),
        )
        return {
          blockCount: translatableBlockIndexes.size,
          translatedCount: pageState.translations.filter((translation) => (
            translatableBlockIndexes.has(translation.sourceIndex)
            && translation.translation.trim().length > 0
          )).length,
          phase: pageState.phase,
        }
      }))
    : null
  const pathSummary = (phase === "translating" || phase === "done")
    ? summarizeTranslationPathMarkers(pages.flatMap((pageState) => pageState.pathSummary?.markers ?? []))
    : undefined
  // Check for URL parameter or local-file handoff on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hint = params.get("reopenHint")
    const handoffToken = params.get(DOCUMENT_FILE_HANDOFF_QUERY_PARAM)
    const handoffFailure = coerceHandoffFailureReason(params.get(DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM))

    if (handoffToken) {
      const handoffGeneration = beginLoadGeneration()
      void consumeDocumentFileHandoff(handoffToken, "pdf").then((result) => {
        if (!isCurrentLoad(handoffGeneration)) return
        if (result.ok) {
          setReopenBanner(`Opened ${result.file.name} from Document Intake local handoff. File bytes stayed on this device and were not synced.`)
          void loadFile(result.file, handoffGeneration)
          return
        }
        setReopenBanner(describeDocumentFileHandoffFailure(result.reason, hint))
      })
      return
    }

    if (handoffFailure) {
      setReopenBanner(describeDocumentFileHandoffFailure(handoffFailure, hint))
    } else if (hint) {
      setReopenBanner(decodeURIComponent(hint))
    }
    const pdfUrl = params.get("url")
    if (pdfUrl) {
      void loadPdfFromUrl(pdfUrl)
    }
  }, [])

  const loadPdfFromUrl = async (url: string) => {
    const generation = beginLoadGeneration()
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        if (!isCurrentLoad(generation)) return
        setPhase("error")
        setError("Only http and https PDF URLs are supported.")
        return
      }
      setPhase("loading")
      const displayName = url.split("/").pop() ?? "document.pdf"
      setFileName(displayName)
      const response = await fetch(url)
      if (!isCurrentLoad(generation)) return
      const arrayBuffer = await response.arrayBuffer()
      if (!isCurrentLoad(generation)) return
      await processPdf(new Uint8Array(arrayBuffer), { remoteUrl: url, displayName }, generation)
    } catch (err) {
      if (!isCurrentLoad(generation)) return
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to load PDF")
    }
  }

  const handleFileDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const file = event.dataTransfer.files[0]
    if (file?.type === "application/pdf") {
      void loadFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void loadFile(file)
  }, [])

  const loadFile = async (file: File, generation = beginLoadGeneration()) => {
    try {
      setPhase("loading")
      setFileName(file.name)
      const bytes = await readDocumentFileBytes(file)
      if (!isCurrentLoad(generation)) return
      await processPdf(bytes, { localFileName: file.name }, generation)
    } catch (err) {
      if (!isCurrentLoad(generation)) return
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to load PDF")
    }
  }

  const processPdf = async (
    data: Uint8Array,
    source: { remoteUrl: string; displayName: string } | { localFileName: string },
    generation: number,
  ) => {
    try {
      const pdfPages = await extractPdfPages(data)
      if (!isCurrentLoad(generation)) return
      const pageStates: PageState[] = pdfPages.map((page: PdfPage) => ({
        page,
        translations: [],
        phase: "pending",
      }))
      setPages(pageStates)
      setProgress({ current: 0, total: pdfPages.length })
      setPhase("translating")

      if ("remoteUrl" in source) {
        void upsertOwnedPdfFromRemoteUrl({
          url: source.remoteUrl,
          title: source.displayName,
          pageCount: pdfPages.length,
          status: "in_progress",
        })
      } else {
        void upsertOwnedPdfFromFileName({
          fileName: source.localFileName,
          pageCount: pdfPages.length,
          status: "in_progress",
        })
      }

      // Translate pages sequentially (abort if a new PDF is loaded)
      for (let i = 0; i < pdfPages.length; i++) {
        if (!isCurrentLoad(generation)) return
        setProgress({ current: i + 1, total: pdfPages.length })

        try {
          const translationResult = await translatePdfPage(pdfPages[i])
          if (!isCurrentLoad(generation)) return
          setPages((prev) => {
            if (!isCurrentLoad(generation)) return prev
            const next = [...prev]
            next[i] = {
              ...next[i],
              translations: translationResult.translations,
              pathSummary: translationResult.pathSummary,
              phase: "done",
            }
            return next
          })
        } catch {
          if (!isCurrentLoad(generation)) return
          setPages((prev) => {
            if (!isCurrentLoad(generation)) return prev
            const next = [...prev]
            next[i] = { ...next[i], phase: "error" }
            return next
          })
        }
      }

      if (!isCurrentLoad(generation)) return
      setPhase("done")
    } catch (err) {
      if (!isCurrentLoad(generation)) return
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to parse PDF")
    }
  }

  return (
    <div
      className="astra-container astra-container--wide"
      data-astra-theme={astraTheme}
      data-astra={astraDirection}
      style={containerStyle}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      <header className="astra-reader-page-header">
        <div className="astra-reader-page-header__brand">
          <span className="astra-reader-page-header__mark" aria-hidden="true">A</span>
          <h1 className="astra-reader-page-header__title">Astra PDF Reader</h1>
        </div>
        {fileName && <span className="astra-reader-page-header__file">{fileName}</span>}
        {phase === "translating" && (
          <span className="astra-reader-page-header__status">
            Translating page {progress.current}/{progress.total}…
          </span>
        )}
      </header>

      {reopenBanner && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            fontSize: 13,
            color: "#1e40af",
            background: "rgba(99, 102, 241, 0.12)",
            borderRadius: 8,
            border: "1px solid rgba(99, 102, 241, 0.35)",
          }}
        >
          {reopenBanner}
        </div>
      )}

      {qualitySummary && <QualityTierCard summary={qualitySummary} />}
      {pathSummary && shouldShowDebugDiagnostics() && <PathMarkerCard summary={pathSummary} />}

      {phase === "idle" && (
        <label
          htmlFor="astra-pdf-reader-file-input"
          className="astra-drop-zone-cursor astra-reader-drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
        >
          <input
            id="astra-pdf-reader-file-input"
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div className="astra-reader-drop-zone__content">
            <div className="astra-reader-drop-zone__icon" aria-hidden="true">PDF</div>
            <div className="astra-reader-drop-zone__eyebrow">Bilingual document reader</div>
            <div className="astra-reader-drop-zone__title">Drop a PDF file here</div>
            <div className="astra-reader-drop-zone__description">
              or click to select. Astra will extract text, translate each page, and show bilingual content side by side.
            </div>
            <div className="astra-reader-drop-zone__chips" aria-label="Supported file type">
              <span className="astra-reader-drop-zone__chip">PDF</span>
              <span className="astra-reader-drop-zone__chip">Local file</span>
            </div>
          </div>
        </label>
      )}

      {phase === "error" && (
        <div style={{ padding: 24, color: "#b45309", textAlign: "center" }}>
          {error}
        </div>
      )}

      {phase === "loading" && (
        <div role="status" aria-live="polite" style={{ padding: 24, textAlign: "center", color: "var(--astra-brand)" }}>
          Loading PDF...
        </div>
      )}

      {phase === "translating" && (
        <div
          role="progressbar"
          aria-label="PDF translation progress"
          aria-valuemin={0}
          aria-valuemax={progress.total || 1}
          aria-valuenow={progress.current}
          style={{
            height: 6,
            margin: "0 0 16px",
            overflow: "hidden",
            borderRadius: 999,
            background: "var(--astra-style-bg-elevated)",
            border: "1px solid var(--astra-style-line-1)",
          }}
        >
          <span
            style={{
              display: "block",
              width: `${progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0}%`,
              height: "100%",
              background: "var(--astra-style-accent-primary)",
            }}
          />
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
  margin: "0 auto",
  padding: 16,
}


const pagesContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
}

const pageStyle: React.CSSProperties = {
  border: "1px solid var(--astra-border)",
  borderRadius: "var(--astra-radius-md)",
  padding: "var(--astra-space-4)",
}

const pageHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--astra-text-decorative)",
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
  fontSize: "var(--astra-text-sm)",
  lineHeight: 1.6,
  color: "var(--astra-brand)",
  marginTop: 4,
  paddingLeft: 8,
  borderLeft: "2px solid var(--astra-brand)",
}

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--astra-text-hint)",
  marginTop: 4,
}
