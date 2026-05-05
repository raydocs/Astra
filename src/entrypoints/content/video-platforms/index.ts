/**
 * Multi-platform video subtitle translation.
 *
 * Detects the current video platform, observes native caption DOM,
 * translates captions, and injects bilingual subtitles below the original.
 */

import { runInlineAction } from "../inline-actions"
import { translateTexts } from "@/utils/translate/translate"
import { readConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  resolveSiteTranslationSettings,
  type AstraConfig,
  type ResolvedSiteTranslationSettings,
} from "@/types/config"
import type { VideoNotePlatform, VideoNoteTranscriptCapture } from "@/types/video-notes"
import type { SubtitleQualitySnapshot } from "@/types/translation"

import type { VideoPlatformConfig, VideoSubtitleRenderingRule } from "./types"
import {
  captureYouTubeVideoNoteTranscript,
  getYouTubeVideoNoteTitle,
  startYouTubeHybridSubtitleSession,
  youtubePlatform,
} from "./youtube"
import {
  bilibiliPlatform,
  captureBilibiliVideoNoteTranscript,
  getBilibiliVideoNoteTitle,
} from "./bilibili"
import { netflixPlatform } from "./netflix"
import { primevideoPlatform } from "./primevideo"
import { disneyplusPlatform } from "./disneyplus"
import { udemyPlatform } from "./udemy"
import { courseraPlatform } from "./coursera"
import { vimeoPlatform } from "./vimeo"
import { tedPlatform } from "./ted"
import { khanAcademyPlatform } from "./khanacademy"

