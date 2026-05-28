import { afterEach, describe, expect, it, vi } from "vitest"

import type { D1PreparedStatement, D1RunResult } from "../bindings"
import type { AstraRequestContext } from "../context"
import type {
  AstraPlatformEnv,
  AuthIssueMode,
  AuthSessionReadMode,
  AuthSessionRevokeWriteMode,
} from "../env"
import { handleAuthSession } from "./auth-session"

interface QueryRecord {
  sql: string
  bindings: unknown[]
}

const SESSION_SECRET = "test-session-secret"
const SESSION_TOKEN = "eyJlbWFpbCI6ImRlbW9AYXN0cmEubG9jYWwiLCJyZWxheUJhc2VVUkwiOiJodHRwczovL3JlbGF5LmFzdHJhLmV4YW1wbGUvdjEiLCJpc3N1ZWRBdCI6IjIwMjYtMDQtMTBUMDA6MDA6MDAuMDAwWiIsImV4cGlyZXNBdCI6IjIwMjYtMDQtMTJUMDA6MDA6MDAuMDAwWiIsInNlc3Npb25JZCI6InNlc3NfZGVtbyIsImRldmljZUlkIjoiZGV2aWNlLWN1cnJlbnQiLCJpZGVudGl0eU1vZGUiOiJhdXRoZW50aWNhdGVkIn0.HQInEhUDwUBGgxZAdkUoM0sOjTxQlPSDx9hP1ALSciE"
const MIRRORED_USAGE_EVENT = {
  timestamp: "2026-04-11T11:54:00.000Z",
  provider: "openai",
  serviceMode: "fast",
  requestCount: 1,
  characterCount: 42,
  model: "gpt-4.1-nano",
  task: "translate",
  textCount: 1,
  durationMs: 180,
  taskClass: "paragraph_understanding",
  costBucket: "medium",
  latencyBucket: "fast",
  cacheStatus: "disabled",
  fallbackReason: "none",
  tier: "pro",
  surface: "page",
  contentLengthBucket: "short",
  providerRoute: "direct",
  fallbackUsed: false,
  success: true,
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function createMockDb() {
  const queries: QueryRecord[] = []
  const firstResults = new Map<string, unknown[]>()

  function getKey(sql: string): string {
    if (sql.includes("FROM shadow_user_credentials")) return "shadow_user_credentials"
    if (sql.includes("FROM auth_issue_requests")) return "auth_issue_requests"
    if (sql.includes("FROM shadow_users")) return "shadow_users"
    if (sql.includes("FROM shadow_auth_sessions")) return "shadow_auth_sessions"
    if (sql.includes("FROM shadow_devices")) return "shadow_devices"
    if (sql.includes("FROM shadow_user_usage")) return "shadow_user_usage"
    return "other"
  }

  const db = {
    prepare: vi.fn((sql: string) => {
      const record: QueryRecord = {
        sql: normalizeSql(sql),
        bindings: [],
      }
      queries.push(record)

      const statement: D1PreparedStatement = {
        bind(...values: unknown[]) {
          record.bindings = values
          return statement
        },
        async run<T = Record<string, unknown>>() {
          return { success: true, meta: { changes: 1 } } as D1RunResult<T>
        },
        async all<T = Record<string, unknown>>() {
          return {
            success: true,
            results: [] as T[],
            meta: { changes: 0 },
          } as D1RunResult<T>
        },
        async first<T = Record<string, unknown>>() {
          const key = getKey(record.sql)
          const queue = firstResults.get(key) ?? []
          const next = (queue.shift() ?? null) as T | null
          firstResults.set(key, queue)
          return next
        },
      }

      return statement
    }),
  }

  return {
    db,
    queries,
    enqueueFirst(key: "shadow_users" | "shadow_user_credentials" | "auth_issue_requests" | "shadow_auth_sessions" | "shadow_devices" | "shadow_user_usage", value: unknown) {
      const bucket = firstResults.get(key) ?? []
      bucket.push(value)
      firstResults.set(key, bucket)
    },
  }
}

function createEnv(
  readMode: AuthSessionReadMode,
  revokeMode: AuthSessionRevokeWriteMode,
  issueMode: AuthIssueMode = "proxy",
  mockDb = createMockDb(),
) {
  const env: AstraPlatformEnv = {
    ASTRA_PLATFORM_DB: mockDb.db,
    ASTRA_IMPORT_PAYLOADS: {
      put: vi.fn(async () => {}),
      head: vi.fn(async () => null),
    },
    ASTRA_IDEMPOTENCY_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    ARTICLE_IMPORT_QUEUE: {
      send: vi.fn(async () => {}),
    },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ASTRA_SESSION_SECRET: SESSION_SECRET,
    ASTRA_PLATFORM_MIRROR_SECRET: "mirror-secret",
    ASTRA_SESSION_TTL_MS: String(30 * 24 * 60 * 60 * 1000),
    ARTICLE_IMPORT_MODE: "proxy",
    AUTH_SESSION_ISSUE_MODE: issueMode,
    AUTH_SESSION_READ_MODE: readMode,
    AUTH_SESSION_REVOKE_WRITE_MODE: revokeMode,
    SESSION_PUBLIC_BASE_URL: "https://platform.astra.example/v1",
    ACCOUNT_SUMMARY_READ_MODE: "proxy",
    DEVICE_LIST_READ_MODE: "proxy",
    DEVICE_REVOKE_WRITE_MODE: "proxy",
    SYNC_BOOTSTRAP_READ_MODE: "proxy",
    SYNC_PULL_READ_MODE: "proxy",
    SYNC_PUSH_WRITE_MODE: "proxy",
    ASTRA_ENV: "test",
  }

  return { env, mockDb }
}

function createContext(
  readMode: AuthSessionReadMode,
  revokeMode: AuthSessionRevokeWriteMode,
  issueMode: AuthIssueMode = "proxy",
) {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_auth_session_test",
    nowEpochMs: Date.parse("2026-04-11T12:00:00.000Z"),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      platformMirrorSecret: "mirror-secret",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      authAnonymousIssueMode: "proxy",
      authSessionIssueMode: issueMode,
      authSessionReadMode: readMode,
      authSessionRevokeWriteMode: revokeMode,
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
    waitUntil,
    async flushWaitUntil() {
      await Promise.allSettled(pending.splice(0))
    },
  }
}

