/**
 * Page translation orchestration — viewport-first progressive translation.
 */

import { readConfig } from "@/utils/storage/config"
import {
  clearLoading,
  removeAllTranslations,
  replaceLoading,
  showLoading,
} from "@/utils/dom/inject"
import { findContentRoot, collectTextBlocks, type TextBlock } from "@/utils/dom/traversal"
import { translateTexts } from "@/utils/translate/translate"
import {
  type TranslationError,
  type TranslationSnapshot,
} from "@/types/translation"
import {
  getTranslationState,
  setTranslationState,
  subscribeTranslationState,
} from "./translation-state"

const INITIAL_VIEWPORT_MARGIN = 200
const DRAIN_BATCH_SIZE = 12
const MUTATION_SCAN_DEBOUNCE_MS = 150

interface TranslationSession {
  id: number
  targetLang: string
  root: HTMLElement
  queue: TextBlock[]
  queued: WeakSet<HTMLElement>
  inFlight: WeakSet<HTMLElement>
  translated: WeakSet<HTMLElement>
  failed: WeakSet<HTMLElement>
  knownBlocks: WeakMap<HTMLElement, TextBlock>
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

function updateSnapshot(snapshot: TranslationSnapshot): TranslationSnapshot {
  setTranslationState(snapshot)
  return snapshot
}

function publishSessionState(
  phase: TranslationSnapshot["phase"],
  sessionId: number,
  targetLang: string | null,
  lastError: TranslationError | null = null,
) {
  return updateSnapshot({
    phase,
    sessionId,
    targetLang,
    lastError,
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
  options: { invalidatePendingStart?: boolean } = {},
): TranslationSnapshot {
  if (options.invalidatePendingStart ?? true) {
    sessionLifecycleToken += 1
  }
  const session = currentSession
  if (!session) {
    return updateSnapshot({
      ...getTranslationState(),
      phase: "idle",
      targetLang: null,
      lastError: error,
    })
  }

  publishSessionState("stopping", session.id, session.targetLang, error)
  cleanupSession(session)
  currentSession = null
  removeAllTranslations()

  return publishSessionState("idle", session.id, null, error)
}

function enqueueBlock(session: TranslationSession, block: TextBlock) {
  if (currentSession?.id !== session.id) return
  if (!block.element.isConnected) return
  if (session.translated.has(block.element)) return
  if (session.inFlight.has(block.element)) return
  if (session.failed.has(block.element)) return
  if (session.queued.has(block.element)) return

  session.queued.add(block.element)
  session.queue.push(block)
}

function registerBlocks(session: TranslationSession, blocks: TextBlock[]) {
  blocks.forEach((block) => {
    if (!block.element.isConnected) return
    if (session.knownBlocks.has(block.element)) return

    session.knownBlocks.set(block.element, block)
    session.intersectionObserver?.observe(block.element)

    if (isNearViewport(block.element)) {
      enqueueBlock(session, block)
    }
  })
}

function scheduleDrain(session: TranslationSession) {
  if (currentSession?.id !== session.id) return
  if (session.drainPromise) return

  session.drainPromise = Promise.resolve()
    .then(async () => {
      while (currentSession?.id === session.id && session.queue.length > 0) {
        const batch: TextBlock[] = []

        while (batch.length < DRAIN_BATCH_SIZE && session.queue.length > 0) {
          const candidate = session.queue.shift()
          if (!candidate) continue
          session.queued.delete(candidate.element)
          if (!candidate.element.isConnected) continue
          if (session.translated.has(candidate.element)) continue
          if (session.inFlight.has(candidate.element)) continue
          if (session.failed.has(candidate.element)) continue

          batch.push(candidate)
        }

        if (batch.length === 0) {
          continue
        }

        batch.forEach((block) => {
          session.inFlight.add(block.element)
          showLoading(block.element)
        })

        let result: Awaited<ReturnType<typeof translateTexts>>

        try {
          result = await translateTexts({
            texts: batch.map((block) => block.text),
            targetLang: session.targetLang,
          })
        } catch (error) {
          batch.forEach((block) => {
            session.inFlight.delete(block.element)
            clearLoading(block.element)
            session.failed.add(block.element)
          })

          stopSession({
            code: "UNKNOWN",
            message: error instanceof Error ? error.message : "Translation failed.",
          })
          return
        }

        if (currentSession?.id !== session.id) {
          return
        }

        if (!result.ok) {
          batch.forEach((block) => {
            session.inFlight.delete(block.element)
            clearLoading(block.element)
            session.failed.add(block.element)
          })

          stopSession(result.error)
          return
        }

        batch.forEach((block, index) => {
          session.inFlight.delete(block.element)
          session.translated.add(block.element)
          if (!block.element.isConnected) return
          replaceLoading(block.element, result.translations[index], {
            theme: "default",
            targetLang: session.targetLang,
          })
        })
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

      const block = session.knownBlocks.get(element)
      if (!block) return
      enqueueBlock(session, block)
    })

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
        if (addedNode.matches("[data-astra-translation]")) continue
        if (addedNode.closest("[data-astra-translation]")) continue
        if (addedNode.classList.contains("notranslate")) continue

        session.pendingMutationRoots.add(addedNode)
      }
    }

    if (session.pendingMutationRoots.size > 0) {
      scheduleMutationScan(session)
    }
  })
}

async function resolveTargetLang(targetLang?: string): Promise<string> {
  if (targetLang?.trim()) return targetLang
  const config = await readConfig()
  return config.targetLang
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
  targetLang?: string,
): Promise<TranslationSnapshot> {
  const startToken = ++sessionLifecycleToken

  if (currentSession) {
    stopSession(null, { invalidatePendingStart: false })
  }

  const resolvedTargetLang = await resolveTargetLang(targetLang)
  if (startToken !== sessionLifecycleToken) {
    return getTranslationState()
  }

  const root = findContentRoot(document)
  const session: TranslationSession = {
    id: nextSessionId++,
    targetLang: resolvedTargetLang,
    root,
    queue: [],
    queued: new WeakSet(),
    inFlight: new WeakSet(),
    translated: new WeakSet(),
    failed: new WeakSet(),
    knownBlocks: new WeakMap(),
    intersectionObserver: null,
    mutationObserver: null,
    drainPromise: null,
    mutationScanTimer: null,
    pendingMutationRoots: new Set(),
  }

  currentSession = session
  publishSessionState("starting", session.id, session.targetLang)

  session.intersectionObserver = createIntersectionObserver(session)
  session.mutationObserver = createMutationObserver(session)

  const blocks = collectTextBlocks(session.root)
  registerBlocks(session, blocks)

  session.mutationObserver?.observe(document.body, {
    childList: true,
    subtree: true,
  })

  if (blocks.length === 0) {
    currentSession = session
    return stopSession()
  }

  publishSessionState("running", session.id, session.targetLang)
  scheduleDrain(session)
  return getTranslationState()
}

export function stopPageTranslation(): TranslationSnapshot {
  return stopSession()
}

export async function togglePageTranslation(
  targetLang?: string,
): Promise<TranslationSnapshot> {
  if (getTranslationState().phase === "idle") {
    return startPageTranslation(targetLang)
  }

  return stopPageTranslation()
}
