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
import { getSafeAiUnavailableCopy } from "@/utils/copy-dictionary"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import type { ServiceMode } from "@/types/config"
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

interface ReaderConfidenceSummary {
  tierLabel: string
  surfaceLabel: string
  coverageLabel: string
  guidance: string
}

function isProofBackedSubtitleFormat(fileFormat: FileFormat): boolean {
  return fileFormat === "srt" || fileFormat === "vtt"
}

function summarizeSubtitleReaderConfidence(params: {
  fileFormat: FileFormat
  itemCount: number
  translatedCount: number
  phase: Phase
}): ReaderConfidenceSummary | null {
  const { fileFormat, itemCount, translatedCount, phase } = params
  if (fileFormat === "unknown" || phase === "idle" || phase === "error") return null

  const coverage = itemCount > 0 ? translatedCount / itemCount : 0
  const percent = itemCount > 0 ? Math.round(coverage * 100) : 0
  const proofBacked = isProofBackedSubtitleFormat(fileFormat)
  const surfaceLabel = proofBacked
    ? "SRT/VTT controlled subtitle-file reader"
    : "Opportunistic parser support"

  if (itemCount === 0) {
    return {
      tierLabel: "Needs manual review",
      surfaceLabel,
      coverageLabel: "No translatable rows detected.",
      guidance: proofBacked
        ? "Try re-exporting the subtitle file and compare timings before relying on the result."
        : "This format is accepted for convenience but is not a proof-backed public support claim yet.",
    }
  }

  if (phase === "done" && coverage >= 0.95) {
    return {
      tierLabel: proofBacked ? "High confidence" : "Review recommended",
      surfaceLabel,
      coverageLabel: `${translatedCount}/${itemCount} rows translated (${percent}%).`,
      guidance: proofBacked
        ? "SRT/VTT import, translation, and bilingual export are proof-backed controlled flows."
        : "ASS/Markdown/TXT/HTML parsing is useful for study drafts; compare with the source before making external claims.",
    }
  }

  return {
    tierLabel: phase === "parsed" ? "Ready to translate" : "In progress",
    surfaceLabel,
    coverageLabel: `${translatedCount}/${itemCount} rows translated (${percent}%).`,
    guidance: proofBacked
      ? "Translate all rows before export for the strongest subtitle-file confidence."
      : "Accepted parser format; not a proof-backed public support claim until separate proof is added.",
  }
}

function coerceHandoffFailureReason(value: string | null): DocumentFileHandoffFailureReason | null {
  if (value === "invalid" || value === "missing" || value === "expired" || value === "oversize" || value === "corrupt" || value === "storage_error") {
    return value
  }
  return null
}

interface SubtitleReaderConfigSlice {
  targetLang: string
  serviceMode: ServiceMode
}

async function getReaderConfig(): Promise<SubtitleReaderConfigSlice> {
  try {
    const result = await browser.storage.local.get("astra.config.v1")
    const config = result["astra.config.v1"] as { targetLang?: string, serviceMode?: ServiceMode } | undefined
    return {
      targetLang: config?.targetLang ?? "zh-CN",
      serviceMode: config?.serviceMode ?? "automatic",
    }
  } catch {
    return { targetLang: "zh-CN", serviceMode: "automatic" }
  }
}

