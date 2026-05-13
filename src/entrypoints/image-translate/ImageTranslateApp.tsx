import { useEffect, useRef, useState } from "react"
import { readConfig } from "@/utils/storage/config"
import { translateTexts } from "@/utils/translate/translate"
import type { TranslationPathSummary } from "@/utils/providers/routing-metadata"
import {
  consumeImageTranslateHandoff,
  IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM,
  type ImageTranslateHandoffRecord,
} from "./handoff"
import {
  IMAGE_TRANSLATION_MAX_FILE_BYTES,
  classifyImageTranslationQuality,
  extractTextFromImageFile,
  findImageFileInClipboardItems,
  planImageTranslationOverlayQuality,
  type ImageTranslationOcrBox,
  type ImageTranslationOcrFailureReason,
  type ImageTranslationOcrLine,
  type ImageTranslationOcrSuccess,
  type ImageTranslationOverlayQualityReason,
  type ImageTranslationOverlayQualitySummary,
  type TranslationQualitySummary,
} from "@/utils/ocr/image-translation"
import { useAstraTheme } from "@/utils/ui/useAstraTheme"

interface TranslationRow {
  sourceText: string
  translatedText: string
  bbox?: ImageTranslationOcrBox
  confidence?: number
  overlayReason: ImageTranslationOverlayQualityReason
  renderInOverlay: boolean
}

interface TranslationView {
  fileName: string
  sourceText: string
  translatedText: string
  targetLang: string
  lineCount: number
  rows: TranslationRow[]
  overlayQualitySummary: ImageTranslationOverlayQualitySummary
  qualitySummary: TranslationQualitySummary
  translationPathSummary?: TranslationPathSummary
}

type HandoffFailureReason = "handoff_invalid" | "handoff_fetch_failed"
type PagePhase = "idle" | "loading_handoff" | "extracting" | "translating" | "done" | "error"
type PreviewMode = "original" | "overlay" | "compare"

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--astra-style-bg-page)",
  color: "var(--astra-style-ink-1)",
  fontFamily: "var(--astra-font)",
  padding: "32px 28px 56px",
  boxSizing: "border-box",
}

const panelStyle: React.CSSProperties = {
  background: "var(--astra-style-bg-surface)",
  border: "1px solid var(--astra-style-line-1)",
  borderRadius: "var(--astra-radius-lg)",
  boxShadow: "none",
}

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "var(--astra-radius-md)",
  background: "var(--astra-style-ink-1)",
  color: "var(--astra-style-bg-page)",
  fontWeight: 500,
  fontSize: 13,
  letterSpacing: "-0.005em",
  padding: "10px 18px",
  cursor: "pointer",
}

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid var(--astra-brand-border)",
  borderRadius: 999,
  background: "var(--astra-bg-elevated)",
  color: "var(--astra-brand)",
  fontWeight: 700,
  padding: "8px 12px",
  cursor: "pointer",
}

function buildRows(
  lines: ImageTranslationOcrLine[],
  translations: string[],
  source: ImageTranslationOcrSuccess["source"],
): { rows: TranslationRow[], summary: ImageTranslationOverlayQualitySummary, qualitySummary: TranslationQualitySummary } {
  const plan = planImageTranslationOverlayQuality(lines.map((line, index) => ({
    sourceText: line.text,
    translatedText: translations[index]?.trim() || "",
    ...(line.bbox ? { bbox: line.bbox } : {}),
    ...(typeof line.confidence === "number" ? { confidence: line.confidence } : {}),
  })))

  return {
    rows: plan.rows,
    summary: plan.summary,
    qualitySummary: classifyImageTranslationQuality({
      source,
      overlaySummary: plan.summary,
    }),
  }
}

function inferImageTypeFromUrl(url: string): string {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  })()

  if (pathname.endsWith(".svg")) return "image/svg+xml"
  if (pathname.endsWith(".png")) return "image/png"
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg"
  if (pathname.endsWith(".webp")) return "image/webp"
  if (pathname.endsWith(".gif")) return "image/gif"
  if (pathname.endsWith(".bmp")) return "image/bmp"
  return "image/png"
}

