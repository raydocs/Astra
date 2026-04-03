/**
 * Multi-platform video subtitle translation.
 *
 * Detects the current video platform, observes native caption DOM,
 * translates captions, and injects bilingual subtitles below the original.
 */

import { runInlineAction } from "../inline-actions"
import { translateTexts } from "@/utils/translate/translate"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"

import type { VideoPlatformConfig } from "./types"
import { startYouTubeHybridSubtitleSession, youtubePlatform } from "./youtube"
import { bilibiliPlatform } from "./bilibili"
import { netflixPlatform } from "./netflix"

const ALL_PLATFORMS: VideoPlatformConfig[] = [
  youtubePlatform,
  bilibiliPlatform,
  netflixPlatform,
]

const ASTRA_SUBTITLE_CLASS = "astra-video-subtitle"
const STYLE_ID = "astra-video-subtitle-styles"
const PRELOAD_BATCH_SIZE = 15
const STRUCTURED_CUE_BATCH_SIZE = 20
const STRUCTURED_CUE_TOLERANCE_SECONDS = 0.35
const STRUCTURED_TRACK_LOAD_WAIT_MS = 100

interface StructuredTrackCue {
  startTime: number
  endTime: number
  text: string
  translation?: string
}

const MAX_CACHE_SIZE = 500
const translationCache = new Map<string, string>()
const pendingTranslations = new Set<string>()

function cachePut(key: string, value: string): void {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value
    if (firstKey !== undefined) translationCache.delete(firstKey)
  }
  translationCache.set(key, value)
}

function cacheGet(key: string): string | undefined {
  const value = translationCache.get(key)
  if (value !== undefined) {
    translationCache.delete(key)
    translationCache.set(key, value)
  }
  return value
}

let observer: MutationObserver | null = null
let activePlatform: VideoPlatformConfig | null = null
let preloadAbort: AbortController | null = null
let activeSessionStop: (() => void) | null = null

function detectPlatform(): VideoPlatformConfig | null {
  const hostname = window.location.hostname
  return ALL_PLATFORMS.find((p) => p.hostnames.includes(hostname)) ?? null
}

async function getTargetLang(): Promise<string> {
  const config = await readConfig()
  const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
  return resolved.targetLang
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${ASTRA_SUBTITLE_CLASS} {
      display: block;
      color: #fffc;
      font-size: 0.85em;
      line-height: 1.4;
      white-space: pre-line;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      margin-top: 2px;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 3px;
      pointer-events: none;
      font-family: "YouTube Noto", Roboto, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }
  `
  document.head.appendChild(style)
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove()
}

function getCaptionText(platform: VideoPlatformConfig, container: HTMLElement): string {
  if (platform.extractCaptionText) {
    return platform.extractCaptionText(container)
  }

  if (platform.captionSegmentSelector) {
    const segments = container.querySelectorAll(platform.captionSegmentSelector)
    if (segments.length > 0) {
      return Array.from(segments)
        .map((seg) => seg.textContent ?? "")
        .join(" ")
        .trim()
    }
  }

  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => el.remove())
  return clone.textContent?.trim() ?? ""
}

function clearInjectedTranslations(container: ParentNode): void {
  container.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => el.remove())
}

function hasMatchingTranslation(
  container: HTMLElement,
  sourceText: string,
  translationText?: string,
): boolean {
  const existing = container.querySelector<HTMLElement>(`.${ASTRA_SUBTITLE_CLASS}`)
  if (!existing || existing.getAttribute("data-source") !== sourceText) {
    return false
  }

  return translationText === undefined || existing.textContent === translationText
}

function injectTranslation(container: HTMLElement, text: string, sourceText: string): void {
  clearInjectedTranslations(container)
  const el = document.createElement("span")
  el.className = ASTRA_SUBTITLE_CLASS
  el.textContent = text
  el.setAttribute("data-source", sourceText)
  container.appendChild(el)
}

async function translateAndInject(
  platform: VideoPlatformConfig,
  captionWindow: HTMLElement,
  targetLang: string,
): Promise<void> {
  const sourceText = getCaptionText(platform, captionWindow).trim()
  if (!sourceText || sourceText.length < 2) return

  const existing = captionWindow.querySelector(`.${ASTRA_SUBTITLE_CLASS}`)
  if (existing?.getAttribute("data-source") === sourceText) return

  const cacheKey = `${sourceText}|${targetLang}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    injectTranslation(captionWindow, cached, sourceText)
    return
  }

  if (pendingTranslations.has(cacheKey)) return
  pendingTranslations.add(cacheKey)

  try {
    const result = await runInlineAction({
      text: sourceText,
      targetLang,
      task: "translate",
    })

    if (result.ok) {
      cachePut(cacheKey, result.text)
      const currentText = getCaptionText(platform, captionWindow).trim()
      if (currentText === sourceText) {
        injectTranslation(captionWindow, result.text, sourceText)
      }
    }
  } finally {
    pendingTranslations.delete(cacheKey)
  }
}

