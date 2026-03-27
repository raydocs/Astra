import { describe, expect, it, vi } from "vitest"

vi.mock("../driver", () => ({
  LiveBrowserUnavailableError: class LiveBrowserUnavailableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "LiveBrowserUnavailableError"
    }
  },
  materializeFixturePage: vi.fn(async () => ({
    artifactDir: "/tmp/astra-live/live-page-translation",
    htmlPath: "/tmp/astra-live/live-page-translation/article-basic.html",
    url: "file:///tmp/astra-live/live-page-translation/article-basic.html",
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
      evaluate: vi.fn(async () => undefined),
      content: vi.fn(async () => `<!doctype html><html><body><main>
  <article>
    <h1>Astra turns long-form reading into bilingual learning.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:Astra turns long-form reading into bilingual lea</span></span></h1>
    <p>Readers can keep the original text visible while reviewing a translation below it.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:Readers can keep the original text visible while</span></span></p>
    <p>This fixture represents a straightforward article page with a clear main content root.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:This fixture represents a straightforward articl</span></span></p>
    <blockquote>The goal is to test article-centric extraction without noisy chrome.<span class="notranslate astra-translation astra-theme-default astra-mode-bilingual" translate="no" data-astra-translation="1" lang="zh-CN"><span class="notranslate astra-translation-inner">ZH:The goal is to test article-centric extraction w</span></span></blockquote>
  </article>
</main></body></html>`),
      screenshot: vi.fn(async () => undefined),
    }

    return await callback(
      page as never,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )
  }),
}))

import { createLiveRuntime, evaluateLiveScenario } from "../index"
import { pageTranslationArticleBasicScenario } from "./page-translation-article-basic"

describe("pageTranslationArticleBasicScenario", () => {
  it("reuses the page-translation evaluator contract and passes for the article-basic live shape", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: pageTranslationArticleBasicScenario.id,
      title: pageTranslationArticleBasicScenario.title,
      surface: pageTranslationArticleBasicScenario.surface,
      fixture: pageTranslationArticleBasicScenario.fixture ?? null,
      description: pageTranslationArticleBasicScenario.description ?? null,
      tags: [...(pageTranslationArticleBasicScenario.tags ?? [])],
      runId: "live-page-translation-run",
    }

    const execution = await pageTranslationArticleBasicScenario.run(runtime, context)
    const result = await evaluateLiveScenario(pageTranslationArticleBasicScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("pass")
    expect(result.pass).toBe(true)
    expect(result.score).toBe(100)
    expect(result.issues).toHaveLength(0)
    expect(result.artifacts.execution.artifacts).toMatchObject({
      screenshotPath: "/tmp/astra-live/live-page-translation/article-basic.page-translation.png",
      snapshotHtmlPath: "/tmp/astra-live/live-page-translation/article-basic.page-translation.snapshot.html",
    })
    expect(result.artifacts.evaluation).toMatchObject({
      pass: true,
      score: 100,
    })
  })
})
