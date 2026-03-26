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

const MAX_CACHE_SIZE = 500
const translationCache = new Map<string, string>()
const pendingTranslations = new Set<string>()

function cachePut(key: string, value: string): void {
  // LRU eviction: delete oldest entries when over limit
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value
    if (firstKey !== undefined) translationCache.delete(firstKey)
  }
  translationCache.set(key, value)
}

function cacheGet(key: string): string | undefined {
  const value = translationCache.get(key)
  if (value !== undefined) {
    // Move to end (most recently used)
    translationCache.delete(key)
    translationCache.set(key, value)
  }
  return value
}

let observer: MutationObserver | null = null
let activePlatform: VideoPlatformConfig | null = null
let preloadAbort: AbortController | null = null

const PRELOAD_BATCH_SIZE = 15

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
  const cached = cacheGet(cacheKey)
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

/**
 * Best-effort extraction of caption texts from YouTube's embedded player data.
 * YouTube stores caption track URLs in ytInitialPlayerResponse; we cannot fetch
 * the actual timed-text payloads cross-origin, but the page sometimes exposes
 * pre-rendered caption segments in the DOM or in script data.  Returns whatever
 * texts can be scraped without a network request.
 */
function tryCollectYouTubeCaptions(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerResponse = (window as any).ytInitialPlayerResponse
    if (!playerResponse) return []

    const captionTracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) return []

    // The playerResponse only contains track *metadata* (URLs, language codes),
    // not the actual cue texts.  However, YouTube's timedtext endpoint sometimes
    // injects cue data into `window.ytcfg` or into script tags.  Attempt to
    // scrape any pre-rendered caption JSON that may be embedded in the page.
    const scripts = document.querySelectorAll("script")
    const cueTexts: string[] = []

    for (const script of scripts) {
      const content = script.textContent
      if (!content || !content.includes('"segs"')) continue

      // Look for timed-text JSON blobs with segments.
      // Format: {"segs":[{"utf8":"Hello "},{"utf8":"world"}]}
      const segRegex = /"segs"\s*:\s*\[([^\]]+)\]/g
      let match: RegExpExecArray | null
      while ((match = segRegex.exec(content)) !== null) {
        try {
          const segs = JSON.parse(`[${match[1]}]`) as Array<{ utf8?: string }>
          const line = segs
            .map((s) => s.utf8 ?? "")
            .join("")
            .trim()
          if (line && line.length >= 2) {
            cueTexts.push(line)
          }
        } catch {
          // Malformed JSON segment — skip
        }
      }
    }

    return [...new Set(cueTexts)]
  } catch {
    return []
  }
}

/**
 * Pre-load subtitle translations by collecting caption texts over a time window,
 * then batch-translating them.  After this runs, the MutationObserver handler
 * will find cache hits and display translations instantly.
 *
 * For YouTube, also attempts to extract captions from embedded page data
 * before falling back to observing DOM mutations.
 */
async function preloadSubtitleBatch(
  platform: VideoPlatformConfig,
  targetLang: string,
  durationMs = 5000,
): Promise<void> {
  const collected = new Set<string>()

  // YouTube-specific: try to grab captions from embedded player data
  if (platform.id === "youtube") {
    const ytCaptions = tryCollectYouTubeCaptions()
    for (const text of ytCaptions) {
      collected.add(text)
    }
  }

  // Observe DOM mutations to collect caption texts as they appear
  const container = document.querySelector(platform.captionContainerSelector)
  if (!container) return

  const abort = new AbortController()
  preloadAbort = abort

  const collectFromContainer = (): void => {
    const children = container.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      if (child.classList.contains(ASTRA_SUBTITLE_CLASS)) continue
      const text = getCaptionText(platform, child).trim()
      if (text && text.length >= 2) {
        collected.add(text)
      }
    }
    // Also check the container itself
    const containerText = getCaptionText(platform, container as HTMLElement).trim()
    if (containerText && containerText.length >= 2) {
      collected.add(containerText)
    }
  }

  // Collect whatever is already in the DOM
  collectFromContainer()

  // Observe for new captions over the collection window
  const collectObserver = new MutationObserver(() => {
    if (abort.signal.aborted) return
    collectFromContainer()
  })
  collectObserver.observe(container, { childList: true, subtree: true, characterData: true })

  // Wait for the collection window to expire or until aborted
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

  // Filter out texts that are already cached
  const texts = Array.from(collected).filter((t) => !cacheGet(`${t}|${targetLang}`))
  if (texts.length === 0) return

  // Batch translate in groups of PRELOAD_BATCH_SIZE
  for (let i = 0; i < texts.length; i += PRELOAD_BATCH_SIZE) {
    if (abort.signal.aborted) return

    const batch = texts.slice(i, i + PRELOAD_BATCH_SIZE)
    try {
      const result = await translateTexts({
        texts: batch,
        targetLang,
        task: "translate",
      })

      if (result.ok) {
        for (let j = 0; j < batch.length; j++) {
          if (result.translations[j]) {
            cachePut(`${batch[j]}|${targetLang}`, result.translations[j])
          }
        }
      }
    } catch {
      // Batch translation failed — the per-cue fallback will handle these
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
  if (!container) return

  observer = new MutationObserver(() => {
    handleCaptionMutation(platform, targetLang)
  })
  observer.observe(container, { childList: true, subtree: true, characterData: true })
  handleCaptionMutation(platform, targetLang)

  // Fire-and-forget: preload subtitle translations in the background.
  // The MutationObserver above continues to handle per-cue translation as a
  // fallback; preloading just warms the cache so subsequent cues are instant.
  void preloadSubtitleBatch(platform, targetLang)
}

export function stopVideoSubtitleTranslation(): void {
  if (!activePlatform) return
  activePlatform = null
  preloadAbort?.abort()
  preloadAbort = null
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
