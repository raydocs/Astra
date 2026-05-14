import { describe, expect, it, vi } from "vitest"

import type { D1Database, D1PreparedStatement, D1RunResult, MessageBatch } from "../bindings"
import type { AstraPlatformEnv } from "../env"
import type { ArticleImportQueueMessage, ArticleImportShadowJobRow } from "../types/article-import"
import { consumeArticleImportQueue } from "./article-import"

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
            results: [] as T[],
          }
        },
        async first<T = Row>(): Promise<T | null> {
          return (firstQueue.shift() ?? null) as T | null
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
  }
}

function createMessage(payload: ArticleImportQueueMessage) {
  return {
    body: payload,
    ack: vi.fn(),
    retry: vi.fn(),
  }
}

function createBatch(message: ReturnType<typeof createMessage>): MessageBatch<ArticleImportQueueMessage> {
  return {
    queue: "astra-article-import-test",
    messages: [message],
  }
}

function createEnv(
  mockDb: ReturnType<typeof createMockDb>,
  head: AstraPlatformEnv["ASTRA_IMPORT_PAYLOADS"]["head"],
  overrides: Partial<AstraPlatformEnv> = {},
): AstraPlatformEnv {
  return {
    ASTRA_PLATFORM_DB: mockDb.db,
    ASTRA_IMPORT_PAYLOADS: {
      put: vi.fn(async () => {}),
      head,
    },
    ASTRA_IDEMPOTENCY_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    ARTICLE_IMPORT_QUEUE: {
      send: vi.fn(async () => {}),
    },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ARTICLE_IMPORT_MODE: "shadow",
    ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS: "3",
    ASTRA_ENV: "test",
    ...overrides,
  }
}

function createRow(overrides: Partial<ArticleImportShadowJobRow> = {}): ArticleImportShadowJobRow {
  return {
    id: "job_123",
    status: "queued",
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
    source_object_key: "article-import/2026-04-09/job_123/source.html",
    request_object_bytes: 42,
    response_object_bytes: 128,
    source_object_bytes: 256,
    request_object_sha256: "req_sha",
    response_object_sha256: "res_sha",
    source_object_sha256: "src_sha",
    idempotency_key: null,
    content_type: "application/json",
    content_length: 42,
    proxy_status: 200,
    trace_id: "req_123",
    error_code: null,
    last_failure_error_code: null,
    queue_attempt_count: 0,
    last_queue_attempt_epoch_ms: null,
    consumed_at_epoch_ms: null,
    dead_lettered_at_epoch_ms: null,
    replay_count: 0,
    last_replayed_at_epoch_ms: null,
    last_replay_reason: null,
    last_replayed_by: null,
    created_at_epoch_ms: 1,
    updated_at_epoch_ms: 1,
    ...overrides,
  }
}

describe("consumeArticleImportQueue", () => {
  it("marks a job consumed after all expected artifacts exist", async () => {
    const mockDb = createMockDb()
    mockDb.enqueueFirst(createRow())

    const head = vi.fn(async () => ({ key: "artifact", size: 128 }))
    const env = createEnv(mockDb, head)
    const message = createMessage({
      version: 1,
      jobId: "job_123",
      requestObjectKey: "article-import/2026-04-09/job_123/request.bin",
      requestHash: "hash_123",
      traceId: "req_123",
      receivedAtEpochMs: 1,
    })

    await consumeArticleImportQueue(createBatch(message), env)

    expect(head).toHaveBeenCalledTimes(3)
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
    expect(mockDb.queries.at(-1)?.bindings).toEqual([
      "consumed",
      null,
      "consumed",
      null,
      1,
      expect.any(Number),
      expect.any(Number),
      "consumed",
      null,
      expect.any(Number),
      "job_123",
    ])
  })

  it("fails and retries when the response artifact is missing", async () => {
    const mockDb = createMockDb()
    mockDb.enqueueFirst(createRow())

    const head = vi.fn(async (key: string) => key.endsWith("/response.bin") ? null : { key, size: 128 })
    const env = createEnv(mockDb, head)
    const message = createMessage({
      version: 1,
      jobId: "job_123",
      requestObjectKey: "article-import/2026-04-09/job_123/request.bin",
      requestHash: "hash_123",
      traceId: "req_123",
      receivedAtEpochMs: 1,
    })

    await consumeArticleImportQueue(createBatch(message), env)

    expect(message.ack).not.toHaveBeenCalled()
    expect(message.retry).toHaveBeenCalledTimes(1)
    expect(mockDb.queries.at(-1)?.bindings).toEqual([
      "failed",
      "missing_response_object",
      "failed",
      "missing_response_object",
      1,
      expect.any(Number),
      null,
      "failed",
      null,
      expect.any(Number),
      "job_123",
    ])
  })

  it("dead-letters after the configured queue attempt ceiling is exhausted", async () => {
    const mockDb = createMockDb()
    mockDb.enqueueFirst(createRow({ queue_attempt_count: 2 }))

    const head = vi.fn(async (key: string) => key.endsWith("/response.bin") ? null : { key, size: 128 })
    const env = createEnv(mockDb, head, {
      ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS: "3",
    })
    const message = createMessage({
      version: 1,
      jobId: "job_123",
      requestObjectKey: "article-import/2026-04-09/job_123/request.bin",
      requestHash: "hash_123",
      traceId: "req_123",
      receivedAtEpochMs: 1,
    })

    await consumeArticleImportQueue(createBatch(message), env)

    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
    expect(mockDb.queries.at(-1)?.bindings).toEqual([
      "dead_lettered",
      "missing_response_object",
      "dead_lettered",
      "missing_response_object",
      3,
      expect.any(Number),
      null,
      "dead_lettered",
      expect.any(Number),
      expect.any(Number),
      "job_123",
    ])
  })

  it("acks terminal consumed, completed, skipped, and dead-lettered rows without reprocessing", async () => {
    const head = vi.fn(async () => ({ key: "artifact", size: 128 }))

    for (const status of ["consumed", "completed", "skipped", "dead_lettered"] as const) {
      const mockDb = createMockDb()
      mockDb.enqueueFirst(createRow({ status }))
      const message = createMessage({
        version: 1,
        jobId: "job_123",
        requestObjectKey: "article-import/2026-04-09/job_123/request.bin",
        requestHash: "hash_123",
        traceId: "req_123",
        receivedAtEpochMs: 1,
      })

      await consumeArticleImportQueue(createBatch(message), createEnv(mockDb, head))

      expect(message.ack).toHaveBeenCalledTimes(1)
      expect(message.retry).not.toHaveBeenCalled()
    }

    expect(head).not.toHaveBeenCalled()
  })

  it("treats legacy rows with null new artifact keys as request-only checks", async () => {
    const mockDb = createMockDb()
    mockDb.enqueueFirst(createRow({
      response_object_key: null,
      source_object_key: null,
    }))

    const head = vi.fn(async () => ({ key: "artifact", size: 128 }))
    const env = createEnv(mockDb, head)
    const message = createMessage({
      version: 1,
      jobId: "job_123",
      requestObjectKey: "article-import/2026-04-09/job_123/request.bin",
      requestHash: "hash_123",
      traceId: "req_123",
      receivedAtEpochMs: 1,
    })

    await consumeArticleImportQueue(createBatch(message), env)

    expect(head).toHaveBeenCalledTimes(1)
    expect(head).toHaveBeenCalledWith("article-import/2026-04-09/job_123/request.bin")
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })
})