function handleCaptionMutation(platform: VideoPlatformConfig, targetLang: string): void {
  const container = document.querySelector(platform.captionContainerSelector)
  if (!container) return

  const children = container.children
  let foundChild = false

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index] as HTMLElement
    if (child.classList.contains(ASTRA_SUBTITLE_CLASS)) continue
    const text = getCaptionText(platform, child)
    if (text) {
      void translateAndInject(platform, child, targetLang)
      foundChild = true
    }
  }

  if (!foundChild) {
    const text = getCaptionText(platform, container as HTMLElement)
    if (text) void translateAndInject(platform, container as HTMLElement, targetLang)
  }
}

function waitForElement(selector: string, timeoutMs = 10000): Promise<Element | null> {
  const existing = document.querySelector(selector)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const obs = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) {
        obs.disconnect()
        resolve(found)
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      obs.disconnect()
      resolve(null)
    }, timeoutMs)
  })
}

function normalizeLanguageCode(languageCode?: string): string {
  return (languageCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
}

function findVideoForContainer(rootContainer: HTMLElement): HTMLVideoElement | null {
  const scopedVideo = rootContainer.closest(".html5-video-player, .bpx-player-container, .watch-video, [data-uia='video-canvas']")?.querySelector("video")
  if (scopedVideo instanceof HTMLVideoElement) {
    return scopedVideo
  }

  const siblingVideo = rootContainer.parentElement?.querySelector("video")
  return siblingVideo instanceof HTMLVideoElement ? siblingVideo : null
}

function collectTrackCues(track: TextTrack): StructuredTrackCue[] {
  if (!track.cues) return []

  const cues: StructuredTrackCue[] = []
  for (let index = 0; index < track.cues.length; index += 1) {
    const cue = track.cues[index]
    if (!cue) continue

    const text = "text" in cue && typeof cue.text === "string"
      ? cue.text
      : ""
    const normalizedText = text
      .replace(/<\/?[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()

    if (!normalizedText) continue
    cues.push({
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: normalizedText,
    })
  }

  return cues
}

function scoreTextTrack(track: TextTrack, targetLang: string): number {
  if (track.label.startsWith("Astra: ")) return Number.NEGATIVE_INFINITY
  if (track.kind !== "subtitles" && track.kind !== "captions") {
    return Number.NEGATIVE_INFINITY
  }

  let score = 0
  if (track.mode === "showing") score += 10
  if (track.kind === "captions") score += 3
  if (normalizeLanguageCode(track.language) !== normalizeLanguageCode(targetLang)) score += 8
  if ((track.label ?? "").trim().length > 0) score += 2
  return score
}

async function collectStructuredTrackCues(
  video: HTMLVideoElement,
  targetLang: string,
): Promise<StructuredTrackCue[]> {
  const tracks = Array.from(video.textTracks)
    .map((track) => ({ track, score: scoreTextTrack(track, targetLang) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score)

  for (const { track } of tracks) {
    const previousMode = track.mode
    if (track.mode === "disabled") {
      track.mode = "hidden"
      await new Promise((resolve) => setTimeout(resolve, STRUCTURED_TRACK_LOAD_WAIT_MS))
    }

    const cues = collectTrackCues(track)

    if (previousMode === "disabled") {
      track.mode = previousMode
    }

    if (cues.length > 0) {
      return cues
    }
  }

  return []
}

function buildTextTrackSignature(video: HTMLVideoElement, targetLang: string): string {
  return Array.from(video.textTracks)
    .map((track) => {
      const cueCount = track.cues?.length ?? 0
      return [
        scoreTextTrack(track, targetLang),
        track.kind,
        track.label,
        track.language,
        track.mode,
        cueCount,
      ].join(":")
    })
    .join("|")
}

async function translateStructuredCues(
  cues: StructuredTrackCue[],
  targetLang: string,
): Promise<void> {
  const uniqueTexts = Array.from(new Set(cues.map((cue) => cue.text)))

  for (let index = 0; index < uniqueTexts.length; index += STRUCTURED_CUE_BATCH_SIZE) {
    const batch = uniqueTexts.slice(index, index + STRUCTURED_CUE_BATCH_SIZE)
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

function getActiveStructuredCues(cues: StructuredTrackCue[], currentTime: number): StructuredTrackCue[] {
  return cues.filter((cue) =>
    cue.startTime - STRUCTURED_CUE_TOLERANCE_SECONDS <= currentTime
    && currentTime <= cue.endTime + STRUCTURED_CUE_TOLERANCE_SECONDS,
  )
}

function findFallbackCaptionWindow(
  platform: VideoPlatformConfig,
  rootContainer: HTMLElement,
): HTMLElement {
  const children = Array.from(rootContainer.children)
  for (const child of children) {
    if (!(child instanceof HTMLElement) || child.classList.contains(ASTRA_SUBTITLE_CLASS)) continue
    if (getCaptionText(platform, child).trim()) {
      return child
    }
  }

  return rootContainer
}

async function startStructuredTrackSubtitleSession(
  platform: VideoPlatformConfig,
  rootContainer: HTMLElement,
  targetLang: string,
): Promise<(() => void) | null> {
  const video = findVideoForContainer(rootContainer)
  if (!(video instanceof HTMLVideoElement)) {
    return null
  }

  let stopped = false
  let cues = await collectStructuredTrackCues(video, targetLang)
  let trackSignature = buildTextTrackSignature(video, targetLang)
  let refreshInFlight: Promise<void> | null = null

  if (stopped) {
    return null
  }

  if (cues.length > 0) {
    await translateStructuredCues(cues, targetLang)
  }

  const refreshStructuredCues = () => {
    const nextSignature = buildTextTrackSignature(video, targetLang)
    if (stopped || refreshInFlight || (nextSignature === trackSignature && cues.length > 0)) {
      return
    }

    refreshInFlight = (async () => {
      const nextCues = await collectStructuredTrackCues(video, targetLang)
      if (stopped) return

      trackSignature = buildTextTrackSignature(video, targetLang)
      cues = nextCues
      if (cues.length > 0) {
        await translateStructuredCues(cues, targetLang)
      }
      if (stopped) return
      renderCurrent()
    })().finally(() => {
      refreshInFlight = null
    })
  }

  const renderStructured = (): boolean => {
    if (cues.length === 0) return false

    const activeCues = getActiveStructuredCues(cues, video.currentTime)
    if (activeCues.length === 0) {
      return false
    }

    const translations = activeCues
      .map((cue) => cue.translation ?? cacheGet(`${cue.text}|${targetLang}`))
      .filter((translation): translation is string => typeof translation === "string" && translation.trim().length > 0)

    if (translations.length !== activeCues.length) {
      return false
    }

    const renderTarget = findFallbackCaptionWindow(platform, rootContainer)
    const sourceText = activeCues.map((cue) => cue.text).join(" ")
    const translationText = translations.join("\n")

    if (!hasMatchingTranslation(renderTarget, sourceText, translationText)) {
      injectTranslation(renderTarget, translationText, sourceText)
    }

    rootContainer.dataset.astraCaptionPipeline = `${platform.id}-layered`
    rootContainer.dataset.astraCaptionSource = "text-track"
    rootContainer.dataset.astraCaptionStatus = "ready"
    return true
  }

  const renderCurrent = () => {
    if (stopped) return

    if (buildTextTrackSignature(video, targetLang) !== trackSignature || cues.length === 0) {
      refreshStructuredCues()
    }

    if (renderStructured()) {
      return
    }

    const fallbackTarget = findFallbackCaptionWindow(platform, rootContainer)
    const fallbackText = getCaptionText(platform, fallbackTarget).trim()
    if (!fallbackText) {
      clearInjectedTranslations(rootContainer)
      rootContainer.dataset.astraCaptionPipeline = `${platform.id}-layered`
      rootContainer.dataset.astraCaptionStatus = cues.length > 0 ? "ready" : "dom-fallback"
      delete rootContainer.dataset.astraCaptionSource
      return
    }

    rootContainer.dataset.astraCaptionPipeline = `${platform.id}-layered`
    rootContainer.dataset.astraCaptionSource = "dom"
    rootContainer.dataset.astraCaptionStatus = "fallback-ready"
    void translateAndInject(platform, fallbackTarget, targetLang)
  }

  const sessionObserver = new MutationObserver(() => {
    renderCurrent()
  })
  sessionObserver.observe(rootContainer, { childList: true, subtree: true, characterData: true })

  const playbackListener = () => {
    renderCurrent()
  }

  video.addEventListener("timeupdate", playbackListener)
  video.addEventListener("seeking", playbackListener)
  video.addEventListener("seeked", playbackListener)

  renderCurrent()

  return () => {
    stopped = true
    sessionObserver.disconnect()
    video.removeEventListener("timeupdate", playbackListener)
    video.removeEventListener("seeking", playbackListener)
    video.removeEventListener("seeked", playbackListener)
  }
}

async function preloadSubtitleBatch(
  platform: VideoPlatformConfig,
  targetLang: string,
  durationMs = 5000,
): Promise<void> {
  const collected = new Set<string>()
  const container = document.querySelector(platform.captionContainerSelector)
  if (!container) return

  const abort = new AbortController()
  preloadAbort = abort

  const collectFromContainer = (): void => {
    const children = container.children
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index] as HTMLElement
      if (child.classList.contains(ASTRA_SUBTITLE_CLASS)) continue
      const text = getCaptionText(platform, child).trim()
      if (text && text.length >= 2) {
        collected.add(text)
      }
    }

    const containerText = getCaptionText(platform, container as HTMLElement).trim()
    if (containerText && containerText.length >= 2) {
      collected.add(containerText)
    }
  }

  collectFromContainer()

  const collectObserver = new MutationObserver(() => {
    if (abort.signal.aborted) return
    collectFromContainer()
  })
  collectObserver.observe(container, { childList: true, subtree: true, characterData: true })

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      resolve()
    }, durationMs)
    abort.signal.addEventListener("abort", () => {
      clearTimeout(timer)
      resolve()
    })
  })

  collectObserver.disconnect()
  if (abort.signal.aborted) return

  const texts = Array.from(collected).filter((text) => !cacheGet(`${text}|${targetLang}`))
  if (texts.length === 0) return

  for (let index = 0; index < texts.length; index += PRELOAD_BATCH_SIZE) {
    if (abort.signal.aborted) return

    const batch = texts.slice(index, index + PRELOAD_BATCH_SIZE)
    try {
      const result = await translateTexts({
        texts: batch,
        targetLang,
        task: "translate",
      })

      if (result.ok) {
        for (let translationIndex = 0; translationIndex < batch.length; translationIndex += 1) {
          if (result.translations[translationIndex]) {
            cachePut(`${batch[translationIndex]}|${targetLang}`, result.translations[translationIndex])
          }
        }
      }
    } catch {
      console.warn("[Astra] Subtitle preload batch failed, falling back to per-cue translation")
    }
  }
}

export function isVideoPage(): boolean {
  const platform = detectPlatform()
  return platform !== null && platform.isVideoPage()
}

export async function startVideoSubtitleTranslation(): Promise<void> {
  const platform = detectPlatform()
  if (!platform || !platform.isVideoPage() || activePlatform) return

  activePlatform = platform
  const targetLang = await getTargetLang()
  injectStyles()

  const container = await waitForElement(platform.captionContainerSelector)
  if (!container) {
    activePlatform = null
    return
  }

  if (platform.id === "youtube") {
    const session = await startYouTubeHybridSubtitleSession({
      targetLang,
      rootContainer: container as HTMLElement,
      cacheGet,
      cachePut,
      getDomCaptionText: (captionContainer) => getCaptionText(platform, captionContainer),
      injectTranslation,
    })

    if (session) {
      activeSessionStop = session.stop
      return
    }
  }

  if (platform.preferTextTracks) {
    const sessionStop = await startStructuredTrackSubtitleSession(
      platform,
      container as HTMLElement,
      targetLang,
    )

    if (sessionStop) {
      activeSessionStop = sessionStop
      void preloadSubtitleBatch(platform, targetLang)
      return
    }
  }

  observer = new MutationObserver(() => {
    handleCaptionMutation(platform, targetLang)
  })
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  handleCaptionMutation(platform, targetLang)
  activeSessionStop = null
  void preloadSubtitleBatch(platform, targetLang)
}

export function stopVideoSubtitleTranslation(): void {
  if (!activePlatform) return
  activePlatform = null
  activeSessionStop?.()
  activeSessionStop = null
  preloadAbort?.abort()
  preloadAbort = null
  observer?.disconnect()
  observer = null
  clearInjectedTranslations(document)
  removeStyles()
}

export function clearVideoSubtitleCache(): void {
  translationCache.clear()
}

export function setupVideoNavigationHandler(): void {
  const platform = detectPlatform()
  if (!platform?.navigationEvent) return

  let lastUrl = window.location.href
  window.addEventListener(platform.navigationEvent, () => {
    const newUrl = window.location.href
    if (newUrl !== lastUrl) {
      lastUrl = newUrl
      stopVideoSubtitleTranslation()
      clearVideoSubtitleCache()
      if (platform.isVideoPage()) {
        void startVideoSubtitleTranslation()
      }
    }
  })
}

export function getSupportedPlatformIds(): string[] {
  return ALL_PLATFORMS.map((p) => p.id)
}
