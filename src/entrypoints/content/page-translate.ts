/**
 * Page translation orchestration — viewport-first progressive translation.
 */

import {
  readConfig,
} from "@/utils/storage/config"
import { sanitizeTranslationContext } from "@/utils/privacy"
import { recordPageTranslation } from "@/utils/storage/reading-history"
import { upsertOwnedArticleFromUrl } from "@/utils/storage/owned-reading"
import {
  applySiteCustomCss,
  clearInlineError,
  clearLoading,
  removeAllTranslations,
  removeSiteCustomCss,
  removeTranslationFor,
  replaceLoading,
  showInlineError,
  showLoading,
  ASTRA_INLINE_ERROR_RETRY_ATTR,
} from "@/utils/dom/inject"
import {
  containsRichTextPlaceholders,
  decodeRichTextTranslation,
  serializeRichTextForTranslation,
} from "@/utils/dom/rich-text-placeholders"
import {
  buildContentSummary,
  collectTextBlocks,
  collectTextBlocksFromRoot,
  extractTextBlockText,
  type CollectOptions,
  type TextBlock,
} from "@/utils/dom/traversal"
import { resolveExtractionPlan } from "@/utils/dom/extraction"
import { translateTexts } from "@/utils/translate/translate"
import { getSafeAiUnavailableCopy } from "@/utils/copy-dictionary"
import type { TranslationRequestContext } from "@/types/messages"
import {
  createSiteSnapshot,
  createTranslationError,
  EMPTY_TRANSLATION_PROGRESS,
  SITE_RULE_FILTER_STAGE_ORDER,
  type TranslationError,
  type TranslationPhase,
  type TranslationProgressSnapshot,
  type TranslationRuntimeDiagnostics,
  type TranslationSelectorDiagnostics,
  type TranslationSnapshot,
} from "@/types/translation"
import {
  resolveSiteTranslationSettings,
  type ResolvedSiteTranslationSettings,
  type ServiceMode,
  type TranslationSurfaceMode,
  type TranslationOverrides,
} from "@/types/config"
import {
  getTranslationState,
  setTranslationState,
  subscribeTranslationState,
} from "./translation-state"
import { disconnectInlineSummaryObserver, getDocumentTranslationContext } from "./translation-context"
import { createBlockRegistry, type BlockRegistry, type RegistrableBlock } from "./page-translate-registry"

const INITIAL_VIEWPORT_MARGIN = 200
const BELOW_VIEWPORT_PREFETCH_SCREENS = 1.5
const DRAIN_BATCH_SIZE = 12
const MUTATION_SCAN_DEBOUNCE_MS = 150
const TRANSLATION_MEMORY_MAX_ENTRIES = 8
const TRANSLATION_MEMORY_MAX_CHARS = 1200

export interface TargetedPageTranslationResult {
  ok: boolean
  translatedBlocks: number
  failedBlocks: number
  message?: string
}

interface TranslationSession {
  id: number
  phase: TranslationPhase
  targetLang: string
  serviceMode: ServiceMode
  presentation: ResolvedSiteTranslationSettings["presentation"]
  site: ReturnType<typeof createSiteSnapshot>
  context?: TranslationRequestContext
  contentSummary: string | null
  translationMemory: Map<string, string>
  originalTitle: string
  translatedTitle: string | null
  titleTranslated: boolean
  root: HTMLElement
  effectiveContentScope: TranslationSurfaceMode
  registry: BlockRegistry
  queue: HTMLElement[]
  contentScope: ResolvedSiteTranslationSettings["contentScope"]
  privacyMode: boolean
  siteRules?: { selectors?: string[]; excludeSelectors?: string[]; paragraphMinLength?: number }
  customCss?: string
  diagnostics?: TranslationRuntimeDiagnostics
  intersectionObserver: IntersectionObserver | null
  mutationObserver: MutationObserver | null
  drainPromise: Promise<void> | null
  mutationScanTimer: number | null
  pendingMutationRoots: Set<HTMLElement>
  observedShadowRoots: WeakSet<ShadowRoot>
}

const MUTATION_OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["style", "class", "hidden", "aria-hidden"],
}

let currentSession: TranslationSession | null = null
let nextSessionId = 1
let sessionLifecycleToken = 0

function getViewportPrefetchBottom(): number {
  return window.innerHeight * (1 + BELOW_VIEWPORT_PREFETCH_SCREENS)
}

function isNearViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return (
    rect.bottom >= -INITIAL_VIEWPORT_MARGIN
    && rect.top <= getViewportPrefetchBottom()
    && rect.right >= -INITIAL_VIEWPORT_MARGIN
    && rect.left <= window.innerWidth + INITIAL_VIEWPORT_MARGIN
  )
}

function getViewportQueuePriority(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  if (rect.bottom >= 0 && rect.top <= window.innerHeight) return 0
  if (rect.top > window.innerHeight && rect.top <= getViewportPrefetchBottom()) return 1
  return 2
}

function sortQueueByViewportPriority(session: TranslationSession) {
  session.queue.sort((a, b) => getViewportQueuePriority(a) - getViewportQueuePriority(b))
}

function getSessionProgress(session: TranslationSession): TranslationProgressSnapshot {
  return session.registry.getSnapshot()
}

function updateSnapshot(snapshot: TranslationSnapshot): TranslationSnapshot {
  setTranslationState(snapshot)
  return snapshot
}

