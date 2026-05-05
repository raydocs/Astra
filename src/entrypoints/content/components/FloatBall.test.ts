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
} = vi.hoisted(() => ({
  subscribePageTranslationStateMock: vi.fn(),
  retryFailedBlocksMock: vi.fn(),
  subscribeLearningStateMock: vi.fn(),
  getLearningStateMock: vi.fn(),
  toggleCurrentTabTranslationMock: vi.fn(),
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

import type { LearningStateSnapshot } from "../learning-state"
import { mountFloatBall } from "./FloatBall"

const idleLearningState: LearningStateSnapshot = {
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
})
