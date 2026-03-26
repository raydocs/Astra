/**
 * Page translation orchestration — viewport-first progressive translation.
 */

import {
  readConfig,
} from "@/utils/storage/config"
import { recordPageTranslation } from "@/utils/storage/reading-history"
import {
  clearLoading,
  removeAllTranslations,
  removeTranslationFor,
  replaceLoading,
  showLoading,
} from "@/utils/dom/inject"
import {
  buildContentSummary,
  collectTextBlocks,
  extractTextBlockText,
  type TextBlock,
} from "@/utils/dom/traversal"
import { resolveExtractionPlan } from "@/utils/dom/extraction"
import { translateTexts } from "@/utils/translate/translate"
import type { TranslationRequestContext } from "@/types/messages"
import {
  createSiteSnapshot,
  createTranslationError,
  EMPTY_TRANSLATION_PROGRESS,
  type TranslationError,
  type TranslationPhase,
  type TranslationProgressSnapshot,
  type TranslationSnapshot,
} from "@/types/translation"
import {
  resolveSiteTranslationSettings,
  type ResolvedSiteTranslationSettings,
  type TranslationOverrides,
} from "@/types/config"
import {
  getTranslationState,
  setTranslationState,
  subscribeTranslationState,
} from "./translation-state"
import { disconnectInlineSummaryObserver, getDocumentTranslationContext } from "./translation-context"
import { createBlockRegistry, type BlockRegistry } from "./page-translate-registry"

const INITIAL_VIEWPORT_MARGIN = 200
const DRAIN_BATCH_SIZE = 12
const MUTATION_SCAN_DEBOUNCE_MS = 150

interface TranslationSession {
  id: number
  phase: TranslationPhase
  targetLang: string
  presentation: ResolvedSiteTranslationSettings["presentation"]
  site: ReturnType<typeof createSiteSnapshot>
  context?: TranslationRequestContext
  root: HTMLElement
  effectiveContentScope: "page" | "article"
  registry: BlockRegistry
  queue: HTMLElement[]
  contentScope: ResolvedSiteTranslationSettings["contentScope"]
  privacyMode: boolean
  siteRules?: { selectors?: string[]; excludeSelectors?: string[]; paragraphMinLength?: number }
  intersectionObserver: IntersectionObserver | null
  mutationObserver: MutationObserver | null
  drainPromise: Promise<void> | null
  mutationScanTimer: number | null
  pendingMutationRoots: Set<HTMLElement>
}

let currentSession: TranslationSession | null = null
let nextSessionId = 1
let sessionLifecycleToken = 0

function isNearViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return (
    rect.bottom >= -INITIAL_VIEWPORT_MARGIN
    && rect.top <= window.innerHeight + INITIAL_VIEWPORT_MARGIN
    && rect.right >= -INITIAL_VIEWPORT_MARGIN
    && rect.left <= window.innerWidth + INITIAL_VIEWPORT_MARGIN
  )
}

function getSessionProgress(session: TranslationSession): TranslationProgressSnapshot {
  return session.registry.getSnapshot()
}

function updateSnapshot(snapshot: TranslationSnapshot): TranslationSnapshot {
  setTranslationState(snapshot)
  return snapshot
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
  })
}

function publishIdleState(params: {
  sessionId: number
  targetLang: string | null
  lastError: TranslationError | null
  progress?: TranslationProgressSnapshot
  presentation: TranslationSnapshot["presentation"]
  site: TranslationSnapshot["site"]
}): TranslationSnapshot {
  return updateSnapshot({
    phase: "idle",
    sessionId: params.sessionId,
    targetLang: params.targetLang,
    lastError: params.lastError,
    progress: params.progress ? { ...params.progress } : { ...EMPTY_TRANSLATION_PROGRESS },
    presentation: { ...params.presentation },
    site: { ...params.site },
  })
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
}