function getCollectOptionsForSurfaceMode(surfaceMode: TranslationSurfaceMode): CollectOptions {
  return surfaceMode === "full_page" ? { includeLandmarkContent: true } : {}
}

function cloneDiagnostics(diagnostics: TranslationRuntimeDiagnostics | undefined): TranslationRuntimeDiagnostics | undefined {
  if (!diagnostics) return undefined

  return {
    ...diagnostics,
    siteRules: diagnostics.siteRules
      ? {
          ...diagnostics.siteRules,
          filterStages: diagnostics.siteRules.filterStages?.map((stage) => ({ ...stage })),
          selectors: {
            ...diagnostics.siteRules.selectors,
            configured: [...diagnostics.siteRules.selectors.configured],
            valid: [...diagnostics.siteRules.selectors.valid],
            invalid: [...diagnostics.siteRules.selectors.invalid],
          },
          excludeSelectors: {
            ...diagnostics.siteRules.excludeSelectors,
            configured: [...diagnostics.siteRules.excludeSelectors.configured],
            valid: [...diagnostics.siteRules.excludeSelectors.valid],
            invalid: [...diagnostics.siteRules.excludeSelectors.invalid],
          },
        }
      : undefined,
  }
}

function publishSessionState(
  session: TranslationSession,
  phase: TranslationPhase,
  lastError: TranslationError | null = null,
): TranslationSnapshot {
  session.phase = phase
  return updateSnapshot({
    phase,
    sessionId: session.id,
    targetLang: session.targetLang,
    lastError,
    progress: getSessionProgress(session),
    presentation: { ...session.presentation },
    site: { ...session.site },
    diagnostics: cloneDiagnostics(session.diagnostics),
  })
}

function getIdleBlockCount(snapshot: TranslationProgressSnapshot): number {
  return Math.max(
    0,
    snapshot.totalBlocks
      - snapshot.queuedBlocks
      - snapshot.inFlightBlocks
      - snapshot.translatedBlocks
      - snapshot.failedBlocks,
  )
}

function hasActiveOrDeferredWork(snapshot: TranslationProgressSnapshot): boolean {
  return snapshot.queuedBlocks > 0
    || snapshot.inFlightBlocks > 0
    || getIdleBlockCount(snapshot) > 0
}

function toSafeUserTranslationError(
  error: TranslationError,
  siteEnabled = true,
): TranslationError {
  const safeMessage = getSafeAiUnavailableCopy(error, { siteEnabled })
  if (safeMessage !== error.message) {
    console.warn("[Astra] Translation failure diagnostics:", error)
  }
  return { ...error, message: safeMessage }
}

function publishAfterBatchFailure(
  session: TranslationSession,
  error: TranslationError,
): TranslationSnapshot {
  const snapshot = getSessionProgress(session)
  return publishSessionState(
    session,
    hasActiveOrDeferredWork(snapshot) ? "running" : "idle",
    toSafeUserTranslationError(error, session.site.enabled),
  )
}

function showQueuedLoading(session: TranslationSession, element: HTMLElement) {
  if (session.presentation.mode === "translation-only") return

  showLoading(element, {
    mode: session.presentation.mode,
    theme: session.presentation.theme,
    targetLang: session.targetLang,
  })
}

function publishIdleState(params: {
  sessionId: number
  targetLang: string | null
  lastError: TranslationError | null
  progress?: TranslationProgressSnapshot
  presentation: TranslationSnapshot["presentation"]
  site: TranslationSnapshot["site"]
  diagnostics?: TranslationRuntimeDiagnostics
}): TranslationSnapshot {
  return updateSnapshot({
    phase: "idle",
    sessionId: params.sessionId,
    targetLang: params.targetLang,
    lastError: params.lastError,
    progress: params.progress ? { ...params.progress } : { ...EMPTY_TRANSLATION_PROGRESS },
    presentation: { ...params.presentation },
    site: { ...params.site },
    diagnostics: cloneDiagnostics(params.diagnostics),
  })
}

let clickToggleHandler: ((e: MouseEvent) => void) | null = null

function installClickToggleHandler() {
  if (clickToggleHandler) return
  clickToggleHandler = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const retryEl = target.closest(`[${ASTRA_INLINE_ERROR_RETRY_ATTR}=\"1\"]`)
    if (retryEl instanceof HTMLElement && currentSession) {
      const blockElement = findTrackedBlockElement(currentSession, retryEl)
      if (!blockElement) return
      e.preventDefault()
      e.stopPropagation()
      const reset = currentSession.registry.resetRetryCount([blockElement])
      if (reset.length === 0) return
      clearInlineError(blockElement)
      currentSession.registry.markQueued(reset)
      currentSession.queue.push(...reset)
      sortQueueByViewportPriority(currentSession)
      showQueuedLoading(currentSession, blockElement)
      publishSessionState(currentSession, "running")
      scheduleDrain(currentSession)
      return
    }

    const translationEl = target.closest("[data-astra-translation=\"1\"]")
    if (!translationEl || !(translationEl instanceof HTMLElement)) return
    e.stopPropagation()
    if (translationEl.hasAttribute("data-astra-collapsed")) {
      translationEl.removeAttribute("data-astra-collapsed")
    } else {
      translationEl.setAttribute("data-astra-collapsed", "")
    }
  }
  document.addEventListener("click", clickToggleHandler, true)
}

