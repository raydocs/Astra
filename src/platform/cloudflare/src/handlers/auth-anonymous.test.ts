import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, AuthIssueMode } from "../env"

const {
  proxyToNodeRelayMock,
  postNodeMirrorJsonMock,
  recordPlatformParityEventLaterMock,
  recordPlatformRouteEventLaterMock,
  getAuthIssueRequestMock,
  createPendingAuthIssueRequestMock,
  markAuthIssueRequestCompletedMock,
  markAuthIssueRequestFailedMock,
  getShadowDeviceMock,
  upsertShadowDeviceMock,
  getShadowSessionByIdMock,
  upsertShadowSessionMock,
  getShadowUserUsageByUserIdMock,
  upsertShadowUserUsageMock,
  createShadowAnonymousUserMock,
  getShadowUserByIdMock,
  getShadowUserByInstallIdMock,
} = vi.hoisted(() => ({
  proxyToNodeRelayMock: vi.fn(),
  postNodeMirrorJsonMock: vi.fn(),
  recordPlatformParityEventLaterMock: vi.fn(),
  recordPlatformRouteEventLaterMock: vi.fn(),
  getAuthIssueRequestMock: vi.fn(),
  createPendingAuthIssueRequestMock: vi.fn(),
  markAuthIssueRequestCompletedMock: vi.fn(),
  markAuthIssueRequestFailedMock: vi.fn(),
  getShadowDeviceMock: vi.fn(),
  upsertShadowDeviceMock: vi.fn(),
  getShadowSessionByIdMock: vi.fn(),
  upsertShadowSessionMock: vi.fn(),
  getShadowUserUsageByUserIdMock: vi.fn(),
  upsertShadowUserUsageMock: vi.fn(),
  createShadowAnonymousUserMock: vi.fn(),
  getShadowUserByIdMock: vi.fn(),
  getShadowUserByInstallIdMock: vi.fn(),
}))

vi.mock("../lib/proxy", () => ({
  proxyToNodeRelay: proxyToNodeRelayMock,
}))

vi.mock("../lib/node-mirror", () => ({
  NodeMirrorConfigError: class NodeMirrorConfigError extends Error {},
  postNodeMirrorJson: postNodeMirrorJsonMock,
}))

vi.mock("../lib/platform-ops", () => ({
  recordPlatformParityEventLater: recordPlatformParityEventLaterMock,
  recordPlatformRouteEventLater: recordPlatformRouteEventLaterMock,
}))

vi.mock("../repositories/auth-issue-requests", () => ({
  getAuthIssueRequest: getAuthIssueRequestMock,
  createPendingAuthIssueRequest: createPendingAuthIssueRequestMock,
  markAuthIssueRequestCompleted: markAuthIssueRequestCompletedMock,
  markAuthIssueRequestFailed: markAuthIssueRequestFailedMock,
}))

vi.mock("../repositories/devices", () => ({
  getShadowDevice: getShadowDeviceMock,
  upsertShadowDevice: upsertShadowDeviceMock,
}))

vi.mock("../repositories/sessions", () => ({
  getShadowSessionById: getShadowSessionByIdMock,
  upsertShadowSession: upsertShadowSessionMock,
}))

vi.mock("../repositories/user-usage", () => ({
  getShadowUserUsageByUserId: getShadowUserUsageByUserIdMock,
  upsertShadowUserUsage: upsertShadowUserUsageMock,
}))

vi.mock("../repositories/users", () => ({
  createShadowAnonymousUser: createShadowAnonymousUserMock,
  getShadowUserById: getShadowUserByIdMock,
  getShadowUserByInstallId: getShadowUserByInstallIdMock,
}))

import { handleAuthAnonymous, resetAnonymousIssueRateLimits } from "./auth-anonymous"

const NOW_ISO = "2026-04-12T12:00:00.000Z"

