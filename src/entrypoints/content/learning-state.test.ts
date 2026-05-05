import { afterEach, describe, expect, it } from "vitest"

import {
  __resetLearningStateForTests,
  getLearningState,
  markSessionSave,
  subscribeLearningState,
} from "./learning-state"

afterEach(() => {
  __resetLearningStateForTests()
})

describe("learning-state", () => {
  it("starts empty", () => {
    expect(getLearningState()).toEqual({
      savesThisSession: 0,
      hasSavedThisSession: false,
      lastSavedSurface: null,
      lastSavedAt: null,
      lastDueCount: null,
    })
  })

  it("increments save activity with surface metadata", () => {
    markSessionSave("selection_toolbar", 3)
    markSessionSave("hover_translate", 5)

    const state = getLearningState()
    expect(state.savesThisSession).toBe(2)
    expect(state.hasSavedThisSession).toBe(true)
    expect(state.lastSavedSurface).toBe("hover_translate")
    expect(typeof state.lastSavedAt).toBe("number")
    expect(state.lastDueCount).toBe(5)
  })

  it("notifies subscribers immediately and on updates", () => {
    const saves: number[] = []
    const dueCounts: Array<number | null> = []
    const unsubscribe = subscribeLearningState((state) => {
      saves.push(state.savesThisSession)
      dueCounts.push(state.lastDueCount)
    })

    markSessionSave("selection_toolbar", 1)
    markSessionSave("selection_toolbar", null)

    expect(saves).toEqual([0, 1, 2])
    expect(dueCounts).toEqual([null, 1, null])
    unsubscribe()
  })
})