function removeClickToggleHandler() {
  if (!clickToggleHandler) return
  document.removeEventListener("click", clickToggleHandler, true)
  clickToggleHandler = null
}

function restoreSessionTitle(session: TranslationSession) {
  if (!session.originalTitle) return
  if (!session.translatedTitle || document.title === session.translatedTitle) {
    document.title = session.originalTitle
  }
}

function cleanupSession(session: TranslationSession) {
  session.intersectionObserver?.disconnect()
  session.mutationObserver?.disconnect()

  if (session.mutationScanTimer !== null) {
    window.clearTimeout(session.mutationScanTimer)
  }

  session.pendingMutationRoots.clear()
  session.intersectionObserver = null
  session.mutationObserver = null
  session.mutationScanTimer = null
  restoreSessionTitle(session)
  removeClickToggleHandler()
}

function stopSession(
  error: TranslationError | null = null,
  options: { invalidatePendingStart?: boolean; preserveProgress?: boolean } = {},
): TranslationSnapshot {
  removeSiteCustomCss()
  if (options.invalidatePendingStart ?? true) {
    sessionLifecycleToken += 1
  }

  const session = currentSession
  if (!session) {
    const previous = getTranslationState()
    return publishIdleState({
      sessionId: previous.sessionId,
      targetLang: error ? previous.targetLang : null,
      lastError: error,
      progress: error ? previous.progress : { ...EMPTY_TRANSLATION_PROGRESS },
      presentation: previous.presentation,
      site: previous.site,
      diagnostics: error ? previous.diagnostics : undefined,
    })
  }

  publishSessionState(session, "stopping", error)

  // Record reading history if at least 1 block was translated
  const progress = getSessionProgress(session)
  if (progress.translatedBlocks > 0) {
    const title = session.originalTitle || document.title || window.location.hostname
    void recordPageTranslation({
      url: window.location.href,
      hostname: window.location.hostname,
      title,
      wordsTranslated: progress.translatedBlocks,
      visitedAt: Date.now(),
    })
    void upsertOwnedArticleFromUrl({
      url: window.location.href,
      title,
      status: "saved",
    })
  }

  cleanupSession(session)
  disconnectInlineSummaryObserver()
  currentSession = null
  removeAllTranslations()

  return publishIdleState({
    sessionId: session.id,
    targetLang: error ? session.targetLang : null,
    lastError: error,
    progress: options.preserveProgress ? getSessionProgress(session) : { ...EMPTY_TRANSLATION_PROGRESS },
    presentation: session.presentation,
    site: session.site,
    diagnostics: session.diagnostics,
  })
}

function enqueueBlock(session: TranslationSession, element: HTMLElement) {
  if (currentSession?.id !== session.id) return
  if (!element.isConnected) return

  const block = session.registry.getBlock(element)
  if (!block) return
  if (block.state !== "idle" && block.state !== "failed") return

  session.registry.markQueued([element])
  session.queue.push(element)
  sortQueueByViewportPriority(session)
  showQueuedLoading(session, element)
}

function validateSiteRuleSelectors(selectors?: string[]): Pick<TranslationSelectorDiagnostics, "configured" | "valid" | "invalid"> {
  const configured = selectors?.filter((selector) => selector.trim().length > 0) ?? []
  const valid: string[] = []
  const invalid: string[] = []

  configured.forEach((selector) => {
    try {
      document.querySelector(selector)
      valid.push(selector)
    } catch {
      invalid.push(selector)
    }
  })

  return { configured, valid, invalid }
}

function countMatches(blocks: TextBlock[], selectors: string[]): number {
  if (selectors.length === 0) return 0
  return blocks.filter((b) => selectors.some((sel) => b.element.closest(sel) !== null)).length
}

function applySiteRuleFilters(blocks: TextBlock[], siteRules: {
  selectors?: string[]
  excludeSelectors?: string[]
  paragraphMinLength?: number
}): { filtered: TextBlock[]; diagnostics: NonNullable<TranslationRuntimeDiagnostics["siteRules"]> } {
  const paragraphMinLength = siteRules.paragraphMinLength
  const selectorValidation = validateSiteRuleSelectors(siteRules.selectors)
  const excludeSelectorValidation = validateSiteRuleSelectors(siteRules.excludeSelectors)
  const selectors = selectorValidation.valid
  const excludeSelectors = excludeSelectorValidation.valid
  let filtered = blocks

  const selectorMatchedBlocks = countMatches(blocks, selectors)
  if (selectors.length > 0) {
    filtered = filtered.filter((b) =>
      selectors.some((sel: string) => b.element.closest(sel) !== null),
    )
  }
  const afterIncludeCount = filtered.length

  const excludeMatchedBlocks = countMatches(filtered, excludeSelectors)
  if (excludeSelectors.length > 0) {
    filtered = filtered.filter((b) =>
      !excludeSelectors.some((sel: string) => b.element.closest(sel) !== null),
    )
  }
  const afterExcludeCount = filtered.length

  if (paragraphMinLength && paragraphMinLength > 0) {
    filtered = filtered.filter((b) => b.text.length >= paragraphMinLength)
  }
  const afterParagraphCount = filtered.length

  return {
    filtered,
    diagnostics: {
      inputBlockCount: blocks.length,
      afterIncludeCount,
      afterExcludeCount,
      afterParagraphCount,
      filterStages: SITE_RULE_FILTER_STAGE_ORDER.map((id) => ({
        id,
        count: id === "collected-blocks"
          ? blocks.length
          : id === "after-include-filters"
            ? afterIncludeCount
            : id === "after-exclude-filters"
              ? afterExcludeCount
              : afterParagraphCount,
      })),
      selectors: {
        ...selectorValidation,
        matchedBlocks: selectorMatchedBlocks,
      },
      excludeSelectors: {
        ...excludeSelectorValidation,
        matchedBlocks: excludeMatchedBlocks,
      },
      ...(paragraphMinLength != null ? { paragraphMinLength } : {}),
    },
  }
}