function stopSession(
  error: TranslationError | null = null,
  options: { invalidatePendingStart?: boolean; preserveProgress?: boolean } = {},
): TranslationSnapshot {
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
    })
  }

  publishSessionState(session, "stopping", error)

  // Record reading history if at least 1 block was translated
  const progress = getSessionProgress(session)
  if (progress.translatedBlocks > 0) {
    void recordPageTranslation({
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title || window.location.hostname,
      wordsTranslated: progress.translatedBlocks,
      visitedAt: Date.now(),
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
}

function applySiteRuleFilters(blocks: TextBlock[], siteRules: {
  selectors?: string[]
  excludeSelectors?: string[]
  paragraphMinLength?: number
}): TextBlock[] {
  const { selectors, excludeSelectors, paragraphMinLength } = siteRules
  let filtered = blocks

  if (selectors && selectors.length > 0) {
    filtered = filtered.filter((b) =>
      selectors.some((sel: string) => {
        try { return b.element.closest(sel) !== null } catch { return false }
      }),
    )
  }

  if (excludeSelectors && excludeSelectors.length > 0) {
    filtered = filtered.filter((b) =>
      !excludeSelectors.some((sel: string) => {
        try { return b.element.closest(sel) !== null } catch { return false }
      }),
    )
  }

  if (paragraphMinLength && paragraphMinLength > 0) {
    filtered = filtered.filter((b) => b.text.length >= paragraphMinLength)
  }

  return filtered
}

function registerBlocks(session: TranslationSession, blocks: TextBlock[]) {
  const filtered = applySiteRuleFilters(blocks, session.siteRules ?? {})
  const prevSize = session.registry.size
  session.registry.registerBlocks(filtered)
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
  summary: string | null = buildContentSummary(blocks),
) {
  session.context = buildPageContext(blocks, session.site.hostname, summary, session.privacyMode)
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
  refreshSessionContext(session, plan.blocks, plan.summary)
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

        let result: Awaited<ReturnType<typeof translateTexts>>

        try {
          result = await translateTexts({
            texts: inFlightInfo.map(({ element }) => {
              const block = session.registry.getBlock(element)
              return block?.sourceText ?? ""
            }),
            targetLang: session.targetLang,
            context: session.context,
          })
        } catch (error) {
          const { requeued, exhausted } = session.registry.markForRetry(
            inFlightInfo.map(({ element, revision }) => ({ element, revision })),
          )

          exhausted.forEach((element) => {
            clearLoading(element)
          })

          // Re-add requeued blocks to the session queue
          if (requeued.length > 0) {
            session.queue.push(...requeued)
          }

          // Check if everything is done (no more work)
          const snapshot = session.registry.getSnapshot()
          if (snapshot.queuedBlocks === 0 && snapshot.inFlightBlocks === 0 && exhausted.length > 0) {
            stopSession({
              code: "UNKNOWN",
              message: error instanceof Error ? error.message : "Translation failed.",
            }, { preserveProgress: true })
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

          exhausted.forEach((element) => {
            clearLoading(element)
          })

          if (requeued.length > 0) {
            session.queue.push(...requeued)
          }

          const snapshot = session.registry.getSnapshot()
          if (snapshot.queuedBlocks === 0 && snapshot.inFlightBlocks === 0 && exhausted.length > 0) {
            stopSession(result.error, { preserveProgress: true })
            return
          }

          publishSessionState(session, "running")
          continue
        }

        const accepted = session.registry.markTranslated(
          inFlightInfo.map((info, i) => ({
            element: info.element,
            revision: info.revision,
            translation: result.translations[i],
          })),
        )

        inFlightInfo.forEach((info, index) => {
          if (!accepted.includes(info.element)) return
          if (!info.element.isConnected) return
          replaceLoading(info.element, result.translations[index], {
            mode: session.presentation.mode,
            theme: session.presentation.theme,
            targetLang: session.targetLang,
          })
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
      if (!(session.root.contains(root) || root.contains(session.root))) return

      const baseRoot = root.contains(session.root) ? session.root : root
      registerBlocks(session, collectTextBlocks(baseRoot))
    })

    if (removedBlocks || planRefreshed) {
      publishSessionState(session, session.phase)
    }

    if (removedBlocks || planRefreshed || roots.length > 0) {
      refreshSessionContext(session, collectTextBlocks(session.root))
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
    rootMargin: `${INITIAL_VIEWPORT_MARGIN}px 0px`,
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

    // Get the current text content of the block
    const currentText = extractTextBlockText(current)
    if (currentText === block.sourceText) continue

    // Source text changed — clear old translation, bump revision, re-queue
    removeTranslationFor(current)
    clearLoading(current)
    session.registry.markSourceChanged(current, currentText)
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

          session.pendingMutationRoots.add(addedNode)
          hasStructuralChanges = true
        }

        if (mutation.removedNodes.length > 0) {
          hasStructuralChanges = true
        }
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
  if (privacyMode) {
    return {
      ...(hostname ? { hostname } : {}),
    }
  }
  const contentSummary = summary ?? undefined
  return {
    ...getDocumentTranslationContext(),
    ...(hostname ? { hostname } : {}),
    ...(contentSummary ? { contentSummary } : {}),
  }
}

async function resolveStartSettings(overrides: TranslationOverrides = {}) {
  const config = await readConfig()
  const resolved = resolveSiteTranslationSettings(config, window.location.hostname, overrides)
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

export async function startPageTranslation(
  overrides: TranslationOverrides = {},
): Promise<TranslationSnapshot> {
  const startToken = ++sessionLifecycleToken

  if (currentSession) {
    stopSession(null, { invalidatePendingStart: false })
  }

  const { resolved, privacyMode } = await resolveStartSettings(overrides)
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
    presentation: resolved.presentation,
    site: siteSnapshot,
    context: buildPageContext(blocks, siteSnapshot.hostname, summary, privacyMode),
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
    intersectionObserver: null,
    mutationObserver: null,
    drainPromise: null,
    mutationScanTimer: null,
    pendingMutationRoots: new Set(),
  }

  currentSession = session
  publishSessionState(session, "starting")

  session.intersectionObserver = createIntersectionObserver(session)
  session.mutationObserver = createMutationObserver(session)

  registerBlocks(session, blocks)

  session.mutationObserver?.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })

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

export function retryFailedBlocks(): void {
  if (!currentSession) return
  const failedElements = currentSession.registry.getElementsByState("failed")
  if (failedElements.length === 0) return

  const reset = currentSession.registry.resetRetryCount(failedElements)
  if (reset.length === 0) return

  currentSession.registry.markQueued(reset)
  currentSession.queue.push(...reset)
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
