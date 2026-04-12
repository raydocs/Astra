import { afterEach, describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, SyncBootstrapReadMode } from "../env"
import type { D1PreparedStatement, D1RunResult } from "../bindings"
import { handleSyncBootstrap } from "./sync-bootstrap"

interface QueryRecord {
  sql: string
  bindings: unknown[]
}

const SESSION_SECRET = "test-session-secret"
const SESSION_TOKEN = "eyJlbWFpbCI6ImRlbW9AYXN0cmEubG9jYWwiLCJyZWxheUJhc2VVUkwiOiJodHRwczovL3JlbGF5LmFzdHJhLmV4YW1wbGUvdjEiLCJpc3N1ZWRBdCI6IjIwMjYtMDQtMTBUMDA6MDA6MDAuMDAwWiIsImV4cGlyZXNBdCI6IjIwMjYtMDQtMTJUMDA6MDA6MDAuMDAwWiIsInNlc3Npb25JZCI6InNlc3NfZGVtbyIsImRldmljZUlkIjoiZGV2aWNlLWN1cnJlbnQiLCJpZGVudGl0eU1vZGUiOiJhdXRoZW50aWNhdGVkIn0.HQInEhUDwUBGgxZAdkUoM0sOjTxQlPSDx9hP1ALSciE"

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
    if (sql.includes("FROM shadow_devices")) return `shadow_devices:${mode}`
    if (sql.includes("FROM shadow_sync_collections")) return `shadow_sync_collections:${mode}`
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
    enqueueFirst(key: "shadow_users" | "shadow_auth_sessions" | "shadow_devices", value: unknown) {
      const bucket = firstResults.get(`${key}:first`) ?? []
      bucket.push(value)
      firstResults.set(`${key}:first`, bucket)
    },
    enqueueAll(key: "shadow_sync_collections", value: unknown[]) {
      const bucket = allResults.get(`${key}:all`) ?? []
      bucket.push(value)
      allResults.set(`${key}:all`, bucket)
    },
  }
}

function createEnv(mode: SyncBootstrapReadMode, mockDb = createMockDb()) {
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
    ACCOUNT_SUMMARY_READ_MODE: "proxy",
    DEVICE_LIST_READ_MODE: "proxy",
    SYNC_BOOTSTRAP_READ_MODE: mode,
    ASTRA_ENV: "test",
  }

  return {
    env,
    mockDb,
  }
}

