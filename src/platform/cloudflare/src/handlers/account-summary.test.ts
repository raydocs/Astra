import { afterEach, describe, expect, it, vi } from "vitest"

import type { D1PreparedStatement, D1RunResult } from "../bindings"
import type { AstraRequestContext } from "../context"
import type { AccountSummaryReadMode, AstraPlatformEnv } from "../env"
import { handleAccountSummary } from "./account-summary"

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
  const allResults = new Map<string, unknown[]>()

  function getKey(sql: string, mode: "first" | "all"): string {
    if (sql.includes("FROM shadow_users")) return `shadow_users:${mode}`
    if (sql.includes("FROM shadow_auth_sessions")) return `shadow_auth_sessions:${mode}`
    if (sql.includes("FROM shadow_user_usage")) return `shadow_user_usage:${mode}`
    if (sql.includes("FROM shadow_devices")) return `shadow_devices:${mode}`
    if (sql.includes("FROM shadow_sync_collections")) return `shadow_sync_collections:${mode}`
    if (sql.includes("FROM shadow_sync_record_state")) return `shadow_sync_record_state:${mode}`
    if (sql.includes("FROM shadow_sync_mutations")) return `shadow_sync_mutations:${mode}`
    return `other:${mode}`
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
          const key = getKey(record.sql, "all")
          const queue = allResults.get(key) ?? []
          const next = queue.shift() as T[] | undefined
          allResults.set(key, queue)
          return {
            success: true,
            results: next ?? [],
            meta: { changes: 0 },
          } as D1RunResult<T>
        },
        async first<T = Record<string, unknown>>() {
          const key = getKey(record.sql, "first")
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
    enqueueFirst(key: "shadow_users" | "shadow_auth_sessions" | "shadow_user_usage" | "shadow_devices", value: unknown) {
      const bucket = firstResults.get(`${key}:first`) ?? []
      bucket.push(value)
      firstResults.set(`${key}:first`, bucket)
    },
    enqueueAll(key: "shadow_devices" | "shadow_sync_collections" | "shadow_sync_record_state" | "shadow_sync_mutations", value: unknown[]) {
      const bucket = allResults.get(`${key}:all`) ?? []
      bucket.push(value)
      allResults.set(`${key}:all`, bucket)
    },
  }
}

function createEnv(mode: AccountSummaryReadMode, mockDb = createMockDb()) {
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
    ARTICLE_IMPORT_MODE: "proxy",
    AUTH_SESSION_READ_MODE: "proxy",
    AUTH_SESSION_REVOKE_WRITE_MODE: "proxy",
    ACCOUNT_SUMMARY_READ_MODE: mode,
    DEVICE_LIST_READ_MODE: "proxy",
    DEVICE_REVOKE_WRITE_MODE: "proxy",
    SYNC_BOOTSTRAP_READ_MODE: "proxy",
    SYNC_PULL_READ_MODE: "proxy",
    SYNC_PUSH_WRITE_MODE: "proxy",
    ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST: "200",
    ASTRA_ENV: "test",
  }

  return { env, mockDb }
}

