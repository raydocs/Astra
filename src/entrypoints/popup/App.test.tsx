import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AstraAccount, AstraSession } from "@/types/auth"

const {
  readConfigMock,
  saveConfigMock,
  readAstraSessionMock,
  saveAstraSessionMock,
  clearAstraSessionMock,
  createAstraSessionMock,
  refreshAstraSessionMock,
  revokeAstraSessionMock,
  fetchAstraAccountMock,
  fetchAstraUsageSnapshotMock,
  updateAstraPlanMock,
  createAstraCheckoutLinkMock,
  createAstraPortalLinkMock,
  getActiveTabTranslationStateMock,
  startActiveTabTranslationMock,
  stopActiveTabTranslationMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  saveAstraSessionMock: vi.fn(),
  clearAstraSessionMock: vi.fn(),
  createAstraSessionMock: vi.fn(),
  refreshAstraSessionMock: vi.fn(),
  revokeAstraSessionMock: vi.fn(),
  fetchAstraAccountMock: vi.fn(),
  fetchAstraUsageSnapshotMock: vi.fn(),
  updateAstraPlanMock: vi.fn(),
  createAstraCheckoutLinkMock: vi.fn(),
  createAstraPortalLinkMock: vi.fn(),
  getActiveTabTranslationStateMock: vi.fn(),
  startActiveTabTranslationMock: vi.fn(),
  stopActiveTabTranslationMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
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
  updateAstraPlan: updateAstraPlanMock,
  createAstraCheckoutLink: createAstraCheckoutLinkMock,
  createAstraPortalLink: createAstraPortalLinkMock,
}))

vi.mock("@/utils/extension/messages", () => ({
  getActiveTabTranslationState: getActiveTabTranslationStateMock,
  startActiveTabTranslation: startActiveTabTranslationMock,
  stopActiveTabTranslation: stopActiveTabTranslationMock,
}))

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
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
    ...createAccountBase(),
    ...patch,
  }
}

function createAccountBase(): AstraAccount {
  return {
    id: "usr_demo",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    billingEmail: "billing@example.com",
    createdAt: "2026-03-01T00:00:00.000Z",
    plan: "pro" as const,
    subscriptionStatus: "active" as const,
    providerEntitlements: ["openai", "gemini"] as const,
  }
}

function createUsage() {
  return {
    generatedAt: "2026-03-26T00:01:00.000Z",
    quota: createSession().quota,
    usage: {
      ...createSession().usage,
      recentEvents: [{
        timestamp: "2026-03-26T00:00:00.000Z",
        provider: "openai" as const,
        requestCount: 1,
        characterCount: 5,
      }],
    },
  }
}

