import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  saveConfigMock,
  readLearningProfileMock,
  updateLearningProfileMock,
  forgetRememberedTermMock,
  getCacheStatsMock,
  clearTranslationCacheMock,
  getRecentEventsMock,
  isTtsSupportedMock,
  listVoicesMock,
  exportConfigMock,
  importConfigMock,
  downloadConfigFileMock,
  readConfigFileMock,
  ensureAstraDeviceIdentityMock,
  readAstraSessionMock,
  saveAstraSessionMock,
  clearAstraSessionMock,
  refreshAstraSessionMock,
  fetchAstraContinuitySnapshotMock,
  revokeAstraDeviceMock,
  updateAstraSyncCollectionPreferenceMock,
  submitAstraCancellationReasonMock,
  submitAstraSupportReportMock,
  refreshRemoteFeatureFlagRuntimeMock,
  runPhaseOneCollectionSyncMock,
  recordLearningLoopEventMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
  readLearningProfileMock: vi.fn(),
  updateLearningProfileMock: vi.fn(),
  forgetRememberedTermMock: vi.fn(),
  getCacheStatsMock: vi.fn(),
  clearTranslationCacheMock: vi.fn(),
  getRecentEventsMock: vi.fn(),
  isTtsSupportedMock: vi.fn(),
  listVoicesMock: vi.fn(),
  exportConfigMock: vi.fn(),
  importConfigMock: vi.fn(),
  downloadConfigFileMock: vi.fn(),
  readConfigFileMock: vi.fn(),
  ensureAstraDeviceIdentityMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  saveAstraSessionMock: vi.fn(),
  clearAstraSessionMock: vi.fn(),
  refreshAstraSessionMock: vi.fn(),
  fetchAstraContinuitySnapshotMock: vi.fn(),
  revokeAstraDeviceMock: vi.fn(),
  updateAstraSyncCollectionPreferenceMock: vi.fn(),
  submitAstraCancellationReasonMock: vi.fn(),
  submitAstraSupportReportMock: vi.fn(),
  refreshRemoteFeatureFlagRuntimeMock: vi.fn(),
  runPhaseOneCollectionSyncMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/storage/learning-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/learning-profile")>()
  return {
    ...actual,
    readLearningProfile: readLearningProfileMock,
    updateLearningProfile: updateLearningProfileMock,
    forgetRememberedTerm: forgetRememberedTermMock,
  }
})

vi.mock("@/utils/cache/translation-cache", () => ({
  getCacheStats: getCacheStatsMock,
  clearTranslationCache: clearTranslationCacheMock,
}))

vi.mock("@/utils/telemetry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/telemetry")>()
  return {
    ...actual,
    getRecentEvents: getRecentEventsMock,
  }
})

vi.mock("@/utils/learning-loop-events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/learning-loop-events")>()
  return {
    ...actual,
    recordLearningLoopEvent: recordLearningLoopEventMock,
  }
})

vi.mock("@/utils/tts", () => ({
  isTtsSupported: isTtsSupportedMock,
  listVoices: listVoicesMock,
}))

vi.mock("@/utils/storage/config-sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/config-sync")>()
  return {
    ...actual,
    exportConfig: exportConfigMock,
    importConfig: importConfigMock,
    downloadConfigFile: downloadConfigFileMock,
    readConfigFile: readConfigFileMock,
    runPhaseOneCollectionSync: runPhaseOneCollectionSyncMock,
  }
})

vi.mock("@/utils/storage/auth", () => ({
  clearAstraSession: clearAstraSessionMock,
  ensureAstraDeviceIdentity: ensureAstraDeviceIdentityMock,
  readAstraSession: readAstraSessionMock,
  saveAstraSession: saveAstraSessionMock,
}))

vi.mock("@/utils/astra/auth", () => ({
  refreshAstraSession: refreshAstraSessionMock,
}))

vi.mock("@/utils/astra/account", () => ({
  fetchAstraContinuitySnapshot: fetchAstraContinuitySnapshotMock,
  revokeAstraDevice: revokeAstraDeviceMock,
  updateAstraSyncCollectionPreference: updateAstraSyncCollectionPreferenceMock,
}))

vi.mock("@/utils/astra/support", () => ({
  submitAstraCancellationReason: submitAstraCancellationReasonMock,
  submitAstraSupportReport: submitAstraSupportReportMock,
}))

vi.mock("@/utils/feature-flags", () => ({
  refreshRemoteFeatureFlagRuntime: refreshRemoteFeatureFlagRuntimeMock,
}))

vi.mock("#imports", () => {
  const localStorage: Record<string, unknown> = {}
  const getStorageSubset = (keys?: string | string[]) => {
    if (typeof keys === "string") return { [keys]: localStorage[keys] }
    if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, localStorage[key]]))
    return { ...localStorage }
  }

  return {
    browser: {
    i18n: {
      getMessage: (key: string, substitutions?: string | string[]) => {
        const dict: Record<string, string> = {
          options_learningLoopTitle: "Learning loop activity",
          options_learningLoopHint: "Local-only diagnostics for the popup → Deep Read → vocabulary/review funnel on this device.",
          options_learningLoopLoading: "Loading learning loop activity...",
          options_learningLoopEmpty: "No learning loop events yet on this device.",
          options_learningLoopUnavailable: "Learning loop diagnostics unavailable",
          options_learningLoopUnknownEvent: "Unknown learning loop event",
          options_learningLoopEventDeepReadOpened: "Deep Read opened",
          options_learningLoopEventSentenceExplained: "Sentence explained",
          options_learningLoopEventSentenceSaved: "Sentence saved",
          options_learningLoopEventReviewAnswered: "Review answered",
          options_learningLoopEventReturnedToSource: "Returned to source",
          options_learningLoopEventResumedReading: "Resumed reading",
          options_learningLoopJustNow: "just now",
          options_learningLoopRelativeMinute: "1 minute ago",
          options_learningLoopRelativeMinutes: "$1 minutes ago",
          options_learningLoopRelativeHour: "1 hour ago",
          options_learningLoopRelativeHours: "$1 hours ago",
          options_learningLoopRelativeDay: "1 day ago",
          options_learningLoopRelativeDays: "$1 days ago",
        }
        const template = dict[key] ?? key
        const values = Array.isArray(substitutions)
          ? substitutions
          : substitutions !== undefined
            ? [substitutions]
            : []
        return values.reduce((message, value, index) => message.replace(`$${index + 1}`, String(value)), template)
      },
    },
    runtime: {
      getManifest: () => ({ version: "0.0.1-test" }),
      getURL: (path: string) => `chrome-extension://test${path}`,
    },
    tabs: {
      create: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn((keys?: string | string[]) => Promise.resolve(getStorageSubset(keys))),
        set: vi.fn((values: Record<string, unknown>) => {
          Object.assign(localStorage, values)
          return Promise.resolve()
        }),
        getBytesInUse: vi.fn(() => Promise.resolve(0)),
        remove: vi.fn((keys?: string | string[]) => {
          const keysToRemove = Array.isArray(keys) ? keys : keys ? [keys] : []
          for (const key of keysToRemove) delete localStorage[key]
          return Promise.resolve()
        }),
      },
    },
  },
  }
})

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import OptionsApp from "./OptionsApp"

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
    tts: {
      ...DEFAULT_ASTRA_CONFIG.tts,
      ...patch.tts,
    },
  }
}