function hasActiveSiteRuleFilters(siteRules?: { selectors?: string[]; excludeSelectors?: string[]; paragraphMinLength?: number }): boolean {
  if (!siteRules) return false
  return (siteRules.selectors?.length ?? 0) > 0
    || (siteRules.excludeSelectors?.length ?? 0) > 0
    || (siteRules.paragraphMinLength ?? 0) > 0
}

function prepareRegistrableBlock(block: TextBlock): RegistrableBlock {
  const richText = serializeRichTextForTranslation(block.element)
  return {
    element: block.element,
    sourceText: block.text,
    requestText: richText.requestText || block.text,
  }
}

function renderTranslatedContent(requestText: string, rawTranslation: string) {
  if (!containsRichTextPlaceholders(requestText)) return rawTranslation
  const decoded = decodeRichTextTranslation(rawTranslation, requestText)
  return decoded.fragment ?? decoded.fallbackText ?? rawTranslation
}

function normalizeMemoryValue(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function escapeMemoryValue(value: string): string {
  return normalizeMemoryValue(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/=>/g, "\\=>")
}

function serializeTranslationMemory(memory: Map<string, string>): string | undefined {
  const lines: string[] = []
  let charCount = 0

  for (const [source, translation] of Array.from(memory.entries()).slice(-TRANSLATION_MEMORY_MAX_ENTRIES)) {
    const sourceText = escapeMemoryValue(source)
    const translationText = escapeMemoryValue(translation)
    if (!sourceText || !translationText) continue

    const line = `${sourceText} => ${translationText}`
    if (charCount + line.length > TRANSLATION_MEMORY_MAX_CHARS) break
    lines.push(line)
    charCount += line.length + 1
  }

  return lines.length > 0 ? lines.join("\n") : undefined
}

function applyTranslationMemoryToContext(
  context: TranslationRequestContext | undefined,
  session: TranslationSession,
): TranslationRequestContext | undefined {
  if (!context || session.privacyMode) return context
  const translationMemory = serializeTranslationMemory(session.translationMemory)
  if (!translationMemory) {
    const { translationMemory: _translationMemory, ...rest } = context
    return rest
  }
  return { ...context, translationMemory }
}

function rememberSessionTranslation(
  session: TranslationSession,
  sourceText: string | undefined,
  translation: string | undefined,
) {
  if (session.privacyMode) return
  const source = normalizeMemoryValue(sourceText ?? "")
  const target = normalizeMemoryValue(translation ?? "")
  if (!source || !target) return

  if (session.translationMemory.has(source)) {
    session.translationMemory.delete(source)
  }
  session.translationMemory.set(source, target)

  while (session.translationMemory.size > TRANSLATION_MEMORY_MAX_ENTRIES) {
    const firstKey = session.translationMemory.keys().next().value
    if (!firstKey) break
    session.translationMemory.delete(firstKey)
  }

  session.context = applyTranslationMemoryToContext(session.context, session)
}

function registerBlocks(session: TranslationSession, blocks: TextBlock[]) {
  const { filtered, diagnostics } = applySiteRuleFilters(blocks, session.siteRules ?? {})
  session.diagnostics = {
    contentScope: session.contentScope,
    effectiveContentScope: session.effectiveContentScope,
    siteRules: diagnostics,
  }
  const prevSize = session.registry.size
  session.registry.registerBlocks(filtered.map(prepareRegistrableBlock))
  const addedCount = session.registry.size - prevSize

  blocks.forEach((block) => {
    if (!session.registry.has(block.element)) return
    const tracked = session.registry.getBlock(block.element)
    if (!tracked) return

    session.intersectionObserver?.observe(block.element)

    if (tracked.state === "idle" && isNearViewport(block.element)) {
      enqueueBlock(session, block.element)
    }
  })

  if (addedCount > 0) {
    publishSessionState(session, session.phase)
  }
}

function cleanupDisconnectedBlocks(session: TranslationSession): boolean {
  const removed = session.registry.removeDisconnected()
  if (removed.length === 0) return false

  removed.forEach((element) => {
    session.intersectionObserver?.unobserve(element)
  })

  if (session.queue.length > 0) {
    const removedSet = new Set(removed)
    session.queue = session.queue.filter(
      element => !removedSet.has(element) && session.registry.has(element),
    )
  }

  return true
}

function pruneBlocksOutsideRoot(session: TranslationSession, root: HTMLElement): boolean {
  const outsideRoot = session.registry.getElements().filter(element => !root.contains(element))
  if (outsideRoot.length === 0) return false

  session.registry.removeElements(outsideRoot)
  outsideRoot.forEach((element) => {
    session.intersectionObserver?.unobserve(element)
    removeTranslationFor(element)
    clearLoading(element)
  })

  if (session.queue.length > 0) {
    const removedSet = new Set(outsideRoot)
    session.queue = session.queue.filter(element => !removedSet.has(element))
  }

  return true
}

function refreshSessionContext(
  session: TranslationSession,
  blocks: TextBlock[],
) {
  session.context = applyTranslationMemoryToContext(
    buildPageContext(blocks, session.site.hostname, session.contentSummary, session.privacyMode),
    session,
  )
}

function applyExtractionPlan(
  session: TranslationSession,
  plan: ReturnType<typeof resolveExtractionPlan>,
): boolean {
  const rootOrScopeChanged = plan.root !== session.root || plan.scope !== session.effectiveContentScope

  if (rootOrScopeChanged) {
    pruneBlocksOutsideRoot(session, plan.root)
  }

  session.root = plan.root
  session.effectiveContentScope = plan.scope
  refreshSessionContext(session, plan.blocks)
  return rootOrScopeChanged
}

function scheduleDrain(session: TranslationSession) {
  if (currentSession?.id !== session.id) return
  if (session.drainPromise) return

  session.drainPromise = Promise.resolve()
    .then(async () => {
      while (currentSession?.id === session.id && session.queue.length > 0) {
        const batchElements: HTMLElement[] = []

        while (batchElements.length < DRAIN_BATCH_SIZE && session.queue.length > 0) {
          const element = session.queue.shift()
          if (!element) continue
          if (!element.isConnected) continue

          const block = session.registry.getBlock(element)
          if (!block) continue
          if (block.state !== "queued") continue

          batchElements.push(element)
        }

        if (batchElements.length === 0) {
          continue
        }

        const inFlightInfo = session.registry.markInFlight(batchElements)

        inFlightInfo.forEach(({ element }) => {
          showLoading(element, {
            mode: session.presentation.mode,
            theme: session.presentation.theme,
            targetLang: session.targetLang,
          })
        })
        publishSessionState(session, "running")

        const blockRequestTexts = inFlightInfo.map(({ element }) => {
          const block = session.registry.getBlock(element)
          return block?.requestText ?? ""
        })
        const includeTitle = !hasActiveSiteRuleFilters(session.siteRules)
          && !session.titleTranslated
          && session.originalTitle.trim().length > 0
        const requestTexts = includeTitle ? [session.originalTitle, ...blockRequestTexts] : blockRequestTexts
        const blockTranslationOffset = includeTitle ? 1 : 0
        const usesRichTextPlaceholders = blockRequestTexts.some(containsRichTextPlaceholders)

        let result: Awaited<ReturnType<typeof translateTexts>>

        try {
          result = await translateTexts({
            texts: requestTexts,
            targetLang: session.targetLang,
            serviceMode: session.serviceMode,
            context: session.context,
            ...(usesRichTextPlaceholders ? { placeholderFormat: "astra-rich-text-v1" as const } : {}),
          })
        } catch (error) {
          if (currentSession?.id !== session.id) {
            return
          }

          const { requeued, exhausted } = session.registry.markForRetry(
            inFlightInfo.map(({ element, revision }) => ({ element, revision })),
          )

          const safeError = toSafeUserTranslationError({
            code: "UNKNOWN",
            message: error instanceof Error ? error.message : "Translation failed.",
          }, session.site.enabled)
          exhausted.forEach((element) => {
            showInlineError(element, safeError.message, {
              mode: session.presentation.mode,
              theme: session.presentation.theme,
              targetLang: session.targetLang,
            })
          })

          // Re-add requeued blocks to the session queue
          if (requeued.length > 0) {
            session.queue.push(...requeued)
            sortQueueByViewportPriority(session)
          }

          // Check if everything is done (no more work)
          const snapshot = session.registry.getSnapshot()
          if (snapshot.queuedBlocks === 0 && snapshot.inFlightBlocks === 0 && exhausted.length > 0) {
            publishAfterBatchFailure(session, safeError)
            return
          }

          publishSessionState(session, "running")
          continue
        }

        if (currentSession?.id !== session.id) {
          return
        }

        if (!result.ok) {
          const { requeued, exhausted } = session.registry.markForRetry(
            inFlightInfo.map(({ element, revision }) => ({ element, revision })),
          )

          const safeError = toSafeUserTranslationError(result.error, session.site.enabled)
          exhausted.forEach((element) => {
            showInlineError(element, safeError.message, {
              mode: session.presentation.mode,
              theme: session.presentation.theme,
              targetLang: session.targetLang,
            })
          })

          if (requeued.length > 0) {
            session.queue.push(...requeued)
            sortQueueByViewportPriority(session)
          }

          const snapshot = session.registry.getSnapshot()
          if (snapshot.queuedBlocks === 0 && snapshot.inFlightBlocks === 0 && exhausted.length > 0) {
            publishAfterBatchFailure(session, safeError)
            return
          }

          publishSessionState(session, "running")
          continue
        }

        if (includeTitle) {
          session.titleTranslated = true
          const translatedTitle = result.translations[0]?.trim()
          if (translatedTitle) {
            session.translatedTitle = translatedTitle
            document.title = translatedTitle
            rememberSessionTranslation(session, session.originalTitle, translatedTitle)
          }
        }

        const accepted = session.registry.markTranslated(
          inFlightInfo.map((info, i) => ({
            element: info.element,
            revision: info.revision,
            translation: result.translations[i + blockTranslationOffset] ?? "",
          })),
        )

        inFlightInfo.forEach((info, index) => {
          if (!accepted.includes(info.element)) return
          if (!info.element.isConnected) return

          const requestText = blockRequestTexts[index] ?? ""
          const rawTranslation = result.translations[index + blockTranslationOffset] ?? ""
          const translatedContent = renderTranslatedContent(requestText, rawTranslation)

          replaceLoading(info.element, translatedContent, {
            mode: session.presentation.mode,
            theme: session.presentation.theme,
            targetLang: session.targetLang,
          })

          const block = session.registry.getBlock(info.element)
          rememberSessionTranslation(session, block?.sourceText, rawTranslation)
        })

        publishSessionState(session, "running")
      }
    })
    .finally(() => {
      if (currentSession?.id === session.id) {
        session.drainPromise = null
        if (session.queue.length > 0) {
          scheduleDrain(session)
        }
      }
    })
}

function scheduleMutationScan(session: TranslationSession) {
  if (currentSession?.id !== session.id) return
  if (session.mutationScanTimer !== null) return

  session.mutationScanTimer = window.setTimeout(() => {
    session.mutationScanTimer = null

    if (currentSession?.id !== session.id) return

    const removedBlocks = cleanupDisconnectedBlocks(session)
    let planRefreshed = false

    if (!session.root.isConnected || session.contentScope === "article") {
      const plan = resolveExtractionPlan(document, session.contentScope)
      planRefreshed = applyExtractionPlan(session, plan) || planRefreshed
      registerBlocks(session, plan.blocks)
    }

    const roots = Array.from(session.pendingMutationRoots)
    session.pendingMutationRoots.clear()

    roots.forEach((root) => {
      if (!root.isConnected) return
      if (!isWithinSessionRoot(session, root) && !root.contains(session.root)) return

      const baseRoot = root.contains(session.root) ? session.root : root
      registerBlocks(session, collectTextBlocksFromRoot(baseRoot, getCollectOptionsForSurfaceMode(session.effectiveContentScope)))
    })

    if (removedBlocks || planRefreshed) {
      publishSessionState(session, session.phase)
    }

    if (removedBlocks || planRefreshed || roots.length > 0) {
      refreshSessionContext(session, collectTextBlocks(
        session.root,
        getCollectOptionsForSurfaceMode(session.effectiveContentScope),
      ))
    }

    scheduleDrain(session)
  }, MUTATION_SCAN_DEBOUNCE_MS)
}

function createIntersectionObserver(session: TranslationSession): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null

  return new IntersectionObserver((entries) => {
    if (currentSession?.id !== session.id) return

    entries.forEach((entry) => {
      if (!entry.isIntersecting) return

      const element = entry.target
      if (!(element instanceof HTMLElement)) return

      if (!session.registry.has(element)) return
      enqueueBlock(session, element)
    })

    if (session.queue.length > 0) {
      publishSessionState(session, "running")
    }
    scheduleDrain(session)
  }, {
    rootMargin: `${INITIAL_VIEWPORT_MARGIN}px 0px ${Math.round(window.innerHeight * BELOW_VIEWPORT_PREFETCH_SCREENS)}px 0px`,
  })
}

