/**
 * Meeting caption translation for Google Meet and Zoom Web.
 *
 * Watches for live caption text via MutationObserver and appends
 * translated lines below each original caption.
 */

import { runInlineAction } from "./inline-actions"
import { readConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  resolveSiteTranslationSettings,
  type AstraConfig,
  type ResolvedSiteTranslationSettings,
  type ServiceMode,
} from "@/types/config"
import type { SubtitleQualitySnapshot } from "@/types/translation"

const ASTRA_CAPTION_CLASS = "astra-meeting-caption"
const STYLE_ID = "astra-meeting-caption-styles"
const MAX_CACHE_SIZE = 300
const MUTATION_DEBOUNCE_MS = 50

/** Selectors for Google Meet caption containers. */
const MEET_SELECTORS = [".a4cQT", '[jsname="tgaKEf"]']

/** Selectors for Zoom Web caption containers. */
const ZOOM_SELECTORS = [
  ".closed-caption__container",
  '[class*="closed-caption"]',
  '[class*="caption-host"]',
  '[class*="captionHost"]',
]

type MeetingPlatform = "google-meet" | "zoom"

interface MeetingCaptionSession {
  platform: MeetingPlatform
  captionObserver: MutationObserver
  containerObserver: MutationObserver
  container: Element
  targetLang: string
  serviceMode: ServiceMode
  presentation: CaptionPresentationStyle
  debounceTimer: number | null
  lastProcessedText: WeakMap<HTMLElement, string>
  stopped: boolean
}

interface CaptionPresentationStyle {
  mode: ResolvedSiteTranslationSettings["presentation"]["mode"]
  theme: ResolvedSiteTranslationSettings["presentation"]["theme"]
  fontSize?: string
  translationColor?: string
}

type CachedCaptionResolution =
  | { kind: "resolved" }
  | { kind: "miss"; sourceText: string; cacheKey: string }

const translationCache = new Map<string, string>()
const pendingTranslations = new Set<string>()
let activeSession: MeetingCaptionSession | null = null
let sessionGeneration = 0

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

