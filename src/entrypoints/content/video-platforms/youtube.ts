import { translateTexts } from "@/utils/translate/translate"
import { runInlineAction } from "../inline-actions"
import type { VideoPlatformConfig } from "./types"

const YOUTUBE_RENDER_TARGET_SELECTOR = ".ytp-caption-window-bottom, .ytp-caption-window-top"
const CUE_BATCH_SIZE = 20
const DUPLICATE_CUE_WINDOW_MS = 1_500
const DELAYED_TRACK_TIMEOUT_MS = 1_500
const ACTIVE_CUE_TOLERANCE_SECONDS = 0.35

export type YouTubeCaptionAnomaly =
  | "missing-track"
  | "delayed-track"
  | "duplicated-cue"
  | "stale-cue-race"

interface YouTubeCaptionTrack {
  baseUrl?: string
  vssId?: string
  languageCode?: string
  kind?: string
  isTranslatable?: boolean
}

interface TimedTextEvent {
  tStartMs?: number
  dDurationMs?: number
  segs?: Array<{ utf8?: string }>
}

interface TimedTextResponse {
  events?: TimedTextEvent[]
}

interface YouTubeTimedCue {
  startTime: number
  endTime: number
  text: string
  translation?: string
}

interface YouTubeHybridSessionDeps {
  targetLang: string
  rootContainer: HTMLElement
  cacheGet: (key: string) => string | undefined
  cachePut: (key: string, value: string) => void
  getDomCaptionText: (container: HTMLElement) => string
  injectTranslation: (container: HTMLElement, text: string, sourceText: string) => void
}

export interface YouTubeHybridSession {
  stop: () => void
}

function normalizeYouTubeCaptionText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseAdjacentDuplicates(parts: string[]): string[] {
  const normalized: string[] = []

  for (const part of parts) {
    const text = normalizeYouTubeCaptionText(part)
    if (!text) continue
    if (normalized.at(-1) === text) continue
    normalized.push(text)
  }

  return normalized
}

function extractYouTubeCaptionText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll(".astra-video-subtitle").forEach((el) => el.remove())

  const segments = Array.from(clone.querySelectorAll(".ytp-caption-segment"))
    .map((segment) => normalizeYouTubeCaptionText(segment.textContent ?? ""))
    .filter((segment) => segment.length > 0)

  if (segments.length > 0) {
    return collapseAdjacentDuplicates(segments).join(" ")
  }

  return normalizeYouTubeCaptionText(clone.textContent ?? "")
}

function getPlayerResponse(): unknown {
  const win = window as Window & {
    ytInitialPlayerResponse?: unknown
    ytplayer?: { config?: { args?: { player_response?: string } } }
  }

  if (win.ytInitialPlayerResponse) {
    return win.ytInitialPlayerResponse
  }

  const rawResponse = win.ytplayer?.config?.args?.player_response
  if (!rawResponse) return null

  try {
    return JSON.parse(rawResponse)
  } catch {
    return null
  }
}

function getCaptionTracksFromPlayerResponse(): YouTubeCaptionTrack[] {
  const playerResponse = getPlayerResponse() as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: YouTubeCaptionTrack[]
      }
    }
  } | null

  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  return Array.isArray(tracks) ? tracks : []
}

