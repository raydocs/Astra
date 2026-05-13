/**
 * Session-scoped block registry with per-block state machine and revision tracking.
 *
 * Centralises the tracking of translation block lifecycle state that was
 * previously scattered across WeakSets, WeakMaps and manual counters inside
 * TranslationSession.
 */

export interface RegistrableBlock {
  element: HTMLElement
  sourceText: string
  requestText: string
  fingerprint?: string
}

export type BlockState = "idle" | "queued" | "in-flight" | "translated" | "failed"

export const MAX_BLOCK_RETRIES = 2

function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function normalizeFingerprintText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500)
}

function getElementPathFingerprint(element: HTMLElement): string {
  const parts: string[] = []
  let current: HTMLElement | null = element

  while (current && current !== document.body && current !== document.documentElement && parts.length < 8) {
    const parent: HTMLElement | null = current.parentElement
    const currentTagName = current.tagName
    const tag = currentTagName.toLowerCase()
    const index = parent
      ? Array.from(parent.children).filter((child: Element) => child.tagName === currentTagName).indexOf(current) + 1
      : 1
    parts.push(`${tag}:nth-of-type(${Math.max(1, index)})`)
    current = parent
  }

  return parts.reverse().join(">") || element.tagName.toLowerCase()
}

export function buildBlockFingerprint(block: Pick<RegistrableBlock, "element" | "sourceText" | "requestText">): string {
  const text = normalizeFingerprintText(block.requestText || block.sourceText)
  const path = getElementPathFingerprint(block.element)
  return `${hashString(path)}-${hashString(text)}`
}

export interface TrackedBlock {
  element: HTMLElement
  sourceText: string
  requestText: string
  fingerprint: string
  revision: number
  state: BlockState
  retryCount: number
  lastTranslation?: string
}

export interface BlockRegistrySnapshot {
  totalBlocks: number
  queuedBlocks: number
  inFlightBlocks: number
  translatedBlocks: number
  failedBlocks: number
}

export interface BlockRegistry {
  /** Register new blocks from extraction. Skips already-known elements. Returns count of newly added blocks. */
  registerBlocks(blocks: RegistrableBlock[]): number

  /** Get tracked block for an element, or undefined if not tracked. */
  getBlock(element: HTMLElement): TrackedBlock | undefined

  /** Check if element is tracked. */
  has(element: HTMLElement): boolean

  /** Transition blocks to queued state. Only transitions from idle or failed. */
  markQueued(elements: HTMLElement[]): void

  /** Transition blocks to in-flight state. Only transitions from queued. Records current revision for stale detection. */
  markInFlight(elements: HTMLElement[]): Array<{ element: HTMLElement; revision: number }>

  /** Transition blocks to translated state. Rejects if revision doesn't match (stale result). Returns accepted elements. */
  markTranslated(results: Array<{ element: HTMLElement; revision: number; translation: string }>): HTMLElement[]

  /** Transition blocks to failed state. Rejects if revision doesn't match. Returns accepted elements. */
  markFailed(entries: Array<{ element: HTMLElement; revision: number }>): HTMLElement[]

  /** Retry failed in-flight blocks: re-queue if under retry limit, else mark failed. Returns { requeued, exhausted }. */
  markForRetry(entries: Array<{ element: HTMLElement; revision: number }>): { requeued: HTMLElement[]; exhausted: HTMLElement[] }

  /** Reset retry counts on failed blocks and move them back to idle. Returns elements that were reset. */
  resetRetryCount(elements: HTMLElement[]): HTMLElement[]

  /** Mark that a block's source/request text has changed. Increments revision, clears lastTranslation, resets state to idle. */
  markContentChanged(element: HTMLElement, next: { sourceText: string; requestText: string }): boolean

  /** Remove blocks whose elements are no longer connected to the document. Returns removed elements. */
  removeDisconnected(): HTMLElement[]

  /** Remove specific tracked elements. Returns removed elements. */
  removeElements(elements: HTMLElement[]): HTMLElement[]

  /** Get all elements in a given state. */
  getElementsByState(state: BlockState): HTMLElement[]

  /** Get all tracked elements. */
  getElements(): HTMLElement[]

  /** Get current snapshot of counts. */
  getSnapshot(): BlockRegistrySnapshot

  /** Get total count. */
  get size(): number

  /** Clear all tracked blocks. */
  clear(): void
}