function createEnv(mode: AuthIssueMode = "native"): AstraPlatformEnv {
  return {
    ASTRA_PLATFORM_DB: {} as AstraPlatformEnv["ASTRA_PLATFORM_DB"],
    ASTRA_IMPORT_PAYLOADS: {
      put: vi.fn(async () => {}),
      head: vi.fn(async () => null),
    } as AstraPlatformEnv["ASTRA_IMPORT_PAYLOADS"],
    ASTRA_IDEMPOTENCY_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    } as AstraPlatformEnv["ASTRA_IDEMPOTENCY_KV"],
    ARTICLE_IMPORT_QUEUE: {
      send: vi.fn(async () => {}),
    } as AstraPlatformEnv["ARTICLE_IMPORT_QUEUE"],
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ASTRA_SESSION_SECRET: "test-session-secret",
    ASTRA_PLATFORM_MIRROR_SECRET: "mirror-secret",
    ASTRA_FREE_DAILY_REQUESTS: "200",
    ASTRA_FREE_DAILY_CHARACTERS: "200000",
    ASTRA_FREE_RPM: "20",
    ASTRA_SESSION_TTL_MS: String(30 * 24 * 60 * 60 * 1000),
    AUTH_ANONYMOUS_ISSUE_MODE: mode,
    AUTH_SESSION_ISSUE_MODE: "proxy",
    AUTH_SESSION_READ_MODE: "proxy",
    AUTH_SESSION_REVOKE_WRITE_MODE: "proxy",
    SESSION_PUBLIC_BASE_URL: "https://platform.astra.example/v1",
    ARTICLE_IMPORT_MODE: "proxy",
    ACCOUNT_SUMMARY_READ_MODE: "proxy",
    DEVICE_LIST_READ_MODE: "proxy",
    DEVICE_REVOKE_WRITE_MODE: "proxy",
    SYNC_BOOTSTRAP_READ_MODE: "proxy",
    SYNC_PULL_READ_MODE: "proxy",
    SYNC_PUSH_WRITE_MODE: "proxy",
    ASTRA_ENV: "test",
  }
}

function createContext(mode: AuthIssueMode = "native") {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_auth_anon_test",
    nowEpochMs: Date.parse(NOW_ISO),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      platformMirrorSecret: "mirror-secret",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      authAnonymousIssueMode: mode,
      authSessionIssueMode: "proxy",
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: "proxy",
      deviceListReadMode: "proxy",
      deviceRevokeWriteMode: "proxy",
      syncBootstrapReadMode: "proxy",
      syncPullReadMode: "proxy",
      syncPushWriteMode: "proxy",
      syncMaxMutationsPerRequest: 200,
      articleImportAllowedHosts: [],
      articleImportBlockedHosts: [],
      articleImportForceProxyHosts: [],
      articleImportRateLimitMax: null,
      articleImportRateLimitWindowSeconds: 60,
      articleImportMaxQueueAttempts: 3,
      articleImportMaxShadowBytes: 262_144,
      articleImportMaxNativeBytes: 2_097_152,
      articleImportArtifactRetentionDays: 7,
      articleImportArtifactRetentionClass: "import-shadow",
      continuityExportArtifactRetentionDays: 7,
      continuityDeleteGracePeriodSeconds: 604_800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: true,
    },
    execution: {
      waitUntil,
    },
  }

  return {
    ctx,
    async flushWaitUntil() {
      await Promise.allSettled(pending.splice(0))
    },
  }
}

function createAnonymousRequest(options: { idempotencyKey?: string; installId?: string; deviceId?: string } = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Astra-Device-Id": options.deviceId ?? "device-anon-1",
  })
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey)
  }

  return new Request("https://platform.astra.example/v1/auth/anonymous", {
    method: "POST",
    headers,
    body: JSON.stringify({
      deviceId: options.deviceId ?? "device-anon-1",
      installId: options.installId ?? options.deviceId ?? "device-anon-1",
      device: {
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "1.0.0-test",
      },
    }),
  })
}

function buildAnonymousUser(installId = "device-anon-1") {
  return {
    id: "usr_anon_demo",
    email: "anon_demo@astra.anonymous",
    billingEmail: "anon_demo@astra.anonymous",
    createdAt: NOW_ISO,
    plan: "free" as const,
    subscriptionStatus: "active" as const,
    identityMode: "anonymous" as const,
    installId,
    providerEntitlements: ["openai"],
    syncPreferences: {
      reading_history: false,
      study_progress: false,
    },
    shadowUpdatedAt: NOW_ISO,
  }
}

function buildUsage(userId = "usr_anon_demo") {
  return {
    userId,
    usageDay: "2026-04-12",
    dailyRequestsLimit: 200,
    dailyCharactersLimit: 200_000,
    requestsPerMinuteLimit: 20,
    requestsToday: 0,
    charactersToday: 0,
    totalRequests: 0,
    totalCharacters: 0,
    lastRequestAt: null,
    recentEvents: [],
    shadowUpdatedAt: NOW_ISO,
  }
}

