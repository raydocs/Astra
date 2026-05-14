import { describe, expect, it } from "vitest"

import type { D1Database, D1PreparedStatement, D1RunResult } from "../bindings"
import { listShadowDeviceRowsForUser, listShadowDevicesForUser, upsertShadowDevice } from "./devices"
import {
  getShadowSessionById,
  getShadowSessionByTokenHash,
  listShadowSessionsForUser,
  revokeShadowSession,
  upsertShadowSession,
} from "./sessions"
import {
  appendShadowSyncMutation,
  getShadowSyncBootstrap,
  listShadowSyncCollectionRowsForUser,
  listShadowSyncMutationsForUser,
  mirrorShadowSyncCollectionsFromUser,
  pullShadowSyncMutations,
} from "./sync"
import { getShadowUserByEmail, listShadowUsers, upsertShadowUser } from "./users"

interface QueryRecord {
  sql: string
  bindings: unknown[]
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function createMockDb() {
  const queries: QueryRecord[] = []
  const firstQueue: unknown[] = []
  const allQueue: unknown[][] = []

  const db: D1Database = {
    prepare<Row = Record<string, unknown>>(query: string): D1PreparedStatement<Row> {
      const record: QueryRecord = {
        sql: normalizeSql(query),
        bindings: [],
      }
      queries.push(record)

      const statement: D1PreparedStatement<Row> = {
        bind(...values: unknown[]) {
          record.bindings = values
          return statement
        },
        run<T = Row>(): Promise<D1RunResult<T>> {
          return Promise.resolve({
            success: true,
            results: [] as T[],
            meta: { changes: 1 },
          })
        },
        all<T = Row>(): Promise<D1RunResult<T>> {
          return Promise.resolve({
            success: true,
            results: (allQueue.shift() ?? []) as T[],
          })
        },
        first<T = Row>(): Promise<T | null> {
          return Promise.resolve((firstQueue.shift() ?? null) as T | null)
        },
      }

      return statement
    },
  }

  return {
    db,
    queries,
    enqueueFirst(value: unknown) {
      firstQueue.push(value)
    },
    enqueueAll(value: unknown[]) {
      allQueue.push(value)
    },
  }
}

describe("Cloudflare shadow repositories", () => {
  it("upserts and parses shadow users", async () => {
    const mock = createMockDb()

    const row = await upsertShadowUser(mock.db, {
      id: "usr_shadow_1",
      email: "user@example.com",
      billingEmail: "billing@example.com",
      createdAt: "2026-04-09T00:00:00.000Z",
      plan: "pro",
      subscriptionStatus: "active",
      identityMode: "authenticated",
      installId: "install_123",
      providerEntitlements: ["openai", "gemini"],
      syncPreferences: {
        reading_history: true,
        study_progress: false,
      },
      shadowUpdatedAt: "2026-04-09T00:05:00.000Z",
    })

    expect(row.providerEntitlements).toEqual(["openai", "gemini"])
    expect(mock.queries[0]?.sql).toContain("INSERT INTO shadow_users")
    expect(mock.queries[0]?.bindings).toEqual(expect.arrayContaining([
      "usr_shadow_1",
      "user@example.com",
      "[\"openai\",\"gemini\"]",
      1,
      0,
    ]))

    mock.enqueueFirst({
      id: "usr_shadow_1",
      email: "user@example.com",
      billing_email: "billing@example.com",
      created_at: "2026-04-09T00:00:00.000Z",
      plan: "pro",
      subscription_status: "active",
      identity_mode: "authenticated",
      install_id: "install_123",
      provider_entitlements_json: "[\"openai\",\"gemini\"]",
      reading_history_sync_enabled: 1,
      study_progress_sync_enabled: 0,
      shadow_updated_at: "2026-04-09T00:05:00.000Z",
    })

    const readRow = await getShadowUserByEmail(mock.db, "user@example.com")
    expect(readRow?.syncPreferences).toEqual({
      reading_history: true,
      study_progress: false,
    })
  })

  it("upserts, reads, and revokes shadow sessions", async () => {
    const mock = createMockDb()

    await upsertShadowSession(mock.db, {
      sessionId: "sess_123",
      userId: "usr_shadow_1",
      deviceId: "device_1",
      identityMode: "authenticated",
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-04-09T00:00:00.000Z",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      lastVerifiedAt: "2026-04-09T00:00:00.000Z",
      status: "active",
      tokenHash: "sha256:abc123",
      tokenHashAlg: "sha256",
      shadowUpdatedAt: "2026-04-09T00:00:00.000Z",
    })

    expect(mock.queries[0]?.sql).toContain("INSERT INTO shadow_auth_sessions")
    expect(mock.queries[0]?.bindings).toEqual(expect.arrayContaining([
      "sess_123",
      "usr_shadow_1",
      "device_1",
      "sha256:abc123",
    ]))

    mock.enqueueFirst({
      session_id: "sess_123",
      user_id: "usr_shadow_1",
      device_id: "device_1",
      identity_mode: "authenticated",
      token_hash: "sha256:abc123",
      token_hash_alg: "sha256",
      issued_at: "2026-04-09T00:00:00.000Z",
      expires_at: "2026-05-09T00:00:00.000Z",
      created_at: "2026-04-09T00:00:00.000Z",
      last_seen_at: "2026-04-09T00:00:00.000Z",
      last_verified_at: "2026-04-09T00:00:00.000Z",
      status: "active",
      revoked_at: null,
      shadow_updated_at: "2026-04-09T00:00:00.000Z",
    })

    const session = await getShadowSessionById(mock.db, "sess_123")
    expect(session?.tokenHash).toBe("sha256:abc123")

    mock.enqueueFirst({
      session_id: "sess_123",
      user_id: "usr_shadow_1",
      device_id: "device_1",
      identity_mode: "authenticated",
      token_hash: "sha256:abc123",
      token_hash_alg: "sha256",
      issued_at: "2026-04-09T00:00:00.000Z",
      expires_at: "2026-05-09T00:00:00.000Z",
      created_at: "2026-04-09T00:00:00.000Z",
      last_seen_at: "2026-04-09T00:00:00.000Z",
      last_verified_at: "2026-04-09T00:00:00.000Z",
      status: "active",
      revoked_at: null,
      shadow_updated_at: "2026-04-09T00:00:00.000Z",
    })

    const byToken = await getShadowSessionByTokenHash(mock.db, {
      userId: "usr_shadow_1",
      tokenHash: "sha256:abc123",
    })
    expect(byToken?.sessionId).toBe("sess_123")

    await revokeShadowSession(mock.db, {
      sessionId: "sess_123",
      revokedAt: "2026-04-09T01:00:00.000Z",
    })

    expect(mock.queries.at(-1)?.sql).toContain("UPDATE shadow_auth_sessions")
    expect(mock.queries.at(-1)?.bindings).toEqual([
      "2026-04-09T01:00:00.000Z",
      0,
      null,
      "2026-04-09T01:00:00.000Z",
      "sess_123",
    ])
  })

  it("upserts and lists shadow devices", async () => {
    const mock = createMockDb()

    await upsertShadowDevice(mock.db, {
      userId: "usr_shadow_1",
      deviceId: "device_1",
      identityMode: "authenticated",
      label: "Astra MacBook",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "extension",
      appVersion: "0.1.0",
      firstSeenAt: "2026-04-09T00:00:00.000Z",
      lastSeenAt: "2026-04-09T00:10:00.000Z",
      lastSyncAt: "2026-04-09T00:11:00.000Z",
      status: "active",
      updatedAt: "2026-04-09T00:10:00.000Z",
      shadowUpdatedAt: "2026-04-09T00:10:00.000Z",
    })

    expect(mock.queries[0]?.bindings?.[0]).toBe("usr_shadow_1:device_1")

    mock.enqueueAll([
      {
        id: "usr_shadow_1:device_2",
        user_id: "usr_shadow_1",
        device_id: "device_2",
        identity_mode: "authenticated",
        label: "Astra Web",
        platform: "macos",
        browser_family: "safari",
        app_kind: "web",
        app_version: "0.1.0",
        first_seen_at: "2026-04-08T00:00:00.000Z",
        last_seen_at: "2026-04-09T00:20:00.000Z",
        last_sync_at: null,
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-09T00:20:00.000Z",
        shadow_updated_at: "2026-04-09T00:20:00.000Z",
      },
      {
        id: "usr_shadow_1:device_1",
        user_id: "usr_shadow_1",
        device_id: "device_1",
        identity_mode: "authenticated",
        label: "Astra MacBook",
        platform: "macos",
        browser_family: "chrome",
        app_kind: "extension",
        app_version: "0.1.0",
        first_seen_at: "2026-04-09T00:00:00.000Z",
        last_seen_at: "2026-04-09T00:10:00.000Z",
        last_sync_at: "2026-04-09T00:11:00.000Z",
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-09T00:10:00.000Z",
        shadow_updated_at: "2026-04-09T00:10:00.000Z",
      },
    ])

    const devices = await listShadowDevicesForUser(mock.db, "usr_shadow_1", "device_1")
    expect(devices).toHaveLength(2)
    expect(devices[1]?.isCurrentDevice).toBe(true)
  })

  it("mirrors sync collection defaults, appends mutations, and can shadow-read bootstrap/pull state", async () => {
    const mock = createMockDb()

    const collections = await mirrorShadowSyncCollectionsFromUser(mock.db, {
      userId: "usr_shadow_1",
      syncPreferences: {
        reading_history: true,
        study_progress: false,
      },
      shadowUpdatedAt: "2026-04-09T00:00:00.000Z",
    })

    expect(collections.reading_history.enabled).toBe(true)
    expect(collections.study_progress.enabled).toBe(false)
    expect(mock.queries).toHaveLength(5)

    mock.enqueueFirst({
      server_mutation_id: "srv_mut_123",
      user_id: "usr_shadow_1",
      collection: "reading_history",
      schema_version: 1,
      record_id: "https://example.com/article",
      operation: "upsert",
      client_mutation_id: "mut_123",
      device_id: "device_1",
      client_updated_at: "2026-04-09T00:00:00.000Z",
      server_updated_at: "2026-04-09T00:00:01.000Z",
      cursor: "7",
      payload_json: "{\"url\":\"https://example.com/article\",\"title\":\"Example\"}",
      shadow_updated_at: "2026-04-09T00:00:01.000Z",
    })
    const appendResult = await appendShadowSyncMutation(mock.db, {
      userId: "usr_shadow_1",
      collection: "reading_history",
      schemaVersion: 1,
      recordId: "https://example.com/article",
      operation: "upsert",
      clientMutationId: "mut_123",
      deviceId: "device_1",
      clientUpdatedAt: "2026-04-09T00:00:00.000Z",
      serverUpdatedAt: "2026-04-09T00:00:01.000Z",
      cursor: "7",
      payload: {
        url: "https://example.com/article",
        title: "Example",
      },
      serverMutationId: "srv_mut_123",
      shadowUpdatedAt: "2026-04-09T00:00:01.000Z",
    })

    expect(appendResult.deduped).toBe(false)
    const mutationInsertQuery = mock.queries.find((query) => query.sql.includes("INSERT INTO shadow_sync_mutations"))

    expect(mock.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_mutations"))).toBe(true)
    expect(mock.queries.some((query) => query.sql.includes("FROM shadow_sync_record_state"))).toBe(true)
    expect(mock.queries.some((query) => query.sql.includes("INSERT INTO shadow_sync_collections"))).toBe(true)
    expect(mutationInsertQuery?.bindings).toEqual(expect.arrayContaining(["7", 7]))

    mock.enqueueAll([
      {
        user_id: "usr_shadow_1",
        collection: "config",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: "2",
        last_issued_cursor_order: 2,
        last_server_updated_at: "2026-04-09T00:00:00.000Z",
        shadow_updated_at: "2026-04-09T00:00:00.000Z",
      },
      {
        user_id: "usr_shadow_1",
        collection: "vocabulary",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: "4",
        last_issued_cursor_order: 4,
        last_server_updated_at: "2026-04-09T00:00:00.000Z",
        shadow_updated_at: "2026-04-09T00:00:00.000Z",
      },
      {
        user_id: "usr_shadow_1",
        collection: "reading_history",
        enabled: 1,
        default_enabled: 0,
        last_issued_cursor: "7",
        last_issued_cursor_order: 7,
        last_server_updated_at: "2026-04-09T00:00:01.000Z",
        shadow_updated_at: "2026-04-09T00:00:01.000Z",
      },
    ])

    const bootstrap = await getShadowSyncBootstrap(mock.db, {
      userId: "usr_shadow_1",
      deviceId: "device_1",
      maxMutationsPerRequest: 50,
      serverTime: "2026-04-09T00:00:02.000Z",
    })

    expect(bootstrap.collections.reading_history.lastIssuedCursor).toBe("7")
    expect(bootstrap.collections.study_progress.enabled).toBe(false)

    mock.enqueueAll([
      {
        user_id: "usr_shadow_1",
        collection: "config",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: "2",
        last_issued_cursor_order: 2,
        last_server_updated_at: "2026-04-09T00:00:00.000Z",
        shadow_updated_at: "2026-04-09T00:00:00.000Z",
      },
      {
        user_id: "usr_shadow_1",
        collection: "vocabulary",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: "4",
        last_issued_cursor_order: 4,
        last_server_updated_at: "2026-04-09T00:00:00.000Z",
        shadow_updated_at: "2026-04-09T00:00:00.000Z",
      },
      {
        user_id: "usr_shadow_1",
        collection: "reading_history",
        enabled: 1,
        default_enabled: 0,
        last_issued_cursor: "7",
        last_issued_cursor_order: 7,
        last_server_updated_at: "2026-04-09T00:00:01.000Z",
        shadow_updated_at: "2026-04-09T00:00:01.000Z",
      },
    ])
    mock.enqueueAll([])
    mock.enqueueAll([])
    mock.enqueueAll([])
    mock.enqueueAll([
      {
        server_mutation_id: "srv_mut_123",
        user_id: "usr_shadow_1",
        collection: "reading_history",
        schema_version: 1,
        record_id: "https://example.com/article",
        operation: "upsert",
        client_mutation_id: "mut_123",
        device_id: "device_1",
        client_updated_at: "2026-04-09T00:00:00.000Z",
        server_updated_at: "2026-04-09T00:00:01.000Z",
        cursor: "7",
        payload_json: "{\"url\":\"https://example.com/article\",\"title\":\"Example\"}",
        shadow_updated_at: "2026-04-09T00:00:01.000Z",
      },
    ])

    const pull = await pullShadowSyncMutations(mock.db, {
      userId: "usr_shadow_1",
      cursors: {
        config: "2",
        vocabulary: "4",
        reading_history: "5",
      },
      serverTime: "2026-04-09T00:00:03.000Z",
    })

    expect(pull.deltas.config).toEqual([])
    expect(pull.deltas.vocabulary).toEqual([])
    expect(pull.deltas.reading_history).toHaveLength(1)
    expect(pull.nextCursors.reading_history).toBe("7")
    expect(pull.nextCursors.study_progress).toBe(null)
  })

  it("lists raw shadow rows for audit tooling", async () => {
    const mock = createMockDb()
    mock.enqueueAll([
      {
        id: "usr_shadow_1",
        email: "user@example.com",
        billing_email: "billing@example.com",
        created_at: "2026-04-09T00:00:00.000Z",
        plan: "pro",
        subscription_status: "active",
        identity_mode: "authenticated",
        install_id: null,
        provider_entitlements_json: "[\"openai\",\"gemini\"]",
        reading_history_sync_enabled: 1,
        study_progress_sync_enabled: 0,
        shadow_updated_at: "2026-04-09T00:05:00.000Z",
      },
    ])
    mock.enqueueAll([
      {
        id: "usr_shadow_1:device_1",
        user_id: "usr_shadow_1",
        device_id: "device_1",
        identity_mode: "authenticated",
        label: "Astra MacBook",
        platform: "macos",
        browser_family: "chrome",
        app_kind: "extension",
        app_version: "0.1.0",
        first_seen_at: "2026-04-09T00:00:00.000Z",
        last_seen_at: "2026-04-09T00:10:00.000Z",
        last_sync_at: null,
        status: "active",
        revoked_at: null,
        updated_at: "2026-04-09T00:10:00.000Z",
        shadow_updated_at: "2026-04-09T00:10:00.000Z",
      },
    ])
    mock.enqueueAll([
      {
        session_id: "sess_123",
        user_id: "usr_shadow_1",
        device_id: "device_1",
        identity_mode: "authenticated",
        token_hash: "sha256:abc123",
        token_hash_alg: "sha256",
        issued_at: "2026-04-09T00:00:00.000Z",
        expires_at: null,
        created_at: "2026-04-09T00:00:00.000Z",
        last_seen_at: "2026-04-09T00:00:00.000Z",
        last_verified_at: "2026-04-09T00:00:00.000Z",
        status: "active",
        revoked_at: null,
        shadow_updated_at: "2026-04-09T00:00:00.000Z",
      },
    ])
    mock.enqueueAll([
      {
        user_id: "usr_shadow_1",
        collection: "config",
        enabled: 1,
        default_enabled: 1,
        last_issued_cursor: "2",
        last_issued_cursor_order: 2,
        last_server_updated_at: "2026-04-09T00:00:00.000Z",
        shadow_updated_at: "2026-04-09T00:00:00.000Z",
      },
    ])
    mock.enqueueAll([
      {
        server_mutation_id: "srv_mut_123",
        user_id: "usr_shadow_1",
        collection: "config",
        schema_version: 1,
        record_id: "global",
        operation: "upsert",
        client_mutation_id: "mut_123",
        device_id: "device_1",
        client_updated_at: "2026-04-09T00:00:00.000Z",
        server_updated_at: "2026-04-09T00:00:01.000Z",
        cursor: "2",
        payload_json: "{\"kind\":\"global\"}",
        shadow_updated_at: "2026-04-09T00:00:01.000Z",
      },
    ])

    const users = await listShadowUsers(mock.db)
    const devices = await listShadowDeviceRowsForUser(mock.db, "usr_shadow_1")
    const sessions = await listShadowSessionsForUser(mock.db, "usr_shadow_1")
    const collections = await listShadowSyncCollectionRowsForUser(mock.db, "usr_shadow_1")
    const mutations = await listShadowSyncMutationsForUser(mock.db, "usr_shadow_1")

    expect(users[0]?.id).toBe("usr_shadow_1")
    expect(devices[0]?.deviceId).toBe("device_1")
    expect(sessions[0]?.sessionId).toBe("sess_123")
    expect(collections[0]?.collection).toBe("config")
    expect(mutations[0]?.clientMutationId).toBe("mut_123")
  })
})