describe("popup App", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  let browserMock: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    browserMock = (globalThis as { __ASTRA_TEST_BROWSER__?: any }).__ASTRA_TEST_BROWSER__
    browserMock.tabs.query.mockResolvedValue([{ id: 1, url: "https://example.com/article" }])

    readConfigMock.mockResolvedValue(createConfig())
    saveConfigMock.mockImplementation(async (input: Partial<AstraConfig>) => createConfig(input))
    readAstraSessionMock.mockResolvedValue(createSession())
    saveAstraSessionMock.mockImplementation(async (session: unknown) => session)
    clearAstraSessionMock.mockResolvedValue(undefined)
    createAstraSessionMock.mockResolvedValue(createSession())
    refreshAstraSessionMock.mockResolvedValue(createSession())
    revokeAstraSessionMock.mockResolvedValue(undefined)
    fetchAstraAccountMock.mockResolvedValue(createAccount())
    fetchAstraUsageSnapshotMock.mockResolvedValue(createUsage())
    updateAstraPlanMock.mockResolvedValue(createAccount())
    createAstraCheckoutLinkMock.mockResolvedValue({
      kind: "checkout",
      url: "https://billing.example/checkout?plan=pro",
      generatedAt: "2026-03-26T00:02:00.000Z",
      plan: "pro",
    })
    createAstraPortalLinkMock.mockResolvedValue({
      kind: "portal",
      url: "https://billing.example/portal",
      generatedAt: "2026-03-26T00:02:00.000Z",
      plan: "pro",
    })
    getActiveTabTranslationStateMock.mockResolvedValue(createIdleState())
    startActiveTabTranslationMock.mockResolvedValue(createIdleState())
    stopActiveTabTranslationMock.mockResolvedValue(createIdleState())

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
    vi.useRealTimers()
  })

  function getButtons() {
    return Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
  }

  function getSiteEnabledCheckbox() {
    return container.querySelector('input[type="checkbox"]') as HTMLInputElement
  }

  async function flushApp() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("keeps translate enabled until site disable is saved", async () => {
    const [translateButton] = getButtons()
    expect(translateButton.textContent).toBe("翻译此页")
    expect(translateButton.disabled).toBe(false)

    const siteEnabledCheckbox = getSiteEnabledCheckbox()
    expect(siteEnabledCheckbox.checked).toBe(true)

    await act(async () => {
      siteEnabledCheckbox.click()
      await Promise.resolve()
    })

    expect(translateButton.disabled).toBe(false)
    expect(container.textContent).not.toContain("Astra 已在此站点禁用")

    await act(async () => {
      translateButton.click()
      await Promise.resolve()
    })

    expect(startActiveTabTranslationMock).toHaveBeenCalledWith({
      targetLang: "zh-CN",
      translationMode: "bilingual",
      translationTheme: "default",
      contentScope: "page",
    })
  })

  it("applies the disabled site state only after save", async () => {
    saveConfigMock.mockResolvedValueOnce(createConfig({
      sites: {
        "example.com": {
          enabled: false,
          alwaysTranslate: false,
        },
      },
    }))

    const siteEnabledCheckbox = getSiteEnabledCheckbox()
    const saveButton = getButtons().find((button) => button.textContent?.includes("保存设置"))!
    const translateButton = getButtons().find((button) => button.textContent === "翻译此页")!

    await act(async () => {
      siteEnabledCheckbox.click()
      await Promise.resolve()
    })

    await act(async () => {
      saveButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: {
        "example.com": {
          enabled: false,
          alwaysTranslate: false,
        },
      },
    }))
    expect(stopActiveTabTranslationMock).toHaveBeenCalledTimes(1)
    expect(translateButton.disabled).toBe(true)
    expect(container.textContent).toContain("Astra 已在此站点禁用")
  })

  it("preserves unsaved draft edits when popup refreshes on focus", async () => {
    const siteEnabledCheckbox = getSiteEnabledCheckbox()

    await act(async () => {
      siteEnabledCheckbox.click()
      await Promise.resolve()
    })

    expect(siteEnabledCheckbox.checked).toBe(false)

    readConfigMock.mockResolvedValue(createConfig())

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(getSiteEnabledCheckbox().checked).toBe(false)
  })

  it("creates and stores an Astra session from the popup login flow", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        relayBaseURL: "https://astra.example/v1",
      },
    }))
    readAstraSessionMock.mockResolvedValue(null)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await vi.runAllTimersAsync()
    })
    await flushApp()

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const passwordInputs = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    const authPasswordInput = passwordInputs[0]
    const signInButton = getButtons().find((button) => button.textContent === "登录 Astra")!
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
    expect(fetchAstraUsageSnapshotMock).toHaveBeenCalled()
    expect(saveAstraSessionMock).toHaveBeenCalled()
  })

  it("switches the Astra plan and refreshes account state", async () => {
    const proButton = getButtons().find((button) => button.textContent === "切到 Pro")
    expect(proButton?.disabled).toBe(true)

    const freeButton = getButtons().find((button) => button.textContent === "切到 Free")!
    await act(async () => {
      freeButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateAstraPlanMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      plan: "free",
    })
    expect(refreshAstraSessionMock).toHaveBeenCalled()
  })

  it("opens billing checkout and portal links in a new tab", async () => {
    refreshAstraSessionMock.mockResolvedValue({
      ...createSession(),
      plan: "free",
      providerEntitlements: ["openai"],
    })
    fetchAstraAccountMock.mockResolvedValue(createAccount({
      plan: "free",
      providerEntitlements: ["openai"],
    }))

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await vi.runAllTimersAsync()
    })
    await flushApp()

    const upgradeButton = getButtons().find((button) => button.textContent === "升级到 Pro")!
    const portalButton = getButtons().find((button) => button.textContent === "管理订阅")!

    await act(async () => {
      upgradeButton.click()
      await Promise.resolve()
    })

    expect(createAstraCheckoutLinkMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      plan: "pro",
    })
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "https://billing.example/checkout?plan=pro",
    })

    await act(async () => {
      portalButton.click()
      await Promise.resolve()
    })

    expect(createAstraPortalLinkMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "https://billing.example/portal",
    })
  })
})
