import { afterEach, describe, expect, it } from "vitest"

import { IDLE_TRANSLATION_SNAPSHOT } from "@/types/translation"
import {
  getTranslationState,
  setTranslationState,
  subscribeTranslationState,
} from "./translation-state"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fully-populated snapshot so tests don't have to repeat boilerplate. */
function buildSnapshot(overrides: Partial<typeof IDLE_TRANSLATION_SNAPSHOT> = {}) {
  return {
    ...IDLE_TRANSLATION_SNAPSHOT,
    progress: { ...IDLE_TRANSLATION_SNAPSHOT.progress },
    presentation: { ...IDLE_TRANSLATION_SNAPSHOT.presentation },
    site: { ...IDLE_TRANSLATION_SNAPSHOT.site },
    lastError: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset state between tests.
// The module uses a module-level variable, so we reset it by calling
// setTranslationState with the idle snapshot before each test.
// ---------------------------------------------------------------------------

afterEach(() => {
  setTranslationState({ ...IDLE_TRANSLATION_SNAPSHOT })
})

// ---------------------------------------------------------------------------
// getTranslationState
// ---------------------------------------------------------------------------

describe("getTranslationState", () => {
  it("returns IDLE_TRANSLATION_SNAPSHOT shape initially", () => {
    // Reset explicitly to ensure a clean baseline even if a previous test left
    // state dirty before the afterEach fires.
    setTranslationState({ ...IDLE_TRANSLATION_SNAPSHOT })

    const state = getTranslationState()

    expect(state.phase).toBe("idle")
    expect(state.sessionId).toBe(0)
    expect(state.targetLang).toBeNull()
    expect(state.lastError).toBeNull()
    expect(state.progress).toEqual(IDLE_TRANSLATION_SNAPSHOT.progress)
    expect(state.presentation).toEqual(IDLE_TRANSLATION_SNAPSHOT.presentation)
    expect(state.site).toEqual(IDLE_TRANSLATION_SNAPSHOT.site)
  })

  it("returns a deep clone — mutating the returned object does not affect stored state", () => {
    const first = getTranslationState()
    first.phase = "running"
    first.progress.totalBlocks = 999

    const second = getTranslationState()

    // The stored state must still reflect the idle phase, not the mutation above
    expect(second.phase).toBe("idle")
    expect(second.progress.totalBlocks).toBe(0)
  })

  it("returns independent copies on successive calls", () => {
    const a = getTranslationState()
    const b = getTranslationState()

    expect(a).not.toBe(b)
    expect(a.progress).not.toBe(b.progress)
    expect(a.presentation).not.toBe(b.presentation)
    expect(a.site).not.toBe(b.site)
  })
})

// ---------------------------------------------------------------------------
// setTranslationState
// ---------------------------------------------------------------------------

describe("setTranslationState", () => {
  it("updates the stored state so subsequent getTranslationState calls reflect it", () => {
    const updated = buildSnapshot({ phase: "running", sessionId: 42, targetLang: "ja" })

    setTranslationState(updated)

    const retrieved = getTranslationState()
    expect(retrieved.phase).toBe("running")
    expect(retrieved.sessionId).toBe(42)
    expect(retrieved.targetLang).toBe("ja")
  })

  it("stores a clone of the provided snapshot — mutating the argument afterwards has no effect", () => {
    const snapshot = buildSnapshot({ phase: "starting" })
    setTranslationState(snapshot)

    // Mutate the original object AFTER setting state
    snapshot.phase = "idle"
    snapshot.sessionId = 9999

    const retrieved = getTranslationState()
    expect(retrieved.phase).toBe("starting")
    expect(retrieved.sessionId).toBe(0)
  })

  it("deep-clones nested progress object on set", () => {
    const snapshot = buildSnapshot()
    snapshot.progress.totalBlocks = 10
    setTranslationState(snapshot)

    // Mutate after setting
    snapshot.progress.totalBlocks = 99

    expect(getTranslationState().progress.totalBlocks).toBe(10)
  })

  it("deep-clones a non-null lastError on set", () => {
    const snapshot = buildSnapshot({
      lastError: { code: "UNKNOWN", message: "oops" },
    })
    setTranslationState(snapshot)

    // Mutate after setting
    snapshot.lastError!.message = "changed"

    expect(getTranslationState().lastError?.message).toBe("oops")
  })

  it("handles null lastError correctly", () => {
    setTranslationState(buildSnapshot({ lastError: null }))

    expect(getTranslationState().lastError).toBeNull()
  })

  it("notifies all active subscribers when state changes", () => {
    const calls: string[] = []

    const unsubA = subscribeTranslationState((s) => calls.push(`a:${s.phase}`))
    const unsubB = subscribeTranslationState((s) => calls.push(`b:${s.phase}`))
    calls.length = 0 // discard immediate call on subscribe

    setTranslationState(buildSnapshot({ phase: "running" }))

    expect(calls).toContain("a:running")
    expect(calls).toContain("b:running")

    unsubA()
    unsubB()
  })
})

// ---------------------------------------------------------------------------
// subscribeTranslationState
// ---------------------------------------------------------------------------

describe("subscribeTranslationState", () => {
  it("fires the listener immediately with the current state on subscribe", () => {
    setTranslationState(buildSnapshot({ phase: "starting", sessionId: 5 }))

    const received: Array<typeof IDLE_TRANSLATION_SNAPSHOT> = []
    const unsub = subscribeTranslationState((s) => received.push(s))

    expect(received).toHaveLength(1)
    expect(received[0].phase).toBe("starting")
    expect(received[0].sessionId).toBe(5)

    unsub()
  })

  it("fires the listener on each subsequent setTranslationState call", () => {
    const received: string[] = []
    const unsub = subscribeTranslationState((s) => received.push(s.phase))
    received.length = 0 // discard initial call

    setTranslationState(buildSnapshot({ phase: "running" }))
    setTranslationState(buildSnapshot({ phase: "stopping" }))
    setTranslationState(buildSnapshot({ phase: "idle" }))

    expect(received).toEqual(["running", "stopping", "idle"])

    unsub()
  })

  it("the returned unsubscribe function stops future notifications", () => {
    const received: string[] = []
    const unsub = subscribeTranslationState((s) => received.push(s.phase))
    received.length = 0

    unsub()

    setTranslationState(buildSnapshot({ phase: "running" }))

    expect(received).toHaveLength(0)
  })

  it("delivers independent copies to each subscriber — mutations in one listener do not affect others", () => {
    const snapshots: Array<typeof IDLE_TRANSLATION_SNAPSHOT> = []

    const unsubA = subscribeTranslationState((s) => {
      // Mutate the received snapshot
      s.phase = "idle"
      s.sessionId = 999
      snapshots.push(s)
    })

    const unsubB = subscribeTranslationState((s) => {
      // This copy should not be affected by listenerA's mutation
      snapshots.push(s)
    })

    snapshots.length = 0

    setTranslationState(buildSnapshot({ phase: "running", sessionId: 7 }))

    // Both listeners should have received a snapshot with phase="running"
    // before any mutation by listenerA (each gets its own clone).
    // After mutation by listenerA, snapshots[0] is altered but snapshots[1]
    // must still reflect the original value.
    expect(snapshots[1].phase).toBe("running")
    expect(snapshots[1].sessionId).toBe(7)

    unsubA()
    unsubB()
  })

  it("multiple subscribers receive independent object references", () => {
    const refs: Array<typeof IDLE_TRANSLATION_SNAPSHOT> = []

    const unsubA = subscribeTranslationState((s) => refs.push(s))
    const unsubB = subscribeTranslationState((s) => refs.push(s))
    refs.length = 0

    setTranslationState(buildSnapshot({ phase: "running" }))

    expect(refs).toHaveLength(2)
    expect(refs[0]).not.toBe(refs[1])

    unsubA()
    unsubB()
  })
})