export function createBlockRegistry(): BlockRegistry {
  const blocks = new Map<HTMLElement, TrackedBlock>()
  let queuedCount = 0
  let inFlightCount = 0
  let translatedCount = 0
  let failedCount = 0

  function decrementStateCounter(state: BlockState): void {
    if (state === "queued") queuedCount--
    else if (state === "in-flight") inFlightCount--
    else if (state === "translated") translatedCount--
    else if (state === "failed") failedCount--
  }

  return {
    registerBlocks(textBlocks) {
      let added = 0
      for (const tb of textBlocks) {
        if (blocks.has(tb.element)) continue
        if (!tb.element.isConnected) continue
        blocks.set(tb.element, {
          element: tb.element,
          sourceText: tb.sourceText,
          requestText: tb.requestText,
          fingerprint: tb.fingerprint ?? buildBlockFingerprint(tb),
          revision: 0,
          state: "idle",
          retryCount: 0,
        })
        added++
      }
      return added
    },

    getBlock(element) {
      return blocks.get(element)
    },

    has(element) {
      return blocks.has(element)
    },

    markQueued(elements) {
      for (const el of elements) {
        const block = blocks.get(el)
        if (!block) continue
        if (block.state !== "idle" && block.state !== "failed") continue
        if (block.state === "failed") failedCount--
        block.state = "queued"
        queuedCount++
      }
    },

    markInFlight(elements) {
      const result: Array<{ element: HTMLElement; revision: number }> = []
      for (const el of elements) {
        const block = blocks.get(el)
        if (!block) continue
        if (block.state !== "queued") continue
        queuedCount--
        block.state = "in-flight"
        inFlightCount++
        result.push({ element: el, revision: block.revision })
      }
      return result
    },

    markTranslated(results) {
      const accepted: HTMLElement[] = []
      for (const { element, revision, translation } of results) {
        const block = blocks.get(element)
        if (!block) continue
        if (block.state !== "in-flight") continue
        if (block.revision !== revision) continue
        inFlightCount--
        block.state = "translated"
        translatedCount++
        block.lastTranslation = translation
        accepted.push(element)
      }
      return accepted
    },

    markFailed(entries) {
      const accepted: HTMLElement[] = []
      for (const { element, revision } of entries) {
        const block = blocks.get(element)
        if (!block) continue
        if (block.state !== "in-flight") continue
        if (block.revision !== revision) continue
        inFlightCount--
        block.state = "failed"
        failedCount++
        accepted.push(element)
      }
      return accepted
    },

    markForRetry(entries) {
      const requeued: HTMLElement[] = []
      const exhausted: HTMLElement[] = []
      for (const { element, revision } of entries) {
        const block = blocks.get(element)
        if (!block) continue
        if (block.state !== "in-flight") continue
        if (block.revision !== revision) continue
        inFlightCount--
        block.retryCount++
        if (block.retryCount <= MAX_BLOCK_RETRIES) {
          block.state = "queued"
          queuedCount++
          requeued.push(element)
        } else {
          block.state = "failed"
          failedCount++
          exhausted.push(element)
        }
      }
      return { requeued, exhausted }
    },

    resetRetryCount(elements) {
      const reset: HTMLElement[] = []
      for (const el of elements) {
        const block = blocks.get(el)
        if (!block) continue
        if (block.state !== "failed") continue
        failedCount--
        block.retryCount = 0
        block.state = "idle"
        reset.push(el)
      }
      return reset
    },

    markContentChanged(element, next) {
      const block = blocks.get(element)
      if (!block) return false
      if (block.sourceText === next.sourceText && block.requestText === next.requestText) return false
      decrementStateCounter(block.state)
      block.sourceText = next.sourceText
      block.requestText = next.requestText
      block.fingerprint = buildBlockFingerprint({
        element,
        sourceText: next.sourceText,
        requestText: next.requestText,
      })
      block.revision++
      block.lastTranslation = undefined
      block.retryCount = 0
      block.state = "idle"
      return true
    },

    removeDisconnected() {
      const removed: HTMLElement[] = []
      for (const [el, block] of blocks) {
        if (!el.isConnected) {
          decrementStateCounter(block.state)
          blocks.delete(el)
          removed.push(el)
        }
      }
      return removed
    },

    removeElements(elements) {
      const removed: HTMLElement[] = []
      for (const element of elements) {
        const block = blocks.get(element)
        if (!block) continue
        decrementStateCounter(block.state)
        blocks.delete(element)
        removed.push(element)
      }
      return removed
    },

    getElementsByState(state) {
      const result: HTMLElement[] = []
      for (const [el, block] of blocks) {
        if (block.state === state) result.push(el)
      }
      return result
    },

    getElements() {
      return Array.from(blocks.keys())
    },

    getSnapshot() {
      return {
        totalBlocks: blocks.size,
        queuedBlocks: queuedCount,
        inFlightBlocks: inFlightCount,
        translatedBlocks: translatedCount,
        failedBlocks: failedCount,
      }
    },

    get size() {
      return blocks.size
    },

    clear() {
      blocks.clear()
      queuedCount = 0
      inFlightCount = 0
      translatedCount = 0
      failedCount = 0
    },
  }
}
