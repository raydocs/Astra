import { afterEach, describe, expect, it, vi } from "vitest"

import type { D1PreparedStatement, D1RunResult } from "../bindings"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, SyncPushWriteMode } from "../env"
import type { SharedSyncMutationInput } from "../../../../src/utils/astra/sync-push"
import { handleSyncPush } from "./sync-push"

interface QueryRecord {
  sql: string
  bindings: unknown[]
}

const SESSION_SECRET = "test-session-secret"
const SESSION_TOKEN = "eyJlbWFpbCI6ImRlbW9AYXN0cmEubG9jYWwiLCJyZWxheUJhc2VVUkwiOiJodHRwczovL3JlbGF5LmFzdHJhLmV4YW1wbGUvdjEiLCJpc3N1ZWRBdCI6IjIwMjYtMDQtMTBUMDA6MDA6MDAuMDAwWiIsImV4cGlyZXNBdCI6IjIwMjYtMDQtMTJUMDA6MDA6MDAuMDAwWiIsInNlc3Npb25JZCI6InNlc3NfZGVtbyIsImRldmljZUlkIjoiZGV2aWNlLWN1cnJlbnQiLCJpZGVudGl0eU1vZGUiOiJhdXRoZW50aWNhdGVkIn0.HQInEhUDwUBGgxZAdkUoM0sOjTxQlPSDx9hP1ALSciE"

interface ShadowUserRecord {
  id: string
  email: string
  billing_email: string
  created_at: string
  plan: string
  subscription_status: string
  identity_mode: string
  install_id: string | null
  provider_entitlements_json: string
  reading_history_sync_enabled: number
  study_progress_sync_enabled: number
  shadow_updated_at: string
}

interface ShadowSessionRecord {
  session_id: string
  user_id: string
  device_id: string
  identity_mode: string
  issued_at: string
  expires_at: string | null
  created_at: string
  last_seen_at: string
  last_verified_at: string | null
  status: string
  revoked_at: string | null
  token_hash: string | null
  token_hash_alg: string | null
  shadow_updated_at: string
}

interface ShadowDeviceRecord {
  id: string
  user_id: string
  device_id: string
  identity_mode: string
  label: string
  platform: string | null
  browser_family: string | null
  app_kind: string
  app_version: string | null
  first_seen_at: string
  last_seen_at: string
  last_sync_at: string | null
  status: string
  revoked_at: string | null
  updated_at: string
  shadow_updated_at: string
}

interface ShadowSyncCollectionRecord {
  user_id: string
  collection: "config" | "vocabulary" | "reading_history" | "study_progress"
  enabled: number
  default_enabled: number
  last_issued_cursor: string | null
  last_issued_cursor_order: number | null
  last_server_updated_at: string | null
  shadow_updated_at: string
}

interface ShadowSyncMutationRecord {
  server_mutation_id: string
  user_id: string
  collection: "config" | "vocabulary" | "reading_history" | "study_progress"
  schema_version: number
  record_id: string
  operation: "upsert" | "delete"
  client_mutation_id: string
  device_id: string
  client_updated_at: string
  server_updated_at: string
  cursor: string
  cursor_order: number
  payload_json: string | null
  shadow_updated_at: string
}