function createRequest(method: "GET" | "DELETE" = "GET") {
  return new Request("https://platform.astra.example/v1/auth/session", {
    method,
    headers: {
      Authorization: `Bearer ${SESSION_TOKEN}`,
      "X-Astra-Device-Id": "device-current",
    },
  })
}

function createLoginRequest(options: {
  email?: string
  password?: string
  deviceId?: string
  idempotencyKey?: string | null
} = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Astra-Device-Id": options.deviceId ?? "device-current",
  }
  if (options.idempotencyKey !== null) {
    headers["Idempotency-Key"] = options.idempotencyKey ?? "login-key-1"
  }

  return new Request("https://platform.astra.example/v1/auth/session", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: options.email ?? "demo@astra.local",
      password: options.password ?? "astra-demo-pass",
      deviceId: options.deviceId ?? "device-current",
      device: {
        label: "Astra Chrome",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0",
      },
    }),
  })
}

function createSessionPayload() {
  return {
    version: 1,
    sessionToken: SESSION_TOKEN,
    sessionId: "sess_demo",
    deviceId: "device-current",
    identityMode: "authenticated",
    relayBaseURL: "https://relay.astra.example/v1",
    email: "demo@astra.local",
    plan: "pro",
    subscriptionStatus: "active",
    providerEntitlements: ["openai", "gemini"],
    quota: {
      dailyRequestsLimit: 100,
      dailyCharactersLimit: 1000,
      requestsPerMinuteLimit: 10,
      remainingDailyRequests: 90,
      remainingDailyCharacters: 900,
    },
    usage: {
      totalRequests: 50,
      totalCharacters: 500,
      dailyRequestsUsed: 10,
      dailyCharactersUsed: 100,
      lastRequestAt: null,
      recentEvents: [],
    },
    issuedAt: "2026-04-10T00:00:00.000Z",
    expiresAt: "2026-04-12T00:00:00.000Z",
  }
}

function enqueueShadowCredential(mockDb: ReturnType<typeof createMockDb>, passwordHash = "764543b1452ae5c0fdc9016eda114ba1427e22fedda67789f5b03c0c3df30720") {
  mockDb.enqueueFirst("shadow_user_credentials", {
    user_id: "usr_demo",
    credential_kind: "password",
    password_hash: passwordHash,
    password_hash_alg: "sha256_v1",
    updated_at: "2026-04-10T00:00:00.000Z",
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  })
}

