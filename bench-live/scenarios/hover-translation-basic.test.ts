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
        content: vi.fn(async () => "<!doctype html><html><body><div id='astra-hover-translate-host'></div></body></html>"),
        evaluate: vi.fn(async (_fn: unknown, args: { relayUrl: string }) => {
          await fetch(args.relayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "openai",
              model: "gpt-5.4-nano",
              texts: ["hello world from Astra"],
              targetLang: "zh-CN",
              task: "translate",
              context: {
                selectionContext: "hello world from Astra",
              },
            }),
          })

          return {
            requestCount: 1,
            overlayVisible: true,
            overlayText: "ZH:hello world from Astra",
            overlayError: "",
            triggerLabel: "Alt + Hover",
            translationLatencyMs: 320,
            selectionSuppressed: false,
            payloadSelectionContext: "hello world from Astra",
            payloadTask: "translate",
          }
        }),
      }

      return await callback(page as never, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    }),
  }
})

vi.mock("../driver", () => driverMocks)

import { createLiveRuntime, evaluateLiveScenario } from "../index"
import { hoverTranslationBasicScenario } from "./hover-translation-basic"

describe("hoverTranslationBasicScenario", () => {
  it("passes the hover live contract in a real-browser-shaped execution", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: hoverTranslationBasicScenario.id,
      title: hoverTranslationBasicScenario.title,
      surface: hoverTranslationBasicScenario.surface,
      fixture: hoverTranslationBasicScenario.fixture ?? null,
      description: hoverTranslationBasicScenario.description ?? null,
      tags: [...(hoverTranslationBasicScenario.tags ?? [])],
      runId: "live-hover-translation-run",
    }

    const execution = await hoverTranslationBasicScenario.run(runtime, context)
    const result = await evaluateLiveScenario(hoverTranslationBasicScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("pass")
    expect(result.pass).toBe(true)
    expect(result.score).toBe(100)
    expect(execution.hover).toMatchObject({
      requestCount: 1,
      payloadTask: "translate",
    })
    expect(result.artifacts.execution.artifacts).toMatchObject({
      browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    })
  })

  it("fails when browser console errors are captured", async () => {
    vi.mocked(driverMocks.withLiveBrowserPage).mockImplementationOnce(async (callback: (page: unknown, browserExecutablePath: string) => Promise<unknown>) => {
      let consoleListener: ((msg: { type: () => string; text: () => string }) => void) | null = null
      const page = {
        on: vi.fn((event: string, listener: (msg: { type: () => string; text: () => string }) => void) => {
          if (event === "console") consoleListener = listener
        }),
        setContent: vi.fn(async () => undefined),
        waitForSelector: vi.fn(async () => undefined),
        screenshot: vi.fn(async () => undefined),
        addScriptTag: vi.fn(async () => undefined),
        content: vi.fn(async () => "<!doctype html><html><body><div id='astra-hover-translate-host'></div></body></html>"),
        evaluate: vi.fn(async (_fn: unknown, args: { relayUrl: string }) => {
          consoleListener?.({ type: () => "error", text: () => "hover runtime broke" })
          await fetch(args.relayUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              texts: ["hello world from Astra"],
              task: "translate",
              context: { selectionContext: "hello world from Astra" },
            }),
          })
          return {
            requestCount: 1,
            overlayVisible: true,
            overlayText: "ZH:hello world from Astra",
            overlayError: "",
            triggerLabel: "Alt + Hover",
            translationLatencyMs: 320,
            selectionSuppressed: false,
            payloadSelectionContext: "hello world from Astra",
            payloadTask: "translate",
          }
        }),
      }

      return await callback(page as never, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    })

    const runtime = createLiveRuntime()
    const context = {
      id: hoverTranslationBasicScenario.id,
      title: hoverTranslationBasicScenario.title,
      surface: hoverTranslationBasicScenario.surface,
      fixture: hoverTranslationBasicScenario.fixture ?? null,
      description: hoverTranslationBasicScenario.description ?? null,
      tags: [...(hoverTranslationBasicScenario.tags ?? [])],
      runId: "live-hover-translation-console-error",
    }

    const execution = await hoverTranslationBasicScenario.run(runtime, context)
    const result = await evaluateLiveScenario(hoverTranslationBasicScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("fail")
    expect(result.issues).toContain("browser console error (hover runtime broke)")
  })

  it("preserves a skipped result when the browser is unavailable", async () => {
    vi.mocked(driverMocks.withLiveBrowserPage).mockRejectedValueOnce(
      new driverMocks.LiveBrowserUnavailableError("browser missing"),
    )

    const runtime = createLiveRuntime()
    const context = {
      id: hoverTranslationBasicScenario.id,
      title: hoverTranslationBasicScenario.title,
      surface: hoverTranslationBasicScenario.surface,
      fixture: hoverTranslationBasicScenario.fixture ?? null,
      description: hoverTranslationBasicScenario.description ?? null,
      tags: [...(hoverTranslationBasicScenario.tags ?? [])],
      runId: "live-hover-translation-skipped",
    }

    const execution = await hoverTranslationBasicScenario.run(runtime, context)
    const result = await evaluateLiveScenario(hoverTranslationBasicScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(execution.status).toBe("skipped")
    expect(result.status).toBe("skipped")
  })
})