function getElementForNode(node: Node | null): HTMLElement | null {
  if (!node) return null
  return node.nodeType === 1
    ? node as HTMLElement
    : node.parentElement
}

function isWithinAstraTranslation(node: Node | null): boolean {
  const element = getElementForNode(node)
  return !!element?.closest("[data-astra-translation]")
}

function findTrackedBlockElement(
  session: TranslationSession,
  node: Node | null,
): HTMLElement | null {
  let current = getElementForNode(node)

  while (current && !session.registry.has(current)) {
    current = current.parentElement
  }

  return current
}

function handleTextChanges(session: TranslationSession, elements: Set<HTMLElement>) {
  if (currentSession?.id !== session.id) return

  let changed = false

  for (const element of elements) {
    // Walk up to find the tracked block element
    let current: HTMLElement | null = element
    while (current && !session.registry.has(current)) {
      current = current.parentElement
    }
    if (!current) continue

    const block = session.registry.getBlock(current)
    if (!block) continue

    // Get the current text/request content of the block
    const currentText = extractTextBlockText(current)
    const currentRichText = serializeRichTextForTranslation(current)
    const currentRequestText = currentRichText.requestText || currentText
    if (currentText === block.sourceText && currentRequestText === block.requestText) continue

    // Source text changed — clear old translation, bump revision, re-queue
    removeTranslationFor(current)
    clearLoading(current)
    session.registry.markContentChanged(current, {
      sourceText: currentText,
      requestText: currentRequestText,
    })
    changed = true

    if (currentText && isNearViewport(current)) {
      enqueueBlock(session, current)
    }
  }

  if (changed) {
    publishSessionState(session, session.phase)
    scheduleDrain(session)
  }
}

