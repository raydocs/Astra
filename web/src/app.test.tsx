import "fake-indexeddb/auto"
import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  extractPdfPagesMock: vi.fn(),
  epubFactoryMock: vi.fn(),
  readWebSessionMock: vi.fn(),
  refreshWebSessionMock: vi.fn(),
  createWebSessionMock: vi.fn(),
  createWebAnonymousSessionMock: vi.fn(),
  saveWebSessionMock: vi.fn((session) => session),
  fetchWebAccountWorkspaceMock: vi.fn(),
  fetchWebCloudAssetsMock: vi.fn(),
  fetchWebImportQueueObservabilityMock: vi.fn(),
  translateWithWebRelayMock: vi.fn(),
  ensureWebDeviceIdentityMock: vi.fn(),
  mergeWebConfigMock: vi.fn((current, patch) => ({
    ...current,
    ...patch,
    provider: {
      ...current.provider,
      ...(patch?.provider ?? {}),
    },
  })),
  readTextTransferDraftMock: vi.fn(() => null),
  clearTextTransferDraftMock: vi.fn(),
  saveTextTransferDraftMock: vi.fn(),
  revokeWebDeviceMock: vi.fn(),
  revokeWebSessionMock: vi.fn(),
  clearWebSessionMock: vi.fn(),
  saveApiBaseUrlMock: vi.fn((value: string) => value?.trim() || "http://127.0.0.1:8787/v1"),
  openBillingCheckoutMock: vi.fn(),
  openBillingPortalMock: vi.fn(),
  updateWebSyncCollectionPreferenceMock: vi.fn(),
  replayWebImportJobsMock: vi.fn(),
  createWebContinuityExportMock: vi.fn(),
  fetchWebContinuityExportJobMock: vi.fn(),
  downloadWebContinuityExportMock: vi.fn(),
  createWebCloudDataDeleteMock: vi.fn(),
  fetchWebCloudDataDeleteJobMock: vi.fn(),
  repairWebCloudSyncMock: vi.fn(),
  createWebVideoNoteJobMock: vi.fn(),
  fetchWebVideoNoteJobMock: vi.fn(),
  fetchWebVideoNoteArtifactMock: vi.fn(),
}))

vi.mock("@/entrypoints/pdf-reader/pdf-extractor", () => ({
  extractPdfPages: mocks.extractPdfPagesMock,
}))

vi.mock("epubjs", () => ({
  default: mocks.epubFactoryMock,
}))

vi.mock("./lib/astra-web", () => ({
  clearTextTransferDraft: mocks.clearTextTransferDraftMock,
  clearWebSession: mocks.clearWebSessionMock,
  createWebAnonymousSession: mocks.createWebAnonymousSessionMock,
  createWebSession: mocks.createWebSessionMock,
  ensureWebDeviceIdentity: mocks.ensureWebDeviceIdentityMock,
  fetchWebAccountWorkspace: mocks.fetchWebAccountWorkspaceMock,
  fetchWebCloudAssets: mocks.fetchWebCloudAssetsMock,
  fetchWebImportQueueObservability: mocks.fetchWebImportQueueObservabilityMock,
  fetchWebContinuityExportJob: mocks.fetchWebContinuityExportJobMock,
  fetchWebCloudDataDeleteJob: mocks.fetchWebCloudDataDeleteJobMock,
  createWebVideoNoteJob: mocks.createWebVideoNoteJobMock,
  fetchWebVideoNoteJob: mocks.fetchWebVideoNoteJobMock,
  fetchWebVideoNoteArtifact: mocks.fetchWebVideoNoteArtifactMock,
  createWebContinuityExport: mocks.createWebContinuityExportMock,
  repairWebCloudSync: mocks.repairWebCloudSyncMock,
  createWebCloudDataDelete: mocks.createWebCloudDataDeleteMock,
  downloadWebContinuityExport: mocks.downloadWebContinuityExportMock,
  mergeWebConfig: mocks.mergeWebConfigMock,
  normalizeApiBaseUrl: (value: string | null | undefined) => value?.trim() || "http://127.0.0.1:8787/v1",
  openBillingCheckout: mocks.openBillingCheckoutMock,
  openBillingPortal: mocks.openBillingPortalMock,
  readApiBaseUrl: () => "http://127.0.0.1:8787/v1",
  readArticleImportBaseUrl: () => "http://127.0.0.1:8787/v1",
  readTextTransferDraft: mocks.readTextTransferDraftMock,
  readWebConfig: () => ({
    connectionMode: "astra",
    targetLang: "zh-CN",
    provider: {
      id: "openai",
      model: "gpt-5.4-nano",
      accessToken: "",
      apiKey: "",
    },
    languageLevel: null,
    tts: {},
    presentation: {},
    sites: {},
    customActions: [],
  }),
  readWebSession: mocks.readWebSessionMock,
  refreshWebSession: mocks.refreshWebSessionMock,
  revokeWebDevice: mocks.revokeWebDeviceMock,
  revokeWebSession: mocks.revokeWebSessionMock,
  saveApiBaseUrl: mocks.saveApiBaseUrlMock,
  saveTextTransferDraft: mocks.saveTextTransferDraftMock,
  saveWebSession: mocks.saveWebSessionMock,
  translateWithWebRelay: mocks.translateWithWebRelayMock,
  updateWebSyncCollectionPreference: mocks.updateWebSyncCollectionPreferenceMock,
  replayWebImportJobs: mocks.replayWebImportJobsMock,
}))

import { AstraWebApp } from "./app"
import { clearAllPersistedWorkspaces, saveArticleWorkspace, savePdfWorkspace } from "./lib/workspace-store"

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    sessionToken: "session-token",
    sessionId: null,
    deviceId: "device-123",
    identityMode: "authenticated",
    relayBaseURL: "http://127.0.0.1:8787/v1",
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
      totalCharacters: 12,
      dailyRequestsUsed: 1,
      dailyCharactersUsed: 12,
      lastRequestAt: "2026-04-09T00:00:00.000Z",
      recentEvents: [],
    },
    issuedAt: "2026-04-09T00:00:00.000Z",
    expiresAt: "2026-04-10T00:00:00.000Z",
    ...overrides,
  }
}

