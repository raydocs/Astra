/**
 * Parser for SRT, VTT, and ASS subtitle formats.
 * Extracts cue text + timing, leaving timing codes intact for re-export.
 */

export interface SubtitleCue {
  index: number
  startTime: string
  endTime: string
  text: string
  rawTimeline: string
}

export type SubtitleFormat = "srt" | "vtt" | "ass" | "unknown"

/** Supported document (non-subtitle) formats */
export type DocumentFormat = "markdown" | "txt" | "html"

/** Union of all file formats the reader understands */
export type FileFormat = SubtitleFormat | DocumentFormat

/** A paragraph entry from a parsed document file */
export interface DocumentEntry {
  index: number
  text: string
}

export function detectFormat(content: string): SubtitleFormat {
  const trimmed = content.trim()
  if (trimmed.startsWith("WEBVTT")) return "vtt"
  if (trimmed.includes("[Script Info]") || trimmed.includes("Format:") && trimmed.includes("Dialogue:")) return "ass"
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(trimmed)) return "srt"
  // Fallback: try SRT detection by looking for --> pattern
  if (trimmed.includes("-->")) return "srt"
  return "unknown"
}

function parseSrt(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  const blocks = content.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/)
    if (lines.length < 2) continue

    // Find the timeline line (contains -->)
    let timelineIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timelineIndex = i
        break
      }
    }
    if (timelineIndex < 0) continue

    const timeline = lines[timelineIndex]
    const match = timeline.match(/(\d{2}:\d{2}:\d{2}[,.]?\d*)\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d*)/)
    if (!match) continue

    const text = lines.slice(timelineIndex + 1).join("\n").trim()
    if (!text) continue

    cues.push({
      index: cues.length + 1,
      startTime: match[1],
      endTime: match[2],
      text,
      rawTimeline: timeline,
    })
  }

  return cues
}

function parseVtt(content: string): SubtitleCue[] {
  // Remove WEBVTT header line only, keep the rest for SRT-style parsing
  const lines = content.split(/\r?\n/)
  let startIndex = 0
  // Skip WEBVTT header and any metadata lines until first blank line
  if (lines[0]?.startsWith("WEBVTT")) {
    startIndex = 1
    while (startIndex < lines.length && lines[startIndex].trim() !== "") {
      startIndex++
    }
  }
  const body = lines.slice(startIndex).join("\n").trim()
  return parseSrt(body)
}

function parseAss(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    if (!line.startsWith("Dialogue:")) continue

    // Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    const parts = line.substring("Dialogue:".length).split(",")
    if (parts.length < 10) continue

    const start = parts[1].trim()
    const end = parts[2].trim()
    // Text is everything from the 10th field onwards (may contain commas)
    const text = parts.slice(9).join(",").trim()
      .replace(/\{\\[^}]+\}/g, "") // Strip ASS formatting tags
      .replace(/\\N/g, "\n")       // Convert \N to newline
      .trim()

    if (!text) continue

    cues.push({
      index: cues.length + 1,
      startTime: start,
      endTime: end,
      text,
      rawTimeline: `${start} --> ${end}`,
    })
  }

  return cues
}

export function parseSubtitles(content: string): { format: SubtitleFormat; cues: SubtitleCue[] } {
  const format = detectFormat(content)

  switch (format) {
    case "srt":
      return { format, cues: parseSrt(content) }
    case "vtt":
      return { format, cues: parseVtt(content) }
    case "ass":
      return { format, cues: parseAss(content) }
    default:
      return { format: "unknown", cues: [] }
  }
}

/**
 * Export bilingual subtitles in SRT format.
 * Each cue shows original text + translated text separated by a blank line.
 */
export function exportBilingualSrt(cues: SubtitleCue[], translations: Map<number, string>): string {
  return cues
    .map((cue, i) => {
      const translation = translations.get(i) ?? ""
      const text = translation
        ? `${cue.text}\n${translation}`
        : cue.text
      return `${i + 1}\n${cue.startTime} --> ${cue.endTime}\n${text}`
    })
    .join("\n\n")
}

/**
 * Export bilingual subtitles in VTT format.
 */
export function exportBilingualVtt(cues: SubtitleCue[], translations: Map<number, string>): string {
  const toVttTime = (t: string) => t.replace(",", ".")
  const body = cues
    .map((cue, i) => {
      const translation = translations.get(i) ?? ""
      const text = translation
        ? `${cue.text}\n${translation}`
        : cue.text
      return `${toVttTime(cue.startTime)} --> ${toVttTime(cue.endTime)}\n${text}`
    })
    .join("\n\n")

  return `WEBVTT\n\n${body}`
}

// ---------------------------------------------------------------------------
// Document parsers (Markdown / plain text / HTML)
// ---------------------------------------------------------------------------

/**
 * Parse markdown or plain-text content by splitting on double-newlines.
 * Returns an array of `{ index, text }` entries (1-based index).
 */
export function parseMarkdown(content: string): DocumentEntry[] {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((text, i) => ({ index: i + 1, text }))
}

/**
 * Very lightweight HTML-to-text: strip tags, then split by double-newlines.
 * This is intentionally simple — no DOM parsing required.
 */
export function parseHtml(content: string): DocumentEntry[] {
  // Replace block-level closing tags with double newlines so paragraphs separate
  const withBreaks = content
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|section|article|header|footer|pre|hr)[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")           // strip remaining tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')

  return parseMarkdown(withBreaks)
}

/**
 * Detect document format from file extension.
 * Returns undefined if the extension is not a document type.
 */
export function detectDocumentFormat(fileName: string): DocumentFormat | undefined {
  const ext = fileName.split(".").pop()?.toLowerCase()
  if (ext === "md" || ext === "markdown") return "markdown"
  if (ext === "txt") return "txt"
  if (ext === "html" || ext === "htm") return "html"
  return undefined
}

/**
 * Parse a document file (md/txt/html) into entries.
 */
export function parseDocument(content: string, format: DocumentFormat): DocumentEntry[] {
  switch (format) {
    case "html":
      return parseHtml(content)
    case "markdown":
    case "txt":
      return parseMarkdown(content)
  }
}

/**
 * Export bilingual markdown.
 * Each paragraph shows original text followed by a blockquote translation.
 */
export function exportMarkdownBilingual(entries: DocumentEntry[], translations: Map<number, string>): string {
  return entries
    .map((entry, i) => {
      const translation = translations.get(i) ?? ""
      return translation
        ? `${entry.text}\n\n> ${translation}`
        : entry.text
    })
    .join("\n\n")
}

/** Human-readable label for a file format */
export function formatLabel(format: FileFormat): string {
  switch (format) {
    case "srt": return "SRT"
    case "vtt": return "VTT"
    case "ass": return "ASS"
    case "markdown": return "Markdown"
    case "txt": return "Plain text"
    case "html": return "HTML document"
    default: return "Unknown"
  }
}
