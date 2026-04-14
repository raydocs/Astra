import { createHash } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import type { D1Database, D1PreparedStatement, D1RunResult } from "../platform/cloudflare/src/bindings"

import { applyCloudflareShadowBackfill, inspectCloudflareShadowConsistency } from "./cloudflare-shadow-audit"
import type { ServerUserDatabase } from "./user-store"
import type { RelayEnv } from "./types"

type QueryRecord = {
  sql: string
  bindings: unknown[]
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function createAuditShadowDb() {
  const queries: QueryRecord[] = []
  const allResults = new Map<string, unknown[][]>()
  const firstResults = new Map<string, unknown[]>()

  function getKey(sql: string): string {
    if (sql.includes("SELECT MAX(cursor_order)")) return "shadow_sync_max_cursor_order"
    if (sql.includes("FROM shadow_sync_mutations") && sql.includes("WHERE user_id = ? AND client_mutation_id = ?")) {
      return "shadow_sync_mutations_first"
    }
    if (sql.includes("FROM shadow_users")) return "shadow_users"
    if (sql.includes("FROM shadow_user_credentials")) return "shadow_user_credentials"
    if (sql.includes("FROM shadow_auth_sessions")) return "shadow_auth_sessions"
    if (sql.includes("FROM shadow_devices")) return "shadow_devices"
    if (sql.includes("FROM shadow_sync_collections")) return "shadow_sync_collections"
    if (sql.includes("FROM shadow_sync_mutations")) return "shadow_sync_mutations"
    return "other"
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
          return { success: true, meta: { changes: 0 }, results: [] as T[] }
        },
        async all<T = Row>(): Promise<D1RunResult<T>> {
          queries.push({ sql, bindings: [...bindings] })
          const key = getKey(sql)
          const queue = allResults.get(key) ?? []
          const results = queue.shift() ?? []
          allResults.set(key, queue)
          return { success: true, results: results as T[] }
        },
        async first<T = Row>(): Promise<T | null> {
          queries.push({ sql, bindings: [...bindings] })
          const key = getKey(sql)
          const queue = firstResults.get(key) ?? []
          const result = queue.shift() ?? null
          firstResults.set(key, queue)
          return result as T | null
        },
      }
      return statement
    },
  }

  return {
    db,
    queries,
    enqueueAll(
      key:
        | "shadow_users"
        | "shadow_user_credentials"
        | "shadow_auth_sessions"
        | "shadow_devices"
        | "shadow_sync_collections"
        | "shadow_sync_mutations",
      value: unknown[],
    ) {
      const bucket = allResults.get(key) ?? []
      bucket.push(value)
      allResults.set(key, bucket)
    },
    enqueueFirst(
      key: "shadow_sync_max_cursor_order" | "shadow_sync_mutations_first" | "shadow_user_credentials",
      value: unknown,
    ) {
      const bucket = firstResults.get(key) ?? []
      bucket.push(value)
      firstResults.set(key, bucket)
    },
  }
}

async function createEnv(db: ServerUserDatabase): Promise<RelayEnv> {
  const dir = await mkdtemp(join(tmpdir(), "astra-shadow-audit-"))
  const userDbPath = join(dir, "users.json")
  await writeFile(userDbPath, JSON.stringify(db, null, 2))

  return {
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
  }
}