function enqueueShadowState(mockDb: ReturnType<typeof createMockDb>, options: { includeUsage?: boolean } = {}) {
  mockDb.enqueueFirst("shadow_users", {
    id: "usr_demo",
    email: "demo@astra.local",
    billing_email: "billing@astra.local",
    created_at: "2026-04-01T00:00:00.000Z",
    plan: "pro",
    subscription_status: "active",
    identity_mode: "authenticated",
    install_id: null,
    provider_entitlements_json: JSON.stringify(["openai", "gemini"]),
    reading_history_sync_enabled: 1,
    study_progress_sync_enabled: 1,
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  })
  mockDb.enqueueFirst("shadow_auth_sessions", {
    session_id: "sess_demo",
    user_id: "usr_demo",
    device_id: "device-current",
    identity_mode: "authenticated",
    token_hash: null,
    token_hash_alg: null,
    issued_at: "2026-04-10T00:00:00.000Z",
    expires_at: "2026-04-12T00:00:00.000Z",
    created_at: "2026-04-10T00:00:00.000Z",
    last_seen_at: "2026-04-11T11:55:00.000Z",
    last_verified_at: "2026-04-11T11:55:00.000Z",
    status: "active",
    revoked_at: null,
    shadow_updated_at: "2026-04-11T11:55:00.000Z",
  })
  mockDb.enqueueFirst("shadow_devices", {
    id: "usr_demo:device-current",
    user_id: "usr_demo",
    device_id: "device-current",
    identity_mode: "authenticated",
    label: "Astra Chrome",
    platform: "macos",
    browser_family: "chrome",
    app_kind: "extension",
    app_version: "0.1.0",
    first_seen_at: "2026-04-07T00:00:00.000Z",
    last_seen_at: "2026-04-11T11:55:00.000Z",
    last_sync_at: "2026-04-10T11:30:00.000Z",
    status: "active",
    revoked_at: null,
    updated_at: "2026-04-11T11:55:00.000Z",
    shadow_updated_at: "2026-04-11T11:55:00.000Z",
  })
  if (options.includeUsage !== false) {
    mockDb.enqueueFirst("shadow_user_usage", {
      user_id: "usr_demo",
      usage_day: "2026-04-11",
      daily_requests_limit: 100,
      daily_characters_limit: 1000,
      requests_per_minute_limit: 10,
      requests_today: 10,
      characters_today: 100,
      total_requests: 50,
      total_characters: 500,
      last_request_at: null,
      recent_events_json: JSON.stringify([MIRRORED_USAGE_EVENT]),
      shadow_updated_at: "2026-04-11T11:55:00.000Z",
    })
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("handleAuthSession", () => {
  it("proxies GET auth/session reads in proxy mode", async () => {
    const { env } = createEnv("proxy", "proxy")
    const context = createContext("proxy", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSessionPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createRequest("GET"), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSessionPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-domain")).toBe("auth-session")
    expect(payload.sessionId).toBe("sess_demo")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps shadow GET auth/session reads proxied while comparing D1 in the background", async () => {
    const { env, mockDb } = createEnv("shadow", "proxy")
    enqueueShadowState(mockDb)
    const context = createContext("shadow", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSessionPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createRequest("GET"), env, context.ctx)
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("FROM shadow_user_usage"))).toBe(true)
  })

  it("serves GET auth/session reads natively from D1 and compares to Node in the background", async () => {
    const { env, mockDb } = createEnv("native", "proxy")
    enqueueShadowState(mockDb)
    const context = createContext("native", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSessionPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createRequest("GET"), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSessionPayload>
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(payload.plan).toBe("pro")
    expect(payload.usage.totalRequests).toBe(50)
    const mirroredEvent = payload.usage.recentEvents[0] as Record<string, unknown> | undefined
    expect(mirroredEvent).toMatchObject({
      serviceMode: "fast",
      model: "gpt-4.1-nano",
      taskClass: "paragraph_understanding",
      costBucket: "medium",
      providerRoute: "direct",
      fallbackUsed: false,
      success: true,
      durationMs: 180,
    })
    expect(JSON.stringify(mirroredEvent)).not.toContain("hello")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("returns a local auth/session error when Worker-native validation rejects GET", async () => {
    const { env } = createEnv("native", "proxy")
    const context = createContext("native", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const request = new Request("https://platform.astra.example/v1/auth/session", {
      method: "GET",
      headers: {
        "X-Astra-Device-Id": "device-current",
      },
    })

    const response = await handleAuthSession(request, env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-auth-gate")
    expect(payload.error.code).toBe("SESSION_REQUIRED")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("falls back to proxy when GET auth/session native state is incomplete", async () => {
    const { env, mockDb } = createEnv("native", "proxy")
    enqueueShadowState(mockDb, { includeUsage: false })
    const context = createContext("native", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSessionPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createRequest("GET"), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSessionPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_shadow_user_usage")
    expect(payload.sessionId).toBe("sess_demo")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("proxies POST auth/session issuance in proxy mode", async () => {
    const { env } = createEnv("proxy", "proxy", "proxy")
    const context = createContext("proxy", "proxy", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSessionPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createLoginRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSessionPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(payload.sessionId).toBe("sess_demo")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps shadow POST auth/session issuance proxied while preflighting D1", async () => {
    const { env, mockDb } = createEnv("proxy", "proxy", "shadow")
    enqueueShadowState(mockDb)
    enqueueShadowCredential(mockDb)
    const context = createContext("proxy", "proxy", "shadow")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ...createSessionPayload(),
      relayBaseURL: "https://platform.astra.example/v1",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createLoginRequest(), env, context.ctx)
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("FROM shadow_user_credentials"))).toBe(true)
    expect(mockDb.queries.some((query) => query.sql.includes("INSERT INTO auth_issue_requests"))).toBe(false)
    expect(mockDb.queries.some((query) => query.sql.includes("INSERT INTO shadow_auth_sessions"))).toBe(false)
  })

  it("requires Idempotency-Key for native POST auth/session issuance", async () => {
    const { env } = createEnv("proxy", "proxy", "native")
    const context = createContext("proxy", "proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await handleAuthSession(createLoginRequest({ idempotencyKey: null }), env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-validation")
    expect(payload.error.code).toBe("INVALID_REQUEST")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("mints a native authenticated session and replays the same session for a completed key", async () => {
    const { env, mockDb } = createEnv("proxy", "proxy", "native")
    enqueueShadowState(mockDb)
    enqueueShadowCredential(mockDb)
    mockDb.enqueueFirst("auth_issue_requests", null)
    const context = createContext("proxy", "proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }))

    const firstResponse = await handleAuthSession(createLoginRequest({ idempotencyKey: "login-key-1" }), env, context.ctx)
    const firstPayload = await firstResponse.json() as ReturnType<typeof createSessionPayload>

    expect(firstResponse.status).toBe(200)
    expect(firstResponse.headers.get("x-astra-platform-route")).toBe("native")
    expect(firstPayload.deviceId).toBe("device-current")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("INSERT INTO auth_issue_requests"))).toBe(true)
    expect(mockDb.queries.some((query) => query.sql.includes("INSERT INTO shadow_auth_sessions"))).toBe(true)
    const sessionInsert = mockDb.queries.find((query) => query.sql.includes("INSERT INTO shadow_auth_sessions"))
    expect(sessionInsert?.bindings[5]).toBe("sha256_v1")

    const replaySetup = createEnv("proxy", "proxy", "native")
    const replayContext = createContext("proxy", "proxy", "native")

    replaySetup.mockDb.enqueueFirst("auth_issue_requests", {
      request_key: "session:demo@astra.local:device-current:login-key-1",
      route_kind: "session",
      user_id: "usr_demo",
      install_id: null,
      device_id: "device-current",
      session_id: firstPayload.sessionId,
      node_mirror_status: "completed",
      created_at: "2026-04-11T12:00:00.000Z",
      last_attempt_at: "2026-04-11T12:00:00.000Z",
      completed_at: "2026-04-11T12:00:00.000Z",
      failed_at: null,
      error_code: null,
      error_message: null,
      shadow_updated_at: "2026-04-11T12:00:00.000Z",
    })
    replaySetup.mockDb.enqueueFirst("shadow_users", {
      id: "usr_demo",
      email: "demo@astra.local",
      billing_email: "billing@astra.local",
      created_at: "2026-04-01T00:00:00.000Z",
      plan: "pro",
      subscription_status: "active",
      identity_mode: "authenticated",
      install_id: null,
      provider_entitlements_json: JSON.stringify(["openai", "gemini"]),
      reading_history_sync_enabled: 1,
      study_progress_sync_enabled: 1,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    })
    replaySetup.mockDb.enqueueFirst("shadow_auth_sessions", {
      session_id: firstPayload.sessionId,
      user_id: "usr_demo",
      device_id: "device-current",
      identity_mode: "authenticated",
      token_hash: null,
      token_hash_alg: null,
      issued_at: firstPayload.issuedAt,
      expires_at: firstPayload.expiresAt,
      created_at: firstPayload.issuedAt,
      last_seen_at: firstPayload.issuedAt,
      last_verified_at: firstPayload.issuedAt,
      status: "active",
      revoked_at: null,
      shadow_updated_at: firstPayload.issuedAt,
    })
    replaySetup.mockDb.enqueueFirst("shadow_user_usage", {
      user_id: "usr_demo",
      usage_day: "2026-04-11",
      daily_requests_limit: 100,
      daily_characters_limit: 1000,
      requests_per_minute_limit: 10,
      requests_today: 10,
      characters_today: 100,
      total_requests: 50,
      total_characters: 500,
      last_request_at: null,
      recent_events_json: "[]",
      shadow_updated_at: "2026-04-11T11:55:00.000Z",
    })

    const replayResponse = await handleAuthSession(createLoginRequest({ idempotencyKey: "login-key-1" }), replaySetup.env, replayContext.ctx)
    const replayPayload = await replayResponse.json() as ReturnType<typeof createSessionPayload>

    expect(replayResponse.status).toBe(200)
    expect(replayResponse.headers.get("x-astra-platform-route")).toBe("native-idempotent-replay")
    expect(replayPayload.sessionId).toBe(firstPayload.sessionId)
    expect(replayPayload.sessionToken).toBe(firstPayload.sessionToken)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(replaySetup.mockDb.queries.some((query) => (
      query.sql.includes("FROM shadow_users")
      && query.bindings[0] === "usr_demo"
    ))).toBe(true)
  })

  it("returns a guarded 503 on ambiguous mirror-back and succeeds when retried with the same key", async () => {
    const { env, mockDb } = createEnv("proxy", "proxy", "native")
    enqueueShadowState(mockDb)
    enqueueShadowCredential(mockDb)
    mockDb.enqueueFirst("auth_issue_requests", null)
    const context = createContext("proxy", "proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("relay timeout"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const firstResponse = await handleAuthSession(createLoginRequest({ idempotencyKey: "login-key-2" }), env, context.ctx)
    const firstPayload = await firstResponse.json() as { error: { code: string } }

    expect(firstResponse.status).toBe(503)
    expect(firstPayload.error.code).toBe("UPSTREAM_UNAVAILABLE")
    expect(firstResponse.headers.get("x-astra-platform-fallback-reason")).toBe("mirror_back_commit_unknown")

    const retrySetup = createEnv("proxy", "proxy", "native")
    const retryContext = createContext("proxy", "proxy", "native")

    retrySetup.mockDb.enqueueFirst("auth_issue_requests", {
      request_key: "session:demo@astra.local:device-current:login-key-2",
      route_kind: "session",
      user_id: "usr_demo",
      install_id: null,
      device_id: "device-current",
      session_id: "sess_retry_demo",
      node_mirror_status: "pending",
      created_at: "2026-04-11T12:00:00.000Z",
      last_attempt_at: "2026-04-11T12:00:00.000Z",
      completed_at: null,
      failed_at: null,
      error_code: null,
      error_message: null,
      shadow_updated_at: "2026-04-11T12:00:00.000Z",
    })
    retrySetup.mockDb.enqueueFirst("shadow_users", {
      id: "usr_demo",
      email: "demo@astra.local",
      billing_email: "billing@astra.local",
      created_at: "2026-04-01T00:00:00.000Z",
      plan: "pro",
      subscription_status: "active",
      identity_mode: "authenticated",
      install_id: null,
      provider_entitlements_json: JSON.stringify(["openai", "gemini"]),
      reading_history_sync_enabled: 1,
      study_progress_sync_enabled: 1,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    })
    retrySetup.mockDb.enqueueFirst("shadow_auth_sessions", {
      session_id: "sess_retry_demo",
      user_id: "usr_demo",
      device_id: "device-current",
      identity_mode: "authenticated",
      token_hash: null,
      token_hash_alg: null,
      issued_at: "2026-04-11T12:00:00.000Z",
      expires_at: "2026-05-11T12:00:00.000Z",
      created_at: "2026-04-11T12:00:00.000Z",
      last_seen_at: "2026-04-11T12:00:00.000Z",
      last_verified_at: "2026-04-11T12:00:00.000Z",
      status: "active",
      revoked_at: null,
      shadow_updated_at: "2026-04-11T12:00:00.000Z",
    })
    retrySetup.mockDb.enqueueFirst("shadow_user_usage", {
      user_id: "usr_demo",
      usage_day: "2026-04-11",
      daily_requests_limit: 100,
      daily_characters_limit: 1000,
      requests_per_minute_limit: 10,
      requests_today: 10,
      characters_today: 100,
      total_requests: 50,
      total_characters: 500,
      last_request_at: null,
      recent_events_json: "[]",
      shadow_updated_at: "2026-04-11T11:55:00.000Z",
    })
    retrySetup.mockDb.enqueueFirst("shadow_devices", {
      id: "usr_demo:device-current",
      user_id: "usr_demo",
      device_id: "device-current",
      identity_mode: "authenticated",
      label: "Astra Chrome",
      platform: "macos",
      browser_family: "chrome",
      app_kind: "extension",
      app_version: "0.1.0",
      first_seen_at: "2026-04-07T00:00:00.000Z",
      last_seen_at: "2026-04-11T12:00:00.000Z",
      last_sync_at: null,
      status: "active",
      revoked_at: null,
      updated_at: "2026-04-11T12:00:00.000Z",
      shadow_updated_at: "2026-04-11T12:00:00.000Z",
    })

    const retryResponse = await handleAuthSession(createLoginRequest({ idempotencyKey: "login-key-2" }), retrySetup.env, retryContext.ctx)
    const retryPayload = await retryResponse.json() as ReturnType<typeof createSessionPayload>

    expect(retryResponse.status).toBe(200)
    expect(retryResponse.headers.get("x-astra-platform-route")).toBe("native-idempotent-replay")
    expect(retryPayload.sessionId).toBe("sess_retry_demo")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("returns invalid credentials locally in native POST mode", async () => {
    const { env, mockDb } = createEnv("proxy", "proxy", "native")
    enqueueShadowState(mockDb)
    enqueueShadowCredential(mockDb)
    mockDb.enqueueFirst("auth_issue_requests", null)
    const context = createContext("proxy", "proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await handleAuthSession(createLoginRequest({ password: "wrong-pass" }), env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-auth-gate")
    expect(payload.error.code).toBe("INVALID_CREDENTIALS")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("falls back to proxy when native POST auth/session is missing a mirrored credential", async () => {
    const { env, mockDb } = createEnv("proxy", "proxy", "native")
    enqueueShadowState(mockDb)
    mockDb.enqueueFirst("auth_issue_requests", null)
    const context = createContext("proxy", "proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSessionPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createLoginRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSessionPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_shadow_user_credential")
    expect(payload.sessionId).toBe("sess_demo")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("proxies DELETE auth/session revokes in proxy mode", async () => {
    const { env } = createEnv("proxy", "proxy")
    const context = createContext("proxy", "proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))

    const response = await handleAuthSession(createRequest("DELETE"), env, context.ctx)

    expect(response.status).toBe(204)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("revokes the current session natively and mirrors back to Node", async () => {
    const { env, mockDb } = createEnv("proxy", "native")
    enqueueShadowState(mockDb)
    const context = createContext("proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))

    const response = await handleAuthSession(createRequest("DELETE"), env, context.ctx)

    expect(response.status).toBe(204)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("UPDATE shadow_auth_sessions"))).toBe(true)
  })

  it("returns a guarded 503 when DELETE mirror-back transport is ambiguous", async () => {
    const { env, mockDb } = createEnv("proxy", "native")
    enqueueShadowState(mockDb)
    const context = createContext("proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("relay unavailable"))

    const response = await handleAuthSession(createRequest("DELETE"), env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(503)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("mirror_back_commit_unknown")
    expect(payload.error.code).toBe("UPSTREAM_UNAVAILABLE")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("rolls back the D1 revoke and returns the Node response when DELETE mirror-back rejects", async () => {
    const { env, mockDb } = createEnv("proxy", "native")
    enqueueShadowState(mockDb)
    const context = createContext("proxy", "native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "SESSION_REQUIRED",
        message: "Invalid or missing Astra session.",
      },
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAuthSession(createRequest("DELETE"), env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("mirror_back_rejected")
    expect(payload.error.code).toBe("SESSION_REQUIRED")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.filter((query) => query.sql.includes("INSERT INTO shadow_auth_sessions")).length).toBeGreaterThan(0)
  })
})