async function getResolvedCaptionSettings(): Promise<{
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

function makeCaptionCacheKey(sourceText: string, targetLang: string, serviceMode: ServiceMode): string {
  return `${sourceText}|${targetLang}|${serviceMode}`
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    .${ASTRA_CAPTION_CLASS} {
      display: block;
      color: var(--astra-caption-color, #93c5fd);
      font-size: var(--astra-caption-font-size, 0.88em);
      line-height: 1.4;
      margin-top: 2px;
      padding: 1px 4px;
      opacity: 0.9;
      pointer-events: none;
      font-style: italic;
    }

    .${ASTRA_CAPTION_CLASS}[data-astra-presentation-theme="underline"] {
      text-decoration: underline;
      text-decoration-color: var(--astra-caption-color, #93c5fd);
      text-underline-offset: 0.18em;
    }

    .${ASTRA_CAPTION_CLASS}[data-astra-presentation-theme="highlight"] {
      background: rgba(99, 102, 241, 0.16);
      border-radius: 3px;
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

function isAstraCaptionOwnedNode(node: Node): boolean {
  if (node instanceof Element) {
    return node.closest(`.${ASTRA_CAPTION_CLASS}`) !== null
  }

  return node.parentElement?.closest(`.${ASTRA_CAPTION_CLASS}`) !== null
}

function isAstraInjectedOnlyMutation(record: MutationRecord): boolean {
  if (record.type === "characterData") {
    return isAstraCaptionOwnedNode(record.target)
  }

  if (record.type === "childList") {
    const changedNodes = [...record.addedNodes, ...record.removedNodes]
    return changedNodes.length > 0 && changedNodes.every(isAstraCaptionOwnedNode)
  }

  return false
}

function hasNonAstraCaptionMutation(records: MutationRecord[]): boolean {
  return records.some((record) => !isAstraInjectedOnlyMutation(record))
}

function extractCaptionText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll(`.${ASTRA_CAPTION_CLASS}`).forEach((el) => el.remove())
  return clone.textContent?.trim() ?? ""
}

function resolveCaptionSynchronouslyFromCache(
  session: MeetingCaptionSession,
  captionElement: HTMLElement,
): CachedCaptionResolution {
  if (session.stopped || !captionElement.isConnected) return { kind: "resolved" }

  const sourceText = extractCaptionText(captionElement).trim()
  if (!sourceText || sourceText.length < 2) return { kind: "resolved" }

  // Skip if already has matching translation for unchanged caption text.
  const existing = captionElement.querySelector<HTMLElement>(`.${ASTRA_CAPTION_CLASS}`)
  if (existing?.getAttribute("data-source") === sourceText) {
    session.lastProcessedText.set(captionElement, sourceText)
    return { kind: "resolved" }
  }

  const cacheKey = makeCaptionCacheKey(sourceText, session.targetLang, session.serviceMode)
  const cached = cacheGet(cacheKey)
  if (cached) {
    session.lastProcessedText.set(captionElement, sourceText)
    if (!session.stopped && captionElement.isConnected) {
      injectCaptionTranslation(captionElement, cached, sourceText, session.presentation)
    }
    return { kind: "resolved" }
  }

  return { kind: "miss", sourceText, cacheKey }
}

async function translateAndAppend(
  session: MeetingCaptionSession,
  captionElement: HTMLElement,
): Promise<void> {
  const resolution = resolveCaptionSynchronouslyFromCache(session, captionElement)
  if (resolution.kind === "resolved") return

  const { sourceText, cacheKey } = resolution

  if (session.lastProcessedText.get(captionElement) === sourceText && pendingTranslations.has(cacheKey)) {
    return
  }

  if (pendingTranslations.has(cacheKey)) return
  pendingTranslations.add(cacheKey)

  try {
    const result = await runInlineAction({
      text: sourceText,
      targetLang: session.targetLang,
      serviceMode: session.serviceMode,
      task: "translate",
    })

    if (result.ok) {
      cachePut(cacheKey, result.text)
      // Only inject if this session and caption element are still active and unchanged.
      const currentText = extractCaptionText(captionElement).trim()
      if (!session.stopped && captionElement.isConnected && currentText === sourceText) {
        session.lastProcessedText.set(captionElement, sourceText)
        injectCaptionTranslation(captionElement, result.text, sourceText, session.presentation)
      }
    }
  } finally {
    pendingTranslations.delete(cacheKey)
  }
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

function injectCaptionTranslation(
  container: HTMLElement,
  translatedText: string,
  sourceText: string,
  presentation: CaptionPresentationStyle,
): void {
  // Remove any existing Astra caption translation from this element
  clearInjectedCaptions(container)

  const el = document.createElement("span")
  el.className = ASTRA_CAPTION_CLASS
  el.textContent = translatedText
  el.setAttribute("data-source", sourceText)
  applyPresentationStyle(el, presentation)
  container.appendChild(el)
}

function getCaptionCandidates(container: Element): HTMLElement[] {
  const candidates: HTMLElement[] = []
  const children = container.children
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!(child instanceof HTMLElement)) continue
    if (child.classList.contains(ASTRA_CAPTION_CLASS)) continue
    const text = extractCaptionText(child)
    if (text && text.length >= 2) {
      candidates.push(child)
    }
  }

  if (candidates.length === 0 && container instanceof HTMLElement) {
    const directText = extractCaptionText(container)
    if (directText && directText.length >= 2) {
      candidates.push(container)
    }
  }

  return candidates
}

function processCachedCaptionHits(session: MeetingCaptionSession): void {
  if (session.stopped || !session.container.isConnected) return

  for (const candidate of getCaptionCandidates(session.container)) {
    resolveCaptionSynchronouslyFromCache(session, candidate)
  }
}

function processCaptionMutations(session: MeetingCaptionSession): void {
  if (session.stopped || !session.container.isConnected) return

  for (const candidate of getCaptionCandidates(session.container)) {
    void translateAndAppend(session, candidate)
  }
}

function scheduleCaptionProcessing(
  session: MeetingCaptionSession,
  delayMs = MUTATION_DEBOUNCE_MS,
): void {
  if (session.stopped) return
  if (session.debounceTimer !== null) {
    window.clearTimeout(session.debounceTimer)
  }
  session.debounceTimer = window.setTimeout(() => {
    session.debounceTimer = null
    processCaptionMutations(session)
  }, delayMs)
}

function bindCaptionContainer(session: MeetingCaptionSession, container: Element): void {
  if (session.stopped || session.container === container) return

  clearInjectedCaptions(session.container)
  session.captionObserver.disconnect()
  session.container = container
  session.lastProcessedText = new WeakMap()
  session.captionObserver.observe(container, { childList: true, subtree: true, characterData: true })
  scheduleCaptionProcessing(session, 0)
}

function rebindCaptionContainerIfNeeded(session: MeetingCaptionSession): void {
  if (session.stopped) return
  const nextContainer = findCaptionContainer(session.platform)
  if (nextContainer && nextContainer !== session.container) {
    bindCaptionContainer(session, nextContainer)
  }
}

function waitForCaptionContainer(
  platform: MeetingPlatform,
  timeoutMs = 30_000,
): Promise<Element | null> {
  const existing = findCaptionContainer(platform)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    let timeout = 0
    let obs: MutationObserver
    const finish = (container: Element | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      obs.disconnect()
      resolve(container)
    }
    obs = new MutationObserver(() => {
      const found = findCaptionContainer(platform)
      if (found) {
        finish(found)
      }
    })
    timeout = window.setTimeout(() => {
      finish(null)
    }, timeoutMs)
    obs.observe(document.body, { childList: true, subtree: true })
  })
}

/**
 * Start translating meeting captions.
 * Detects the meeting platform, waits for the caption container, and
 * observes mutations to translate new caption lines.
 */
export async function startMeetingCaptionTranslation(): Promise<boolean> {
  if (activeSession) return true

  const generation = ++sessionGeneration
  const platform = detectMeetingPlatform()
  if (!platform) return false

  const { targetLang, serviceMode, presentation } = await getResolvedCaptionSettings()
  if (generation !== sessionGeneration || activeSession) return false
  injectStyles()

  const container = await waitForCaptionContainer(platform)
  if (!container || generation !== sessionGeneration || activeSession) {
    removeStyles()
    return false
  }

  let session: MeetingCaptionSession
  const captionObserver = new MutationObserver((records) => {
    if (!hasNonAstraCaptionMutation(records)) return

    processCachedCaptionHits(session)
    scheduleCaptionProcessing(session)
  })
  const containerObserver = new MutationObserver(() => {
    rebindCaptionContainerIfNeeded(session)
  })
  session = {
    platform,
    captionObserver,
    containerObserver,
    container,
    targetLang,
    serviceMode,
    presentation,
    debounceTimer: null,
    lastProcessedText: new WeakMap(),
    stopped: false,
  }

  captionObserver.observe(container, { childList: true, subtree: true, characterData: true })
  session.containerObserver.observe(document.body, { childList: true, subtree: true })

  activeSession = session

  // Process any existing captions immediately; later churn is coalesced.
  processCaptionMutations(session)

  return true
}

/**
 * Stop meeting caption translation and clean up.
 */
export function stopMeetingCaptionTranslation(): void {
  sessionGeneration += 1
  const session = activeSession
  activeSession = null

  if (session) {
    session.stopped = true
    if (session.debounceTimer !== null) {
      window.clearTimeout(session.debounceTimer)
      session.debounceTimer = null
    }
    session.captionObserver.disconnect()
    session.containerObserver.disconnect()
  }

  clearInjectedCaptions(document)
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

export function isMeetingCaptionTranslationActive(): boolean {
  return activeSession !== null
}

export function getMeetingCaptionQualitySnapshot(): SubtitleQualitySnapshot | null {
  const session = activeSession
  if (!session) return null

  const candidates = getCaptionCandidates(session.container)
  const sourceText = candidates
    .map((candidate) => extractCaptionText(candidate).trim())
    .filter(Boolean)
    .join(" ")
  const translatedNodeCount = session.container.querySelectorAll(`.${ASTRA_CAPTION_CLASS}`).length

  return {
    surface: "meeting",
    active: true,
    platform: session.platform,
    pipeline: `${session.platform}-dom`,
    source: "dom",
    status: !session.container.isConnected
      ? "container-detached"
      : pendingTranslations.size > 0
        ? "pending"
        : translatedNodeCount > 0
          ? "ready"
          : candidates.length > 0
            ? "observing"
            : "waiting-caption",
    anomalies: [],
    translatedNodeCount,
    sourceTextLength: sourceText.length,
    pendingRequestCount: pendingTranslations.size,
    cacheSize: translationCache.size,
    capturedAt: Date.now(),
  }
}
