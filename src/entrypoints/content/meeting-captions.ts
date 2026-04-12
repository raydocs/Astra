/**
 * Meeting caption translation for Google Meet and Zoom Web.
 *
 * Watches for live caption text via MutationObserver and appends
 * translated lines below each original caption.
 */

import { runInlineAction } from "./inline-actions"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"

const ASTRA_CAPTION_CLASS = "astra-meeting-caption"
const STYLE_ID = "astra-meeting-caption-styles"
const MAX_CACHE_SIZE = 300

/** Selectors for Google Meet caption containers. */
const MEET_SELECTORS = [".a4cQT", '[jsname="tgaKEf"]']

/** Selectors for Zoom Web caption containers. */
const ZOOM_SELECTORS = [".closed-caption__container", '[class*="closed-caption"]']

type MeetingPlatform = "google-meet" | "zoom"

interface MeetingCaptionSession {
  platform: MeetingPlatform
  observer: MutationObserver
  container: Element
}

const translationCache = new Map<string, string>()
const pendingTranslations = new Set<string>()
let activeSession: MeetingCaptionSession | null = null

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

function detectMeetingPlatform(): MeetingPlatform | null {
  const hostname = window.location.hostname
  if (hostname === "meet.google.com") return "google-meet"
  if (hostname.endsWith("zoom.us")) return "zoom"
  return null
}

function findCaptionContainer(platform: MeetingPlatform): Element | null {
  const selectors = platform === "google-meet" ? MEET_SELECTORS : ZOOM_SELECTORS
  for (const selector of selectors) {
    const el = document.querySelector(selector)
    if (el) return el
  }
  return null
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
    .${ASTRA_CAPTION_CLASS} {
      display: block;
      color: #93c5fd;
      font-size: 0.88em;
      line-height: 1.4;
      margin-top: 2px;
      padding: 1px 4px;
      opacity: 0.9;
      pointer-events: none;
      font-style: italic;
    }
  `
  document.head.appendChild(style)
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove()
}

function clearInjectedCaptions(root: ParentNode): void {
  root.querySelectorAll(`.${ASTRA_CAPTION_CLASS}`).forEach((el) => el.remove())
}

function extractCaptionText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`.${ASTRA_CAPTION_CLASS}`).forEach((el) => el.remove())
  return clone.textContent?.trim() ?? ""
}

async function translateAndAppend(
  captionElement: HTMLElement,
  targetLang: string,
): Promise<void> {
  const sourceText = extractCaptionText(captionElement).trim()
  if (!sourceText || sourceText.length < 2) return

  // Skip if already has matching translation
  const existing = captionElement.querySelector<HTMLElement>(`.${ASTRA_CAPTION_CLASS}`)
  if (existing?.getAttribute("data-source") === sourceText) return

  const cacheKey = `${sourceText}|${targetLang}`
  const cached = cacheGet(cacheKey)
  if (cached) {
    injectCaptionTranslation(captionElement, cached, sourceText)
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
      // Only inject if caption element still shows the same text
      const currentText = extractCaptionText(captionElement).trim()
      if (currentText === sourceText) {
        injectCaptionTranslation(captionElement, result.text, sourceText)
      }
    }
  } finally {
    pendingTranslations.delete(cacheKey)
  }
}

function injectCaptionTranslation(
  container: HTMLElement,
  translatedText: string,
  sourceText: string,
): void {
  // Remove any existing Astra caption translation from this element
  clearInjectedCaptions(container)

  const el = document.createElement("span")
  el.className = ASTRA_CAPTION_CLASS
  el.textContent = translatedText
  el.setAttribute("data-source", sourceText)
  container.appendChild(el)
}

function handleMutations(
  container: Element,
  targetLang: string,
): void {
  const children = container.children
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement
    if (child.classList.contains(ASTRA_CAPTION_CLASS)) continue
    const text = extractCaptionText(child)
    if (text && text.length >= 2) {
      void translateAndAppend(child, targetLang)
    }
  }
}

function waitForCaptionContainer(
  platform: MeetingPlatform,
  timeoutMs = 30_000,
): Promise<Element | null> {
  const existing = findCaptionContainer(platform)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const obs = new MutationObserver(() => {
      const found = findCaptionContainer(platform)
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
 * Start translating meeting captions.
 * Detects the meeting platform, waits for the caption container, and
 * observes mutations to translate new caption lines.
 */
export async function startMeetingCaptionTranslation(): Promise<boolean> {
  if (activeSession) return true

  const platform = detectMeetingPlatform()
  if (!platform) return false

  const targetLang = await getTargetLang()
  injectStyles()

  const container = await waitForCaptionContainer(platform)
  if (!container) {
    return false
  }

  const observer = new MutationObserver(() => {
    handleMutations(container, targetLang)
  })
  observer.observe(container, { childList: true, subtree: true, characterData: true })

  // Process any existing captions
  handleMutations(container, targetLang)

  activeSession = { platform, observer, container }
  return true
}

/**
 * Stop meeting caption translation and clean up.
 */
export function stopMeetingCaptionTranslation(): void {
  if (!activeSession) return

  activeSession.observer.disconnect()
  clearInjectedCaptions(activeSession.container)
  activeSession = null

  translationCache.clear()
  pendingTranslations.clear()
  removeStyles()
}

/**
 * Check whether the current page is a supported meeting page.
 */
export function isMeetingPage(): boolean {
  return detectMeetingPlatform() !== null
}
