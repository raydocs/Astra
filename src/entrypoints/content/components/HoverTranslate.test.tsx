import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  translateTextsMock,
  findClosestTextBlockMock,
  findContentRootMock,
  hasInjectedTranslationMock,
  getDocumentTranslationContextMock,
  copyTextToClipboardMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
  findClosestTextBlockMock: vi.fn(),
  findContentRootMock: vi.fn(),
  hasInjectedTranslationMock: vi.fn(),
  getDocumentTranslationContextMock: vi.fn(),
  copyTextToClipboardMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

vi.mock("@/utils/dom/traversal", () => ({
  findClosestTextBlock: findClosestTextBlockMock,
  findContentRoot: findContentRootMock,
}))

vi.mock("@/utils/dom/inject", () => ({
  hasInjectedTranslation: hasInjectedTranslationMock,
}))

vi.mock("@/utils/dom/clipboard", () => ({
  copyTextToClipboard: copyTextToClipboardMock,
}))

vi.mock("../translation-context", () => ({
  getDocumentTranslationContext: getDocumentTranslationContextMock,
}))

import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import { setInteractionSuppressionReason } from "../interaction-coordination"
import { mountHoverTranslate } from "./HoverTranslate"

const HOST_ID = "astra-hover-translate-host"

function createConfig(patch: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...patch,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...patch.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...patch.presentation,
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...patch.sites,
    },
  }
}

function getHost(): HTMLDivElement {
  return document.getElementById(HOST_ID) as HTMLDivElement
}

function getButtons(): HTMLButtonElement[] {
  return Array.from(getHost().shadowRoot?.querySelectorAll("button") ?? []) as HTMLButtonElement[]
}

describe("HoverTranslate", () => {
  const listeners: Partial<Record<string, EventListenerOrEventListenerObject>> = {}

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.getElementById(HOST_ID)?.remove()

    document.body.innerHTML = `<main><p id="target">Hello world</p></main>`
    const target = document.getElementById("target") as HTMLElement
    target.getBoundingClientRect = () => ({
      top: 40,
      left: 16,
      right: 160,
      bottom: 60,
      width: 144,
      height: 20,
      x: 16,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect)

    vi.spyOn(window, "addEventListener").mockImplementation(((type: string | symbol, listener: EventListenerOrEventListenerObject) => {
      listeners[String(type)] = listener
    }) as typeof window.addEventListener)
    vi.spyOn(window, "removeEventListener").mockImplementation((() => {}) as typeof window.removeEventListener)

    readConfigMock.mockResolvedValue(createConfig())
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["你好，世界"] })
    copyTextToClipboardMock.mockResolvedValue(undefined)
    findContentRootMock.mockReturnValue(document.body)
    findClosestTextBlockMock.mockImplementation(() => ({ element: target, text: "Hello world" }))
    hasInjectedTranslationMock.mockReturnValue(false)
    getDocumentTranslationContextMock.mockReturnValue({ pageTitle: "Test page" })

    await act(async () => {
      mountHoverTranslate()
      await Promise.resolve()
    })
  })

  afterEach(() => {
    document.getElementById(HOST_ID)?.remove()
    Object.keys(listeners).forEach((key) => {
      delete listeners[key]
    })
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("translates on Alt + hover when hoverTrigger is alt", async () => {
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    expect(handleMouseMove).toBeTypeOf("function")

    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith({
      texts: ["Hello world"],
      targetLang: "zh-CN",
      context: {
        pageTitle: "Test page",
        selectionContext: "Hello world",
      },
    })
  })

  it("suppresses hover translation when hoverTrigger is disabled", async () => {
    readConfigMock.mockResolvedValue(createConfig({ hoverTrigger: "disabled" }))
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    expect(handleMouseMove).toBeTypeOf("function")

    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(translateTextsMock).not.toHaveBeenCalled()
    expect(getHost().shadowRoot?.textContent ?? "").not.toContain("Alt + Hover")
  })

  it("suppresses hover translation while selection toolbar interaction is active", async () => {
    await act(async () => {
      setInteractionSuppressionReason("selection-toolbar", true)
      await Promise.resolve()
    })

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    expect(handleMouseMove).toBeTypeOf("function")

    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("copies the visible hover translation", async () => {
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const [copyButton] = getButtons()
    expect(copyButton?.textContent).toContain("Copy")

    await act(async () => {
      copyButton.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(copyTextToClipboardMock).toHaveBeenCalledWith("你好，世界")
  })

  it("keeps the hover card interactive when the pointer moves onto it", async () => {
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["你好，世界"] })
      .mockResolvedValueOnce({ ok: true, translations: ["这是问候语的解释"] })

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const hoverEvent = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(hoverEvent, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(hoverEvent)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const host = getHost()
    const moveOntoCard = new MouseEvent("mousemove")
    Object.defineProperty(moveOntoCard, "target", { value: host })
    Object.defineProperty(moveOntoCard, "composedPath", {
      value: () => [host],
    })

    await act(async () => {
      handleMouseMove?.(moveOntoCard)
      await Promise.resolve()
    })

    expect(host.shadowRoot?.textContent ?? "").toContain("你好，世界")

    const explainButton = getButtons().find((button) => button.textContent?.includes("Explain"))
    expect(explainButton).toBeDefined()

    await act(async () => {
      explainButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(host.shadowRoot?.textContent ?? "").toContain("这是问候语的解释")
  })

  it("requests and toggles hover explanations", async () => {
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["你好，世界"] })
      .mockResolvedValueOnce({ ok: true, translations: ["这是问候语的解释"] })

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    let buttons = getButtons()
    const explainButton = buttons.find((button) => button.textContent?.includes("Explain"))
    expect(explainButton).toBeDefined()

    await act(async () => {
      explainButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenNthCalledWith(2, {
      task: "explain",
      texts: ["Hello world"],
      targetLang: "zh-CN",
      context: {
        pageTitle: "Test page",
        selectionContext: "Hello world",
      },
    })
    expect(getHost().shadowRoot?.textContent ?? "").toContain("这是问候语的解释")

    const copyButton = getButtons().find((button) => button.textContent?.includes("Copy"))
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })
    expect(copyTextToClipboardMock).toHaveBeenLastCalledWith("你好，世界")

    buttons = getButtons()
    const hideButton = buttons.find((button) => button.textContent?.includes("Hide explanation"))
    expect(hideButton).toBeDefined()

    await act(async () => {
      hideButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(getHost().shadowRoot?.textContent ?? "").not.toContain("这是问候语的解释")
  })
})
