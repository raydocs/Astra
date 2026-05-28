import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  translateTextsMock,
  translateExplanationWithQualityRetryMock,
  findClosestTextBlockMock,
  findContentRootMock,
  hasInjectedTranslationMock,
  getDocumentTranslationContextMock,
  buildInlineTranslationContextMock,
  copyTextToClipboardMock,
  saveVocabularyEntryMock,
  getDueVocabularyCountMock,
  hasVocabularyEntryByTextMock,
  markSessionSaveMock,
  readAstraSessionMock,
  ensureAstraDeviceIdentityMock,
  submitAstraSupportReportMock,
  recordLearningLoopEventMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
  translateExplanationWithQualityRetryMock: vi.fn(),
  findClosestTextBlockMock: vi.fn(),
  findContentRootMock: vi.fn(),
  hasInjectedTranslationMock: vi.fn(),
  getDocumentTranslationContextMock: vi.fn(),
  buildInlineTranslationContextMock: vi.fn(),
  copyTextToClipboardMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  hasVocabularyEntryByTextMock: vi.fn(),
  markSessionSaveMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  ensureAstraDeviceIdentityMock: vi.fn(),
  submitAstraSupportReportMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
  translateExplanationWithQualityRetry: translateExplanationWithQualityRetryMock,
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

vi.mock("@/utils/storage/vocabulary", () => ({
  saveVocabularyEntry: saveVocabularyEntryMock,
  getDueVocabularyCount: getDueVocabularyCountMock,
  hasVocabularyEntryByText: hasVocabularyEntryByTextMock,
}))

