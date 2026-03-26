/**
 * Multi-platform video subtitle translation.
 *
 * Detects the current video platform, observes native caption DOM,
 * translates captions, and injects bilingual subtitles below the original.
 */

import { runInlineAction } from "../inline-actions"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"

import type { VideoPlatformConfig } from "./types"
import { youtubePlatform } from "./youtube"
import { bilibiliPlatform } from "./bilibili"
import { netflixPlatform } from "./netflix"

const ALL_PLATFORMS: VideoPlatformConfig[] = [
  youtubePlatform,
  bilibiliPlatform,
  netflixPlatform,
]

const ASTRA_SUBTITLE_CLASS = "astra-video-subtitle"
const STYLE_ID = "astra-video-subtitle-styles"

const translationCache = new Map<string, string>()
const pendingTranslations = new Set<string>()

let observer: MutationObserver | null = null
let activePlatform: VideoPlatformConfig | null = null

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

  // Fallback: get all text, excluding our injected translations
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => el.remove())
  return clone.textContent?.trim() ?? ""
}

function injectTranslation(container: HTMLElement, text: string, sourceText: string): void {
  container.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => el.remove())
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

  // Already showing correct translation
  const existing = captionWindow.querySelector(`.${ASTRA_SUBTITLE_CLASS}`)
  if (existing?.getAttribute("data-source") === sourceText) return

  const cacheKey = `${sourceText}|${targetLang}`

  // Cache hit
  const cached = translationCache.get(cacheKey)
  if (cached) {
    injectTranslation(captionWindow, cached, sourceText)
    return
  }

  // Deduplicate
  if (pendingTranslations.has(cacheKey)) return
  pendingTranslations.add(cacheKey)

  try {
    const result = await runInlineAction({
      text: sourceText,
      targetLang,
      task: "translate",
    })

    if (result.ok) {
      translationCache.set(cacheKey, result.text)
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

  // Try to find child caption windows (YouTube uses nested .ytp-caption-window-* divs)
  const children = container.children
  let foundChild = false

  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement
    // Skip our own injected elements
    if (child.classList.contains(ASTRA_SUBTITLE_CLASS)) continue
    const text = getCaptionText(platform, child)
    if (text) {
      void translateAndInject(platform, child, targetLang)
      foundChild = true
    }
  }

  // If no child windows found, treat the container itself as the caption element
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
  if (!container) return

  observer = new MutationObserver(() => {
    handleCaptionMutation(platform, targetLang)
  })
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  handleCaptionMutation(platform, targetLang)
}

export function stopVideoSubtitleTranslation(): void {
  if (!activePlatform) return
  activePlatform = null
  observer?.disconnect()
  observer = null
  document.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => el.remove())
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

/** Get list of supported platform IDs */
export function getSupportedPlatformIds(): string[] {
  return ALL_PLATFORMS.map((p) => p.id)
}