beforeEach(() => {
  proxyToNodeRelayMock.mockReset()
  postNodeMirrorJsonMock.mockReset()
  recordPlatformParityEventLaterMock.mockReset()
  recordPlatformRouteEventLaterMock.mockReset()
  getAuthIssueRequestMock.mockReset()
  createPendingAuthIssueRequestMock.mockReset()
  markAuthIssueRequestCompletedMock.mockReset()
  markAuthIssueRequestFailedMock.mockReset()
  getShadowDeviceMock.mockReset()
  upsertShadowDeviceMock.mockReset()
  getShadowSessionByIdMock.mockReset()
  upsertShadowSessionMock.mockReset()
  getShadowUserUsageByUserIdMock.mockReset()
  upsertShadowUserUsageMock.mockReset()
  createShadowAnonymousUserMock.mockReset()
  getShadowUserByIdMock.mockReset()
  getShadowUserByInstallIdMock.mockReset()

  createPendingAuthIssueRequestMock.mockImplementation(async (_db, snapshot) => snapshot)
  upsertShadowUserUsageMock.mockImplementation(async (_db, snapshot) => snapshot)
  upsertShadowDeviceMock.mockImplementation(async (_db, snapshot) => ({
    id: `${snapshot.userId}:${snapshot.deviceId}`,
    ...snapshot,
  }))
  upsertShadowSessionMock.mockImplementation(async (_db, snapshot) => snapshot)
  markAuthIssueRequestCompletedMock.mockResolvedValue(undefined)
  markAuthIssueRequestFailedMock.mockResolvedValue(undefined)
  recordPlatformParityEventLaterMock.mockReturnValue(undefined)
  recordPlatformRouteEventLaterMock.mockReturnValue(undefined)

  resetAnonymousIssueRateLimits()
})

afterEach(() => {
  vi.restoreAllMocks()
  resetAnonymousIssueRateLimits()
})

