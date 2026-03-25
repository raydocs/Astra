import { describe, expect, it } from "vitest"

import { BUILTIN_ACTIONS, getActionById, getEnabledActions } from "./actions"

describe("getEnabledActions", () => {
  it("returns only default-enabled actions when no ids provided", () => {
    const actions = getEnabledActions()

    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(a => a.enabledByDefault)).toBe(true)
    expect(actions.map(a => a.id)).toEqual(["translate", "explain"])
  })

  it("returns actions matching provided ids", () => {
    const actions = getEnabledActions(["summarize", "grammar"])

    expect(actions.map(a => a.id)).toEqual(["summarize", "grammar"])
  })
})

describe("getActionById", () => {
  it("returns undefined for unknown id", () => {
    expect(getActionById("nonexistent")).toBeUndefined()
  })

  it("returns the action for a known id", () => {
    const action = getActionById("translate")

    expect(action).toBeDefined()
    expect(action!.id).toBe("translate")
  })
})

describe("BUILTIN_ACTIONS", () => {
  it("all builtin actions have unique ids", () => {
    const ids = BUILTIN_ACTIONS.map(a => a.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })
})
