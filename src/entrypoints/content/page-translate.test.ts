import { beforeEach, describe, expect, it, vi } from "vitest"

const { readConfigMock, translateTextsMock } = vi.hoisted(() => ({
  readConfigMock: vi.fn(() => Promise.resolve({
    version: 1,
    targetLang: "zh-CN",
    provider: {
      id: "openai" as const,
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-5.4-nano",
    },
    presentation: {
      mode: "bilingual" as const,
      theme: "default" as const,
    },
    sites: {},
  })),
  translateTextsMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

import { SITE_RULE_FILTER_STAGE_ORDER } from "@/types/translation"
import {
  getPageTranslationState,
  startPageTranslation,
  stopPageTranslation,
  retryFailedBlocks,
  translatePageElement,
  translatePageElements,
} from "./page-translate"

function setRect(element: Element, top: number, height = 20) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width: 100,
      height,
      top,
      bottom: top + height,
      left: 0,
      right: 100,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  })
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  private readonly callback: IntersectionObserverCallback
  readonly observed = new Set<Element>()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  disconnect() {
    this.observed.clear()
  }

  observe(element: Element) {
    this.observed.add(element)
  }

  trigger(element: Element, isIntersecting = true) {
    this.callback([{
      target: element,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: element.getBoundingClientRect(),
      rootBounds: null,
      time: 0,
    } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }

  unobserve(element: Element) {
    this.observed.delete(element)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

describe("page translation controller", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = []
    translateTextsMock.mockReset()
    readConfigMock.mockReset()
    readConfigMock.mockResolvedValue({
      version: 1,
      targetLang: "zh-CN",
      provider: {
        id: "openai",
        accessToken: "astra-token",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {},
    })

    document.title = "Astra Test Page"
    document.head.innerHTML = '<meta name="description" content="A page about browser translation." />'
    document.body.innerHTML = `
      <main>
        <p id="visible">Visible text</p>
        <p id="offscreen">Offscreen text</p>
      </main>
    `

    window.history.replaceState({}, "", "/article?foo=1#bar")

    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 })
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: MockIntersectionObserver,
    })

    setRect(document.getElementById("visible")!, 50)
    setRect(document.getElementById("offscreen")!, 2000)
  })

  it("can stop and restart the same page session", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const firstSessionId = getPageTranslationState().sessionId
    expect(document.querySelector("[data-astra-translation=\"1\"]")).not.toBeNull()

    stopPageTranslation()
    expect(document.querySelector("[data-astra-translation]")).toBeNull()

    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["再次翻译"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(getPageTranslationState().sessionId).toBeGreaterThan(firstSessionId)
    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(document.querySelector("[data-astra-translation=\"1\"]")).not.toBeNull()
  })

  it("ignores late async results after stop", async () => {
    let resolveTranslation!: (value: { ok: true; translations: string[] }) => void
    translateTextsMock.mockReturnValue(new Promise((resolve) => {
      resolveTranslation = resolve
    }))

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()
    stopPageTranslation()

    resolveTranslation({ ok: true, translations: ["不应该出现"] })
    await flushPromises()

    expect(document.querySelector("[data-astra-translation]")).toBeNull()
    expect(getPageTranslationState().phase).toBe("idle")
  })

  it("ignores late async failures after stop", async () => {
    let rejectTranslation!: (error: Error) => void
    translateTextsMock.mockReturnValue(new Promise((_resolve, reject) => {
      rejectTranslation = reject
    }))

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()
    stopPageTranslation()

    rejectTranslation(new Error("late relay failure"))
    await flushPromises()

    expect(document.querySelector("[data-astra-translation]")).toBeNull()
    expect(document.querySelector("[data-astra-translation-error='1']")).toBeNull()
    expect(getPageTranslationState().phase).toBe("idle")
    expect(getPageTranslationState().lastError).toBeNull()
  })

  it("renders loading placeholders for queued visible blocks while translation is pending", async () => {
    let resolveTranslation!: (value: { ok: true; translations: string[] }) => void
    translateTextsMock.mockReturnValue(new Promise((resolve) => {
      resolveTranslation = resolve
    }))

    await startPageTranslation({ targetLang: "zh-CN" })

    const visible = document.getElementById("visible")!
    expect(visible.querySelector("[data-astra-translation=\"loading\"]")?.textContent).toContain("⋯")
    expect(document.getElementById("offscreen")?.querySelector("[data-astra-translation]")).toBeNull()

    resolveTranslation({ ok: true, translations: ["可见文本"] })
    await flushPromises()

    expect(visible.querySelector("[data-astra-translation=\"loading\"]")).toBeNull()
    expect(visible.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("可见文本")
  })

  it("keeps exhausted paragraph failures visible and retryable", async () => {
    document.body.innerHTML = `
      <main>
        <p id="only-visible">Visible text</p>
      </main>
    `
    setRect(document.getElementById("only-visible")!, 50)

    translateTextsMock.mockResolvedValue({
      ok: false,
      error: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    for (let i = 0; i < 8; i++) {
      await flushPromises()
    }

    expect(getPageTranslationState().phase).toBe("idle")
    expect(getPageTranslationState().lastError?.message).toBe("Your membership is active. Astra is reconnecting.")
    expect(getPageTranslationState().progress.failedBlocks).toBe(1)

    const retryButton = document.querySelector<HTMLButtonElement>("[data-astra-error-retry='1']")
    expect(retryButton?.textContent).toContain("Retry paragraph")
    const inlineError = document.querySelector("[data-astra-translation-error='1']")
    expect(inlineError?.textContent).toContain("Couldn't translate this paragraph.")
    expect(inlineError?.getAttribute("aria-label")).toContain("Your membership is active. Astra is reconnecting.")
    expect(inlineError?.getAttribute("aria-label")).not.toContain("Relay unavailable")

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["重试成功"],
    })

    retryFailedBlocks({ serviceMode: "fast" })
    expect(getPageTranslationState().phase).toBe("running")
    expect(document.querySelector("[data-astra-translation=\"loading\"]")?.textContent).toContain("⋯")
    for (let i = 0; i < 4; i++) {
      await flushPromises()
    }

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({ serviceMode: "fast" }))
    expect(document.querySelector("[data-astra-translation-error='1']")).toBeNull()
    expect(document.querySelector(".astra-translation-inner")?.textContent).toBe("重试成功")
  })

  it("translates text blocks inside open shadow roots", async () => {
    document.title = "Shadow Test Page"
    document.body.innerHTML = `
      <main>
        <article>
          <astra-card id="shadow-host"></astra-card>
        </article>
      </main>
    `
    const host = document.getElementById("shadow-host") as HTMLElement
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<p id="shadow-paragraph">Shadow paragraph text</p>`
    const shadowParagraph = shadow.getElementById("shadow-paragraph") as HTMLParagraphElement
    setRect(shadowParagraph, 60)
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["影子测试页", "阴影段落文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Shadow Test Page", "Shadow paragraph text"],
      targetLang: "zh-CN",
    }))
    expect(shadowParagraph.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("阴影段落文本")
  })

  it("translates the page title with the first visible batch and restores it on stop", async () => {
    document.title = "Astra Test Page"
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["阿斯特拉测试页", "可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Astra Test Page", "Visible text"],
      targetLang: "zh-CN",
    }))
    expect(document.title).toBe("阿斯特拉测试页")
    expect(document.getElementById("visible")?.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("可见文本")

    stopPageTranslation()
    expect(document.title).toBe("Astra Test Page")
  })

  it("covers static article pages while skipping non-reading chrome", async () => {
    document.body.innerHTML = `
      <nav><p id="article-nav">Navigation headline should stay untouched</p></nav>
      <article>
        <h1 id="article-title">Astra improves reading flow</h1>
        <p id="article-lede">Static article lead paragraph for first-pass page translation.</p>
        <blockquote id="article-quote">A concise quote remains part of the article.</blockquote>
      </article>
      <aside><p id="article-aside">Sponsored sidebar copy should stay untouched</p></aside>
    `
    document.title = "Static Article Fixture"
    setRect(document.getElementById("article-title")!, 40)
    setRect(document.getElementById("article-lede")!, 80)
    setRect(document.getElementById("article-quote")!, 120)
    setRect(document.getElementById("article-nav")!, 20)
    setRect(document.getElementById("article-aside")!, 160)
    translateTextsMock.mockImplementation(({ texts }: { texts: string[] }) => Promise.resolve({
      ok: true,
      translations: texts.map((text) => `zh:${text}`),
    }))

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: [
        "Static Article Fixture",
        "Astra improves reading flow",
        "Static article lead paragraph for first-pass page translation.",
        "A concise quote remains part of the article.",
      ],
      targetLang: "zh-CN",
    }))
    expect(document.getElementById("article-lede")?.querySelector("[data-astra-translation=\"1\"]")?.textContent)
      .toContain("zh:Static article lead paragraph")
    expect(document.getElementById("article-nav")?.querySelector("[data-astra-translation]")).toBeNull()
    expect(document.getElementById("article-aside")?.querySelector("[data-astra-translation]")).toBeNull()
  })

  it("distinguishes immersive page scope from full_page landmark coverage", async () => {
    document.body.innerHTML = `
      <header><h1 id="scope-header">Header announcement</h1></header>
      <nav><p id="scope-nav">Navigation label</p></nav>
      <main><p id="scope-main">Main paragraph for translation.</p></main>
      <aside><p id="scope-aside">Aside helper text.</p></aside>
      <footer><p id="scope-footer">Footer support copy.</p></footer>
      <pre id="scope-code">const secret = 1</pre>
    `
    document.title = "Scope Fixture"
    for (const [id, top] of [
      ["scope-header", 20],
      ["scope-nav", 40],
      ["scope-main", 80],
      ["scope-aside", 120],
      ["scope-footer", 160],
      ["scope-code", 200],
    ] as const) {
      setRect(document.getElementById(id)!, top)
    }
    translateTextsMock.mockImplementation(({ texts }: { texts: string[] }) => Promise.resolve({
      ok: true,
      translations: texts.map((text) => `zh:${text}`),
    }))

    await startPageTranslation({ targetLang: "zh-CN", contentScope: "immersive" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Scope Fixture", "Main paragraph for translation."],
    }))
    expect(getPageTranslationState().diagnostics).toMatchObject({
      contentScope: "immersive",
      effectiveContentScope: "immersive",
    })
    expect(document.getElementById("scope-header")?.querySelector("[data-astra-translation]")).toBeNull()
    expect(document.getElementById("scope-footer")?.querySelector("[data-astra-translation]")).toBeNull()
    stopPageTranslation()

    await startPageTranslation({ targetLang: "zh-CN", contentScope: "full_page" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: [
        "Scope Fixture",
        "Header announcement",
        "Navigation label",
        "Main paragraph for translation.",
        "Aside helper text.",
        "Footer support copy.",
      ],
    }))
    expect(getPageTranslationState().diagnostics).toMatchObject({
      contentScope: "full_page",
      effectiveContentScope: "full_page",
    })
    expect(document.getElementById("scope-header")?.querySelector("[data-astra-translation=\"1\"]")?.textContent)
      .toContain("zh:Header announcement")
    expect(document.getElementById("scope-footer")?.querySelector("[data-astra-translation=\"1\"]")?.textContent)
      .toContain("zh:Footer support copy.")
    expect(document.getElementById("scope-code")?.querySelector("[data-astra-translation]")).toBeNull()
  })

  it("covers news pages with article body and captions but not ads or header chrome", async () => {
    document.body.innerHTML = `
      <header><p id="news-header">Breaking news nav should stay untouched</p></header>
      <main>
        <article>
          <h1 id="news-headline">City council approves new library plan</h1>
          <p id="news-lede">The plan adds reading rooms and language classes downtown.</p>
          <figure>
            <figcaption id="news-caption">Residents gather outside the historic library.</figcaption>
          </figure>
        </article>
      </main>
      <div class="ad-slot"><p id="news-ad">Advertisement copy should stay untouched</p></div>
    `
    document.title = "News Fixture"
    setRect(document.getElementById("news-headline")!, 45)
    setRect(document.getElementById("news-lede")!, 90)
    setRect(document.getElementById("news-caption")!, 135)
    setRect(document.getElementById("news-header")!, 10)
    setRect(document.getElementById("news-ad")!, 180)
    translateTextsMock.mockImplementation(({ texts }: { texts: string[] }) => Promise.resolve({
      ok: true,
      translations: texts.map((text) => `zh:${text}`),
    }))

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: [
        "News Fixture",
        "City council approves new library plan",
        "The plan adds reading rooms and language classes downtown.",
        "Residents gather outside the historic library.",
      ],
      targetLang: "zh-CN",
    }))
    expect(document.getElementById("news-caption")?.querySelector("[data-astra-translation=\"1\"]")?.textContent)
      .toContain("zh:Residents gather outside the historic library.")
    expect(document.getElementById("news-header")?.querySelector("[data-astra-translation]")).toBeNull()
    expect(document.getElementById("news-ad")?.querySelector("[data-astra-translation]")).toBeNull()
  })

  it("covers documentation pages while preserving code examples", async () => {
    document.body.innerHTML = `
      <main>
        <article>
          <h1 id="docs-title">Install Astra in your browser</h1>
          <p id="docs-intro">Follow these setup steps before starting your first translation.</p>
          <pre id="docs-code"><code>pnpm dev:web</code></pre>
          <ol>
            <li id="docs-step">Open the extension popup and choose your target language.</li>
          </ol>
        </article>
      </main>
      <nav><p id="docs-nav">Docs navigation should stay untouched</p></nav>
    `
    document.title = "Docs Fixture"
    setRect(document.getElementById("docs-title")!, 40)
    setRect(document.getElementById("docs-intro")!, 85)
    setRect(document.getElementById("docs-code")!, 130)
    setRect(document.getElementById("docs-step")!, 175)
    setRect(document.getElementById("docs-nav")!, 20)
    translateTextsMock.mockImplementation(({ texts }: { texts: string[] }) => Promise.resolve({
      ok: true,
      translations: texts.map((text) => `zh:${text}`),
    }))

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: [
        "Docs Fixture",
        "Install Astra in your browser",
        "Follow these setup steps before starting your first translation.",
        "Open the extension popup and choose your target language.",
      ],
      targetLang: "zh-CN",
    }))
    expect(document.getElementById("docs-step")?.querySelector("[data-astra-translation=\"1\"]")?.textContent)
      .toContain("zh:Open the extension popup")
    expect(document.getElementById("docs-code")?.querySelector("[data-astra-translation]")).toBeNull()
    expect(document.getElementById("docs-nav")?.querySelector("[data-astra-translation]")).toBeNull()
  })

  it("strips rich page context when privacy mode is enabled", async () => {
    document.title = "Astra Test Page"
    readConfigMock.mockResolvedValueOnce({
      version: 1,
      targetLang: "zh-CN",
      privacyMode: true,
      provider: {
        id: "openai",
        accessToken: "astra-token",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {},
    } as any)
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["阿斯特拉测试页", "可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Astra Test Page", "Visible text"],
      targetLang: "zh-CN",
      context: {
        hostname: window.location.hostname,
        pageUrl: `${window.location.origin}/article`,
      },
    }))
    const request = translateTextsMock.mock.calls[0]?.[0]
    expect(request?.context).not.toHaveProperty("pageTitle")
    expect(request?.context).not.toHaveProperty("metaDescription")
    expect(request?.context).not.toHaveProperty("contentSummary")
    expect(request?.context?.pageUrl).not.toContain("foo=1")
    expect(request?.context?.pageUrl).not.toContain("#bar")
  })

  it("passes page context and only translates visible blocks immediately", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Visible text"],
      targetLang: "zh-CN",
      context: expect.objectContaining({
        hostname: window.location.hostname,
        pageUrl: `${window.location.origin}/article`,
        metaDescription: "A page about browser translation.",
        contentSummary: expect.stringContaining("Visible text"),
      }),
    }))

    const observer = MockIntersectionObserver.instances[0]
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["离屏文本"],
    })
    observer.trigger(document.getElementById("offscreen")!)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Offscreen text"],
      targetLang: "zh-CN",
      context: expect.objectContaining({
        pageUrl: `${window.location.origin}/article`,
      }),
    }))
  })

  it("carries same-page translation memory into later progressive batches", async () => {
    document.title = ""
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["可见文本"] })
      .mockResolvedValueOnce({ ok: true, translations: ["离屏文本"] })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const observer = MockIntersectionObserver.instances[0]
    observer.trigger(document.getElementById("offscreen")!)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Offscreen text"],
      context: expect.objectContaining({
        translationMemory: "Visible text => 可见文本",
      }),
    }))
  })

  it("prioritizes current viewport blocks before below-fold prefetch and defers far blocks", async () => {
    document.title = ""
    document.body.innerHTML = `
      <main>
        <p id="below-prefetch">Below fold paragraph within the next reading screen.</p>
        <p id="far-rest">Far down page paragraph should wait for intersection.</p>
        <p id="current-viewport">Current viewport paragraph should translate first.</p>
      </main>
    `
    const below = document.getElementById("below-prefetch")!
    const far = document.getElementById("far-rest")!
    const current = document.getElementById("current-viewport")!
    setRect(below, 900)
    setRect(far, 2400)
    setRect(current, 50)
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["当前视口段落", "下方预取段落"] })
      .mockResolvedValueOnce({ ok: true, translations: ["远端段落"] })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: [
        "Current viewport paragraph should translate first.",
        "Below fold paragraph within the next reading screen.",
      ],
      targetLang: "zh-CN",
    }))
    expect(current.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("当前视口段落")
    expect(below.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("下方预取段落")
    expect(far.querySelector("[data-astra-translation]")).toBeNull()

    const observer = MockIntersectionObserver.instances[0]
    observer.trigger(far)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Far down page paragraph should wait for intersection."],
      targetLang: "zh-CN",
    }))
    expect(far.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("远端段落")
  })

  it("does not include document title when explicit site rules restrict translated content", async () => {
    document.title = "Filtered Article Shell"
    document.body.innerHTML = `
      <main>
        <article>
          <p id="rule-target">This long-form article paragraph is the only content that should be translated by the site rule filter.</p>
        </article>
        <aside><p id="rule-aside">Sidebar text should stay untouched.</p></aside>
      </main>
    `
    setRect(document.getElementById("rule-target")!, 40)
    setRect(document.getElementById("rule-aside")!, 80)
    translateTextsMock.mockImplementation(({ texts }: { texts: string[] }) => Promise.resolve({
      ok: true,
      translations: texts.map((text) => `zh:${text}`),
    }))

    await startPageTranslation({
      targetLang: "zh-CN",
      selectors: ["article"],
      excludeSelectors: ["aside"],
      paragraphMinLength: 40,
    })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["This long-form article paragraph is the only content that should be translated by the site rule filter."],
      targetLang: "zh-CN",
    }))
    expect(document.title).toBe("Filtered Article Shell")
    expect(document.getElementById("rule-target")?.querySelector("[data-astra-translation=\"1\"]")?.textContent)
      .toContain("zh:This long-form article paragraph")
    expect(document.getElementById("rule-aside")?.querySelector("[data-astra-translation]")).toBeNull()

    stopPageTranslation()
  })

  it("publishes site-rule diagnostics for invalid selectors and no-match filters", async () => {
    document.body.innerHTML = `
      <main>
        <p id="diagnostic-visible">Diagnostic visible text block long enough</p>
        <p id="diagnostic-second">Another diagnostic text block long enough</p>
      </main>
    `
    setRect(document.getElementById("diagnostic-visible")!, 40)
    setRect(document.getElementById("diagnostic-second")!, 80)

    await startPageTranslation({
      targetLang: "zh-CN",
      selectors: [".missing-article", "article["],
      excludeSelectors: [".ad-slot"],
      paragraphMinLength: 30,
    })
    await flushPromises()

    const diagnostics = getPageTranslationState().diagnostics?.siteRules
    expect(diagnostics?.inputBlockCount).toBeGreaterThan(0)
    expect(diagnostics?.selectors.valid).toEqual([".missing-article"])
    expect(diagnostics?.selectors.invalid).toEqual(["article["])
    expect(diagnostics?.selectors.matchedBlocks).toBe(0)
    expect(diagnostics?.afterIncludeCount).toBe(0)
    expect(diagnostics?.afterParagraphCount).toBe(0)
    expect(diagnostics?.filterStages?.map((stage) => stage.id)).toEqual(SITE_RULE_FILTER_STAGE_ORDER)
    expect(diagnostics?.filterStages?.map((stage) => stage.count)).toEqual([
      diagnostics?.inputBlockCount,
      diagnostics?.afterIncludeCount,
      diagnostics?.afterExcludeCount,
      diagnostics?.afterParagraphCount,
    ])
    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("translates one target paragraph without starting a full page session", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["只翻译这一段"],
    })

    const visible = document.getElementById("visible") as HTMLParagraphElement
    const offscreen = document.getElementById("offscreen") as HTMLParagraphElement
    const result = await translatePageElement(visible, { targetLang: "zh-CN" })
    await flushPromises()

    expect(result).toEqual({ ok: true, translatedBlocks: 1, failedBlocks: 0 })
    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Visible text"],
      targetLang: "zh-CN",
      context: expect.objectContaining({
        pageUrl: `${window.location.origin}/article`,
        contentSummary: expect.stringContaining("Visible text"),
      }),
    }))
    expect(visible.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("只翻译这一段")
    expect(offscreen.querySelector("[data-astra-translation]")).toBeNull()
  })

  it("translates a targeted section as multiple existing text blocks", async () => {
    document.body.innerHTML = `
      <main>
        <section id="target-section">
          <p id="section-one">First section paragraph</p>
          <p id="section-two">Second section paragraph</p>
        </section>
        <p id="outside-section">Outside paragraph</p>
      </main>
    `
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["第一段", "第二段"],
    })

    const sectionBlocks = Array.from(document.querySelectorAll<HTMLElement>("#target-section p"))
    const result = await translatePageElements(sectionBlocks, { targetLang: "zh-CN" })
    await flushPromises()

    expect(result).toEqual({ ok: true, translatedBlocks: 2, failedBlocks: 0 })
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["First section paragraph", "Second section paragraph"],
      targetLang: "zh-CN",
    }))
    expect(document.getElementById("section-one")?.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("第一段")
    expect(document.getElementById("section-two")?.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("第二段")
    expect(document.getElementById("outside-section")?.querySelector("[data-astra-translation]")).toBeNull()
  })

  it("renders an inline error for targeted paragraph failures", async () => {
    translateTextsMock.mockResolvedValue({
      ok: false,
      error: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
    })

    const visible = document.getElementById("visible") as HTMLParagraphElement
    const result = await translatePageElement(visible, { targetLang: "zh-CN" })
    await flushPromises()

    expect(result).toEqual({
      ok: false,
      translatedBlocks: 0,
      failedBlocks: 1,
      message: "Your membership is active. Astra is reconnecting.",
    })
    expect(visible.querySelector("[data-astra-translation-error='1']")?.textContent).toContain("Couldn't translate this paragraph.")
    expect(visible.querySelector("[data-astra-translation-error='1']")?.getAttribute("aria-label")).toContain("Your membership is active. Astra is reconnecting.")
    expect(visible.querySelector("[data-astra-translation-error='1']")?.getAttribute("aria-label")).not.toContain("Relay unavailable")
  })

  it("serializes rich inline text into placeholders and restores safe inline markup", async () => {
    document.body.innerHTML = `
      <main>
        <p id="rich">This has <strong>bold text</strong> and <em>emphasis</em>.</p>
      </main>
    `
    setRect(document.getElementById("rich")!, 40)

    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["这里有__ASTRA_RT_0_OPEN_STRONG__粗体__ASTRA_RT_0_CLOSE__和__ASTRA_RT_1_OPEN_EM__强调__ASTRA_RT_1_CLOSE__。"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: [expect.stringContaining("__ASTRA_RT_0_OPEN_STRONG__")],
      placeholderFormat: "astra-rich-text-v1",
    }))

    const translationInner = document.querySelector(".astra-translation-inner")
    expect(translationInner?.textContent).toBe("这里有粗体和强调。")
    expect(translationInner?.querySelector("strong")?.textContent).toBe("粗体")
    expect(translationInner?.querySelector("em")?.textContent).toBe("强调")
    expect(translationInner?.textContent).not.toContain("__ASTRA_RT_")
  })

  it("falls back to plain text when provider returns malformed placeholders", async () => {
    document.body.innerHTML = `
      <main>
        <p id="rich">This has <strong>bold text</strong>.</p>
      </main>
    `
    setRect(document.getElementById("rich")!, 40)

    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["这里有__ASTRA_RT_0_OPEN_STRONG__粗体内容。"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const translationInner = document.querySelector(".astra-translation-inner")
    expect(translationInner?.textContent).toBe("这里有粗体内容。")
    expect(translationInner?.querySelector("strong")).toBeNull()
    expect(translationInner?.textContent).not.toContain("__ASTRA_RT_")
  })

  it("translates accordion content after it is revealed", async () => {
    vi.useFakeTimers()
    document.title = "Accordion Test Page"
    document.body.innerHTML = `
      <main>
        <p id="visible">Visible text</p>
        <section>
          <p id="accordion-panel" style="display: none">Hidden accordion text</p>
        </section>
      </main>
    `
    const visible = document.getElementById("visible") as HTMLElement
    const panel = document.getElementById("accordion-panel") as HTMLElement
    setRect(visible, 50)
    setRect(panel, 90)
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["手风琴测试页", "可见文本"] })
      .mockResolvedValueOnce({ ok: true, translations: ["展开后的内容"] })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(panel.querySelector("[data-astra-translation]")).toBeNull()

    panel.style.display = "block"
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Hidden accordion text"],
      targetLang: "zh-CN",
    }))
    expect(panel.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("展开后的内容")

    vi.useRealTimers()
  })

  it("translates newly appended forum comments", async () => {
    vi.useFakeTimers()
    document.title = "Forum Thread Test Page"
    document.body.innerHTML = `
      <main>
        <article><p id="post-body">Original forum post</p></article>
        <section id="comments" aria-label="Comments"></section>
      </main>
    `
    const postBody = document.getElementById("post-body") as HTMLElement
    setRect(postBody, 40)
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["论坛帖子测试页", "原始论坛帖子"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const comments = document.getElementById("comments") as HTMLElement
    const comment = document.createElement("div")
    comment.className = "comment"
    comment.innerHTML = `<p id="new-comment">New comment added by live thread</p>`
    const commentParagraph = comment.querySelector("p") as HTMLElement
    setRect(commentParagraph, 120)
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["实时线程新增评论"],
    })

    comments.appendChild(comment)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["New comment added by live thread"],
      targetLang: "zh-CN",
    }))
    expect(commentParagraph.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("实时线程新增评论")

    vi.useRealTimers()
  })

  it("translates newly appended infinite-scroll paragraphs", async () => {
    vi.useFakeTimers()
    document.title = "Infinite Scroll Test Page"
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["无限滚动测试页", "可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const main = document.querySelector("main")!
    const feedItem = document.createElement("article")
    const paragraph = document.createElement("p")
    paragraph.textContent = "Infinite scroll paragraph"
    feedItem.appendChild(paragraph)
    setRect(paragraph, 120)
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["无限滚动段落"],
    })

    main.appendChild(feedItem)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Infinite scroll paragraph"],
      targetLang: "zh-CN",
      context: expect.objectContaining({
        pageUrl: `${window.location.origin}/article`,
      }),
    }))
    expect(paragraph.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("无限滚动段落")

    vi.useRealTimers()
  })

  it("translates a lazy-loaded article body after it mounts", async () => {
    vi.useFakeTimers()
    document.title = "Lazy Article Test Page"
    document.body.innerHTML = `
      <main>
        <article id="lazy-article">
          <h1>Lazy article shell</h1>
        </article>
      </main>
    `
    const heading = document.querySelector("h1") as HTMLElement
    setRect(heading, 40)
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["懒加载文章测试页", "懒加载文章外壳"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const lazyBody = document.createElement("div")
    lazyBody.className = "article-body"
    const paragraph = document.createElement("p")
    paragraph.textContent = "Lazy-loaded article body paragraph"
    lazyBody.appendChild(paragraph)
    setRect(paragraph, 90)
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["懒加载正文段落"],
    })

    document.getElementById("lazy-article")?.appendChild(lazyBody)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Lazy-loaded article body paragraph"],
      targetLang: "zh-CN",
    }))
    expect(paragraph.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("懒加载正文段落")

    vi.useRealTimers()
  })

  it("cleans up disconnected blocks from registry progress and observers", async () => {
    vi.useFakeTimers()
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const observer = MockIntersectionObserver.instances[0]
    const offscreen = document.getElementById("offscreen")!
    offscreen.remove()

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(getPageTranslationState().progress.totalBlocks).toBe(1)
    expect(observer.observed.has(offscreen)).toBe(false)

    vi.useRealTimers()
  })

  it("cancels stale starts when config resolution races", async () => {
    let resolveConfig!: () => void
    readConfigMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveConfig = () => {
        resolve({
          version: 1,
          targetLang: "zh-CN",
          provider: {
            id: "openai",
            accessToken: "astra-token",
            relayBaseURL: "https://astra.example/v1",
            model: "gpt-5.4-nano",
          },
          presentation: {
            mode: "bilingual",
            theme: "default",
          },
          sites: {},
        })
      }
    }))

    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["新的翻译"],
    })

    const firstStart = startPageTranslation()
    const secondStart = startPageTranslation({ targetLang: "ja" })
    resolveConfig()

    await Promise.all([firstStart, secondStart])
    await flushPromises()

    expect(getPageTranslationState().targetLang).toBe("ja")
    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith({
      texts: ["Visible text"],
      targetLang: "ja",
      serviceMode: undefined,
      context: expect.any(Object),
    })
  })

  it("tracks presentation mode and progress in the translation snapshot", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["仅译文"],
    })

    await startPageTranslation({
      targetLang: "zh-CN",
      translationMode: "translation-only",
      translationTheme: "highlight",
    })
    await flushPromises()

    expect(getPageTranslationState()).toMatchObject({
      phase: "running",
      presentation: {
        mode: "translation-only",
        theme: "highlight",
      },
      progress: {
        totalBlocks: 2,
        translatedBlocks: 1,
      },
      site: {
        hostname: window.location.hostname,
        enabled: true,
      },
    })
  })

  it("applies mask theme to translated page nodes", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["遮罩译文"],
    })

    await startPageTranslation({
      targetLang: "zh-CN",
      translationTheme: "mask",
    })
    await flushPromises()

    expect(getPageTranslationState().presentation.theme).toBe("mask")
    expect(document.querySelector("[data-astra-translation='1']")?.classList.contains("astra-theme-mask")).toBe(true)
  })

  it("stops immediately when the current site is disabled", async () => {
    readConfigMock.mockResolvedValueOnce({
      version: 1,
      targetLang: "zh-CN",
      provider: {
        id: "openai",
        accessToken: "astra-token",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {
        [window.location.hostname]: {
          enabled: false,
          alwaysTranslate: false,
        },
      },
    })

    const state = await startPageTranslation()

    expect(state.phase).toBe("idle")
    expect(state.lastError?.code).toBe("SITE_DISABLED")
    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("applies and removes saved custom CSS during page translation", async () => {
    readConfigMock.mockResolvedValueOnce({
      version: 1,
      targetLang: "zh-CN",
      provider: {
        id: "openai",
        accessToken: "astra-token",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {
        [window.location.hostname]: {
          enabled: true,
          alwaysTranslate: false,
          customCss: "body { outline: 3px solid red; }",
        },
      },
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation()
    await flushPromises()

    const customCssNode = document.getElementById("astra-site-custom-css")
    expect(customCssNode).not.toBeNull()
    expect(customCssNode?.textContent).toBe("body { outline: 3px solid red; }")

    stopPageTranslation()
    expect(document.getElementById("astra-site-custom-css")).toBeNull()
  })

  it("uses the current URL path for site include path rules", async () => {
    window.history.replaceState({}, "", "/article?foo=1#bar")
    readConfigMock.mockResolvedValueOnce({
      version: 1,
      targetLang: "zh-CN",
      provider: {
        id: "openai",
        accessToken: "astra-token",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {
        [window.location.hostname]: {
          enabled: true,
          alwaysTranslate: false,
          includePathPatterns: ["/article"],
        },
      },
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation()
    await flushPromises()

    expect(getPageTranslationState().lastError).toBeNull()
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Visible text"],
    }))
  })

  it("re-translates blocks when source text changes in place", async () => {
    vi.useFakeTimers()
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Visible text"],
    }))

    const visible = document.getElementById("visible")!
    const textNode = Array.from(visible.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    )!
    ;(textNode as Text).data = "Updated visible text"

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["更新的可见文本"],
    })

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Updated visible text"],
    }))

    vi.useRealTimers()
  })

  it("re-translates tracked blocks after childList rewrites inside the block", async () => {
    vi.useFakeTimers()
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const visible = document.getElementById("visible")!
    visible.textContent = "Updated via childList"

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["通过 childList 更新"],
    })

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Updated via childList"],
    }))

    vi.useRealTimers()
  })

  it("ignores stale failures after a source revision change and keeps the session running", async () => {
    vi.useFakeTimers()

    let rejectFirst!: (error: Error) => void
    translateTextsMock
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectFirst = reject
      }))
      .mockResolvedValueOnce({
        ok: true,
        translations: ["更新后的可见文本"],
      })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const visible = document.getElementById("visible")!
    const textNode = Array.from(visible.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    )!
    ;(textNode as Text).data = "Updated visible text"

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    rejectFirst(new Error("stale request failed"))
    await flushPromises()
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      texts: ["Updated visible text"],
    }))
    expect(getPageTranslationState().phase).toBe("running")
    expect(getPageTranslationState().lastError).toBeNull()
    expect(document.querySelector("[data-astra-translation=\"1\"]")?.textContent).toContain("更新后的可见文本")

    vi.useRealTimers()
  })

  it("switches from fallback page scope to a discovered article root during an article session", async () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <main>
        <p id="outside">Intro text outside article.</p>
      </main>
    `
    setRect(document.getElementById("outside")!, 50)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["页面回退文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN", contentScope: "article" })
    await flushPromises()

    const article = document.createElement("article")
    article.innerHTML = `
      <p id="article-1">Article paragraph one with enough text to be considered substantive content.</p>
      <p id="article-2">Article paragraph two adds more body text so the article root can be discovered later.</p>
      <p id="article-3">Article paragraph three completes the minimum block count for article extraction.</p>
    `
    document.body.appendChild(article)

    setRect(document.getElementById("article-1")!, 60)
    setRect(document.getElementById("article-2")!, 90)
    setRect(document.getElementById("article-3")!, 120)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["文章段落一", "文章段落二", "文章段落三"],
    })

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(getPageTranslationState().progress.totalBlocks).toBe(3)
    expect(document.querySelector("#outside [data-astra-translation]")).toBeNull()
    expect(document.querySelector("#article-1 [data-astra-translation]")?.textContent).toContain("文章段落一")

    vi.useRealTimers()
  })

  it("refreshes translation context after structural page changes without regenerating the page summary", async () => {
    vi.useFakeTimers()
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["原标题", "可见文本"],
    })

    document.title = "Original title"
    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    document.title = "Updated title"
    const main = document.querySelector("main")!
    const added = document.createElement("p")
    added.textContent = "Fresh dynamic text"
    added.id = "dynamic-context"
    setRect(added, 85)
    main.appendChild(added)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["新的动态文本"],
    })

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Fresh dynamic text"],
      context: expect.objectContaining({
        pageTitle: "Updated title",
        contentSummary: "Visible text Offscreen text",
      }),
    }))
    const lastRequest = translateTextsMock.mock.calls.at(-1)?.[0]
    expect(lastRequest?.context?.contentSummary).not.toContain("Fresh dynamic text")

    vi.useRealTimers()
  })

  it("observes new text appended inside an already observed open shadow root", async () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <main>
        <p id="visible">Visible text</p>
        <astra-card id="existing-shadow-host"></astra-card>
      </main>
    `
    setRect(document.getElementById("visible")!, 50)
    const host = document.getElementById("existing-shadow-host") as HTMLElement
    const shadow = host.attachShadow({ mode: "open" })

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const added = document.createElement("p")
    added.id = "existing-shadow-text"
    added.textContent = "Fresh observed shadow text"
    setRect(added, 80)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["已有阴影新文本"],
    })

    shadow.appendChild(added)

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Fresh observed shadow text"],
    }))
    expect(added.querySelector('[data-astra-translation="1"]')?.textContent).toContain("已有阴影新文本")

    vi.useRealTimers()
  })

  it("observes dynamically added open shadow hosts for text blocks", async () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <main>
        <p id="visible">Visible text</p>
      </main>
    `
    setRect(document.getElementById("visible")!, 50)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const host = document.createElement("astra-card")
    host.id = "dynamic-shadow-host"
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<p id="dynamic-shadow-text">Fresh shadow text</p>`
    const added = shadow.getElementById("dynamic-shadow-text") as HTMLElement
    setRect(added, 80)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["新的阴影文本"],
    })

    document.querySelector("main")?.appendChild(host)

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      texts: ["Fresh shadow text"],
    }))
    expect(added.querySelector('[data-astra-translation="1"]')?.textContent).toContain("新的阴影文本")

    vi.useRealTimers()
  })

  it("re-translates translation-only blocks when the preserved source subtree changes", async () => {
    vi.useFakeTimers()
    translateTextsMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["仅译文"],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["更新后的仅译文"],
      })

    await startPageTranslation({
      targetLang: "zh-CN",
      translationMode: "translation-only",
    })
    await flushPromises()

    const source = document.querySelector("#visible [data-astra-source]") as HTMLElement
    expect(source).not.toBeNull()
    source.style.display = "none"

    const textNode = Array.from(source.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    )!
    ;(textNode as Text).data = "Updated hidden source"

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      texts: ["Updated hidden source"],
    }))
    expect(getPageTranslationState().phase).toBe("running")
    expect(document.querySelector("#visible [data-astra-translation=\"1\"]")?.textContent)
      .toContain("更新后的仅译文")

    vi.useRealTimers()
  })
})
