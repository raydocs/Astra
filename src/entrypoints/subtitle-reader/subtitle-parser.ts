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
  const body = cues
    .map((cue, i) => {
      const translation = translations.get(i) ?? ""
      const text = translation
        ? `${cue.text}\n${translation}`
        : cue.text
      return `${cue.startTime} --> ${cue.endTime}\n${text}`
    })
    .join("\n\n")

  return `WEBVTT\n\n${body}`
}
