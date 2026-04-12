import { afterEach, describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, DeviceListReadMode } from "../env"
import type { D1PreparedStatement, D1RunResult } from "../bindings"
import { handleDeviceList } from "./device-list"

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
    enqueueAll(key: "shadow_devices", value: unknown[]) {
      const bucket = allResults.get(`${key}:all`) ?? []
      bucket.push(value)
      allResults.set(`${key}:all`, bucket)
    },
  }
}

function createEnv(mode: DeviceListReadMode, mockDb = createMockDb()) {
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
    DEVICE_LIST_READ_MODE: mode,
    SYNC_BOOTSTRAP_READ_MODE: "proxy",
    ASTRA_ENV: "test",
  }

  return {
    env,
    mockDb,
  }
}

function createContext(mode: DeviceListReadMode) {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_devices_test",
    nowEpochMs: Date.parse("2026-04-10T12:00:00.000Z"),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: "proxy",
      deviceListReadMode: mode,
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
  return new Request("https://platform.astra.example/v1/devices", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${createSessionToken()}`,
      "X-Astra-Device-Id": "device-current",
    },
  })
}

function createDeviceListPayload() {
  return {
    devices: [
      {
        deviceId: "device-remote",
        label: "Astra Web",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "web",
        appVersion: "0.1.0-web",
        firstSeenAt: "2026-04-08T00:00:00.000Z",
        lastSeenAt: "2026-04-10T10:00:00.000Z",
        lastSyncAt: "2026-04-10T10:30:00.000Z",
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
        lastSeenAt: "2026-04-10T11:00:00.000Z",
        lastSyncAt: "2026-04-10T11:30:00.000Z",
        status: "active",
        isCurrentDevice: true,
      },
    ],
  }
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
    study_progress_sync_enabled: 1,
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
      last_seen_at: "2026-04-10T10:00:00.000Z",
      last_sync_at: "2026-04-10T10:30:00.000Z",
      status: "active",
      revoked_at: null,
      updated_at: "2026-04-10T10:00:00.000Z",
      shadow_updated_at: "2026-04-10T10:00:00.000Z",
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
      last_seen_at: "2026-04-10T11:00:00.000Z",
      last_sync_at: "2026-04-10T11:30:00.000Z",
      status: "active",
      revoked_at: null,
      updated_at: "2026-04-10T11:00:00.000Z",
      shadow_updated_at: "2026-04-10T11:00:00.000Z",
    },
  ])
}

describe("handleDeviceList", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("proxies device-list reads when proxy mode is enabled", async () => {
    const { env } = createEnv("proxy")
    const context = createContext("proxy")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createDeviceListPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    const response = await handleDeviceList(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createDeviceListPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(payload.devices).toHaveLength(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("keeps shadow mode proxied while comparing the D1 shadow read in the background", async () => {
    const { env, mockDb } = createEnv("shadow")
    enqueueShadowState(mockDb)
    const context = createContext("shadow")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/devices") {
        return new Response(JSON.stringify(createDeviceListPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleDeviceList(createRequest(), env, context.ctx)
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.some((query) => query.sql.includes("FROM shadow_devices"))).toBe(true)
  })

  it("serves device-list reads natively from D1 after Node auth/session validation", async () => {
    const { env, mockDb } = createEnv("native")
    enqueueShadowState(mockDb)
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/devices") {
        return new Response(JSON.stringify(createDeviceListPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleDeviceList(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createDeviceListPayload>
    await context.flushWaitUntil()

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(payload.devices.find((device) => device.deviceId === "device-current")?.isCurrentDevice).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to the Node relay when native mode finds missing shadow state", async () => {
    const { env } = createEnv("native")
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://relay.astra.example/v1/devices") {
        return new Response(JSON.stringify(createDeviceListPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const response = await handleDeviceList(createRequest(), env, context.ctx)
    const payload = await response.json() as ReturnType<typeof createDeviceListPayload>

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_shadow_user")
    expect(payload.devices).toHaveLength(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
