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

  it("only scans newly added subtrees during mutation updates", async () => {
    vi.useFakeTimers()
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["可见文本"],
    })

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushPromises()

    const main = document.querySelector("main")!
    const added = document.createElement("div")
    const paragraph = document.createElement("p")
    paragraph.textContent = "Dynamic text"
    added.appendChild(paragraph)
    setRect(paragraph, 80)
    main.appendChild(added)

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["动态文本"],
    })

    await flushPromises()
    vi.advanceTimersByTime(200)
    await flushPromises()

    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      texts: ["Dynamic text"],
      targetLang: "zh-CN",
      context: expect.objectContaining({
        pageUrl: `${window.location.origin}/article`,
      }),
    }))

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

  it("refreshes translation context after structural page changes", async () => {
    vi.useFakeTimers()
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["可见文本"],
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
      }),
    }))

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
