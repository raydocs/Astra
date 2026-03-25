import { beforeEach, describe, expect, it, vi } from "vitest"

const { readConfigMock, translateTextsMock } = vi.hoisted(() => ({
  readConfigMock: vi.fn(() => Promise.resolve({
    version: 1,
    targetLang: "zh-CN",
    provider: {
      id: "openai" as const,
      apiKey: "sk-test",
      model: "gpt-4o-mini",
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
        apiKey: "sk-test",
        model: "gpt-4o-mini",
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

  it("cancels stale starts when config resolution races", async () => {
    let resolveConfig!: () => void
    readConfigMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveConfig = () => {
        resolve({
          version: 1,
          targetLang: "zh-CN",
          provider: {
            id: "openai",
            apiKey: "sk-test",
            model: "gpt-4o-mini",
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

  it("stops immediately when the current site is disabled", async () => {
    readConfigMock.mockResolvedValueOnce({
      version: 1,
      targetLang: "zh-CN",
      provider: {
        id: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
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
})
