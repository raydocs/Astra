import { describe, expect, it } from "vitest"

import { resolveScheduledServiceMode, scheduleServiceMode } from "./service-mode-scheduler"

describe("service-mode scheduler", () => {
  it("keeps explicit fast and best-quality user choices", () => {
    expect(resolveScheduledServiceMode({
      requestedServiceMode: "fast",
      texts: ["A long paragraph ".repeat(120)],
    })).toBe("fast")
    expect(resolveScheduledServiceMode({
      requestedServiceMode: "best_quality",
      texts: ["Short text"],
    })).toBe("best_quality")
  })

  it("uses fast for dense short subtitle-like batches", () => {
    const decision = scheduleServiceMode({
      requestedServiceMode: "automatic",
      texts: Array.from({ length: 10 }, (_, index) => `Caption line ${index + 1}`),
    })

    expect(decision.serviceMode).toBe("fast")
    expect(decision.reason).toBe("subtitle-density-fast")
  })

  it("uses balanced for medium automatic reading batches", () => {
    const decision = scheduleServiceMode({
      requestedServiceMode: "automatic",
      texts: ["This paragraph is a moderate reading passage with enough detail to favor stable quality over the fastest route. ".repeat(4)],
    })

    expect(decision.serviceMode).toBe("balanced")
    expect(decision.reason).toBe("medium-content-balanced")
  })

  it("uses best quality for glossary or learning tasks", () => {
    expect(resolveScheduledServiceMode({
      requestedServiceMode: "automatic",
      texts: ["Explain this sentence."],
      task: "explain",
    })).toBe("best_quality")

    expect(resolveScheduledServiceMode({
      requestedServiceMode: "balanced",
      texts: ["Astra Router coordinates service-mode decisions."],
      context: { terminologyGlossary: "Astra Router => 阿斯特拉路由" },
    })).toBe("best_quality")
  })

  it("uses balanced for privacy-mode automatic non-short batches", () => {
    const decision = scheduleServiceMode({
      requestedServiceMode: "automatic",
      privacyMode: true,
      texts: ["Privacy mode removes page context, so Astra should avoid ambiguous automatic routing for this medium request."],
    })

    expect(decision.serviceMode).toBe("balanced")
    expect(decision.reason).toBe("privacy-balanced")
  })
})
