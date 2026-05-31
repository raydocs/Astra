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
  drainAllBlocksMock,
  stopPageTranslationMock,
  translatePageElementsMock,
  subscribeLearningStateMock,
  getLearningStateMock,
  toggleCurrentTabTranslationMock,
  readConfigMock,
  saveConfigMock,
  readAstraSessionMock,
  ensureAstraDeviceIdentityMock,
  submitAstraSupportReportMock,
  recordLearningLoopEventMock,
} = vi.hoisted(() => ({
  subscribePageTranslationStateMock: vi.fn(),
  retryFailedBlocksMock: vi.fn(),
  drainAllBlocksMock: vi.fn(),
  stopPageTranslationMock: vi.fn(),
  translatePageElementsMock: vi.fn(),
  subscribeLearningStateMock: vi.fn(),
  getLearningStateMock: vi.fn(),
  toggleCurrentTabTranslationMock: vi.fn(),
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  ensureAstraDeviceIdentityMock: vi.fn(),
  submitAstraSupportReportMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
}))

vi.mock("../page-translate", () => ({
  subscribePageTranslationState: subscribePageTranslationStateMock,
  retryFailedBlocks: retryFailedBlocksMock,
  drainAllBlocks: drainAllBlocksMock,
  stopPageTranslation: stopPageTranslationMock,
  translatePageElements: translatePageElementsMock,
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
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  readAstraSession: readAstraSessionMock,
  ensureAstraDeviceIdentity: ensureAstraDeviceIdentityMock,
}))

vi.mock("@/utils/astra/support", () => ({
  submitAstraSupportReport: submitAstraSupportReportMock,
}))

vi.mock("@/utils/learning-loop-events", () => ({
  recordLearningLoopEvent: recordLearningLoopEventMock,
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

function createPointerEvent(type: "pointerdown" | "pointermove" | "pointerup", clientY: number, clientX = 900): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
  })
  return event
}

type JsdomGlobal = {
  jsdom?: {
    reconfigure: (options: { url: string }) => void
  }
}

function reconfigureTestUrl(url: string): void {
  const jsdom = (globalThis as JsdomGlobal).jsdom
  if (!jsdom) {
    throw new Error("FloatBall URL test requires Vitest jsdom reconfigure support")
  }
  jsdom.reconfigure({ url })
}