function createAuthoritativeDatabase(): ServerUserDatabase {
  return {
    version: 2,
    users: [{
      id: "usr_demo",
      email: "demo@astra.local",
      billingEmail: "billing@astra.local",
      createdAt: "2026-04-01T00:00:00.000Z",
      passwordHash: createHash("sha256").update("astra-demo-pass").digest("hex"),
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
      limits: {
        dailyRequests: 2000,
        dailyCharacters: 500_000,
        requestsPerMinute: 120,
      },
      usage: {
        usageDay: "2026-04-10",
        requestsToday: 0,
        charactersToday: 0,
        totalRequests: 0,
        totalCharacters: 0,
        lastRequestAt: null,
        recentRequestTimestamps: [],
        recentEvents: [],
      },
      identityMode: "authenticated",
      syncPreferences: {
        reading_history: false,
        study_progress: false,
      },
    }],
    devices: [{
      deviceId: "device_demo",
      userId: "usr_demo",
      email: "demo@astra.local",
      identityMode: "authenticated",
      label: "Chrome on Macos",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "extension",
      appVersion: "0.1.0",
      firstSeenAt: "2026-04-01T00:00:00.000Z",
      lastSeenAt: "2026-04-10T00:00:00.000Z",
      lastSyncAt: null,
      status: "active",
      updatedAt: "2026-04-10T00:00:00.000Z",
      revokedAt: null,
    }],
    sessions: [{
      sessionId: "sess_demo",
      userId: "usr_demo",
      email: "demo@astra.local",
      deviceId: "device_demo",
      identityMode: "authenticated",
      issuedAt: "2026-04-01T00:00:00.000Z",
      expiresAt: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      lastSeenAt: "2026-04-10T00:00:00.000Z",
      lastVerifiedAt: "2026-04-10T00:00:00.000Z",
      status: "active",
      revokedAt: null,
    }],
    syncMutations: [{
      ownerId: "usr_demo",
      email: "demo@astra.local",
      serverMutationId: "srv_mut_1",
      serverUpdatedAt: "2026-04-10T00:00:00.000Z",
      cursor: "1",
      collection: "config",
      schemaVersion: 1,
      recordId: "global",
      operation: "upsert",
      clientMutationId: "mut_1",
      deviceId: "device_demo",
      clientUpdatedAt: "2026-04-10T00:00:00.000Z",
      payload: {
        kind: "global",
      },
    }],
    nextSyncCursor: 1,
  }
}

function enqueuePerfectShadowState(shadow: ReturnType<typeof createAuditShadowDb>) {
  shadow.enqueueAll("shadow_users", [{
    id: "usr_demo",
    email: "demo@astra.local",
    billing_email: "billing@astra.local",
    created_at: "2026-04-01T00:00:00.000Z",
    plan: "pro",
    subscription_status: "active",
    identity_mode: "authenticated",
    install_id: null,
    provider_entitlements_json: JSON.stringify(["openai", "gemini"]),
    reading_history_sync_enabled: 0,
    study_progress_sync_enabled: 0,
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  }])
  shadow.enqueueFirst("shadow_user_credentials", {
    user_id: "usr_demo",
    credential_kind: "password",
    password_hash: createHash("sha256").update("astra-demo-pass").digest("hex"),
    password_hash_alg: "sha256_v1",
    updated_at: "2026-04-01T00:00:00.000Z",
    shadow_updated_at: "2026-04-01T00:00:00.000Z",
  })
  shadow.enqueueAll("shadow_devices", [{
    id: "usr_demo:device_demo",
    user_id: "usr_demo",
    device_id: "device_demo",
    identity_mode: "authenticated",
    label: "Chrome on Macos",
    platform: "macos",
    browser_family: "chrome",
    app_kind: "extension",
    app_version: "0.1.0",
    first_seen_at: "2026-04-01T00:00:00.000Z",
    last_seen_at: "2026-04-10T00:00:00.000Z",
    last_sync_at: null,
    status: "active",
    revoked_at: null,
    updated_at: "2026-04-10T00:00:00.000Z",
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  }])
  shadow.enqueueAll("shadow_auth_sessions", [{
    session_id: "sess_demo",
    user_id: "usr_demo",
    device_id: "device_demo",
    identity_mode: "authenticated",
    token_hash: "sha256-demo",
    token_hash_alg: "sha256",
    issued_at: "2026-04-01T00:00:00.000Z",
    expires_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    last_seen_at: "2026-04-10T00:00:00.000Z",
    last_verified_at: "2026-04-10T00:00:00.000Z",
    status: "active",
    revoked_at: null,
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  }])
  shadow.enqueueAll("shadow_sync_collections", [
    {
      user_id: "usr_demo",
      collection: "config",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: "1",
      last_issued_cursor_order: 1,
      last_server_updated_at: "2026-04-10T00:00:00.000Z",
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "vocabulary",
      enabled: 1,
      default_enabled: 1,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "reading_history",
      enabled: 0,
      default_enabled: 0,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    },
    {
      user_id: "usr_demo",
      collection: "study_progress",
      enabled: 0,
      default_enabled: 0,
      last_issued_cursor: null,
      last_issued_cursor_order: null,
      last_server_updated_at: null,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    },
  ])
  shadow.enqueueAll("shadow_sync_mutations", [{
    server_mutation_id: "srv_mut_1",
    user_id: "usr_demo",
    collection: "config",
    schema_version: 1,
    record_id: "global",
    operation: "upsert",
    client_mutation_id: "mut_1",
    device_id: "device_demo",
    client_updated_at: "2026-04-10T00:00:00.000Z",
    server_updated_at: "2026-04-10T00:00:00.000Z",
    cursor: "1",
    cursor_order: 1,
    payload_json: JSON.stringify({ kind: "global" }),
    shadow_updated_at: "2026-04-10T00:00:00.000Z",
  }])
}

