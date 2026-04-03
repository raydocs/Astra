import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AstraAccount, AstraSession } from "@/types/auth"

const {
  readConfigMock,
  saveConfigInBackgroundMock,
  readAstraSessionMock,
  saveAstraSessionMock,
  clearAstraSessionMock,
  createAstraSessionMock,
  refreshAstraSessionMock,
  revokeAstraSessionMock,
  fetchAstraAccountMock,
  fetchAstraUsageSnapshotMock,
  getActiveTabStudyContextMock,
  getActiveTabTranslationStateMock,
  startActiveTabTranslationMock,
  stopActiveTabTranslationMock,
  getDueVocabularyCountMock,
  getQuotaInfoMock,
  getReadingHistoryMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigInBackgroundMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  saveAstraSessionMock: vi.fn(),
  clearAstraSessionMock: vi.fn(),
  createAstraSessionMock: vi.fn(),
  refreshAstraSessionMock: vi.fn(),
  revokeAstraSessionMock: vi.fn(),
  fetchAstraAccountMock: vi.fn(),
  fetchAstraUsageSnapshotMock: vi.fn(),
  getActiveTabStudyContextMock: vi.fn(),
  getActiveTabTranslationStateMock: vi.fn(),
  startActiveTabTranslationMock: vi.fn(),
  stopActiveTabTranslationMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  getQuotaInfoMock: vi.fn(),
  getReadingHistoryMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
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

vi.mock("@/utils/storage/reading-history", () => ({
  getReadingHistory: getReadingHistoryMock,
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getDueVocabularyCount: getDueVocabularyCountMock,
}))

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
    fetchAstraUsageSnapshotMock.mockResolvedValue(undefined)
    getActiveTabTranslationStateMock.mockResolvedValue(createIdleState())
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "A concise summary of the current article for study mode.",
      },
    })
    startActiveTabTranslationMock.mockResolvedValue(createIdleState())
    stopActiveTabTranslationMock.mockResolvedValue(createIdleState())
    getDueVocabularyCountMock.mockResolvedValue(3)
    getQuotaInfoMock.mockResolvedValue({ used: 100000, limit: 200000, plan: "free", resetsAt: "" })
    getReadingHistoryMock.mockResolvedValue([])

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
