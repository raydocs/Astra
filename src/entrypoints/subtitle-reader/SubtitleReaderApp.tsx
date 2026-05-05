/**
 * Astra Subtitle Translator — translate SRT/VTT/ASS files with bilingual export.
 */

import { useState, useCallback, useEffect } from "react"
import { browser } from "#imports"
import type { RuntimeResponse } from "@/types/messages"
import { buildOwnedReadingVocabularySourceLink, upsertOwnedSubtitleFileFromImport } from "@/utils/storage/owned-reading"
import {
  parseSubtitles,
  exportBilingualSrt,
  exportBilingualVtt,
  exportMarkdownBilingual,
  detectDocumentFormat,
  parseDocument,
  formatLabel,
  type SubtitleCue,
  type SubtitleFormat,
  type DocumentEntry,
  type DocumentFormat,
  type FileFormat,
} from "./subtitle-parser"
import { translateTexts } from "@/utils/translate/translate"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import {
  consumeDocumentFileHandoff,
  describeDocumentFileHandoffFailure,
  DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM,
  DOCUMENT_FILE_HANDOFF_QUERY_PARAM,
  readDocumentFileText,
  type DocumentFileHandoffFailureReason,
} from "@/utils/reading/document-file-handoff"

type Phase = "idle" | "parsed" | "translating" | "done" | "error"

const BATCH_SIZE = 15

function coerceHandoffFailureReason(value: string | null): DocumentFileHandoffFailureReason | null {
  if (value === "invalid" || value === "missing" || value === "expired" || value === "oversize" || value === "corrupt" || value === "storage_error") {
    return value
  }
  return null
}

async function getTargetLang(): Promise<string> {
  try {
    const result = await browser.storage.local.get("astra.config.v1")
    const config = result["astra.config.v1"] as { targetLang?: string } | undefined
    return config?.targetLang ?? "zh-CN"
  } catch {
    return "zh-CN"
  }
}

