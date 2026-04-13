import { describe, expect, it } from "vitest"

import { formatLiveBenchScenarioList, resolveLiveScenario } from "./index"
import { liveScenarios, popupDeepReadProofScenario } from "./scenarios"

describe("bench-live scenario registry", () => {
  it("surfaces popup deep-read under the canonical proof id", () => {
    expect(liveScenarios.some((scenario) => scenario.id === popupDeepReadProofScenario.id)).toBe(true)

    const list = formatLiveBenchScenarioList(liveScenarios)
    expect(list).toContain(popupDeepReadProofScenario.id)
    expect(list).not.toContain("bench-live/popup-deep-read-smoke")
  })

  it("resolves the legacy popup smoke id to the canonical proof scenario", () => {
    expect(resolveLiveScenario("bench-live/popup-deep-read-proof").id).toBe(popupDeepReadProofScenario.id)
    expect(resolveLiveScenario("bench-live/popup-deep-read-smoke").id).toBe(popupDeepReadProofScenario.id)
  })
})