function buildHandoffFileName(handoff: ImageTranslateHandoffRecord, imageType: string): string {
  const extension = imageType === "image/svg+xml"
    ? "svg"
    : imageType.startsWith("image/")
      ? imageType.slice("image/".length).replace(/[^a-z0-9]+/gi, "") || "png"
      : "png"
  const sourceName = (() => {
    try {
      const pathname = new URL(handoff.imageUrl).pathname
      return decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "")
    } catch {
      return ""
    }
  })()
  return sourceName || `astra-context-menu-image.${extension}`
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = /^data:([^;,]+)((?:;[^,]*)?),(.*)$/s.exec(dataUrl)
  if (!match) {
    throw new Error("Captured handoff payload was not a valid data URL.")
  }

  const mimeType = match[1]?.trim().toLowerCase() || "application/octet-stream"
  const metadata = match[2]?.toLowerCase() ?? ""
  const payload = match[3] ?? ""
  if (!mimeType.startsWith("image/")) {
    throw new Error("Captured handoff payload was not an image.")
  }

  if (metadata.includes(";base64")) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return { bytes, mimeType }
  }

  const decoded = decodeURIComponent(payload)
  return { bytes: new TextEncoder().encode(decoded), mimeType }
}

function loadCapturedHandoffImageFile(handoff: ImageTranslateHandoffRecord): File | null {
  const captured = handoff.captured
  if (!captured) return null

  const { bytes, mimeType } = decodeDataUrl(captured.dataUrl)
  if (bytes.byteLength <= 0 || bytes.byteLength > IMAGE_TRANSLATION_MAX_FILE_BYTES) {
    throw new Error("Captured handoff image is too large.")
  }
  const fileName = captured.fileName?.trim() || buildHandoffFileName(handoff, captured.mimeType || mimeType)
  const blobPart = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new File([blobPart], fileName, { type: captured.mimeType || mimeType })
}