function createContext(mode: AccountSummaryReadMode) {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_account_summary_test",
    nowEpochMs: Date.parse("2026-04-11T12:00:00.000Z"),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: mode,
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
      continuityDeleteGracePeriodSeconds: 604800,
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

function createRequest(headers: HeadersInit = {
  Authorization: `Bearer ${SESSION_TOKEN}`,
  "X-Astra-Device-Id": "device-current",
}) {
  return new Request("https://platform.astra.example/v1/account/summary", {
    method: "GET",
    headers,
  })
}

function createSummaryPayload() {
  return {
    serverTime: "2026-04-11T12:00:00.000Z",
    account: {
      id: "usr_demo",
      relayBaseURL: "https://relay.astra.example/v1",
      email: "demo@astra.local",
      billingEmail: "billing@astra.local",
      createdAt: "2026-04-01T00:00:00.000Z",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
    },
    usage: {
      generatedAt: "2026-04-11T12:00:00.000Z",
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
    },
    session: {
      sessionId: "sess_demo",
      deviceId: "device-current",
      issuedAt: "2026-04-10T00:00:00.000Z",
      expiresAt: "2026-04-12T00:00:00.000Z",
      identityMode: "authenticated",
      status: "active",
    },
    devices: {
      activeCount: 2,
      revokedCount: 0,
      current: {
        deviceId: "device-current",
        label: "Astra Chrome",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0",
        firstSeenAt: "2026-04-07T00:00:00.000Z",
        lastSeenAt: "2026-04-11T11:55:00.000Z",
        lastSyncAt: "2026-04-11T11:55:00.000Z",
        status: "active",
        isCurrentDevice: true,
      },
      entries: [
        {
          deviceId: "device-remote",
          label: "Astra Web",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "web",
          appVersion: "0.1.0-web",
          firstSeenAt: "2026-04-08T00:00:00.000Z",
          lastSeenAt: "2026-04-11T10:00:00.000Z",
          lastSyncAt: "2026-04-11T10:30:00.000Z",
          status: "active",
          isCurrentDevice: false,
        },
        {
          deviceId: "device-current",
          label: "Astra Chrome",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0",
          firstSeenAt: "2026-04-07T00:00:00.000Z",
          lastSeenAt: "2026-04-11T11:55:00.000Z",
          lastSyncAt: "2026-04-11T11:55:00.000Z",
          status: "active",
          isCurrentDevice: true,
        },
      ],
    },
    sync: {
      maxMutationsPerRequest: 200,
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "1", mutationCount: 1, activeCount: 1, lastSyncAt: "2026-04-11T11:40:00.000Z", compactionFloorCursor: null },
        vocabulary: { enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        review_schedule: { enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        reading_history: { enabled: true, defaultEnabled: false, cursor: "2", mutationCount: 1, activeCount: 1, lastSyncAt: "2026-04-11T11:45:00.000Z", compactionFloorCursor: null },
        study_progress: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
      },
    },
  }
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
    study_progress_sync_enabled: 0,
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  })
  for (let index = 0; index < 2; index += 1) {
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
  }
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
    last_sync_at: "2026-04-11T11:55:00.000Z",
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
  mockDb.enqueueAll("shadow_devices", [
    {
      id: "usr_demo:device-remote",
      user_id: "usr_demo",
      device_id: "device-remote",
      identity_mode: "authenticated",
      label: "Astra Web",
      platform: "macos",
      browser_family: "chrome",
      app_kind: "web",
      app_version: "0.1.0-web",
      first_seen_at: "2026-04-08T00:00:00.000Z",
      last_seen_at: "2026-04-11T10:00:00.000Z",
      last_sync_at: "2026-04-11T10:30:00.000Z",
      status: "active",
      revoked_at: null,
      updated_at: "2026-04-11T10:00:00.000Z",
      shadow_updated_at: "2026-04-11T10:00:00.000Z",
    },
    {
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
      last_sync_at: "2026-04-11T11:55:00.000Z",
      status: "active",
      revoked_at: null,
      updated_at: "2026-04-11T11:55:00.000Z",
      shadow_updated_at: "2026-04-11T11:55:00.000Z",
    },
  ])
  mockDb.enqueueAll("shadow_sync_collections", [
    {
      user_id: "usr_demo",
      collection: "config",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: "1",
      last_issued_cursor_order: 1,
      last_server_updated_at: "2026-04-11T11:40:00.000Z",
      shadow_updated_at: "2026-04-11T11:40:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "vocabulary",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-11T11:40:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "review_schedule",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-10T10:06:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "reading_history",
      enabled: 1,
      default_enabled: 0,
      last_issued_cursor: "2",
      last_issued_cursor_order: 2,
      last_server_updated_at: "2026-04-11T11:45:00.000Z",
      shadow_updated_at: "2026-04-11T11:45:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "study_progress",
      enabled: 0,
      default_enabled: 0,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-11T11:45:00.000Z",
    },
  ])
  mockDb.enqueueAll("shadow_sync_record_state", [
    {
      user_id: "usr_demo",
      collection: "config",
      record_id: "global",
      is_deleted: 0,
      payload_json: "{}",
      last_client_mutation_id: "client-config-1",
      last_device_id: "device-current",
      last_server_updated_at: "2026-04-11T11:40:00.000Z",
      last_cursor: "1",
      last_cursor_order: 1,
      tombstone_retained_until: null,
      shadow_updated_at: "2026-04-11T11:40:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "reading_history",
      record_id: "page-1",
      is_deleted: 0,
      payload_json: "{}",
      last_client_mutation_id: "client-history-1",
      last_device_id: "device-current",
      last_server_updated_at: "2026-04-11T11:45:00.000Z",
      last_cursor: "2",
      last_cursor_order: 2,
      tombstone_retained_until: null,
      shadow_updated_at: "2026-04-11T11:45:00.000Z",
    },
  ])
  mockDb.enqueueAll("shadow_sync_mutations", [
    {
      server_mutation_id: "mut-config-1",
      user_id: "usr_demo",
      collection: "config",
      schema_version: 1,
      record_id: "global",
      operation: "upsert",
      client_mutation_id: "client-config-1",
      device_id: "device-current",
      client_updated_at: "2026-04-11T11:39:00.000Z",
      server_updated_at: "2026-04-11T11:40:00.000Z",
      cursor: "1",
      payload_json: "{}",
      shadow_updated_at: "2026-04-11T11:40:00.000Z",
    },
    {
      server_mutation_id: "mut-history-1",
      user_id: "usr_demo",
      collection: "reading_history",
      schema_version: 1,
      record_id: "page-1",
      operation: "upsert",
      client_mutation_id: "client-history-1",
      device_id: "device-current",
      client_updated_at: "2026-04-11T11:44:00.000Z",
      server_updated_at: "2026-04-11T11:45:00.000Z",
      cursor: "2",
      payload_json: "{}",
      shadow_updated_at: "2026-04-11T11:45:00.000Z",
    },
  ])
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("handleAccountSummary", () => {
  it("proxies account-summary reads in proxy mode", async () => {
    const { env } = createEnv("proxy")
    const context = createContext("proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSummaryPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAccountSummary(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSummaryPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(payload.account.id).toBe("usr_demo")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps shadow mode proxied while comparing the D1 summary in the background", async () => {
    const { env, mockDb } = createEnv("shadow")
    enqueueShadowState(mockDb)
    const context = createContext("shadow")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSummaryPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAccountSummary(createRequest(), env, context.ctx)
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("FROM shadow_sync_mutations"))).toBe(true)
  })

  it("serves account-summary reads natively from D1 and compares to Node in the background", async () => {
    const { env, mockDb } = createEnv("native")
    enqueueShadowState(mockDb)
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSummaryPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAccountSummary(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createSummaryPayload>
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(payload.devices.entries).toHaveLength(2)
    const mirroredEvent = payload.usage.usage.recentEvents[0] as Record<string, unknown> | undefined
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
    expect(payload.sync.collections.reading_history.cursor).toBe("2")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to proxy when the native D1 summary is incomplete", async () => {
    const { env, mockDb } = createEnv("native")
    enqueueShadowState(mockDb, { includeUsage: false })
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSummaryPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleAccountSummary(createRequest(), env, context.ctx)

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_shadow_user_usage")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("returns a local auth/session error when native validation rejects the request", async () => {
    const { env } = createEnv("native")
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await handleAccountSummary(createRequest({ "X-Astra-Device-Id": "device-current" }), env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-auth-gate")
    expect(payload.error.code).toBe("SESSION_REQUIRED")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })
})
