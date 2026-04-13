import { describe, expect, it, vi } from "vitest"

const FIXTURE_HTML: Record<string, string> = {
  "docs-sidebar-heavy": `<main>
  <article id="docs-article">
    <h1>Contextual translation pipeline</h1>
    <p>Astra processes each visible text block through a translation pipeline.</p>
    <p>The content script collects stable blocks and batches them conservatively.</p>
    <p>Documentation pages often contain sidebars and utility chrome.</p>
    <p>Inline explanation should reuse page summary context.</p>
  </article>
</main>`,
  "blog-comments-mixed": `<main>
  <article id="blog-article">
    <h1>Shipping inline explanations without UI clutter</h1>
    <p>Inline explanation cards need to appear fast enough to feel responsive.</p>
    <p>A resilient implementation caches successful answers.</p>
    <p>Product polish comes from predictable suppression rules.</p>
    <p>This fixture intentionally mixes a valid article with comments nearby.</p>
  </article>
</main>`,
  "forum-thread": `<main class="thread-layout">
  <section class="thread-post">
    <h2>Original post</h2>
    <p>I am seeing intermittent request failures in a browser extension.</p>
    <p>This page should not be treated as a single longform reading surface.</p>
  </section>
  <section class="thread-post">
    <h2>Reply one</h2>
    <p>Keep retries centralised and typed.</p>
  </section>
  <section class="thread-post">
    <h2>Reply two</h2>
    <p>Add more test fixtures before changing readability heuristics.</p>
  </section>
</main>`,
  "marketing-landing": `<main class="landing-page">
  <section class="hero">
    <h1>Translate the web with context, not guesswork</h1>
    <p>Astra keeps bilingual reading fast, accurate, and privacy-aware.</p>
    <p>Install once and unlock immersive translation.</p>
  </section>
  <section class="feature-grid">
    <div><h2>Context aware</h2><p>Carry page summaries into each request.</p></div>
    <div><h2>Inline actions</h2><p>Explain sentences and keep reading.</p></div>
    <div><h2>Site controls</h2><p>Choose language and trigger behavior per site.</p></div>
  </section>
</main>`,
}

vi.mock("../driver", () => ({
  LiveBrowserUnavailableError: class LiveBrowserUnavailableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "LiveBrowserUnavailableError"
    }
  },
  materializeFixturePage: vi.fn(async ({ fixtureName }: { fixtureName: string }) => ({
    artifactDir: "/tmp/astra-live/article-extraction-proof",
    htmlPath: `/tmp/astra-live/article-extraction-proof/${fixtureName}.html`,
    url: `file:///tmp/astra-live/article-extraction-proof/${fixtureName}.html`,
    fixtureHtml: FIXTURE_HTML[fixtureName],
  })),
  withLiveBrowserPage: vi.fn(async (callback: (page: unknown, browserExecutablePath: string) => Promise<unknown>) => {
    let currentFixture = "docs-sidebar-heavy"
    const listeners = new Map<string, Set<(payload: unknown) => void>>()

    const page = {
      goto: vi.fn(async (url: string) => {
        currentFixture = url.match(/\/([^/]+)\.html$/)?.[1] ?? currentFixture
      }),
      waitForSelector: vi.fn(async () => undefined),
      screenshot: vi.fn(async () => undefined),
      content: vi.fn(async () => `<!doctype html><html><body>${FIXTURE_HTML[currentFixture]}</body></html>`),
      evaluate: vi.fn(async (fn: ((arg: unknown) => unknown) | (() => unknown), arg?: unknown) => {
        if (typeof fn === "function") {
          return arg === undefined
            ? (fn as () => unknown)()
            : (fn as (value: unknown) => unknown)(arg)
        }
        return undefined
      }),
      on: vi.fn((event: string, listener: (payload: unknown) => void) => {
        const bucket = listeners.get(event) ?? new Set<(payload: unknown) => void>()
        bucket.add(listener)
        listeners.set(event, bucket)
      }),
      off: vi.fn((event: string, listener: (payload: unknown) => void) => {
        listeners.get(event)?.delete(listener)
      }),
    }

    return await callback(
      page as never,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )
  }),
}))

import { createLiveRuntime, evaluateLiveScenario } from "../index"
import { articleExtractionDocsScenario } from "./article-extraction-docs"
import { withLiveBrowserPage, LiveBrowserUnavailableError } from "../driver"

describe("articleExtractionDocsScenario", () => {
  it("reuses the article-extraction evaluator contract across docs/blog/forum/landing live fixtures", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: articleExtractionDocsScenario.id,
      title: articleExtractionDocsScenario.title,
      surface: articleExtractionDocsScenario.surface,
      fixture: articleExtractionDocsScenario.fixture ?? null,
      description: articleExtractionDocsScenario.description ?? null,
      tags: [...(articleExtractionDocsScenario.tags ?? [])],
      runId: "live-article-extraction-proof",
    }

    const execution = await articleExtractionDocsScenario.run(runtime, context)
    const result = await evaluateLiveScenario(articleExtractionDocsScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("pass")
    expect(result.pass).toBe(true)
    expect(result.score).toBe(100)
    expect(result.issues).toHaveLength(0)
    expect(execution.articleExtractionCases).toHaveLength(4)
    const executionArtifacts = ((result.artifacts as unknown) as { execution: { artifacts: { browserExecutablePath?: string; cases?: unknown[] } } }).execution.artifacts
    expect(executionArtifacts).toMatchObject({
      browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    })
    expect(executionArtifacts.cases).toHaveLength(4)
  })

  it("preserves a skipped result when the browser is unavailable", async () => {
    vi.mocked(withLiveBrowserPage).mockRejectedValueOnce(
      new LiveBrowserUnavailableError("browser missing"),
    )

    const runtime = createLiveRuntime()
    const context = {
      id: articleExtractionDocsScenario.id,
      title: articleExtractionDocsScenario.title,
      surface: articleExtractionDocsScenario.surface,
      fixture: articleExtractionDocsScenario.fixture ?? null,
      description: articleExtractionDocsScenario.description ?? null,
      tags: [...(articleExtractionDocsScenario.tags ?? [])],
      runId: "live-article-extraction-skipped",
    }

    const execution = await articleExtractionDocsScenario.run(runtime, context)
    const result = await evaluateLiveScenario(articleExtractionDocsScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(execution.status).toBe("skipped")
    expect(result.status).toBe("skipped")
    expect(result.summary).toContain("No supported browser executable available")
  })
})
