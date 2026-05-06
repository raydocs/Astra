import {
  dedupeAdjacentSubtitleCues,
  normalizeSubtitleLanguage,
  stripSubtitleMarkup,
  type PlatformSubtitleCue,
  type PlatformSubtitleSource,
  type PlatformSubtitleTrack,
} from "./subtitle-source"

interface YouTubeCaptionTrackMetadata {
  baseUrl?: string
  vssId?: string
  languageCode?: string
  name?: { simpleText?: string; runs?: Array<{ text?: string }> }
  kind?: string
  isTranslatable?: boolean
}

interface YouTubeTimedTextEvent {
  tStartMs?: number
  dDurationMs?: number
  segs?: Array<{ utf8?: string }>
}

interface YouTubeTimedTextJson {
  events?: YouTubeTimedTextEvent[]
}

function parseYouTubePlayerResponseJson(rawResponse: string | undefined): unknown {
  if (!rawResponse) return null

  try {
    return JSON.parse(rawResponse)
  } catch {
    return null
  }
}

function extractScriptJsonObject(scriptText: string, marker: string): unknown {
  const start = scriptText.indexOf(marker)
  if (start < 0) return null

  const jsonStart = scriptText.indexOf("{", start + marker.length)
  if (jsonStart < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = jsonStart; index < scriptText.length; index += 1) {
    const char = scriptText[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === "{") depth += 1
    if (char === "}") depth -= 1
    if (depth === 0) {
      try {
        return JSON.parse(scriptText.slice(jsonStart, index + 1))
      } catch {
        return null
      }
    }
  }

  return null
}

function extractScriptStringValue(scriptText: string, marker: string): string | null {
  const start = scriptText.indexOf(marker)
  if (start < 0) return null

  const valueStart = start + marker.length
  const quote = scriptText[valueStart]
  if (quote !== '"' && quote !== "'") return null

  let escaped = false
  for (let index = valueStart + 1; index < scriptText.length; index += 1) {
    const char = scriptText[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (char === quote) {
      const literal = scriptText.slice(valueStart, index + 1)
      try {
        return JSON.parse(literal.replace(/'/g, '"')) as string
      } catch {
        return null
      }
    }
  }

  return null
}

function readScriptPlayerResponse(document: Document): unknown {
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent ?? ""

    const initialResponse = extractScriptJsonObject(text, "ytInitialPlayerResponse")
    if (initialResponse) return initialResponse

    const rawPlayerResponse = extractScriptStringValue(text, "player_response:")
    const parsed = parseYouTubePlayerResponseJson(rawPlayerResponse ?? undefined)
    if (parsed) return parsed
  }

  return null
}

function readYouTubePlayerResponse(): unknown {
  const win = window as Window & {
    ytInitialPlayerResponse?: unknown
    ytplayer?: { config?: { args?: { player_response?: string } } }
  }

  if (win.ytInitialPlayerResponse) return win.ytInitialPlayerResponse

  const parsedGlobalResponse = parseYouTubePlayerResponseJson(win.ytplayer?.config?.args?.player_response)
  if (parsedGlobalResponse) return parsedGlobalResponse

  return readScriptPlayerResponse(document)
}

export function extractYouTubeCaptionTracks(playerResponse: unknown): YouTubeCaptionTrackMetadata[] {
  const response = playerResponse as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: YouTubeCaptionTrackMetadata[]
      }
    }
  } | null

  const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  return Array.isArray(tracks) ? tracks : []
}

function getTrackLabel(track: YouTubeCaptionTrackMetadata): string | null {
  const simpleText = track.name?.simpleText?.trim()
  if (simpleText) return simpleText

  const runText = track.name?.runs
    ?.map((run) => run.text ?? "")
    .join("")
    .trim()
  return runText || null
}