function createWorkspace() {
  return {
    account: {
      id: "usr_demo",
      relayBaseURL: "http://127.0.0.1:8787/v1",
      email: "user@example.com",
      billingEmail: "billing@example.com",
      createdAt: "2026-04-01T00:00:00.000Z",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
    },
    usage: {
      generatedAt: "2026-04-09T00:00:00.000Z",
      quota: {
        dailyRequestsLimit: 2000,
        dailyCharactersLimit: 500000,
        requestsPerMinuteLimit: 120,
        remainingDailyRequests: 1998,
        remainingDailyCharacters: 499900,
      },
      usage: {
        totalRequests: 2,
        totalCharacters: 100,
        dailyRequestsUsed: 2,
        dailyCharactersUsed: 100,
        lastRequestAt: "2026-04-09T01:00:00.000Z",
        recentEvents: [],
      },
    },
    devices: [
      {
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "web",
        appVersion: "0.1.0-web",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      },
      {
        deviceId: "device-remote",
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
      },
    ],
  }
}

function createCloudAssets(overrides: Record<string, unknown> = {}) {
  return {
    serverTime: "2026-04-09T01:15:00.000Z",
    fetchedAt: "2026-04-09T01:16:00.000Z",
    bootstrap: {
      config: { enabled: true, defaultEnabled: true, cursor: "cfg-1" },
      vocabulary: { enabled: true, defaultEnabled: true, cursor: "vocab-1" },
      reading_history: { enabled: true, defaultEnabled: false, cursor: "history-1" },
      study_progress: { enabled: true, defaultEnabled: false, cursor: "study-1" },
    },
    config: {
      enabled: true,
      defaultEnabled: true,
      cursor: "cfg-2",
      recordCount: 2,
      syncedConfig: {
        version: 1,
        targetLang: "ja",
        connectionMode: "astra",
        hoverTrigger: "alt",
        contentScope: "page",
        inputTranslation: "enabled",
        inputTranslationMode: "replace",
        languageLevel: "intermediate",
        privacyMode: false,
        provider: {
          id: "gemini",
          model: "gemini-3.1-flash-lite-preview",
        },
        tts: {
          enabled: true,
          engine: "browser",
          rate: 0.9,
          pitch: 1.0,
          highlightSentences: true,
        },
        presentation: {
          mode: "bilingual",
          theme: "default",
          fontSize: 0.92,
          translationColor: "#64748b",
        },
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
        customActions: [
          {
            id: "explain",
            label: "Explain",
            labelZh: "解释",
            systemPrompt: "Explain clearly",
            enabled: true,
          },
        ],
      },
    },
    vocabulary: {
      enabled: true,
      defaultEnabled: true,
      cursor: "vocab-2",
      count: 1,
      entries: [
        {
          id: "vocab-1",
          text: "serendipity",
          translation: "机缘巧合",
          hostname: "example.com",
          savedAt: 1_775_692_800_000,
        },
      ],
    },
    readingHistory: {
      enabled: true,
      defaultEnabled: false,
      cursor: "history-2",
      count: 1,
      entries: [
        {
          id: "https://example.com/article",
          url: "https://example.com/article",
          hostname: "example.com",
          title: "Edge reading article",
          wordsTranslated: 321,
          visitedAt: 1_775_692_900_000,
        },
      ],
    },
    studyProgress: {
      enabled: true,
      defaultEnabled: false,
      cursor: "study-2",
      pageCount: 1,
      pages: [
        {
          url: "https://example.com/article",
          hostname: "example.com",
          title: "Edge reading article",
          completedSteps: ["read", "guided_read", "explain"],
          sentencesExplained: 4,
          vocabSaved: 2,
          startedAt: 1_775_692_700_000,
          lastActivityAt: 1_775_692_950_000,
        },
      ],
      stepCoverage: {
        read: 1,
        guided_read: 1,
        explain: 1,
        vocab_save: 0,
        vocab_review: 0,
      },
    },
    syncHealth: {
      activeDeviceCount: 2,
      totalDeviceCount: 2,
      currentDeviceLastSyncAt: "2026-04-09T01:05:00.000Z",
      maxMutationsPerRequest: 500,
      collections: [
        { key: "config", enabled: true, defaultEnabled: true, cursor: "cfg-2", mutationCount: 2, activeCount: 2 },
        { key: "vocabulary", enabled: true, defaultEnabled: true, cursor: "vocab-2", mutationCount: 1, activeCount: 1 },
        { key: "reading_history", enabled: true, defaultEnabled: false, cursor: "history-2", mutationCount: 1, activeCount: 1 },
        { key: "study_progress", enabled: true, defaultEnabled: false, cursor: "study-2", mutationCount: 1, activeCount: 1 },
      ],
    },
    deferredCollections: [],
    ...overrides,
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderApp() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = ReactDOM.createRoot(container)

  await act(async () => {
    root.render(<AstraWebApp />)
  })
  await flush()

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function clickButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement | undefined
  expect(button).toBeTruthy()
  act(() => {
    button!.click()
  })
}

function clickSubmitButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button[type='submit']")).find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement | undefined
  expect(button).toBeTruthy()
  act(() => {
    button!.click()
  })
}

function setInputValue(container: HTMLElement, labelText: string, value: string) {
  const label = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(labelText))
  expect(label).toBeTruthy()
  const input = label!.querySelector("input, textarea, select") as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  expect(input).toBeTruthy()
  act(() => {
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
    valueSetter?.call(input, value)
    input!.dispatchEvent(new Event("input", { bubbles: true }))
    input!.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

function createTestFile(contents: string, name: string, type: string): File {
  const file = new File([contents], name, { type })
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => new TextEncoder().encode(contents).buffer,
  })
  Object.defineProperty(file, "text", {
    configurable: true,
    value: async () => contents,
  })
  return file
}

