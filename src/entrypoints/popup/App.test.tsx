import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AstraAccount, AstraSession } from "@/types/auth"

const {
  readConfigMock,
  saveConfigInBackgroundMock,
  ensureAstraDeviceIdentityMock,
  readAstraSessionMock,
  saveAstraSessionMock,
  clearAstraSessionMock,
  createAstraSessionMock,
  refreshAstraSessionMock,
  revokeAstraSessionMock,
  fetchAstraAccountMock,
  fetchAstraContinuitySnapshotMock,
  fetchAstraUsageSnapshotMock,
  getActiveTabStudyContextMock,
  getActiveTabTranslationStateMock,
  startActiveTabTranslationMock,
  stopActiveTabTranslationMock,
  getDueVocabularyCountMock,
  getVocabularyEntriesMock,
  saveVocabularyEntryMock,
  getQuotaInfoMock,
  getReadingHistoryMock,
  getTranslationUsageSummaryMock,
  getStudyProgressMock,
  recordStudyEventMock,
  getPageDigestMock,
  isDigestStaleMock,
  generatePageDigestMock,
  savePageDigestMock,
  translateTextsMock,
  speakMock,
  stopSpeakingMock,
  isTtsSupportedMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigInBackgroundMock: vi.fn(),
  ensureAstraDeviceIdentityMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  saveAstraSessionMock: vi.fn(),
  clearAstraSessionMock: vi.fn(),
  createAstraSessionMock: vi.fn(),
  refreshAstraSessionMock: vi.fn(),
  revokeAstraSessionMock: vi.fn(),
  fetchAstraAccountMock: vi.fn(),
  fetchAstraContinuitySnapshotMock: vi.fn(),
  fetchAstraUsageSnapshotMock: vi.fn(),
  getActiveTabStudyContextMock: vi.fn(),
  getActiveTabTranslationStateMock: vi.fn(),
  startActiveTabTranslationMock: vi.fn(),
  stopActiveTabTranslationMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  getVocabularyEntriesMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  getQuotaInfoMock: vi.fn(),
  getReadingHistoryMock: vi.fn(),
  getTranslationUsageSummaryMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  recordStudyEventMock: vi.fn(),
  getPageDigestMock: vi.fn(),
  isDigestStaleMock: vi.fn(),
  generatePageDigestMock: vi.fn(),
  savePageDigestMock: vi.fn(),
  translateTextsMock: vi.fn(),
  speakMock: vi.fn(),
  stopSpeakingMock: vi.fn(),
  isTtsSupportedMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  ensureAstraDeviceIdentity: ensureAstraDeviceIdentityMock,
  readAstraSession: readAstraSessionMock,
  saveAstraSession: saveAstraSessionMock,
  clearAstraSession: clearAstraSessionMock,
}))

vi.mock("@/utils/astra/auth", () => ({
  createAstraSession: createAstraSessionMock,
  refreshAstraSession: refreshAstraSessionMock,
  revokeAstraSession: revokeAstraSessionMock,
}))

vi.mock("@/utils/astra/account", () => ({
  fetchAstraAccount: fetchAstraAccountMock,
  fetchAstraContinuitySnapshot: fetchAstraContinuitySnapshotMock,
  fetchAstraUsageSnapshot: fetchAstraUsageSnapshotMock,
}))

vi.mock("@/utils/astra/quota", () => ({
  getQuotaInfo: getQuotaInfoMock,
}))

vi.mock("@/utils/extension/messages", () => ({
  getActiveTabStudyContext: getActiveTabStudyContextMock,
  getActiveTabTranslationState: getActiveTabTranslationStateMock,
  saveConfigInBackground: saveConfigInBackgroundMock,
  startActiveTabTranslation: startActiveTabTranslationMock,
  stopActiveTabTranslation: stopActiveTabTranslationMock,
}))

vi.mock("@/utils/storage/reading-history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/reading-history")>()
  return {
    ...actual,
    getReadingHistory: getReadingHistoryMock,
  }
})

vi.mock("@/utils/storage/vocabulary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/vocabulary")>()
  return {
    ...actual,
    getDueVocabularyCount: getDueVocabularyCountMock,
    getVocabularyEntries: getVocabularyEntriesMock,
    saveVocabularyEntry: saveVocabularyEntryMock,
  }
})

