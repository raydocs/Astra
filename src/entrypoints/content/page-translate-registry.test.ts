import { beforeEach, describe, expect, it } from "vitest"

import { createBlockRegistry, type BlockRegistry } from "./page-translate-registry"

function createBlock(id: string, text = `Text for ${id}`): { element: HTMLElement; text: string } {
  const el = document.createElement("p")
  el.id = id
  el.textContent = text
  document.body.appendChild(el)
  return { element: el, text }
}

describe("page-translate-registry", () => {
  let registry: BlockRegistry

  beforeEach(() => {
    registry = createBlockRegistry()
    document.body.innerHTML = ""
  })

  describe("registerBlocks", () => {
    it("adds new blocks and skips duplicates", () => {
      const blocks = [createBlock("a"), createBlock("b"), createBlock("c")]

      const added = registry.registerBlocks(blocks)

      expect(added).toBe(3)
      expect(registry.size).toBe(3)

      const addedAgain = registry.registerBlocks(blocks)

      expect(addedAgain).toBe(0)
      expect(registry.size).toBe(3)
    })

    it("skips disconnected elements", () => {
      const el = document.createElement("p")
      el.textContent = "Not attached"

      const added = registry.registerBlocks([{ element: el, text: "Not attached" }])

      expect(added).toBe(0)
      expect(registry.has(el)).toBe(false)
    })
  })

  describe("state transitions", () => {
    it("idle -> queued -> in-flight -> translated (happy path)", () => {
      const block = createBlock("happy")
      registry.registerBlocks([block])

      expect(registry.getBlock(block.element)?.state).toBe("idle")

      registry.markQueued([block.element])
      expect(registry.getBlock(block.element)?.state).toBe("queued")

      const inflight = registry.markInFlight([block.element])
      expect(inflight).toHaveLength(1)
      expect(inflight[0].revision).toBe(0)
      expect(registry.getBlock(block.element)?.state).toBe("in-flight")

      const accepted = registry.markTranslated([
        { element: block.element, revision: 0, translation: "Translated text" },
      ])
      expect(accepted).toEqual([block.element])
      expect(registry.getBlock(block.element)?.state).toBe("translated")
      expect(registry.getBlock(block.element)?.lastTranslation).toBe("Translated text")
    })

    it("idle -> queued -> in-flight -> failed (error path)", () => {
      const block = createBlock("error")
      registry.registerBlocks([block])

      registry.markQueued([block.element])
      registry.markInFlight([block.element])

      const accepted = registry.markFailed([{ element: block.element, revision: 0 }])
      expect(accepted).toEqual([block.element])
      expect(registry.getBlock(block.element)?.state).toBe("failed")
    })
  })

  describe("markQueued guards", () => {
    it("only transitions from idle or failed", () => {
      const blockA = createBlock("translated-block")
      const blockB = createBlock("inflight-block")
      registry.registerBlocks([blockA, blockB])

      // Move blockA to translated
      registry.markQueued([blockA.element])
      registry.markInFlight([blockA.element])
      registry.markTranslated([
        { element: blockA.element, revision: 0, translation: "done" },
      ])

      // Move blockB to in-flight
      registry.markQueued([blockB.element])
      registry.markInFlight([blockB.element])

      // Try to queue both — neither should move
      registry.markQueued([blockA.element, blockB.element])

      expect(registry.getBlock(blockA.element)?.state).toBe("translated")
      expect(registry.getBlock(blockB.element)?.state).toBe("in-flight")
    })

    it("allows transition from failed to queued", () => {
      const block = createBlock("retry")
      registry.registerBlocks([block])

      registry.markQueued([block.element])
      registry.markInFlight([block.element])
      registry.markFailed([{ element: block.element, revision: 0 }])

      expect(registry.getBlock(block.element)?.state).toBe("failed")

      registry.markQueued([block.element])
      expect(registry.getBlock(block.element)?.state).toBe("queued")
    })
  })

  describe("stale result rejection", () => {
    it("markTranslated rejects wrong revision", () => {
      const block = createBlock("stale-translate")
      registry.registerBlocks([block])

      registry.markQueued([block.element])
      const inflight = registry.markInFlight([block.element])
      expect(inflight[0].revision).toBe(0)

      // Source changes while in-flight — bumps revision to 1
      registry.markSourceChanged(block.element, "Updated text")

      // Try to mark translated with the old revision
      const accepted = registry.markTranslated([
        { element: block.element, revision: 0, translation: "Stale translation" },
      ])

      expect(accepted).toEqual([])
      expect(registry.getBlock(block.element)?.state).toBe("idle")
      expect(registry.getBlock(block.element)?.lastTranslation).toBeUndefined()
    })

    it("markFailed rejects wrong revision", () => {
      const block = createBlock("stale-fail")
      registry.registerBlocks([block])

      registry.markQueued([block.element])
      registry.markInFlight([block.element])

      // Source changes while in-flight
      registry.markSourceChanged(block.element, "Updated text")

      const accepted = registry.markFailed([{ element: block.element, revision: 0 }])

      expect(accepted).toEqual([])
      expect(registry.getBlock(block.element)?.state).toBe("idle")
    })
  })

  describe("markSourceChanged", () => {
    it("bumps revision and resets state", () => {
      const block = createBlock("change")
      registry.registerBlocks([block])

      // Translate the block
      registry.markQueued([block.element])
      registry.markInFlight([block.element])
      registry.markTranslated([
        { element: block.element, revision: 0, translation: "Translated" },
      ])

      expect(registry.getBlock(block.element)?.state).toBe("translated")
      expect(registry.getBlock(block.element)?.lastTranslation).toBe("Translated")

      const changed = registry.markSourceChanged(block.element, "New source text")

      expect(changed).toBe(true)
      expect(registry.getBlock(block.element)?.revision).toBe(1)
      expect(registry.getBlock(block.element)?.state).toBe("idle")
      expect(registry.getBlock(block.element)?.lastTranslation).toBeUndefined()
      expect(registry.getBlock(block.element)?.sourceText).toBe("New source text")
    })

    it("returns false when text is unchanged", () => {
      const block = createBlock("same", "Original text")
      registry.registerBlocks([block])

      const changed = registry.markSourceChanged(block.element, "Original text")

      expect(changed).toBe(false)
      expect(registry.getBlock(block.element)?.revision).toBe(0)
    })

    it("returns false for unknown elements", () => {
      const el = document.createElement("p")
      document.body.appendChild(el)

      const changed = registry.markSourceChanged(el, "anything")

      expect(changed).toBe(false)
    })
  })

  describe("removeDisconnected", () => {
    it("removes and returns disconnected elements", () => {
      const blockA = createBlock("connected")
      const blockB = createBlock("will-disconnect")
      registry.registerBlocks([blockA, blockB])

      expect(registry.size).toBe(2)

      // Remove blockB from the DOM
      blockB.element.remove()

      const removed = registry.removeDisconnected()

      expect(removed).toEqual([blockB.element])
      expect(registry.size).toBe(1)
      expect(registry.has(blockA.element)).toBe(true)
      expect(registry.has(blockB.element)).toBe(false)
    })
  })

  describe("getSnapshot", () => {
    it("returns accurate counts across all states", () => {
      const idle = createBlock("idle")
      const queued = createBlock("queued")
      const inflight = createBlock("inflight")
      const translated = createBlock("translated")
      const failed = createBlock("failed")
      registry.registerBlocks([idle, queued, inflight, translated, failed])

      registry.markQueued([queued.element, inflight.element, translated.element, failed.element])
      registry.markInFlight([inflight.element, translated.element, failed.element])
      registry.markTranslated([
        { element: translated.element, revision: 0, translation: "done" },
      ])
      registry.markFailed([{ element: failed.element, revision: 0 }])

      const snapshot = registry.getSnapshot()

      expect(snapshot).toEqual({
        totalBlocks: 5,
        queuedBlocks: 1,
        inFlightBlocks: 1,
        translatedBlocks: 1,
        failedBlocks: 1,
      })
    })
  })

  describe("getElementsByState", () => {
    it("returns elements matching the given state", () => {
      const a = createBlock("a")
      const b = createBlock("b")
      const c = createBlock("c")
      registry.registerBlocks([a, b, c])

      registry.markQueued([a.element, b.element])

      const queuedElements = registry.getElementsByState("queued")
      expect(queuedElements).toHaveLength(2)
      expect(queuedElements).toContain(a.element)
      expect(queuedElements).toContain(b.element)

      const idleElements = registry.getElementsByState("idle")
      expect(idleElements).toEqual([c.element])
    })
  })

  describe("clear", () => {
    it("empties the registry", () => {
      registry.registerBlocks([createBlock("a"), createBlock("b")])
      expect(registry.size).toBe(2)

      registry.clear()

      expect(registry.size).toBe(0)
      expect(registry.getSnapshot().totalBlocks).toBe(0)
    })
  })

  describe("markForRetry", () => {
    it("re-queues blocks under the retry limit", () => {
      const block = createBlock("retry-1")
      registry.registerBlocks([block])
      registry.markQueued([block.element])
      const [inFlight] = registry.markInFlight([block.element])

      const { requeued, exhausted } = registry.markForRetry([inFlight])

      expect(requeued).toEqual([block.element])
      expect(exhausted).toEqual([])
      expect(registry.getBlock(block.element)?.state).toBe("queued")
      expect(registry.getBlock(block.element)?.retryCount).toBe(1)
      expect(registry.getSnapshot().queuedBlocks).toBe(1)
    })

    it("marks blocks as failed after exceeding MAX_RETRIES", () => {
      const block = createBlock("retry-exhaust")
      registry.registerBlocks([block])

      // Retry twice (under limit)
      for (let i = 0; i < 2; i++) {
        registry.markQueued([block.element])
        const [inFlight] = registry.markInFlight([block.element])
        registry.markForRetry([inFlight])
      }

      expect(registry.getBlock(block.element)?.retryCount).toBe(2)

      // Third attempt — now at limit, should be re-queued one more time
      registry.markQueued([block.element])
      const [inFlight] = registry.markInFlight([block.element])
      const { requeued, exhausted } = registry.markForRetry([inFlight])

      expect(requeued).toEqual([])
      expect(exhausted).toEqual([block.element])
      expect(registry.getBlock(block.element)?.state).toBe("failed")
      expect(registry.getSnapshot().failedBlocks).toBe(1)
    })

    it("resetRetryCount moves failed blocks back to idle", () => {
      const block = createBlock("retry-reset")
      registry.registerBlocks([block])
      registry.markQueued([block.element])
      const [inFlight] = registry.markInFlight([block.element])
      registry.markFailed([inFlight])

      expect(registry.getBlock(block.element)?.state).toBe("failed")

      const reset = registry.resetRetryCount([block.element])
      expect(reset).toEqual([block.element])
      expect(registry.getBlock(block.element)?.state).toBe("idle")
      expect(registry.getBlock(block.element)?.retryCount).toBe(0)
      expect(registry.getSnapshot().failedBlocks).toBe(0)
    })
  })
})