async function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  })

  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await flush()
}

describe("AstraWebApp smoke", () => {
  beforeEach(async () => {
    vi.restoreAllMocks()

    const storage = new Map<string, string>()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
        clear: () => {
          storage.clear()
        },
      },
    })
    vi.stubGlobal("confirm", vi.fn(() => true))

    window.localStorage.clear()
    await clearAllPersistedWorkspaces()
    window.location.hash = "#/"
    document.body.innerHTML = ""
    document.head.innerHTML = ""

    mocks.extractPdfPagesMock.mockReset()
    mocks.epubFactoryMock.mockReset()
    mocks.readWebSessionMock.mockReset()
    mocks.refreshWebSessionMock.mockReset()
    mocks.createWebSessionMock.mockReset()
    mocks.createWebAnonymousSessionMock.mockReset()
    mocks.saveWebSessionMock.mockClear()
    mocks.fetchWebAccountWorkspaceMock.mockReset()
    mocks.fetchWebCloudAssetsMock.mockReset()
    mocks.fetchWebImportQueueObservabilityMock.mockReset()
    mocks.translateWithWebRelayMock.mockReset()
    mocks.ensureWebDeviceIdentityMock.mockReset()
    mocks.mergeWebConfigMock.mockClear()
    mocks.readTextTransferDraftMock.mockReset()
    mocks.clearTextTransferDraftMock.mockReset()
    mocks.saveTextTransferDraftMock.mockReset()
    mocks.revokeWebDeviceMock.mockReset()
    mocks.revokeWebSessionMock.mockReset()
    mocks.clearWebSessionMock.mockReset()
    mocks.saveApiBaseUrlMock.mockClear()
    mocks.updateWebSyncCollectionPreferenceMock.mockReset()
    mocks.replayWebImportJobsMock.mockReset()
    mocks.createWebContinuityExportMock.mockReset()
    mocks.fetchWebContinuityExportJobMock.mockReset()
    mocks.downloadWebContinuityExportMock.mockReset()
    mocks.createWebCloudDataDeleteMock.mockReset()
    mocks.fetchWebCloudDataDeleteJobMock.mockReset()
    mocks.repairWebCloudSyncMock.mockReset()
    mocks.createWebVideoNoteJobMock.mockReset()
    mocks.fetchWebVideoNoteJobMock.mockReset()
    mocks.fetchWebVideoNoteArtifactMock.mockReset()

    mocks.readWebSessionMock.mockReturnValue(null)
    mocks.fetchWebAccountWorkspaceMock.mockResolvedValue(createWorkspace())
    mocks.fetchWebCloudAssetsMock.mockResolvedValue(createCloudAssets())
    mocks.fetchWebImportQueueObservabilityMock.mockResolvedValue({
      fetchedAt: "2026-04-09T01:20:00.000Z",
      requestId: "req-123",
      environment: "test",
      articleImport: {
        defaultMode: "proxy",
        queuePolicy: { maxAttempts: 3, operatorReplayEnabled: true },
        backlog: { queued: 2, failed: 1, deadLettered: 1, oldestQueuedAgeMs: 2500 },
        routeCounts: { proxy: 3 },
        statusCounts: { queued: 2, failed: 1, dead_lettered: 1 },
        surfaceCounts: { web: 4 },
        recentFailures: [],
      },
    })
    mocks.updateWebSyncCollectionPreferenceMock.mockResolvedValue(undefined)
    mocks.createWebContinuityExportMock.mockResolvedValue({
      jobId: "exp_job_1",
      scope: { collections: ["config", "vocabulary", "reading_history", "study_progress"] },
      status: "queued",
      requestedAt: "2026-04-11T12:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
      expiresAt: null,
      artifact: { objectKey: null, sha256: null, bytes: null, downloadPath: null },
      error: null,
      policy: {
        exportArtifactRetentionDays: 7,
        deleteGracePeriodSeconds: 604800,
        jobHistoryRetentionDays: 90,
        tombstoneRetentionDays: 30,
      },
    })
    mocks.fetchWebContinuityExportJobMock.mockResolvedValue({
      jobId: "exp_job_1",
      scope: { collections: ["config", "vocabulary", "reading_history", "study_progress"] },
      status: "completed",
      requestedAt: "2026-04-11T12:00:00.000Z",
      startedAt: "2026-04-11T12:00:10.000Z",
      completedAt: "2026-04-11T12:00:20.000Z",
      failedAt: null,
      expiresAt: "2026-04-18T12:00:20.000Z",
      artifact: {
        objectKey: "continuity-exports/2026-04-11/exp_job_1.json",
        sha256: "abc123",
        bytes: 256,
        downloadPath: "/v1/account/export/exp_job_1/download",
      },
      error: null,
      policy: {
        exportArtifactRetentionDays: 7,
        deleteGracePeriodSeconds: 604800,
        jobHistoryRetentionDays: 90,
        tombstoneRetentionDays: 30,
      },
    })
    mocks.downloadWebContinuityExportMock.mockResolvedValue(new Blob(["{}"], { type: "application/json" }))
    mocks.createWebCloudDataDeleteMock.mockResolvedValue({
      jobId: "del_job_1",
      scope: { collections: ["vocabulary", "reading_history", "study_progress"] },
      status: "scheduled",
      requestedAt: "2026-04-11T12:00:00.000Z",
      scheduledForAt: "2026-04-18T12:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
      canceledAt: null,
      gracePeriodSeconds: 604800,
      deletedRecords: {},
      error: null,
      policy: {
        exportArtifactRetentionDays: 7,
        deleteGracePeriodSeconds: 604800,
        jobHistoryRetentionDays: 90,
        tombstoneRetentionDays: 30,
      },
    })
    mocks.fetchWebCloudDataDeleteJobMock.mockResolvedValue({
      jobId: "del_job_1",
      scope: { collections: ["vocabulary", "reading_history", "study_progress"] },
      status: "completed",
      requestedAt: "2026-04-11T12:00:00.000Z",
      scheduledForAt: "2026-04-18T12:00:00.000Z",
      startedAt: "2026-04-18T12:00:10.000Z",
      completedAt: "2026-04-18T12:00:20.000Z",
      failedAt: null,
      canceledAt: null,
      gracePeriodSeconds: 604800,
      deletedRecords: { vocabulary: 1, reading_history: 2, study_progress: 3 },
      error: null,
      policy: {
        exportArtifactRetentionDays: 7,
        deleteGracePeriodSeconds: 604800,
        jobHistoryRetentionDays: 90,
        tombstoneRetentionDays: 30,
      },
    })
    mocks.replayWebImportJobsMock.mockResolvedValue({
      dryRun: true,
      requestId: "replay-1",
      summary: { selected: 1, replayed: 0, skipped: 1 },
    })
    mocks.repairWebCloudSyncMock.mockResolvedValue({
      serverTime: "2026-04-11T12:05:00.000Z",
      collections: {
        config: { enabled: true, defaultEnabled: true, latestCursor: "cfg-4", compactionFloorCursor: "cfg-2", records: [{ recordId: "global", payload: { kind: "global" }, lastClientMutationId: "cfg-4", lastDeviceId: "device-123", lastServerUpdatedAt: "2026-04-11T12:04:00.000Z", cursor: "cfg-4" }] },
        vocabulary: { enabled: true, defaultEnabled: true, latestCursor: "vocab-2", compactionFloorCursor: null, records: [{ recordId: "vocab-1", payload: { text: "serendipity" }, lastClientMutationId: "voc-2", lastDeviceId: "device-123", lastServerUpdatedAt: "2026-04-11T12:04:00.000Z", cursor: "voc-2" }] },
        reading_history: { enabled: true, defaultEnabled: false, latestCursor: "history-2", compactionFloorCursor: null, records: [] },
        study_progress: { enabled: true, defaultEnabled: false, latestCursor: "study-2", compactionFloorCursor: null, records: [] },
      },
    })
    mocks.ensureWebDeviceIdentityMock.mockReturnValue({
      version: 1,
      deviceId: "device-123",
      label: "Chrome on macOS",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "web",
      appVersion: "0.1.0-web",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    })
    mocks.revokeWebDeviceMock.mockResolvedValue([
      {
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "web",
        appVersion: "0.1.0-web",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      },
      {
        deviceId: "device-remote",
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
    mocks.translateWithWebRelayMock.mockResolvedValue({
      ok: true,
      translations: ["translated:hello world"],
      providerId: "openai",
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders direct public sign-in route", async () => {
    window.location.hash = "#/sign-in"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Welcome back.")
    expect(container.textContent).toContain("Continue with email")
    expect(container.textContent).toContain("Relay endpoint")
    expect(container.querySelector(".public-site--signin-cert")).toBeFalsy()
    expect(container.querySelector("input[type='password']")).toBeTruthy()
    expect(container.textContent).not.toContain("Text translation workspace")

    await unmount()
  })

  it("renders the cert-only landing diagnostic without leaking into normal public landing", async () => {
    window.location.hash = "#/?astraCert=1"

    let render = await renderApp()

    expect(render.container.querySelector(".public-site--landing-cert")).toBeTruthy()
    expect(render.container.textContent).toContain("What's broken on the current page")
    expect(render.container.textContent).toContain("Three quiet problems")
    expect(render.container.textContent).toContain("Three corresponding moves")
    expect(render.container.textContent).not.toContain("Use instantly")
    expect(render.container.textContent).not.toContain("Sign in to sync")
    expect(mocks.createWebAnonymousSessionMock).not.toHaveBeenCalled()

    await render.unmount()
    window.location.hash = "#/"
    render = await renderApp()

    expect(render.container.querySelector(".public-site--landing-cert")).toBeFalsy()
    expect(render.container.textContent).toContain("A bilingual reading room")
    expect(render.container.textContent).toContain("Use instantly")
    expect(render.container.textContent).not.toContain("What's broken on the current page")

    await render.unmount()
  })

  it("renders the cert-only sign-in screenshot variant without normal-mode sign-in controls", async () => {
    const session = createSession({ email: "private@example.com" })
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.localStorage.setItem("astra.web.account-prefs.v1", JSON.stringify({ lastEmail: "private@example.com" }))
    window.location.hash = "#/sign-in?astraCert=1"

    const { container, unmount } = await renderApp()

    expect(container.querySelector(".public-site--signin-cert")).toBeTruthy()
    expect(container.textContent).toContain("Welcome back.")
    expect(container.textContent).not.toContain("Already signed in")
    expect((container.querySelector("input[type='email']") as HTMLInputElement | null)?.value).toBe("rui@thequietreader.com")
    expect(container.querySelector("input[type='password']")).toBeNull()
    expect(container.textContent).not.toContain("Password")
    expect(container.textContent).not.toContain("Relay endpoint")
    expect(container.textContent).toContain("Continue with Google")

    await act(async () => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      clickButton(container, "Astra works without one.")
    })
    await flush()

    expect(mocks.createWebSessionMock).not.toHaveBeenCalled()
    expect(mocks.createWebAnonymousSessionMock).not.toHaveBeenCalled()

    await unmount()
  })

  it("navigates from the public Sign in action to the sign-in route", async () => {
    window.location.hash = "#/"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Sign in")
    })
    await flush()

    expect(window.location.hash).toBe("#/sign-in")
    expect(container.textContent).toContain("Welcome back.")

    await unmount()
  })

  it("exposes accessible password toggle and field validation on the public sign-in route", async () => {
    window.location.hash = "#/sign-in"

    const { container, unmount } = await renderApp()

    const toggle = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.getAttribute("aria-label") === "Show password") as HTMLButtonElement | undefined
    expect(toggle).toBeTruthy()
    expect(toggle?.getAttribute("aria-pressed")).toBe("false")

    await act(async () => {
      toggle!.click()
    })
    await flush()

    const toggled = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.getAttribute("aria-label") === "Hide password") as HTMLButtonElement | undefined
    expect(toggled).toBeTruthy()
    expect(toggled?.getAttribute("aria-pressed")).toBe("true")

    await act(async () => {
      clickSubmitButton(container, "Continue with email")
    })
    await flush()

    expect(container.querySelector("[role='alert']")).toBeNull()
    const emailInput = container.querySelector("input[type='email']")
    const passwordInput = container.querySelector("input[type='text']")
    expect(emailInput?.getAttribute("aria-invalid")).toBe("true")
    expect(emailInput?.getAttribute("aria-describedby")).toBe("public-sign-in-email-error")
    expect(passwordInput?.getAttribute("aria-invalid")).toBe("true")
    expect(passwordInput?.getAttribute("aria-describedby")).toBe("public-sign-in-password-error")
    expect(container.textContent).toContain("Email is required.")
    expect(container.textContent).toContain("Password is required.")

    await unmount()
  })

  it("surfaces invalid relay endpoint as a card-level sign-in error", async () => {
    mocks.saveApiBaseUrlMock.mockImplementationOnce(() => {
      throw new Error("Invalid Astra API base URL.")
    })
    window.location.hash = "#/sign-in"

    const { container, unmount } = await renderApp()

    setInputValue(container, "Astra API base URL", "not-a-valid-relay")
    setInputValue(container, "Email", "user@example.com")
    setInputValue(container, "Password", "secret-pass")

    await act(async () => {
      clickSubmitButton(container, "Continue with email")
    })
    await flush()

    const alert = container.querySelector("[role='alert']")
    expect(alert?.textContent).toContain("Invalid Astra API base URL.")
    expect(alert?.getAttribute("aria-live")).toBe("assertive")
    expect(mocks.createWebSessionMock).not.toHaveBeenCalled()

    await unmount()
  })

  it("signs in from the public sign-in route and routes to the text workspace", async () => {
    mocks.createWebSessionMock.mockResolvedValue(createSession())
    window.location.hash = "#/sign-in"

    const { container, unmount } = await renderApp()

    setInputValue(container, "Astra API base URL", "https://relay.example/v1")
    setInputValue(container, "Email", "user@example.com")
    setInputValue(container, "Password", "secret-pass")

    await act(async () => {
      clickSubmitButton(container, "Continue with email")
    })
    await flush()

    expect(mocks.createWebSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://relay.example/v1",
      email: "user@example.com",
      password: "secret-pass",
    }))
    expect(container.textContent).toContain("Signed in to Astra Web Companion.")
    expect(container.textContent).toContain("Text translation workspace")

    await unmount()
  })

  it("starts a public free session and routes to the text workspace", async () => {
    mocks.createWebAnonymousSessionMock.mockResolvedValue(createSession({ identityMode: "anonymous", email: "anonymous@astra.local" }))
    window.location.hash = "#/"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Use instantly")
    })
    await flush()

    expect(mocks.createWebAnonymousSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "http://127.0.0.1:8787/v1",
    }))
    expect(container.textContent).toContain("Free Astra session is ready. Translation uses the managed Astra relay.")
    expect(container.textContent).toContain("Text translation workspace")

    await unmount()
  })

  it("shows an already signed-in state when revisiting the public sign-in route", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/sign-in"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Already signed in")
    expect(container.textContent).toContain("Open workspace")
    expect(container.querySelector("input[type='email']")).toBeNull()

    await unmount()
  })

  it("signs in and routes to the text workspace", async () => {
    mocks.createWebSessionMock.mockResolvedValue(createSession())
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    setInputValue(container, "Email", "user@example.com")
    setInputValue(container, "Password", "secret-pass")

    await act(async () => {
      clickButton(container, "Sign in")
    })
    await flush()

    expect(mocks.createWebSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      email: "user@example.com",
      password: "secret-pass",
    }))
    expect(container.textContent).toContain("Signed in to Astra Web Companion.")
    expect(container.textContent).toContain("Text translation workspace")

    await unmount()
  })

  it("runs text translation with a restored session", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/text"

    const { container, unmount } = await renderApp()

    setInputValue(container, "Source text", "hello world")

    await act(async () => {
      clickButton(container, "Run task")
    })
    await flush()

    expect(mocks.refreshWebSessionMock).toHaveBeenCalledTimes(1)
    expect(mocks.translateWithWebRelayMock).toHaveBeenCalled()
    expect(container.textContent).toContain("translated:hello world")

    await unmount()
  })

  it("revokes a remote device from the account workspace", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Revoke access")
    })
    await flush()

    expect(mocks.revokeWebDeviceMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      sessionToken: "session-token",
      currentDeviceId: "device-123",
      targetDeviceId: "device-remote",
    })
    expect(container.textContent).toContain("Revoked Firefox on Windows.")
    expect(container.textContent).toContain("Use remote revoke only for other active devices.")
    expect(container.textContent).toContain("Already revoked")

    await unmount()
  })

  it("creates continuity export and schedules a cloud delete from the account workspace", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Create export")
    })
    await flush()

    expect(mocks.createWebContinuityExportMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
      collections: ["config", "vocabulary", "reading_history", "study_progress"],
      idempotencyKey: expect.stringContaining("web-export-device-123-"),
    })
    expect(container.textContent).toContain("Continuity export queued.")
    expect(container.textContent).toContain("Queued in the lifecycle worker.")

    await act(async () => {
      clickButton(container, "Schedule delete")
    })
    await flush()

    expect(mocks.createWebCloudDataDeleteMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
      collections: ["vocabulary", "reading_history", "study_progress"],
      idempotencyKey: expect.stringContaining("web-cloud-delete-device-123-"),
    })
    expect(container.textContent).toContain("Cloud delete scheduled.")
    expect(container.textContent).toContain("Deletion is scheduled for")
    expect(container.textContent).toContain("Cloud delete: `scheduled` is not deletion yet.")

    await unmount()
  })

  it("runs manual sync repair from the account workspace", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Run sync repair")
    })
    await flush()

    expect(mocks.repairWebCloudSyncMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })
    expect(mocks.fetchWebCloudAssetsMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Cloud sync repair refreshed 2 materialized records across 4 collections.")
    expect(container.textContent).toContain("Persistent auth/cursor failures need operator follow-up")
    expect(container.textContent).toContain("compaction floors observed")

    await unmount()
  })

  it("shows actionable revoke guidance when remote device revoke fails", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    mocks.revokeWebDeviceMock.mockRejectedValue(new Error("DEVICE_NOT_FOUND"))
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Revoke access")
    })
    await flush()

    expect(container.textContent).toContain("Device revoke failed. DEVICE_NOT_FOUND Refresh the device list once before retrying")
    expect(container.textContent).toContain("Use remote revoke only for other active devices.")

    await unmount()
  })

  it("shows destructive lifecycle guidance when cloud delete scheduling fails", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    mocks.createWebCloudDataDeleteMock.mockRejectedValue(new Error("LIFECYCLE_QUEUE_UNAVAILABLE"))
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Schedule delete")
    })
    await flush()

    expect(container.textContent).toContain("Cloud delete scheduling failed. LIFECYCLE_QUEUE_UNAVAILABLE")
    expect(container.textContent).toContain("Destructive deletes stay scheduled until the grace window expires")
    expect(container.textContent).toContain("Cloud delete: `scheduled` is not deletion yet.")

    await unmount()
  })

  it("shows reading history, study progress, and sync health cloud surfaces on the account page", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(mocks.fetchWebCloudAssetsMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })
    expect(container.textContent).toContain("Pro plan")
    expect(container.textContent).toContain("Active")
    expect(container.textContent).toContain("Server-backed account summary for the current signed-in device.")
    expect(container.textContent).toContain("Plan, status, and quota prefer /v1/account/summary.")
    expect(container.textContent).toContain("Synced cloud assets")
    expect(container.textContent).toContain("Synced config")
    expect(container.textContent).toContain("gemini")
    expect(container.textContent).toContain("Synced vocabulary")
    expect(container.textContent).toContain("serendipity")
    expect(container.textContent).toContain("Reading history")
    expect(container.textContent).toContain("Edge reading article")
    expect(container.textContent).toContain("Optional behavioral sync")
    expect(container.textContent).toContain("Study progress")
    expect(container.textContent).toContain("Per-page sync only")
    expect(container.textContent).toContain("Sync health")
    expect(container.textContent).toContain("Mutation budget")

    await unmount()
  })

  it("shows the overview cloud snapshot and saved workspace library", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/"

    await saveArticleWorkspace({
      url: "https://example.com/readable",
      title: "Readable Import Title",
      hostname: "example.com",
      byline: "Astra Writer",
      scope: "article",
      summary: "Short readable summary",
      blocks: ["First paragraph"],
      importedAt: "2026-04-09T00:00:00.000Z",
    })
    await savePdfWorkspace({
      fileName: "guide.pdf",
      sizeLabel: "120 KB",
      pageCount: 7,
      selectedPageNumber: 1,
      pages: [{ pageNumber: 1, excerpt: "Intro", blocks: ["Intro"], blockCount: 1, wordCount: 1 }],
      importedAt: "2026-04-09T02:00:00.000Z",
    })

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Pro plan")
    expect(container.textContent).toContain("Astra account summary")
    expect(container.textContent).toContain("account summary, devices, and sync state")
    expect(container.textContent).toContain("Cloud console snapshot")
    expect(container.textContent).toContain("This is the latest fetched snapshot")
    expect(container.textContent).toContain("Saved workspace library")
    expect(container.textContent).toContain("local resume surface")
    expect(container.textContent).toContain("guide.pdf")
    expect(container.textContent).toContain("Readable Import Title")

    await unmount()
  })

  it("shows sync-off boundary copy for disabled behavioral collections", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    mocks.fetchWebCloudAssetsMock.mockResolvedValue(createCloudAssets({
      readingHistory: {
        enabled: false,
        defaultEnabled: false,
        cursor: null,
        count: 0,
        entries: [],
      },
      studyProgress: {
        enabled: false,
        defaultEnabled: false,
        cursor: null,
        pageCount: 0,
        pages: [],
        stepCoverage: { read: 0, guided_read: 0, explain: 0, vocab_save: 0, vocab_review: 0 },
      },
    }))
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Reading history sync is off")
    expect(container.textContent).toContain("Study progress sync is off")

    await unmount()
  })

  it("supports optional collection controls from the account cloud console", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    await act(async () => {
      clickButton(container, "Disable sync")
    })
    await flush()

    expect(mocks.updateWebSyncCollectionPreferenceMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
      collection: "reading_history",
      enabled: false,
    })

    await unmount()
  })

  it("renders the asset detail route with cloud and queue sections", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/assets"

    await saveArticleWorkspace({
      url: "https://example.com/readable",
      title: "Readable Import Title",
      hostname: "example.com",
      byline: "Astra Writer",
      scope: "article",
      summary: "Short readable summary",
      blocks: ["First paragraph"],
      importedAt: "2026-04-09T00:00:00.000Z",
    })

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Cloud and local asset detail pages")
    expect(container.textContent).toContain("Reading history asset details")
    expect(container.textContent).toContain("Import queue status details")
    expect(container.textContent).toContain("Readable Import Title")

    await unmount()
  })

  it("renders Work item 5 workspace row templates and accessible dropzones", async () => {
    window.location.hash = "#/files/pdf"
    let render = await renderApp()

    expect(render.container.textContent).toContain("/files/pdf")
    expect(render.container.textContent).toContain("PDFs")
    const pdfDropzone = render.container.querySelector("label.dropzone[aria-label*='Choose PDF']") as HTMLElement | null
    expect(pdfDropzone).toBeTruthy()
    const pdfInput = render.container.querySelector("input#workspace-file-pdf") as HTMLInputElement | null
    expect(pdfInput?.getAttribute("accept")).toBe(".pdf")
    expect(render.container.querySelector(".web-workspace-cert-shell")).toBeFalsy()
    expect(render.container.textContent).not.toContain("Calvino · Six memos for the next millennium.pdf")

    await render.unmount()
    window.location.hash = "#/assets"
    render = await renderApp()

    expect(render.container.querySelector(".asset-grid")).toBeTruthy()
    expect(render.container.textContent).toContain("+ new asset")
    expect(render.container.querySelector(".web-workspace-cert-shell")).toBeFalsy()
    expect(render.container.textContent).not.toContain("marginalia · saved deck")

    await render.unmount()
  })

  it("renders cert-only populated web PDF and asset fixtures without normal-mode leakage", async () => {
    window.location.hash = "#/files/pdf?astraCert=1"
    let render = await renderApp()

    expect(render.container.querySelector(".workspace-surfaces-cert-page")).toBeTruthy()
    expect(render.container.textContent).toContain("The Library row template, four ways.")
    expect(render.container.textContent).toContain("/files/pdf")
    expect(render.container.textContent).toContain("/files/epub")
    expect(render.container.textContent).toContain("/files/subtitles")
    expect(render.container.textContent).toContain("/video-notes")
    expect(render.container.textContent).toContain("Calvino · Six memos for the next millennium.pdf")
    expect(render.container.textContent).toContain("Hilary Mantel · Wolf Hall.epub")
    expect(render.container.textContent).toContain("Chungking Express · 1994 · BluRay.srt")
    expect(render.container.textContent).toContain("Lex Fridman × Murakami (excerpts).txt")
    expect(render.container.textContent).toContain("Assets — the images, exports, and shared decks")
    expect(render.container.textContent).toContain("marginalia · saved deck")
    expect(render.container.textContent).not.toContain("Certification demo seed")
    expect(render.container.textContent).not.toContain("Send page to text workspace")
    expect(render.container.querySelector(".web-workspace-cert-shell")).toBeFalsy()
    expect(window.localStorage.getItem("astra.web.pdf-workspace.v1")).toBeNull()

    await render.unmount()
    window.location.hash = "#/files/pdf"
    render = await renderApp()

    expect(render.container.querySelector(".workspace-surfaces-cert-page")).toBeFalsy()
    expect(render.container.textContent).not.toContain("Calvino · Six memos for the next millennium.pdf")
    expect(render.container.textContent).toContain("Drop a PDF above to create the first row")

    await render.unmount()
    window.location.hash = "#/assets?astraCert=1"
    render = await renderApp()

    expect(render.container.querySelector(".workspace-surfaces-cert-page")).toBeTruthy()
    expect(render.container.textContent).toContain("The Library row template, four ways.")
    expect(render.container.textContent).toContain("/files/pdf")
    expect(render.container.textContent).toContain("/video-notes")
    expect(render.container.textContent).toContain("grid layout · not the row template")
    expect(render.container.textContent).toContain("marginalia · saved deck")
    expect(render.container.textContent).toContain("Drive My Car · ED")
    expect(render.container.textContent).not.toContain("Open account controls")

    await render.unmount()
    window.location.hash = "#/assets"
    render = await renderApp()

    expect(render.container.querySelector(".workspace-surfaces-cert-page")).toBeFalsy()
    expect(render.container.textContent).toContain("Cloud and local asset detail pages")
    expect(render.container.textContent).toContain("Open account controls")
    expect(render.container.textContent).not.toContain("The Library row template, four ways.")

    await render.unmount()
  })

  it("clears the saved text workspace across remounts", async () => {
    window.localStorage.setItem("astra.web.text-workspace.v1", JSON.stringify({
      sourceText: "saved draft",
      sourceLang: "",
      targetLang: "zh-CN",
      task: "translate",
      customPrompt: "",
      resultText: "saved result",
      importedDraftTitle: null,
      importedDraftSource: null,
      updatedAt: "2026-04-09T00:00:00.000Z",
    }))
    window.location.hash = "#/text"

    let render = await renderApp()
    expect(render.container.textContent).toContain("Restored your saved text workspace")

    await act(async () => {
      clickButton(render.container, "Clear workspace")
    })
    await flush()

    await render.unmount()
    window.location.hash = "#/text"
    render = await renderApp()

    expect(render.container.textContent).not.toContain("Restored your saved text workspace")
    expect(String(window.localStorage.getItem("astra.web.text-workspace.v1"))).toBe("null")

    await render.unmount()
  })

  it("imports a readable article URL, sends it to text, and restores the saved article workspace", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

      if (requestUrl === "http://127.0.0.1:8787/v1/import/article") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            url: "https://example.com/readable",
            title: "Readable Import Title",
            hostname: "example.com",
            byline: "Astra Writer",
            scope: "article",
            summary: "Readable relay summary",
            blocks: [
              "First readable article paragraph for import coverage.",
              "Second readable paragraph that should appear in the read-only article workspace.",
              "Third paragraph ensures article extraction keeps enough readable content.",
            ],
          }),
        } as Response
      }

      throw new Error(`Unexpected fetch: ${requestUrl}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    window.location.hash = "#/articles"
    let render = await renderApp()

    setInputValue(render.container, "Article URL", "https://example.com/readable")

    await act(async () => {
      clickButton(render.container, "Import URL")
    })
    await flush()

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/v1/import/article",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://example.com/readable" }),
      }),
    )
    expect(render.container.textContent).toContain("Readable Import Title")
    expect(render.container.textContent).toContain("First readable article paragraph")
    expect(window.localStorage.getItem("astra.web.article-workspace.v1")).toBeNull()

    await act(async () => {
      clickButton(render.container, "Send article to text workspace")
    })
    await flush()

    expect(mocks.saveTextTransferDraftMock).toHaveBeenCalledWith(expect.objectContaining({
      source: "article",
      title: "Readable Import Title",
      text: expect.stringContaining("Second readable paragraph"),
    }))

    await render.unmount()
    window.location.hash = "#/articles"
    render = await renderApp()

    expect(render.container.textContent).toContain("Restored your saved article import")
    expect(render.container.textContent).toContain("Readable Import Title")

    await act(async () => {
      clickButton(render.container, "Clear saved article")
    })
    await flush()

    await render.unmount()
    window.location.hash = "#/articles"
    render = await renderApp()

    expect(render.container.textContent).not.toContain("Restored your saved article import")
    expect(render.container.textContent).not.toContain("Readable Import Title")

    await render.unmount()
  })

  it("imports a PDF, supports page navigation, and restores the saved preview", async () => {
    mocks.extractPdfPagesMock.mockResolvedValue([
      { pageNumber: 1, width: 100, height: 100, blocks: [{ text: "Page one text", x: 0, y: 0, width: 1, height: 1 }] },
      { pageNumber: 2, width: 100, height: 100, blocks: [{ text: "Page two text", x: 0, y: 0, width: 1, height: 1 }] },
    ])

    window.location.hash = "#/files/pdf"
    let render = await renderApp()

    const pdfInput = render.container.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement
    expect(pdfInput).toBeTruthy()
    await uploadFile(pdfInput, createTestFile("pdf", "reader.pdf", "application/pdf"))

    expect(render.container.textContent).toContain("Page one text")
    expect(window.localStorage.getItem("astra.web.pdf-workspace.v1")).toBeNull()

    await act(async () => {
      clickButton(render.container, "Page 2")
    })
    await flush()

    expect(render.container.textContent).toContain("Page two text")

    await render.unmount()
    window.location.hash = "#/files/pdf"
    render = await renderApp()

    expect(render.container.textContent).toContain("Restored your saved PDF workflow")
    expect(render.container.textContent).toContain("Page two text")

    await render.unmount()
  })

  it("imports an EPUB chapter workflow and restores loaded chapters", async () => {
    const unload = vi.fn()
    const introSection = {
      load: vi.fn(async () => {}),
      unload,
      document: new DOMParser().parseFromString("<section><h1>Intro</h1><p>Alpha chapter paragraph.</p></section>", "text/html"),
    }
    const nextSection = {
      load: vi.fn(async () => {}),
      unload,
      document: new DOMParser().parseFromString("<section><h1>Next</h1><p>Beta chapter paragraph.</p></section>", "text/html"),
    }

    mocks.epubFactoryMock.mockReturnValue({
      ready: Promise.resolve(),
      loaded: {
        navigation: Promise.resolve({
          toc: [
            { href: "intro.xhtml", label: "Introduction", subitems: [] },
            { href: "next.xhtml", label: "Chapter 2", subitems: [] },
          ],
        }),
      },
      spine: {
        get: (href: string) => {
          if (href.includes("intro")) return introSection
          if (href.includes("next")) return nextSection
          return null
        },
      },
      packaging: {
        metadata: {
          title: "Mock EPUB",
          creator: "Mock Author",
        },
      },
      load: vi.fn(),
      destroy: vi.fn(),
    })

    window.location.hash = "#/files/epub"
    let render = await renderApp()

    const epubInput = render.container.querySelector('input[type="file"][accept=".epub"]') as HTMLInputElement
    expect(epubInput).toBeTruthy()
    await uploadFile(epubInput, createTestFile("epub", "reader.epub", "application/epub+zip"))

    expect(render.container.textContent).toContain("Alpha chapter paragraph.")

    await act(async () => {
      clickButton(render.container, "Chapter 2")
    })
    await flush()

    expect(render.container.textContent).toContain("Beta chapter paragraph.")

    await render.unmount()
    window.location.hash = "#/files/epub"
    render = await renderApp()

    expect(render.container.textContent).toContain("Restored your saved EPUB workflow")
    expect(render.container.textContent).toContain("Beta chapter paragraph.")

    await render.unmount()
  })

  it("translates subtitles and exports bilingual output", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    mocks.translateWithWebRelayMock.mockResolvedValue({
      ok: true,
      translations: ["translated:Hello there", "translated:General Kenobi"],
      providerId: "openai",
    })

    const createObjectURLMock = vi.fn(() => "blob:astra-test")
    const revokeObjectURLMock = vi.fn()
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    window.location.hash = "#/files/subtitles"
    const { container, unmount } = await renderApp()

    const subtitleInput = container.querySelector('input[type="file"][accept=".srt,.vtt,.ass,.ssa,.md,.txt,.html"]') as HTMLInputElement
    expect(subtitleInput).toBeTruthy()
    await uploadFile(
      subtitleInput,
      createTestFile(
        "1\n00:00:01,000 --> 00:00:02,000\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nGeneral Kenobi",
        "scene.srt",
        "text/plain",
      ),
    )

    await act(async () => {
      clickButton(container, "Translate all")
    })
    await flush()

    expect(container.textContent).toContain("translated:Hello there")

    await act(async () => {
      clickButton(container, "Export bilingual")
    })
    await flush()

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    const firstCreateObjectUrlArg = (createObjectURLMock.mock.calls as unknown[][])[0]?.[0]
    expect(firstCreateObjectUrlArg).toBeTruthy()
    expect(String(firstCreateObjectUrlArg)).toContain("Blob")
    expect(clickMock).toHaveBeenCalled()

    await unmount()
  })
})
