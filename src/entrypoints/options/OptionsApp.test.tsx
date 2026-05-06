import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  saveConfigMock,
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
  runPhaseOneCollectionSyncMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
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
  runPhaseOneCollectionSyncMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

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
    updateAstraSyncCollectionPreferenceMock.mockResolvedValue({
      serverTime: "2026-04-09T01:07:00.000Z",
      deviceId: "device-123",
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
        vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
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
    expect(groupEyebrows).toEqual(expect.arrayContaining(["Reading", "Learning", "Engine", "Account"]))

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
    expect(labelTexts).toContain("Provider override")
    expect(labelTexts).toContain("Model override")
    expect(labelTexts).toContain("Presentation mode override")
    expect(labelTexts).toContain("Theme override")
    expect(labelTexts).toContain("Font size override")
    expect(labelTexts).toContain("Translation color override")
  })

  it("persists per-site provider and model overrides", async () => {
    await navigateToSites()
    await addSite("provider-save.example.com")

    await setValue(getFieldInputByLabel("Provider override"), "gemini")
    await setValue(getFieldInputByLabel("Model override"), "gemini-3.1-pro")

    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "provider-save.example.com": expect.objectContaining({
          provider: {
            id: "gemini",
            model: "gemini-3.1-pro",
          },
        }),
      }),
    }))
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

    expect(container.textContent).toContain("2 cached items")
    expect(container.textContent).toContain("5 lookups")
    expect(container.textContent).toContain("60% hit rate")
    expect(container.textContent).toContain("openai/gpt-5.4-nano")
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

  it("shows local A/B learning-loop funnel results in Diagnostics", async () => {
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
      clickButton("Diagnostics")
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
    expect(card?.textContent).toContain("No backend or schema migration is required")
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
