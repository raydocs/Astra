import { mkdir, writeFile } from "node:fs/promises"

import { describe, expect, it, vi } from "vitest"

const driverMocks = vi.hoisted(() => {
  class LiveBrowserUnavailableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "LiveBrowserUnavailableError"
    }
  }

  return {
    LiveBrowserUnavailableError,
    materializeFixturePage: vi.fn(async ({ runId, fixtureName, title }: { runId: string; fixtureName: string; title: string }) => {
      const htmlPath = `/tmp/astra-live/${runId}/${fixtureName}.html`
      const html = `<!doctype html><html><head><title>${title}</title></head><body><main><article><p id="selection-context">Astra needs browser-backed proof that <span id="target">selection explain keeps context in place</span> so users can inspect a sentence without losing their reading flow.</p></article></main></body></html>`
      await mkdir(`/tmp/astra-live/${runId}`, { recursive: true })
      await writeFile(htmlPath, html, "utf8")
      return {
        artifactDir: `/tmp/astra-live/${runId}`,
        htmlPath,
        url: `file://${htmlPath}`,
        fixtureHtml: html,
      }
    }),
    withLiveBrowserPage: vi.fn(async (callback: (page: unknown, browserExecutablePath: string) => Promise<unknown>) => {
      const consoleListeners: Array<(msg: { type: () => string; text: () => string }) => void> = []
      const page = {
        on: vi.fn((event: string, listener: (msg: { type: () => string; text: () => string }) => void) => {
          if (event === "console") consoleListeners.push(listener)
        }),
        setContent: vi.fn(async () => undefined),
        waitForSelector: vi.fn(async () => undefined),
        screenshot: vi.fn(async () => undefined),
        addScriptTag: vi.fn(async () => undefined),
        content: vi.fn(async () => "<!doctype html><html><body><div id='astra-selection-toolbar-host'></div></body></html>"),
        evaluate: vi.fn(async (_fn: unknown, args: { hostId: string; relayUrl: string }) => {
          await fetch(args.relayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "openai",
              model: "gpt-5.4-nano",
              texts: ["selection explain keeps context in place"],
              targetLang: "zh-CN",
              task: "explain",
              languageLevel: "beginner",
              explainMode: "exam",
              context: {
                selectionContext: "Astra needs browser-backed proof that selection explain keeps context in place so users can inspect a sentence without losing their reading flow.",
              },
            }),
          })

          return {
            buttonLabels: ["Translate", "Explain", "Copy"],
            resultText: `${args.hostId} EXPLAIN:selection explain keeps context in place | CONTEXT:Astra needs browser-backed proof that selection explain keeps context in place so users can inspect a sentence without losing their reading flow.`,
            selectedText: "selection explain keeps context in place",
          }
        }),
      }

      return await callback(page as never, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    }),
  }
})

vi.mock("../driver", () => driverMocks)

import { createLiveRuntime, evaluateLiveScenario } from "../index"
import { selectionExplainBasicScenario } from "./selection-explain-basic"

describe("selectionExplainBasicScenario", () => {
  it("passes the browser-backed selection explain contract with one explain request and contextual result", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: selectionExplainBasicScenario.id,
      title: selectionExplainBasicScenario.title,
      surface: selectionExplainBasicScenario.surface,
      fixture: selectionExplainBasicScenario.fixture ?? null,
      description: selectionExplainBasicScenario.description ?? null,
      tags: [...(selectionExplainBasicScenario.tags ?? [])],
      runId: "live-selection-explain-run",
    }

    const execution = await selectionExplainBasicScenario.run(runtime, context)
    const result = await evaluateLiveScenario(selectionExplainBasicScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("pass")
    expect(result.pass).toBe(true)
    expect(result.score).toBe(100)
    expect(execution.selectionExplain).toMatchObject({
      requestCount: 1,
      requestTask: "explain",
      requestLanguageLevel: "beginner",
      requestExplainMode: "exam",
    })
    expect(result.artifacts.execution.artifacts).toMatchObject({
      browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    })
  })

  it("preserves a skipped result when no browser is available", async () => {
    vi.mocked(driverMocks.withLiveBrowserPage).mockRejectedValueOnce(
      new driverMocks.LiveBrowserUnavailableError("browser missing"),
    )

    const runtime = createLiveRuntime()
    const context = {
      id: selectionExplainBasicScenario.id,
      title: selectionExplainBasicScenario.title,
      surface: selectionExplainBasicScenario.surface,
      fixture: selectionExplainBasicScenario.fixture ?? null,
      description: selectionExplainBasicScenario.description ?? null,
      tags: [...(selectionExplainBasicScenario.tags ?? [])],
      runId: "live-selection-explain-skipped",
    }

    const execution = await selectionExplainBasicScenario.run(runtime, context)
    const result = await evaluateLiveScenario(selectionExplainBasicScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(execution.status).toBe("skipped")
    expect(result.status).toBe("skipped")
  })
})