vi.mock("@/utils/storage/translation-usage", () => ({
  getTranslationUsageSummary: getTranslationUsageSummaryMock,
}))

vi.mock("@/utils/storage/page-digests", () => ({
  getPageDigest: getPageDigestMock,
  savePageDigest: savePageDigestMock,
  computeFingerprint: vi.fn(() => "test-fingerprint"),
  isDigestStale: isDigestStaleMock,
}))

vi.mock("@/utils/reading/assist", () => ({
  generatePageDigest: generatePageDigestMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

vi.mock("@/utils/tts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/tts")>()
  return {
    ...actual,
    speak: speakMock,
    stopSpeaking: stopSpeakingMock,
    isTtsSupported: isTtsSupportedMock,
  }
})

vi.mock("@/utils/storage/study-progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/study-progress")>()
  return {
    ...actual,
    getStudyProgress: getStudyProgressMock,
    recordStudyEvent: recordStudyEventMock,
    deriveStudyLoopViewModel: vi.fn(() => ({
      currentPage: null,
      nextStep: "read" as const,
      completionPercent: 0,
      dailyStats: { date: "2026-04-03", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
      recentPages: [],
    })),
  }
})

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { t } from "@/utils/i18n"
import App from "./App"

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

function createIdleState() {
  return {
    ok: true as const,
    state: {
      phase: "idle" as const,
      sessionId: 1,
      targetLang: "zh-CN",
      lastError: null,
      progress: {
        totalBlocks: 0,
        queuedBlocks: 0,
        inFlightBlocks: 0,
        translatedBlocks: 0,
        failedBlocks: 0,
      },
      presentation: {
        mode: "bilingual" as const,
        theme: "default" as const,
      },
      site: {
        hostname: "example.com",
        enabled: true,
        alwaysTranslate: false,
      },
    },
  }
}

function createSession(patch: Partial<AstraSession> = {}): AstraSession {
  return {
    version: 1,
    sessionToken: "astra-session",
    sessionId: null,
    deviceId: "device-123",
    identityMode: "authenticated",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    plan: "pro",
    subscriptionStatus: "active",
    providerEntitlements: ["openai", "gemini"],
    quota: {
      dailyRequestsLimit: 2000,
      dailyCharactersLimit: 500000,
      requestsPerMinuteLimit: 120,
      remainingDailyRequests: 1999,
      remainingDailyCharacters: 499995,
    },
    usage: {
      totalRequests: 1,
      totalCharacters: 5,
      dailyRequestsUsed: 1,
      dailyCharactersUsed: 5,
      lastRequestAt: "2026-03-26T00:00:00.000Z",
      recentEvents: [],
    },
    issuedAt: null,
    expiresAt: null,
    ...patch,
  }
}

function createAccount(patch: Partial<AstraAccount> = {}): AstraAccount {
  return {
    id: "usr_demo",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    billingEmail: "billing@example.com",
    createdAt: "2026-03-01T00:00:00.000Z",
    plan: "pro" as const,
    subscriptionStatus: "active" as const,
    providerEntitlements: ["openai", "gemini"] as const,
    ...patch,
  }
}