async function loadHandoffImageFile(handoff: ImageTranslateHandoffRecord): Promise<File> {
  try {
    const capturedFile = loadCapturedHandoffImageFile(handoff)
    if (capturedFile) return capturedFile
  } catch {
    // Fall back to the original URL fetch below; manual upload/paste remains the final UX fallback.
  }

  const response = await fetch(handoff.imageUrl, {
    cache: "force-cache",
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Image request failed with HTTP ${response.status}.`)
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10)
  if (Number.isFinite(contentLength) && contentLength > IMAGE_TRANSLATION_MAX_FILE_BYTES) {
    throw new Error("Fetched handoff image is too large.")
  }

  const blob = await response.blob()
  const responseType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  const imageType = blob.type || (responseType?.startsWith("image/") ? responseType : inferImageTypeFromUrl(handoff.imageUrl))
  if (blob.size > IMAGE_TRANSLATION_MAX_FILE_BYTES) {
    throw new Error("Fetched handoff image is too large.")
  }

  if (!imageType.startsWith("image/") || blob.size === 0) {
    throw new Error("Fetched handoff payload was not a decodable image.")
  }

  return new File([blob], buildHandoffFileName(handoff, imageType), { type: imageType })
}

const overlayReasonLabels: Record<ImageTranslationOverlayQualityReason, string> = {
  missing_bbox: "No OCR box",
  invalid_bbox: "Unsafe OCR box",
  low_confidence: "Low OCR confidence",
  collision_risk: "Overlaps another row",
  missing_translation: "Missing translation",
  renderable: "Overlay safe",
}

function OverlayReasonBadge({ reason }: { reason: ImageTranslationOverlayQualityReason }) {
  return (
    <span
      data-testid={`image-translation-overlay-reason-${reason}`}
      style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, background: reason === "renderable" ? "var(--astra-success-bg)" : "var(--astra-warning-bg)", color: reason === "renderable" ? "var(--astra-success)" : "var(--astra-warning)", fontSize: 11, fontWeight: 800, padding: "3px 8px" }}
    >
      {overlayReasonLabels[reason]}
    </span>
  )
}

function OverlayQualitySummary({ summary }: { summary: ImageTranslationOverlayQualitySummary }) {
  const fallbackReasons = (Object.entries(summary.reasons) as [ImageTranslationOverlayQualityReason, number][])
    .filter(([reason, count]) => reason !== "renderable" && count > 0)
    .map(([reason, count]) => `${overlayReasonLabels[reason]}: ${count}`)

  return (
    <article data-testid="image-translation-overlay-quality-summary" style={{ ...panelStyle, padding: 14, color: "var(--astra-text-primary)", lineHeight: 1.45 }}>
      <strong>Overlay quality gate:</strong> {summary.renderable}/{summary.total} row(s) safe for approximate overlay; {summary.fallback} row(s) kept in compare fallback.
      {fallbackReasons.length ? <div style={{ marginTop: 6, color: "var(--astra-text-secondary)", fontSize: 12 }}>{fallbackReasons.join(" · ")}</div> : null}
    </article>
  )
}

function qualityTierAccent(summary: TranslationQualitySummary): { border: string, background: string, color: string } {
  if (summary.tier === "tier_1") return { border: "var(--astra-success-border)", background: "var(--astra-success-bg)", color: "var(--astra-success)" }
  if (summary.tier === "tier_2") return { border: "var(--astra-warning-border)", background: "var(--astra-warning-bg)", color: "var(--astra-warning)" }
  return { border: "var(--astra-danger-border)", background: "var(--astra-danger-bg)", color: "var(--astra-danger)" }
}

function QualityTierCard({ summary }: { summary: TranslationQualitySummary }) {
  const accent = qualityTierAccent(summary)
  return (
    <article
      data-testid="image-translation-quality-tier-card"
      data-quality-tier={summary.tier}
      style={{ ...panelStyle, padding: 14, borderColor: accent.border, background: accent.background, color: accent.color, lineHeight: 1.45 }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>Quality Tier v1 · {summary.label}</div>
      <strong>{summary.headline}</strong>
      <div style={{ marginTop: 6, fontSize: 12 }}>{summary.details.join(" · ")}</div>
    </article>
  )
}

function PathMarkerCard({ summary }: { summary: TranslationPathSummary }) {
  return (
    <article
      data-testid="image-translation-path-marker-card"
      data-path-marker-version={summary.version}
      data-path-marker-kinds={summary.kinds.join(" ")}
      style={{ ...panelStyle, padding: 14, borderColor: "var(--astra-info-border)", background: "var(--astra-info-bg)", color: "var(--astra-info)", lineHeight: 1.45 }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>Path used · Dual Path Marker v1</div>
      <strong>{summary.label}</strong>
      <div style={{ marginTop: 6, fontSize: 12 }}>{summary.details.join(" · ")}</div>
    </article>
  )
}

function CompareRows({ rows, showReasons = false }: { rows: TranslationRow[], showReasons?: boolean }) {
  return (
    <article data-testid="image-translation-compare-panel" style={{ ...panelStyle, padding: 16 }}>
      <h2 style={{ marginTop: 0, color: "var(--astra-text-primary)", fontSize: 18 }}>Compare rows</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={`${row.sourceText}-${index}`}
            style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, padding: 10, border: "1px solid var(--astra-border)", borderRadius: 12, background: "var(--astra-bg-sunken)" }}
          >
            <div>
              <div style={{ color: "var(--astra-text-secondary)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>OCR source</div>
              {showReasons ? <OverlayReasonBadge reason={row.overlayReason} /> : null}
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, marginTop: showReasons ? 6 : 0 }}>{row.sourceText}</div>
            </div>
            <div>
              <div style={{ color: "var(--astra-text-secondary)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>Translation</div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{row.translatedText}</div>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

export function ImageTranslateApp() {
  const { astraTheme, astraDirection } = useAstraTheme()
  const [targetLang, setTargetLang] = useState("zh-CN")
  const [phase, setPhase] = useState<PagePhase>("idle")
  const [previewMode, setPreviewMode] = useState<PreviewMode>("overlay")
  const [errorReason, setErrorReason] = useState<ImageTranslationOcrFailureReason | "translation_failed" | HandoffFailureReason | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [translation, setTranslation] = useState<TranslationView | null>(null)
  const [selectedFileName, setSelectedFileName] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void readConfig().then((config) => setTargetLang(config.targetLang)).catch(() => undefined)
  }, [])

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const setNextPreview = (file: File) => {
    setSelectedFileName(file.name || "Pasted image")
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    if (typeof URL.createObjectURL === "function") {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }

  const processFile = async (file: File, targetLangOverride = targetLang) => {
    setNextPreview(file)
    setTranslation(null)
    setPreviewMode("overlay")
    setErrorReason(null)
    setErrorMessage("")
    setPhase("extracting")

    const extraction = await extractTextFromImageFile(file)
    if (!extraction.ok) {
      setPhase("error")
      setErrorReason(extraction.reason)
      setErrorMessage(extraction.message)
      return
    }

    setPhase("translating")
    const sourceLines = extraction.lines.length ? extraction.lines : extraction.text.split("\n").map((line) => ({ text: line }))
    const translated = await translateTexts({
      texts: sourceLines.map((line) => line.text),
      targetLang: targetLangOverride,
      task: "translate",
      context: {
        selectionContext: extraction.text,
      },
    })

    if (!translated.ok) {
      setPhase("error")
      setErrorReason("translation_failed")
      setErrorMessage(translated.error.message)
      return
    }

    const planned = buildRows(sourceLines, translated.translations, extraction.source)
    setTranslation({
      fileName: file.name || "Pasted image",
      sourceText: extraction.text,
      translatedText: planned.rows.map((row) => row.translatedText).join("\n"),
      targetLang: targetLangOverride,
      lineCount: planned.rows.length,
      rows: planned.rows,
      overlayQualitySummary: planned.summary,
      qualitySummary: planned.qualitySummary,
      translationPathSummary: translated.pathSummary,
    })
    setPhase("done")
  }

  useEffect(() => {
    const handoffToken = new URLSearchParams(window.location.search).get(IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM)
    if (!handoffToken) return

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete(IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM)
    window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)

    let cancelled = false
    void (async () => {
      setTranslation(null)
      setErrorReason(null)
      setErrorMessage("")
      setSelectedFileName("Loading image from context menu…")
      setPhase("loading_handoff")

      const config = await readConfig().catch(() => null)
      const handoffTargetLang = config?.targetLang ?? targetLang
      if (config?.targetLang) setTargetLang(config.targetLang)

      const handoff = await consumeImageTranslateHandoff(handoffToken)
      if (cancelled) return

      if (!handoff.ok) {
        setPhase("error")
        setErrorReason("handoff_invalid")
        setSelectedFileName("")
        setErrorMessage("This image handoff link expired or could not be found. Right-click the image again, or upload/paste it here instead.")
        return
      }

      try {
        const file = await loadHandoffImageFile(handoff.handoff)
        if (!cancelled) await processFile(file, handoffTargetLang)
      } catch {
        if (cancelled) return
        setPhase("error")
        setErrorReason("handoff_fetch_failed")
        setSelectedFileName("")
        setErrorMessage("Astra could not preload this image from the page. The site may require a session, block extension fetches, or return a non-image payload. Upload or paste the image here instead.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void processFile(file)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = findImageFileInClipboardItems(event.clipboardData.items)
    if (!file) return
    event.preventDefault()
    void processFile(file)
  }

  const busy = phase === "extracting" || phase === "translating"
  const overlayRows = translation?.rows.filter((row) => row.renderInOverlay) ?? []
  const fallbackRows = translation?.rows.filter((row) => !row.renderInOverlay) ?? []

  const renderImagePreview = (withOverlay: boolean) => (
    <div style={{ ...panelStyle, padding: 16 }}>
      <h2 style={{ marginTop: 0, color: "var(--astra-text-primary)", fontSize: 18 }}>{withOverlay ? "Translated overlay preview" : "Original image"}</h2>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, border: "1px solid var(--astra-border-strong)", background: "var(--astra-bg-sunken)" }}>
        {previewUrl ? <img src={previewUrl} alt={translation?.fileName ?? selectedFileName} style={{ display: "block", width: "100%", maxWidth: "100%" }} /> : null}
        {withOverlay ? overlayRows.map((row, index) => row.bbox ? (
          <div
            data-testid="image-translation-overlay-box"
            // eslint-disable-next-line react/no-array-index-key
            key={`${row.sourceText}-${index}`}
            title={row.sourceText}
            style={{
              position: "absolute",
              left: `${row.bbox.left}%`,
              top: `${row.bbox.top}%`,
              width: `${row.bbox.width}%`,
              minHeight: `${Math.max(row.bbox.height, 7)}%`,
              boxSizing: "border-box",
              padding: "3px 5px",
              border: "1px solid var(--astra-brand-border)",
              borderRadius: 6,
              background: "var(--astra-brand-muted)",
              color: "var(--astra-text-primary)",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.15,
              overflow: "hidden",
            }}
          >
            {row.translatedText}
          </div>
        ) : null) : null}
      </div>
      <p style={{ color: "var(--astra-text-muted)", fontSize: 12 }}>{translation?.fileName ?? selectedFileName} {translation ? `· ${translation.lineCount} extracted line(s)` : ""}</p>
      {withOverlay ? (
        <p style={{ marginBottom: 0, color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.45 }}>
          Translated overlay is approximate: OCR boxes and font sizing are best-effort and may not match the original layout. Risky rows stay in compare fallback.
        </p>
      ) : null}
    </div>
  )

  return (
    <main style={shellStyle} data-testid="image-translation-beta-page" data-astra-theme={astraTheme} data-astra={astraDirection}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <header className="astra-reader-page-header astra-reader-page-header--stacked">
          <div className="astra-reader-page-header__brand">
            <span className="astra-reader-page-header__mark" aria-hidden="true">A</span>
            <h1 className="astra-reader-page-header__title">Image / OCR Translation</h1>
          </div>
          <span className="astra-reader-page-header__status">Astra Labs · Beta</span>
        </header>
        <p className="astra-reader-page-header__lede">
          Upload or paste an image, extract readable text, then translate it through Astra’s existing translation pipeline.
          The translated overlay preview is approximate; compare rows remain available as the reliable fallback.
        </p>

        <div
          data-testid="image-translation-dropzone"
          onPaste={handlePaste}
          tabIndex={0}
          className="astra-drop-zone-cursor astra-reader-drop-zone"
          style={{ marginBottom: 16, outline: "none" }}
        >
          <input
            ref={fileInputRef}
            id="astra-image-translation-file-input"
            data-testid="image-translation-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml"
            onChange={handleInputChange}
            style={{ display: "none" }}
          />
          <div className="astra-reader-drop-zone__content">
            <div className="astra-reader-drop-zone__eyebrow">Image translation</div>
            <div className="astra-reader-drop-zone__title">Upload or paste an image</div>
            <div className="astra-reader-drop-zone__description">
              PNG, JPEG, WebP, GIF, BMP, and SVG are accepted. Raster OCR depends on the browser&rsquo;s TextDetector;
              SVG text is extracted directly for a deterministic first slice.
            </div>
            <button
              type="button"
              style={{ ...buttonStyle, opacity: busy ? 0.72 : 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "Working…" : "Choose image"}
            </button>
            <label htmlFor="astra-image-translation-file-input" className="astra-sr-only">Choose image for Astra OCR translation</label>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--astra-style-ink-3)", fontFamily: "var(--astra-style-font-mono, JetBrains Mono, monospace)", letterSpacing: "0.04em" }}>
              Target language: <strong style={{ color: "var(--astra-style-ink-1)" }}>{targetLang}</strong>
              {selectedFileName ? ` · ${selectedFileName}` : ""}
            </div>
          </div>
        </div>

        {phase !== "idle" && (
          <section style={{ ...panelStyle, padding: 18, marginBottom: 16 }} aria-live="polite">
            <strong>Status:</strong>{" "}
            {phase === "loading_handoff" ? "Loading image from context menu…" : phase === "extracting" ? "Extracting OCR text…" : phase === "translating" ? "Translating extracted text…" : phase === "done" ? "Translation ready." : "Needs attention."}
          </section>
        )}

        {phase === "error" && (
          <section data-testid="image-translation-error" style={{ ...panelStyle, padding: 18, borderColor: "var(--astra-warning-border)", background: "var(--astra-warning-bg)" }}>
            <h2 style={{ margin: "0 0 8px", color: "var(--astra-text-primary)", fontSize: 18 }}>Image translation could not continue</h2>
            <div style={{ color: "var(--astra-warning)", fontWeight: 700 }}>Reason: {errorReason}</div>
            <p style={{ marginBottom: 0, color: "var(--astra-text-secondary)" }}>{errorMessage}</p>
          </section>
        )}

        {translation && (
          <section data-testid="image-translation-result-panel" style={{ display: "grid", gap: 16 }}>
            <QualityTierCard summary={translation.qualitySummary} />
            {translation.translationPathSummary && <PathMarkerCard summary={translation.translationPathSummary} />}
            <OverlayQualitySummary summary={translation.overlayQualitySummary} />
            <div role="group" aria-label="Image translation display mode" style={{ ...panelStyle, padding: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <strong style={{ color: "var(--astra-text-primary)" }}>View:</strong>
              {([
                ["original", "Original"],
                ["overlay", "Translated overlay"],
                ["compare", "Compare rows"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`image-translation-mode-${mode}`}
                  style={previewMode === mode ? buttonStyle : ghostButtonStyle}
                  onClick={() => setPreviewMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            {previewMode === "compare" ? (
              <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 16 }}>
                {renderImagePreview(false)}
                <CompareRows rows={translation.rows} showReasons />
              </section>
            ) : (
              <section style={{ display: "grid", gridTemplateColumns: previewMode === "overlay" && fallbackRows.length ? "minmax(0, 0.9fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 16 }}>
                {renderImagePreview(previewMode === "overlay")}
                {previewMode === "overlay" && fallbackRows.length ? (
                  <article data-testid="image-translation-overlay-fallback-rows" style={{ display: "grid", gap: 10 }}>
                    <div style={{ ...panelStyle, padding: 14, color: "var(--astra-text-primary)", lineHeight: 1.45 }}>
                      Some OCR rows were not safe enough for approximate overlay placement, so they stay in compare fallback with reason badges.
                    </div>
                    <CompareRows rows={fallbackRows} showReasons />
                  </article>
                ) : null}
              </section>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
