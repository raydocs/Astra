import { createHash } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import type { D1Database, D1PreparedStatement, D1RunResult } from "../platform/cloudflare/src/bindings"

import { FileUserStore } from "./user-store"
import type { RelayEnv, RelayShadowEvent } from "./types"

type QueryRecord = {
  sql: string
  bindings: unknown[]
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function createMockShadowDb() {
  const queries: QueryRecord[] = []
  const firstResults = new Map<string, unknown[]>()
  const allResults = new Map<string, unknown[][]>()
  const shadowSyncMutationsByUserAndClientMutationId = new Map<string, Record<string, unknown>>()

  function getKey(sql: string, mode: "first" | "all"): string {
    if (sql.includes("FROM shadow_users")) return `shadow_users:${mode}`
    if (sql.includes("FROM shadow_auth_sessions")) return `shadow_auth_sessions:${mode}`
    if (sql.includes("FROM shadow_devices")) return `shadow_devices:${mode}`
    if (sql.includes("FROM shadow_sync_collections")) return `shadow_sync_collections:${mode}`
    if (sql.includes("FROM shadow_sync_mutations")) return `shadow_sync_mutations:${mode}`
    return `other:${mode}`
  }

  const db: D1Database = {
    prepare<Row = Record<string, unknown>>(query: string): D1PreparedStatement<Row> {
      const sql = normalizeSql(query)
      let bindings: unknown[] = []

      const statement: D1PreparedStatement<Row> = {
        bind(...values: unknown[]) {
          bindings = values
          return statement
        },
        async run<T = Row>(): Promise<D1RunResult<T>> {
          queries.push({ sql, bindings: [...bindings] })

          if (sql.includes("INSERT INTO shadow_sync_mutations")) {
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
              _cursorOrder,
              payloadJson,
              shadowUpdatedAt,
            ] = bindings
            shadowSyncMutationsByUserAndClientMutationId.set(
              `${String(userId)}:${String(clientMutationId)}`,
              {
                server_mutation_id: serverMutationId,
                user_id: userId,
                collection,
                schema_version: schemaVersion,
                record_id: recordId,
                operation,
                client_mutation_id: clientMutationId,
                device_id: deviceId,
                client_updated_at: clientUpdatedAt,
                server_updated_at: serverUpdatedAt,
                cursor,
                payload_json: payloadJson,
                shadow_updated_at: shadowUpdatedAt,
              },
            )
          }

          return { success: true, meta: { changes: 1 } }
        },
        async all<T = Row>(): Promise<D1RunResult<T>> {
          queries.push({ sql, bindings: [...bindings] })
          const key = getKey(sql, "all")
          const queue = allResults.get(key) ?? []
          const results = queue.shift() ?? []
          allResults.set(key, queue)
          return { success: true, results: results as T[] }
        },
        async first<T = Row>(): Promise<T | null> {
          queries.push({ sql, bindings: [...bindings] })
          const key = getKey(sql, "first")
          const queue = firstResults.get(key) ?? []
          if (queue.length > 0) {
            const result = (queue.shift() ?? null) as T | null
            firstResults.set(key, queue)
            return result
          }

          if (key === "shadow_sync_mutations:first") {
            const [userId, clientMutationId] = bindings
            return (shadowSyncMutationsByUserAndClientMutationId.get(`${String(userId)}:${String(clientMutationId)}`) ?? null) as T | null
          }

          return null
        },
      }

      return statement
    },
  }

  return {
    db,
    queries,
    enqueueFirst(key: "shadow_users" | "shadow_auth_sessions" | "shadow_devices", value: unknown) {
      const bucket = firstResults.get(`${key}:first`) ?? []
      bucket.push(value)
      firstResults.set(`${key}:first`, bucket)
    },
    enqueueAll(
      key: "shadow_devices" | "shadow_sync_collections" | "shadow_sync_mutations",
      value: unknown[],
    ) {
      const bucket = allResults.get(`${key}:all`) ?? []
      bucket.push(value)
      allResults.set(`${key}:all`, bucket)
    },
  }
}

