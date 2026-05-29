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
  createWebTrialIntentMock: vi.fn(),
  saveWebSessionMock: vi.fn((session) => session),
  fetchWebAccountWorkspaceMock: vi.fn(),
  fetchWebCloudAssetsMock: vi.fn(),
  fetchWebImportQueueObservabilityMock: vi.fn(),
  fetchWebFeatureFlagRuntimeMock: vi.fn(),
  updateWebFeatureFlagRuntimeMock: vi.fn(),
  fetchWebCostUsageSummaryMock: vi.fn(),
  fetchWebCancellationReasonSummaryMock: vi.fn(),
  fetchWebOpsAuditSummaryMock: vi.fn(),
  fetchWebOpsCockpitSummaryMock: vi.fn(),
  fetchWebOpsUserLookupMock: vi.fn(),
  fetchWebProviderHealthSummaryMock: vi.fn(),
  fetchWebSupportReportSummaryMock: vi.fn(),
  fetchWebSupportReportsMock: vi.fn(),
  updateWebSupportReportTriageMock: vi.fn(),
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
  fetchWebCloudLearningMemoryInventoryMock: vi.fn(),
  deleteWebCloudLearningMemoryMock: vi.fn(),
  fetchWebWeeklyDigestMock: vi.fn(),
  updateWebWeeklyDigestPreferenceMock: vi.fn(),
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
  createWebTrialIntent: mocks.createWebTrialIntentMock,
  ensureWebDeviceIdentity: mocks.ensureWebDeviceIdentityMock,
  fetchWebAccountWorkspace: mocks.fetchWebAccountWorkspaceMock,
  fetchWebCloudAssets: mocks.fetchWebCloudAssetsMock,
  fetchWebImportQueueObservability: mocks.fetchWebImportQueueObservabilityMock,
  fetchWebFeatureFlagRuntime: mocks.fetchWebFeatureFlagRuntimeMock,
  updateWebFeatureFlagRuntime: mocks.updateWebFeatureFlagRuntimeMock,
  fetchWebCostUsageSummary: mocks.fetchWebCostUsageSummaryMock,
  fetchWebCancellationReasonSummary: mocks.fetchWebCancellationReasonSummaryMock,
  fetchWebOpsAuditSummary: mocks.fetchWebOpsAuditSummaryMock,
  fetchWebOpsCockpitSummary: mocks.fetchWebOpsCockpitSummaryMock,
  fetchWebOpsUserLookup: mocks.fetchWebOpsUserLookupMock,
  fetchWebProviderHealthSummary: mocks.fetchWebProviderHealthSummaryMock,
  fetchWebSupportReportSummary: mocks.fetchWebSupportReportSummaryMock,
  fetchWebSupportReports: mocks.fetchWebSupportReportsMock,
  updateWebSupportReportTriage: mocks.updateWebSupportReportTriageMock,
  fetchWebContinuityExportJob: mocks.fetchWebContinuityExportJobMock,
  fetchWebCloudDataDeleteJob: mocks.fetchWebCloudDataDeleteJobMock,
  fetchWebCloudLearningMemoryInventory: mocks.fetchWebCloudLearningMemoryInventoryMock,
  deleteWebCloudLearningMemory: mocks.deleteWebCloudLearningMemoryMock,
  fetchWebWeeklyDigest: mocks.fetchWebWeeklyDigestMock,
  updateWebWeeklyDigestPreference: mocks.updateWebWeeklyDigestPreferenceMock,
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
      review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
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
      reviewSchedule: [],
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
    deepReadSessions: {
      count: 0,
      sessions: [],
    },
    library: {
      count: 0,
      items: [],
      snapshotCount: 0,
      snapshots: [],
    },
    syncHealth: {
      activeDeviceCount: 2,
      totalDeviceCount: 2,
      currentDeviceLastSyncAt: "2026-04-09T01:05:00.000Z",
      maxMutationsPerRequest: 500,
      collections: [
        { key: "config", enabled: true, defaultEnabled: true, cursor: "cfg-2", mutationCount: 2, activeCount: 2 },
        { key: "vocabulary", enabled: true, defaultEnabled: true, cursor: "vocab-2", mutationCount: 1, activeCount: 1 },
        { key: "review_schedule", enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0 },
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
    mocks.createWebTrialIntentMock.mockReset()
    mocks.saveWebSessionMock.mockClear()
    mocks.fetchWebAccountWorkspaceMock.mockReset()
    mocks.fetchWebCloudAssetsMock.mockReset()
    mocks.fetchWebImportQueueObservabilityMock.mockReset()
    mocks.fetchWebFeatureFlagRuntimeMock.mockReset()
    mocks.updateWebFeatureFlagRuntimeMock.mockReset()
    mocks.fetchWebCostUsageSummaryMock.mockReset()
    mocks.fetchWebCancellationReasonSummaryMock.mockReset()
    mocks.fetchWebOpsAuditSummaryMock.mockReset()
    mocks.fetchWebOpsCockpitSummaryMock.mockReset()
    mocks.fetchWebOpsUserLookupMock.mockReset()
    mocks.fetchWebProviderHealthSummaryMock.mockReset()
    mocks.fetchWebSupportReportSummaryMock.mockReset()
    mocks.fetchWebSupportReportsMock.mockReset()
    mocks.updateWebSupportReportTriageMock.mockReset()
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
    mocks.fetchWebCloudLearningMemoryInventoryMock.mockReset()
    mocks.deleteWebCloudLearningMemoryMock.mockReset()
    mocks.fetchWebWeeklyDigestMock.mockReset()
    mocks.updateWebWeeklyDigestPreferenceMock.mockReset()
    mocks.repairWebCloudSyncMock.mockReset()
    mocks.createWebVideoNoteJobMock.mockReset()
    mocks.fetchWebVideoNoteJobMock.mockReset()
    mocks.fetchWebVideoNoteArtifactMock.mockReset()

    mocks.readWebSessionMock.mockReturnValue(null)
    mocks.fetchWebAccountWorkspaceMock.mockResolvedValue(createWorkspace())
    mocks.fetchWebCloudAssetsMock.mockResolvedValue(createCloudAssets())
    mocks.createWebTrialIntentMock.mockResolvedValue({
      schema: "astra-beta-trial-lifecycle.v1",
      generatedAt: "2026-05-28T00:00:00.000Z",
      account: { plan: "free", subscriptionStatus: "active" },
      explicitActionRequired: true,
      eligibility: { eligible: true, reason: "eligible_free_account" },
      trial: { status: "intent_recorded", startedAt: null, expiresAt: null },
      conversion: { nextStep: "wait_for_beta_billing", checkoutAvailable: false, portalAvailable: false },
      betaBoundary: {
        billingUnavailable: true,
        betaBoundary: true,
        noPaymentCollected: true,
        paymentCollected: false,
        subscriptionMutation: false,
        proEntitlementGranted: false,
        trialEntitlementGranted: false,
      },
    })
    mocks.fetchWebCloudLearningMemoryInventoryMock.mockResolvedValue({
      schema: "astra-cloud-learning-memory-inventory.v1",
      generatedAt: "2026-05-29T12:00:00.000Z",
      account: { userId: "usr_demo", identityMode: "authenticated" },
      collections: [
        { collection: "config", enabled: true, defaultEnabled: true, mutationCount: 1, activeCount: 1, cursor: "1", lastUpdatedAt: "2026-05-28T12:00:00.000Z" },
        { collection: "vocabulary", enabled: true, defaultEnabled: true, mutationCount: 2, activeCount: 2, cursor: "2", lastUpdatedAt: "2026-05-28T12:05:00.000Z" },
        { collection: "review_schedule", enabled: true, defaultEnabled: true, mutationCount: 1, activeCount: 1, cursor: "3", lastUpdatedAt: "2026-05-28T12:06:00.000Z" },
        { collection: "reading_history", enabled: false, defaultEnabled: false, mutationCount: 0, activeCount: 0, cursor: null, lastUpdatedAt: null },
        { collection: "study_progress", enabled: false, defaultEnabled: false, mutationCount: 0, activeCount: 0, cursor: null, lastUpdatedAt: null },
        { collection: "weekly_digest_archive", enabled: true, defaultEnabled: true, mutationCount: 1, activeCount: 1, cursor: null, lastUpdatedAt: "2026-05-29T12:00:00.000Z" },
      ],
      preferences: { reading_history: false, study_progress: false, weekly_digest: true },
      privacy: {
        metadataOnly: true,
        rawContentIncluded: false,
        rawUrlsIncluded: false,
        emailsIncluded: false,
        deviceSessionIdsIncluded: false,
        syncPayloadBodiesIncluded: false,
        promptModelOutputsIncluded: false,
        externalProviderReceiptsIncluded: false,
        localBrowserDeletionIncluded: false,
      },
    })
    mocks.fetchWebWeeklyDigestMock.mockResolvedValue({
      digestId: "digest_2026-05-25",
      periodStart: "2026-05-25T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
      reviewedCount: 1,
      savedCount: 3,
      sourceBreakdown: [{ type: "page", count: 2 }, { type: "saved", count: 1 }],
      highlightedWords: ["private-term"],
      highlightedSentences: ["Private saved sentence"],
      nextReviewCount: 4,
      generatedAt: "2026-05-29T12:00:00.000Z",
    })
    mocks.updateWebWeeklyDigestPreferenceMock.mockResolvedValue({ preference: { weekly_digest: false }, serverTime: "2026-05-29T12:01:00.000Z" })
    mocks.deleteWebCloudLearningMemoryMock.mockResolvedValue({
      schema: "astra-cloud-learning-memory-deletion-receipt.v1",
      deletedAt: "2026-05-29T12:02:00.000Z",
      account: { userId: "usr_demo", identityMode: "authenticated" },
      collections: [
        { collection: "vocabulary", clearedMutationCount: 2, clearedActiveCount: 2, previousCursor: "2" },
        { collection: "review_schedule", clearedMutationCount: 1, clearedActiveCount: 1, previousCursor: "3" },
        { collection: "weekly_digest_archive", clearedMutationCount: 1, clearedActiveCount: 1, previousCursor: null },
      ],
      totals: { clearedMutationCount: 4, clearedActiveCount: 4 },
      boundary: {
        metadataOnly: true,
        cloudServerSideOnly: true,
        rawContentIncluded: false,
        externalProviderDeletionIncluded: false,
        localBrowserDeletionIncluded: false,
      },
    })
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
    mocks.fetchWebCostUsageSummaryMock.mockResolvedValue({
      schema: "astra-cost-usage-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents: 3,
      totalRequests: 7,
      totalCharacters: 3200,
      totalEstimatedSpendUsd: 0.0134,
      estimateRegistry: "internal_deterministic_v1",
      cacheHitRate: 0.5,
      dailyEstimate: {
        date: "2026-05-27",
        estimatedSpendUsd: 0.0134,
        previousDate: "2026-05-26",
        previousEstimatedSpendUsd: 0.004,
        spikeRatio: 3.35,
        spikeStatus: "spike",
        riskLevel: "high",
      },
      buckets: [{
        tier: "pro",
        taskClass: "deep_read",
        costBucket: "high",
        eventCount: 2,
        requestCount: 5,
        characterCount: 2600,
        successCount: 2,
        failureCount: 0,
        fallbackCount: 1,
        estimatedSpendUsd: 0.011,
      }, {
        tier: "free",
        taskClass: "translate",
        costBucket: "low",
        eventCount: 1,
        requestCount: 2,
        characterCount: 600,
        successCount: 1,
        failureCount: 0,
        fallbackCount: 0,
        estimatedSpendUsd: 0.0024,
      }],
      byServiceMode: [{
        serviceMode: "automatic",
        eventCount: 3,
        requestCount: 7,
        characterCount: 3200,
        successCount: 3,
        failureCount: 0,
        fallbackCount: 1,
        latencySampleCount: 2,
        latencyP50Ms: 500,
        latencyP95Ms: 1200,
        estimatedSpendUsd: 0.0134,
      }],
      byCacheStatus: [{ cacheStatus: "hit", eventCount: 1, requestCount: 2, characterCount: 600, share: 0.3333, estimatedSpendUsd: 0.0024 }, { cacheStatus: "miss", eventCount: 1, requestCount: 2, characterCount: 600, share: 0.3333, estimatedSpendUsd: 0.011 }, { cacheStatus: "disabled", eventCount: 1, requestCount: 3, characterCount: 2000, share: 0.3333, estimatedSpendUsd: 0 }],
    })
    mocks.fetchWebOpsCockpitSummaryMock.mockResolvedValue({
      schema: "astra-ops-cockpit-summary.v1",
      generatedAt: "2026-05-28T12:00:00.000Z",
      privacy: {
        metadataOnly: true,
        aggregateOnly: true,
        readOnly: true,
        contentIncluded: false,
        perUserRows: false,
        identifiersIncluded: false,
        providerBillingIncluded: false,
        crmRepliesIncluded: false,
      },
      sources: {
        costUsageSummary: true,
        supportReportSummary: true,
        cancellationReasonSummary: true,
        analyticsCohortSummary: true,
        mobileRetentionSummary: true,
        weeklyDigestDeliverySummary: true,
        providerHealthSummary: true,
        operatingReviewHelpers: true,
      },
      metrics: {
        cost: {
          retainedEvents: 3,
          requests: 7,
          estimatedSpendUsd: 0.0134,
          dailyEstimatedSpendUsd: 0.0134,
          dailyRiskLevel: "high",
          dailySpikeStatus: "spike",
          cacheHitRate: 0.5,
          topCostTaskClass: "deep_read",
        },
        support: {
          totalReports: 1,
          weeklyTopIssueCount: 1,
          unresolvedCount: 2,
          urgentUnresolvedCount: 1,
          staleTriageCount: 2,
          followUpOverdueCount: 1,
          oldestUnresolvedAgeDays: 3,
          macroCoverageRate: 1,
        },
        retentionGrowth: {
          analyticsGrain: "week",
          analyticsEvents: 5,
          mobileRetentionGrain: "week",
          mobileRetentionEvents: 4,
          weeklyDigestDeliveryRuns: 1,
          cancellationSubmissions: 2,
          cancellationReasonCoverageRate: 1,
          topCancellationReason: "Privacy concerns",
        },
        providerHealth: {
          available: true,
          retainedEvents: 3,
          incidentBucketCount: 1,
          watchBucketCount: 0,
        },
      },
      reviewCadence: [
        { cadence: "daily", label: "Outage, error spike, cost spike, support volume", focus: "Protect stability and margin before pushing growth.", requiredEvidence: ["support_report_summary", "cost_usage_summary"], availableEvidence: ["support_report_summary", "cost_usage_summary"], missingEvidence: [] },
        { cadence: "weekly", label: "Activation, paywall, retention, top failures, heavy users", focus: "Decide experiment winners only when guardrails are healthy.", requiredEvidence: ["activation_funnel", "experiment_guardrails", "support_report_summary", "cost_usage_summary"], availableEvidence: ["activation_funnel", "experiment_guardrails", "support_report_summary", "cost_usage_summary"], missingEvidence: [] },
      ],
      experimentGuardrails: [{ area: "support", successMetric: "useful_support_report_rate", guardrailMetrics: ["content_included_rate"], privacyRule: "metadata only" }],
      riskFlags: [
        { code: "cost_spike_or_high_risk", severity: "pause_growth", message: "Aggregate daily cost signal is high or spiking." },
        { code: "support_sla_risk", severity: "watch", message: "Support has unresolved reports." },
      ],
    })
    mocks.fetchWebOpsAuditSummaryMock.mockResolvedValue({
      schema: "astra-ops-audit-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      totalEvents: 3,
      retainedEventLimit: 500,
      byAction: [
        { action: "support_report_submitted", count: 1 },
        { action: "ops_user_lookup", count: 1 },
      ],
      byActor: [
        { actor: "operator", count: 2 },
        { actor: "user", count: 1 },
      ],
      privacy: {
        userConsentTrueCount: 1,
        metadataOnlyCount: 3,
        contentIncludedCount: 0,
      },
      recent: [{
        id: "audit_1",
        timestamp: "2026-05-27T12:00:00.000Z",
        actor: "operator",
        action: "ops_user_lookup",
        outcome: "success",
        operatorTokenHash: "b".repeat(64),
        subjectUserId: "usr_demo",
        subjectEmailHash: "a".repeat(64),
        supportReportId: null,
        metadata: { queryType: "email" },
        privacy: { userConsent: null, contentIncluded: false, contentAccess: "metadata_only" },
      }, {
        id: "audit_2",
        timestamp: "2026-05-27T11:59:00.000Z",
        actor: "user",
        action: "support_report_submitted",
        outcome: "success",
        operatorTokenHash: null,
        subjectUserId: "usr_demo",
        subjectEmailHash: "a".repeat(64),
        supportReportId: "rpt_audit_0001",
        metadata: { featureSurface: "settings" },
        privacy: { userConsent: true, contentIncluded: false, contentAccess: "metadata_only" },
      }],
    })
    mocks.fetchWebCancellationReasonSummaryMock.mockResolvedValue({
      schema: "astra-cancellation-reason-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      totalSubmissions: 2,
      retainedEventLimit: 500,
      reasonCoverage: { submittedCount: 2, unknownReasonCount: 0, coverageRate: 1 },
      byReason: [{
        reason: "privacy_concerns",
        label: "Privacy concerns",
        productMeaning: "Trust, disclosure, or privacy controls need work.",
        count: 2,
        share: 1,
      }],
      byPlan: [{ plan: "pro", count: 2 }],
      bySource: [{ source: "settings", count: 1 }, { source: "refund_request", count: 1 }],
      recent: [{
        id: "cancel_1",
        submittedAt: "2026-05-27T12:00:00.000Z",
        subjectUserId: "usr_demo",
        subjectEmailHash: "a".repeat(64),
        reason: "privacy_concerns",
        plan: "pro",
        source: "settings",
        subscriptionStatus: "active",
        identityMode: "authenticated",
      }],
    })
    mocks.fetchWebOpsUserLookupMock.mockResolvedValue({
      schema: "astra-ops-user-lookup.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      queryType: "email",
      resultWindow: {
        mode: "exact_lookup",
        limit: 1,
        cursor: null,
        nextCursor: null,
        returnedCount: 1,
        totalMatched: 1,
        hasMore: false,
      },
      snapshotBoundary: {
        metadataOnly: true,
        contentIncluded: false,
        rawQueryIncluded: false,
        exportAvailable: false,
        recentTaskSummaryLimit: 6,
        excludedFields: ["email", "deviceId", "sessionId", "provider", "model", "rawQuery", "rawText"],
      },
      user: {
        userId: "usr_demo",
        emailHash: "a".repeat(64),
        createdAt: "2026-03-01T00:00:00.000Z",
        plan: "pro",
        subscriptionStatus: "active",
        identityMode: "authenticated",
        providerEntitlementCount: 2,
        limits: { dailyRequests: 2000, dailyCharacters: 500000, requestsPerMinute: 120 },
        usage: {
          usageDay: "2026-05-27",
          requestsToday: 120,
          charactersToday: 60000,
          totalRequests: 320,
          totalCharacters: 150000,
          lastRequestAt: "2026-05-27T00:02:00.000Z",
          recentEventCount: 3,
          usageCategory: "heavy",
        },
        devices: { activeCount: 1, revokedCount: 0 },
        sessions: { activeCount: 1, revokedCount: 0 },
        recentTaskSummary: [{
          taskClass: "paragraph_understanding",
          eventCount: 2,
          successCount: 1,
          failureCount: 1,
          fallbackCount: 1,
          latencySampleCount: 2,
          latencyP95Ms: 240,
        }],
      },
    })
    mocks.fetchWebProviderHealthSummaryMock.mockResolvedValue({
      schema: "astra-provider-health-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents: 3,
      totalRequests: 7,
      totalCharacters: 3200,
      buckets: [{
        provider: "openai",
        model: "gpt-health-pro",
        serviceMode: "automatic",
        taskClass: "deep_read",
        eventCount: 2,
        requestCount: 5,
        characterCount: 2600,
        successCount: 1,
        failureCount: 1,
        fallbackCount: 1,
        successRate: 0.5,
        fallbackRate: 0.5,
        latencySampleCount: 2,
        latencyP50Ms: 500,
        latencyP95Ms: 1200,
        healthStatus: "incident",
      }, {
        provider: "gemini",
        model: "gemini-health-free",
        serviceMode: "fast",
        taskClass: "translate",
        eventCount: 1,
        requestCount: 2,
        characterCount: 600,
        successCount: 1,
        failureCount: 0,
        fallbackCount: 0,
        successRate: 1,
        fallbackRate: 0,
        latencySampleCount: 1,
        latencyP50Ms: 180,
        latencyP95Ms: 180,
        healthStatus: "healthy",
      }],
    })
    mocks.fetchWebSupportReportSummaryMock.mockResolvedValue({
      totalReports: 1,
      generatedAt: "2026-05-27T12:00:00.000Z",
      buckets: [{
        key: "library|review_library",
        count: 1,
        latestSubmittedAt: "2026-05-27T11:00:00.000Z",
        hostname: "library.example",
        featureSurface: "library",
        issueCategory: "review_library",
        extensionVersion: "1.0.0",
        browser: "Chrome",
        membershipState: "free",
        privacyMode: true,
        knownIssueId: null,
        knownIssueStatus: null,
        triageStatus: "new",
      }],
      weeklyTopIssues: [{
        weekStart: "2026-05-25",
        key: "2026-05-25|library.example|library|review_library|no_known_issue",
        reportCount: 1,
        latestSubmittedAt: "2026-05-27T11:00:00.000Z",
        hostname: "library.example",
        featureSurface: "library",
        issueCategory: "review_library",
        knownIssueId: null,
        knownIssueStatus: null,
      }],
      handoffSummary: {
        byPath: [{ path: "email_follow_up", count: 1 }],
        byStatus: [{ status: "handed_off", count: 1 }],
      },
      slaRisk: {
        generatedAt: "2026-05-27T12:00:00.000Z",
        currentNow: "2026-05-27T12:00:00.000Z",
        unresolvedCount: 2,
        urgentUnresolvedCount: 1,
        staleTriageByAgeBucket: { under24h: 0, from24hTo72h: 1, from72hTo168h: 1, over168h: 0 },
        followUpOverdueCount: 1,
        oldestUnresolvedAgeHours: 72.5,
        oldestUnresolvedAgeDays: 3,
      },
      macroCoverage: {
        schema: "astra-support-first-response-macros.v1",
        generatedAt: "2026-05-27T12:00:00.000Z",
        threshold: 0.8,
        catalogCoverage: { coveredIssueCategories: 8, totalIssueCategories: 8, coverageRate: 1, ready: true },
        reportedCoverage: { coveredReports: 1, totalReports: 1, unknownIssueReports: 0, coverageRate: 1, ready: true },
        byIssueCategory: [{ issueCategory: "review_library", count: 1, macroId: "macro_review_library", title: "Saved item or review issue", covered: true }],
        macros: [{
          id: "macro_review_library",
          issueCategory: "review_library",
          title: "Saved item or review issue",
          firstResponse: "Thanks for flagging this.",
          nextStep: "Ask what happened.",
          privacyNote: "Do not include saved text.",
          surfaces: ["library", "review"],
        }],
      },
    })
    mocks.fetchWebSupportReportsMock.mockResolvedValue({
      schema: "astra-support-report-inbox.v1",
      reports: [{
        reportId: "rpt_support_1",
        status: "submitted",
        createdAt: "2026-05-27T11:00:00.000Z",
        updatedAt: "2026-05-27T11:00:00.000Z",
        submittedAt: "2026-05-27T11:00:00.000Z",
        ownerEmail: "user@example.com",
        deviceId: "device-123",
        sessionId: "sess-123",
        featureSurface: "library",
        action: "report_library_source",
        issueCategory: "review_library",
        errorCategory: "import_failed",
        lastErrorCategory: null,
        runtimeSurface: "web",
        hostname: "library.example",
        extensionVersion: "1.0.0",
        browser: "Chrome",
        os: "macOS",
        locale: "en-US",
        membershipState: "free",
        privacyMode: true,
        userMessageIncluded: false,
        contactIncluded: false,
        defaultContentIncluded: false,
        knownIssue: null,
        triage: {
          status: "new",
          assignedTo: null,
          priority: "normal",
          resolution: null,
          updatedAt: null,
          updatedBy: null,
        },
      }],
    })
    mocks.fetchWebFeatureFlagRuntimeMock.mockResolvedValue({
      schema: "astra-feature-flag-runtime.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      overrides: [{ key: "ui.library_home", status: "on", reason: "test", changedBy: "ops", changedAt: "2026-05-27T11:00:00.000Z" }],
      killSwitches: [{
        id: "incident-existing",
        category: "feature",
        enabled: false,
        reason: "Existing incident",
        fallbackMessage: "Astra is using a simpler flow for now.",
        safeMode: true,
      }],
      changeLog: [{
        id: "chg_1",
        changedAt: "2026-05-27T12:00:00.000Z",
        changedBy: "ops",
        reason: "Initial runtime",
        overrideCount: 1,
        killSwitchCount: 1,
        previousGeneratedAt: null,
      }],
    })
    mocks.updateWebFeatureFlagRuntimeMock.mockImplementation(async ({ runtime }) => ({
      ...runtime,
      generatedAt: "2026-05-27T12:05:00.000Z",
      changeLog: [{
        id: "chg_2",
        changedAt: "2026-05-27T12:05:00.000Z",
        changedBy: "operator",
        reason: runtime.killSwitches[0]?.reason ?? "Feature-flag runtime updated.",
        overrideCount: runtime.overrides.length,
        killSwitchCount: runtime.killSwitches.length,
        previousGeneratedAt: "2026-05-27T12:00:00.000Z",
      }, ...runtime.changeLog],
    }))
    mocks.updateWebSupportReportTriageMock.mockResolvedValue({
      reportId: "rpt_support_1",
      triage: {
        status: "investigating",
        assignedTo: "support@astra.local",
        priority: "high",
        resolution: null,
        updatedAt: "2026-05-27T12:05:00.000Z",
        updatedBy: "ops-test",
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
      deletedRecords: { vocabulary: 1, review_schedule: 0, reading_history: 2, study_progress: 3 },
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
        review_schedule: { enabled: true, defaultEnabled: true, latestCursor: null, compactionFloorCursor: null, records: [] },
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
    expect(render.container.textContent).toContain("Why Astra asks for browser access")
    expect(render.container.textContent).toContain("Astra reads the page you choose")
    expect(render.container.textContent).toContain("Astra does not read your clipboard in the background")
    expect(render.container.textContent).toContain("Read the privacy promise")
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

  it("renders growth landing copy for sentence-card and referral links without shared text", async () => {
    window.location.hash = "#/?utm_source=sentence_card&utm_medium=share&utm_campaign=first_90_growth_mvp&share=sentence"

    let render = await renderApp()
    expect(render.container.textContent).toContain("Someone shared an Astra sentence card")
    expect(render.container.textContent).toContain("does not host the shared text")
    expect(render.container.textContent).not.toContain("To inhabit a difficult sentence")
    let growthEvents = JSON.parse(window.localStorage.getItem("astra.web.growth-events.v1") ?? "[]") as Array<{ data: Record<string, unknown> }>
    expect(growthEvents[0]?.data).toMatchObject({
      feature: "learning_loop",
      event: "landing_visited",
      source: "web_landing",
      landingSource: "sentence_card",
      shareType: "sentence_card",
      campaign: "first_90_growth_mvp",
    })

    await render.unmount()
    window.localStorage.clear()
    window.location.hash = "#/?utm_source=sentence_card&share=sentence&utm_campaign=https%3A%2F%2Fprivate.example%2Fsecret%3Fq%3DTo%2520inhabit"
    render = await renderApp()
    growthEvents = JSON.parse(window.localStorage.getItem("astra.web.growth-events.v1") ?? "[]") as Array<{ data: Record<string, unknown> }>
    expect(growthEvents[0]?.data).not.toHaveProperty("campaign")
    expect(JSON.stringify(growthEvents)).not.toContain("private.example")
    expect(JSON.stringify(growthEvents)).not.toContain("To%20inhabit")

    await render.unmount()
    window.localStorage.clear()
    window.location.hash = "#/?utm_source=referral&utm_medium=invite&utm_campaign=first_90_growth_mvp&referral=non_rewarding"
    render = await renderApp()
    expect(render.container.textContent).toContain("A friend invited you to try Astra")
    expect(render.container.textContent).toContain("Referral rewards are not active")
    growthEvents = JSON.parse(window.localStorage.getItem("astra.web.growth-events.v1") ?? "[]") as Array<{ data: Record<string, unknown> }>
    expect(growthEvents[0]?.data).toMatchObject({
      feature: "learning_loop",
      event: "landing_visited",
      source: "web_landing",
      landingSource: "referral",
      referralType: "non_rewarding",
      rewardAvailable: false,
    })

    await render.unmount()
  })

  it("renders public sample and SEO intent routes without auth or private content leakage", async () => {
    const routes = [
      ["/sample", "Try Astra on a static sample before you install.", "public_sample"],
      ["/learn/read-english-webpages", "Read English webpages with bilingual context.", "read_english_webpages"],
      ["/learn/youtube-bilingual-subtitles", "Study videos with bilingual subtitle workflows.", "youtube_bilingual_subtitles"],
      ["/learn/save-english-sentences", "Save English sentences for lightweight review.", "save_english_sentences"],
      ["/learn/ai-reading-assistant-chinese", "An AI reading assistant for Chinese speakers reading English.", "ai_reading_assistant_chinese"],
    ] as const

    for (const [route, title, intent] of routes) {
      window.localStorage.clear()
      window.location.hash = `#${route}?q=PrivateSentence&sharedText=DoNotRender&url=https%3A%2F%2Fprivate.example%2Fsecret%3Fx%3D1`

      const { container, unmount } = await renderApp()

      expect(container.textContent).toContain(title)
      expect(container.textContent).toContain("Zero-config static sample")
      expect(container.textContent).toContain("Start free sample")
      expect(container.textContent).toContain("Install / open Astra")
      expect(container.textContent).toContain("Sign in to sync")
      expect(container.textContent).toContain("public without auth")
      expect(container.textContent).toContain("static demo copy only")
      expect(container.querySelector("input[type='password']")).toBeNull()
      expect(container.textContent).not.toContain("PrivateSentence")
      expect(container.textContent).not.toContain("DoNotRender")
      expect(container.textContent).not.toContain("private.example")

      const growthEvents = JSON.parse(window.localStorage.getItem("astra.web.growth-events.v1") ?? "[]") as Array<{ data: Record<string, unknown> }>
      expect(growthEvents[0]?.data).toMatchObject({
        feature: "learning_loop",
        event: "landing_visited",
        source: "web_landing",
        intent,
      })
      expect(JSON.stringify(growthEvents)).not.toContain("PrivateSentence")
      expect(JSON.stringify(growthEvents)).not.toContain("DoNotRender")
      expect(JSON.stringify(growthEvents)).not.toContain("private.example")

      await unmount()
    }
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

  it("signs in from the public sign-in route and routes to Today Review", async () => {
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
    expect(container.textContent).toContain("Today Review")
    expect(container.textContent).toContain("cards are ready from your web reading")

    await unmount()
  })

  it("starts a public free session and routes to Today Review", async () => {
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
    expect(container.textContent).toContain("Today Review")

    await unmount()
  })

  it("shows an already signed-in state when revisiting the public sign-in route", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/sign-in"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Already signed in")
    expect(container.textContent).toContain("Open Today Review")
    expect(container.querySelector("input[type='email']")).toBeNull()

    await unmount()
  })

  it("signs in and routes to Today Review", async () => {
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
    expect(container.textContent).toContain("Today Review")

    await unmount()
  })

  it("renders the mobile Today Review flow from synced vocabulary and queues a local review event", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/today"

    const { container, unmount } = await renderApp()

    expect(mocks.fetchWebCloudAssetsMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })
    expect(container.textContent).toContain("Today Review")
    expect(container.textContent).toContain("1 card is ready from your web reading.")
    expect(container.textContent).toContain("serendipity")
    expect(container.textContent).toContain("From: example.com")
    const todayShell = container.querySelector(".mobile-review-shell") as HTMLElement | null
    expect(todayShell?.textContent).not.toContain("provider")
    expect(todayShell?.textContent).not.toContain("model")

    await act(async () => {
      clickButton(container, "Show answer")
    })
    await flush()

    expect(container.textContent).toContain("Meaning")
    expect(container.textContent).toContain("机缘巧合")

    await act(async () => {
      clickButton(container, "Good")
    })
    await flush()

    expect(container.textContent).toContain("Done for today.")
    const queuedEvents = JSON.parse(window.localStorage.getItem("astra.web.mobile-review-events.v1") ?? "[]") as Array<{ cardId: string; rating: string; queued: boolean }>
    expect(queuedEvents[0]).toMatchObject({ cardId: "vocab-1", rating: "good", queued: true })

    await unmount()
  })

  it("orders Today Review by SRS due date, not recency", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    mocks.fetchWebCloudAssetsMock.mockResolvedValue(createCloudAssets({
      vocabulary: {
        enabled: true,
        defaultEnabled: true,
        cursor: "vocab-due",
        count: 2,
        entries: [
          // Saved most recently — recency ordering would surface this first.
          { id: "recent-not-due", text: "newword", translation: "新词", hostname: "example.com", savedAt: 2_000_000_000_000 },
          // Saved earlier, but overdue — SRS ordering must surface this first.
          { id: "older-due", text: "oldword", translation: "旧词", hostname: "example.com", savedAt: 1_000_000_000_000 },
        ],
        reviewSchedule: [
          { vocabularyEntryId: "recent-not-due", srsBox: 3, nextReviewAt: 4_000_000_000_000, reviewCount: 2, lastReviewedAt: null, lastReviewGrade: null, lastReviewGradeAt: null, updatedAt: 2_000_000_000_000 },
          { vocabularyEntryId: "older-due", srsBox: 1, nextReviewAt: 1, reviewCount: 0, lastReviewedAt: null, lastReviewGrade: null, lastReviewGradeAt: null, updatedAt: 1_000_000_000_000 },
        ],
      },
    }))
    window.location.hash = "#/today"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("2 cards are ready from your web reading.")
    // Due-first: the overdue "oldword" is the active review card even though
    // "newword" was saved more recently (recency ordering would surface "newword").
    const activeCardFront = container.querySelector(".mobile-review-card h3")
    expect(activeCardFront?.textContent).toBe("oldword")
    expect(container.textContent).toContain("word card: oldword")

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

  it("records beta trial interest from the account workspace without opening billing", async () => {
    const session = createSession({ plan: "free" })
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Beta trial interest")
    expect(container.textContent).toContain("does not collect payment")
    expect(container.textContent).toContain("Checkout unavailable in beta")

    await act(async () => {
      clickButton(container, "Record trial interest")
    })
    await flush()

    expect(mocks.createWebTrialIntentMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })
    expect(mocks.openBillingCheckoutMock).not.toHaveBeenCalled()
    expect(mocks.openBillingPortalMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain("Trial status: intent recorded")
    expect(container.textContent).toContain("Beta boundary: no payment collected, no subscription mutation, no trial or Pro entitlement granted.")
    expect(container.textContent).not.toContain("api key")
    expect(container.textContent).not.toContain("openai-key")
    expect(container.textContent).not.toContain("session-token")

    await unmount()
  })

  it("shows user-safe cloud learning memory and weekly digest controls", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(mocks.fetchWebCloudLearningMemoryInventoryMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })
    expect(mocks.fetchWebWeeklyDigestMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })

    const memoryCard = container.querySelector('[data-testid="cloud-learning-memory-card"]') as HTMLElement
    const digestCard = container.querySelector('[data-testid="weekly-digest-account-card"]') as HTMLElement
    expect(memoryCard).toBeTruthy()
    expect(digestCard).toBeTruthy()
    expect(memoryCard.textContent).toContain("Cloud learning memory")
    expect(memoryCard.textContent).toContain("Saved words & sentences")
    expect(memoryCard.textContent).toContain("Metadata only")
    expect(memoryCard.textContent).toContain("does not create third-party service deletion receipts")
    expect(digestCard.textContent).toContain("Weekly digest")
    expect(digestCard.textContent).toContain("Saved this week")
    expect(digestCard.textContent).toContain("Source mix: page 2 · saved 1")
    expect(digestCard.textContent).toContain("does not promise email scheduling")
    expect(container.textContent).not.toContain("Private saved sentence")
    expect(container.textContent).not.toContain("private-term")
    expect(container.textContent).not.toContain("session-token")

    mocks.fetchWebCloudLearningMemoryInventoryMock.mockResolvedValueOnce({
      schema: "astra-cloud-learning-memory-inventory.v1",
      generatedAt: "2026-05-29T12:01:00.000Z",
      account: { userId: "usr_demo", identityMode: "authenticated" },
      collections: [
        { collection: "vocabulary", enabled: true, defaultEnabled: true, mutationCount: 2, activeCount: 2, cursor: "2", lastUpdatedAt: "2026-05-28T12:05:00.000Z" },
        { collection: "weekly_digest_archive", enabled: false, defaultEnabled: true, mutationCount: 1, activeCount: 1, cursor: null, lastUpdatedAt: "2026-05-29T12:00:00.000Z" },
      ],
      preferences: { reading_history: false, study_progress: false, weekly_digest: false },
      privacy: {
        metadataOnly: true,
        rawContentIncluded: false,
        rawUrlsIncluded: false,
        emailsIncluded: false,
        deviceSessionIdsIncluded: false,
        syncPayloadBodiesIncluded: false,
        promptModelOutputsIncluded: false,
        externalProviderReceiptsIncluded: false,
        localBrowserDeletionIncluded: false,
      },
    })

    await act(async () => {
      clickButton(container, "Turn off weekly digest")
    })
    await flush()

    expect(mocks.updateWebWeeklyDigestPreferenceMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
      enabled: false,
    })
    expect(container.textContent).toContain("Weekly digest is off")
    expect(container.textContent).toContain("Turn on weekly digest")

    vi.mocked(window.confirm).mockReturnValueOnce(false)
    await act(async () => {
      clickButton(container, "Delete cloud learning memory")
    })
    await flush()
    expect(mocks.deleteWebCloudLearningMemoryMock).not.toHaveBeenCalled()

    vi.mocked(window.confirm).mockReturnValueOnce(true)
    await act(async () => {
      clickButton(container, "Delete cloud learning memory")
    })
    await flush()

    expect(mocks.deleteWebCloudLearningMemoryMock).toHaveBeenCalledWith({
      session,
      device: expect.objectContaining({ deviceId: "device-123" }),
    })
    expect(container.querySelector('[data-testid="cloud-learning-memory-receipt"]')?.textContent).toContain("4 active records cleared")
    expect(container.querySelector('[data-testid="cloud-learning-memory-receipt"]')?.textContent).toContain("no third-party service deletion included")

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
      collections: ["config", "vocabulary", "review_schedule", "reading_history", "study_progress"],
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
      collections: ["vocabulary", "review_schedule", "reading_history", "study_progress"],
      idempotencyKey: expect.stringContaining("web-cloud-delete-device-123-"),
    })
    expect(container.textContent).toContain("Cloud delete scheduled.")
    expect(container.textContent).toContain("Deletion is scheduled for")
    expect(container.textContent).toContain("Cloud delete: `scheduled` is not deletion yet.")

    await unmount()
  })

  it("loads staff account lookup metadata from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Staff account lookup")
    expect(container.textContent).toContain("Enter the operator token above to load staff account metadata.")
    expect(mocks.fetchWebOpsUserLookupMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    setInputValue(container, "Account lookup", "demo@astra.local")
    await act(async () => {
      clickButton(container, "Lookup account")
    })
    await flush()

    expect(mocks.fetchWebOpsUserLookupMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
      query: "demo@astra.local",
    })
    const lookupCard = Array.from(container.querySelectorAll(".card"))
      .find((card) => card.textContent?.includes("Staff account lookup")) as HTMLElement
    expect(lookupCard.textContent).toContain("usr_demo")
    expect(lookupCard.textContent).toContain("email hash aaaaaaaaaaaa…")
    expect(lookupCard.textContent).toContain("Pro plan")
    expect(lookupCard.textContent).toContain("heavy")
    expect(lookupCard.textContent).toContain("paragraph_understanding")
    expect(lookupCard.textContent).toContain("240ms")
    expect(lookupCard.textContent).toContain("Result window")
    expect(lookupCard.textContent).toContain("1 of 1")
    expect(lookupCard.textContent).toContain("Limit 1")
    expect(lookupCard.textContent).toContain("no next page")
    expect(lookupCard.textContent).toContain("Snapshot boundary")
    expect(lookupCard.textContent).toContain("Metadata only")
    expect(lookupCard.textContent).toContain("no raw query")
    expect(lookupCard.textContent).toContain("no export/download")
    expect(lookupCard.textContent).toContain("Recent task rows are capped at 6")
    expect(lookupCard.textContent).not.toContain("demo@astra.local")
    expect(lookupCard.textContent).not.toContain("device-current")
    expect(lookupCard.textContent).not.toContain("sess_demo")
    expect(lookupCard.textContent).not.toContain("gpt-health-pro")
    expect(lookupCard.textContent).not.toContain("Hello, world")
    expect(lookupCard.textContent).not.toContain("Download CSV")
    expect(lookupCard.textContent).not.toContain("Export")

    setInputValue(container, "Operator token", "rotated-operator-secret")
    await flush()
    expect(lookupCard.textContent).not.toContain("usr_demo")
    expect(lookupCard.textContent).toContain("No account lookup loaded yet")

    setInputValue(container, "Operator token", "operator-secret")
    await flush()
    expect(lookupCard.textContent).toContain("No account lookup loaded yet")

    setInputValue(container, "Account lookup", "other@astra.local")
    await flush()
    expect(lookupCard.textContent).not.toContain("usr_demo")
    expect(lookupCard.textContent).toContain("No account lookup loaded yet")

    await unmount()
  })

  it("loads the privacy-safe operator audit snapshot from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Privacy / operator audit")
    expect(container.textContent).toContain("Enter the operator token above to load privacy-safe audit metadata.")
    expect(mocks.fetchWebOpsAuditSummaryMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh audit")
    })
    await flush()

    expect(mocks.fetchWebOpsAuditSummaryMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    let auditCard = Array.from(container.querySelectorAll(".card"))
      .find((card) => card.textContent?.includes("Privacy / operator audit")) as HTMLElement
    expect(auditCard.textContent).toContain("Retained audit events")
    expect(auditCard.textContent).toContain("Metadata-only")
    expect(auditCard.textContent).toContain("ops_user_lookup")
    expect(auditCard.textContent).toContain("support_report_submitted")
    expect(auditCard.textContent).toContain("rpt_audit_0001")
    expect(auditCard.textContent).toContain("metadata_only")
    expect(auditCard.textContent).not.toContain("operator-secret")
    expect(auditCard.textContent).not.toContain("demo@astra.local")
    expect(auditCard.textContent).not.toContain("device-current")
    expect(auditCard.textContent).not.toContain("sess_demo")
    expect(auditCard.textContent).not.toContain("private.example")
    expect(auditCard.textContent).not.toContain("Hello, world")

    setInputValue(container, "Operator token", "wrong-token")
    await act(async () => {
      clickButton(container, "Refresh audit")
    })
    await flush()
    expect(mocks.fetchWebOpsAuditSummaryMock).toHaveBeenLastCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "wrong-token",
    })

    await unmount()
  })

  it("loads cancellation/refund reason aggregates from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Cancellation / refund reasons")
    expect(container.textContent).toContain("Enter the operator token above to load cancellation/refund reason metadata.")
    expect(mocks.fetchWebCancellationReasonSummaryMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh reasons")
    })
    await flush()

    expect(mocks.fetchWebCancellationReasonSummaryMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    const card = Array.from(container.querySelectorAll(".card"))
      .find((candidate) => candidate.textContent?.includes("Cancellation / refund reasons")) as HTMLElement
    expect(card.textContent).toContain("Reason submissions")
    expect(card.textContent).toContain("Privacy concerns")
    expect(card.textContent).toContain("Trust, disclosure, or privacy controls need work.")
    expect(card.textContent).toContain("Plans: pro 2")
    expect(card.textContent).toContain("Sources: settings 1 · refund_request 1")
    expect(card.textContent).not.toContain("demo@astra.local")
    expect(card.textContent).not.toContain("device-current")
    expect(card.textContent).not.toContain("sess_demo")
    expect(card.textContent).not.toContain("Hello, world")

    await unmount()
  })

  it("loads the read-only ops cockpit from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Ops cockpit / operating review")
    expect(container.textContent).toContain("Enter the operator token above to load the read-only ops cockpit.")
    expect(mocks.fetchWebOpsCockpitSummaryMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh cockpit")
    })
    await flush()

    expect(mocks.fetchWebOpsCockpitSummaryMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    const card = container.querySelector('[data-testid="ops-cockpit-card"]') as HTMLElement
    expect(card.textContent).toContain("Risk flags")
    expect(card.textContent).toContain("1 pause / 1 watch")
    expect(card.textContent).toContain("Cost signal")
    expect(card.textContent).toContain("high · spike")
    expect(card.textContent).toContain("Support")
    expect(card.textContent).toContain("1 urgent · 1 overdue")
    expect(card.textContent).toContain("Cohort events")
    expect(card.textContent).toContain("Cancellation feedback")
    expect(card.textContent).toContain("Privacy concerns")
    expect(card.textContent).toContain("Route health")
    expect(card.textContent).toContain("1 incident")
    expect(card.textContent).toContain("metadata-only aggregate read-only")
    expect(card.textContent).toContain("provider billing reconciliation excluded")
    expect(card.textContent).toContain("CRM replies excluded")
    expect(card.textContent).toContain("cost spike or high risk")
    expect(card.textContent).toContain("support sla risk")
    expect(card.textContent).toContain("Daily review: 2/2 evidence ready")
    expect(card.textContent).toContain("Weekly review: 4/4 evidence ready")
    expect(card.textContent).toContain("Guardrails loaded: 1")
    expect(card.textContent).not.toContain("user@example.com")
    expect(card.textContent).not.toContain("device-current")
    expect(card.textContent).not.toContain("sess_demo")
    expect(card.textContent).not.toContain("library.example")
    expect(card.textContent).not.toContain("gpt-health-pro")
    expect(card.textContent).not.toContain("Hello, world")
    expect(card.textContent).not.toContain("Checkout")
    expect(card.textContent).not.toContain("Reply to customer")

    setInputValue(container, "Operator token", "wrong-token")
    await act(async () => {
      clickButton(container, "Refresh cockpit")
    })
    await flush()
    expect(mocks.fetchWebOpsCockpitSummaryMock).toHaveBeenLastCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "wrong-token",
    })

    await unmount()
  })

  it("loads the aggregate cost-risk snapshot from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Cost risk snapshot")
    expect(container.textContent).toContain("Enter the operator token above to load aggregate cost-risk metadata.")
    expect(mocks.fetchWebCostUsageSummaryMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh cost snapshot")
    })
    await flush()

    expect(mocks.fetchWebCostUsageSummaryMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    let costCard = Array.from(container.querySelectorAll(".card"))
      .find((card) => card.textContent?.includes("Cost risk snapshot")) as HTMLElement
    expect(costCard.textContent).toContain("recent user usage events")
    expect(costCard.textContent).toContain("deep_read")
    expect(costCard.textContent).toContain("high")
    expect(costCard.textContent).toContain("Cache hit rate")
    expect(costCard.textContent).toContain("Estimated spend")
    expect(costCard.textContent).toContain("$0.0134")
    expect(costCard.textContent).toContain("Daily estimate")
    expect(costCard.textContent).toContain("high risk · spike signal")
    expect(costCard.textContent).toContain("Daily spend signal is aggregate only")
    expect(costCard.textContent).toContain("ratio 3.35×")
    expect(costCard.textContent).toContain("Cache status is aggregate only")
    expect(costCard.textContent).toContain("hit 1 (33%)")
    expect(costCard.textContent).toContain("Service-mode health is aggregate only")
    expect(costCard.textContent).not.toContain("user@example.com")
    expect(costCard.textContent).not.toContain("gpt-4.1")
    expect(costCard.textContent).not.toContain("library.example")

    setInputValue(container, "Operator token", "wrong-token")
    await act(async () => {
      clickButton(container, "Refresh cost snapshot")
    })
    await flush()
    expect(mocks.fetchWebCostUsageSummaryMock).toHaveBeenLastCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "wrong-token",
    })

    await unmount()
  })

  it("loads the provider health snapshot from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Staff route-health snapshot")
    expect(container.textContent).toContain("Enter the staff token above to load route-health metadata.")
    expect(container.textContent).not.toContain("Provider health snapshot")
    expect(mocks.fetchWebProviderHealthSummaryMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh route health")
    })
    await flush()

    expect(mocks.fetchWebProviderHealthSummaryMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    const healthCard = Array.from(container.querySelectorAll(".card"))
      .find((card) => card.textContent?.includes("Provider health snapshot")) as HTMLElement
    expect(healthCard.textContent).toContain("Staff-only route health")
    expect(healthCard.textContent).toContain("incident")
    expect(healthCard.textContent).toContain("openai")
    expect(healthCard.textContent).toContain("gpt-health-pro")
    expect(healthCard.textContent).toContain("automatic")
    expect(healthCard.textContent).toContain("deep_read")
    expect(healthCard.textContent).toContain("50%")
    expect(healthCard.textContent).toContain("1,200ms")
    expect(healthCard.textContent).not.toContain("user@example.com")
    expect(healthCard.textContent).not.toContain("library.example")
    expect(healthCard.textContent).not.toContain("Hello, world")

    setInputValue(container, "Operator token", "wrong-token")
    await act(async () => {
      clickButton(container, "Refresh route health")
    })
    await flush()
    expect(mocks.fetchWebProviderHealthSummaryMock).toHaveBeenLastCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "wrong-token",
    })

    await unmount()
  })

  it("loads support report metadata and patches triage from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Support report triage")
    expect(container.textContent).toContain("Enter the operator token above to load staff support report metadata.")
    expect(mocks.fetchWebSupportReportsMock).not.toHaveBeenCalled()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh reports")
    })
    await flush()

    expect(mocks.fetchWebSupportReportSummaryMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    expect(mocks.fetchWebSupportReportsMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    expect(container.textContent).toContain("rpt_support_1")
    expect(container.textContent).toContain("library · report_library_source · library.example")
    expect(container.textContent).toContain("Metadata only: no page text, transcript, screenshot, or user message content is shown here.")
    expect(container.textContent).toContain("Macro coverage")
    expect(container.textContent).toContain("First-response macro coverage is metadata-only: 1 of 1 reports have a matching ordinary-language macro")
    expect(container.textContent).toContain("Top macro: Saved item or review issue")
    expect(container.textContent).toContain("Weekly top issue")
    expect(container.textContent).toContain("Weekly top issue is aggregate-only: review_library on library · library.example")
    expect(container.textContent).toContain("Unresolved")
    expect(container.textContent).toContain("1 urgent")
    expect(container.textContent).toContain("Follow-up overdue")
    expect(container.textContent).toContain("SLA risk is metadata-only: unresolved 2 · urgent 1 · stale 24–72h 1 · stale 72h–7d 1 · stale 7d+ 0")
    const supportCard = Array.from(container.querySelectorAll(".card"))
      .find((card) => card.textContent?.includes("Support report triage")) as HTMLElement
    expect(supportCard.textContent).not.toContain("user@example.com")
    expect(supportCard.textContent).not.toContain("device-123")
    expect(supportCard.textContent).not.toContain("sess-123")

    setInputValue(container, "Triage status", "investigating")
    setInputValue(container, "Triage priority", "high")
    setInputValue(container, "Assigned to", "support@astra.local")
    setInputValue(container, "Updated by", "ops-test")
    setInputValue(container, "Resolution", "Linked to current import incident.")

    await act(async () => {
      clickButton(container, "Save triage")
    })
    await flush()

    expect(mocks.updateWebSupportReportTriageMock).toHaveBeenCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
      reportId: "rpt_support_1",
      patch: {
        status: "investigating",
        priority: "high",
        assignedTo: "support@astra.local",
        resolution: "Linked to current import incident.",
        updatedBy: "ops-test",
      },
    })
    expect(mocks.fetchWebSupportReportsMock).toHaveBeenLastCalledWith({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
    })
    expect(container.textContent).toContain("Updated support report rpt_support_1 triage.")

    await unmount()
  })

  it("does not show stale support reports if the operator token changes before refresh resolves", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    const supportSummary = await mocks.fetchWebSupportReportSummaryMock()
    const supportList = await mocks.fetchWebSupportReportsMock()
    mocks.fetchWebSupportReportSummaryMock.mockReset()
    mocks.fetchWebSupportReportsMock.mockReset()
    let resolveSummary: (value: typeof supportSummary) => void = () => {}
    let resolveList: (value: typeof supportList) => void = () => {}
    mocks.fetchWebSupportReportSummaryMock.mockImplementation(() => new Promise((resolve) => {
      resolveSummary = resolve
    }))
    mocks.fetchWebSupportReportsMock.mockImplementation(() => new Promise((resolve) => {
      resolveList = resolve
    }))
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh reports")
    })
    await flush()

    setInputValue(container, "Operator token", "wrong-token")
    await act(async () => {
      resolveSummary(supportSummary)
      resolveList(supportList)
    })
    await flush()

    const supportCard = Array.from(container.querySelectorAll(".card"))
      .find((card) => card.textContent?.includes("Support report triage")) as HTMLElement
    expect(supportCard.textContent).not.toContain("rpt_support_1")
    expect(supportCard.textContent).not.toContain("Weekly top issue is aggregate-only")
    expect(supportCard.textContent).not.toContain("SLA risk is metadata-only")

    await unmount()
  })

  it("shows support macro coverage as n/a for an empty metadata inbox", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    mocks.fetchWebSupportReportSummaryMock.mockResolvedValue({
      totalReports: 0,
      generatedAt: "2026-05-27T12:00:00.000Z",
      buckets: [],
      weeklyTopIssues: [],
      handoffSummary: { byPath: [], byStatus: [] },
      slaRisk: {
        generatedAt: "2026-05-27T12:00:00.000Z",
        currentNow: "2026-05-27T12:00:00.000Z",
        unresolvedCount: 0,
        urgentUnresolvedCount: 0,
        staleTriageByAgeBucket: { under24h: 0, from24hTo72h: 0, from72hTo168h: 0, over168h: 0 },
        followUpOverdueCount: 0,
        oldestUnresolvedAgeHours: null,
        oldestUnresolvedAgeDays: null,
      },
      macroCoverage: {
        schema: "astra-support-first-response-macros.v1",
        generatedAt: "2026-05-27T12:00:00.000Z",
        threshold: 0.8,
        catalogCoverage: { coveredIssueCategories: 8, totalIssueCategories: 8, coverageRate: 1, ready: true },
        reportedCoverage: { coveredReports: 0, totalReports: 0, unknownIssueReports: 0, coverageRate: null, ready: null },
        byIssueCategory: [{ issueCategory: "review_library", count: 0, macroId: "macro_review_library", title: "Saved item or review issue", covered: true }],
        macros: [],
      },
    })
    mocks.fetchWebSupportReportsMock.mockResolvedValue({
      schema: "astra-support-report-inbox.v1",
      reports: [],
    })
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    setInputValue(container, "Operator token", "operator-secret")
    await act(async () => {
      clickButton(container, "Refresh reports")
    })
    await flush()

    expect(container.textContent).toContain("No support reports are currently in the metadata inbox.")
    expect(container.textContent).toContain("First-response macro coverage is metadata-only: n/a until support reports are submitted.")
    expect(container.textContent).toContain("Catalog coverage covers 8 of 8 issue categories.")
    expect(container.textContent).not.toContain("Top macro:")

    await unmount()
  })

  it("loads feature flag runtime and updates a kill-switch fallback from the account operator panel", async () => {
    const session = createSession()
    mocks.readWebSessionMock.mockReturnValue(session)
    mocks.refreshWebSessionMock.mockResolvedValue(session)
    window.location.hash = "#/account"

    const { container, unmount } = await renderApp()

    expect(container.textContent).toContain("Feature flags / kill switches")
    expect(mocks.fetchWebFeatureFlagRuntimeMock).toHaveBeenCalledWith({ baseURL: "http://127.0.0.1:8787/v1" })
    expect(container.textContent).toContain("Initial runtime")
    expect(container.textContent).toContain("Fallback text must be ordinary user-facing copy")

    setInputValue(container, "Operator token", "operator-secret")
    setInputValue(container, "Kill-switch id", "incident-fallback-copy")
    setInputValue(container, "Category", "feature")
    setInputValue(container, "Reason", "Managed AI incident")
    setInputValue(container, "Changed by", "ops-test")
    setInputValue(container, "Fallback message", "Astra is temporarily using a simpler explanation. Please try again later.")

    await act(async () => {
      clickButton(container, "Save kill switch")
    })
    await flush()

    expect(mocks.updateWebFeatureFlagRuntimeMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "http://127.0.0.1:8787/v1",
      operatorToken: "operator-secret",
      runtime: expect.objectContaining({
        schema: "astra-feature-flag-runtime.v1",
        overrides: [{ key: "ui.library_home", status: "on", reason: "test", changedBy: "ops", changedAt: "2026-05-27T11:00:00.000Z" }],
        changeLog: expect.arrayContaining([
          expect.objectContaining({
            changedBy: "ops-test",
            reason: "Managed AI incident",
            overrideCount: 1,
            killSwitchCount: 2,
            previousGeneratedAt: "2026-05-27T12:00:00.000Z",
          }),
          {
            id: "chg_1",
            changedAt: "2026-05-27T12:00:00.000Z",
            changedBy: "ops",
            reason: "Initial runtime",
            overrideCount: 1,
            killSwitchCount: 1,
            previousGeneratedAt: null,
          },
        ]),
      }),
    }))
    const payload = mocks.updateWebFeatureFlagRuntimeMock.mock.calls[0][0].runtime
    expect(payload.killSwitches[0]).toEqual({
      id: "incident-fallback-copy",
      category: "feature",
      enabled: true,
      reason: "Managed AI incident",
      fallbackMessage: "Astra is temporarily using a simpler explanation. Please try again later.",
      safeMode: true,
    })
    expect(payload.killSwitches[1].id).toBe("incident-existing")
    expect(container.textContent).toContain("Updated kill switch incident-fallback-copy by ops-test.")

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
    expect(container.textContent).toContain("Cloud sync repair refreshed 2 materialized records across 5 collections.")
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
    await flush()

    expect(container.textContent).toContain("Pro plan")
    expect(container.textContent).toContain("Astra account summary")
    expect(container.textContent).toContain("account summary, devices, and sync state")
    expect(container.textContent).toContain("Cloud console snapshot")
    expect(container.textContent).toContain("This is the latest fetched snapshot")
    expect(container.textContent).toContain("Saved workspace library")
    expect(container.textContent).toContain("local resume surface")

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
    await flush()

    expect(container.textContent).toContain("Cloud and local asset detail pages")
    expect(container.textContent).toContain("Reading history asset details")
    expect(container.textContent).toContain("Import queue status details")

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

    expect(render.container.textContent).toContain("Readable Import Title")

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

    await flush()
    expect(render.container.textContent).toContain("reader.pdf")

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
    await flush()

    expect(render.container.textContent).toContain("Mock EPUB")

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
