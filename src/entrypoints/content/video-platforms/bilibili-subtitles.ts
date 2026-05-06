import {
  dedupeAdjacentSubtitleCues,
  normalizeSubtitleLanguage,
  stripSubtitleMarkup,
  type PlatformSubtitleCue,
  type PlatformSubtitleSource,
  type PlatformSubtitleTrack,
} from "./subtitle-source"

interface BilibiliSubtitleItem {
  id?: number | string
  lan?: string
  lan_doc?: string
  subtitle_url?: string
  url?: string
}

interface BilibiliSubtitleBodyItem {
  from?: number
  to?: number
  content?: string
}

interface BilibiliSubtitlePayload {
  body?: BilibiliSubtitleBodyItem[]
}

function normalizeBilibiliSubtitleUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("//")) return `${window.location.protocol}${trimmed}`
  try {
    return new URL(trimmed, window.location.href).toString()
  } catch {
    return null
  }
}

function readGlobalSubtitleItems(): BilibiliSubtitleItem[] {
  const win = window as Window & {
    __playinfo__?: { data?: { subtitle?: { subtitles?: BilibiliSubtitleItem[] } } }
    __INITIAL_STATE__?: { videoData?: { subtitle?: { list?: BilibiliSubtitleItem[] } } }
  }

  const playInfoItems = win.__playinfo__?.data?.subtitle?.subtitles
  if (Array.isArray(playInfoItems) && playInfoItems.length > 0) return playInfoItems

  const initialStateItems = win.__INITIAL_STATE__?.videoData?.subtitle?.list
  return Array.isArray(initialStateItems) ? initialStateItems : []
}

function extractScriptJsonObject(scriptText: string, variableName: "__playinfo__" | "__INITIAL_STATE__"): unknown {
  const marker = `${variableName}=`
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

function readScriptSubtitleItems(document: Document): BilibiliSubtitleItem[] {
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent ?? ""
    const playInfo = extractScriptJsonObject(text, "__playinfo__") as {
      data?: { subtitle?: { subtitles?: BilibiliSubtitleItem[] } }
    } | null
    const playInfoItems = playInfo?.data?.subtitle?.subtitles
    if (Array.isArray(playInfoItems) && playInfoItems.length > 0) return playInfoItems

    const initialState = extractScriptJsonObject(text, "__INITIAL_STATE__") as {
      videoData?: { subtitle?: { list?: BilibiliSubtitleItem[] } }
    } | null
    const initialStateItems = initialState?.videoData?.subtitle?.list
    if (Array.isArray(initialStateItems) && initialStateItems.length > 0) return initialStateItems
  }

  return []
}

export function parseBilibiliSubtitleJson(payload: string): PlatformSubtitleCue[] {
  const parsed = JSON.parse(payload) as BilibiliSubtitlePayload
  if (!Array.isArray(parsed.body)) return []

  const cues = parsed.body
    .map((item) => ({
      startTime: typeof item.from === "number" ? item.from : Number.NaN,
      endTime: typeof item.to === "number" ? item.to : Number.NaN,
      text: stripSubtitleMarkup(item.content ?? ""),
    }))
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)

  return dedupeAdjacentSubtitleCues(cues)
}

function selectPreferredSubtitle(items: BilibiliSubtitleItem[], targetLang: string): BilibiliSubtitleItem | null {
  const normalizedTarget = normalizeSubtitleLanguage(targetLang)

  return [...items]
    .filter((item) => typeof (item.subtitle_url ?? item.url) === "string")
    .sort((left, right) => {
      const leftScore = normalizeSubtitleLanguage(left.lan) !== normalizedTarget ? 20 : -10
      const rightScore = normalizeSubtitleLanguage(right.lan) !== normalizedTarget ? 20 : -10
      return rightScore - leftScore
    })[0] ?? null
}

async function fetchBilibiliCues(item: BilibiliSubtitleItem): Promise<PlatformSubtitleCue[]> {
  const url = normalizeBilibiliSubtitleUrl(item.subtitle_url ?? item.url ?? "")
  if (!url) return []

  const response = await fetch(url, { credentials: "include" })
  if (!response.ok) return []

  const payload = await response.text()
  if (!payload.trim()) return []

  return parseBilibiliSubtitleJson(payload)
}

export const bilibiliApiSubtitleSource: PlatformSubtitleSource = {
  platform: "bilibili",
  canLoad(url): boolean {
    return url.hostname === "www.bilibili.com"
      && (url.pathname.startsWith("/video/") || url.pathname.startsWith("/bangumi/play/"))
  },
  async loadTracks(_video, options): Promise<PlatformSubtitleTrack[]> {
    const items = readGlobalSubtitleItems()
    const scriptItems = items.length > 0 ? items : readScriptSubtitleItems(document)
    const item = selectPreferredSubtitle(scriptItems, options.targetLang)
    if (!item) return []

    const cues = await fetchBilibiliCues(item)
    if (cues.length === 0) return []

    return [{
      id: `bilibili:${item.id ?? item.lan ?? item.subtitle_url ?? item.url}`,
      language: normalizeSubtitleLanguage(item.lan) || null,
      label: item.lan_doc ?? item.lan ?? null,
      kind: "subtitles",
      platform: "bilibili",
      source: "bilibili-api",
      cues,
    }]
  },
}