async function createEnv(overrides: Partial<RelayEnv> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "astra-store-"))
  const userDbPath = join(dir, "users.json")

  const env: RelayEnv = {
    port: 8787,
    host: "127.0.0.1",
    publicBaseURL: "http://127.0.0.1:8787/v1",
    sessionPublicBaseURL: "https://platform.astra.example/v1",
    sessionSecret: "test-secret",
    platformMirrorSecret: "mirror-secret",
    userDbPath,
    videoNoteStorePath: join(dir, "video-notes.json"),
    loginEmail: "demo@astra.local",
    loginPassword: "astra-demo-pass",
    plan: "pro",
    subscriptionStatus: "active",
    providerEntitlements: ["openai", "gemini"],
    billingCheckoutBaseURL: "https://billing.example/checkout",
    billingPortalBaseURL: "https://billing.example/portal",
    openaiApiKey: "openai-key",
    googleApiKey: "google-key",
    openrouterApiKey: "",
    useOpenRouter: false,
    openrouterModelMap: {},
    freeDailyRequests: 200,
    freeDailyCharacters: 200_000,
    freeRpm: 20,
    proDailyRequests: 2000,
    proDailyCharacters: 500_000,
    proRpm: 120,
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    syncMaxMutationsPerRequest: 200,
    videoNoteMaxConcurrentJobs: 1,
    ...overrides,
  }

  await writeFile(userDbPath, JSON.stringify({
    version: 1,
    users: [{
      id: "usr_demo",
      email: "demo@astra.local",
      billingEmail: "billing@astra.local",
      createdAt: "2026-03-01T00:00:00.000Z",
      passwordHash: createHash("sha256").update("astra-demo-pass").digest("hex"),
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
      limits: {
        dailyRequests: 2,
        dailyCharacters: 10,
        requestsPerMinute: 2,
      },
      usage: {
        usageDay: "2026-03-25",
        requestsToday: 0,
        charactersToday: 0,
        totalRequests: 0,
        totalCharacters: 0,
        lastRequestAt: null,
        recentRequestTimestamps: [],
        recentEvents: [],
      },
      identityMode: "authenticated",
    }],
  }, null, 2))

  return env
}