function normalizeSql(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function createMockDb() {
  const queries: QueryRecord[] = []
  const usersByEmail = new Map<string, ShadowUserRecord>()
  const sessionsById = new Map<string, ShadowSessionRecord>()
  const devicesByUserAndId = new Map<string, ShadowDeviceRecord>()
  const collectionsByUserAndCollection = new Map<string, ShadowSyncCollectionRecord>()
  const mutationsByUserAndClientMutationId = new Map<string, ShadowSyncMutationRecord>()
  const mutationsByServerMutationId = new Map<string, ShadowSyncMutationRecord>()

  function mutationClientKey(userId: string, clientMutationId: string) {
    return `${userId}:${clientMutationId}`
  }

  function deviceKey(userId: string, deviceId: string) {
    return `${userId}:${deviceId}`
  }

  function collectionKey(userId: string, collection: string) {
    return `${userId}:${collection}`
  }

  const db = {
    prepare: vi.fn((sql: string) => {
      const normalizedSql = normalizeSql(sql)
      const record: QueryRecord = { sql: normalizedSql, bindings: [] }
      queries.push(record)

      const statement: D1PreparedStatement = {
        bind(...values: unknown[]) {
          record.bindings = values
          return statement
        },
        async run<T = Record<string, unknown>>() {
          if (normalizedSql.includes("INSERT INTO shadow_sync_mutations")) {
            const [
              serverMutationId,
              userId,
              collection,
              schemaVersion,
              recordId,
              operation,
              clientMutationId,
              deviceId,
              clientUpdatedAt,
              serverUpdatedAt,
              cursor,
              cursorOrder,
              payloadJson,
              shadowUpdatedAt,
            ] = record.bindings
            const key = mutationClientKey(String(userId), String(clientMutationId))
            if (!mutationsByUserAndClientMutationId.has(key)) {
              const row: ShadowSyncMutationRecord = {
                server_mutation_id: String(serverMutationId),
                user_id: String(userId),
                collection: String(collection) as ShadowSyncMutationRecord["collection"],
                schema_version: Number(schemaVersion),
                record_id: String(recordId),
                operation: String(operation) as ShadowSyncMutationRecord["operation"],
                client_mutation_id: String(clientMutationId),
                device_id: String(deviceId),
                client_updated_at: String(clientUpdatedAt),
                server_updated_at: String(serverUpdatedAt),
                cursor: String(cursor),
                cursor_order: Number(cursorOrder),
                payload_json: typeof payloadJson === "string" ? payloadJson : null,
                shadow_updated_at: String(shadowUpdatedAt),
              }
              mutationsByUserAndClientMutationId.set(key, row)
              mutationsByServerMutationId.set(row.server_mutation_id, row)
              return { success: true, meta: { changes: 1 } } as D1RunResult<T>
            }
            return { success: true, meta: { changes: 0 } } as D1RunResult<T>
          }

          if (normalizedSql.includes("DELETE FROM shadow_sync_mutations")) {
            const serverMutationId = String(record.bindings[0])
            const row = mutationsByServerMutationId.get(serverMutationId)
            if (row) {
              mutationsByServerMutationId.delete(serverMutationId)
              mutationsByUserAndClientMutationId.delete(mutationClientKey(row.user_id, row.client_mutation_id))
            }
            return { success: true, meta: { changes: row ? 1 : 0 } } as D1RunResult<T>
          }

          if (normalizedSql.includes("INSERT INTO shadow_sync_collections") && normalizedSql.includes("last_issued_cursor = CASE")) {
            const [userId, collection, enabled, defaultEnabled, cursor, cursorOrder, lastServerUpdatedAt, shadowUpdatedAt] = record.bindings
            const key = collectionKey(String(userId), String(collection))
            const existing = collectionsByUserAndCollection.get(key)
            const nextCursorOrder = Number(cursorOrder)
            if (!existing || nextCursorOrder > (existing.last_issued_cursor_order ?? -1)) {
              collectionsByUserAndCollection.set(key, {
                user_id: String(userId),
                collection: String(collection) as ShadowSyncCollectionRecord["collection"],
                enabled: Number(enabled),
                default_enabled: Number(defaultEnabled),
                last_issued_cursor: String(cursor),
                last_issued_cursor_order: nextCursorOrder,
                last_server_updated_at: String(lastServerUpdatedAt),
                shadow_updated_at: String(shadowUpdatedAt),
              })
            }
            return { success: true, meta: { changes: 1 } } as D1RunResult<T>
          }

          if (normalizedSql.includes("INSERT INTO shadow_sync_collections")) {
            const [userId, collection, enabled, defaultEnabled, lastIssuedCursor, lastIssuedCursorOrder, lastServerUpdatedAt, shadowUpdatedAt] = record.bindings
            collectionsByUserAndCollection.set(collectionKey(String(userId), String(collection)), {
              user_id: String(userId),
              collection: String(collection) as ShadowSyncCollectionRecord["collection"],
              enabled: Number(enabled),
              default_enabled: Number(defaultEnabled),
              last_issued_cursor: typeof lastIssuedCursor === "string" ? lastIssuedCursor : null,
              last_issued_cursor_order: typeof lastIssuedCursorOrder === "number" ? lastIssuedCursorOrder : null,
              last_server_updated_at: typeof lastServerUpdatedAt === "string" ? lastServerUpdatedAt : null,
              shadow_updated_at: String(shadowUpdatedAt),
            })
            return { success: true, meta: { changes: 1 } } as D1RunResult<T>
          }

          if (normalizedSql.includes("INSERT INTO shadow_auth_sessions")) {
            const [
              sessionId,
              userId,
              deviceId,
              identityMode,
              issuedAt,
              expiresAt,
              createdAt,
              lastSeenAt,
              lastVerifiedAt,
              status,
              revokedAt,
              tokenHash,
              tokenHashAlg,
              shadowUpdatedAt,
            ] = record.bindings
            sessionsById.set(String(sessionId), {
              session_id: String(sessionId),
              user_id: String(userId),
              device_id: String(deviceId),
              identity_mode: String(identityMode),
              issued_at: String(issuedAt),
              expires_at: typeof expiresAt === "string" ? expiresAt : null,
              created_at: String(createdAt),
              last_seen_at: String(lastSeenAt),
              last_verified_at: typeof lastVerifiedAt === "string" ? lastVerifiedAt : null,
              status: String(status),
              revoked_at: typeof revokedAt === "string" ? revokedAt : null,
              token_hash: typeof tokenHash === "string" ? tokenHash : null,
              token_hash_alg: typeof tokenHashAlg === "string" ? tokenHashAlg : null,
              shadow_updated_at: String(shadowUpdatedAt),
            })
            return { success: true, meta: { changes: 1 } } as D1RunResult<T>
          }

          if (normalizedSql.includes("INSERT INTO shadow_devices")) {
            const [
              id,
              userId,
              deviceId,
              identityMode,
              label,
              platform,
              browserFamily,
              appKind,
              appVersion,
              firstSeenAt,
              lastSeenAt,
              lastSyncAt,
              status,
              revokedAt,
              updatedAt,
              shadowUpdatedAt,
            ] = record.bindings
            devicesByUserAndId.set(deviceKey(String(userId), String(deviceId)), {
              id: String(id),
              user_id: String(userId),
              device_id: String(deviceId),
              identity_mode: String(identityMode),
              label: String(label),
              platform: typeof platform === "string" ? platform : null,
              browser_family: typeof browserFamily === "string" ? browserFamily : null,
              app_kind: String(appKind),
              app_version: typeof appVersion === "string" ? appVersion : null,
              first_seen_at: String(firstSeenAt),
              last_seen_at: String(lastSeenAt),
              last_sync_at: typeof lastSyncAt === "string" ? lastSyncAt : null,
              status: String(status),
              revoked_at: typeof revokedAt === "string" ? revokedAt : null,
              updated_at: String(updatedAt),
              shadow_updated_at: String(shadowUpdatedAt),
            })
            return { success: true, meta: { changes: 1 } } as D1RunResult<T>
          }

          if (normalizedSql.includes("UPDATE shadow_auth_sessions") || normalizedSql.includes("UPDATE shadow_devices")) {
            return { success: true, meta: { changes: 1 } } as D1RunResult<T>
          }

          return { success: true, meta: { changes: 1 } } as D1RunResult<T>
        },
        async all<T = Record<string, unknown>>() {
          if (normalizedSql.includes("FROM shadow_sync_collections")) {
            const userId = String(record.bindings[0])
            return {
              success: true,
              results: [...collectionsByUserAndCollection.values()]
                .filter((row) => row.user_id === userId)
                .sort((a, b) => a.collection.localeCompare(b.collection)) as T[],
              meta: { changes: 0 },
            } as D1RunResult<T>
          }

          return {
            success: true,
            results: [] as T[],
            meta: { changes: 0 },
          } as D1RunResult<T>
        },
        async first<T = Record<string, unknown>>() {
          if (normalizedSql.includes("FROM shadow_users")) {
            return (usersByEmail.get(String(record.bindings[0])) ?? null) as T | null
          }
          if (normalizedSql.includes("FROM shadow_auth_sessions")) {
            return (sessionsById.get(String(record.bindings[0])) ?? null) as T | null
          }
          if (normalizedSql.includes("FROM shadow_devices")) {
            return (devicesByUserAndId.get(deviceKey(String(record.bindings[0]), String(record.bindings[1]))) ?? null) as T | null
          }
          if (normalizedSql.includes("SELECT MAX(cursor_order) AS max_cursor_order")) {
            const max = [...mutationsByServerMutationId.values()].reduce<number>((current, row) => Math.max(current, row.cursor_order), 0)
            return ({ max_cursor_order: max } as T)
          }
          if (normalizedSql.includes("FROM shadow_sync_mutations")) {
            return (mutationsByUserAndClientMutationId.get(mutationClientKey(String(record.bindings[0]), String(record.bindings[1]))) ?? null) as T | null
          }
          return null
        },
      }

      return statement
    }),
  }

  return {
    db,
    queries,
    seedShadowState() {
      usersByEmail.set("demo@astra.local", {
        id: "usr_demo",
        email: "demo@astra.local",
        billing_email: "demo@astra.local",
        created_at: "2026-04-08T00:00:00.000Z",
        plan: "pro",
        subscription_status: "active",
        identity_mode: "authenticated",
        install_id: null,
        provider_entitlements_json: JSON.stringify(["openai", "gemini"]),
        reading_history_sync_enabled: 1,
        study_progress_sync_enabled: 1,
        shadow_updated_at: "2026-04-10T12:00:00.000Z",
      })
      sessionsById.set("sess_demo", {
        session_id: "sess_demo",
        user_id: "usr_demo",
        device_id: "device-current",
        identity_mode: "authenticated",
        issued_at: "2026-04-10T00:00:00.000Z",
        expires_at: "2026-04-12T00:00:00.000Z",
        created_at: "2026-04-10T00:00:00.000Z",
        last_seen_at: "2026-04-10T12:00:00.000Z",
        last_verified_at: "2026-04-10T12:00:00.000Z",
        status: "active",
        revoked_at: null,
        token_hash: null,
        token_hash_alg: null,
        shadow_updated_at: "2026-04-10T12:00:00.000Z",
      })
      devicesByUserAndId.set(deviceKey("usr_demo", "device-current"), {
        id: "usr_demo:device-current",
        user_id: "usr_demo",
        device_id: "device-current",
        identity_mode: "authenticated",
        label: "Astra Chrome",
        platform: "macos",
        browser_family: "chrome",
        app_kind: "extension",
        app_version: "0.1.0",
        first_seen_at: "2026-04-08T00:00:00.000Z",
        last_seen_at: "2026-04-10T12:00:00.000Z",
        last_sync_at: "2026-04-10T12:00:00.000Z",
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-10T12:00:00.000Z",
        shadow_updated_at: "2026-04-10T12:00:00.000Z",
      })
      for (const collection of ["config", "vocabulary", "reading_history", "study_progress"] as const) {
        collectionsByUserAndCollection.set(collectionKey("usr_demo", collection), {
          user_id: "usr_demo",
          collection,
          enabled: collection === "config" || collection === "vocabulary" ? 1 : 1,
          default_enabled: collection === "config" || collection === "vocabulary" ? 1 : 0,
          last_issued_cursor: null,
          last_issued_cursor_order: null,
          last_server_updated_at: null,
          shadow_updated_at: "2026-04-10T12:00:00.000Z",
        })
      }
    },
    getStoredMutation(clientMutationId: string) {
      return mutationsByUserAndClientMutationId.get(mutationClientKey("usr_demo", clientMutationId)) ?? null
    },
    getStoredMutationCount() {
      return mutationsByUserAndClientMutationId.size
    },
  }
}

function createEnv(mode: SyncPushWriteMode, mockDb = createMockDb()) {
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
    DEVICE_REVOKE_WRITE_MODE: "proxy",
    SYNC_BOOTSTRAP_READ_MODE: "proxy",
    SYNC_PULL_READ_MODE: "proxy",
    SYNC_PUSH_WRITE_MODE: mode,
    ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST: "200",
    ASTRA_ENV: "test",
  }

  return { env, mockDb }
}