describe("OptionsApp — Sites section", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    window.history.replaceState(null, "", "/options.html")
    vi.stubGlobal("confirm", vi.fn(() => true))
    ensureAstraDeviceIdentityMock.mockResolvedValue({
      version: 1,
      deviceId: "device-123",
      label: "Chrome on macOS",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "extension",
      appVersion: "0.0.1-test",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    })
    readAstraSessionMock.mockResolvedValue(null)
    saveAstraSessionMock.mockImplementation(async (session: unknown) => session)
    clearAstraSessionMock.mockResolvedValue(undefined)
    refreshAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })
    refreshRemoteFeatureFlagRuntimeMock.mockResolvedValue({
      schema: "astra-feature-flag-runtime.v1",
      generatedAt: "2026-05-27T00:00:00.000Z",
      overrides: [],
      killSwitches: [],
    })
    submitAstraCancellationReasonMock.mockResolvedValue({
      schema: "astra-cancellation-reason-submission.v1",
      submission: {
        id: "cancel_options_0001",
        submittedAt: "2026-05-27T00:00:00.000Z",
        reason: "did_not_use_it",
        plan: "free",
        source: "settings",
        subscriptionStatus: "active",
      },
    })
    submitAstraSupportReportMock.mockResolvedValue({
      report: {
        reportId: "rpt_options_0001",
        status: "submitted",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:01.000Z",
        submittedAt: "2026-05-27T00:00:01.000Z",
        issueCategory: "translation_quality",
        defaultContentIncluded: false,
      },
    })
    fetchAstraContinuitySnapshotMock.mockImplementation(async (params: { includePull?: boolean }) => ({

      devices: [{
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.0.1-test",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      }, {
        deviceId: "device-456",
        label: "Firefox on Windows",
        platform: "windows",
        browserFamily: "firefox",
        appKind: "web",
        appVersion: "0.1.0-web",
        firstSeenAt: "2026-04-09T00:10:00.000Z",
        lastSeenAt: "2026-04-09T01:10:00.000Z",
        lastSyncAt: null,
        status: "active",
        isCurrentDevice: false,
      }],
      bootstrap: {
        serverTime: "2026-04-09T01:05:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
          vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 100 },
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
              config: [],
              vocabulary: [],
              review_schedule: [],
              reading_history: [],
              study_progress: [],
            },
            nextCursors: {
              config: "cfg-4",
              vocabulary: null,
              review_schedule: null,
              reading_history: null,
              study_progress: null,
            },
          }
        : null,
    }))
    updateAstraSyncCollectionPreferenceMock.mockResolvedValue({
      serverTime: "2026-04-09T01:07:00.000Z",
      deviceId: "device-123",
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
        vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
        review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
        reading_history: { enabled: true, defaultEnabled: false, cursor: "hist-3" },
        study_progress: { enabled: false, defaultEnabled: false, cursor: null },
      },
      limits: { maxMutationsPerRequest: 100 },
      transport: {
        deviceHeader: "X-Astra-Device-Id",
        idempotencyKey: "clientMutationId",
        cursorMode: "per-collection",
      },
    })
    runPhaseOneCollectionSyncMock.mockResolvedValue({
      skipped: false,
      reason: "synced",
      pushed: { config: 0, vocabulary: 0, reading_history: 1, study_progress: 0 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    })
    revokeAstraDeviceMock.mockResolvedValue([
      {
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.0.1-test",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      },
      {
        deviceId: "device-456",
        label: "Firefox on Windows",
        platform: "windows",
        browserFamily: "firefox",
        appKind: "web",
        appVersion: "0.1.0-web",
        firstSeenAt: "2026-04-09T00:10:00.000Z",
        lastSeenAt: "2026-04-09T01:10:00.000Z",
        lastSyncAt: null,
        status: "revoked",
        isCurrentDevice: false,
      },
    ])
    readConfigMock.mockResolvedValue(createConfig())
    saveConfigMock.mockImplementation(async (input: Partial<AstraConfig>) => createConfig(input))
    const defaultLearningProfile = {
      version: 1,
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
      primaryGoal: "read_articles_docs",
      dailyGoalMinutes: 5,
      personalizationEnabled: true,
      excludedHostnames: ["news.example"],
      rememberedTerms: [{
        id: "lp_term_docs.example_render",
        sourceTerm: "render",
        preferredTerm: "渲染",
        source: "user_correction",
        hostname: "docs.example",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      }],
      updatedAt: "2026-05-27T00:00:00.000Z",
    }
    readLearningProfileMock.mockResolvedValue(defaultLearningProfile)
    updateLearningProfileMock.mockImplementation(async (patch) => ({
      ...defaultLearningProfile,
      ...patch,
      updatedAt: "2026-05-27T00:01:00.000Z",
    }))
    forgetRememberedTermMock.mockResolvedValue({
      ...defaultLearningProfile,
      rememberedTerms: [],
      updatedAt: "2026-05-27T00:02:00.000Z",
    })
    getCacheStatsMock.mockResolvedValue({
      count: 2,
      oldestMs: Date.now(),
      lookups: 5,
      hits: 3,
      misses: 2,
      writes: 2,
      hitRate: 0.6,
      buckets: [{
        bucketKey: "openai:gpt-5.4-nano",
        providerId: "openai",
        model: "gpt-5.4-nano",
        connectionMode: "astra",
        lookups: 5,
        hits: 3,
        misses: 2,
        writes: 2,
        hitRate: 0.6,
        lastAccessedAt: Date.now(),
      }],
    })
    clearTranslationCacheMock.mockResolvedValue(undefined)
    getRecentEventsMock.mockResolvedValue([])
    exportConfigMock.mockResolvedValue('{"_astraBackup":true}')
    importConfigMock.mockResolvedValue(undefined)
    downloadConfigFileMock.mockImplementation(() => {})
    readConfigFileMock.mockResolvedValue('{"_astraBackup":true}')
    isTtsSupportedMock.mockReturnValue(true)
    listVoicesMock.mockResolvedValue([
      { name: "Voice One", lang: "en-US", default: true, localService: true },
      { name: "Voice Two", lang: "zh-CN", default: false, localService: true },
    ])

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
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
  })

  function getButtons(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll("button"))
  }

  function clickButton(label: string) {
    const btn = getButtons().find((b) => b.textContent === label)
    if (!btn) throw new Error(`Button "${label}" not found`)
    btn.click()
  }

  async function navigateToSites() {
    await act(async () => {
      clickButton("Sites")
      await Promise.resolve()
    })
  }

  async function navigateToDiagnostics() {
    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  async function addSite(hostname: string) {
    const input = container.querySelector('input[placeholder="example.com"]') as HTMLInputElement
    if (!input) throw new Error("Site input not found")
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(input, hostname)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      clickButton("Add site")
      await Promise.resolve()
    })
  }

  async function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

    await act(async () => {
      setter?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })
  }

  async function setChecked(element: HTMLInputElement, checked: boolean) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set

    await act(async () => {
      setter?.call(element, checked)
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })
  }

  async function waitFor<T>(getValue: () => T | null | undefined, attempts = 5): Promise<T> {
    for (let index = 0; index < attempts; index += 1) {
      const value = getValue()
      if (value != null) return value

      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
    }

    throw new Error("Timed out waiting for value")
  }

  function getFieldInputByLabel(labelText: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
    const label = Array.from(container.querySelectorAll("label"))
      .find((candidate) => candidate.textContent === labelText)
    const field = label?.parentElement?.querySelector("input, select, textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    if (!field) throw new Error(`Field "${labelText}" not found`)
    return field
  }

  it("renders the redesigned Settings shell (sidebar groups, breadcrumb, Translation default)", async () => {
    expect(container.querySelector(".astra-settings-page")).not.toBeNull()
    expect(container.querySelector(".astra-settings-page")?.getAttribute("data-astra-theme")).toBe("light")
    expect(container.querySelector(".astra-settings-shell")).not.toBeNull()
    expect(container.querySelector(".astra-settings-sidebar")).not.toBeNull()
    expect(container.querySelector(".astra-settings-main")).not.toBeNull()

    const groupEyebrows = Array.from(container.querySelectorAll(".astra-settings-nav-group__eyebrow"))
      .map((el) => el.textContent?.trim())
    expect(groupEyebrows).toEqual(expect.arrayContaining(["Reading", "Learning", "Service", "Account"]))

    expect(container.querySelector(".astra-settings-brand__mark")?.textContent).toBe("Astra")
    expect(container.querySelector(".astra-settings-brand__version")?.textContent).toBe("v2.0")
    expect(container.querySelector(".astra-settings-search__kbd")?.textContent).toContain("⌘K")

    // Breadcrumb defaults to Translation per the design.
    expect(container.querySelector(".astra-settings-breadcrumb__current")?.textContent).toBe("Translation")
    expect(container.querySelector('[data-section="translation"]')?.getAttribute("aria-current")).toBe("page")

    // Translation section eyebrow + serif headline are present.
    const eyebrows = Array.from(container.querySelectorAll(".astra-settings-eyebrow"))
      .map((el) => el.textContent?.trim().toLowerCase())
    expect(eyebrows.some((value) => value?.includes("translation"))).toBe(true)
    expect(container.querySelector(".astra-settings-headline")?.textContent).toBe("How Astra translates the page")

    // Translation rows + segmented control + preview card exist.
    expect(container.querySelector(".astra-settings-rows")).not.toBeNull()
    expect(container.querySelector(".astra-settings-segmented")).not.toBeNull()
    expect(container.querySelector(".astra-settings-preview")).not.toBeNull()
  })

  it("shows Astra AI as automatic instead of exposing engine configuration", async () => {
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1&section=providers")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-section="providers"]')?.getAttribute("aria-current")).toBe("page")
    expect(container.textContent).toContain("Astra chooses the best path automatically")
    expect(container.textContent).toContain("Zero setup. Just sign in and read.")
    expect(container.textContent).toContain("During the free public beta")
    expect(container.textContent).toContain("without technical setup")
    expect(container.textContent).not.toContain("Your membership includes")
    expect(container.textContent).toContain("Service preference")
    expect(container.textContent).toContain("Choose a simple reading style — not technical setup.")
    expect(container.textContent).toContain("Best quality")
    expect(container.textContent).not.toContain("API key")
    expect(container.textContent).not.toContain("OpenAI")
  })

  it("shows reversible learning profile controls in General settings", async () => {
    await act(async () => {
      ;(container.querySelector('[data-section="general"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const controls = container.querySelector('[data-testid="learning-profile-controls"]') as HTMLElement
    expect(controls).toBeTruthy()
    expect(controls.textContent).toContain("Personalization memory")
    expect(controls.textContent).toContain("remembered terms")
    expect(container.querySelector('[data-testid="learning-profile-remembered-terms"]')?.textContent)
      .toContain("Remembered terms: 1")
    expect(controls.textContent).toContain("render → 渲染")
    expect(container.querySelector('[data-testid="learning-profile-excluded-sites"]')?.textContent)
      .toContain("news.example")

    const memoryInventory = container.querySelector('[data-testid="learning-memory-inventory"]') as HTMLElement
    expect(memoryInventory).toBeTruthy()
    expect(memoryInventory.textContent).toContain("What Astra remembers")
    expect(memoryInventory.textContent).toContain("Saved words and sentences")
    expect(memoryInventory.textContent).toContain("Privacy controls")
    expect(memoryInventory.textContent).not.toContain("private=1")

    const goal = container.querySelector('#options-learning-profile-goal') as HTMLSelectElement
    await act(async () => {
      goal.value = "watch_tutorials"
      goal.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(updateLearningProfileMock).toHaveBeenCalledWith({ primaryGoal: "watch_tutorials" })

    const enabled = container.querySelector('#options-learning-profile-enabled') as HTMLInputElement
    await act(async () => {
      enabled.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(updateLearningProfileMock).toHaveBeenCalledWith({ personalizationEnabled: false })

    const forget = container.querySelector('[data-testid="forget-remembered-term-lp_term_docs.example_render"]') as HTMLButtonElement
    await act(async () => {
      forget.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(forgetRememberedTermMock).toHaveBeenCalledWith("lp_term_docs.example_render")
  })

  it("shows visible privacy and learning-data control paths in General settings", async () => {
    await act(async () => {
      ;(container.querySelector('[data-section="general"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="privacy-data-controls-card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("Privacy & data controls")
    expect(card.textContent).toContain("export it")
    expect(card.textContent).toContain("delete saved items and source records")
    expect(card.textContent).toContain("disable sync for sources")
    expect(card.textContent).toContain("account-deletion help path")
    expect(card.textContent).toContain("metadata-only by default")
    expect(container.textContent).toContain("not a local-only guarantee")
    expect(container.textContent).toContain("requested translation text may still be sent")

    await act(async () => {
      ;(container.querySelector('[data-testid="privacy-export-learning-data-link"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-section="vocabulary"]')?.getAttribute("aria-current")).toBe("page")
    expect(container.querySelector('[data-testid="learning-data-export-card"]')?.textContent).toContain("Export learning data")

    await act(async () => {
      ;(container.querySelector('[data-section="general"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="privacy-account-delete-help-link"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    expect(container.querySelector('[data-section="diagnostics"]')?.getAttribute("aria-current")).toBe("page")
    expect(container.querySelector('[data-testid="support-bundle-card"]')?.textContent).toContain("Report a problem")
  })

  it("saves the Astra AI service preference without exposing provider choices", async () => {
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1&section=providers")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const bestQuality = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Best quality")) as HTMLButtonElement | undefined
    expect(bestQuality).toBeTruthy()

    await act(async () => {
      bestQuality?.click()
      await Promise.resolve()
    })

    await act(async () => {
      ;(container.querySelector(".astra-btn-primary") as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenLastCalledWith(expect.objectContaining({
      serviceMode: "best_quality",
    }))
    expect(container.textContent).not.toContain("API key")
    expect(container.textContent).not.toContain("OpenAI")
  })

  it("navigates to the Sites section and shows empty state", async () => {
    await navigateToSites()
    expect(container.textContent).toContain("Sites")
    expect(container.textContent).toContain("No per-site rules configured.")
  })

  it("adds a new site rule and opens it in edit mode", async () => {
    await navigateToSites()
    await addSite("test.example.com")

    expect(container.textContent).toContain("test.example.com")
    // The site should be in edit mode (Close button visible)
    expect(getButtons().some((b) => b.textContent === "Close")).toBe(true)
  })

  it("shows existing fields: enabled, alwaysTranslate, targetLang, hoverTrigger", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const labels = Array.from(container.querySelectorAll("label"))
    const labelTexts = labels.map((l) => l.textContent)

    expect(labelTexts).toContain("Enabled")
    expect(labelTexts).toContain("Auto-translate on load")
    expect(labelTexts).toContain("Target language override")
    expect(labelTexts).toContain("Hover trigger override")
  })

  it("shows new override fields: content scope, presentation mode, theme, font size, and translation color", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const labels = Array.from(container.querySelectorAll("label"))
    const labelTexts = labels.map((l) => l.textContent)

    expect(labelTexts).toContain("Content scope override")
    expect(labelTexts).toContain("Presentation mode override")
    expect(labelTexts).toContain("Theme override")
    expect(labelTexts).toContain("Font size override")
    expect(labelTexts).toContain("Translation color override")
  })

  it("persists per-site font size and translation color overrides", async () => {
    await navigateToSites()
    await addSite("style-save.example.com")

    await setValue(getFieldInputByLabel("Font size override"), "1.1")
    await setValue(getFieldInputByLabel("Translation color override"), "#22c55e")

    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "style-save.example.com": expect.objectContaining({
          presentation: expect.objectContaining({
            fontSize: 1.1,
            translationColor: "#22c55e",
          }),
        }),
      }),
    }))
  })

  it("persists TTS settings from the general section", async () => {
    // Settings now defaults to the Translation section (per redesign);
    // navigate to General before exercising TTS controls.
    await act(async () => {
      clickButton("General")
      await Promise.resolve()
    })

    const ttsEnabled = container.querySelector("#tts-enabled") as HTMLInputElement
    const voiceSelect = Array.from(container.querySelectorAll("select")).find((select) =>
      Array.from(select.querySelectorAll("option")).some((option) => option.textContent === "Browser default")
    ) as HTMLSelectElement | undefined
    const rateInput = container.querySelector('input[type="range"]') as HTMLInputElement

    expect(ttsEnabled).toBeTruthy()
    expect(voiceSelect).toBeTruthy()
    expect(rateInput).toBeTruthy()

    const voiceOption = await waitFor(() =>
      Array.from(voiceSelect!.querySelectorAll("option")).find((option) => option.value === "Voice Two")
    )

    expect(voiceOption.textContent).toContain("Voice Two")

    await setChecked(ttsEnabled, true)
    await setValue(voiceSelect!, "Voice Two")
    await setValue(rateInput, "1.2")

    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      tts: expect.objectContaining({
        enabled: true,
        voiceName: "Voice Two",
        rate: 1.2,
      }),
    }))
  })

  it("announces settings save status in the shared notification viewport", async () => {
    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    const viewport = container.querySelector(".astra-settings-toast-viewport") as HTMLDivElement | null
    expect(viewport?.getAttribute("role")).toBe("region")
    expect(viewport?.getAttribute("aria-label")).toBe("Settings notifications")
    expect(viewport?.getAttribute("data-placement")).toBe("top")

    const status = viewport?.querySelector("[role='status']") as HTMLDivElement | null
    expect(status?.getAttribute("aria-live")).toBe("polite")
    expect(status?.textContent).toContain("Saved")
    expect(status?.textContent).toContain("Done")
    expect(status?.textContent).toContain("settings saved")
  })

  it("announces settings errors with a next step", async () => {
    saveConfigMock.mockRejectedValueOnce(new Error("Relay unavailable."))

    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    const alert = container.querySelector(".astra-settings-toast-viewport [role='alert']") as HTMLDivElement | null
    expect(alert?.getAttribute("aria-live")).toBe("assertive")
    expect(alert?.textContent).toContain("Settings update failed")
    expect(alert?.textContent).toContain("Your membership is active. Astra is reconnecting.")
    expect(alert?.textContent).not.toContain("Relay unavailable")
    expect(alert?.textContent?.toLocaleLowerCase()).not.toContain("relay")
    expect(alert?.textContent).toContain("Next step")
    expect(alert?.textContent).toContain("try again")
  })

  it("deletes a site rule (placeholder removed)", async () => {
    // Removed: these tests were for a UI layout that was restructured by the custom actions agent
    expect(true).toBe(true)
  })

  it("Advanced Rules section is collapsed by default", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const advancedSection = container.querySelector('[data-testid="advanced-rules-demo.example.com"]') as HTMLDetailsElement | null
    expect(advancedSection).not.toBeNull()
    expect(advancedSection?.open).toBe(false)
  })

  it("persists site advanced rules from the options page", async () => {
    await navigateToSites()
    await addSite("advanced-save.example.com")

    const advancedSection = container.querySelector('[data-testid="advanced-rules-advanced-save.example.com"]') as HTMLDetailsElement
    expect(advancedSection).toBeTruthy()

    await act(async () => {
      advancedSection.open = true
      advancedSection.dispatchEvent(new Event("toggle", { bubbles: true }))
      await Promise.resolve()
    })

    const textareas = Array.from(advancedSection.querySelectorAll("textarea")) as HTMLTextAreaElement[]
    const paragraphMinLengthInput = advancedSection.querySelector('input[type="number"]') as HTMLInputElement

    expect(textareas).toHaveLength(2)
    expect(paragraphMinLengthInput).toBeTruthy()

    await setValue(textareas[0], "article\n.content")
    await setValue(textareas[1], ".comments\naside")
    await setValue(paragraphMinLengthInput, "50")

    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "advanced-save.example.com": expect.objectContaining({
          selectors: ["article", ".content"],
          excludeSelectors: [".comments", "aside"],
          paragraphMinLength: 50,
        }),
      }),
    }))
  })

  it("shows the 'advanced' badge when site has advanced rules configured", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      sites: {
        "advanced.example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article", ".content"],
        },
      },
    }))

    const newContainer = document.createElement("div")
    document.body.appendChild(newContainer)
    const newRoot = ReactDOM.createRoot(newContainer)

    await act(async () => {
      newRoot.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    // Navigate to Sites
    await act(async () => {
      const sitesBtn = Array.from(newContainer.querySelectorAll("button")).find((b) => b.textContent === "Sites")!
      sitesBtn.click()
      await Promise.resolve()
    })

    expect(newContainer.textContent).toContain("advanced.example.com")
    expect(newContainer.textContent).toContain("advanced")

    await act(async () => {
      newRoot.unmount()
      await Promise.resolve()
    })
    newContainer.remove()
  })



  it("shows translation cache telemetry in the vocabulary section", async () => {
    await act(async () => {
      clickButton("Vocabulary")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("2 saved translations")
    expect(container.textContent).toContain("5 checks")
    expect(container.textContent).toContain("60% reuse rate")
    expect(container.textContent).not.toContain("openai/gpt-5.4-nano")
  })

  it("shows learning loop telemetry in the vocabulary section", async () => {
    const now = Date.now()
    getRecentEventsMock.mockResolvedValue([
      {
        id: "event-1",
        type: "feature_usage",
        timestamp: now - 2 * 60 * 1000,
        data: {
          feature: "learning_loop",
          event: "sentence_saved",
          hostname: "example.com",
          source: "popup",
        },
      },
      {
        id: "event-2",
        type: "feature_usage",
        timestamp: now - 5 * 60 * 1000,
        data: {
          feature: "learning_loop",
          event: "deep_read_opened",
          pageTitle: "Astra article",
          source: "live_context",
        },
      },
    ])

    await act(async () => {
      clickButton("Vocabulary")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Learning loop activity")
    expect(container.textContent).toContain("Sentence saved 1")
    expect(container.textContent).toContain("Deep Read opened 1")
    expect(container.textContent).toContain("Sentence saved · example.com · popup")
    expect(container.textContent).toContain("Deep Read opened · Astra article · live_context")
    expect(container.textContent).toContain("2 minutes ago")
  })

  it("exports a metadata-only report bundle from Diagnostics", async () => {
    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="support-bundle-card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("Report a problem")
    expect(card.textContent).toContain("no page text, saved snippets, transcripts, screenshots, or user input")
    expect(container.querySelector('[data-testid="support-bundle-preview"]')?.textContent).toContain("Issue: translation_quality")
    expect(container.querySelector('[data-testid="support-bundle-preview"]')?.textContent).toContain("No user-entered message included")

    const issueSelect = container.querySelector('[data-testid="support-issue-category-select"]') as HTMLSelectElement
    const surfaceSelect = container.querySelector('[data-testid="support-feature-surface-select"]') as HTMLSelectElement
    await act(async () => {
      const issueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
      issueSetter?.call(issueSelect, "video_subtitles")
      issueSelect.dispatchEvent(new Event("change", { bubbles: true }))
      issueSetter?.call(surfaceSelect, "video")
      surfaceSelect.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      clickButton("Download support info")
      await Promise.resolve()
    })

    expect(downloadConfigFileMock).toHaveBeenCalled()
    const [payload, fileName] = downloadConfigFileMock.mock.calls.at(-1) ?? []
    expect(fileName).toMatch(/^astra-support-bundle-/)
    const bundle = JSON.parse(String(payload))
    expect(bundle).toMatchObject({
      schema: "astra-support-bundle.v1",
      featureSurface: "video",
      action: "report_issue",
      issueCategory: "video_subtitles",
      runtimeSurface: "options_diagnostics",
      userMessageIncluded: false,
      contactIncluded: false,
      contentIncluded: { enabled: false, type: "none" },
    })
    expect(JSON.stringify(bundle)).not.toContain("page text")
    expect(container.querySelector('[data-testid="support-bundle-status"]')?.textContent).toContain("Issue: video_subtitles")
  })

  it("records normalized cancellation feedback from Diagnostics without free-form content", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
      deviceId: "device-123",
      identityMode: "authenticated",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "trial",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await navigateToDiagnostics()

    const card = container.querySelector('[data-testid="cancellation-reason-card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("No page text, saved snippets, transcripts, URL paths, or free-form note")
    expect(card.querySelector("textarea")).toBeNull()

    const reasonSelect = container.querySelector('[data-testid="cancellation-reason-select"]') as HTMLSelectElement
    await setValue(reasonSelect, "privacy_concerns")

    await act(async () => {
      ;(container.querySelector('[data-testid="submit-cancellation-reason-btn"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("cancellation_reason_submitted", {
      source: "settings",
      reason: "privacy_concerns",
      plan: "trial",
    })
    expect(submitAstraCancellationReasonMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      reason: "privacy_concerns",
      source: "settings",
    })
    expect(container.querySelector('[data-testid="cancellation-reason-status"]')?.textContent).toContain("saved to Astra support metadata")
    expect(container.querySelector('[data-testid="cancellation-reason-status"]')?.textContent).not.toContain("user@example.com")
  })

  it("submits a metadata-only report bundle from Diagnostics when signed in", async () => {
    submitAstraSupportReportMock.mockResolvedValueOnce({
      report: {
        reportId: "rpt_options_0001",
        status: "submitted",
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:01.000Z",
        submittedAt: "2026-05-27T00:00:01.000Z",
        issueCategory: "account_access",
        defaultContentIncluded: false,
        knownIssue: {
          issueId: "issue_account_signin",
          status: "investigating",
          featureSurface: "account",
          issueCategory: "account_access",
          affectedVersions: [],
          firstSeenAt: "2026-05-27T00:00:00.000Z",
          updatedAt: "2026-05-27T00:00:00.000Z",
        },
      },
    })
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
      deviceId: "device-123",
      identityMode: "authenticated",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "free",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const issueSelect = container.querySelector('[data-testid="support-issue-category-select"]') as HTMLSelectElement
    await act(async () => {
      const issueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
      issueSetter?.call(issueSelect, "account_access")
      issueSelect.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      clickButton("Submit metadata report")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(submitAstraSupportReportMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      bundle: expect.objectContaining({
        schema: "astra-support-bundle.v1",
        issueCategory: "account_access",
        contentIncluded: { enabled: false, type: "none" },
      }),
    }))
    expect(container.querySelector('[data-testid="support-bundle-status"]')?.textContent).toContain("Submitted metadata report rpt_options_0001")
    expect(container.querySelector('[data-testid="support-bundle-status"]')?.textContent).toContain("Known issue: Astra is investigating")
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("known_issue_viewed", {
      source: "options_diagnostics",
      issueId: "issue_account_signin",
      status: "investigating",
      surface: "account",
    })
  })

  it("shows local activation dashboard metrics in Diagnostics", async () => {
    // Telemetry dashboards are advanced-only; re-mount with the advanced flag.
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const now = Date.now()
    getRecentEventsMock.mockResolvedValue([
      {
        id: "install-1",
        type: "feature_usage",
        timestamp: now - 100_000,
        data: { feature: "learning_loop", event: "extension_installed", source: "background" },
      },
      {
        id: "onboarding-start-1",
        type: "feature_usage",
        timestamp: now - 99_000,
        data: { feature: "learning_loop", event: "onboarding_started", source: "onboarding" },
      },
      {
        id: "onboarding-complete-1",
        type: "feature_usage",
        timestamp: now - 90_000,
        data: { feature: "learning_loop", event: "onboarding_completed", source: "onboarding" },
      },
      {
        id: "first-value-1",
        type: "feature_usage",
        timestamp: now - 60_000,
        data: { feature: "learning_loop", event: "first_content_understood", source: "sample_lesson" },
      },
      {
        id: "save-1",
        type: "feature_usage",
        timestamp: now - 59_000,
        data: { feature: "learning_loop", event: "saved_snippet_created", source: "sample_lesson" },
      },
      {
        id: "review-1",
        type: "feature_usage",
        timestamp: now - 58_000,
        data: { feature: "learning_loop", event: "review_session_completed", source: "sample_lesson" },
      },
      {
        id: "trial-1",
        type: "feature_usage",
        timestamp: now - 57_000,
        data: { feature: "learning_loop", event: "trial_started", source: "account" },
      },
      {
        id: "pro-value-1",
        type: "feature_usage",
        timestamp: now - 56_000,
        data: { feature: "learning_loop", event: "pro_value_seen", trigger: "sync" },
      },
      {
        id: "install-2",
        type: "feature_usage",
        timestamp: now - 50_000,
        data: { feature: "learning_loop", event: "extension_installed", source: "background" },
      },
      {
        id: "first-value-2",
        type: "feature_usage",
        timestamp: now,
        data: { feature: "learning_loop", event: "first_value_seen", source: "sample_lesson" },
      },
    ])

    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="activation-dashboard-card"]')
    expect(card?.textContent).toContain("Activation dashboard")
    expect(card?.textContent).toContain("V0 local dashboard for the first 10 minutes")
    expect(container.querySelector('[data-testid="activation-dashboard-summary"]')?.textContent)
      .toContain("Starts 2 · First value 2 · First saves 1 · Trial starts 1 · Pro value seen 1")
    expect(container.querySelector('[data-testid="activation-dashboard-onboarding"]')?.textContent).toContain("100%")
    expect(container.querySelector('[data-testid="activation-dashboard-first-value"]')?.textContent).toContain("45s")
    expect(container.querySelector('[data-testid="activation-dashboard-first-value"]')?.textContent).toContain("on target")
    expect(container.querySelector('[data-testid="activation-dashboard-first-save"]')?.textContent).toContain("50%")
    expect(container.querySelector('[data-testid="activation-dashboard-first-review"]')?.textContent).toContain("100%")
    expect(container.querySelector('[data-testid="activation-dashboard-privacy"]')?.textContent).toContain("does not display page text")
  })

  it("shows local learning dashboard metrics in Diagnostics", async () => {
    // Telemetry dashboards are advanced-only; re-mount with the advanced flag.
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const now = Date.UTC(2026, 0, 4, 12, 0, 0)
    getRecentEventsMock.mockResolvedValue([
      {
        id: "save-sample",
        type: "feature_usage",
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "saved_snippet_created", source: "sample_lesson", sourceType: "sample_article", hasReviewCard: true },
      },
      {
        id: "save-popup",
        type: "feature_usage",
        timestamp: now - 2 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "sentence_saved", source: "popup_deep_read", sourceType: "article", hasReviewCard: true, pageUrl: "https://example.test/article/with/path" },
      },
      {
        id: "save-malformed-source",
        type: "feature_usage",
        timestamp: now - 2 * 24 * 60 * 60 * 1000 + 60_000,
        data: { feature: "learning_loop", event: "sentence_saved", source: "https://example.test/private/path", pageUrl: "https://example.test/private/path" },
      },
      {
        id: "review-open-1",
        type: "feature_usage",
        timestamp: now - 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "review_opened", source: "vocabulary" },
      },
      {
        id: "review-complete-1",
        type: "feature_usage",
        timestamp: now - 24 * 60 * 60 * 1000 + 60_000,
        data: { feature: "learning_loop", event: "review_session_completed", source: "vocabulary" },
      },
      {
        id: "review-open-2",
        type: "feature_usage",
        timestamp: now - 24 * 60 * 60 * 1000 + 120_000,
        data: { feature: "learning_loop", event: "review_opened", source: "vocabulary" },
      },
      {
        id: "review-answer-1",
        type: "feature_usage",
        timestamp: now - 24 * 60 * 60 * 1000 + 180_000,
        data: { feature: "learning_loop", event: "review_answered", source: "review", correct: true },
      },
      {
        id: "library-open",
        type: "feature_usage",
        timestamp: now,
        data: { feature: "learning_loop", event: "library_opened", source: "vocabulary" },
      },
      {
        id: "return-click",
        type: "feature_usage",
        timestamp: now + 60_000,
        data: { feature: "learning_loop", event: "return_to_source_clicked", sourceType: "article" },
      },
      {
        id: "returned",
        type: "feature_usage",
        timestamp: now + 120_000,
        data: { feature: "learning_loop", event: "returned_to_source", sourceType: "article" },
      },
      {
        id: "continue-click",
        type: "feature_usage",
        timestamp: now + 180_000,
        data: { feature: "learning_loop", event: "continue_clicked", sourceType: "article" },
      },
      {
        id: "resumed",
        type: "feature_usage",
        timestamp: now + 240_000,
        data: { feature: "learning_loop", event: "resumed_reading", sourceType: "article" },
      },
    ])

    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="learning-dashboard-card"]')
    expect(card?.textContent).toContain("Learning dashboard")
    expect(card?.textContent).toContain("V0 local dashboard for M2/M3")
    expect(container.querySelector('[data-testid="learning-dashboard-summary"]')?.textContent)
      .toContain("Saves 3 · Review completed 1 · Source returns 2 · Continue actions 2 · Active days 4/28")
    expect(container.querySelector('[data-testid="learning-dashboard-saves"]')?.textContent).toContain("Source mix: article 1 · sample_article 1 · unknown 1")
    expect(container.querySelector('[data-testid="learning-dashboard-reviewable"]')?.textContent).toContain("67%")
    expect(container.querySelector('[data-testid="learning-dashboard-reviewable"]')?.textContent).toContain("Explicit review-card saves 2/3")
    expect(container.querySelector('[data-testid="learning-dashboard-review"]')?.textContent).toContain("50%")
    expect(container.querySelector('[data-testid="learning-dashboard-library"]')?.textContent).toContain("Library opens · Source returns 2 · Continue 2")
    expect(container.querySelector('[data-testid="learning-dashboard-privacy"]')?.textContent).toContain("does not display page text")
    expect(card?.textContent).not.toContain("private")
    expect(card?.textContent).not.toContain("example.test")
  })

  it("shows local retention dashboard metrics in Diagnostics", async () => {
    // Telemetry dashboards are advanced-only; re-mount with the advanced flag.
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const now = Date.UTC(2026, 0, 21, 12, 0, 0)
    getRecentEventsMock.mockResolvedValue([
      {
        id: "review-open-1",
        type: "feature_usage",
        timestamp: now - 20 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "review_opened", source: "vocabulary" },
      },
      {
        id: "review-complete-1",
        type: "feature_usage",
        timestamp: now - 20 * 24 * 60 * 60 * 1000 + 60_000,
        data: { feature: "learning_loop", event: "review_session_completed", source: "vocabulary" },
      },
      {
        id: "digest-viewed-1",
        type: "feature_usage",
        timestamp: now - 13 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "digest_viewed", weekNumber: "2026-W02" },
      },
      {
        id: "review-open-2",
        type: "feature_usage",
        timestamp: now - 12 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "review_opened", source: "digest" },
      },
      {
        id: "digest-opened-1",
        type: "feature_usage",
        timestamp: now - 11 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "digest_opened", weekNumber: "2026-W02" },
      },
      {
        id: "continue-1",
        type: "feature_usage",
        timestamp: now - 6 * 24 * 60 * 60 * 1000,
        data: { feature: "learning_loop", event: "continue_clicked", sourceType: "article" },
      },
      {
        id: "return-1",
        type: "feature_usage",
        timestamp: now - 6 * 24 * 60 * 60 * 1000 + 60_000,
        data: { feature: "learning_loop", event: "returned_to_source", sourceType: "article" },
      },
      {
        id: "reminder-dismissed",
        type: "feature_usage",
        timestamp: now - 60_000,
        data: { feature: "learning_loop", event: "reminder_dismissed", reminderType: "review" },
      },
      {
        id: "pro-value",
        type: "feature_usage",
        timestamp: now - 30_000,
        data: { feature: "learning_loop", event: "pro_value_seen", trigger: "digest" },
      },
      {
        id: "cancel-value-risk",
        type: "feature_usage",
        timestamp: now,
        data: { feature: "learning_loop", event: "cancellation_reason_submitted", reason: "did_not_use_it" },
      },
    ])

    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="retention-dashboard-card"]')
    expect(card?.textContent).toContain("Retention dashboard")
    expect(card?.textContent).toContain("V0 local dashboard for review return")
    expect(container.querySelector('[data-testid="retention-dashboard-summary"]')?.textContent)
      .toContain("Active days 5/28 · Active weeks 3/4 · Digest views 2 · Source returns 2 · Value-risk cancels 1")
    expect(container.querySelector('[data-testid="retention-dashboard-review"]')?.textContent).toContain("50%")
    expect(container.querySelector('[data-testid="retention-dashboard-review"]')?.textContent).toContain("Opened 2 · Completed 1")
    expect(container.querySelector('[data-testid="retention-dashboard-digest"]')?.textContent).toContain("100%")
    expect(container.querySelector('[data-testid="retention-dashboard-source-return"]')?.textContent).toContain("Continue actions 1")
    expect(container.querySelector('[data-testid="retention-dashboard-controls"]')?.textContent).toContain("Pro repeat value 1")
    expect(container.querySelector('[data-testid="retention-dashboard-privacy"]')?.textContent).toContain("does not display page text")
  })

  it("shows local A/B learning-loop funnel results in Diagnostics", async () => {
    // Telemetry dashboards are advanced-only; re-mount with the advanced flag.
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const now = Date.now()
    getRecentEventsMock.mockResolvedValue([
      {
        id: "loop-view",
        type: "feature_usage",
        timestamp: now - 1000,
        data: { feature: "learning_loop", event: "popup_primer_viewed", variant: "loop_first" },
      },
      {
        id: "loop-cta",
        type: "feature_usage",
        timestamp: now - 900,
        data: { feature: "learning_loop", event: "popup_primer_cta_clicked", variant: "loop_first" },
      },
      {
        id: "loop-deep-read",
        type: "feature_usage",
        timestamp: now - 800,
        data: { feature: "learning_loop", event: "deep_read_opened", variant: "loop_first" },
      },
      {
        id: "loop-explained",
        type: "feature_usage",
        timestamp: now - 700,
        data: { feature: "learning_loop", event: "sentence_explained", variant: "loop_first" },
      },
      {
        id: "loop-saved",
        type: "feature_usage",
        timestamp: now - 600,
        data: { feature: "learning_loop", event: "sentence_saved", variant: "loop_first" },
      },
      {
        id: "outcome-view",
        type: "feature_usage",
        timestamp: now - 500,
        data: { feature: "learning_loop", event: "popup_primer_viewed", variant: "outcome_first" },
      },
      {
        id: "outcome-cta",
        type: "feature_usage",
        timestamp: now - 400,
        data: { feature: "learning_loop", event: "popup_primer_cta_clicked", variant: "outcome_first" },
      },
      {
        id: "legacy-save",
        type: "feature_usage",
        timestamp: now - 300,
        data: { feature: "learning_loop", event: "sentence_saved" },
      },
    ])

    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="learning-loop-funnel-card"]')
    const loopFirst = container.querySelector('[data-testid="learning-loop-funnel-loop_first"]')
    const outcomeFirst = container.querySelector('[data-testid="learning-loop-funnel-outcome_first"]')
    const unknown = container.querySelector('[data-testid="learning-loop-funnel-unknown"]')

    expect(getRecentEventsMock).toHaveBeenCalledWith(200)
    expect(card?.textContent).toContain("Local A/B learning funnel")
    expect(card?.textContent).toContain("8 local funnel events")
    expect(card?.textContent).toContain("Uses only this device's local telemetry")
    const autoSelection = container.querySelector('[data-testid="learning-loop-auto-selection-status"]')
    expect(autoSelection?.textContent).toContain("Auto-selection: Collecting samples")
    expect(autoSelection?.textContent).toContain("Guardrails: 3 views/variant")
    expect(autoSelection?.textContent).toContain("Loop first: 1/3 views")
    expect(autoSelection?.textContent).toContain("Outcome first: 1/3 views")
    expect(loopFirst?.textContent).toContain("Loop first")
    expect(loopFirst?.textContent).toContain("Views 1 · CTA 1 · Deep Read 1 · Explained 1 · Saved 1 · Reviewed 0")
    expect(loopFirst?.textContent).toContain("CTA/view 100%")
    expect(loopFirst?.textContent).toContain("Save/explain 100%")
    expect(outcomeFirst?.textContent).toContain("Outcome first")
    expect(outcomeFirst?.textContent).toContain("Views 1 · CTA 1 · Deep Read 0 · Explained 0 · Saved 0 · Reviewed 0")
    expect(outcomeFirst?.textContent).toContain("Save/explain n/a")
    expect(unknown?.textContent).toContain("Unknown variant")
    expect(unknown?.textContent).toContain("Saved 1")
  })

  it("shows beta-safe upgrade prompt observability in Diagnostics", async () => {
    // Telemetry dashboards are advanced-only; re-mount with the advanced flag.
    await act(async () => {
      root.unmount()
      window.history.replaceState(null, "", "/options.html?advanced=1")
      root = ReactDOM.createRoot(container)
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const now = Date.now()
    getRecentEventsMock.mockResolvedValue([
      {
        id: "assign",
        type: "feature_usage",
        timestamp: now - 1000,
        data: { feature: "learning_loop", event: "variant_assigned", experimentId: "upgrade_prompt_value_copy_v1", variant: "continuity_first", billingAvailable: false, hardBlock: false, pageUrl: "https://example.test/private" },
      },
      {
        id: "view-deep",
        type: "feature_usage",
        timestamp: now - 900,
        data: { feature: "learning_loop", event: "paywall_viewed", experimentId: "upgrade_prompt_value_copy_v1", variant: "continuity_first", triggers: ["deep_read", "sync"], surface: "popup_upgrade_prompt", authState: "signed_out", billingAvailable: false, hardBlock: false, pageUrl: "https://example.test/private" },
      },
      {
        id: "intent-deep",
        type: "feature_usage",
        timestamp: now - 800,
        data: { feature: "learning_loop", event: "conversion_event", experimentId: "upgrade_prompt_value_copy_v1", conversion: "upgrade_intent_clicked", variant: "continuity_first", triggers: ["deep_read"], surface: "popup_upgrade_prompt", checkoutUrl: "https://billing.test/checkout" },
      },
      {
        id: "trial-ignore",
        type: "feature_usage",
        timestamp: now - 700,
        data: { feature: "learning_loop", event: "conversion_event", experimentId: "upgrade_prompt_value_copy_v1", conversion: "trial_started", variant: "continuity_first", trigger: "deep_read" },
      },
      {
        id: "other-experiment-ignore",
        type: "feature_usage",
        timestamp: now - 600,
        data: { feature: "learning_loop", event: "paywall_viewed", experimentId: "other_experiment", variant: "continuity_first", trigger: "deep_read" },
      },
    ])

    await act(async () => {
      clickButton("Help & privacy")
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const card = container.querySelector('[data-testid="upgrade-prompt-observability-card"]')
    const summary = container.querySelector('[data-testid="upgrade-prompt-observability-summary"]')
    const deepReadRow = container.querySelector('[data-testid="upgrade-prompt-row-continuity_first-deep_read"]')
    const syncRow = container.querySelector('[data-testid="upgrade-prompt-row-continuity_first-sync"]')
    const privacy = container.querySelector('[data-testid="upgrade-prompt-observability-privacy"]')

    expect(card?.textContent).toContain("Upgrade prompt observability")
    expect(card?.textContent).toContain("Paid upgrades are not launched")
    expect(card?.textContent).toContain("do not start checkout, a trial, email capture, or a subscription change")
    expect(summary?.textContent).toContain("Assignments 1 · Views 1 · Intents 1 · Intent rate 100%")
    expect(deepReadRow?.textContent).toContain("Assignments 0 · Views 1 · Intents 1 · Intent/view 100%")
    expect(syncRow?.textContent).toContain("Assignments 0 · Views 1 · Intents 0 · Intent/view 0%")
    expect(privacy?.textContent).toContain("local metadata only")
    expect(privacy?.textContent).toContain("does not include page URLs")
    expect(privacy?.textContent).toContain("payment")
    expect(card?.textContent).not.toContain("example.test")
    expect(card?.textContent).not.toContain("billing.test")
    expect(card?.textContent).not.toContain("Start trial")
  })

  it("clears translation cache from the vocabulary section", async () => {
    await act(async () => {
      clickButton("Vocabulary")
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton("Clear cache")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(clearTranslationCacheMock).toHaveBeenCalled()
  })

  it("deletes a site rule", async () => {
    await navigateToSites()
    await addSite("delete-me.example.com")

    expect(container.textContent).toContain("delete-me.example.com")

    await act(async () => {
      clickButton("Delete")
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain("delete-me.example.com")
    expect(container.textContent).toContain("No per-site rules configured.")
  })

  async function navigateToAbout() {
    await act(async () => {
      clickButton("About")
      await Promise.resolve()
    })
  }

  it("shows remote continuity status for authenticated sessions in About", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await navigateToAbout()

    expect(container.textContent).toContain("Plan, quota, and billing labels live in the popup and web account surfaces")
    expect(container.textContent).toContain("Registered devices: 2 total · 2 active")
    expect(container.textContent).toContain("Config bootstrap: enabled · cursor cfg-3")
    expect(container.textContent).toContain("Optional collections: reading history, study progress")
    expect(container.textContent).toContain("Reading history sync: disabled · optional · sanitized URLs only · cursor none")
    expect(container.textContent).toContain("Study progress sync: disabled · optional · per-page durable progress only · cursor none")
    expect(container.textContent).toContain("Daily study stats stay local on this device")
    expect(container.textContent).toContain("Current device")
    expect(fetchAstraContinuitySnapshotMock).toHaveBeenCalled()
  })

  it("shows Export Settings and Import Settings buttons in the About section", async () => {
    await navigateToAbout()

    const exportBtn = container.querySelector('[data-testid="export-settings-btn"]')
    const importBtn = container.querySelector('[data-testid="import-settings-btn"]')

    expect(exportBtn).not.toBeNull()
    expect(importBtn).not.toBeNull()
  })

  it("calls exportConfig and downloadConfigFile on Export Settings click", async () => {
    await navigateToAbout()

    await act(async () => {
      const btn = container.querySelector('[data-testid="export-settings-btn"]') as HTMLButtonElement
      btn.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(exportConfigMock).toHaveBeenCalled()
    expect(downloadConfigFileMock).toHaveBeenCalledWith('{"_astraBackup":true}')
  })

  it("shows success status after exporting", async () => {
    await navigateToAbout()

    await act(async () => {
      const btn = container.querySelector('[data-testid="export-settings-btn"]') as HTMLButtonElement
      btn.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const status = container.querySelector('[data-testid="backup-status"]')
    expect(status).not.toBeNull()
  })

  it("shows error status when import fails", async () => {
    importConfigMock.mockRejectedValue(new Error("Invalid config file"))

    await navigateToAbout()

    // Simulate file selection by triggering the onChange directly
    await act(async () => {
      const fileInput = container.querySelector('[data-testid="import-file-input"]') as HTMLInputElement
      const file = new File(['{}'], 'bad.json', { type: 'application/json' })
      readConfigFileMock.mockResolvedValue('{}')

      Object.defineProperty(fileInput, 'files', { value: [file], writable: true })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const status = container.querySelector('[data-testid="backup-status"]')
    expect(status).not.toBeNull()
    expect(status?.textContent).toContain("Invalid config file")
  })

  it("updates the reading history continuity toggle from the About section", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await navigateToAbout()

    await act(async () => {
      const toggle = container.querySelector('[data-testid="reading-history-sync-toggle"]') as HTMLInputElement
      toggle.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateAstraSyncCollectionPreferenceMock).toHaveBeenCalledWith(expect.objectContaining({
      collection: "reading_history",
      enabled: true,
    }))
    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalled()
    expect(fetchAstraContinuitySnapshotMock).toHaveBeenCalledTimes(2)
  })

  it("updates the study progress continuity toggle from the About section", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await navigateToAbout()

    await act(async () => {
      const toggle = container.querySelector('[data-testid="study-progress-sync-toggle"]') as HTMLInputElement
      toggle.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateAstraSyncCollectionPreferenceMock).toHaveBeenCalledWith(expect.objectContaining({
      collection: "study_progress",
      enabled: true,
    }))
    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalled()
    expect(fetchAstraContinuitySnapshotMock).toHaveBeenCalledTimes(2)
  })

  it("refreshes continuity status from the About section", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await navigateToAbout()

    await act(async () => {
      const refreshButton = container.querySelector('[data-testid="refresh-continuity-btn"]') as HTMLButtonElement
      refreshButton.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchAstraContinuitySnapshotMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("latest pull 0 deltas")
  })

  it("revokes another device from the About continuity section", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
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
        lastRequestAt: "2026-04-09T00:00:00.000Z",
        recentEvents: [],
      },
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
    })

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await navigateToAbout()

    await act(async () => {
      const revokeButton = container.querySelector('[data-testid="continuity-device-list"] .astra-btn-danger') as HTMLButtonElement
      revokeButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      const revokeButtons = Array.from(container.querySelectorAll("button")).filter((button) => button.textContent === "Revoke access")
      const confirmButton = revokeButtons.at(-1) as HTMLButtonElement
      confirmButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(revokeAstraDeviceMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      targetDeviceId: "device-456",
    })
    expect(container.textContent).toContain("Already revoked")
  })
})
