import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  IDLE_TRANSLATION_SNAPSHOT,
  type TranslationSnapshot,
} from "@/types/translation"
import { createMockBrowser, setMockBrowser } from "../../../../test/utils/mockBrowser"

const {
  subscribePageTranslationStateMock,
  retryFailedBlocksMock,
  subscribeLearningStateMock,
  getLearningStateMock,
  toggleCurrentTabTranslationMock,
  readConfigMock,
} = vi.hoisted(() => ({
  subscribePageTranslationStateMock: vi.fn(),
  retryFailedBlocksMock: vi.fn(),
  subscribeLearningStateMock: vi.fn(),
  getLearningStateMock: vi.fn(),
  toggleCurrentTabTranslationMock: vi.fn(),
  readConfigMock: vi.fn(),
}))

vi.mock("../page-translate", () => ({
  subscribePageTranslationState: subscribePageTranslationStateMock,
  retryFailedBlocks: retryFailedBlocksMock,
}))

vi.mock("../learning-state", () => ({
  subscribeLearningState: subscribeLearningStateMock,
  getLearningState: getLearningStateMock,
}))

vi.mock("@/utils/extension/messages", () => ({
  toggleCurrentTabTranslation: toggleCurrentTabTranslationMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { mountFloatBall } from "./FloatBall"

const idleLearningState: {
  savesThisSession: number
  hasSavedThisSession: boolean
  lastSavedSurface: string | null
  lastSavedAt: number | null
  lastDueCount: number | null
} = {
  savesThisSession: 0,
  hasSavedThisSession: false,
  lastSavedSurface: null,
  lastSavedAt: null,
  lastDueCount: null,
}

function snap(overrides: Partial<TranslationSnapshot> = {}): TranslationSnapshot {
  return {
    ...IDLE_TRANSLATION_SNAPSHOT,
    progress: { ...IDLE_TRANSLATION_SNAPSHOT.progress },
    presentation: { ...IDLE_TRANSLATION_SNAPSHOT.presentation },
    site: { ...IDLE_TRANSLATION_SNAPSHOT.site },
    lastError: null,
    ...overrides,
  }
}

function getMountedButton(): HTMLDivElement {
  const host = document.getElementById("astra-float-ball-host") as HTMLDivElement | null
  const button = host?.shadowRoot?.querySelector('div[title]') as HTMLDivElement | null
  if (!button) {
    throw new Error("FloatBall button was not mounted")
  }
  return button
}

function createPointerEvent(type: "pointerdown" | "pointerup", clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientY: { value: clientY },
    pointerId: { value: 1 },
  })
  return event
}

describe("FloatBall", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.getElementById("astra-float-ball-host")?.remove()
    setMockBrowser(createMockBrowser({ astra_float_ball_y: 420 }))

    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({ phase: "idle" }))
      return () => {}
    })
    subscribeLearningStateMock.mockImplementation((listener: (snapshot: typeof idleLearningState) => void) => {
      listener(idleLearningState)
      return () => {}
    })
    getLearningStateMock.mockReturnValue(idleLearningState)
    toggleCurrentTabTranslationMock.mockResolvedValue(undefined)
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    window.history.replaceState({}, "", "/article")

    vi.stubGlobal("PointerEvent", Event)
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    document.getElementById("astra-float-ball-host")?.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("toggles translation on click in default idle mode", async () => {
    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()

    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerdown", 420))
      await Promise.resolve()
    })

    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerup", 420))
      await Promise.resolve()
    })

    expect(toggleCurrentTabTranslationMock).toHaveBeenCalledTimes(1)
  })

  it("opens review instead of toggling when learning state has session saves", async () => {
    let learningListener: ((snapshot: typeof idleLearningState) => void) | null = null
    subscribeLearningStateMock.mockImplementation((listener: (snapshot: typeof idleLearningState) => void) => {
      learningListener = listener
      listener(idleLearningState)
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      learningListener?.({
        savesThisSession: 2,
        hasSavedThisSession: true,
        lastSavedSurface: "selection_toolbar",
        lastSavedAt: Date.now(),
        lastDueCount: 7,
      })
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerdown", 420))
      await Promise.resolve()
    })

    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerup", 420))
      await Promise.resolve()
    })

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
      .__ASTRA_TEST_BROWSER__

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "/vocabulary.html?tab=review",
    })
    expect(toggleCurrentTabTranslationMock).not.toHaveBeenCalled()
    expect(button.title).toContain("7")
    expect(button.textContent).toContain("7")
  })

  it("keeps translation-state tooltip precedence over learning-state cues", async () => {
    let translationListener: ((snapshot: TranslationSnapshot) => void) | null = null
    let learningListener: ((snapshot: typeof idleLearningState) => void) | null = null

    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      translationListener = listener
      listener(snap({ phase: "idle" }))
      return () => {}
    })
    subscribeLearningStateMock.mockImplementation((listener: (snapshot: typeof idleLearningState) => void) => {
      learningListener = listener
      listener(idleLearningState)
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      learningListener?.({
        savesThisSession: 3,
        hasSavedThisSession: true,
        lastSavedSurface: "hover_translate",
        lastSavedAt: Date.now(),
        lastDueCount: 9,
      })
      translationListener?.(snap({
        phase: "running",
        progress: {
          totalBlocks: 10,
          translatedBlocks: 4,
          queuedBlocks: 0,
          inFlightBlocks: 0,
          failedBlocks: 0,
        },
      }))
      await Promise.resolve()
    })

    const button = getMountedButton()
    expect(button.title).toContain("Translated: 4/10")
    expect(button.title).not.toContain("9")
  })

  it("adds a brief learning pulse after a fresh save event", async () => {
    let learningListener: ((snapshot: typeof idleLearningState) => void) | null = null
    subscribeLearningStateMock.mockImplementation((listener: (snapshot: typeof idleLearningState) => void) => {
      learningListener = listener
      listener(idleLearningState)
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      learningListener?.({
        savesThisSession: 1,
        hasSavedThisSession: true,
        lastSavedSurface: "selection_toolbar",
        lastSavedAt: Date.now(),
        lastDueCount: 2,
      })
      await Promise.resolve()
    })

    const button = getMountedButton()
    expect(button.style.animation).toContain("astra-floatball-learning-pulse")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300)
      await Promise.resolve()
    })

    expect(button.style.animation).toBe("")
  })

  it("retries failed blocks when translation reports failures", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: {
          totalBlocks: 5,
          translatedBlocks: 3,
          queuedBlocks: 0,
          inFlightBlocks: 0,
          failedBlocks: 2,
        },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerdown", 420))
      await Promise.resolve()
    })

    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerup", 420))
      await Promise.resolve()
    })

    expect(retryFailedBlocksMock).toHaveBeenCalledTimes(1)
    expect(toggleCurrentTabTranslationMock).not.toHaveBeenCalled()
  })

  it("keeps certification progress display and status hiding behind astraCert", async () => {
    window.history.replaceState({}, "", "/article?astraCert=1&astraCertProgressDone=14&astraCertProgressTotal=38&astraCertHideStatus=1")
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: {
          totalBlocks: 4,
          translatedBlocks: 0,
          queuedBlocks: 4,
          inFlightBlocks: 0,
          failedBlocks: 0,
        },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const host = document.getElementById("astra-float-ball-host") as HTMLDivElement
    const shadow = host.shadowRoot as ShadowRoot
    const progressPill = shadow.querySelector('[data-testid="astra-translation-progress-pill"]') as HTMLDivElement | null

    expect(progressPill?.textContent).toContain("14/38")
    expect(progressPill?.textContent).toContain("Stop")
    expect(shadow.querySelector('div[title]')).toBeNull()
  })

  it("does not leak certification progress overrides into normal mode", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: {
          totalBlocks: 4,
          translatedBlocks: 0,
          queuedBlocks: 4,
          inFlightBlocks: 0,
          failedBlocks: 0,
        },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const host = document.getElementById("astra-float-ball-host") as HTMLDivElement
    const shadow = host.shadowRoot as ShadowRoot
    const progressPill = shadow.querySelector('[data-testid="astra-translation-progress-pill"]') as HTMLDivElement | null

    expect(progressPill?.textContent).toContain("0/4")
    expect(progressPill?.textContent).not.toContain("14/38")
    expect(shadow.querySelector('div[title]')).not.toBeNull()
  })

  it("can hide all page-translation chrome only in certification mode", async () => {
    window.history.replaceState({}, "", "/article?astraCert=1&astraCertHideProgress=1&astraCertHideStatus=1")
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: {
          totalBlocks: 1,
          translatedBlocks: 0,
          queuedBlocks: 0,
          inFlightBlocks: 0,
          failedBlocks: 1,
        },
        lastError: { code: "PROVIDER_REQUEST_FAILED", message: "Failed to fetch" },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const host = document.getElementById("astra-float-ball-host") as HTMLDivElement
    const shadow = host.shadowRoot as ShadowRoot

    expect(shadow.querySelector('[data-testid="astra-translation-progress-pill"]')).toBeNull()
    expect(shadow.querySelector('div[title]')).toBeNull()
  })

  it("applies resolved font scaling to tooltip and progress badge", async () => {
    let translationListener: ((snapshot: TranslationSnapshot) => void) | null = null
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      translationListener = listener
      listener(snap({ phase: "idle" }))
      return () => {}
    })
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        fontSize: 1.3,
      },
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      translationListener?.(snap({
        phase: "running",
        progress: {
          totalBlocks: 10,
          translatedBlocks: 4,
          queuedBlocks: 0,
          inFlightBlocks: 0,
          failedBlocks: 0,
        },
      }))
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const tooltip = button.querySelector("div") as HTMLDivElement | null
    const progressBadge = button.querySelector("span") as HTMLSpanElement | null

    expect(tooltip).toBeTruthy()
    expect(progressBadge).toBeTruthy()
    expect(tooltip?.style.fontSize).toBe("15.6px")
    expect(progressBadge?.style.fontSize).toBe("14.3px")
  })
})
