import { describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { D1Database, D1PreparedStatement, D1RunResult } from "../bindings"
import type { AstraPlatformEnv } from "../env"
import type { ArticleImportShadowJobRow } from "../types/article-import"
import { handleArticleImportReplay } from "./article-import-replay"

interface QueryRecord {
  sql: string
  bindings: unknown[]
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function createMockDb() {
  const queries: QueryRecord[] = []
  const allQueue: unknown[] = []

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
        async run<T = Row>(): Promise<D1RunResult<T>> {
          return {
            success: true,
            results: [] as T[],
            meta: { changes: 1 },
          }
        },
        async all<T = Row>(): Promise<D1RunResult<T>> {
          return {
            success: true,
            results: ((allQueue.shift() as T[] | undefined) ?? []),
          }
        },
        async first<T = Row>(): Promise<T | null> {
          return null
        },
      }

      return statement
    },
  }

  return {
    db,
    queries,
    enqueueAll(results: unknown[]) {
      allQueue.push(results)
    },
  }
}

function createEnv(
  mockDb: ReturnType<typeof createMockDb>,
  overrides: Partial<AstraPlatformEnv> = {},
) {
  const send = vi.fn(async () => {})

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
    ARTICLE_IMPORT_QUEUE: { send },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ARTICLE_IMPORT_MODE: "shadow",
    ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS: "3",
    ARTICLE_IMPORT_OPERATOR_TOKEN: "operator-secret",
    ASTRA_ENV: "test",
    ...overrides,
  }

  return { env, send }
}

function createContext(): AstraRequestContext {
  return {
    requestId: "req_replay",
    nowEpochMs: 5_000,
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "shadow",
      articleImportModeOverrides: {},
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
      continuityDeleteGracePeriodSeconds: 1_800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: true,
    },
    execution: {
      waitUntil: vi.fn(),
    },
  }
}

function createRow(overrides: Partial<ArticleImportShadowJobRow> = {}): ArticleImportShadowJobRow {
  return {
    id: "job_123",
    status: "dead_lettered",
    shadow_version: 1,
    mode: "shadow",
    route: "shadow-proxy",
    surface: "web",
    target_hostname: "example.com",
    decision_reason: "default_mode",
    fallback_reason: null,
    artifact_retention_class: "import-shadow",
    artifact_retention_until_epoch_ms: 1_700_000_000_000,
    request_hash: "hash_123",
    request_object_key: "article-import/2026-04-09/job_123/request.bin",
    response_object_key: "article-import/2026-04-09/job_123/response.bin",
    source_object_key: null,
    request_object_bytes: 42,
    response_object_bytes: 256,
    source_object_bytes: null,
    request_object_sha256: "req_sha",
    response_object_sha256: "res_sha",
    source_object_sha256: null,
    idempotency_key: null,
    content_type: "application/json",
    content_length: 42,
    proxy_status: 200,
    trace_id: "req_import",
    error_code: "missing_response_object",
    last_failure_error_code: "missing_response_object",
    queue_attempt_count: 3,
    last_queue_attempt_epoch_ms: 4_000,
    consumed_at_epoch_ms: null,
    dead_lettered_at_epoch_ms: 4_500,
    replay_count: 1,
    last_replayed_at_epoch_ms: 4_200,
    last_replay_reason: "previous replay",
    last_replayed_by: "ops@example",
    created_at_epoch_ms: 1_000,
    updated_at_epoch_ms: 4_500,
    ...overrides,
  }
}

describe("handleArticleImportReplay", () => {
  it("requeues dead-lettered jobs for a valid operator", async () => {
    const mockDb = createMockDb()
    mockDb.enqueueAll([createRow()])
    const { env, send } = createEnv(mockDb)

    const response = await handleArticleImportReplay(
      new Request("https://platform.astra.example/__platform/article-import/replay", {
        method: "POST",
        headers: {
          authorization: "Bearer operator-secret",
          "content-type": "application/json",
          "x-astra-operator-id": "ops@example",
        },
        body: JSON.stringify({ jobId: "job_123", reason: "r2 restored" }),
      }),
      env,
      createContext(),
    )

    expect(response.status).toBe(200)
    expect(send).toHaveBeenCalledWith({
      version: 1,
      jobId: "job_123",
      requestObjectKey: "article-import/2026-04-09/job_123/request.bin",
      requestHash: "hash_123",
      traceId: "req_import",
      receivedAtEpochMs: 5_000,
    })
    expect(mockDb.queries.at(-1)?.bindings).toEqual([
      2,
      5_000,
      "r2 restored",
      "ops@example",
      5_000,
      "job_123",
    ])

    const payload = await response.json() as {
      summary: { selected: number; replayed: number; skipped: number }
      jobs: Array<{ jobId: string; action: string; replayCount: number }>
    }

    expect(payload.summary).toEqual({ selected: 1, replayed: 1, skipped: 0 })
    expect(payload.jobs).toEqual([
      expect.objectContaining({
        jobId: "job_123",
        action: "requeued",
        replayCount: 2,
      }),
    ])
  })

  it("rolls the row back when queue send fails", async () => {
    const mockDb = createMockDb()
    mockDb.enqueueAll([createRow()])
    const { env } = createEnv(mockDb, {
      ARTICLE_IMPORT_QUEUE: {
        send: vi.fn(async () => {
          throw new Error("queue unavailable")
        }),
      },
    })

    const response = await handleArticleImportReplay(
      new Request("https://platform.astra.example/__platform/article-import/replay", {
        method: "POST",
        headers: {
          authorization: "Bearer operator-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ jobId: "job_123", reason: "retry later" }),
      }),
      env,
      createContext(),
    )

    expect(response.status).toBe(200)
    expect(mockDb.queries.at(-1)?.bindings).toEqual([
      "dead_lettered",
      "missing_response_object",
      3,
      4_000,
      null,
      1,
      4_200,
      "previous replay",
      "ops@example",
      4_500,
      "job_123",
    ])

    const payload = await response.json() as {
      summary: { selected: number; replayed: number; skipped: number }
      jobs: Array<{ jobId: string; action: string; reason: string | null }>
    }

    expect(payload.summary).toEqual({ selected: 1, replayed: 0, skipped: 1 })
    expect(payload.jobs).toEqual([
      expect.objectContaining({
        jobId: "job_123",
        action: "skipped",
        reason: "queue_send_failed",
      }),
    ])
  })

  it("rejects replay requests without a valid operator token", async () => {
    const mockDb = createMockDb()
    const { env, send } = createEnv(mockDb)

    const response = await handleArticleImportReplay(
      new Request("https://platform.astra.example/__platform/article-import/replay", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-token",
        },
        body: JSON.stringify({ jobId: "job_123" }),
      }),
      env,
      createContext(),
    )

    expect(response.status).toBe(403)
    expect(send).not.toHaveBeenCalled()
    expect(mockDb.queries).toHaveLength(0)
  })
})