describe("file user store", () => {
  it("validates credentials from the file-backed user database", async () => {
    const store = new FileUserStore(await createEnv())
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")

    expect(user?.email).toBe("demo@astra.local")
  })

  it("migrates the legacy user database and persists durable session/device records", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")
    if (!user) throw new Error("Expected seeded user.")

    const issued = await store.issueBoundSession({
      user,
      device: {
        deviceId: "device-1",
        browserFamily: "chrome",
        platform: "macos",
        appVersion: "1.0.0",
      },
      identityMode: "authenticated",
    })

    expect(issued.session.sessionId).toBeTruthy()
    expect(issued.session.deviceId).toBe("device-1")

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      version: number
      devices: Array<{ deviceId: string }>
      sessions: Array<{ sessionId: string }>
    }
    expect(db.version).toBe(2)
    expect(db.devices[0]?.deviceId).toBe("device-1")
    expect(db.sessions[0]?.sessionId).toBe(issued.session.sessionId)
  })

  it("revokes a remote device and all of its sessions durably", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")
    if (!user) throw new Error("Expected seeded user.")

    const issued = await store.issueBoundSession({
      user,
      device: {
        deviceId: "device-revoke",
        browserFamily: "chrome",
        platform: "macos",
      },
      identityMode: "authenticated",
    })

    const revoked = await store.revokeDevice("demo@astra.local", "device-revoke")
    expect(revoked).toEqual({ found: true, revokedSessionCount: 1 })

    const devices = await store.listDevices("demo@astra.local")
    expect(devices.find((device) => device.deviceId === "device-revoke")?.status).toBe("revoked")

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      sessions: Array<{ sessionId: string; status: string }>
    }
    expect(db.sessions.find((session) => session.sessionId === issued.session.sessionId)?.status).toBe("revoked")
    expect(await store.getSession("demo@astra.local", issued.token)).toBeNull()
  })

  it("records usage and updates quota snapshots", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)
    const now = new Date()

    await store.recordTranslationUsage({
      email: "demo@astra.local",
      provider: "openai",
      characterCount: 5,
      timestamp: now,
    })

    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")
    if (!user) throw new Error("Expected seeded user.")
    const issued = await store.issueBoundSession({
      user,
      device: { deviceId: "device-usage" },
      identityMode: "authenticated",
    })
    const session = await store.getSession("demo@astra.local", issued.token)
    expect(session?.usage.totalCharacters).toBe(5)
    expect(session?.quota.remainingDailyRequests).toBe(1)
  })

  it("returns account and usage snapshots independently from the session", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const account = await store.getAccount("demo@astra.local")
    const usage = await store.getUsageSnapshot("demo@astra.local")

    expect(account?.id).toBe("usr_demo")
    expect(account?.billingEmail).toBe("billing@astra.local")
    expect(usage?.quota.dailyRequestsLimit).toBe(2)
    expect(typeof usage?.generatedAt).toBe("string")
  })

  it("updates plan policy and entitlements", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const account = await store.updatePlan("demo@astra.local", "free")
    expect(account?.plan).toBe("free")
    expect(account?.providerEntitlements).toEqual(["openai"])
  })

  it("returns existing anonymous user when installId matches", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const first = await store.createAnonymousUser("install-abc")
    const second = await store.createAnonymousUser("install-abc")

    expect(first.email).toBe(second.email)
    expect(first.installId).toBe("install-abc")
  })

  it("creates separate anonymous users for different installIds", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const first = await store.createAnonymousUser("install-abc")
    const second = await store.createAnonymousUser("install-xyz")

    expect(first.email).not.toBe(second.email)
  })

  it("creates a new anonymous user each time when no installId is given", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const first = await store.createAnonymousUser()
    const second = await store.createAnonymousUser()

    expect(first.email).not.toBe(second.email)
  })

  it("finds anonymous user by installId", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    await store.createAnonymousUser("install-lookup")
    const found = await store.findAnonymousUserByInstallId("install-lookup")

    expect(found).not.toBeNull()
    expect(found?.installId).toBe("install-lookup")
    expect(found?.identityMode).toBe("anonymous")
  })

  it("persists sync mutations and returns them via pull", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const push = await store.pushSyncMutations("demo@astra.local", "device-sync", [{
      collection: "config",
      schemaVersion: 1,
      recordId: "global",
      operation: "upsert",
      clientMutationId: "mut-1",
      deviceId: "device-sync",
      clientUpdatedAt: "2026-04-09T12:00:00.000Z",
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
    }])

    expect(push.accepted).toHaveLength(1)
    expect(push.accepted[0]?.deduped).toBe(false)

    const pull = await store.pullSyncMutations("demo@astra.local", { config: null })
    expect(pull.deltas.config).toHaveLength(1)
    expect(pull.deltas.config[0]?.clientMutationId).toBe("mut-1")
  })

  it("accepts reading history mutations after the collection is enabled", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    await store.updateSyncCollectionPreference("demo@astra.local", "reading_history", true)

    const push = await store.pushSyncMutations("demo@astra.local", "device-sync", [{
      collection: "reading_history",
      schemaVersion: 1,
      recordId: "https://example.com/article",
      operation: "upsert",
      clientMutationId: "mut-history-1",
      deviceId: "device-sync",
      clientUpdatedAt: "2026-04-09T12:00:00.000Z",
      payload: {
        id: "https://example.com/article",
        url: "https://example.com/article?utm=1",
        hostname: "example.com",
        title: "Example",
        wordsTranslated: 12,
        visitedAt: 1234,
      },
    }])

    expect(push.accepted).toEqual([
      expect.objectContaining({
        collection: "reading_history",
        clientMutationId: "mut-history-1",
        deduped: false,
      }),
    ])
    expect(push.rejected).toEqual([])

    const pull = await store.pullSyncMutations("demo@astra.local", { reading_history: null })
    expect(pull.deltas.reading_history).toEqual([
      expect.objectContaining({
        recordId: "https://example.com/article",
        payload: expect.objectContaining({
          id: "https://example.com/article",
          url: "https://example.com/article",
        }),
      }),
    ])
  })

  it("rejects study progress mutations while the collection is disabled", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const push = await store.pushSyncMutations("demo@astra.local", "device-sync", [{
      collection: "study_progress",
      schemaVersion: 1,
      recordId: "https://example.com",
      operation: "upsert",
      clientMutationId: "mut-progress-1",
      deviceId: "device-sync",
      clientUpdatedAt: "2026-04-09T12:00:00.000Z",
      payload: {
        url: "https://example.com",
        hostname: "example.com",
        title: "Example",
        completedSteps: ["read"],
        sentencesExplained: 0,
        vocabSaved: 0,
        startedAt: 1000,
        lastActivityAt: 1000,
      },
    }])

    expect(push.accepted).toEqual([])
    expect(push.rejected).toEqual([
      expect.objectContaining({
        collection: "study_progress",
        clientMutationId: "mut-progress-1",
        code: "SYNC_DISABLED",
      }),
    ])
  })

  it("accepts study progress mutations after the collection is enabled", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    await store.updateSyncCollectionPreference("demo@astra.local", "study_progress", true)

    const push = await store.pushSyncMutations("demo@astra.local", "device-sync", [{
      collection: "study_progress",
      schemaVersion: 1,
      recordId: "https://example.com/article",
      operation: "upsert",
      clientMutationId: "mut-progress-1",
      deviceId: "device-sync",
      clientUpdatedAt: "2026-04-09T12:00:00.000Z",
      payload: {
        url: "https://example.com/article?utm=1",
        hostname: "example.com",
        title: "Example",
        completedSteps: ["guided_read", "read", "read"],
        sentencesExplained: 2,
        vocabSaved: 1,
        startedAt: 1000,
        lastActivityAt: 2000,
      },
    }])

    expect(push.accepted).toEqual([
      expect.objectContaining({
        collection: "study_progress",
        clientMutationId: "mut-progress-1",
        deduped: false,
      }),
    ])
    expect(push.rejected).toEqual([])

    const pull = await store.pullSyncMutations("demo@astra.local", { study_progress: null })
    expect(pull.deltas.study_progress).toEqual([
      expect.objectContaining({
        recordId: "https://example.com/article",
        payload: expect.objectContaining({
          url: "https://example.com/article",
          completedSteps: ["read", "guided_read"],
          sentencesExplained: 2,
          vocabSaved: 1,
        }),
      }),
    ])
  })

  it("does not return optional study progress deltas when the collection is not requested", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    await store.updateSyncCollectionPreference("demo@astra.local", "study_progress", true)
    await store.pushSyncMutations("demo@astra.local", "device-sync", [{
      collection: "study_progress",
      schemaVersion: 1,
      recordId: "https://example.com/article",
      operation: "upsert",
      clientMutationId: "mut-progress-1",
      deviceId: "device-sync",
      clientUpdatedAt: "2026-04-09T12:00:00.000Z",
      payload: {
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example",
        completedSteps: ["read"],
        sentencesExplained: 0,
        vocabSaved: 0,
        startedAt: 1000,
        lastActivityAt: 1000,
      },
    }])

    const pull = await store.pullSyncMutations("demo@astra.local", { config: null })
    expect(pull.deltas.study_progress).toEqual([])
    expect(pull.nextCursors.study_progress).toBeNull()
  })

  it("mirrors auth, session, device, and sync writes into the Cloudflare shadow store when enabled", async () => {
    const shadow = createMockShadowDb()
    const env = await createEnv({
      cloudflareShadow: {
        writeEnabled: true,
        readParityEnabled: false,
        db: shadow.db,
      },
    })
    const store = new FileUserStore(env)
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")
    if (!user) throw new Error("Expected seeded user.")

    const issued = await store.issueBoundSession({
      user,
      device: {
        deviceId: "device-shadow",
        browserFamily: "chrome",
        platform: "macos",
        appKind: "extension",
      },
      identityMode: "authenticated",
    })

    await store.touchSession(issued.session.sessionId, {
      seenAt: new Date("2026-04-10T00:10:00.000Z"),
      syncAt: new Date("2026-04-10T00:10:00.000Z"),
    })
    await store.updateSyncCollectionPreference("demo@astra.local", "reading_history", true)
    await store.pushSyncMutations("demo@astra.local", "device-shadow", [{
      collection: "reading_history",
      schemaVersion: 1,
      recordId: "https://example.com/shadow",
      operation: "upsert",
      clientMutationId: "mut-shadow-1",
      deviceId: "device-shadow",
      clientUpdatedAt: "2026-04-10T00:10:00.000Z",
      payload: {
        id: "https://example.com/shadow",
        url: "https://example.com/shadow",
        hostname: "example.com",
        title: "Shadow",
        wordsTranslated: 10,
        visitedAt: 100,
      },
    }])
    await store.revokeSession("demo@astra.local", issued.session.sessionId, new Date("2026-04-10T00:20:00.000Z"))

    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_users"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_auth_sessions"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_devices"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("UPDATE shadow_auth_sessions"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("UPDATE shadow_devices"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_collections"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_mutations"))).toBe(true)
  })

  it("records compare-only parity mismatches without changing authoritative reads", async () => {
    const shadow = createMockShadowDb()
    const events: RelayShadowEvent[] = []
    const env = await createEnv({
      cloudflareShadow: {
        writeEnabled: false,
        readParityEnabled: true,
        db: shadow.db,
        onEvent: (event) => events.push(event),
      },
    })
    const store = new FileUserStore(env)
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")
    if (!user) throw new Error("Expected seeded user.")

    const issued = await store.issueBoundSession({
      user,
      device: {
        deviceId: "device-parity",
        browserFamily: "chrome",
        platform: "macos",
        appKind: "extension",
      },
      identityMode: "authenticated",
    })

    await store.updateSyncCollectionPreference("demo@astra.local", "reading_history", true)
    await store.pushSyncMutations("demo@astra.local", "device-parity", [{
      collection: "config",
      schemaVersion: 1,
      recordId: "global",
      operation: "upsert",
      clientMutationId: "mut-parity-1",
      deviceId: "device-parity",
      clientUpdatedAt: "2026-04-10T00:30:00.000Z",
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
            rate: 1,
            pitch: 1,
            highlightSentences: true,
          },
          presentation: {
            mode: "bilingual",
            theme: "default",
            fontSize: 1,
            translationColor: "#64748b",
          },
        },
      },
    }])

    shadow.enqueueFirst("shadow_users", {
      id: "usr_demo",
      email: "demo@astra.local",
      billing_email: "billing@astra.local",
      created_at: "2026-03-01T00:00:00.000Z",
      plan: "free",
      subscription_status: "active",
      identity_mode: "authenticated",
      install_id: null,
      provider_entitlements_json: JSON.stringify(["openai"]),
      reading_history_sync_enabled: 0,
      study_progress_sync_enabled: 0,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    })
    shadow.enqueueFirst("shadow_auth_sessions", null)
    shadow.enqueueAll("shadow_devices", [])

    const sessionContext = await store.getSessionContext("demo@astra.local", issued.session.sessionId)
    expect(sessionContext?.session.sessionId).toBe(issued.session.sessionId)

    shadow.enqueueAll("shadow_devices", [])
    const devices = await store.listDevices("demo@astra.local", "device-parity")
    expect(devices).toHaveLength(1)

    shadow.enqueueAll("shadow_sync_collections", [])
    const bootstrap = await store.getSyncBootstrap("demo@astra.local", "device-parity")
    expect(bootstrap.deviceId).toBe("device-parity")

    shadow.enqueueAll("shadow_sync_collections", [])
    shadow.enqueueAll("shadow_sync_mutations", [])
    shadow.enqueueAll("shadow_sync_mutations", [])
    const pull = await store.pullSyncMutations("demo@astra.local", { config: null })
    expect(pull.deltas.config).toHaveLength(1)

    expect(events.map((event) => event.scope)).toEqual(expect.arrayContaining([
      "session_lookup",
      "device_list",
      "sync_bootstrap",
      "sync_pull",
    ]))
    expect(events.every((event) => event.outcome === "mismatch")).toBe(true)
  })

  it("emits no parity events when shadow reads match the Node authoritative state", async () => {
    const shadow = createMockShadowDb()
    const events: RelayShadowEvent[] = []
    const env = await createEnv({
      cloudflareShadow: {
        writeEnabled: false,
        readParityEnabled: true,
        db: shadow.db,
        onEvent: (event) => events.push(event),
      },
    })
    const store = new FileUserStore(env)
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")
    if (!user) throw new Error("Expected seeded user.")

    const issued = await store.issueBoundSession({
      user,
      device: {
        deviceId: "device-parity-match",
        browserFamily: "chrome",
        platform: "macos",
        appKind: "extension",
      },
      identityMode: "authenticated",
    })

    await store.updateSyncCollectionPreference("demo@astra.local", "reading_history", true)
    const push = await store.pushSyncMutations("demo@astra.local", "device-parity-match", [{
      collection: "config",
      schemaVersion: 1,
      recordId: "global",
      operation: "upsert",
      clientMutationId: "mut-parity-match-1",
      deviceId: "device-parity-match",
      clientUpdatedAt: "2026-04-10T00:40:00.000Z",
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
            rate: 1,
            pitch: 1,
            highlightSentences: true,
          },
          presentation: {
            mode: "bilingual",
            theme: "default",
            fontSize: 1,
            translationColor: "#64748b",
          },
        },
      },
    }])
    const storedMutation = push.accepted[0]
    if (!storedMutation) throw new Error("Expected accepted mutation.")
    const storedServerMutationId = (
      JSON.parse(await readFile(env.userDbPath, "utf8")) as { syncMutations: Array<{ serverMutationId: string }> }
    ).syncMutations[0]?.serverMutationId
    if (!storedServerMutationId) throw new Error("Expected stored server mutation id.")

    shadow.enqueueFirst("shadow_users", {
      id: user.id,
      email: user.email,
      billing_email: user.billingEmail,
      created_at: user.createdAt,
      plan: user.plan,
      subscription_status: user.subscriptionStatus,
      identity_mode: user.identityMode,
      install_id: user.installId ?? null,
      provider_entitlements_json: JSON.stringify(user.providerEntitlements),
      reading_history_sync_enabled: 1,
      study_progress_sync_enabled: 0,
      shadow_updated_at: issued.session.issuedAt,
    })
    shadow.enqueueFirst("shadow_auth_sessions", {
      session_id: issued.session.sessionId,
      user_id: user.id,
      device_id: issued.session.deviceId,
      identity_mode: issued.session.identityMode,
      token_hash: null,
      token_hash_alg: null,
      issued_at: issued.session.issuedAt,
      expires_at: issued.session.expiresAt,
      created_at: issued.session.issuedAt,
      last_seen_at: issued.session.issuedAt,
      last_verified_at: issued.session.issuedAt,
      status: "active",
      revoked_at: null,
      shadow_updated_at: issued.session.issuedAt,
    })
    shadow.enqueueAll("shadow_devices", [{
      id: `${user.id}:${issued.session.deviceId}`,
      user_id: user.id,
      device_id: issued.session.deviceId,
      identity_mode: "authenticated",
      label: "Chrome on Macos",
      platform: "macos",
      browser_family: "chrome",
      app_kind: "extension",
      app_version: null,
      first_seen_at: issued.session.issuedAt,
      last_seen_at: issued.session.issuedAt,
      last_sync_at: null,
      status: "active",
      revoked_at: null,
      updated_at: issued.session.issuedAt,
      shadow_updated_at: issued.session.issuedAt,
    }])

    const sessionContext = await store.getSessionContext("demo@astra.local", issued.session.sessionId)
    expect(sessionContext?.session.sessionId).toBe(issued.session.sessionId)

    shadow.enqueueAll("shadow_devices", [{
      id: `${user.id}:${issued.session.deviceId}`,
      user_id: user.id,
      device_id: issued.session.deviceId,
      identity_mode: "authenticated",
      label: "Chrome on Macos",
      platform: "macos",
      browser_family: "chrome",
      app_kind: "extension",
      app_version: null,
      first_seen_at: issued.session.issuedAt,
      last_seen_at: issued.session.issuedAt,
      last_sync_at: null,
      status: "active",
      revoked_at: null,
      updated_at: issued.session.issuedAt,
      shadow_updated_at: issued.session.issuedAt,
    }])
    const devices = await store.listDevices("demo@astra.local", "device-parity-match")
    expect(devices).toHaveLength(1)

    shadow.enqueueAll("shadow_sync_collections", [
      {
        user_id: user.id,
        collection: "config",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: storedMutation.cursor,
        last_issued_cursor_order: Number(storedMutation.cursor),
        last_server_updated_at: storedMutation.serverUpdatedAt,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
      {
        user_id: user.id,
        collection: "vocabulary",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
      {
        user_id: user.id,
        collection: "reading_history",
        enabled: 1,
        default_enabled: 0,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
      {
        user_id: user.id,
        collection: "study_progress",
        enabled: 0,
        default_enabled: 0,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
    ])
    const bootstrap = await store.getSyncBootstrap("demo@astra.local", "device-parity-match")
    expect(bootstrap.collections.config.cursor).toBe(storedMutation.cursor)

    shadow.enqueueAll("shadow_sync_collections", [
      {
        user_id: user.id,
        collection: "config",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: storedMutation.cursor,
        last_issued_cursor_order: Number(storedMutation.cursor),
        last_server_updated_at: storedMutation.serverUpdatedAt,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
      {
        user_id: user.id,
        collection: "vocabulary",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
      {
        user_id: user.id,
        collection: "reading_history",
        enabled: 1,
        default_enabled: 0,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
      {
        user_id: user.id,
        collection: "study_progress",
        enabled: 0,
        default_enabled: 0,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: storedMutation.serverUpdatedAt,
      },
    ])
    shadow.enqueueAll("shadow_sync_mutations", [{
      server_mutation_id: storedServerMutationId,
      user_id: user.id,
      collection: "config",
      schema_version: 1,
      record_id: "global",
      operation: "upsert",
      client_mutation_id: storedMutation.clientMutationId,
      device_id: "device-parity-match",
      client_updated_at: "2026-04-10T00:40:00.000Z",
      server_updated_at: storedMutation.serverUpdatedAt,
      cursor: storedMutation.cursor,
      cursor_order: Number(storedMutation.cursor),
      payload_json: JSON.stringify({
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
            rate: 1,
            pitch: 1,
            highlightSentences: true,
          },
          presentation: {
            mode: "bilingual",
            theme: "default",
            fontSize: 1,
            translationColor: "#64748b",
          },
        },
      }),
      shadow_updated_at: storedMutation.serverUpdatedAt,
    }])
    shadow.enqueueAll("shadow_sync_mutations", [])
    const pull = await store.pullSyncMutations("demo@astra.local", { config: null })
    expect(pull.deltas.config).toHaveLength(1)

    expect(events).toEqual([])
  })
})