describe("handleAuthAnonymous", () => {
  it("proxies live Node behavior in proxy mode", async () => {
    proxyToNodeRelayMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const env = createEnv("proxy")
    const { ctx } = createContext("proxy")
    const response = await handleAuthAnonymous(createAnonymousRequest(), env, ctx)

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("proxy")
    expect(proxyToNodeRelayMock).toHaveBeenCalledTimes(1)
  })

  it("runs shadow preflight without minting a second session", async () => {
    proxyToNodeRelayMock.mockResolvedValue(new Response(JSON.stringify({
      sessionToken: "node-session-token",
      relayBaseURL: "https://platform.astra.example/v1",
      email: "anon@shadow.example",
      identityMode: "anonymous",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    getShadowUserByInstallIdMock.mockResolvedValue(buildAnonymousUser())
    getShadowUserUsageByUserIdMock.mockResolvedValue(buildUsage())

    const env = createEnv("shadow")
    const { ctx, flushWaitUntil } = createContext("shadow")
    const response = await handleAuthAnonymous(createAnonymousRequest(), env, ctx)
    await flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(proxyToNodeRelayMock).toHaveBeenCalledTimes(1)
    expect(getShadowUserByInstallIdMock).toHaveBeenCalledWith(env.ASTRA_PLATFORM_DB, "device-anon-1")
    expect(createShadowAnonymousUserMock).not.toHaveBeenCalled()
    expect(upsertShadowSessionMock).not.toHaveBeenCalled()
    expect(postNodeMirrorJsonMock).not.toHaveBeenCalled()
  })

  it("requires Idempotency-Key in native mode", async () => {
    const env = createEnv("native")
    const { ctx } = createContext("native")
    const response = await handleAuthAnonymous(createAnonymousRequest({ idempotencyKey: undefined }), env, ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("INVALID_REQUEST")
    expect(postNodeMirrorJsonMock).not.toHaveBeenCalled()
  })

  it("mints a native anonymous session and replays the same session for a completed key", async () => {
    const env = createEnv("native")
    const { ctx } = createContext("native")
    const user = buildAnonymousUser()
    const usage = buildUsage(user.id)

    getAuthIssueRequestMock.mockResolvedValueOnce(null)
    getShadowUserByInstallIdMock.mockResolvedValueOnce(null)
    createShadowAnonymousUserMock.mockResolvedValueOnce(user)
    getShadowUserUsageByUserIdMock.mockResolvedValueOnce(null)
    getShadowDeviceMock.mockResolvedValueOnce(null)
    postNodeMirrorJsonMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    const request = createAnonymousRequest({ idempotencyKey: "idem-anon-1" })
    const response = await handleAuthAnonymous(request, env, ctx)
    const firstSession = await response.json() as { sessionId: string; sessionToken: string; deviceId: string }

    expect(response.status).toBe(200)
    expect(firstSession.deviceId).toBe("device-anon-1")
    expect(postNodeMirrorJsonMock).toHaveBeenCalledTimes(1)

    const pending = createPendingAuthIssueRequestMock.mock.calls[0]?.[1] as {
      requestKey: string
      userId: string
      installId: string
      deviceId: string
      sessionId: string
      routeKind: "anonymous"
      createdAt: string
      lastAttemptAt: string
      shadowUpdatedAt: string
    }
    const sessionSnapshot = upsertShadowSessionMock.mock.calls[0]?.[1] as {
      sessionId: string
      userId: string
      deviceId: string
      identityMode: "anonymous"
      issuedAt: string
      expiresAt: string | null
      createdAt: string
      lastSeenAt: string
      lastVerifiedAt: string | null
      status: "active"
      revokedAt: string | null
      tokenHash: string | null
      tokenHashAlg: string | null
      shadowUpdatedAt: string
    }

    getAuthIssueRequestMock.mockResolvedValueOnce({
      ...pending,
      nodeMirrorStatus: "completed",
      completedAt: pending.createdAt,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    })
    getShadowUserByIdMock.mockResolvedValueOnce(user)
    getShadowSessionByIdMock.mockResolvedValueOnce(sessionSnapshot)
    getShadowUserUsageByUserIdMock.mockResolvedValueOnce(usage)

    const replayResponse = await handleAuthAnonymous(createAnonymousRequest({ idempotencyKey: "idem-anon-1" }), env, ctx)
    const replaySession = await replayResponse.json() as { sessionId: string; sessionToken: string }

    expect(replayResponse.status).toBe(200)
    expect(replayResponse.headers.get("x-astra-platform-route")).toBe("native-idempotent-replay")
    expect(replaySession.sessionId).toBe(firstSession.sessionId)
    expect(replaySession.sessionToken).toBe(firstSession.sessionToken)
    expect(postNodeMirrorJsonMock).toHaveBeenCalledTimes(1)
  })

  it("returns a guarded 503 on ambiguous mirror-back and succeeds when retried with the same key", async () => {
    const env = createEnv("native")
    const { ctx } = createContext("native")
    const user = buildAnonymousUser()
    const usage = buildUsage(user.id)

    getAuthIssueRequestMock.mockResolvedValueOnce(null)
    getShadowUserByInstallIdMock.mockResolvedValueOnce(null)
    createShadowAnonymousUserMock.mockResolvedValueOnce(user)
    getShadowUserUsageByUserIdMock.mockResolvedValueOnce(null)
    getShadowDeviceMock.mockResolvedValueOnce(null)
    postNodeMirrorJsonMock.mockRejectedValueOnce(new Error("network timeout"))

    const firstResponse = await handleAuthAnonymous(createAnonymousRequest({ idempotencyKey: "idem-anon-2" }), env, ctx)
    const firstPayload = await firstResponse.json() as { error: { code: string } }

    expect(firstResponse.status).toBe(503)
    expect(firstPayload.error.code).toBe("UPSTREAM_UNAVAILABLE")
    expect(firstResponse.headers.get("x-astra-platform-fallback-reason")).toBe("mirror_back_commit_unknown")

    const pending = createPendingAuthIssueRequestMock.mock.calls[0]?.[1] as {
      requestKey: string
      userId: string
      installId: string
      deviceId: string
      sessionId: string
      routeKind: "anonymous"
      createdAt: string
      lastAttemptAt: string
      shadowUpdatedAt: string
    }
    const sessionSnapshot = upsertShadowSessionMock.mock.calls[0]?.[1] as {
      sessionId: string
      userId: string
      deviceId: string
      identityMode: "anonymous"
      issuedAt: string
      expiresAt: string | null
      createdAt: string
      lastSeenAt: string
      lastVerifiedAt: string | null
      status: "active"
      revokedAt: string | null
      tokenHash: string | null
      tokenHashAlg: string | null
      shadowUpdatedAt: string
    }
    const deviceSnapshot = upsertShadowDeviceMock.mock.calls[0]?.[1] as {
      userId: string
      deviceId: string
      identityMode: "anonymous"
      label: string
      platform: string | null
      browserFamily: string | null
      appKind: string
      appVersion: string | null
      firstSeenAt: string
      lastSeenAt: string
      lastSyncAt: string | null
      status: "active"
      revokedAt: string | null
      updatedAt: string
      shadowUpdatedAt: string
    }

    getAuthIssueRequestMock.mockResolvedValueOnce({
      ...pending,
      nodeMirrorStatus: "pending",
      completedAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    })
    getShadowUserByIdMock.mockResolvedValueOnce(user)
    getShadowSessionByIdMock.mockResolvedValueOnce(sessionSnapshot)
    getShadowUserUsageByUserIdMock.mockResolvedValueOnce(usage)
    getShadowDeviceMock.mockResolvedValueOnce({
      id: `${deviceSnapshot.userId}:${deviceSnapshot.deviceId}`,
      ...deviceSnapshot,
    })
    postNodeMirrorJsonMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    const retryResponse = await handleAuthAnonymous(createAnonymousRequest({ idempotencyKey: "idem-anon-2" }), env, ctx)
    const retrySession = await retryResponse.json() as { sessionId: string; deviceId: string }

    expect(retryResponse.status).toBe(200)
    expect(retryResponse.headers.get("x-astra-platform-route")).toBe("native-idempotent-replay")
    expect(retrySession.sessionId).toBe(sessionSnapshot.sessionId)
    expect(retrySession.deviceId).toBe(sessionSnapshot.deviceId)
    expect(markAuthIssueRequestCompletedMock).toHaveBeenCalledTimes(1)
  })
})