function isWithinSessionRoot(session: TranslationSession, el: HTMLElement): boolean {
  if (session.root.contains(el)) return true
  const nodeRoot = el.getRootNode()
  return nodeRoot instanceof ShadowRoot && session.root.contains(nodeRoot.host)
}

function observeOpenShadowRoots(session: TranslationSession, root: ParentNode = document): void {
  const observer = session.mutationObserver
  if (!observer) return

  const candidates = root instanceof HTMLElement
    ? [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]
    : Array.from(root.querySelectorAll<HTMLElement>("*"))

  for (const candidate of candidates) {
    const shadowRoot = candidate.shadowRoot
    if (!shadowRoot || session.observedShadowRoots.has(shadowRoot)) continue
    session.observedShadowRoots.add(shadowRoot)
    observer.observe(shadowRoot, MUTATION_OBSERVER_OPTIONS)
  }
}

function createMutationObserver(session: TranslationSession): MutationObserver | null {
  if (typeof MutationObserver === "undefined") return null

  return new MutationObserver((mutations) => {
    if (currentSession?.id !== session.id) return

    let hasStructuralChanges = false
    const changedTextElements = new Set<HTMLElement>()

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const trackedTarget = findTrackedBlockElement(session, mutation.target)
        if (trackedTarget && !isWithinAstraTranslation(mutation.target)) {
          changedTextElements.add(trackedTarget)
        }

        for (const addedNode of mutation.addedNodes) {
          if (!(addedNode instanceof HTMLElement)) continue
          if (addedNode.matches("[data-astra-translation]")) continue
          if (addedNode.closest("[data-astra-translation]")) continue
          if (addedNode.classList.contains("notranslate")) continue

          observeOpenShadowRoots(session, addedNode)
          session.pendingMutationRoots.add(addedNode)
          hasStructuralChanges = true
        }

        if (mutation.removedNodes.length > 0) {
          hasStructuralChanges = true
        }
      } else if (mutation.type === "attributes") {
        const target = mutation.target
        if (!(target instanceof HTMLElement)) continue
        if (isWithinAstraTranslation(target)) continue
        session.pendingMutationRoots.add(target)
        hasStructuralChanges = true
      } else if (mutation.type === "characterData") {
        const trackedTarget = findTrackedBlockElement(session, mutation.target)
        if (!trackedTarget) continue
        if (isWithinAstraTranslation(mutation.target)) continue
        changedTextElements.add(trackedTarget)
      }
    }

    // Handle text-in-place changes via registry
    if (changedTextElements.size > 0) {
      handleTextChanges(session, changedTextElements)
    }

    if (hasStructuralChanges) {
      scheduleMutationScan(session)
    }
  })
}