describe("cloudflare shadow audit", () => {
  it("returns a clean audit and empty dry-run plan when Node and D1 match", async () => {
    const shadow = createAuditShadowDb()
    enqueuePerfectShadowState(shadow)

    const inspection = await inspectCloudflareShadowConsistency({
      env: await createEnv(createAuthoritativeDatabase()),
      db: shadow.db,
      includeBackfillPlan: true,
    })

    expect(inspection.audit.ok).toBe(true)
    expect(inspection.audit.summary.diffCount).toBe(0)
    expect(inspection.backfill?.summary.actionCount).toBe(0)
  })

  it("plans additive dry-run backfill actions for missing shadow rows", async () => {
    const shadow = createAuditShadowDb()
    shadow.enqueueAll("shadow_users", [])
    shadow.enqueueAll("shadow_user_credentials", [])
    shadow.enqueueAll("shadow_devices", [])
    shadow.enqueueAll("shadow_auth_sessions", [])
    shadow.enqueueAll("shadow_sync_collections", [])
    shadow.enqueueAll("shadow_sync_mutations", [])

    const inspection = await inspectCloudflareShadowConsistency({
      env: await createEnv(createAuthoritativeDatabase()),
      db: shadow.db,
      includeBackfillPlan: true,
    })

    expect(inspection.audit.ok).toBe(false)
    expect(inspection.audit.summary.diffCountByOutcome.missing_in_shadow).toBe(9)
    expect(inspection.audit.issuancePrerequisites.authenticatedUsersMissingCredentials).toEqual([
      { userId: "usr_demo", email: "demo@astra.local" },
    ])
    expect(inspection.backfill?.summary.actionCountByKind).toEqual({
      upsert_user: 1,
      upsert_user_credential: 1,
      upsert_device: 1,
      upsert_session: 1,
      mirror_sync_collections: 1,
      append_sync_mutation: 1,
    })
  })

  it("ignores session token hash drift but keeps extra shadow-only rows unresolved", async () => {
    const shadow = createAuditShadowDb()
    shadow.enqueueAll("shadow_users", [{
      id: "usr_demo",
      email: "demo@astra.local",
      billing_email: "billing@astra.local",
      created_at: "2026-04-01T00:00:00.000Z",
      plan: "pro",
      subscription_status: "active",
      identity_mode: "authenticated",
      install_id: null,
      provider_entitlements_json: JSON.stringify(["openai", "gemini"]),
      reading_history_sync_enabled: 0,
      study_progress_sync_enabled: 0,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    }])
    shadow.enqueueFirst("shadow_user_credentials", {
      user_id: "usr_demo",
      credential_kind: "password",
      password_hash: createHash("sha256").update("astra-demo-pass").digest("hex"),
      password_hash_alg: "sha256_v1",
      updated_at: "2026-04-01T00:00:00.000Z",
      shadow_updated_at: "2026-04-01T00:00:00.000Z",
    })
    shadow.enqueueAll("shadow_devices", [
      {
        id: "usr_demo:device_demo",
        user_id: "usr_demo",
        device_id: "device_demo",
        identity_mode: "authenticated",
        label: "Chrome on Macos",
        platform: "macos",
        browser_family: "chrome",
        app_kind: "extension",
        app_version: "0.1.0",
        first_seen_at: "2026-04-01T00:00:00.000Z",
        last_seen_at: "2026-04-10T00:00:00.000Z",
        last_sync_at: null,
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-10T00:00:00.000Z",
        shadow_updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "usr_demo:device_extra",
        user_id: "usr_demo",
        device_id: "device_extra",
        identity_mode: "authenticated",
        label: "Extra shadow device",
        platform: "macos",
        browser_family: "chrome",
        app_kind: "extension",
        app_version: null,
        first_seen_at: "2026-04-05T00:00:00.000Z",
        last_seen_at: "2026-04-05T00:00:00.000Z",
        last_sync_at: null,
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-05T00:00:00.000Z",
        shadow_updated_at: "2026-04-05T00:00:00.000Z",
      },
    ])
    shadow.enqueueAll("shadow_auth_sessions", [{
      session_id: "sess_demo",
      user_id: "usr_demo",
      device_id: "device_demo",
      identity_mode: "authenticated",
      token_hash: "sha256-different",
      token_hash_alg: "sha256",
      issued_at: "2026-04-01T00:00:00.000Z",
      expires_at: null,
      created_at: "2026-04-01T00:00:00.000Z",
      last_seen_at: "2026-04-10T00:00:00.000Z",
      last_verified_at: "2026-04-10T00:00:00.000Z",
      status: "active",
      revoked_at: null,
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    }])
    shadow.enqueueAll("shadow_sync_collections", [
      {
        user_id: "usr_demo",
        collection: "config",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: "1",
        last_issued_cursor_order: 1,
        last_server_updated_at: "2026-04-10T00:00:00.000Z",
        shadow_updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        user_id: "usr_demo",
        collection: "vocabulary",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        user_id: "usr_demo",
        collection: "reading_history",
        enabled: 0,
        default_enabled: 0,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        user_id: "usr_demo",
        collection: "study_progress",
        enabled: 0,
        default_enabled: 0,
        last_issued_cursor: null,
        last_issued_cursor_order: null,
        last_server_updated_at: null,
        shadow_updated_at: "2026-04-10T00:00:00.000Z",
      },
    ])
    shadow.enqueueAll("shadow_sync_mutations", [{
      server_mutation_id: "srv_mut_1",
      user_id: "usr_demo",
      collection: "config",
      schema_version: 1,
      record_id: "global",
      operation: "upsert",
      client_mutation_id: "mut_1",
      device_id: "device_demo",
      client_updated_at: "2026-04-10T00:00:00.000Z",
      server_updated_at: "2026-04-10T00:00:00.000Z",
      cursor: "1",
      cursor_order: 1,
      payload_json: JSON.stringify({ kind: "global" }),
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    }])

    const inspection = await inspectCloudflareShadowConsistency({
      env: await createEnv(createAuthoritativeDatabase()),
      db: shadow.db,
      includeBackfillPlan: true,
    })

    expect(inspection.audit.summary.diffCount).toBe(1)
    expect(inspection.audit.diffs[0]?.scope).toBe("devices")
    expect(inspection.audit.diffs[0]?.outcome).toBe("extra_in_shadow")
    expect(inspection.backfill?.summary.actionCount).toBe(0)
    expect(inspection.backfill?.summary.wouldReachFullParity).toBe(false)
  })

  it("applies additive backfill actions and re-verifies the shadow state", async () => {
    const shadow = createAuditShadowDb()
    shadow.enqueueAll("shadow_users", [])
    shadow.enqueueFirst("shadow_user_credentials", null)
    shadow.enqueueAll("shadow_devices", [])
    shadow.enqueueAll("shadow_auth_sessions", [])
    shadow.enqueueAll("shadow_sync_collections", [])
    shadow.enqueueAll("shadow_sync_mutations", [])
    enqueuePerfectShadowState(shadow)
    shadow.enqueueFirst("shadow_sync_max_cursor_order", { max_cursor_order: null })
    shadow.enqueueFirst("shadow_sync_mutations_first", {
      server_mutation_id: "srv_mut_1",
      user_id: "usr_demo",
      collection: "config",
      schema_version: 1,
      record_id: "global",
      operation: "upsert",
      client_mutation_id: "mut_1",
      device_id: "device_demo",
      client_updated_at: "2026-04-10T00:00:00.000Z",
      server_updated_at: "2026-04-10T00:00:00.000Z",
      cursor: "1",
      cursor_order: 1,
      payload_json: JSON.stringify({ kind: "global" }),
      shadow_updated_at: "2026-04-10T00:00:00.000Z",
    })

    const result = await applyCloudflareShadowBackfill({
      env: await createEnv(createAuthoritativeDatabase()),
      db: shadow.db,
    })

    expect(result.actionCount).toBe(6)
    expect(result.inspectionBefore.audit.summary.diffCount).toBe(9)
    expect(result.inspectionAfter.audit.ok).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_users"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_user_credentials"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_devices"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_auth_sessions"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_collections"))).toBe(true)
    expect(shadow.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_mutations"))).toBe(true)
  })
})