function selectPreferredTrack(
  tracks: YouTubeCaptionTrackMetadata[],
  targetLang: string,
): YouTubeCaptionTrackMetadata | null {
  const normalizedTarget = normalizeSubtitleLanguage(targetLang)

  return [...tracks]
    .filter((track) => typeof track.baseUrl === "string" && track.baseUrl.trim().length > 0)
    .sort((left, right) => {
      const leftScore
        = (left.kind !== "asr" ? 40 : 5)
          + (normalizeSubtitleLanguage(left.languageCode) !== normalizedTarget ? 20 : -15)
          + (left.isTranslatable ? 10 : 0)
          + (getTrackLabel(left) ? 2 : 0)
      const rightScore
        = (right.kind !== "asr" ? 40 : 5)
          + (normalizeSubtitleLanguage(right.languageCode) !== normalizedTarget ? 20 : -15)
          + (right.isTranslatable ? 10 : 0)
          + (getTrackLabel(right) ? 2 : 0)
      return rightScore - leftScore
    })[0] ?? null
}

function buildTimedTextUrls(baseUrl: string): string[] {
  const urls = new Set<string>()

  try {
    const json3Url = new URL(baseUrl, window.location.origin)
    json3Url.searchParams.set("fmt", "json3")
    urls.add(json3Url.toString())
  } catch {
    // Keep the raw URL fallback below.
  }

  urls.add(baseUrl)
  return Array.from(urls)
}

export function parseYouTubeJson3TimedText(payload: string): PlatformSubtitleCue[] {
  const parsed = JSON.parse(payload) as YouTubeTimedTextJson
  if (!Array.isArray(parsed.events)) return []

  const cues = parsed.events
    .map((event) => {
      const text = stripSubtitleMarkup(
        (event.segs ?? [])
          .map((segment) => segment.utf8 ?? "")
          .join(""),
      )
      const startMs = typeof event.tStartMs === "number" ? event.tStartMs : Number.NaN
      const durationMs = typeof event.dDurationMs === "number" ? event.dDurationMs : Number.NaN
      return {
        startTime: startMs / 1000,
        endTime: (startMs + durationMs) / 1000,
        text,
      }
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)

  return dedupeAdjacentSubtitleCues(cues)
}

export function parseYouTubeXmlTimedText(payload: string): PlatformSubtitleCue[] {
  const xml = new DOMParser().parseFromString(payload, "text/xml")
  const cues = Array.from(xml.querySelectorAll("text"))
    .map((node) => {
      const start = Number.parseFloat(node.getAttribute("start") ?? "")
      const duration = Number.parseFloat(node.getAttribute("dur") ?? "")
      return {
        startTime: start,
        endTime: start + duration,
        text: stripSubtitleMarkup(node.textContent ?? ""),
      }
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)

  return dedupeAdjacentSubtitleCues(cues)
}

async function fetchTimedTextCues(track: YouTubeCaptionTrackMetadata): Promise<PlatformSubtitleCue[]> {
  if (!track.baseUrl) return []

  for (const url of buildTimedTextUrls(track.baseUrl)) {
    const response = await fetch(url, { credentials: "include" })
    if (!response.ok) continue

    const payload = await response.text()
    if (!payload.trim()) continue

    try {
      const cues = payload.trim().startsWith("{")
        ? parseYouTubeJson3TimedText(payload)
        : parseYouTubeXmlTimedText(payload)
      if (cues.length > 0) return cues
    } catch {
      // Try the next timedtext URL/format.
    }
  }

  return []
}

export const youtubeTimedTextSubtitleSource: PlatformSubtitleSource = {
  platform: "youtube",
  canLoad(url): boolean {
    const hostname = url.hostname.toLowerCase()
    return ["www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(hostname)
      && (url.pathname === "/watch" || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") || hostname === "youtu.be")
  },
  async loadTracks(_video, options): Promise<PlatformSubtitleTrack[]> {
    const track = selectPreferredTrack(extractYouTubeCaptionTracks(readYouTubePlayerResponse()), options.targetLang)
    if (!track) return []

    const cues = await fetchTimedTextCues(track)
    if (cues.length === 0) return []

    return [{
      id: `youtube:${track.vssId ?? track.languageCode ?? track.baseUrl}`,
      language: normalizeSubtitleLanguage(track.languageCode) || null,
      label: getTrackLabel(track),
      kind: "subtitles",
      platform: "youtube",
      source: "youtube-timedtext",
      cues,
    }]
  },
}