function createContext(mode: SyncBootstrapReadMode) {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_sync_bootstrap_test",
    nowEpochMs: Date.parse("2026-04-10T12:00:00.000Z"),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: "proxy",
      deviceListReadMode: "proxy",
      deviceRevokeWriteMode: "proxy",
      syncBootstrapReadMode: mode,
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
      continuityDeleteGracePeriodSeconds: 1_800,
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

function createSessionToken() {
  return SESSION_TOKEN
}

function createRequest() {
  return new Request("https://platform.astra.example/v1/sync/bootstrap", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${createSessionToken()}`,
      "X-Astra-Device-Id": "device-current",
    },
  })
}

function createBootstrapPayload() {
  return {
    serverTime: "2026-04-10T12:00:00.000Z",
    deviceId: "device-current",
    collections: {
      config: { enabled: true, defaultEnabled: true, cursor: "2" },
      vocabulary: { enabled: true, defaultEnabled: true, cursor: "4" },
      reading_history: { enabled: true, defaultEnabled: false, cursor: "7" },
      study_progress: { enabled: false, defaultEnabled: false, cursor: null },
    },
    limits: {
      maxMutationsPerRequest: 200,
    },
    transport: {
      deviceHeader: "X-Astra-Device-Id",
      idempotencyKey: "clientMutationId",
      cursorMode: "per-collection",
    },
  }
}

function createShadowSyncCollections() {
  return [
    {
      user_id: "usr_demo",
      collection: "config",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: "2",
      last_issued_cursor_order: 2,
      last_server_updated_at: "2026-04-10T10:00:00.000Z",
      shadow_updated_at: "2026-04-10T10:00:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "vocabulary",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: "4",
      last_issued_cursor_order: 4,
      last_server_updated_at: "2026-04-10T10:05:00.000Z",
      shadow_updated_at: "2026-04-10T10:05:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "reading_history",
      enabled: 1,
      default_enabled: 0,
      last_issued_cursor: "7",
      last_issued_cursor_order: 7,
      last_server_updated_at: "2026-04-10T10:10:00.000Z",
      shadow_updated_at: "2026-04-10T10:10:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "study_progress",
      enabled: 0,
      default_enabled: 0,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-10T10:15:00.000Z",
    },
  ]
}

function enqueueShadowState(mockDb: ReturnType<typeof createMockDb>) {
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
      expires_at: "2026-04-11T00:00:00.000Z",
      created_at: "2026-04-10T00:00:00.000Z",
      last_seen_at: "2026-04-10T11:00:00.000Z",
      last_verified_at: "2026-04-10T11:00:00.000Z",
      status: "active",
      revoked_at: null,
      shadow_updated_at: "2026-04-10T11:00:00.000Z",
    })
  }
  for (let index = 0; index < 2; index += 1) {
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
      last_seen_at: "2026-04-10T11:00:00.000Z",
      last_sync_at: "2026-04-10T11:30:00.000Z",
      status: "active",
      revoked_at: null,
      updated_at: "2026-04-10T11:00:00.000Z",
      shadow_updated_at: "2026-04-10T11:00:00.000Z",
    })
  }
  mockDb.enqueueAll("shadow_sync_collections", createShadowSyncCollections())
  mockDb.enqueueAll("shadow_sync_collections", createShadowSyncCollections())
}

describe("handleSyncBootstrap", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("proxies sync bootstrap reads when proxy mode is enabled", async () => {
    const { env } = createEnv("proxy")
    const context = createContext("proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createBootstrapPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createBootstrapPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(payload.deviceId).toBe("device-current")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps shadow mode proxied while comparing the D1 shadow sync bootstrap in the background", async () => {
    const { env, mockDb } = createEnv("shadow")
    enqueueShadowState(mockDb)
    const context = createContext("shadow")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/sync/bootstrap") {
        return new Response(JSON.stringify(createBootstrapPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("shadow")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("shadow")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("FROM shadow_sync_collections"))).toBe(true)
  })

  it("serves sync bootstrap reads natively from D1 after Node auth/session validation", async () => {
    const { env, mockDb } = createEnv("native")
    enqueueShadowState(mockDb)
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/sync/bootstrap") {
        return new Response(JSON.stringify(createBootstrapPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createBootstrapPayload>
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(payload.collections.reading_history.enabled).toBe(true)
    expect(payload.limits.maxMutationsPerRequest).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("returns a local auth/session error when Worker-native validation rejects the request", async () => {
    const { env } = createEnv("native")
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const request = new Request("https://platform.astra.example/v1/sync/bootstrap", {
      method: "GET",
      headers: {
        "X-Astra-Device-Id": "device-current",
      },
    })

    const response = await handleSyncBootstrap(request, env, context.ctx)

    expect(response.status).toBe(401)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-auth-gate")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("returns the authoritative Node bootstrap error when the native authoritative gate rejects the request", async () => {
    const { env, mockDb } = createEnv("native")
    enqueueShadowState(mockDb)
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/sync/bootstrap") {
        return new Response(JSON.stringify({ error: { code: "DEVICE_REQUIRED", message: "Missing X-Astra-Device-Id header." } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-authoritative-gate")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(payload.error.code).toBe("DEVICE_REQUIRED")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to proxy when Worker-native validation is unavailable by config", async () => {
    const { env } = createEnv("native")
    env.ASTRA_SESSION_SECRET = ""
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/sync/bootstrap") {
        return new Response(JSON.stringify(createBootstrapPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createBootstrapPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_session_secret")
    expect(payload.deviceId).toBe("device-current")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to proxy when the authoritative Node bootstrap fetch is unavailable", async () => {
    const { env, mockDb } = createEnv("native")
    enqueueShadowState(mockDb)
    const context = createContext("native")
    let bootstrapAttempts = 0
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/sync/bootstrap") {
        bootstrapAttempts += 1
        if (bootstrapAttempts === 1) {
          throw new Error("bootstrap unavailable")
        }
        return new Response(JSON.stringify(createBootstrapPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createBootstrapPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("authoritative_upstream_unavailable")
    expect(payload.deviceId).toBe("device-current")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("falls back to the Node relay when native mode finds incomplete shadow sync collections", async () => {
    const { env, mockDb } = createEnv("native")
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
        expires_at: "2026-04-11T00:00:00.000Z",
        created_at: "2026-04-10T00:00:00.000Z",
        last_seen_at: "2026-04-10T11:00:00.000Z",
        last_verified_at: "2026-04-10T11:00:00.000Z",
        status: "active",
        revoked_at: null,
        shadow_updated_at: "2026-04-10T11:00:00.000Z",
      })
    }
    for (let index = 0; index < 2; index += 1) {
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
        last_seen_at: "2026-04-10T11:00:00.000Z",
        last_sync_at: "2026-04-10T11:30:00.000Z",
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-10T11:00:00.000Z",
        shadow_updated_at: "2026-04-10T11:00:00.000Z",
      })
    }
    mockDb.enqueueAll("shadow_sync_collections", createShadowSyncCollections().slice(0, 3))
    mockDb.enqueueAll("shadow_sync_collections", createShadowSyncCollections().slice(0, 3))

    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/sync/bootstrap") {
        return new Response(JSON.stringify(createBootstrapPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleSyncBootstrap(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createBootstrapPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-bootstrap")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_shadow_sync_collections")
    expect(payload.deviceId).toBe("device-current")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
