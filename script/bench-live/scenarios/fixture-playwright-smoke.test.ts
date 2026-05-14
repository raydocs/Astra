import { describe, expect, it, vi } from "vitest"

vi.mock("../driver", () => ({
  LiveBrowserUnavailableError: class LiveBrowserUnavailableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "LiveBrowserUnavailableError"
    }
  },
  captureFixtureSmokeWithPlaywright: vi.fn(async () => ({
    artifactDir: "/tmp/astra-live/live-test-run",
    browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    htmlPath: "/tmp/astra-live/live-test-run/article-basic.html",
    url: "file:///tmp/astra-live/live-test-run/article-basic.html",
    screenshotPath: "/tmp/astra-live/live-test-run/article-basic.png",
    snapshotHtmlPath: "/tmp/astra-live/live-test-run/article-basic.snapshot.html",
    headingText: "Astra turns long-form reading into bilingual learning.",
    articleText:
      "Astra turns long-form reading into bilingual learning. Readers can keep the original text visible while reviewing a translation below it.",
    paragraphCount: 2,
    htmlLength: 512,
    bodyTextLength: 132,
  })),
}))

import { createLiveRuntime, evaluateLiveScenario } from "../index"
import { fixturePlaywrightSmokeScenario } from "./fixture-playwright-smoke"

describe("fixturePlaywrightSmokeScenario", () => {
  it("produces a passing browser-backed execution shape when capture succeeds", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: fixturePlaywrightSmokeScenario.id,
      title: fixturePlaywrightSmokeScenario.title,
      surface: fixturePlaywrightSmokeScenario.surface,
      fixture: fixturePlaywrightSmokeScenario.fixture ?? null,
      description: fixturePlaywrightSmokeScenario.description ?? null,
      tags: [...(fixturePlaywrightSmokeScenario.tags ?? [])],
      runId: "live-test-run",
    }

    const execution = await fixturePlaywrightSmokeScenario.run(runtime, context)
    const result = await evaluateLiveScenario(fixturePlaywrightSmokeScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("pass")
    expect(result.pass).toBe(true)
    expect(result.score).toBe(100)
    expect(result.runtime.events.length).toBeGreaterThan(0)
    expect(result.artifacts.execution.artifacts).toMatchObject({
      screenshotPath: "/tmp/astra-live/live-test-run/article-basic.png",
      snapshotHtmlPath: "/tmp/astra-live/live-test-run/article-basic.snapshot.html",
      paragraphCount: 2,
    })
    expect(result.notes.some((note) => note.includes("Artifact directory"))).toBe(true)
  })
})
