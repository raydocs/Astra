/**
 * Page translation orchestration — viewport-first progressive translation.
 */

import {
  readConfig,
} from "@/utils/storage/config"
import {
  clearLoading,
  removeAllTranslations,
  replaceLoading,
  showLoading,
} from "@/utils/dom/inject"
import {
  collectTextBlocks,
  findContentRoot,
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
import { getDocumentTranslationContext } from "./translation-context"
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
  registry: BlockRegistry
  queue: HTMLElement[]
  contentScope: ResolvedSiteTranslationSettings["contentScope"]
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
  cleanupSession(session)
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

function registerBlocks(session: TranslationSession, blocks: TextBlock[]) {
  const prevSize = session.registry.size
  session.registry.registerBlocks(blocks)
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
          session.registry.markFailed(inFlightInfo.map(({ element, revision }) => ({ element, revision })))

          inFlightInfo.forEach(({ element }) => {
            clearLoading(element)
          })

          stopSession({
            code: "UNKNOWN",
            message: error instanceof Error ? error.message : "Translation failed.",
          }, { preserveProgress: true })
          return
        }

        if (currentSession?.id !== session.id) {
          return
        }

        if (!result.ok) {
          session.registry.markFailed(inFlightInfo.map(({ element, revision }) => ({ element, revision })))

          inFlightInfo.forEach(({ element }) => {
            clearLoading(element)
          })

          stopSession(result.error, { preserveProgress: true })
          return
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

    if (!session.root.isConnected) {
      session.root = findContentRoot(document)
    }

    const roots = Array.from(session.pendingMutationRoots)
    session.pendingMutationRoots.clear()

    roots.forEach((root) => {
      if (!root.isConnected) return
      if (!(session.root.contains(root) || root.contains(session.root))) return

      const baseRoot = root.contains(session.root) ? session.root : root
      registerBlocks(session, collectTextBlocks(baseRoot))
    })

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

function createMutationObserver(session: TranslationSession): MutationObserver | null {
  if (typeof MutationObserver === "undefined") return null

  return new MutationObserver((mutations) => {
    if (currentSession?.id !== session.id) return

    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        if (!(addedNode instanceof HTMLElement)) continue
        if (addedNode.matches("[data-astra-translation], [data-astra-source]")) continue
        if (addedNode.closest("[data-astra-translation], [data-astra-source]")) continue
        if (addedNode.classList.contains("notranslate")) continue

        session.pendingMutationRoots.add(addedNode)
      }
    }

    if (session.pendingMutationRoots.size > 0) {
      scheduleMutationScan(session)
    }
  })
}

function buildPageContext(
  blocks: TextBlock[],
  resolved: ResolvedSiteTranslationSettings,
  summary: string | null,
): TranslationRequestContext {
  const contentSummary = summary ?? undefined
  return {
    ...getDocumentTranslationContext(),
    ...(resolved.hostname ? { hostname: resolved.hostname } : {}),
    ...(contentSummary ? { contentSummary } : {}),
  }
}

async function resolveStartSettings(overrides: TranslationOverrides = {}) {
  const config = await readConfig()
  const resolved = resolveSiteTranslationSettings(config, window.location.hostname, overrides)
  return { config, resolved }
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

  const { resolved } = await resolveStartSettings(overrides)
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
    context: buildPageContext(blocks, resolved, summary),
    root,
    registry,
    queue: [],
    contentScope: resolved.contentScope,
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

export async function togglePageTranslation(
  overrides: TranslationOverrides = {},
): Promise<TranslationSnapshot> {
  if (getTranslationState().phase === "idle") {
    return startPageTranslation(overrides)
  }

  return stopPageTranslation()
}