function createContext(mode: SyncPushWriteMode, maxMutationsPerRequest = 200) {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_sync_push_test",
    nowEpochMs: Date.parse("2026-04-11T12:00:00.000Z"),
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
      syncBootstrapReadMode: "proxy",
      syncPullReadMode: "proxy",
      syncPushWriteMode: mode,
      syncMaxMutationsPerRequest: maxMutationsPerRequest,
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
    execution: { waitUntil },
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

function createPushPayload() {
  return {
    serverTime: "2026-04-11T12:00:00.000Z",
    accepted: [
      {
        collection: "config",
        clientMutationId: "mut-config-1",
        recordId: "global",
        operation: "upsert",
        serverUpdatedAt: "2026-04-11T12:00:00.000Z",
        cursor: "1",
        deduped: false,
      },
    ],
    rejected: [],
    nextCursors: {
      config: "1",
      vocabulary: null,
      review_schedule: null,
      reading_history: null,
      study_progress: null,
    },
  }
}

function createRequest(mutations: SharedSyncMutationInput[] = [
  {
    collection: "config",
    schemaVersion: 1,
    recordId: "global",
    operation: "upsert",
    clientMutationId: "mut-config-1",
    deviceId: "device-current",
    clientUpdatedAt: "2026-04-11T11:59:00.000Z",
    payload: {
      kind: "global",
      config: {
        version: 1,
        targetLang: "zh-CN",
        connectionMode: "astra",
        hoverTrigger: "alt",
        contentScope: "page",
        inputTranslation: "enabled",
        inputTranslationMode: "replace",
        languageLevel: "intermediate",
        privacyMode: false,
        provider: {
          id: "openai",
          model: "gpt-5.4-nano",
        },
        tts: {
          enabled: true,
          engine: "browser",
          rate: 0.9,
          pitch: 1,
          highlightSentences: true,
        },
        presentation: {
          mode: "bilingual",
          theme: "default",
          fontSize: 0.92,
          translationColor: "#64748b",
        },
      },
    },
  },
]) {
  return new Request("https://platform.astra.example/v1/sync/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createSessionToken()}`,
      "Content-Type": "application/json",
      "X-Astra-Device-Id": "device-current",
    },
    body: JSON.stringify({ mutations }),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("handleSyncPush", () => {
  it("proxies sync-push writes when proxy mode is enabled", async () => {
    const { env } = createEnv("proxy")
    const { ctx } = createContext("proxy")
    const request = createRequest()

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createPushPayload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const response = await handleSyncPush(request, env, ctx)
    const body = await response.json() as { accepted: Array<{ clientMutationId: string }> }

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-push")
    expect(body.accepted[0]?.clientMutationId).toBe("mut-config-1")
  })

  it("writes to D1 first and returns the mirror-backed Node response in native mode", async () => {
    const { env, mockDb } = createEnv("native")
    mockDb.seedShadowState()
    const { ctx, flushWaitUntil } = createContext("native")
    const request = createRequest()

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(createPushPayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))

    const response = await handleSyncPush(request, env, ctx)
    await flushWaitUntil()
    const body = await response.json() as { accepted: Array<{ clientMutationId: string; deduped: boolean }> }

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(body.accepted[0]).toEqual(expect.objectContaining({
      clientMutationId: "mut-config-1",
      deduped: false,
    }))
    expect(mockDb.getStoredMutation("mut-config-1")).toEqual(expect.objectContaining({
      client_mutation_id: "mut-config-1",
      cursor: "1",
    }))
    expect(mockDb.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_mutations"))).toBe(true)
    expect(mockDb.queries.some((query) => query.sql.includes("UPDATE shadow_auth_sessions"))).toBe(true)
    expect(mockDb.queries.some((query) => query.sql.includes("UPDATE shadow_devices"))).toBe(true)
  })

  it("preserves review schedule payload updatedAt from the client in native D1 writes", async () => {
    const { env, mockDb } = createEnv("native")
    mockDb.seedShadowState()
    const { ctx, flushWaitUntil } = createContext("native")
    const clientUpdatedAt = 1_776_000_000_000
    const request = createRequest([{
      collection: "review_schedule",
      schemaVersion: 1,
      recordId: "word-1",
      operation: "upsert",
      clientMutationId: "mut-review-schedule-1",
      deviceId: "device-current",
      clientUpdatedAt: "2026-04-11T11:59:00.000Z",
      payload: {
        vocabularyEntryId: "word-1",
        srsBox: 2,
        nextReviewAt: clientUpdatedAt + 86_400_000,
        reviewCount: 1,
        lastReviewedAt: clientUpdatedAt,
        lastReviewGrade: "good",
        lastReviewGradeAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      },
    }])

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(createPushPayload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    await handleSyncPush(request, env, ctx)
    await flushWaitUntil()

    const stored = mockDb.getStoredMutation("mut-review-schedule-1")
    expect(JSON.parse(stored?.payload_json as string).updatedAt).toBe(clientUpdatedAt)
  })

  it("rejects oversized native sync-push batches with the Node-compatible limit error", async () => {
    const { env, mockDb } = createEnv("native")
    mockDb.seedShadowState()
    const { ctx } = createContext("native", 1)
    const request = createRequest([
      ...JSON.parse(JSON.stringify((createPushPayload().accepted.map(() => ({
        collection: "config",
        schemaVersion: 1,
        recordId: "global",
        operation: "upsert",
        clientMutationId: "mut-config-1",
        deviceId: "device-current",
        clientUpdatedAt: "2026-04-11T11:59:00.000Z",
        payload: {
          kind: "global",
          config: {
            version: 1,
            targetLang: "zh-CN",
            connectionMode: "astra",
            hoverTrigger: "alt",
            contentScope: "page",
            inputTranslation: "enabled",
            inputTranslationMode: "replace",
            languageLevel: "intermediate",
            privacyMode: false,
            provider: { id: "openai", model: "gpt-5.4-nano" },
            tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true },
            presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" },
          },
        },
      }))))),
      {
        collection: "vocabulary",
        schemaVersion: 1,
        recordId: "vocab-1",
        operation: "delete",
        clientMutationId: "mut-vocab-1",
        deviceId: "device-current",
        clientUpdatedAt: "2026-04-11T11:59:30.000Z",
        payload: null,
      },
    ])

    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await handleSyncPush(request, env, ctx)
    const body = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(body.error.code).toBe("INVALID_SYNC_PAYLOAD")
    expect(body.error.message).toContain("maxMutationsPerRequest (1)")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("falls back to the Node relay when native mode lacks prerequisite shadow state", async () => {
    const { env } = createEnv("native")
    const { ctx } = createContext("native")
    const request = createRequest()

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(createPushPayload()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))

    const response = await handleSyncPush(request, env, ctx)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("missing_shadow_user")
  })

  it("returns a guarded 503 when mirror-back transport is ambiguous after the D1 write", async () => {
    const { env, mockDb } = createEnv("native")
    mockDb.seedShadowState()
    const { ctx } = createContext("native")
    const request = createRequest()

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("relay unavailable"))

    const response = await handleSyncPush(request, env, ctx)
    const body = await response.json() as { error: { code: string } }

    expect(response.status).toBe(503)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("mirror_back_commit_unknown")
    expect(body.error.code).toBe("UPSTREAM_UNAVAILABLE")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.getStoredMutationCount()).toBe(1)
  })

  it("rolls back the D1 write and returns the Node response when mirror-back rejects the push", async () => {
    const { env, mockDb } = createEnv("native")
    mockDb.seedShadowState()
    const { ctx } = createContext("native")
    const request = createRequest()

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: "INVALID_SYNC_PAYLOAD",
          message: "Node rejected the push.",
        },
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }))

    const response = await handleSyncPush(request, env, ctx)
    const body = await response.json() as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("mirror_back_rejected")
    expect(body.error.code).toBe("INVALID_SYNC_PAYLOAD")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(mockDb.getStoredMutationCount()).toBe(0)
  })
})