vi.mock("../learning-state", () => ({
  markSessionSave: markSessionSaveMock,
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

vi.mock("../translation-context", () => ({
  getDocumentTranslationContext: getDocumentTranslationContextMock,
  buildInlineTranslationContext: buildInlineTranslationContextMock,
}))

import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import { t } from "@/utils/i18n"
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
    translateExplanationWithQualityRetryMock.mockResolvedValue({ ok: true, text: "这是问候语的解释" })
    copyTextToClipboardMock.mockResolvedValue(undefined)
    saveVocabularyEntryMock.mockResolvedValue(undefined)
    getDueVocabularyCountMock.mockResolvedValue(0)
    hasVocabularyEntryByTextMock.mockResolvedValue(false)
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
        reportId: "rpt_hover_remote_0001",
        status: "submitted",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
        submittedAt: "2026-05-27T00:00:00.000Z",
        issueCategory: "translation_quality",
        defaultContentIncluded: false,
        knownIssue: null,
      },
    })
    findContentRootMock.mockReturnValue(document.body)
    findClosestTextBlockMock.mockImplementation(() => ({ element: target, text: "Hello world" }))
    hasInjectedTranslationMock.mockReturnValue(false)
    getDocumentTranslationContextMock.mockReturnValue({ pageTitle: "Test page" })
    buildInlineTranslationContextMock.mockImplementation(
      ({ selectionContext }: { selectionContext?: string } = {}) => ({
        pageTitle: "Test page",
        ...(selectionContext ? { selectionContext } : {}),
      }),
    )

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
      serviceMode: "automatic",
      context: {
        pageTitle: "Test page",
        selectionContext: "Hello world",
      },
    })

    const identityStrip = getHost().shadowRoot?.querySelector("[data-testid='astra-identity-strip']") as HTMLDivElement | null
    expect(identityStrip?.textContent).toContain("Astra")
    const targetLangPill = getHost().shadowRoot?.querySelector("[data-testid='astra-identity-strip-target-lang']") as HTMLSpanElement | null
    expect(targetLangPill?.textContent).toBe("中文")
    expect(getHost().shadowRoot?.textContent ?? "").not.toContain(t("label_altHover"))
    expect(getHost().shadowRoot?.textContent ?? "").not.toContain(t("label_hover"))
  })

  it("applies resolved font scale to hover card and identity strip", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        fontSize: 1.3,
      },
    }))

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const identityStrip = getHost().shadowRoot?.querySelector("[data-testid='astra-identity-strip']") as HTMLDivElement | null
    const panel = identityStrip?.parentElement as HTMLDivElement | null
    const targetLangPill = getHost().shadowRoot?.querySelector("[data-testid='astra-identity-strip-target-lang']") as HTMLSpanElement | null

    expect(panel?.style.fontSize).toBe("16.9px")
    expect(targetLangPill?.style.fontSize).toBe("14.3px")
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
    expect(getHost().shadowRoot?.textContent ?? "").not.toContain(t("label_altHover"))
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
    expect(copyButton?.textContent).toContain(t("actionCopy"))

    await act(async () => {
      copyButton.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(copyTextToClipboardMock).toHaveBeenCalledWith("你好，世界")
  })

  it("uses a filled primary style for the hover explain action", async () => {
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const explainButton = getHost().shadowRoot?.querySelector("[data-testid='hover-explain-button']") as HTMLButtonElement | null
    expect(explainButton).toBeTruthy()
    expect(explainButton?.style.background).toContain("--astra-style-accent-primary")
    expect(explainButton?.style.color).toContain("--astra-style-text-inverse")
  })

  it("shows inline save CTA in success state and removes utility-row save button", async () => {
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const inlineSaveCta = getHost().shadowRoot?.querySelector("[data-testid='hover-result-save-cta']") as HTMLButtonElement | null
    expect(inlineSaveCta).toBeTruthy()
    expect(inlineSaveCta?.textContent).toContain(t("actionSave"))

    const exactSaveButtons = getButtons().filter((button) => button.textContent === t("actionSave"))
    expect(exactSaveButtons).toHaveLength(0)
  })

  it("shows compact saved-state treatment with review action when source text is already saved", async () => {
    hasVocabularyEntryByTextMock.mockResolvedValue(true)
    getDueVocabularyCountMock.mockResolvedValue(3)

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(hasVocabularyEntryByTextMock).toHaveBeenCalledWith("Hello world")

    const existingSavedRow = getHost().shadowRoot?.querySelector("[data-testid='hover-existing-saved-row']") as HTMLDivElement | null
    expect(existingSavedRow?.textContent).toContain(t("actionSaved"))

    const inlineSaveCta = getHost().shadowRoot?.querySelector("[data-testid='hover-result-save-cta']")
    expect(inlineSaveCta).toBeNull()
    expect(existingSavedRow?.textContent).toContain(`${t("popup_review")} (3)`)
  })

  it("publishes learning session save state when hover save succeeds", async () => {
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const inlineSaveCta = getHost().shadowRoot?.querySelector("[data-testid='hover-result-save-cta']") as HTMLButtonElement | null
    expect(inlineSaveCta).toBeTruthy()

    await act(async () => {
      inlineSaveCta?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledTimes(1)
    expect(markSessionSaveMock).toHaveBeenCalledWith("hover_translate", 0)

    const card = getHost().shadowRoot?.querySelector("[data-testid='hover-translate-card']") as HTMLDivElement | null
    expect(card?.textContent).toContain(t("learningSavedTitle"))
    expect(card?.textContent).toContain(t("learningSavedHint"))
    expect(card?.textContent).toMatch(/learning queue|学习队列/)
    expect(card?.textContent).toMatch(/1 minute|1 分钟/)
    expect(card?.textContent).toMatch(/source|来源/)
  })

  it("submits a metadata-only hover report from the error card when signed in", async () => {
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
    translateTextsMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
    })
    const createObjectURLMock = vi.fn(() => "blob:should-not-download")
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    })

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const recoveryCard = getHost().shadowRoot?.querySelector("[data-testid='hover-error-recovery-card']") as HTMLDivElement | null
    expect(recoveryCard?.textContent).toContain("Astra could not connect right now")
    expect(recoveryCard?.textContent).toContain("Next step: Retry when online")
    expect(recoveryCard?.textContent).toContain("Local progress was kept")
    expect(recoveryCard?.textContent).toContain("report this hover")
    expect(recoveryCard?.textContent).not.toContain("Relay unavailable")

    const reportButton = getHost().shadowRoot?.querySelector("[data-testid='hover-report-error-button']") as HTMLButtonElement | null
    expect(reportButton).toBeTruthy()

    await act(async () => {
      reportButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
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
        featureSurface: "selection",
        action: "report_hover_translation_error",
        issueCategory: "translation_quality",
        errorCategory: "hover_translation_failed",
        lastErrorCategory: "hover_translation_failed",
        runtimeSurface: "content_hover_translate",
        hostname: "localhost",
        privacyMode: DEFAULT_ASTRA_CONFIG.privacyMode,
        membershipState: "pro",
        userMessageIncluded: false,
        contactIncluded: false,
        contentIncluded: { enabled: false, type: "none" },
      }),
    }))
    const submittedBundle = submitAstraSupportReportMock.mock.calls[0]?.[0]?.bundle
    expect(JSON.stringify(submittedBundle)).not.toContain("Hello world")
    expect(JSON.stringify(submittedBundle)).not.toContain("/article")
    expect(JSON.stringify(submittedBundle)).not.toContain("with=path")
    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("support_report_submitted", expect.objectContaining({
      source: "content_hover_translate",
      reportId: "rpt_hover_remote_0001",
      issueCategory: "translation_quality",
      featureSurface: "selection",
      knownIssueMatched: false,
    }))
    expect(getHost().shadowRoot?.querySelector("[data-testid='hover-report-status']")?.textContent).toContain("Metadata report submitted")
  })

  it("downloads a metadata-only hover report from the error card when unsigned", async () => {
    window.history.replaceState({}, "", "/article?with=path")
    readAstraSessionMock.mockResolvedValue(null)
    translateTextsMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" },
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
    const createObjectURLMock = vi.fn(() => "blob:astra-hover-report")
    const revokeObjectURLMock = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    })

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    const reportButton = getHost().shadowRoot?.querySelector("[data-testid='hover-report-error-button']") as HTMLButtonElement | null
    expect(reportButton).toBeTruthy()

    await act(async () => {
      reportButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(submitAstraSupportReportMock).not.toHaveBeenCalled()
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:astra-hover-report")
    const payload = JSON.parse(String(lastDownloadBlobParts[0] ?? ""))
    expect(payload).toEqual(expect.objectContaining({
      schema: "astra-support-bundle.v1",
      userConsent: true,
      featureSurface: "selection",
      action: "report_hover_translation_error",
      issueCategory: "translation_quality",
      runtimeSurface: "content_hover_translate",
      hostname: "localhost",
      contentIncluded: { enabled: false, type: "none" },
    }))
    expect(JSON.stringify(payload)).not.toContain("Hello world")
    expect(JSON.stringify(payload)).not.toContain("/article")
    expect(JSON.stringify(payload)).not.toContain("with=path")
    expect((clickedDownloadAnchor as HTMLAnchorElement | null)?.download).toMatch(/^astra-hover-report-.*\.json$/)
    expect(getHost().shadowRoot?.querySelector("[data-testid='hover-report-status']")?.textContent).toContain("Downloaded metadata-only report JSON")
  })

  it("keeps the hover card interactive when the pointer moves onto it", async () => {
    translateTextsMock.mockResolvedValueOnce({ ok: true, translations: ["你好，世界"] })
    translateExplanationWithQualityRetryMock.mockResolvedValueOnce({ ok: true, text: "这是问候语的解释" })

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

    const explainButton = getButtons().find((button) => button.textContent?.includes(t("actionExplain")))
    expect(explainButton).toBeDefined()

    await act(async () => {
      explainButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(host.shadowRoot?.textContent ?? "").toContain("这是问候语的解释")
  })

  it("translates on hover without Alt key when hoverTrigger is always", async () => {
    readConfigMock.mockResolvedValue(createConfig({ hoverTrigger: "always" as any }))
    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    expect(handleMouseMove).toBeTypeOf("function")

    const event = new MouseEvent("mousemove", { altKey: false })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(getHost().shadowRoot?.textContent ?? "").not.toContain(t("label_hover"))
    expect(getHost().shadowRoot?.textContent ?? "").not.toContain(t("label_altHover"))
    const identityStrip = getHost().shadowRoot?.querySelector("[data-testid='astra-identity-strip']") as HTMLDivElement | null
    expect(identityStrip?.textContent).toContain("Astra")
  })

  it("deduplicates concurrent hover requests for the same element", async () => {
    // Make translateTextsMock return a delayed promise we can control
    let resolveTranslation: ((value: { ok: true; translations: string[] }) => void) | undefined
    translateTextsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranslation = resolve
        }),
    )

    const target = document.getElementById("target") as HTMLElement
    const handleMouseMove = listeners.mousemove as ((event: MouseEvent) => void) | undefined
    expect(handleMouseMove).toBeTypeOf("function")

    // First hover triggers translation request
    const event1 = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event1, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event1)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(1)

    // Move away and back to the same element while request is still pending
    // Simulate moving to a different element first to reset currentTarget
    findClosestTextBlockMock.mockReturnValueOnce(null)
    const moveAway = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(moveAway, "target", { value: document.body })

    await act(async () => {
      handleMouseMove?.(moveAway)
      await Promise.resolve()
    })

    // Move back to the same element
    findClosestTextBlockMock.mockReturnValue({ element: target, text: "Hello world" })
    const event2 = new MouseEvent("mousemove", { altKey: true })
    Object.defineProperty(event2, "target", { value: target })

    await act(async () => {
      handleMouseMove?.(event2)
      await vi.advanceTimersByTimeAsync(300)
      await Promise.resolve()
    })

    // Should NOT have triggered a second translation (deduplication)
    expect(translateTextsMock).toHaveBeenCalledTimes(1)

    // Resolve the first request so it cleans up
    await act(async () => {
      resolveTranslation?.({ ok: true, translations: ["你好，世界"] })
      await Promise.resolve()
    })
  })

  it("requests and toggles hover explanations", async () => {
    translateTextsMock.mockResolvedValueOnce({ ok: true, translations: ["你好，世界"] })
    translateExplanationWithQualityRetryMock.mockResolvedValueOnce({ ok: true, text: "这是问候语的解释" })

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
    const explainButton = buttons.find((button) => button.textContent?.includes(t("actionExplain")))
    expect(explainButton).toBeDefined()

    await act(async () => {
      explainButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(translateExplanationWithQualityRetryMock).toHaveBeenCalledWith({
      source: "Hello world",
      targetLang: "zh-CN",
      context: {
        pageTitle: "Test page",
        selectionContext: "Hello world",
      },
      requiredGlossaryTerms: [],
    })
    expect(getHost().shadowRoot?.textContent ?? "").toContain("这是问候语的解释")

    const copyButton = getButtons().find((button) => button.textContent?.includes(t("actionCopy")))
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })
    expect(copyTextToClipboardMock).toHaveBeenLastCalledWith("你好，世界")

    buttons = getButtons()
    const hideButton = buttons.find((button) => button.textContent?.includes(t("actionHideExplanation")))
    expect(hideButton).toBeDefined()

    await act(async () => {
      hideButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }))
      await Promise.resolve()
    })

    expect(getHost().shadowRoot?.textContent ?? "").not.toContain("这是问候语的解释")
  })
})