function buildPageContext(
  _blocks: TextBlock[],
  hostname: string | null,
  summary: string | null,
  privacyMode = false,
): TranslationRequestContext {
  const effectiveHostname = hostname || window.location.hostname || null
  const contentSummary = summary ?? undefined
  const fullContext = {
    ...getDocumentTranslationContext(),
    ...(effectiveHostname ? { hostname: effectiveHostname } : {}),
    ...(contentSummary ? { contentSummary } : {}),
  }
  if (privacyMode) {
    return sanitizeTranslationContext(fullContext)
  }
  return fullContext
}

async function resolveStartSettings(overrides: TranslationOverrides = {}) {
  const config = await readConfig()
  const resolved = resolveSiteTranslationSettings(config, window.location.href, overrides)
  return { config, resolved, privacyMode: config.privacyMode ?? false }
}

export function getPageTranslationState(): TranslationSnapshot {
  return getTranslationState()
}

export function subscribePageTranslationState(
  listener: (snapshot: TranslationSnapshot) => void,
) {
  return subscribeTranslationState(listener)
}

export async function translatePageElements(
  elements: HTMLElement[],
  overrides: TranslationOverrides = {},
): Promise<TargetedPageTranslationResult> {
  const uniqueElements = Array.from(new Set(elements)).filter((element) => element.isConnected)
  if (uniqueElements.length === 0) {
    return { ok: false, translatedBlocks: 0, failedBlocks: 0, message: "No readable paragraph found." }
  }

  const { config, resolved, privacyMode } = await resolveStartSettings(overrides)
  if (!resolved.enabled) {
    return { ok: false, translatedBlocks: 0, failedBlocks: uniqueElements.length, message: "Astra is hidden on this site." }
  }

  const textBlocks = uniqueElements
    .map((element): TextBlock => ({ element, text: extractTextBlockText(element) }))
    .filter((block) => block.text.length >= Math.max(2, resolved.paragraphMinLength ?? 2))

  if (textBlocks.length === 0) {
    return { ok: false, translatedBlocks: 0, failedBlocks: 0, message: "No readable paragraph found." }
  }

  const siteSnapshot = createSiteSnapshot(resolved)
  const requestBlocks = textBlocks.map(prepareRegistrableBlock)
  const requestTexts = requestBlocks.map((block) => block.requestText)
  const usesRichTextPlaceholders = requestTexts.some(containsRichTextPlaceholders)
  const injectOptions = {
    mode: resolved.presentation.mode,
    theme: resolved.presentation.theme,
    targetLang: resolved.targetLang,
  }

  applySiteCustomCss(resolved.customCss)
  requestBlocks.forEach(({ element }) => {
    removeTranslationFor(element)
    showLoading(element, injectOptions)
  })

  try {
    const result = await translateTexts({
      texts: requestTexts,
      targetLang: resolved.targetLang,
      serviceMode: config.serviceMode,
      context: buildPageContext(textBlocks, siteSnapshot.hostname, buildContentSummary(textBlocks), privacyMode),
      ...(usesRichTextPlaceholders ? { placeholderFormat: "astra-rich-text-v1" as const } : {}),
    })

    if (!result.ok) {
      const safeError = toSafeUserTranslationError(result.error, resolved.enabled)
      requestBlocks.forEach(({ element }) => {
        showInlineError(element, safeError.message, injectOptions)
      })
      return {
        ok: false,
        translatedBlocks: 0,
        failedBlocks: requestBlocks.length,
        message: safeError.message,
      }
    }

    requestBlocks.forEach(({ element }, index) => {
      const requestText = requestTexts[index] ?? ""
      const rawTranslation = result.translations[index] ?? ""
      replaceLoading(element, renderTranslatedContent(requestText, rawTranslation), injectOptions)
    })

    return { ok: true, translatedBlocks: requestBlocks.length, failedBlocks: 0 }
  } catch (error) {
    const safeError = toSafeUserTranslationError({
      code: "UNKNOWN",
      message: error instanceof Error ? error.message : "Translation failed.",
    }, resolved.enabled)
    requestBlocks.forEach(({ element }) => {
      showInlineError(element, safeError.message, injectOptions)
    })
    return { ok: false, translatedBlocks: 0, failedBlocks: requestBlocks.length, message: safeError.message }
  }
}

