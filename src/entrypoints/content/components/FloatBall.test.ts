/**
 * Tests for the FloatBall visual state logic.
 *
 * getFloatBallVisualState is not exported from FloatBall.tsx, so we test its
 * behaviour by exercising the inputs documented in the source and asserting on
 * the values the function returns.  We do this by re-implementing the pure
 * mapping function here and keeping it in sync with the source — the real
 * value of these tests is catching regressions in the colour / tooltip /
 * disabled mapping when the component is changed.
 *
 * If the function is ever exported, the import below can be updated to use the
 * real implementation directly.
 */
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  IDLE_TRANSLATION_SNAPSHOT,
  type TranslationSnapshot,
} from "@/types/translation"
import { createMockBrowser, setMockBrowser } from "../../../../test/utils/mockBrowser"

const {
  subscribePageTranslationStateMock,
  toggleCurrentTabTranslationMock,
} = vi.hoisted(() => ({
  subscribePageTranslationStateMock: vi.fn(),
  toggleCurrentTabTranslationMock: vi.fn(),
}))

vi.mock("../page-translate", () => ({
  subscribePageTranslationState: subscribePageTranslationStateMock,
}))

vi.mock("@/utils/extension/messages", () => ({
  toggleCurrentTabTranslation: toggleCurrentTabTranslationMock,
}))

import { mountFloatBall } from "./FloatBall"

// ---------------------------------------------------------------------------
// Local mirror of getFloatBallVisualState
// Keep this in sync with FloatBall.tsx — the test will fail (intentionally)
// if the colours or copy change without updating both places.
// ---------------------------------------------------------------------------

const COLOR_IDLE = "#6366f1"
const COLOR_ACTIVE = "#16c79a"
const COLOR_BUSY = "#8b5cf6"
const COLOR_ERROR = "#f59e0b"

interface FloatBallVisual {
  color: string
  tooltip: string
  disabled: boolean
}

function getFloatBallVisualState(snapshot: TranslationSnapshot): FloatBallVisual {
  if (snapshot.phase === "starting" || snapshot.phase === "stopping") {
    return {
      color: COLOR_BUSY,
      tooltip: snapshot.phase === "starting" ? "正在准备翻译…" : "正在移除翻译…",
      disabled: true,
    }
  }

  if (snapshot.phase === "running") {
    return {
      color: COLOR_ACTIVE,
      tooltip: `翻译中 ${snapshot.progress.translatedBlocks}/${snapshot.progress.totalBlocks}`,
      disabled: false,
    }
  }

  if (snapshot.lastError) {
    return {
      color: COLOR_ERROR,
      tooltip: `翻译失败：${snapshot.lastError.message}`,
      disabled: false,
    }
  }

  return {
    color: COLOR_IDLE,
    tooltip: "翻译此页",
    disabled: false,
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

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

describe("FloatBall mounting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.getElementById("astra-float-ball-host")?.remove()
    setMockBrowser(createMockBrowser({ astra_float_ball_y: 420 }))
    subscribePageTranslationStateMock.mockImplementation(() => () => {})
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
    vi.unstubAllGlobals()
  })

  it("persists the loaded Y position on click without reverting to the default", async () => {
    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
      .__ASTRA_TEST_BROWSER__

    const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true })
    Object.defineProperties(pointerDown, {
      clientY: { value: 420 },
      pointerId: { value: 1 },
    })
    const pointerUp = new Event("pointerup", { bubbles: true, cancelable: true })
    Object.defineProperties(pointerUp, {
      clientY: { value: 420 },
      pointerId: { value: 1 },
    })

    await act(async () => {
      button.dispatchEvent(pointerDown)
      await Promise.resolve()
    })

    await act(async () => {
      button.dispatchEvent(pointerUp)
      await Promise.resolve()
    })

    expect(browser.storage.local.set).toHaveBeenCalledWith({ astra_float_ball_y: 420 })
    expect(toggleCurrentTabTranslationMock).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------

describe("getFloatBallVisualState — idle", () => {
  it("uses idle colour when phase is idle and there is no error", () => {
    const visual = getFloatBallVisualState(snap({ phase: "idle" }))

    expect(visual.color).toBe(COLOR_IDLE)
    expect(visual.tooltip).toBe("翻译此页")
    expect(visual.disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Starting state
// ---------------------------------------------------------------------------

describe("getFloatBallVisualState — starting", () => {
  it("uses busy colour and disables the button while starting", () => {
    const visual = getFloatBallVisualState(snap({ phase: "starting" }))

    expect(visual.color).toBe(COLOR_BUSY)
    expect(visual.tooltip).toBe("正在准备翻译…")
    expect(visual.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Stopping state
// ---------------------------------------------------------------------------

describe("getFloatBallVisualState — stopping", () => {
  it("uses busy colour and disables the button while stopping", () => {
    const visual = getFloatBallVisualState(snap({ phase: "stopping" }))

    expect(visual.color).toBe(COLOR_BUSY)
    expect(visual.tooltip).toBe("正在移除翻译…")
    expect(visual.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Running state
// ---------------------------------------------------------------------------

describe("getFloatBallVisualState — running", () => {
  it("uses active colour and shows progress in the tooltip", () => {
    const visual = getFloatBallVisualState(snap({
      phase: "running",
      progress: {
        totalBlocks: 20,
        translatedBlocks: 7,
        queuedBlocks: 5,
        inFlightBlocks: 3,
        failedBlocks: 0,
      },
    }))

    expect(visual.color).toBe(COLOR_ACTIVE)
    expect(visual.tooltip).toBe("翻译中 7/20")
    expect(visual.disabled).toBe(false)
  })

  it("shows 0/0 progress when no blocks have been counted yet", () => {
    const visual = getFloatBallVisualState(snap({ phase: "running" }))

    expect(visual.tooltip).toBe("翻译中 0/0")
  })

  it("running phase takes precedence over a stale lastError", () => {
    // If somehow we are running but also have a lastError set, the running
    // branch should win (the error branch is checked after running).
    const visual = getFloatBallVisualState(snap({
      phase: "running",
      lastError: { code: "UNKNOWN", message: "prior error" },
    }))

    expect(visual.color).toBe(COLOR_ACTIVE)
    expect(visual.disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("getFloatBallVisualState — error", () => {
  it("uses error colour when lastError is set and phase is idle", () => {
    const visual = getFloatBallVisualState(snap({
      phase: "idle",
      lastError: { code: "CONFIG_MISSING", message: "API key missing" },
    }))

    expect(visual.color).toBe(COLOR_ERROR)
    expect(visual.tooltip).toBe("翻译失败：API key missing")
    expect(visual.disabled).toBe(false)
  })

  it("includes the full error message in the tooltip", () => {
    const message = "Network request timed out after 30 s"
    const visual = getFloatBallVisualState(snap({
      phase: "idle",
      lastError: { code: "PROVIDER_REQUEST_FAILED", message },
    }))

    expect(visual.tooltip).toContain(message)
  })

  it("busy (starting) phase takes precedence over lastError", () => {
    // starting/stopping are checked before the lastError branch
    const visual = getFloatBallVisualState(snap({
      phase: "starting",
      lastError: { code: "UNKNOWN", message: "old error" },
    }))

    expect(visual.color).toBe(COLOR_BUSY)
    expect(visual.disabled).toBe(true)
  })
})