function ReaderConfidenceCard({ summary }: { summary: ReaderConfidenceSummary | null }) {
  if (!summary) return null
  return (
    <section data-testid="subtitle-reader-confidence-card" className="astra-subtitle-status-card" aria-label="Subtitle reader confidence">
      <div className="astra-subtitle-status-card__copy">
        <strong>Quality Tier v1 · {summary.surfaceLabel}</strong>
        <div>{summary.tierLabel}: {summary.coverageLabel}</div>
        <div>{summary.guidance}</div>
      </div>
    </section>
  )
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
        const { targetLang, serviceMode } = await getReaderConfig()
        const response: RuntimeResponse = await browser.runtime.sendMessage({
          type: "runtime/translate-batch",
          payload: { texts, targetLang, serviceMode, task: "translate" },
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
      const { targetLang, serviceMode } = await getReaderConfig()
      const result = await translateTexts({
        texts: [text],
        targetLang,
        serviceMode,
        task: "explain",
      })
      const explanation = result.ok
        ? (result.translations[0] ?? "")
        : `Warning: ${getSafeAiUnavailableCopy(result.error)}`
      setExplanations((prev) => ({ ...prev, [rowIndex]: explanation }))
    } catch (err) {
      setExplanations((prev) => ({
        ...prev,
        [rowIndex]: `Warning: ${getSafeAiUnavailableCopy({ code: "UNKNOWN", message: err instanceof Error ? err.message : "Request failed." })}`,
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
    <div className="astra-container astra-container--wide astra-subtitle-shell" data-astra-theme="light" data-astra="quiet">
      <header className="astra-subtitle-header">
        <div>
          <div className="astra-subtitle-header__title">Astra File Translator</div>
          <div className="astra-subtitle-header__meta">Subtitle and text translation</div>
        </div>
        {fileName && (
          <div className="astra-subtitle-header__meta">
            {fileName} ({formatLabel(fileFormat)}, {itemCount} {isDocument ? "paragraphs" : "cues"})
          </div>
        )}
      </header>

      {reopenBanner && (
        <div role="status" className="astra-subtitle-status-card astra-subtitle-status-card--info">
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
        <div className="astra-subtitle-status-card astra-subtitle-status-card--error">{error}</div>
      )}

      {phase === "parsed" && (
        <>
          <ReaderConfidenceCard summary={summarizeSubtitleReaderConfidence({ fileFormat, itemCount, translatedCount: translations.size, phase })} />
          <div className="astra-subtitle-status-card">
            <div className="astra-subtitle-status-card__copy">
              Parsed {itemCount} {isDocument ? "paragraphs" : "cues"} from {formatLabel(fileFormat)} file
            </div>
            <button type="button" onClick={() => void startTranslation()} className="astra-btn-primary">
              Translate All
            </button>
          </div>
        </>
      )}

      {phase === "translating" && (
        <div className="astra-subtitle-status-card" role="status" aria-live="polite">
          <div>
            Translating {progress.current}/{progress.total} {isDocument ? "paragraphs" : "cues"}...
          </div>
          <div
            role="progressbar"
            aria-label="Subtitle translation progress"
            aria-valuemin={0}
            aria-valuemax={progress.total || 1}
            aria-valuenow={progress.current}
            className="astra-reader-progressbar"
          >
            <span style={{ width: `${progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0}%` }} />
          </div>
        </div>
      )}

      {(phase === "translating" || phase === "done") && (
        <>
          <ReaderConfidenceCard summary={summarizeSubtitleReaderConfidence({ fileFormat, itemCount, translatedCount: translations.size, phase })} />
          {phase === "done" && (
            <>
              <div className="astra-subtitle-actions">
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
                <div role="status" aria-live="polite" data-role="subtitle-learning-chain" className="astra-subtitle-learning-chain">
                  <div className="astra-subtitle-learning-chain__title">Learning chain ready</div>
                  <div className="astra-subtitle-learning-chain__copy">
                    {savedRowKeys.size} saved {savedRowKeys.size === 1 ? "row is" : "rows are"} now available in Vocabulary, Review, and Reading queue revisit.
                  </div>
                  <div className="astra-subtitle-learning-chain__actions">
                    <button type="button" onClick={() => openLearningSurface("list")} className="astra-btn-primary astra-subtitle-mini-btn">Open Vocabulary</button>
                    <button type="button" onClick={() => openLearningSurface("review")} className="astra-btn-primary astra-subtitle-mini-btn">Start Review</button>
                    <button type="button" onClick={() => openLearningSurface("reading")} className="astra-btn-primary astra-subtitle-mini-btn">Open Reading Queue</button>
                  </div>
                </div>
              )}
            </>
          )}

          {isDocument ? (
            <table className="astra-subtitle-table astra-subtitle-table--media">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Original</th>
                  <th>Translation</th>
                  <th>Learn</th>
                </tr>
              </thead>
              <tbody>
                {docEntries.map((entry, i) => {
                  const isSaved = savedRowKeys.has(rowSaveKey(i, entry.text))
                  return (
                    <tr key={i} className="astra-subtitle-line" data-state={isSaved ? "saved" : undefined}>
                      <td className="astra-subtitle-line__index">{entry.index}</td>
                      <td className="astra-subtitle-line__text">{entry.text}</td>
                      <td className="astra-subtitle-line__translation">
                        {translations.get(i) ?? (phase === "translating" ? "..." : "")}
                      </td>
                      <td className="astra-subtitle-line__actions">
                        {phase === "done" && (
                          <div className="astra-subtitle-line__actions-wrap">
                            <div className="astra-subtitle-line__button-row">
                              <button
                                type="button"
                                onClick={() => void handleExplainRow(i, entry.text)}
                                disabled={explainingIndex !== null}
                                className="astra-btn-primary astra-subtitle-mini-btn"
                              >
                                {explainingIndex === i ? "…" : "Explain"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveRow(i, entry.text)}
                                disabled={savingIndex !== null || isSaved}
                                className="astra-btn-primary astra-subtitle-mini-btn"
                              >
                                {isSaved ? "Saved" : savingIndex === i ? "…" : "Save"}
                              </button>
                            </div>
                            {explanations[i] && <div className="astra-subtitle-explain-box">{explanations[i]}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="astra-subtitle-table astra-subtitle-table--media">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Original</th>
                  <th>Translation</th>
                  <th>Learn</th>
                </tr>
              </thead>
              <tbody>
                {cues.map((cue, i) => {
                  const isSaved = savedRowKeys.has(rowSaveKey(i, cue.text))
                  return (
                    <tr key={i} className="astra-subtitle-line" data-state={isSaved ? "saved" : undefined}>
                      <td className="astra-subtitle-line__index">{cue.index}</td>
                      <td className="astra-subtitle-line__time">{cue.startTime}</td>
                      <td className="astra-subtitle-line__text">{cue.text}</td>
                      <td className="astra-subtitle-line__translation">
                        {translations.get(i) ?? (phase === "translating" ? "..." : "")}
                      </td>
                      <td className="astra-subtitle-line__actions">
                        {phase === "done" && (
                          <div className="astra-subtitle-line__actions-wrap">
                            <div className="astra-subtitle-line__button-row">
                              <button
                                type="button"
                                onClick={() => void handleExplainRow(i, cue.text)}
                                disabled={explainingIndex !== null}
                                className="astra-btn-primary astra-subtitle-mini-btn"
                              >
                                {explainingIndex === i ? "…" : "Explain"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveRow(i, cue.text)}
                                disabled={savingIndex !== null || isSaved}
                                className="astra-btn-primary astra-subtitle-mini-btn"
                              >
                                {isSaved ? "Saved" : savingIndex === i ? "…" : "Save"}
                              </button>
                            </div>
                            {explanations[i] && <div className="astra-subtitle-explain-box">{explanations[i]}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