describe("FloatBall", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.getElementById("astra-float-ball-host")?.remove()
    document.querySelectorAll("iframe").forEach((frame) => frame.remove())
    // Advanced FloatBall actions are hidden by default in the beta; enable them
    // here so the existing behavior tests below exercise the full action surface.
    // A dedicated test asserts the default-hidden (3-core-action) behavior.
    setMockBrowser(createMockBrowser({ astra_float_ball_y: 420, astra_float_ball_advanced: true }))

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
    translatePageElementsMock.mockResolvedValue({ ok: true, translatedBlocks: 1, failedBlocks: 0 })
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    saveConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    readAstraSessionMock.mockResolvedValue(null)
    ensureAstraDeviceIdentityMock.mockResolvedValue({
      version: 1,
      deviceId: "device-123",
      label: "Chrome on macOS",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "extension",
      appVersion: "0.1.0",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    })
    submitAstraSupportReportMock.mockResolvedValue({
      report: {
        reportId: "rpt_floatball_remote_0001",
        status: "submitted",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
        submittedAt: "2026-05-27T00:00:00.000Z",
        issueCategory: "page_not_working",
        defaultContentIncluded: false,
        knownIssue: null,
      },
    })
    window.history.replaceState({}, "", "/article")

    vi.stubGlobal("PointerEvent", Event)
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    document.getElementById("astra-float-ball-host")?.remove()
    document.querySelectorAll("iframe").forEach((frame) => frame.remove())
    ;(globalThis as JsdomGlobal).jsdom?.reconfigure({ url: "http://localhost/" })
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

  it("shows done status when all tracked blocks are translated", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: {
          totalBlocks: 2,
          translatedBlocks: 2,
          queuedBlocks: 0,
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

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    expect(button.textContent).toContain("Astra · Done")
    expect(button.textContent).not.toContain("2/2")
  })

  it("offers Translate the rest when the visible part is done but blocks remain deferred", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: { totalBlocks: 40, translatedBlocks: 8, queuedBlocks: 0, inFlightBlocks: 0, failedBlocks: 0 },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const host = document.getElementById("astra-float-ball-host") as HTMLDivElement
    const pill = host.shadowRoot?.querySelector('[data-testid="astra-translation-progress-pill"]') as HTMLElement | null
    expect(pill).toBeTruthy()
    expect(pill?.textContent).toContain("Visible part done")
    const translateRest = pill?.querySelector('[data-testid="astra-translate-rest"]') as HTMLButtonElement | null
    expect(translateRest).toBeTruthy()
    expect(pill?.textContent).not.toContain("Stop")

    await act(async () => {
      translateRest?.click()
      await Promise.resolve()
    })
    expect(drainAllBlocksMock).toHaveBeenCalledTimes(1)
  })

  it("keeps Stop (not Translate the rest) while blocks are still in flight", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: { totalBlocks: 40, translatedBlocks: 8, queuedBlocks: 4, inFlightBlocks: 2, failedBlocks: 0 },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const host = document.getElementById("astra-float-ball-host") as HTMLDivElement
    const pill = host.shadowRoot?.querySelector('[data-testid="astra-translation-progress-pill"]') as HTMLElement | null
    expect(pill?.querySelector('[data-testid="astra-translate-rest"]')).toBeNull()
    expect(pill?.textContent).toContain("Stop")
  })

  it("surfaces a protected embedded-frame boundary while translation is active", async () => {
    const iframe = document.createElement("iframe")
    iframe.src = "https://third-party.example/embed"
    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      get() {
        throw new DOMException("Blocked a frame with origin", "SecurityError")
      },
    })
    document.body.appendChild(iframe)

    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "running",
        progress: {
          totalBlocks: 2,
          translatedBlocks: 2,
          queuedBlocks: 0,
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

    const button = getMountedButton()
    expect(button.querySelector('[data-testid="astra-floatball-frame-boundary"]')?.textContent).toContain("Protected frame skipped")
    expect(button.querySelector('[data-testid="astra-floatball-frame-boundary"]')?.getAttribute("title")).toContain("1 protected embedded frame skipped")
    expect(button.querySelector('[data-testid="astra-floatball-frame-boundary-detail"]')?.textContent).toContain("skipped 1 protected embedded frame")
  })

  it("does not warn for hidden third-party iframes", async () => {
    const iframe = document.createElement("iframe")
    iframe.src = "https://tracker.example/pixel"
    iframe.style.display = "none"
    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      get() {
        throw new DOMException("Blocked a frame with origin", "SecurityError")
      },
    })
    document.body.appendChild(iframe)

    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({ phase: "running" }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    expect(button.querySelector('[data-testid="astra-floatball-frame-boundary"]')).toBeNull()
  })

  it("shows hidden-here status when site translation is disabled", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "idle",
        site: { hostname: "localhost", enabled: false, alwaysTranslate: false },
        lastError: { code: "SITE_DISABLED", message: "Astra is hidden on this site." },
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
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    expect(button.textContent).toContain("Astra · Hidden here")
    expect(button.title).toContain("hidden on this site")
  })

  it("shows membership-safe error copy instead of raw transport diagnostics", async () => {
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "idle",
        lastError: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
      }))
      return () => {}
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    expect(button.title).toContain("Your membership is active. Astra is reconnecting.")
    expect(button.title).not.toContain("Relay unavailable")
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

  it("shows V2 status copy and lets failed translations use simpler mode", async () => {
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
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "best_quality",
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    expect(button.textContent).toContain("Astra · Retry")

    const simplerModeButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Use simpler mode") as HTMLButtonElement | undefined
    expect(simplerModeButton).toBeTruthy()

    await act(async () => {
      simplerModeButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith({ serviceMode: "fast" })
    expect(retryFailedBlocksMock).toHaveBeenCalledWith({ serviceMode: "fast" })
    expect(button.textContent).toContain("Fast")
  })

  it("submits a metadata-only page report from the failure quick action when signed in", async () => {
    submitAstraSupportReportMock.mockResolvedValueOnce({
      report: {
        reportId: "rpt_floatball_remote_0001",
        status: "submitted",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
        submittedAt: "2026-05-27T00:00:00.000Z",
        issueCategory: "page_not_working",
        defaultContentIncluded: false,
        knownIssue: {
          issueId: "issue_floatball_page",
          status: "monitoring",
          featureSurface: "page",
          issueCategory: "page_not_working",
          affectedVersions: [],
          firstSeenAt: "2026-05-27T00:00:00.000Z",
          updatedAt: "2026-05-27T00:00:00.000Z",
        },
      },
    })
    window.history.replaceState({}, "", "/article?with=path")
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "session-123",
      deviceId: "device-123",
      identityMode: "authenticated",
      relayBaseURL: "https://astra.example/v1",
      email: "demo@astra.local",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["google_translate", "openai", "gemini"],
      quota: {},
      usage: {},
      issuedAt: null,
      expiresAt: null,
    })
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "idle",
        lastError: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
      }))
      return () => {}
    })
    const createObjectURLMock = vi.fn(() => "blob:should-not-download")
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    const reportButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Report this page") as HTMLButtonElement | undefined
    expect(reportButton).toBeTruthy()

    await act(async () => {
      reportButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(submitAstraSupportReportMock).toHaveBeenCalledTimes(1)
    expect(submitAstraSupportReportMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      bundle: expect.objectContaining({
        schema: "astra-support-bundle.v1",
        userConsent: true,
        featureSurface: "page",
        action: "report_this_page",
        issueCategory: "page_not_working",
        runtimeSurface: "content_floatball",
        hostname: "localhost",
        privacyMode: DEFAULT_ASTRA_CONFIG.privacyMode,
        membershipState: "pro",
        userMessageIncluded: false,
        contactIncluded: false,
        contentIncluded: { enabled: false, type: "none" },
      }),
    }))
    const submittedBundle = submitAstraSupportReportMock.mock.calls[0]?.[0]?.bundle
    expect(JSON.stringify(submittedBundle)).not.toContain("/article")
    expect(JSON.stringify(submittedBundle)).not.toContain("with=path")
    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("support_report_submitted", expect.objectContaining({
      source: "content_floatball",
      reportId: "rpt_floatball_remote_0001",
      issueCategory: "page_not_working",
      featureSurface: "page",
      knownIssueMatched: true,
    }))
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("known_issue_viewed", {
      source: "content_floatball",
      issueId: "issue_floatball_page",
      status: "monitoring",
      surface: "page",
    })
    expect(button.querySelector('[data-testid="astra-floatball-report-status"]')?.textContent).toContain("Metadata report submitted")
    expect(button.querySelector('[data-testid="astra-floatball-report-status"]')?.textContent).not.toContain("rpt_floatball_remote_0001")
  })

  it("downloads a metadata-only page report from the failure quick action when unsigned", async () => {
    window.history.replaceState({}, "", "/article?with=path")
    readAstraSessionMock.mockResolvedValue(null)
    subscribePageTranslationStateMock.mockImplementation((listener: (snapshot: TranslationSnapshot) => void) => {
      listener(snap({
        phase: "idle",
        lastError: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
      }))
      return () => {}
    })
    let clickedDownloadAnchor: HTMLAnchorElement | null = null
    const NativeBlob = globalThis.Blob
    let lastDownloadBlobParts: BlobPart[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloadAnchor = this
    })
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      value: class TestDownloadBlob extends NativeBlob {
        constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
          lastDownloadBlobParts = [...(blobParts ?? [])]
          super(blobParts, options)
        }
      },
    })
    const createObjectURLMock = vi.fn(() => "blob:astra-floatball-report")
    const revokeObjectURLMock = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    const reportButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Report this page") as HTMLButtonElement | undefined
    expect(reportButton).toBeTruthy()

    await act(async () => {
      reportButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(submitAstraSupportReportMock).not.toHaveBeenCalled()
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:astra-floatball-report")
    const payload = JSON.parse(String(lastDownloadBlobParts[0] ?? ""))
    expect(payload).toEqual(expect.objectContaining({
      schema: "astra-support-bundle.v1",
      userConsent: true,
      featureSurface: "page",
      action: "report_this_page",
      issueCategory: "page_not_working",
      runtimeSurface: "content_floatball",
      hostname: "localhost",
      contentIncluded: { enabled: false, type: "none" },
    }))
    expect(JSON.stringify(payload)).not.toContain("/article")
    expect(JSON.stringify(payload)).not.toContain("with=path")
    expect((clickedDownloadAnchor as HTMLAnchorElement | null)?.download).toMatch(/^astra-page-report-.*\.json$/)
    expect(button.querySelector('[data-testid="astra-floatball-report-status"]')?.textContent).toContain("Downloaded metadata-only report JSON")
    expect(button.querySelector('[data-testid="astra-floatball-report-status"]')?.textContent).not.toContain("Issue: page_not_working")
  })

  it("does not let quick-action pointerdown start FloatBall drag capture", async () => {
    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const deepReadButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Deep Read") as HTMLButtonElement | undefined
    expect(deepReadButton).toBeTruthy()

    await act(async () => {
      deepReadButton?.dispatchEvent(createPointerEvent("pointerdown", 420))
      deepReadButton?.click()
      await Promise.resolve()
    })

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
      .__ASTRA_TEST_BROWSER__

    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled()
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "/deep-read.html" })
    expect(toggleCurrentTabTranslationMock).not.toHaveBeenCalled()
  })

  it("translates the first readable block for section actions without a recent pointer target", async () => {
    const article = document.createElement("article")
    const paragraph = document.createElement("p")
    paragraph.textContent = "This is a long readable paragraph that should be targeted when keyboard users open the FloatBall menu without moving the pointer first."
    article.appendChild(paragraph)
    document.body.appendChild(article)

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.focus()
      await Promise.resolve()
    })

    const paragraphAction = Array.from(button.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find((action) => action.textContent === "This paragraph")
    expect(paragraphAction).toBeTruthy()

    await act(async () => {
      paragraphAction?.click()
      await Promise.resolve()
    })

    expect(translatePageElementsMock).toHaveBeenCalledWith([paragraph])
  })

  it("exposes quick actions as a keyboard menu and roves focus with arrow keys", async () => {
    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.focus()
      await Promise.resolve()
    })

    expect(button.getAttribute("aria-haspopup")).toBe("menu")
    expect(button.getAttribute("aria-expanded")).toBe("true")
    const menu = button.querySelector('[role="menu"][aria-label="Astra quick actions"]') as HTMLDivElement | null
    expect(menu).toBeTruthy()
    const menuItems = Array.from(menu!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(menuItems.map((item) => item.textContent)).toContain("Lock position")

    menuItems[0]?.focus()
    await act(async () => {
      menu!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect((button.getRootNode() as ShadowRoot).activeElement).toBe(menuItems[1])
  })

  it("aligns the quick-action menu to the left when FloatBall is snapped left", async () => {
    setMockBrowser(createMockBrowser({
      astra_float_ball_y: 420,
      astra_float_ball_side: "left",
    }))

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.focus()
      await Promise.resolve()
      await Promise.resolve()
    })

    const menu = button.querySelector('[role="menu"][aria-label="Astra quick actions"]') as HTMLDivElement | null
    expect(menu).toBeTruthy()
    expect(menu?.style.left).toBe("0px")
    expect(menu?.style.right).toBe("")
  })

  it("lets users lock and unlock FloatBall position to prevent accidental dragging", async () => {
    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const lockButton = Array.from(button.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find((action) => action.textContent === "Lock position")
    expect(lockButton).toBeTruthy()

    await act(async () => {
      lockButton?.click()
      await Promise.resolve()
    })

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
      .__ASTRA_TEST_BROWSER__

    expect(browser.storage.local.set).toHaveBeenCalledWith({ astra_float_ball_locked: true })
    expect(lockButton?.textContent).toBe("Unlock position")

    vi.mocked(HTMLElement.prototype.setPointerCapture).mockClear()
    await act(async () => {
      button.dispatchEvent(createPointerEvent("pointerdown", 420))
      button.dispatchEvent(createPointerEvent("pointermove", 520))
      button.dispatchEvent(createPointerEvent("pointerup", 520))
      await Promise.resolve()
    })

    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled()
    expect(browser.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({ astra_float_ball_y: expect.any(Number) }))

    await act(async () => {
      lockButton?.click()
      await Promise.resolve()
    })

    expect(browser.storage.local.set).toHaveBeenCalledWith({ astra_float_ball_locked: false })
    expect(lockButton?.textContent).toBe("Lock position")
  })

  it("toggles FloatBall page surface mode between immersive and full page", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "immersive",
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const surfaceModeButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Immersive") as HTMLButtonElement | undefined
    expect(surfaceModeButton).toBeTruthy()

    await act(async () => {
      surfaceModeButton?.click()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenLastCalledWith({ contentScope: "full_page" })
    expect(surfaceModeButton?.textContent).toBe("Full page")

    await act(async () => {
      surfaceModeButton?.click()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenLastCalledWith({ contentScope: "immersive" })
    expect(surfaceModeButton?.textContent).toBe("Immersive")
  })

  it("cycles FloatBall service style through balanced before best quality", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "automatic",
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const serviceModeButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Auto") as HTMLButtonElement | undefined
    expect(serviceModeButton).toBeTruthy()

    await act(async () => {
      serviceModeButton?.click()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenLastCalledWith({ serviceMode: "fast" })
    expect(serviceModeButton?.textContent).toBe("Faster")

    await act(async () => {
      serviceModeButton?.click()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenLastCalledWith({ serviceMode: "balanced" })
    expect(serviceModeButton?.textContent).toBe("Balanced")
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

    expect(progressPill?.textContent).toContain("Translating the visible part first. Keep reading.")
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

  it("applies resolved font scaling to quick actions and progress badge", async () => {
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

    const quickActions = button.querySelector('[aria-label="Astra quick actions"]') as HTMLDivElement | null
    const progressBadge = button.querySelector("span") as HTMLSpanElement | null

    expect(quickActions).toBeTruthy()
    expect(progressBadge).toBeTruthy()
    expect(quickActions?.style.minWidth).toBe("273px")
    expect(progressBadge?.style.fontSize).toBe("14.3px")
  })

  it("offers video-note creation from quick actions on supported video pages", async () => {
    reconfigureTestUrl("https://www.youtube.com/watch?v=demo123")

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const videoNoteButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Create video note") as HTMLButtonElement | undefined
    expect(videoNoteButton).toBeTruthy()

    await act(async () => {
      videoNoteButton?.click()
      await Promise.resolve()
    })

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
      .__ASTRA_TEST_BROWSER__

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/video-note:create-from-current-tab",
    })
    expect(toggleCurrentTabTranslationMock).not.toHaveBeenCalled()
  })

  it("translates only the nearby paragraph from quick actions", async () => {
    document.body.innerHTML = `
      <main>
        <p id="nearby-paragraph">Nearby paragraph text</p>
        <p id="other-paragraph">Other paragraph text</p>
      </main>
    `

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const nearbyParagraph = document.getElementById("nearby-paragraph") as HTMLParagraphElement
    await act(async () => {
      nearbyParagraph.dispatchEvent(new Event("pointermove", { bubbles: true }))
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const paragraphButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "This paragraph") as HTMLButtonElement | undefined
    expect(paragraphButton).toBeTruthy()

    await act(async () => {
      paragraphButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translatePageElementsMock).toHaveBeenCalledTimes(1)
    expect(translatePageElementsMock).toHaveBeenCalledWith([nearbyParagraph])
    expect(toggleCurrentTabTranslationMock).not.toHaveBeenCalled()
  })

  it("lets users turn on auto-translate for the current site from the page", async () => {
    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const autoSiteButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Auto on site") as HTMLButtonElement | undefined
    expect(autoSiteButton).toBeTruthy()

    await act(async () => {
      autoSiteButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith({
      sites: {
        localhost: {
          enabled: true,
          alwaysTranslate: true,
        },
      },
    })
    expect(button.textContent).toContain("Done")
    expect(toggleCurrentTabTranslationMock).not.toHaveBeenCalled()
  })

  it("lets users hide Astra on the current site from the page", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        localhost: {
          enabled: true,
          alwaysTranslate: true,
          targetLang: "ja",
        },
      },
    })

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const hideSiteButton = Array.from(button.querySelectorAll("button"))
      .find((action) => action.textContent === "Hide here") as HTMLButtonElement | undefined
    expect(hideSiteButton).toBeTruthy()

    await act(async () => {
      hideSiteButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith({
      sites: {
        localhost: {
          enabled: false,
          alwaysTranslate: false,
          targetLang: "ja",
        },
      },
    })
    expect(button.textContent).toContain("Astra · Hidden here")
  })

  it("hides advanced actions by default, showing only the core three", async () => {
    // No advanced flag in storage -> zero-config default surface.
    setMockBrowser(createMockBrowser({ astra_float_ball_y: 420 }))

    await act(async () => {
      mountFloatBall()
      await Promise.resolve()
      await Promise.resolve()
    })

    const button = getMountedButton()
    await act(async () => {
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
      await Promise.resolve()
    })

    const labels = Array.from(button.querySelectorAll('button[role="menuitem"]')).map((action) => action.textContent?.trim())

    // Core actions remain reachable.
    expect(labels).toContain("Stop")
    expect(labels).toContain("Bilingual")
    expect(labels.some((label) => label === "Review" || label === "Settings")).toBe(true)

    // Advanced/secondary actions are hidden on the default path.
    for (const hidden of ["This paragraph", "This section", "Deep Read", "Full page", "Immersive", "Lock position", "Auto on site", "Hide here"]) {
      expect(labels).not.toContain(hidden)
    }
  })
})
