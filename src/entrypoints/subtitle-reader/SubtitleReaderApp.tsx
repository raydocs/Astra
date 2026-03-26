/**
 * Astra Subtitle Translator — translate SRT/VTT/ASS files with bilingual export.
 */

import { useState, useCallback, useRef } from "react"
import { browser } from "#imports"
import type { RuntimeResponse } from "@/types/messages"
import {
  parseSubtitles,
  exportBilingualSrt,
  exportBilingualVtt,
  type SubtitleCue,
  type SubtitleFormat,
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
  const [fileName, setFileName] = useState("")
  const [format, setFormat] = useState<SubtitleFormat>("unknown")
  const [cues, setCues] = useState<SubtitleCue[]>([])
  const [translations, setTranslations] = useState<Map<number, string>>(new Map())
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFile = async (file: File) => {
    try {
      const text = await file.text()
      const result = parseSubtitles(text)

      if (result.format === "unknown" || result.cues.length === 0) {
        setPhase("error")
        setError("Unrecognized subtitle format. Supports SRT, VTT, and ASS.")
        return
      }

      setFileName(file.name)
      setFormat(result.format)
      setCues(result.cues)
      setTranslations(new Map())
      setPhase("parsed")
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to parse subtitle file")
    }
  }

  const startTranslation = async () => {
    setPhase("translating")
    setProgress({ current: 0, total: cues.length })
    const newTranslations = new Map<number, string>()

    for (let i = 0; i < cues.length; i += BATCH_SIZE) {
      const batch = cues.slice(i, i + BATCH_SIZE)
      const texts = batch.map((c) => c.text.replace(/\n/g, " "))
      setProgress({ current: Math.min(i + BATCH_SIZE, cues.length), total: cues.length })

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

  const handleExport = (exportFormat: "srt" | "vtt") => {
    const content = exportFormat === "vtt"
      ? exportBilingualVtt(cues, translations)
      : exportBilingualSrt(cues, translations)

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
        <h1 style={{ margin: 0, fontSize: 18, color: "#6366f1" }}>Astra Subtitle Translator</h1>
        {fileName && <span style={{ fontSize: 13, color: "#64748b" }}>{fileName} ({format.toUpperCase()}, {cues.length} cues)</span>}
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
            accept=".srt,.vtt,.ass,.ssa"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 48, marginBottom: 16 }}>SUB</div>
          <div style={{ fontSize: 16, color: "#334155" }}>Drop a subtitle file here or click to select</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Supports SRT, VTT, and ASS formats</div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ padding: 24, color: "#b45309", textAlign: "center" }}>{error}</div>
      )}

      {phase === "parsed" && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 14, color: "#334155", marginBottom: 16 }}>
            Parsed {cues.length} cues from {format.toUpperCase()} file
          </div>
          <button type="button" onClick={() => void startTranslation()} style={btnStyle}>
            Translate All
          </button>
        </div>
      )}

      {phase === "translating" && (
        <div style={{ textAlign: "center", padding: 16, color: "#6366f1" }}>
          Translating {progress.current}/{progress.total} cues...
        </div>
      )}

      {(phase === "translating" || phase === "done") && (
        <>
          {phase === "done" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button type="button" onClick={() => handleExport("srt")} style={btnStyle}>Export SRT</button>
              <button type="button" onClick={() => handleExport("vtt")} style={btnStyle}>Export VTT</button>
            </div>
          )}

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
