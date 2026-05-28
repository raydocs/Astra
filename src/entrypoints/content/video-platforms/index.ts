/**
 * Multi-platform video subtitle translation.
 *
 * Detects the current video platform, observes native caption DOM,
 * translates captions, and injects bilingual subtitles below the original.
 */

import { runInlineAction } from "../inline-actions"
import { translateTexts } from "@/utils/translate/translate"
import { readConfig, saveConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  resolveSiteTranslationSettings,
  type AstraConfig,
  type ResolvedSiteTranslationSettings,
  type ServiceMode,
} from "@/types/config"
import type { VideoNoteLearningContext, VideoNotePlatform, VideoNoteTranscriptCapture } from "@/types/video-notes"
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
import { getVideoTranscriptPanelLearningContext, mountVideoTranscriptPanel, unmountVideoTranscriptPanel } from "./transcript-panel"

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
const CONTROL_STYLE_ID = "astra-video-control-styles"
const YOUTUBE_CONTROL_BUTTON_ID = "astra-youtube-player-button"
const YOUTUBE_SETTINGS_BUTTON_ID = "astra-youtube-player-settings-button"
const YOUTUBE_SETTINGS_POPOVER_ID = "astra-youtube-player-settings-popover"
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
let videoControlButton: HTMLButtonElement | null = null
let videoSettingsButton: HTMLButtonElement | null = null
let videoSettingsPopover: HTMLElement | null = null
let videoCaptionPosition: "bottom" | "center" | "top" = "bottom"

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

    const sourceUrl = normalizeSourceUrlForVideoNote()
    const learningContext = getVideoTranscriptPanelLearningContext()
    const captureLearningContext: VideoNoteLearningContext = learningContext ?? {
      bilingualTranscriptSegments: [],
      summary: null,
      savedSentences: [],
      savedWords: [],
    }
    return {
      sourceUrl,
      title: getYouTubeVideoNoteTitle(),
      platform: "youtube",
      capture: capture
        ? {
            ...capture,
            learningContext: {
              ...captureLearningContext,
              videoMetadata: {
                title: getYouTubeVideoNoteTitle(),
                sourceUrl,
                platform: "youtube",
                durationSec: capture.durationSec ?? learningContext?.videoMetadata?.durationSec ?? null,
              },
            },
          }
        : null,
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
  serviceMode: ServiceMode
  presentation: CaptionPresentationStyle
}> {
  const config = await readConfig()
  const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
  return {
    targetLang: resolved.targetLang,
    serviceMode: config.serviceMode,
    presentation: resolveCaptionPresentationStyle(config, resolved),
  }
}

