/**
 * Astra Subtitle Translator — translate SRT/VTT/ASS files with bilingual export.
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { browser } from "#imports"
import type { RuntimeResponse } from "@/types/messages"
import { upsertOwnedSubtitleFileFromImport } from "@/utils/storage/owned-reading"
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

type Phase = "idle" | "parsed" | "translating" | "done" | "error"

const BATCH_SIZE = 15

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const hint = new URLSearchParams(window.location.search).get("reopenHint")
    if (hint) {
      setReopenBanner(decodeURIComponent(hint))
    }
  }, [])

  /** Whether the current file is a document (not subtitle) */
  const isDocument = fileFormat === "markdown" || fileFormat === "txt" || fileFormat === "html"
  /** Unified count of translatable items */
  const itemCount = isDocument ? docEntries.length : cues.length

  const loadFile = async (file: File) => {
    try {
      const text = await file.text()

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
    <div style={containerStyle}>
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
        <div
          style={dropZoneStyle}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.ass,.ssa,.md,.txt,.html"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 48, marginBottom: 16 }}>FILE</div>
          <div style={{ fontSize: 16, color: "#334155" }}>Drop a file here or click to select</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Supports SRT, VTT, ASS, Markdown, TXT, and HTML</div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ padding: 24, color: "#b45309", textAlign: "center" }}>{error}</div>
      )}

      {phase === "parsed" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 14, color: "#334155", marginBottom: 16 }}>
            Parsed {itemCount} {isDocument ? "paragraphs" : "cues"} from {formatLabel(fileFormat)} file
          </div>
          <button type="button" onClick={() => void startTranslation()} style={btnStyle}>
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
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {isDocument ? (
                <button type="button" onClick={() => handleExport("md")} style={btnStyle}>Export Markdown</button>
              ) : (
                <>
                  <button type="button" onClick={() => handleExport("srt")} style={btnStyle}>Export SRT</button>
                  <button type="button" onClick={() => handleExport("vtt")} style={btnStyle}>Export VTT</button>
                </>
              )}
            </div>
          )}

          {isDocument ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Original</th>
                  <th style={thStyle}>Translation</th>
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
  maxWidth: 1000,
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
}

const btnStyle: React.CSSProperties = {
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 20px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
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
