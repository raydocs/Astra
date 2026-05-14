import { describe, expect, it, vi } from "vitest"

vi.mock("../driver", () => ({
  LiveBrowserUnavailableError: class LiveBrowserUnavailableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "LiveBrowserUnavailableError"
    }
  },
  materializeFixturePage: vi.fn(async () => ({
    artifactDir: "/tmp/astra-live/live-page-translation-source-translation-only",
    htmlPath: "/tmp/astra-live/live-page-translation-source-translation-only/article-basic.html",
    url: "file:///tmp/astra-live/live-page-translation-source-translation-only/article-basic.html",
    fixtureHtml: `<main>
  <article>
    <h1>Astra turns long-form reading into bilingual learning.</h1>
    <p>Readers can keep the original text visible while reviewing a translation below it.</p>
    <p>This fixture represents a straightforward article page with a clear main content root.</p>
    <blockquote>The goal is to test article-centric extraction without noisy chrome.</blockquote>
  </article>
</main>`,
  })),
  withLiveBrowserPage: vi.fn(async (callback: (page: unknown, browserExecutablePath: string) => Promise<unknown>) => {
    const page = {
      goto: vi.fn(async () => undefined),
      waitForSelector: vi.fn(async () => undefined),
      screenshot: vi.fn(async () => undefined),
    }

    return await callback(
      page as never,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )
  }),
}))

vi.mock("../source-runtime", () => ({
  runSourceBackedPageTranslation: vi.fn(async () => ({
    html: `<!doctype html><html><body><main>
  <article>
    <h1><span class="astra-source" data-astra-source="1" data-astra-source-hidden="1">Astra turns long-form reading into bilingual learning.</span><span class="notranslate astra-translation" data-astra-translation="1"><span class="astra-translation-inner">ZH:Astra turns long-form reading into bilingual lea</span></span></h1>
    <p><span class="astra-source" data-astra-source="1" data-astra-source-hidden="1">Readers can keep the original text visible while reviewing a translation below it.</span><span class="notranslate astra-translation" data-astra-translation="1"><span class="astra-translation-inner">ZH:Readers can keep the original text visible while</span></span></p>
    <p><span class="astra-source" data-astra-source="1" data-astra-source-hidden="1">This fixture represents a straightforward article page with a clear main content root.</span><span class="notranslate astra-translation" data-astra-translation="1"><span class="astra-translation-inner">ZH:This fixture represents a straightforward articl</span></span></p>
    <blockquote><span class="astra-source" data-astra-source="1" data-astra-source-hidden="1">The goal is to test article-centric extraction without noisy chrome.</span><span class="notranslate astra-translation" data-astra-translation="1"><span class="astra-translation-inner">ZH:The goal is to test article-centric extraction w</span></span></blockquote>
  </article>
</main></body></html>`,
    requestCount: 1,
    translateCalls: [{ payload: { texts: ["one"], targetLang: "zh-CN" } }],
    pageTranslation: {
      translatedNodeCount: 4,
      expectedNodeCount: 4,
      translationMarkerCount: 4,
      hiddenSourceCount: 4,
      requestCount: 1,
      skippedInteractiveTranslations: 0,
      translatedTexts: [
        "ZH:Astra turns long-form reading into bilingual lea",
        "ZH:Readers can keep the original text visible while",
        "ZH:This fixture represents a straightforward articl",
        "ZH:The goal is to test article-centric extraction w",
      ],
      expectedTexts: [
        "Astra turns long-form reading into bilingual learning.",
        "Readers can keep the original text visible while reviewing a translation below it.",
        "This fixture represents a straightforward article page with a clear main content root.",
        "The goal is to test article-centric extraction without noisy chrome.",
      ],
      snapshotPhase: "running",
      failedBlocks: 0,
      notes: ["effectiveScope=article", "live-source-page-translation"],
    },
  })),
}))

import { createLiveRuntime, evaluateLiveScenario } from "../index"
import { pageTranslationArticleBasicSourceTranslationOnlyScenario } from "./page-translation-article-basic-source-translation-only"

describe("pageTranslationArticleBasicSourceTranslationOnlyScenario", () => {
  it("requires hidden source wrappers in translation-only mode", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: pageTranslationArticleBasicSourceTranslationOnlyScenario.id,
      title: pageTranslationArticleBasicSourceTranslationOnlyScenario.title,
      surface: pageTranslationArticleBasicSourceTranslationOnlyScenario.surface,
      fixture: pageTranslationArticleBasicSourceTranslationOnlyScenario.fixture ?? null,
      description: pageTranslationArticleBasicSourceTranslationOnlyScenario.description ?? null,
      tags: [...(pageTranslationArticleBasicSourceTranslationOnlyScenario.tags ?? [])],
      runId: "live-page-translation-source-translation-only-run",
    }

    const execution = await pageTranslationArticleBasicSourceTranslationOnlyScenario.run(runtime, context)
    const result = await evaluateLiveScenario(pageTranslationArticleBasicSourceTranslationOnlyScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("pass")
    expect(result.pass).toBe(true)
    expect(result.score).toBe(100)
    expect(result.artifacts.execution.artifacts).toMatchObject({
      screenshotPath: "/tmp/astra-live/live-page-translation-source-translation-only/article-basic.page-translation.translation-only.png",
      snapshotHtmlPath: "/tmp/astra-live/live-page-translation-source-translation-only/article-basic.page-translation.translation-only.snapshot.html",
    })
  })
})