export function SubtitleReaderApp() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [reopenBanner, setReopenBanner] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [fileFormat, setFileFormat] = useState<FileFormat>("unknown")
  const [cues, setCues] = useState<SubtitleCue[]>([])
  const [docEntries, setDocEntries] = useState<DocumentEntry[]>([])
  const [translations, setTranslations] = useState<Map<number, string>>(new Map())
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [explainingIndex, setExplainingIndex] = useState<number | null>(null)
  const [explanations, setExplanations] = useState<Record<number, string>>({})
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [savedRowKeys, setSavedRowKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hint = params.get("reopenHint")
    const handoffToken = params.get(DOCUMENT_FILE_HANDOFF_QUERY_PARAM)
    const handoffFailure = coerceHandoffFailureReason(params.get(DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM))

    if (handoffToken) {
      void consumeDocumentFileHandoff(handoffToken, "subtitle").then((result) => {
        if (result.ok) {
          setReopenBanner(`Opened ${result.file.name} from Document Intake local handoff. File bytes stayed on this device and were not synced.`)
          void loadFile(result.file)
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
  }, [])

  /** Whether the current file is a document (not subtitle) */
  const isDocument = fileFormat === "markdown" || fileFormat === "txt" || fileFormat === "html"
  /** Unified count of translatable items */
  const itemCount = isDocument ? docEntries.length : cues.length

  const loadFile = async (file: File) => {
    try {
      const text = await readDocumentFileText(file)
      setError(null)
      setExplanations({})
      setSavedRowKeys(new Set())
      setProgress({ current: 0, total: 0 })

      // Try document format first (by extension)
      const docFormat = detectDocumentFormat(file.name)
      if (docFormat) {
        const entries = parseDocument(text, docFormat)
        if (entries.length === 0) {
          setPhase("error")
          setError("File appears to be empty.")
          return
        }
        setFileName(file.name)
        setFileFormat(docFormat)
        setDocEntries(entries)
        setCues([])
        setTranslations(new Map())
        setPhase("parsed")
        void upsertOwnedSubtitleFileFromImport({
          fileName: file.name,
          formatLabel: formatLabel(docFormat),
          cueOrEntryCount: entries.length,
          status: "in_progress",
        })
        return
      }

      // Fall back to subtitle parsing
      const result = parseSubtitles(text)

      if (result.format === "unknown" || result.cues.length === 0) {
        setPhase("error")
        setError("Unrecognized file format. Supports SRT, VTT, ASS, Markdown, TXT, and HTML.")
        return
      }

      setFileName(file.name)
      setFileFormat(result.format)
      setCues(result.cues)
      setDocEntries([])
      setTranslations(new Map())
      setPhase("parsed")
      void upsertOwnedSubtitleFileFromImport({
        fileName: file.name,
        formatLabel: result.format.toUpperCase(),
        cueOrEntryCount: result.cues.length,
        status: "in_progress",
      })
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to parse file")
    }
  }

  const startTranslation = async () => {
    const items: { text: string }[] = isDocument ? docEntries : cues
    setPhase("translating")
    setProgress({ current: 0, total: items.length })
    const newTranslations = new Map<number, string>()

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const texts = batch.map((c) => c.text.replace(/\n/g, " "))
      setProgress({ current: Math.min(i + BATCH_SIZE, items.length), total: items.length })

      try {
        const response: RuntimeResponse = await browser.runtime.sendMessage({
          type: "runtime/translate-batch",
          payload: { texts, targetLang: await getTargetLang(), task: "translate" },
        })

        if (response.type === "runtime/translate-batch:success") {
          batch.forEach((_, j) => {
            newTranslations.set(i + j, response.payload.translations[j])
          })
          setTranslations(new Map(newTranslations))
        }
      } catch {
        // Skip failed batch
      }
    }

    setTranslations(new Map(newTranslations))
    setPhase("done")
  }

  const rowSaveKey = (index: number, text: string) => `${index}:${text.slice(0, 120)}`

  const handleExplainRow = async (rowIndex: number, text: string) => {
    if (!text.trim() || explainingIndex !== null) return
    setExplainingIndex(rowIndex)
    void upsertOwnedSubtitleFileFromImport({
      fileName: fileName || "subtitles.srt",
      formatLabel: formatLabel(fileFormat),
      cueOrEntryCount: itemCount,
      status: "in_progress",
      sentenceIndex: rowIndex,
    }).catch(() => undefined)
    try {
      const targetLang = await getTargetLang()
      const result = await translateTexts({
        texts: [text],
        targetLang,
        task: "explain",
      })
      const explanation = result.ok
        ? (result.translations[0] ?? "")
        : `Warning: ${result.error.message}`
      setExplanations((prev) => ({ ...prev, [rowIndex]: explanation }))
    } catch (err) {
      setExplanations((prev) => ({
        ...prev,
        [rowIndex]: `Warning: ${err instanceof Error ? err.message : "Request failed."}`,
      }))
    } finally {
      setExplainingIndex(null)
    }
  }

  const handleSaveRow = async (rowIndex: number, text: string) => {
    if (!text.trim() || savingIndex !== null) return
    const key = rowSaveKey(rowIndex, text)
    if (savedRowKeys.has(key)) return

    setSavingIndex(rowIndex)
    try {
      const ownedReadingItem = await upsertOwnedSubtitleFileFromImport({
        fileName: fileName || "subtitles.srt",
        formatLabel: formatLabel(fileFormat),
        cueOrEntryCount: itemCount,
        status: "saved",
        sentenceIndex: rowIndex,
      })
      const pageIdentity = ownedReadingItem.localUri ?? (typeof window !== "undefined" ? window.location.href : undefined)

      await saveVocabularyEntry({
        text: text.trim(),
        translation: translations.get(rowIndex) || undefined,
        explanation: explanations[rowIndex],
        context: `${fileName} · row ${rowIndex + 1}`,
        sourceContext: {
          surface: "subtitle_reader",
          pageTitle: fileName || "Subtitle reader",
          pageUrl: pageIdentity,
          hostname: "subtitle-reader",
          contentSummary: `${formatLabel(fileFormat)} · ${itemCount} items`,
          sentenceText: text.trim(),
          sentenceIndex: rowIndex,
          ...buildOwnedReadingVocabularySourceLink(ownedReadingItem),
        },
        url: pageIdentity,
        hostname: "subtitle-reader",
      })
      setSavedRowKeys((prev) => new Set(prev).add(key))
    } catch {
      // Non-fatal — user can retry
    } finally {
      setSavingIndex(null)
    }
  }

  const openLearningSurface = (tab: "list" | "review" | "reading") => {
    const target = tab === "list"
      ? browser.runtime.getURL("/vocabulary.html")
      : browser.runtime.getURL(`/vocabulary.html?tab=${tab}`)
    void browser.tabs.create({ url: target })
  }

  const handleExport = (exportFormat: "srt" | "vtt" | "md") => {
    let content: string
    if (exportFormat === "md") {
      content = exportMarkdownBilingual(docEntries, translations)
    } else if (exportFormat === "vtt") {
      content = exportBilingualVtt(cues, translations)
    } else {
      content = exportBilingualSrt(cues, translations)
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const baseName = fileName.replace(/\.[^.]+$/, "")
    a.download = `${baseName}.bilingual.${exportFormat}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void loadFile(file)
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void loadFile(file)
  }, [])

  return (
    <div className="astra-container astra-container--wide" style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 18, color: "#6366f1" }}>Astra File Translator</h1>
        {fileName && (
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {fileName} ({formatLabel(fileFormat)}, {itemCount} {isDocument ? "paragraphs" : "cues"})
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

      {phase === "idle" && (
        <label
          htmlFor="astra-subtitle-reader-file-input"
          className="astra-drop-zone-cursor astra-reader-drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
        >
          <input
            id="astra-subtitle-reader-file-input"
            type="file"
            accept=".srt,.vtt,.ass,.ssa,.md,.txt,.html"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div className="astra-reader-drop-zone__content">
            <div className="astra-reader-drop-zone__icon" aria-hidden="true">FILE</div>
            <div className="astra-reader-drop-zone__eyebrow">Subtitle and text translation</div>
            <div className="astra-reader-drop-zone__title">Drop a file here</div>
            <div className="astra-reader-drop-zone__description">
              or click to select. Translate subtitles, Markdown, TXT, or HTML into a bilingual study file.
            </div>
            <div className="astra-reader-drop-zone__chips" aria-label="Supported file types">
              <span className="astra-reader-drop-zone__chip">SRT</span>
              <span className="astra-reader-drop-zone__chip">VTT</span>
              <span className="astra-reader-drop-zone__chip">ASS</span>
              <span className="astra-reader-drop-zone__chip">MD/TXT/HTML</span>
            </div>
          </div>
        </label>
      )}

      {phase === "error" && (
        <div style={{ padding: 24, color: "#b45309", textAlign: "center" }}>{error}</div>
      )}

      {phase === "parsed" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 14, color: "#334155", marginBottom: 16 }}>
            Parsed {itemCount} {isDocument ? "paragraphs" : "cues"} from {formatLabel(fileFormat)} file
          </div>
          <button type="button" onClick={() => void startTranslation()} className="astra-btn-primary">
            Translate All
          </button>
        </div>
      )}

      {phase === "translating" && (
        <div style={{ textAlign: "center", padding: 16, color: "#6366f1" }}>
          Translating {progress.current}/{progress.total} {isDocument ? "paragraphs" : "cues"}...
        </div>
      )}

      {(phase === "translating" || phase === "done") && (
        <>
          {phase === "done" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: savedRowKeys.size > 0 ? 12 : 16 }}>
                {isDocument ? (
                  <button type="button" onClick={() => handleExport("md")} className="astra-btn-primary">Export Markdown</button>
                ) : (
                  <>
                    <button type="button" onClick={() => handleExport("srt")} className="astra-btn-primary">Export SRT</button>
                    <button type="button" onClick={() => handleExport("vtt")} className="astra-btn-primary">Export VTT</button>
                  </>
                )}
              </div>
              {savedRowKeys.size > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  data-role="subtitle-learning-chain"
                  style={{
                    marginBottom: 16,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    background: "rgba(99, 102, 241, 0.06)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4338ca", marginBottom: 4 }}>
                    Learning chain ready
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
                    {savedRowKeys.size} saved {savedRowKeys.size === 1 ? "row is" : "rows are"} now available in Vocabulary, Review, and Reading queue revisit.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => openLearningSurface("list")} className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>Open Vocabulary</button>
                    <button type="button" onClick={() => openLearningSurface("review")} className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>Start Review</button>
                    <button type="button" onClick={() => openLearningSurface("reading")} className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>Open Reading Queue</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isDocument ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Original</th>
                  <th style={thStyle}>Translation</th>
                  <th style={thStyle}>Learn</th>
                </tr>
              </thead>
              <tbody>
                {docEntries.map((entry, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{entry.index}</td>
                    <td style={tdStyle}>{entry.text}</td>
                    <td style={{ ...tdStyle, color: "#6366f1" }}>
                      {translations.get(i) ?? (phase === "translating" ? "..." : "")}
                    </td>
                    <td style={tdStyle}>
                      {phase === "done" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => void handleExplainRow(i, entry.text)}
                              disabled={explainingIndex !== null}
                              className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}
                            >
                              {explainingIndex === i ? "…" : "Explain"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveRow(i, entry.text)}
                              disabled={savingIndex !== null || savedRowKeys.has(rowSaveKey(i, entry.text))}
                              className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}
                            >
                              {savedRowKeys.has(rowSaveKey(i, entry.text)) ? "Saved" : savingIndex === i ? "…" : "Save"}
                            </button>
                          </div>
                          {explanations[i] && (
                            <div style={explainBoxStyle}>{explanations[i]}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Original</th>
                  <th style={thStyle}>Translation</th>
                  <th style={thStyle}>Learn</th>
                </tr>
              </thead>
              <tbody>
                {cues.map((cue, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{cue.index}</td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 11, color: "#64748b" }}>
                      {cue.startTime}
                    </td>
                    <td style={tdStyle}>{cue.text}</td>
                    <td style={{ ...tdStyle, color: "#6366f1" }}>
                      {translations.get(i) ?? (phase === "translating" ? "..." : "")}
                    </td>
                    <td style={tdStyle}>
                      {phase === "done" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => void handleExplainRow(i, cue.text)}
                              disabled={explainingIndex !== null}
                              className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}
                            >
                              {explainingIndex === i ? "…" : "Explain"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveRow(i, cue.text)}
                              disabled={savingIndex !== null || savedRowKeys.has(rowSaveKey(i, cue.text))}
                              className="astra-btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}
                            >
                              {savedRowKeys.has(rowSaveKey(i, cue.text)) ? "Saved" : savingIndex === i ? "…" : "Save"}
                            </button>
                          </div>
                          {explanations[i] && (
                            <div style={explainBoxStyle}>{explanations[i]}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
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

// btnStyle — now using className="astra-btn-primary"
// smallBtnStyle — now using className="astra-btn-primary" + style override

const explainBoxStyle: React.CSSProperties = {
  maxWidth: 280,
  fontSize: 12,
  lineHeight: 1.45,
  color: "#1e3a8a",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 6,
  padding: "6px 8px",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "2px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  padding: "6px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  lineHeight: 1.5,
}