const ALL_PLATFORMS: VideoPlatformConfig[] = [
  youtubePlatform,
  bilibiliPlatform,
  netflixPlatform,
  primevideoPlatform,
  disneyplusPlatform,
  udemyPlatform,
  courseraPlatform,
  vimeoPlatform,
  tedPlatform,
  khanAcademyPlatform,
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

interface CaptionPresentationStyle {
  mode: ResolvedSiteTranslationSettings["presentation"]["mode"]
  theme: ResolvedSiteTranslationSettings["presentation"]["theme"]
  fontSize?: string
  translationColor?: string
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

export interface VideoNoteSourcePayload {
  sourceUrl: string
  title: string | null
  platform: VideoNotePlatform
  capture: VideoNoteTranscriptCapture | null
}

function normalizeSourceUrlForVideoNote(): string {
  const url = new URL(window.location.href)
  url.hash = ""
  return url.toString()
}

export function detectVideoPlatform(): VideoPlatformConfig | null {
  return detectPlatform()
}

export async function captureCurrentVideoNoteSource(): Promise<VideoNoteSourcePayload | null> {
  const platform = detectPlatform()
  if (!platform || !platform.isVideoPage()) {
    return null
  }

  if (platform.id === "youtube") {
    const rootContainer = document.querySelector(platform.captionContainerSelector)
    const captureHost = rootContainer instanceof HTMLElement ? rootContainer : document.body
    const capture = await captureYouTubeVideoNoteTranscript(captureHost)

    return {
      sourceUrl: normalizeSourceUrlForVideoNote(),
      title: getYouTubeVideoNoteTitle(),
      platform: "youtube",
      capture,
    }
  }

  if (platform.id === "bilibili") {
    return {
      sourceUrl: normalizeSourceUrlForVideoNote(),
      title: getBilibiliVideoNoteTitle(),
      platform: "bilibili",
      capture: captureBilibiliVideoNoteTranscript(),
    }
  }

  return null
}

function resolveCaptionPresentationStyle(
  config: AstraConfig,
  resolved: ResolvedSiteTranslationSettings,
): CaptionPresentationStyle {
  const sitePresentation = resolved.hostname
    ? config.sites[resolved.hostname]?.presentation
    : undefined
  const globalPresentation = config.presentation ?? DEFAULT_ASTRA_CONFIG.presentation
  const defaultPresentation = DEFAULT_ASTRA_CONFIG.presentation

  const hasFontSizeOverride = sitePresentation?.fontSize != null
    || globalPresentation.fontSize !== defaultPresentation.fontSize
  const hasColorOverride = !!sitePresentation?.translationColor
    || globalPresentation.translationColor !== defaultPresentation.translationColor

  return {
    mode: resolved.presentation.mode,
    theme: resolved.presentation.theme,
    ...(hasFontSizeOverride ? { fontSize: `${resolved.presentation.fontSize}em` } : {}),
    ...(hasColorOverride ? { translationColor: resolved.presentation.translationColor } : {}),
  }
}

async function getResolvedSubtitleSettings(): Promise<{
  targetLang: string
  presentation: CaptionPresentationStyle
}> {
  const config = await readConfig()
  const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
  return {
    targetLang: resolved.targetLang,
    presentation: resolveCaptionPresentationStyle(config, resolved),
  }
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${ASTRA_SUBTITLE_CLASS} {
      display: block;
      color: var(--astra-caption-color, #fffc);
      font-size: var(--astra-caption-font-size, 0.85em);
      line-height: 1.4;
      white-space: pre-line;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      margin-top: 2px;
      margin-left: auto;
      margin-right: auto;
      max-width: var(--astra-caption-max-width, none);
      text-align: var(--astra-caption-text-align, center);
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 3px;
      pointer-events: none;
      font-family: "YouTube Noto", Roboto, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }

    .${ASTRA_SUBTITLE_CLASS}[data-astra-presentation-theme="underline"] {
      background: transparent;
      border-bottom: 2px solid var(--astra-caption-color, #fffc);
      border-radius: 0;
      padding-inline: 2px;
    }

    .${ASTRA_SUBTITLE_CLASS}[data-astra-presentation-theme="highlight"] {
      background: rgba(99, 102, 241, 0.82);
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

function applyPresentationStyle(el: HTMLElement, presentation: CaptionPresentationStyle): void {
  el.dataset.astraPresentationMode = presentation.mode
  el.dataset.astraPresentationTheme = presentation.theme
  if (presentation.fontSize) {
    el.style.setProperty("--astra-caption-font-size", presentation.fontSize)
  }
  if (presentation.translationColor) {
    el.style.setProperty("--astra-caption-color", presentation.translationColor)
  }
}

function applyPlatformRenderingRule(el: HTMLElement, rule: VideoSubtitleRenderingRule): void {
  el.dataset.astraRenderRuleId = rule.ruleId
  el.dataset.astraRenderSurface = rule.surface
  el.dataset.astraRenderInsertionPoint = rule.insertionPoint
  el.dataset.astraNativeCuePolicy = rule.nativeCuePolicy
  el.style.setProperty("--astra-caption-max-width", rule.maxWidth)
  el.style.setProperty("--astra-caption-text-align", rule.textAlign)
  rule.className
    .split(/\s+/)
    .filter(Boolean)
    .forEach((className) => el.classList.add(className))
}

function injectTranslation(
  container: HTMLElement,
  text: string,
  sourceText: string,
  presentation: CaptionPresentationStyle,
  renderingRule: VideoSubtitleRenderingRule,
): void {
  clearInjectedTranslations(container)
  const el = document.createElement("span")
  el.className = ASTRA_SUBTITLE_CLASS
  el.textContent = text
  el.setAttribute("data-source", sourceText)
  applyPresentationStyle(el, presentation)
  applyPlatformRenderingRule(el, renderingRule)
  container.appendChild(el)
}

async function translateAndInject(
  platform: VideoPlatformConfig,
  captionWindow: HTMLElement,
  targetLang: string,
  presentation: CaptionPresentationStyle,
): Promise<void> {
  const sourceText = getCaptionText(platform, captionWindow).trim()
  if (!sourceText || sourceText.length < 2) return

  const existing = captionWindow.querySelector(`.${ASTRA_SUBTITLE_CLASS}`)
  if (existing?.getAttribute("data-source") === sourceText) return

  const cacheKey = `${sourceText}|${targetLang}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    injectTranslation(captionWindow, cached, sourceText, presentation, platform.subtitleRendering)
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
        injectTranslation(captionWindow, result.text, sourceText, presentation, platform.subtitleRendering)
      }
    }
  } finally {
    pendingTranslations.delete(cacheKey)
  }
}

function handleCaptionMutation(
  platform: VideoPlatformConfig,
  targetLang: string,
  presentation: CaptionPresentationStyle,
): void {
  const container = document.querySelector(platform.captionContainerSelector)
  if (!container) return

  const children = container.children
  let foundChild = false

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index] as HTMLElement
    if (child.classList.contains(ASTRA_SUBTITLE_CLASS)) continue
    const text = getCaptionText(platform, child)
    if (text) {
      void translateAndInject(platform, child, targetLang, presentation)
      foundChild = true
    }
  }

  if (!foundChild) {
    const text = getCaptionText(platform, container as HTMLElement)
    if (text) void translateAndInject(platform, container as HTMLElement, targetLang, presentation)
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
  presentation: CaptionPresentationStyle,
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
      injectTranslation(renderTarget, translationText, sourceText, presentation, platform.subtitleRendering)
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
    void translateAndInject(platform, fallbackTarget, targetLang, presentation)
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

export function isVideoSubtitleTranslationActive(): boolean {
  return activePlatform !== null
}

function readCaptionDatasetValue(
  element: HTMLElement | null,
  key: keyof HTMLElement["dataset"],
): string | null {
  const value = element?.dataset[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

export function getVideoSubtitleQualitySnapshot(): SubtitleQualitySnapshot | null {
  if (!activePlatform) return null

  const container = document.querySelector(activePlatform.captionContainerSelector)
  const captionRoot = container instanceof HTMLElement ? container : null
  const sourceText = captionRoot ? getCaptionText(activePlatform, captionRoot).trim() : ""
  const anomalies = readCaptionDatasetValue(captionRoot, "astraCaptionAnomalies")
    ?.split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean) ?? []

  return {
    surface: "video",
    active: true,
    platform: activePlatform.id,
    pipeline: readCaptionDatasetValue(captionRoot, "astraCaptionPipeline"),
    source: readCaptionDatasetValue(captionRoot, "astraCaptionSource"),
    status: readCaptionDatasetValue(captionRoot, "astraCaptionStatus") ?? (captionRoot ? "observing" : "starting"),
    anomalies,
    translatedNodeCount: captionRoot?.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).length ?? 0,
    sourceTextLength: sourceText.length,
    pendingRequestCount: pendingTranslations.size,
    cacheSize: translationCache.size,
    capturedAt: Date.now(),
  }
}

export async function startVideoSubtitleTranslation(): Promise<void> {
  const platform = detectPlatform()
  if (!platform || !platform.isVideoPage() || activePlatform) return

  activePlatform = platform
  const { targetLang, presentation } = await getResolvedSubtitleSettings()
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
      injectTranslation: (captionContainer, text, sourceText) => injectTranslation(
        captionContainer,
        text,
        sourceText,
        presentation,
        platform.subtitleRendering,
      ),
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
      presentation,
    )

    if (sessionStop) {
      activeSessionStop = sessionStop
      void preloadSubtitleBatch(platform, targetLang)
      return
    }
  }

  observer = new MutationObserver(() => {
    handleCaptionMutation(platform, targetLang, presentation)
  })
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  handleCaptionMutation(platform, targetLang, presentation)
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

export function getSupportedPlatformRenderingRules(): Array<{
  id: string
  subtitleRendering: VideoSubtitleRenderingRule
}> {
  return ALL_PLATFORMS.map((platform) => ({
    id: platform.id,
    subtitleRendering: platform.subtitleRendering,
  }))
}