export async function translatePageElement(
  element: HTMLElement,
  overrides: TranslationOverrides = {},
): Promise<TargetedPageTranslationResult> {
  return translatePageElements([element], overrides)
}

export async function startPageTranslation(
  overrides: TranslationOverrides = {},
): Promise<TranslationSnapshot> {
  const startToken = ++sessionLifecycleToken

  if (currentSession) {
    stopSession(null, { invalidatePendingStart: false })
  }

  const { config, resolved, privacyMode } = await resolveStartSettings(overrides)
  if (startToken !== sessionLifecycleToken) {
    return getTranslationState()
  }

  const siteSnapshot = createSiteSnapshot(resolved)
  if (!resolved.enabled) {
    return publishIdleState({
      sessionId: getTranslationState().sessionId,
      targetLang: resolved.targetLang,
      lastError: createTranslationError("SITE_DISABLED", "Astra is disabled on this site."),
      progress: { ...EMPTY_TRANSLATION_PROGRESS },
      presentation: resolved.presentation,
      site: siteSnapshot,
    })
  }

  const plan = resolveExtractionPlan(document, resolved.contentScope ?? "page")
  const { root, blocks, summary } = plan
  const registry = createBlockRegistry()

  const session: TranslationSession = {
    id: nextSessionId++,
    phase: "starting",
    targetLang: resolved.targetLang,
    serviceMode: config.serviceMode,
    presentation: resolved.presentation,
    site: siteSnapshot,
    context: buildPageContext(blocks, siteSnapshot.hostname, summary, privacyMode),
    contentSummary: summary,
    translationMemory: new Map(),
    originalTitle: document.title,
    translatedTitle: null,
    titleTranslated: false,
    root,
    effectiveContentScope: plan.scope,
    registry,
    queue: [],
    contentScope: resolved.contentScope,
    privacyMode,
    siteRules: {
      selectors: resolved.selectors,
      excludeSelectors: resolved.excludeSelectors,
      paragraphMinLength: resolved.paragraphMinLength,
    },
    customCss: resolved.customCss,
    intersectionObserver: null,
    mutationObserver: null,
    drainPromise: null,
    mutationScanTimer: null,
    pendingMutationRoots: new Set(),
    observedShadowRoots: new WeakSet(),
    diagnostics: {
      contentScope: resolved.contentScope,
      effectiveContentScope: plan.scope,
      siteRules: undefined,
    },
  }

  currentSession = session
  applySiteCustomCss(session.customCss)
  publishSessionState(session, "starting")

  session.intersectionObserver = createIntersectionObserver(session)
  session.mutationObserver = createMutationObserver(session)
  installClickToggleHandler()

  registerBlocks(session, blocks)

  const mutationRoot = document.body ?? document.documentElement
  if (mutationRoot && session.mutationObserver) {
    session.mutationObserver.observe(mutationRoot, MUTATION_OBSERVER_OPTIONS)
    observeOpenShadowRoots(session, mutationRoot)
  }

  if (blocks.length === 0) {
    return stopSession()
  }

  publishSessionState(session, "running")
  scheduleDrain(session)
  return getTranslationState()
}

export function stopPageTranslation(): TranslationSnapshot {
  return stopSession()
}

export function retryFailedBlocks(options: { serviceMode?: ServiceMode } = {}): void {
  if (!currentSession) return
  if (options.serviceMode) {
    currentSession.serviceMode = options.serviceMode
  }
  const failedElements = currentSession.registry.getElementsByState("failed")
  if (failedElements.length === 0) return

  const reset = currentSession.registry.resetRetryCount(failedElements)
  if (reset.length === 0) return

  currentSession.registry.markQueued(reset)
  currentSession.queue.push(...reset)
  sortQueueByViewportPriority(currentSession)
  const session = currentSession
  reset.forEach((element) => {
    showQueuedLoading(session, element)
  })
  publishSessionState(currentSession, "running")
  // scheduleDrain is a no-op if a drain loop is already running;
  // the existing loop's .finally() will re-schedule when it sees queue items.
  scheduleDrain(currentSession)
}

export async function togglePageTranslation(
  overrides: TranslationOverrides = {},
): Promise<TranslationSnapshot> {
  if (getTranslationState().phase === "idle") {
    return startPageTranslation(overrides)
  }

  return stopPageTranslation()
}