function makeSubtitleCacheKey(sourceText: string, targetLang: string, serviceMode: ServiceMode): string {
  return `${sourceText}|${targetLang}|${serviceMode}`
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

    .${ASTRA_SUBTITLE_CLASS}[data-astra-presentation-theme="mask"] {
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(3px);
    }

    .${ASTRA_SUBTITLE_CLASS}[data-astra-video-caption-position="top"] {
      transform: translateY(-28px);
    }

    .${ASTRA_SUBTITLE_CLASS}[data-astra-video-caption-position="center"] {
      transform: translateY(-14px);
    }

    .ytp-caption-window-bottom[data-astra-presentation-mode="translation-only"] .ytp-caption-segment,
    .ytp-caption-window-top[data-astra-presentation-mode="translation-only"] .ytp-caption-segment {
      display: none !important;
    }
  `
  document.head.appendChild(style)
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove()
}

function injectVideoControlStyles(): void {
  if (document.getElementById(CONTROL_STYLE_ID)) return
  const style = document.createElement("style")
  style.id = CONTROL_STYLE_ID
  style.textContent = `
    #${YOUTUBE_CONTROL_BUTTON_ID},
    #${YOUTUBE_SETTINGS_BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      height: 28px;
      padding: 0 8px;
      margin-inline: 4px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.82);
      color: #fff;
      font: 600 11px/1.2 Roboto, Arial, sans-serif;
      cursor: pointer;
      pointer-events: auto;
    }

    #${YOUTUBE_SETTINGS_BUTTON_ID} {
      width: 28px;
      justify-content: center;
      padding: 0;
      margin-left: 0;
    }

    #${YOUTUBE_CONTROL_BUTTON_ID}:hover,
    #${YOUTUBE_SETTINGS_BUTTON_ID}:hover,
    #${YOUTUBE_SETTINGS_BUTTON_ID}[aria-expanded="true"] {
      background: rgba(79, 70, 229, 0.92);
    }

    #${YOUTUBE_CONTROL_BUTTON_ID} [data-astra-video-control-status] {
      opacity: 0.86;
      font-weight: 500;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID} {
      position: absolute;
      right: 16px;
      bottom: 44px;
      z-index: 2147483647;
      width: 268px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.96);
      color: #fff;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
      font: 500 12px/1.35 Roboto, Arial, sans-serif;
      pointer-events: auto;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID}[hidden] {
      display: none;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID} [data-astra-video-settings-title] {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-weight: 700;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID} [data-astra-video-settings-group] {
      display: grid;
      gap: 6px;
      margin-top: 10px;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID} [data-astra-video-settings-row] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID} button {
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      padding: 5px 8px;
      font: inherit;
      cursor: pointer;
    }

    #${YOUTUBE_SETTINGS_POPOVER_ID} button:hover,
    #${YOUTUBE_SETTINGS_POPOVER_ID} button[data-astra-selected="true"] {
      background: rgba(99, 102, 241, 0.82);
    }
  `
  document.head.appendChild(style)
}

function getYouTubeControlHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".ytp-right-controls")
    ?? document.querySelector<HTMLElement>(".ytp-miniplayer-controls")
    ?? document.querySelector<HTMLElement>(".ytp-chrome-controls")
    ?? document.querySelector<HTMLElement>(".html5-video-player")
    ?? document.querySelector<HTMLElement>("#movie_player")
}

function mapVideoControlStatus(): "Off" | "Translating" | "On" | "Retry" | "No captions" {
  if (!activePlatform) return "Off"
  const status = getVideoSubtitleQualitySnapshot()?.status ?? "starting"
  if (/no-captions/i.test(status)) return "No captions"
  if (/error|failed|stale|missing/i.test(status)) return "Retry"
  if (/ready|observing|fallback-ready/i.test(status)) return "On"
  return "Translating"
}

function updateVideoControlButton(): void {
  if (!videoControlButton?.isConnected) return
  const status = mapVideoControlStatus()
  videoControlButton.dataset.astraVideoControlState = status.toLowerCase().replace(/\s+/g, "-")
  videoControlButton.title = status === "Off"
    ? "Translate subtitles with Astra"
    : status === "No captions"
      ? "No captions available for this video."
      : "Toggle Astra subtitles"
  videoControlButton.innerHTML = `<span aria-hidden="true">✦</span><span>Astra</span><span data-astra-video-control-status>${status}</span>`
}

function closeVideoSettingsPopover(): void {
  videoSettingsPopover?.setAttribute("hidden", "")
  videoSettingsButton?.setAttribute("aria-expanded", "false")
}

function setVideoCaptionPosition(position: "bottom" | "center" | "top"): void {
  videoCaptionPosition = position
  document.documentElement.dataset.astraVideoCaptionPosition = position
  document
    .querySelectorAll<HTMLElement>(`.${ASTRA_SUBTITLE_CLASS}`)
    .forEach((subtitle) => {
      subtitle.dataset.astraVideoCaptionPosition = position
      if (subtitle.parentElement instanceof HTMLElement) {
        subtitle.parentElement.dataset.astraVideoCaptionPosition = position
      }
    })
}

async function restartVideoSubtitleTranslation(): Promise<void> {
  const wasActive = isVideoSubtitleTranslationActive()
  if (wasActive) {
    stopVideoSubtitleTranslation()
    await startVideoSubtitleTranslation()
  }
  updateVideoControlButton()
}

async function saveVideoPresentationSettings(
  patch: Partial<AstraConfig["presentation"]>,
): Promise<void> {
  const config = await readConfig()
  await saveConfig({
    presentation: {
      ...config.presentation,
      ...patch,
    },
  })
  await restartVideoSubtitleTranslation()
}

function restoreNativeYouTubeCaptions(): void {
  stopVideoSubtitleTranslation()
  clearInjectedTranslations(document)

  const nativeCaptionButton = document.querySelector<HTMLButtonElement>(".ytp-subtitles-button")
    ?? Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
      const label = button.getAttribute("aria-label") ?? ""
      return /subtitles|captions|字幕/i.test(label)
    })
  const pressed = nativeCaptionButton?.getAttribute("aria-pressed")
  if (nativeCaptionButton && (pressed === "false" || pressed === "0")) {
    nativeCaptionButton.dataset.astraNativeCaptionRestoreRequested = "true"
    nativeCaptionButton.click()
    nativeCaptionButton.setAttribute("aria-pressed", "true")
  }
  updateVideoControlButton()
}

function renderVideoSettingsPopover(): HTMLElement {
  const existing = document.getElementById(YOUTUBE_SETTINGS_POPOVER_ID)
  if (existing instanceof HTMLElement) {
    videoSettingsPopover = existing
    return existing
  }

  const popover = document.createElement("div")
  popover.id = YOUTUBE_SETTINGS_POPOVER_ID
  popover.setAttribute("role", "dialog")
  popover.setAttribute("aria-label", "Astra subtitle settings")
  popover.setAttribute("hidden", "")
  popover.innerHTML = `
    <div data-astra-video-settings-title>
      <span>Subtitle settings</span>
      <button type="button" data-astra-video-setting-close aria-label="Close subtitle settings">×</button>
    </div>
    <div data-astra-video-settings-group>
      <span>Mode</span>
      <div data-astra-video-settings-row>
        <button type="button" data-astra-video-setting-mode="bilingual">Bilingual</button>
        <button type="button" data-astra-video-setting-mode="translation-only">Translation only</button>
        <button type="button" data-astra-video-setting-mode="original-only">Original only</button>
      </div>
    </div>
    <div data-astra-video-settings-group>
      <span>Size</span>
      <div data-astra-video-settings-row>
        <button type="button" data-astra-video-setting-size="smaller">Smaller</button>
        <button type="button" data-astra-video-setting-size="larger">Larger</button>
      </div>
    </div>
    <div data-astra-video-settings-group>
      <span>Position</span>
      <div data-astra-video-settings-row>
        <button type="button" data-astra-video-setting-position="bottom">Bottom</button>
        <button type="button" data-astra-video-setting-position="center">Center</button>
        <button type="button" data-astra-video-setting-position="top">Top</button>
      </div>
    </div>
    <div data-astra-video-settings-group>
      <span>Background</span>
      <div data-astra-video-settings-row>
        <button type="button" data-astra-video-setting-theme="default">Default</button>
        <button type="button" data-astra-video-setting-theme="highlight">Highlight</button>
        <button type="button" data-astra-video-setting-theme="underline">Underline</button>
        <button type="button" data-astra-video-setting-theme="mask">Mask</button>
      </div>
    </div>
    <div data-astra-video-settings-group>
      <span>Playback fixes</span>
      <div data-astra-video-settings-row>
        <button type="button" data-astra-video-setting-action="retry">Retry Astra subtitles</button>
        <button type="button" data-astra-video-setting-action="restore-native">Restore native captions</button>
      </div>
    </div>
  `

  popover.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("button") : null
    if (!(target instanceof HTMLButtonElement)) return

    void (async () => {
      if (target.hasAttribute("data-astra-video-setting-close")) {
        closeVideoSettingsPopover()
        return
      }

      const mode = target.dataset.astraVideoSettingMode
      if (mode === "original-only") {
        restoreNativeYouTubeCaptions()
        closeVideoSettingsPopover()
        return
      }
      if (mode === "bilingual" || mode === "translation-only") {
        await saveVideoPresentationSettings({ mode })
        closeVideoSettingsPopover()
        return
      }

      const sizeAction = target.dataset.astraVideoSettingSize
      if (sizeAction === "smaller" || sizeAction === "larger") {
        const config = await readConfig()
        const delta = sizeAction === "larger" ? 0.1 : -0.1
        const fontSize = Math.min(2, Math.max(0.5, Number((config.presentation.fontSize + delta).toFixed(2))))
        await saveVideoPresentationSettings({ fontSize })
        return
      }

      const position = target.dataset.astraVideoSettingPosition
      if (position === "bottom" || position === "center" || position === "top") {
        setVideoCaptionPosition(position)
        popover
          .querySelectorAll<HTMLButtonElement>("[data-astra-video-setting-position]")
          .forEach((button) => {
            button.dataset.astraSelected = button.dataset.astraVideoSettingPosition === position ? "true" : "false"
          })
        return
      }

      const theme = target.dataset.astraVideoSettingTheme
      if (theme === "default" || theme === "highlight" || theme === "underline" || theme === "mask") {
        await saveVideoPresentationSettings({ theme })
        return
      }

      const action = target.dataset.astraVideoSettingAction
      if (action === "retry") {
        stopVideoSubtitleTranslation()
        await startVideoSubtitleTranslation()
        updateVideoControlButton()
        return
      }
      if (action === "restore-native") {
        restoreNativeYouTubeCaptions()
        closeVideoSettingsPopover()
      }
    })()
  })

  document.body.appendChild(popover)
  videoSettingsPopover = popover
  return popover
}

function toggleVideoSettingsPopover(): void {
  const popover = renderVideoSettingsPopover()
  const willOpen = popover.hasAttribute("hidden")
  if (willOpen) {
    popover.removeAttribute("hidden")
    videoSettingsButton?.setAttribute("aria-expanded", "true")
  } else {
    closeVideoSettingsPopover()
  }
}

export function ensureVideoPlayerControlButton(): void {
  const platform = detectPlatform()
  if (platform?.id !== "youtube" || !platform.isVideoPage()) {
    videoControlButton?.remove()
    videoSettingsButton?.remove()
    videoSettingsPopover?.remove()
    videoControlButton = null
    videoSettingsButton = null
    videoSettingsPopover = null
    return
  }

  injectVideoControlStyles()
  const host = getYouTubeControlHost()
  if (!host) return

  const ensureSettingsButton = (): void => {
    const existingSettings = document.getElementById(YOUTUBE_SETTINGS_BUTTON_ID)
    if (existingSettings instanceof HTMLButtonElement) {
      videoSettingsButton = existingSettings
      if (existingSettings.parentElement !== host) {
        host.appendChild(existingSettings)
      }
      return
    }

    const settingsButton = document.createElement("button")
    settingsButton.id = YOUTUBE_SETTINGS_BUTTON_ID
    settingsButton.type = "button"
    settingsButton.innerHTML = `<span aria-hidden="true">⚙</span>`
    settingsButton.setAttribute("aria-label", "Astra subtitle settings")
    settingsButton.setAttribute("aria-controls", YOUTUBE_SETTINGS_POPOVER_ID)
    settingsButton.setAttribute("aria-expanded", "false")
    settingsButton.addEventListener("click", (event) => {
      event.stopPropagation()
      toggleVideoSettingsPopover()
    })
    videoSettingsButton = settingsButton
    host.appendChild(settingsButton)
  }

  const existing = document.getElementById(YOUTUBE_CONTROL_BUTTON_ID)
  if (existing instanceof HTMLButtonElement) {
    videoControlButton = existing
    if (existing.parentElement !== host) {
      host.appendChild(existing)
    }
    updateVideoControlButton()
    ensureSettingsButton()
    return
  }

  const button = document.createElement("button")
  button.id = YOUTUBE_CONTROL_BUTTON_ID
  button.type = "button"
  button.setAttribute("aria-label", "Translate subtitles with Astra")
  button.addEventListener("click", () => {
    void (async () => {
      const status = mapVideoControlStatus()
      if (isVideoSubtitleTranslationActive() && status === "Retry") {
        stopVideoSubtitleTranslation()
        await startVideoSubtitleTranslation()
      } else if (isVideoSubtitleTranslationActive()) {
        stopVideoSubtitleTranslation()
      } else {
        await startVideoSubtitleTranslation()
      }
      updateVideoControlButton()
    })()
  })
  videoControlButton = button
  host.appendChild(button)
  ensureSettingsButton()
  updateVideoControlButton()
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
  const subtitleParents = new Set<HTMLElement>()
  container.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => {
    if (el.parentElement instanceof HTMLElement) {
      subtitleParents.add(el.parentElement)
    }
    el.remove()
  })
  subtitleParents.forEach((parent) => {
    delete parent.dataset.astraPresentationMode
    delete parent.dataset.astraVideoCaptionPosition
  })
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
  el.dataset.astraVideoCaptionPosition = videoCaptionPosition
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
  container.dataset.astraPresentationMode = presentation.mode
  container.dataset.astraVideoCaptionPosition = videoCaptionPosition
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
  serviceMode: ServiceMode,
  presentation: CaptionPresentationStyle,
): Promise<void> {
  const sourceText = getCaptionText(platform, captionWindow).trim()
  if (!sourceText || sourceText.length < 2) return

  const existing = captionWindow.querySelector(`.${ASTRA_SUBTITLE_CLASS}`)
  if (existing?.getAttribute("data-source") === sourceText) return

  const cacheKey = makeSubtitleCacheKey(sourceText, targetLang, serviceMode)
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
      serviceMode,
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
  serviceMode: ServiceMode,
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
      void translateAndInject(platform, child, targetLang, serviceMode, presentation)
      foundChild = true
    }
  }

  if (!foundChild) {
    const text = getCaptionText(platform, container as HTMLElement)
    if (text) void translateAndInject(platform, container as HTMLElement, targetLang, serviceMode, presentation)
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
  serviceMode: ServiceMode,
): Promise<void> {
  const uniqueTexts = Array.from(new Set(cues.map((cue) => cue.text)))

  for (let index = 0; index < uniqueTexts.length; index += STRUCTURED_CUE_BATCH_SIZE) {
    const batch = uniqueTexts.slice(index, index + STRUCTURED_CUE_BATCH_SIZE)
    const uncached = batch.filter((text) => !cacheGet(makeSubtitleCacheKey(text, targetLang, serviceMode)))
    if (uncached.length === 0) continue

    const result = await translateTexts({
      texts: uncached,
      targetLang,
      serviceMode,
      task: "translate",
    })

    if (!result.ok) {
      return
    }

    uncached.forEach((text, translationIndex) => {
      const translation = result.translations[translationIndex]
      if (translation) {
        cachePut(makeSubtitleCacheKey(text, targetLang, serviceMode), translation)
      }
    })
  }

  cues.forEach((cue) => {
    const translation = cacheGet(makeSubtitleCacheKey(cue.text, targetLang, serviceMode))
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
  serviceMode: ServiceMode,
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
    await translateStructuredCues(cues, targetLang, serviceMode)
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
        await translateStructuredCues(cues, targetLang, serviceMode)
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
      .map((cue) => cue.translation ?? cacheGet(makeSubtitleCacheKey(cue.text, targetLang, serviceMode)))
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
    void translateAndInject(platform, fallbackTarget, targetLang, serviceMode, presentation)
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
  serviceMode: ServiceMode,
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

  const texts = Array.from(collected).filter((text) => !cacheGet(makeSubtitleCacheKey(text, targetLang, serviceMode)))
  if (texts.length === 0) return

  for (let index = 0; index < texts.length; index += PRELOAD_BATCH_SIZE) {
    if (abort.signal.aborted) return

    const batch = texts.slice(index, index + PRELOAD_BATCH_SIZE)
    try {
      const result = await translateTexts({
        texts: batch,
        targetLang,
        serviceMode,
        task: "translate",
      })

      if (result.ok) {
        for (let translationIndex = 0; translationIndex < batch.length; translationIndex += 1) {
          if (result.translations[translationIndex]) {
            cachePut(makeSubtitleCacheKey(batch[translationIndex], targetLang, serviceMode), result.translations[translationIndex])
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
  ensureVideoPlayerControlButton()
  if (!platform || !platform.isVideoPage() || activePlatform) return

  activePlatform = platform
  const { targetLang, serviceMode, presentation } = await getResolvedSubtitleSettings()
  injectStyles()

  const container = await waitForElement(platform.captionContainerSelector)
  if (!container) {
    activePlatform = null
    return
  }

  if (platform.id === "youtube") {
    const session = await startYouTubeHybridSubtitleSession({
      targetLang,
      serviceMode,
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
      onStatusChange: updateVideoControlButton,
    })

    if (session) {
      activeSessionStop = session.stop
      mountVideoTranscriptPanel({ targetLang, serviceMode })
      return
    }
  }

  if (platform.preferTextTracks) {
    const sessionStop = await startStructuredTrackSubtitleSession(
      platform,
      container as HTMLElement,
      targetLang,
      serviceMode,
      presentation,
    )

    if (sessionStop) {
      activeSessionStop = sessionStop
      void preloadSubtitleBatch(platform, targetLang, serviceMode)
      return
    }
  }

  observer = new MutationObserver(() => {
    handleCaptionMutation(platform, targetLang, serviceMode, presentation)
  })
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  handleCaptionMutation(platform, targetLang, serviceMode, presentation)
  activeSessionStop = null
  void preloadSubtitleBatch(platform, targetLang, serviceMode)
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
  unmountVideoTranscriptPanel()
  clearInjectedTranslations(document)
  removeStyles()
  updateVideoControlButton()
}

export function clearVideoSubtitleCache(): void {
  translationCache.clear()
}

export function setupVideoNavigationHandler(): void {
  ensureVideoPlayerControlButton()
  const platform = detectPlatform()
  if (!platform?.navigationEvent) return

  let lastUrl = window.location.href
  window.addEventListener(platform.navigationEvent, () => {
    const newUrl = window.location.href
    if (newUrl !== lastUrl) {
      lastUrl = newUrl
      stopVideoSubtitleTranslation()
      clearVideoSubtitleCache()
      ensureVideoPlayerControlButton()
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
