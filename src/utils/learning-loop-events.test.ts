import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../test/utils/mockBrowser"
import { getRecentEvents } from "./telemetry"
import { recordLearningLoopEvent } from "./learning-loop-events"

describe("learning loop events", () => {
  beforeEach(() => {
    vi.useRealTimers()
    setMockBrowser(createMockBrowser())
  })

  it("records learning loop events through the shared telemetry store", async () => {
    recordLearningLoopEvent("deep_read_opened", {
      pageUrl: "https://example.com/article",
      source: "popup",
    })

    await Promise.resolve()
    await Promise.resolve()

    const events = await getRecentEvents(5)
    expect(events[0]).toMatchObject({
      type: "feature_usage",
      data: expect.objectContaining({
        feature: "learning_loop",
        event: "deep_read_opened",
        pageUrl: "https://example.com/article",
        source: "popup",
      }),
    })
  })
})
