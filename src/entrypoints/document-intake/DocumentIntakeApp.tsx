import { useCallback, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import { t } from "@/utils/i18n"
import {
  buildOwnedReadingResumeTarget,
  describeOwnedReadingResumeBehavior,
  listOwnedReadingItems,
  upsertOwnedEpubFromImport,
  upsertOwnedPdfFromFileName,
  upsertOwnedSubtitleFileFromImport,
  type OwnedReadingItem,
} from "@/utils/storage/owned-reading"
import {
  createDocumentFileHandoff,
  describeDocumentFileHandoffFailure,
  DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM,
  DOCUMENT_FILE_HANDOFF_QUERY_PARAM,
  type DocumentFileHandoffKind,
  type DocumentFileHandoffFailureReason,
} from "@/utils/reading/document-file-handoff"
import {
  buildDocumentIntakeReopenHint,
  detectDocumentIntakeFileKind,
  documentIntakeAcceptList,
  type DocumentIntakeDetection,
} from "./file-kind"
import { useAstraTheme } from "@/utils/ui/useAstraTheme"

type IntakePhase = "idle" | "saving" | "ready" | "error"

interface IntakeResult {
  fileName: string
  detection: DocumentIntakeDetection
  item: OwnedReadingItem
  readerUrl: string
  handoffStatus: "ready" | "manual"
  handoffReason?: DocumentFileHandoffFailureReason
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Untitled"
}

async function upsertOwnedReadingForIntake(file: File, detection: DocumentIntakeDetection): Promise<OwnedReadingItem> {
  if (detection.kind === "pdf") {
    return upsertOwnedPdfFromFileName({
      fileName: file.name,
      status: "in_progress",
    })
  }

  if (detection.kind === "epub") {
    return upsertOwnedEpubFromImport({
      fileName: file.name,
      bookTitle: stripExtension(file.name),
      chapterHref: null,
      status: "in_progress",
    })
  }

  return upsertOwnedSubtitleFileFromImport({
    fileName: file.name,
    formatLabel: detection.label,
    cueOrEntryCount: 0,
    status: "in_progress",
  })
}

function documentHandoffKindForDetection(detection: DocumentIntakeDetection): DocumentFileHandoffKind {
  if (detection.kind === "pdf") return "pdf"
  if (detection.kind === "epub") return "epub"
  return "subtitle"
}

function buildReaderUrl(
  detection: DocumentIntakeDetection,
  hint: string,
  handoff: { token?: string; failureReason?: DocumentFileHandoffFailureReason },
): string {
  const base = browser.runtime.getURL(detection.readerPath as "/popup.html")
  const params = new URLSearchParams({ reopenHint: hint })
  if (handoff.token) {
    params.set(DOCUMENT_FILE_HANDOFF_QUERY_PARAM, handoff.token)
  }
  if (handoff.failureReason) {
    params.set(DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM, handoff.failureReason)
  }
  return `${base}?${params.toString()}`
}

export function DocumentIntakeApp() {
  const { astraTheme, astraDirection } = useAstraTheme()
  const [phase, setPhase] = useState<IntakePhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IntakeResult | null>(null)
  const [queueCount, setQueueCount] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const accept = useMemo(() => documentIntakeAcceptList(), [])

  const openReader = useCallback((url: string) => {
    void browser.tabs.create({ url })
  }, [])

  const openReadingQueue = useCallback(() => {
    void browser.tabs.create({ url: `${browser.runtime.getURL("/vocabulary.html" as "/popup.html")}?tab=reading` })
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setPhase("saving")
    setError(null)
    setResult(null)

    try {
      const detection = detectDocumentIntakeFileKind(file)
      const item = await upsertOwnedReadingForIntake(file, detection)
      void commitLearningContinuitySync("document-intake-owned-reading")
      const hint = buildDocumentIntakeReopenHint(file.name, detection)
      const handoff = await createDocumentFileHandoff({
        file,
        kind: documentHandoffKindForDetection(detection),
      })
      const handoffToken = handoff.ok ? handoff.handoff.token : undefined
      const handoffReason = handoff.ok ? undefined : handoff.reason
      const readerUrl = buildReaderUrl(detection, item.reopenHint ?? hint, {
        ...(handoffToken ? { token: handoffToken } : {}),
        ...(handoffReason ? { failureReason: handoffReason } : {}),
      })
      const queue = await listOwnedReadingItems()

      setQueueCount(queue.filter((row) => row.status !== "archived").length)
      setResult({
        fileName: file.name,
        detection,
        item,
        readerUrl,
        handoffStatus: handoff.ok ? "ready" : "manual",
        ...(handoffReason ? { handoffReason } : {}),
      })
      setPhase("ready")
      openReader(readerUrl)
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Could not route this file into an Astra reader.")
    }
  }, [openReader])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    event.target.value = ""
  }, [handleFile])

  const handleFileDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      void handleFile(file)
    }
  }, [handleFile])

  const resumeBehavior = result ? describeOwnedReadingResumeBehavior(result.item) : null
  const resumeTarget = result ? buildOwnedReadingResumeTarget(result.item) : null

  return (
    <main data-testid="document-intake-page" data-astra-theme={astraTheme} data-astra={astraDirection} style={containerStyle}>
      <header className="astra-reader-page-header">
        <div className="astra-reader-page-header__brand">
          <span className="astra-reader-page-header__mark" aria-hidden="true">A</span>
          <h1 className="astra-reader-page-header__title">Open a reading file</h1>
        </div>
        <span className="astra-reader-page-header__status">Document intake hub</span>
        <button type="button" className="astra-btn-secondary" onClick={openReadingQueue} style={smallButtonStyle}>
          {t("vocabulary_actionOpenReadingQueue")}
        </button>
      </header>

      <label
        data-testid="document-intake-dropzone"
        className="astra-drop-zone-cursor astra-reader-drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          data-testid="document-intake-file-input"
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <div className="astra-reader-drop-zone__content">
          <div className="astra-reader-drop-zone__eyebrow">Bilingual reading</div>
          <div className="astra-reader-drop-zone__title">Drop a file here or click to choose one</div>
          <div className="astra-reader-drop-zone__description">
            Astra detects the file kind, records a Reading queue row, then opens the existing PDF, ePub, or subtitle reader.
          </div>
          <div className="astra-reader-drop-zone__chips" aria-label="Supported file types">
            <span className="astra-reader-drop-zone__chip">PDF</span>
            <span className="astra-reader-drop-zone__chip">EPUB</span>
            <span className="astra-reader-drop-zone__chip">SRT</span>
            <span className="astra-reader-drop-zone__chip">VTT</span>
          </div>
        </div>
      </label>

      <section style={noteStyle}>
        <strong>Local file handoff:</strong> Astra creates a short-lived one-time token so the reader can open this local file without an immediate reselect when possible.
        If the token expires, is missing, or the file is too large, the reader asks you to choose the same file again. File bytes stay local and are not synced.
      </section>

      <section data-testid="document-intake-quality-tier-note" style={noteStyle}>
        <strong>Quality Tier v1:</strong> image OCR and PDF translation readers classify extraction/translation confidence in-reader, so you can decide when compare or manual review is needed.
      </section>

      {phase === "saving" && (
        <div role="status" style={statusStyle}>Saving queue continuity and opening the reader…</div>
      )}

      {phase === "error" && error && (
        <div role="alert" data-testid="document-intake-error" style={errorStyle}>{error}</div>
      )}

      {phase === "ready" && result && (
        <section data-testid="document-intake-ready" style={readyStyle}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#9a3412", textTransform: "uppercase" }}>{result.detection.label}</div>
          <h2 style={{ margin: "4px 0", fontSize: 18 }}>{result.fileName}</h2>
          <p style={mutedStyle}>
            Saved to Reading queue as <strong>{result.item.title}</strong>. {queueCount !== null ? `${queueCount} active queue item${queueCount === 1 ? "" : "s"}.` : ""}
          </p>
          <p style={mutedStyle}>{resumeBehavior}</p>
          {result.handoffStatus === "ready" ? (
            <p style={handoffReadyStyle}>Short-lived local handoff ready: the reader should open without an immediate reselect.</p>
          ) : (
            <p style={limitationStyle}>{describeDocumentFileHandoffFailure(result.handoffReason ?? "storage_error", result.fileName)}</p>
          )}
          {resumeTarget?.requiresFileSelection && (
            <p style={limitationStyle}>Later Reading queue reopens may still require selecting the same local file again.</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="astra-btn-primary" onClick={() => openReader(result.readerUrl)} style={smallButtonStyle}>
              Open reader again
            </button>
            <button type="button" className="astra-btn-secondary" onClick={openReadingQueue} style={smallButtonStyle}>
              {t("vocabulary_actionOpenReadingQueue")}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

const containerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  minHeight: "100vh",
  maxWidth: 920,
  margin: "0 auto",
  padding: "32px 28px 56px",
  fontFamily: "var(--astra-font)",
  color: "var(--astra-style-ink-1)",
  background: "var(--astra-style-bg-page)",
}

const mutedStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "var(--astra-style-ink-3)",
  lineHeight: 1.55,
  fontSize: 13,
}

const noteStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: "var(--astra-radius-md)",
  border: "1px solid var(--astra-style-line-1)",
  background: "var(--astra-style-bg-surface)",
  color: "var(--astra-style-ink-2)",
  fontSize: 13,
  lineHeight: 1.55,
}

const statusStyle: React.CSSProperties = {
  marginTop: 14,
  color: "var(--astra-style-ink-2)",
  fontFamily: "var(--astra-style-font-mono, JetBrains Mono, monospace)",
  fontSize: 12,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
}

const errorStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  color: "var(--astra-danger)",
  background: "var(--astra-danger-bg)",
  border: "1px solid var(--astra-danger-border)",
}

const readyStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "16px 18px",
  borderRadius: "var(--astra-radius-lg)",
  border: "1px solid var(--astra-style-line-1)",
  background: "var(--astra-style-bg-surface)",
}

const limitationStyle: React.CSSProperties = {
  ...mutedStyle,
  color: "var(--astra-style-ink-2)",
  fontStyle: "italic",
}

const handoffReadyStyle: React.CSSProperties = {
  ...mutedStyle,
  color: "var(--astra-success)",
  fontWeight: 500,
}

const smallButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
}

export default DocumentIntakeApp