describe("popup App", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  let rootUnmounted: boolean
  let browserMock: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    browserMock = (globalThis as { __ASTRA_TEST_BROWSER__?: any }).__ASTRA_TEST_BROWSER__
    browserMock.tabs.query.mockResolvedValue([{ id: 1, url: "https://example.com/article" }])

    ensureAstraDeviceIdentityMock.mockResolvedValue({
      version: 1,
      deviceId: "device-123",
      label: "Chrome on macOS",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "extension",
      appVersion: "0.1.0-test",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    })
    readConfigMock.mockResolvedValue(createConfig())
    saveConfigInBackgroundMock.mockImplementation(async (input: Partial<AstraConfig>) => ({
      ok: true,
      config: createConfig(input),
    }))
    readAstraSessionMock.mockResolvedValue(createSession())
    saveAstraSessionMock.mockImplementation(async (session: unknown) => session)
    clearAstraSessionMock.mockResolvedValue(undefined)
    createAstraSessionMock.mockResolvedValue(createSession())
    refreshAstraSessionMock.mockResolvedValue(createSession())
    revokeAstraSessionMock.mockResolvedValue(undefined)
    fetchAstraAccountMock.mockResolvedValue(createAccount())
    fetchAstraContinuitySnapshotMock.mockImplementation(async (params: { includePull?: boolean }) => ({
      devices: [{
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0-test",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      }],
      bootstrap: {
        serverTime: "2026-04-09T01:05:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
          vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: {
          maxMutationsPerRequest: 100,
        },
        transport: {
          deviceHeader: "X-Astra-Device-Id",
          idempotencyKey: "clientMutationId",
          cursorMode: "per-collection",
        },
      },
      pull: params.includePull
        ? {
            serverTime: "2026-04-09T01:06:00.000Z",
            deltas: {
              config: [{
                collection: "config",
                schemaVersion: 1,
                recordId: "settings",
                operation: "upsert",
                clientMutationId: "mut-1",
                deviceId: "device-123",
                clientUpdatedAt: "2026-04-09T01:04:00.000Z",
                payload: { targetLang: "ja" },
                ownerId: "usr_demo",
                email: "user@example.com",
                serverMutationId: "srv-1",
                serverUpdatedAt: "2026-04-09T01:05:30.000Z",
                cursor: "cfg-4",
              }],
              vocabulary: [],
              reading_history: [],
              study_progress: [],
            },
            nextCursors: {
              config: "cfg-4",
              vocabulary: null,
              reading_history: null,
              study_progress: null,
            },
          }
        : null,
    }))
    fetchAstraUsageSnapshotMock.mockResolvedValue(undefined)
    getActiveTabTranslationStateMock.mockResolvedValue(createIdleState())
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "A concise summary of the current article for study mode.",
        articleExcerpt: "First article sentence. Second article sentence with more detail.",
      },
    })
    startActiveTabTranslationMock.mockResolvedValue(createIdleState())
    stopActiveTabTranslationMock.mockResolvedValue(createIdleState())
    getDueVocabularyCountMock.mockResolvedValue(3)
    getVocabularyEntriesMock.mockResolvedValue([])
    saveVocabularyEntryMock.mockImplementation(async (entry: unknown) => ({
      id: "vocab-1",
      savedAt: Date.now(),
      ...(entry as Record<string, unknown>),
    }))
    getQuotaInfoMock.mockResolvedValue({ used: 100000, limit: 200000, plan: "free", resetsAt: "" })
    getReadingHistoryMock.mockResolvedValue([])
    getTranslationUsageSummaryMock.mockResolvedValue({
      sessionStartedAt: 1000,
      session: {
        requests: 2,
        texts: 3,
        chars: 48,
        estimatedInputTokens: 12,
        estimatedOutputTokens: 15,
        estimatedCostUsd: 0.001,
        directRequests: 1,
        relayRequests: 1,
        fallbackRequests: 1,
        failedRequests: 1,
        avgDurationMs: 200,
        bySource: {},
      },
      today: {
        requests: 4,
        texts: 7,
        chars: 96,
        estimatedInputTokens: 24,
        estimatedOutputTokens: 30,
        estimatedCostUsd: 0.002,
        directRequests: 2,
        relayRequests: 2,
        fallbackRequests: 1,
        failedRequests: 1,
        avgDurationMs: 180,
        bySource: { "page-translation": 3, "selection": 1 },
      },
      lastEvent: {
        id: "evt-1",
        timestamp: 1234,
        providerId: "openai",
        model: "gpt-5.4-nano",
        task: "translate",
        textCount: 1,
        charCount: 12,
        estimatedInputTokens: 3,
        attemptedTransports: ["direct", "relay"],
        finalTransport: "relay",
        fallbackUsed: true,
        success: false,
        errorCode: "PROVIDER_REQUEST_FAILED",
      },
    })

    getPageDigestMock.mockResolvedValue(null)
    isDigestStaleMock.mockReturnValue(false)
    generatePageDigestMock.mockResolvedValue({
      headline: "Test headline",
      summary: "Test summary",
      keyPoints: ["Point 1", "Point 2"],
      vocabularyFocus: [
        { term: "signal", note: "Used to describe the article's key trend." },
      ],
      grammarFocus: ["Notice how the article uses contrast to frame the argument."],
      suggestedAction: "Explain one sentence that uses the key term in context.",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Custom study action output"],
    })
    speakMock.mockReturnValue(true)
    stopSpeakingMock.mockReturnValue(undefined)
    isTtsSupportedMock.mockReturnValue(true)
    savePageDigestMock.mockImplementation(async (_params: unknown, digest: unknown) => ({
      ...(digest as Record<string, unknown>),
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      targetLang: "zh-CN",
      languageLevel: "beginner",
      generatedAt: Date.now(),
      sourceFingerprint: "test-fingerprint",
    }))

    getStudyProgressMock.mockResolvedValue({
      pages: [],
      dailyStats: { date: "2026-04-03", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
    rootUnmounted = false

    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  afterEach(async () => {
    if (!rootUnmounted) {
      await act(async () => {
        root.unmount()
        await Promise.resolve()
      })
    }
    container.remove()
    vi.useRealTimers()
  })

  function getButtons() {
    return Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
  }

  async function flushApp() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  async function setFormValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

    await act(async () => {
      setter?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("renders the translate button and starts translation", async () => {
    const translateButton = getButtons().find((button) => button.textContent === t("popup_translateThisPage"))!
    expect(translateButton).toBeDefined()
    expect(translateButton.disabled).toBe(false)

    await act(async () => {
      translateButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startActiveTabTranslationMock).toHaveBeenCalledWith({
      targetLang: "zh-CN",
      translationMode: "bilingual",
      translationTheme: "default",
      contentScope: "page",
    })
  })

  it("shows connection status and plan label", async () => {
    await flushApp()

    expect(container.textContent).toContain(t("popup_connected"))
    expect(container.textContent).toContain("Pro Plan")
    expect(container.textContent).toContain("Astra continuity · 1 device · 1 active")
    expect(container.textContent).toContain("Config bootstrap: enabled · Cursor cfg-3")
    expect(container.textContent).toContain("Reading history sync: off · Optional")
    expect(container.textContent).toContain("Study progress sync: off · Optional · Daily stats stay local")
    expect(container.textContent).toContain("Config continuity ready · Optional collections available in Settings")
  })

  it("shows quota bar with usage info", async () => {
    await flushApp()

    expect(container.textContent).toContain("50%")
    expect(container.textContent).toContain("100k / 200k tokens")
  })

  it("creates and stores an Astra session from the popup login flow", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        relayBaseURL: "https://astra.example/v1",
      },
    }))
    readAstraSessionMock.mockResolvedValue(null)
    getQuotaInfoMock.mockResolvedValue({ used: 0, limit: 200000, plan: "free", resetsAt: "" })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await vi.runAllTimersAsync()
    })
    await flushApp()

    // Expand the sign-in section
    const signInSummary = container.querySelector("summary")
    if (signInSummary?.textContent?.includes(t("popup_signInToAstra"))) {
      await act(async () => {
        signInSummary.click()
        await Promise.resolve()
      })
    }

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const passwordInputs = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    const authPasswordInput = passwordInputs[0]
    const signInButton = getButtons().find((button) => button.textContent === t("popup_signIn"))!
    const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set

    await act(async () => {
      inputValueSetter?.call(emailInput, "user@example.com")
      emailInput.dispatchEvent(new Event("input", { bubbles: true }))
      emailInput.dispatchEvent(new Event("change", { bubbles: true }))
      inputValueSetter?.call(authPasswordInput, "secret-pass")
      authPasswordInput.dispatchEvent(new Event("input", { bubbles: true }))
      authPasswordInput.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      signInButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(createAstraSessionMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      email: "user@example.com",
      password: "secret-pass",
    })
    expect(fetchAstraAccountMock).toHaveBeenCalled()
    expect(saveAstraSessionMock).toHaveBeenCalled()
  })

  it("shows sign out button when logged in and signs out", async () => {
    await flushApp()

    const signOutButton = getButtons().find((button) => button.textContent === t("popup_signOut"))!
    expect(signOutButton).toBeDefined()

    await act(async () => {
      signOutButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(revokeAstraSessionMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })
    expect(clearAstraSessionMock).toHaveBeenCalled()
  })

  it("renders the study hub with current-page summary and review count", async () => {
    getReadingHistoryMock.mockResolvedValue([
      {
        id: "history-1",
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        wordsTranslated: 120,
        visitedAt: 1000,
      },
    ])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    expect(container.textContent).toContain("学习中心")
    expect(container.textContent).toContain("A concise summary of the current article for study mode.")
    expect(container.textContent).toContain("待复习 3 个")
    expect(container.textContent).toContain("120 词")
    expect(container.textContent).toContain("阅读文章")
  })

  it("starts article-mode translation from the study hub", async () => {
    await flushApp()

    const readArticleButton = getButtons().find((button) => button.textContent === "阅读文章")
    expect(readArticleButton).toBeDefined()

    await act(async () => {
      readArticleButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startActiveTabTranslationMock).toHaveBeenCalledWith({
      targetLang: "zh-CN",
      translationMode: "bilingual",
      translationTheme: "default",
      contentScope: "article",
    })
  })

  it("shows usage and routing feedback in the popup", async () => {
    await flushApp()

    expect(container.textContent).toContain("用量与路由")
    // Grid layout renders i18n-ized metrics
    expect(container.textContent).toContain("4")
    expect(container.textContent).toContain("请求数")
    expect(container.textContent).toContain("24")
    expect(container.textContent).toContain("openai / gpt-5.4-nano")
    expect(container.textContent).toContain("direct → relay")
    expect(container.textContent).toContain("这里只统计发起过的翻译请求；命中缓存的内容不会出现在这里。")
  })

  it("persists site advanced rules from the popup", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    const excludeSelectorsInput = container.querySelector('[data-testid="site-exclude-selectors-input"]') as HTMLTextAreaElement
    const paragraphMinLengthInput = container.querySelector('[data-testid="site-paragraph-min-length-input"]') as HTMLInputElement

    expect(selectorsInput).toBeTruthy()
    expect(excludeSelectorsInput).toBeTruthy()
    expect(paragraphMinLengthInput).toBeTruthy()

    await setFormValue(selectorsInput, "article\n.content")
    await setFormValue(excludeSelectorsInput, ".comments\naside")
    await setFormValue(paragraphMinLengthInput, "42")
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenCalled()
    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          selectors: ["article", ".content"],
          excludeSelectors: [".comments", "aside"],
          paragraphMinLength: 42,
        }),
      }),
    }))
  })

  it("shows an inline error for invalid CSS selectors and does not persist them", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    expect(selectorsInput).toBeTruthy()

    await setFormValue(selectorsInput, "article[")
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await flushApp()

    const error = container.querySelector('[data-testid="site-selectors-error"]')
    expect(error?.textContent).toContain("article[")
    expect(saveConfigInBackgroundMock).not.toHaveBeenCalled()
  })

  it("flushes pending site rule saves on pagehide before popup teardown", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    expect(selectorsInput).toBeTruthy()

    await setFormValue(selectorsInput, "article\n.content")
    expect(saveConfigInBackgroundMock).not.toHaveBeenCalled()

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(saveConfigInBackgroundMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          selectors: ["article", ".content"],
        }),
      }),
    }))
  })

  it("flushes pending site rule saves when the popup unmounts", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    expect(selectorsInput).toBeTruthy()

    await setFormValue(selectorsInput, "article\n.content")
    expect(saveConfigInBackgroundMock).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
      rootUnmounted = true
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(saveConfigInBackgroundMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          selectors: ["article", ".content"],
        }),
      }),
    }))
  })

  it("renders enriched study digest content and offers a stale refresh action", async () => {
    const generateButton = getButtons().find((button) => button.textContent === t("popup_generateDigest"))
    expect(generateButton).toBeDefined()

    await act(async () => {
      generateButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Test headline")
    expect(container.textContent).toContain(t("popup_digestVocabularyFocus"))
    expect(container.textContent).toContain("signal")
    expect(container.textContent).toContain(t("popup_digestGrammarFocus"))
    expect(container.textContent).toContain(t("popup_digestNextStep"))
    expect(container.textContent).toContain("Explain one sentence that uses the key term in context.")

    getPageDigestMock.mockResolvedValue({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      targetLang: "zh-CN",
      languageLevel: "beginner",
      generatedAt: Date.now(),
      sourceFingerprint: "stale-fingerprint",
      headline: "Cached headline",
      summary: "Cached summary",
      keyPoints: ["Cached point"],
      vocabularyFocus: [{ term: "register", note: "Highlights tone in the article." }],
      grammarFocus: ["Watch the tense shift in the supporting example."],
      suggestedAction: "Re-run the digest after changing your level.",
    })
    isDigestStaleMock.mockReturnValue(true)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain(t("popup_digestStale"))
    expect(container.textContent).toContain(t("popup_digestStaleHint"))

    const regenerateButton = getButtons().find((button) => button.textContent === t("popup_regenerateDigest"))
    expect(regenerateButton).toBeDefined()

    await act(async () => {
      regenerateButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(generatePageDigestMock).toHaveBeenCalledTimes(2)
  })

  it("surfaces custom study actions in the popup and runs them against article context", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      customActions: [{
        id: "deep-read",
        label: "Deep Read",
        labelZh: "深读",
        systemPrompt: "Explain this article in {{targetLang}} with focus on: {{text}}",
        enabled: true,
      }],
    }))

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const actionButton = getButtons().find((button) => button.textContent === "深读")
    expect(actionButton).toBeDefined()

    await act(async () => {
      actionButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      targetLang: "zh-CN",
      task: "custom",
      texts: ["First article sentence. Second article sentence with more detail."],
      context: expect.objectContaining({
        pageTitle: "Example article",
        hostname: "example.com",
        articleExcerpt: "First article sentence. Second article sentence with more detail.",
      }),
    }))
    expect(container.textContent).toContain("Custom study action output")
  })

  it("shows the article excerpt and sentence drills in the study hub when provided", () => {
    expect(container.textContent).toContain(t("popup_studyArticleExcerpt"))
    expect(container.textContent).toContain("First article sentence. Second article sentence with more detail.")
    expect(container.textContent).toContain(t("popup_studySentenceDeck"))
  })

  it("records read progress when starting guided article reading", async () => {
    const readArticleButton = getButtons().find((button) => button.textContent === t("popup_readArticle"))
    expect(readArticleButton).toBeDefined()

    await act(async () => {
      readArticleButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startActiveTabTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      contentScope: "article",
    }))
    expect(recordStudyEventMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: "https://example.com/article",
      step: "read",
    }))
    expect(recordStudyEventMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: "https://example.com/article",
      step: "guided_read",
    }))
  })

  it("explains a sentence from the article excerpt inside the popup", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Sentence explanation output"],
    })
    getStudyProgressMock.mockResolvedValue({
      pages: [{
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain"],
        sentencesExplained: 1,
        vocabSaved: 0,
        startedAt: 1000,
        lastActivityAt: 2000,
      }],
      dailyStats: { date: "2026-04-03", pagesStudied: 1, sentencesExplained: 1, vocabSaved: 0, vocabReviewed: 0 },
    })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      targetLang: "zh-CN",
      texts: ["First article sentence."],
      context: expect.objectContaining({
        pageTitle: "Example article",
        articleExcerpt: "First article sentence. Second article sentence with more detail.",
        selectionContext: "First article sentence.",
      }),
    }))
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "explain",
    }))
    expect(container.textContent).toContain("Sentence explanation output")
  })

  it("reuses cached sentence explanations instead of re-requesting the same sentence", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Sentence explanation output"],
    })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
  })

  it("allows retrying sentence explain after a transient failure", async () => {
    translateTextsMock
      .mockResolvedValueOnce({
        ok: false,
        error: { message: "Temporary relay outage" },
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["Recovered explanation output"],
      })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Warning: Temporary relay outage")

    const retryButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      retryButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Recovered explanation output")
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "explain",
    }))
  })

  it("supports sentence navigation and single-sentence speech from the popup", async () => {
    const nextButton = container.querySelector('[data-testid="study-sentence-next"]') as HTMLButtonElement
    const speakButton = container.querySelector('[data-testid="study-sentence-speak"]') as HTMLButtonElement
    const prevButton = container.querySelector('[data-testid="study-sentence-prev"]') as HTMLButtonElement

    expect(prevButton.disabled).toBe(true)
    expect(nextButton.disabled).toBe(false)

    await act(async () => {
      nextButton.click()
      await Promise.resolve()
    })

    await act(async () => {
      speakButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(speakMock).toHaveBeenCalledWith("Second article sentence with more detail.", expect.objectContaining({
      lang: "zh-CN",
    }))
    expect(prevButton.disabled).toBe(false)
  })

  it("runs the popup deep-read chain from explain to save to review and speak", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Sentence explanation output"],
    })
    getStudyProgressMock.mockResolvedValue({
      pages: [{
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain", "vocab_save"],
        sentencesExplained: 1,
        vocabSaved: 1,
        startedAt: 1000,
        lastActivityAt: 2000,
      }],
      dailyStats: { date: "2026-04-03", pagesStudied: 1, sentencesExplained: 1, vocabSaved: 1, vocabReviewed: 0 },
    })
    getDueVocabularyCountMock.mockResolvedValueOnce(3).mockResolvedValueOnce(4)

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const saveButtons = getButtons().filter((button) => button.textContent === t("actionSave"))
    expect(saveButtons.length).toBeGreaterThan(0)

    await act(async () => {
      saveButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "First article sentence.",
      explanation: "Sentence explanation output",
      hostname: "example.com",
      url: "https://example.com/article",
      sourceContext: expect.objectContaining({
        surface: "popup_deep_read",
        pageTitle: "Example article",
        sentenceText: "First article sentence.",
        sentenceIndex: 0,
      }),
    }))
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "vocab_save",
    }))
    expect(container.textContent).toContain(t("actionSaved"))

    const savedCta = container.querySelector('[data-testid="study-sentence-saved-cta-0"]')
    const reviewCta = container.querySelector('[data-testid="study-sentence-open-review-0"]') as HTMLButtonElement
    const speakButton = container.querySelector('[data-testid="study-sentence-speak"]') as HTMLButtonElement

    expect(savedCta).toBeTruthy()
    expect(reviewCta).toBeTruthy()

    await act(async () => {
      reviewCta.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("/vocabulary.html?tab=review"),
    }))

    await act(async () => {
      speakButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(speakMock).toHaveBeenCalledWith("First article sentence.", expect.objectContaining({
      lang: "zh-CN",
    }))
  })

  it("shows saved sentence state from existing vocabulary for the current article", async () => {
    getVocabularyEntriesMock.mockResolvedValue([{
      id: "saved-sentence-1",
      text: "First article sentence.",
      explanation: "Saved earlier",
      context: "First article sentence. Second article sentence with more detail.",
      url: "https://example.com/article",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        sentenceText: "First article sentence.",
        sentenceIndex: 0,
      },
    }])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-saved-cta-0"]')).toBeTruthy()
    expect(container.textContent).toContain(t("actionSaved"))
  })

  it("keeps duplicate sentence occurrences separate when only one popup sentence was saved", async () => {
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "A concise summary of the current article for study mode.",
        articleExcerpt: "Repeat me. Repeat me.",
      },
    })
    getVocabularyEntriesMock.mockResolvedValue([{
      id: "saved-sentence-duplicate-1",
      text: "Repeat me.",
      explanation: "Saved earlier",
      context: "Repeat me. Repeat me.",
      url: "https://example.com/article",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        sentenceText: "Repeat me.",
        sentenceIndex: 0,
      },
    }])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-saved-cta-0"]')).toBeTruthy()

    const secondSentenceCard = container.querySelector('[data-testid="study-sentence-card-1"]') as HTMLDivElement
    expect(secondSentenceCard).toBeTruthy()

    await act(async () => {
      secondSentenceCard.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-saved-cta-1"]')).toBeFalsy()
  })

  it("shows the version footer", async () => {
    expect(container.textContent).toContain("Astra v0.1.0")
  })

  it("shows footer links for settings, vocabulary, and review", async () => {
    const settingsButton = getButtons().find((button) => button.textContent === t("popup_settings"))
    const vocabButton = getButtons().find((button) => button.textContent === t("popup_vocabulary"))
    const reviewButton = getButtons().find((button) => button.textContent === t("popup_review"))

    expect(settingsButton).toBeDefined()
    expect(vocabButton).toBeDefined()
    expect(reviewButton).toBeDefined()
  })

  it("opens review in the vocabulary page review tab", async () => {
    const reviewButtons = getButtons().filter((button) => button.textContent === t("popup_review") || button.textContent === `${t("popup_review")} (3)`)
    expect(reviewButtons.length).toBeGreaterThan(0)

    await act(async () => {
      reviewButtons[0].click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("/vocabulary.html?tab=review"),
    }))
  })
})
