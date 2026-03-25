/**
 * Session-scoped block registry with per-block state machine and revision tracking.
 *
 * Centralises the tracking of translation block lifecycle state that was
 * previously scattered across WeakSets, WeakMaps and manual counters inside
 * TranslationSession.
 */

import type { TextBlock } from "@/utils/dom/traversal"

export type BlockState = "idle" | "queued" | "in-flight" | "translated" | "failed"

export interface TrackedBlock {
  element: HTMLElement
  sourceText: string
  revision: number
  state: BlockState
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
  registerBlocks(blocks: TextBlock[]): number

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

  /** Mark that a block's source text has changed. Increments revision, clears lastTranslation, resets state to idle. */
  markSourceChanged(element: HTMLElement, nextText: string): boolean

  /** Remove blocks whose elements are no longer connected to the document. Returns removed elements. */
  removeDisconnected(): HTMLElement[]

  /** Get all elements in a given state. */
  getElementsByState(state: BlockState): HTMLElement[]

  /** Get current snapshot of counts. */
  getSnapshot(): BlockRegistrySnapshot

  /** Get total count. */
  get size(): number

  /** Clear all tracked blocks. */
  clear(): void
}

export function createBlockRegistry(): BlockRegistry {
  const blocks = new Map<HTMLElement, TrackedBlock>()

  function countByState(state: BlockState): number {
    let count = 0
    for (const block of blocks.values()) {
      if (block.state === state) count++
    }
    return count
  }

  return {
    registerBlocks(textBlocks) {
      let added = 0
      for (const tb of textBlocks) {
        if (blocks.has(tb.element)) continue
        if (!tb.element.isConnected) continue
        blocks.set(tb.element, {
          element: tb.element,
          sourceText: tb.text,
          revision: 0,
          state: "idle",
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
        block.state = "queued"
      }
    },

    markInFlight(elements) {
      const result: Array<{ element: HTMLElement; revision: number }> = []
      for (const el of elements) {
        const block = blocks.get(el)
        if (!block) continue
        if (block.state !== "queued") continue
        block.state = "in-flight"
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
        if (block.revision !== revision) continue // stale
        block.state = "translated"
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
        block.state = "failed"
        accepted.push(element)
      }
      return accepted
    },

    markSourceChanged(element, nextText) {
      const block = blocks.get(element)
      if (!block) return false
      if (block.sourceText === nextText) return false
      block.sourceText = nextText
      block.revision++
      block.lastTranslation = undefined
      block.state = "idle"
      return true
    },

    removeDisconnected() {
      const removed: HTMLElement[] = []
      for (const [el] of blocks) {
        if (!el.isConnected) {
          blocks.delete(el)
          removed.push(el)
        }
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

    getSnapshot() {
      return {
        totalBlocks: blocks.size,
        queuedBlocks: countByState("queued"),
        inFlightBlocks: countByState("in-flight"),
        translatedBlocks: countByState("translated"),
        failedBlocks: countByState("failed"),
      }
    },

    get size() {
      return blocks.size
    },

    clear() {
      blocks.clear()
    },
  }
}