function normalizeLanguageCode(languageCode?: string): string {
  return (languageCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
}

function selectPreferredTrack(
  tracks: YouTubeCaptionTrack[],
  targetLang: string,
): YouTubeCaptionTrack | null {
  const normalizedTarget = normalizeLanguageCode(targetLang)

  return [...tracks]
    .filter((track) => typeof track.baseUrl === "string")
    .sort((left, right) => {
      const leftScore
        = (left.kind !== "asr" ? 40 : 5)
          + (normalizeLanguageCode(left.languageCode) !== normalizedTarget ? 20 : -15)
          + (left.isTranslatable ? 10 : 0)
      const rightScore
        = (right.kind !== "asr" ? 40 : 5)
          + (normalizeLanguageCode(right.languageCode) !== normalizedTarget ? 20 : -15)
          + (right.isTranslatable ? 10 : 0)
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
    // Ignore malformed URLs and fall back to the raw URL.
  }

  urls.add(baseUrl)
  return Array.from(urls)
}

function parseJson3TimedText(payload: string): YouTubeTimedCue[] {
  const parsed = JSON.parse(payload) as TimedTextResponse
  if (!Array.isArray(parsed.events)) return []

  return parsed.events
    .map((event) => {
      const text = collapseAdjacentDuplicates(
        (event.segs ?? []).map((segment) => normalizeYouTubeCaptionText(segment.utf8 ?? "")),
      ).join(" ")
      const startMs = typeof event.tStartMs === "number" ? event.tStartMs : Number.NaN
      const durationMs = typeof event.dDurationMs === "number" ? event.dDurationMs : Number.NaN

      return {
        startTime: startMs / 1000,
        endTime: (startMs + durationMs) / 1000,
        text,
      } satisfies YouTubeTimedCue
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)
}

function parseXmlTimedText(payload: string): YouTubeTimedCue[] {
  const xml = new DOMParser().parseFromString(payload, "text/xml")

  return Array.from(xml.querySelectorAll("text"))
    .map((node) => {
      const start = Number.parseFloat(node.getAttribute("start") ?? "")
      const duration = Number.parseFloat(node.getAttribute("dur") ?? "")
      return {
        startTime: start,
        endTime: start + duration,
        text: normalizeYouTubeCaptionText(node.textContent ?? ""),
      } satisfies YouTubeTimedCue
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)
}

function dedupeTimedCues(cues: YouTubeTimedCue[], onDuplicate: () => void): YouTubeTimedCue[] {
  const deduped: YouTubeTimedCue[] = []

  for (const cue of cues.sort((left, right) => left.startTime - right.startTime)) {
    const previous = deduped.at(-1)
    if (
      previous
      && previous.text === cue.text
      && Math.abs(previous.startTime - cue.startTime) < 0.05
      && Math.abs(previous.endTime - cue.endTime) < 0.05
    ) {
      onDuplicate()
      continue
    }
    deduped.push(cue)
  }

  return deduped
}

async function fetchTimedTextCues(
  track: YouTubeCaptionTrack,
  signal: AbortSignal,
  onDuplicate: () => void,
): Promise<YouTubeTimedCue[]> {
  if (!track.baseUrl) return []

  for (const url of buildTimedTextUrls(track.baseUrl)) {
    const response = await fetch(url, {
      credentials: "include",
      signal,
    })

    if (!response.ok) continue

    const payload = await response.text()
    if (!payload.trim()) continue

    try {
      const cues = payload.trim().startsWith("{")
        ? parseJson3TimedText(payload)
        : parseXmlTimedText(payload)

      if (cues.length > 0) {
        return dedupeTimedCues(cues, onDuplicate)
      }
    } catch {
      // Try the next payload format / URL.
    }
  }

  return []
}

function findYouTubeVideo(rootContainer: HTMLElement): HTMLVideoElement | null {
  const scopedVideo = rootContainer.closest(".html5-video-player")?.querySelector("video")
  if (scopedVideo instanceof HTMLVideoElement) {
    return scopedVideo
  }

  const mainVideo = document.querySelector("video.html5-main-video")
  if (mainVideo instanceof HTMLVideoElement) {
    return mainVideo
  }

  const firstVideo = document.querySelector("video")
  return firstVideo instanceof HTMLVideoElement ? firstVideo : null
}

function getRenderTarget(rootContainer: HTMLElement): HTMLElement {
  return rootContainer.querySelector<HTMLElement>(YOUTUBE_RENDER_TARGET_SELECTOR) ?? rootContainer
}

function clearRenderedTranslation(rootContainer: HTMLElement): void {
  getRenderTarget(rootContainer).querySelectorAll(".astra-video-subtitle").forEach((node) => node.remove())
}

function hasMatchingTranslation(
  container: HTMLElement,
  sourceText: string,
  translationText?: string,
): boolean {
  const existing = container.querySelector<HTMLElement>(".astra-video-subtitle")
  if (!existing || existing.getAttribute("data-source") !== sourceText) {
    return false
  }

  return translationText === undefined || existing.textContent === translationText
}

function getActiveTimedCues(cues: YouTubeTimedCue[], currentTime: number): YouTubeTimedCue[] {
  const active = cues.filter((cue) =>
    cue.startTime - ACTIVE_CUE_TOLERANCE_SECONDS <= currentTime
    && currentTime <= cue.endTime + ACTIVE_CUE_TOLERANCE_SECONDS,
  )

  if (active.length > 0) {
    return active
  }

  const nearest = cues.find((cue) =>
    Math.abs(cue.startTime - currentTime) <= ACTIVE_CUE_TOLERANCE_SECONDS,
  )

  return nearest ? [nearest] : []
}

function updateRootDataset(
  rootContainer: HTMLElement,
  options: {
    anomalies: Set<YouTubeCaptionAnomaly>
    status: string
    source?: "timedtext" | "dom"
  },
): void {
  rootContainer.dataset.astraCaptionPipeline = "youtube-hybrid"
  rootContainer.dataset.astraCaptionStatus = options.status
  rootContainer.dataset.astraCaptionAnomalies = Array.from(options.anomalies).join(" ")

  if (options.source) {
    rootContainer.dataset.astraCaptionSource = options.source
  } else {
    delete rootContainer.dataset.astraCaptionSource
  }
}

async function translateCueBatches(
  cues: YouTubeTimedCue[],
  targetLang: string,
  cacheGet: YouTubeHybridSessionDeps["cacheGet"],
  cachePut: YouTubeHybridSessionDeps["cachePut"],
): Promise<void> {
  const uniqueTexts = Array.from(new Set(cues.map((cue) => cue.text)))

  for (let index = 0; index < uniqueTexts.length; index += CUE_BATCH_SIZE) {
    const batch = uniqueTexts.slice(index, index + CUE_BATCH_SIZE)
    const uncached = batch.filter((text) => !cacheGet(`${text}|${targetLang}`))
    if (uncached.length === 0) continue

    const result = await translateTexts({
      texts: uncached,
      targetLang,
      task: "translate",
    })

    if (!result.ok) {
      return
    }

    uncached.forEach((text, translationIndex) => {
      const translation = result.translations[translationIndex]
      if (translation) {
        cachePut(`${text}|${targetLang}`, translation)
      }
    })
  }

  cues.forEach((cue) => {
    const translation = cacheGet(`${cue.text}|${targetLang}`)
    if (translation) {
      cue.translation = translation
    }
  })
}

export async function startYouTubeHybridSubtitleSession(
  deps: YouTubeHybridSessionDeps,
): Promise<YouTubeHybridSession | null> {
  const video = findYouTubeVideo(deps.rootContainer)
  if (!(video instanceof HTMLVideoElement)) {
    return null
  }

  const anomalies = new Set<YouTubeCaptionAnomaly>()
  const abortController = new AbortController()
  const pendingFallbackTranslations = new Set<string>()
  let cues: YouTubeTimedCue[] = []
  let stopped = false
  let delayedTrackTimer: ReturnType<typeof setTimeout> | null = null
  let mutationObserver: MutationObserver | null = null
  let lastDomText = ""
  let lastDomTextTimestamp = -Infinity
  let lastFallbackToken = 0

  const recordAnomaly = (anomaly: YouTubeCaptionAnomaly) => {
    anomalies.add(anomaly)
  }

  const refreshRootDataset = (status: string, source?: "timedtext" | "dom") => {
    updateRootDataset(deps.rootContainer, { anomalies, status, source })
  }

  const renderTimedTextCue = (): boolean => {
    if (cues.length === 0) return false

    const activeCues = getActiveTimedCues(cues, video.currentTime)
    if (activeCues.length === 0) {
      return false
    }

    const translations = activeCues
      .map((cue) => cue.translation ?? deps.cacheGet(`${cue.text}|${deps.targetLang}`))
      .filter((translation): translation is string => typeof translation === "string" && translation.trim().length > 0)

    if (translations.length !== activeCues.length) {
      return false
    }

    const renderTarget = getRenderTarget(deps.rootContainer)
    const sourceText = collapseAdjacentDuplicates(activeCues.map((cue) => cue.text)).join(" ")
    const translationText = collapseAdjacentDuplicates(translations).join("\n")

    if (!hasMatchingTranslation(renderTarget, sourceText, translationText)) {
      deps.injectTranslation(renderTarget, translationText, sourceText)
    }
    refreshRootDataset("ready", "timedtext")
    return true
  }

  const renderDomFallback = async (): Promise<void> => {
    const renderTarget = getRenderTarget(deps.rootContainer)
    const sourceText = deps.getDomCaptionText(renderTarget).trim()
    if (!sourceText || sourceText.length < 2) {
      return
    }

    const now = Date.now()
    if (sourceText === lastDomText && now - lastDomTextTimestamp <= DUPLICATE_CUE_WINDOW_MS) {
      recordAnomaly("duplicated-cue")
    }
    lastDomText = sourceText
    lastDomTextTimestamp = now

    const cacheKey = `${sourceText}|${deps.targetLang}`
    const cached = deps.cacheGet(cacheKey)
    if (cached) {
      if (!hasMatchingTranslation(renderTarget, sourceText, cached)) {
        deps.injectTranslation(renderTarget, cached, sourceText)
      }
      refreshRootDataset("fallback-ready", "dom")
      return
    }

    if (pendingFallbackTranslations.has(cacheKey)) {
      refreshRootDataset("fallback-pending", "dom")
      return
    }

    pendingFallbackTranslations.add(cacheKey)
    refreshRootDataset("fallback-pending", "dom")
    const fallbackToken = ++lastFallbackToken

    try {
      const result = await runInlineAction({
        text: sourceText,
        targetLang: deps.targetLang,
        task: "translate",
      })

      if (!result.ok || stopped) {
        return
      }

      const currentText = deps.getDomCaptionText(getRenderTarget(deps.rootContainer)).trim()
      const activeTimedCues = getActiveTimedCues(cues, video.currentTime)
      if (fallbackToken !== lastFallbackToken || currentText !== sourceText || activeTimedCues.length > 0) {
        recordAnomaly("stale-cue-race")
        refreshRootDataset(activeTimedCues.length > 0 ? "ready" : "fallback-stale", activeTimedCues.length > 0 ? "timedtext" : "dom")
        return
      }

      deps.cachePut(cacheKey, result.text)
      const currentRenderTarget = getRenderTarget(deps.rootContainer)
      if (!hasMatchingTranslation(currentRenderTarget, sourceText, result.text)) {
        deps.injectTranslation(currentRenderTarget, result.text, sourceText)
      }
      refreshRootDataset("fallback-ready", "dom")
    } finally {
      pendingFallbackTranslations.delete(cacheKey)
    }
  }

  const renderCurrentCue = () => {
    maybeRefreshTrack()

    if (renderTimedTextCue()) {
      return
    }

    const fallbackSourceText = deps.getDomCaptionText(getRenderTarget(deps.rootContainer)).trim()
    if (!fallbackSourceText || fallbackSourceText.length < 2) {
      clearRenderedTranslation(deps.rootContainer)
      refreshRootDataset(cues.length > 0 ? "ready" : "dom-fallback")
      return
    }

    void renderDomFallback()
  }

  refreshRootDataset("starting")

  let activeTrackBaseUrl: string | null = null
  let trackRefreshInFlight: Promise<void> | null = null

  const loadTimedTextTrack = async (track: YouTubeCaptionTrack): Promise<void> => {
    activeTrackBaseUrl = track.baseUrl ?? null

    if (delayedTrackTimer) {
      clearTimeout(delayedTrackTimer)
    }
    delayedTrackTimer = setTimeout(() => {
      if (!stopped && cues.length === 0 && activeTrackBaseUrl === track.baseUrl) {
        recordAnomaly("delayed-track")
        refreshRootDataset("waiting-track")
      }
    }, DELAYED_TRACK_TIMEOUT_MS)

    try {
      const nextCues = await fetchTimedTextCues(track, abortController.signal, () => {
        recordAnomaly("duplicated-cue")
        refreshRootDataset("prefetching")
      })

      if (stopped || activeTrackBaseUrl !== track.baseUrl) return

      if (delayedTrackTimer) {
        clearTimeout(delayedTrackTimer)
        delayedTrackTimer = null
      }

      if (nextCues.length === 0) {
        recordAnomaly("delayed-track")
        refreshRootDataset("dom-fallback")
        return
      }

      cues = nextCues
      lastFallbackToken += 1
      refreshRootDataset("prefetching")
      await translateCueBatches(cues, deps.targetLang, deps.cacheGet, deps.cachePut)

      if (stopped || activeTrackBaseUrl !== track.baseUrl) return
      renderCurrentCue()
    } catch (error) {
      if (stopped || abortController.signal.aborted || error instanceof DOMException && error.name === "AbortError") {
        return
      }
      recordAnomaly("delayed-track")
      refreshRootDataset("dom-fallback")
    }
  }

  const maybeRefreshTrack = () => {
    const nextTrack = selectPreferredTrack(getCaptionTracksFromPlayerResponse(), deps.targetLang)
    if (!nextTrack?.baseUrl) {
      if (activeTrackBaseUrl === null) {
        recordAnomaly("missing-track")
        refreshRootDataset("dom-fallback")
      }
      return
    }

    if (trackRefreshInFlight) return
    if (activeTrackBaseUrl === nextTrack.baseUrl && cues.length > 0) return

    trackRefreshInFlight = loadTimedTextTrack(nextTrack)
      .finally(() => {
        trackRefreshInFlight = null
      })
  }

  maybeRefreshTrack()

  mutationObserver = new MutationObserver(() => {
    renderCurrentCue()
  })
  mutationObserver.observe(deps.rootContainer, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  const playbackListener = () => {
    renderCurrentCue()
  }

  video.addEventListener("timeupdate", playbackListener)
  video.addEventListener("seeking", playbackListener)
  video.addEventListener("seeked", playbackListener)

  renderCurrentCue()

  return {
    stop() {
      stopped = true
      abortController.abort()
      if (delayedTrackTimer) {
        clearTimeout(delayedTrackTimer)
        delayedTrackTimer = null
      }
      mutationObserver?.disconnect()
      mutationObserver = null
      video.removeEventListener("timeupdate", playbackListener)
      video.removeEventListener("seeking", playbackListener)
      video.removeEventListener("seeked", playbackListener)
    },
  }
}

export const youtubePlatform: VideoPlatformConfig = {
  id: "youtube",
  hostnames: ["www.youtube.com", "m.youtube.com"],
  captionContainerSelector: ".ytp-caption-window-container",
  captionSegmentSelector: ".ytp-caption-segment",
  navigationEvent: "yt-navigate-finish",
  isVideoPage: () =>
    window.location.pathname === "/watch"
    || window.location.pathname.startsWith("/shorts/"),
  extractCaptionText: extractYouTubeCaptionText,
}
