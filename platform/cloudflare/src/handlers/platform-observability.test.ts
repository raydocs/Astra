import { describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import type { D1PreparedStatement, D1RunResult } from "../bindings"
import { handlePlatformObservability } from "./platform-observability"

function createEnv(): AstraPlatformEnv {
  return {
    NODE_RELAY_ORIGIN: "https://relay.example",
    ARTICLE_IMPORT_MODE: "shadow",
    ARTICLE_IMPORT_MODE_OVERRIDES: "web=native",
    ACCOUNT_SUMMARY_READ_MODE: "shadow",
    DEVICE_LIST_READ_MODE: "native",
    DEVICE_REVOKE_WRITE_MODE: "proxy",
    SYNC_BOOTSTRAP_READ_MODE: "shadow",
    SYNC_PULL_READ_MODE: "native",
    SYNC_PUSH_WRITE_MODE: "native",
    ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST: "200",
    ARTICLE_IMPORT_RATE_LIMIT_MAX: "30",
    ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS: "60",
    ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS: "3",
    ARTICLE_IMPORT_MAX_SHADOW_BYTES: "262144",
    ARTICLE_IMPORT_MAX_NATIVE_BYTES: "2097152",
    ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS: "14",
    ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS: "import-shadow",
    ARTICLE_IMPORT_OPERATOR_TOKEN: "op-token",
    CONTINUITY_EXPORT_ARTIFACT_RETENTION_DAYS: "7",
    CONTINUITY_DELETE_GRACE_PERIOD_SECONDS: "604800",
    CONTINUITY_JOB_HISTORY_RETENTION_DAYS: "90",
    CONTINUITY_TOMBSTONE_RETENTION_DAYS: "30",
    ASTRA_ENV: "staging",
    ASTRA_IMPORT_PAYLOADS: {
      async put() {},
      async head() { return null },
    },
    ASTRA_IDEMPOTENCY_KV: {
      async get() { return null },
      async put() {},
    },
    ARTICLE_IMPORT_QUEUE: {
      async send() {},
    },
    ASTRA_PLATFORM_DB: {
      prepare<Row = Record<string, unknown>>(query: string): D1PreparedStatement<Row> {
        const sql = query.replace(/\s+/g, " ").trim()
        return {
          bind(...bindings: unknown[]) {
            void bindings
            return this
          },
          async run<T = Row>(): Promise<D1RunResult<T>> {
            return { success: true, results: [] as T[] }
          },
          async all<T = Row>(): Promise<D1RunResult<T>> {
            if (sql.includes("FROM platform_route_events") && sql.includes("route AS key")) {
              return {
                success: true,
                results: [
                  { domain: "device-list", key: "native", count: 3 },
                  { domain: "sync-push", key: "native-fallback-proxy", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("FROM platform_route_events") && sql.includes("mode AS key")) {
              return {
                success: true,
                results: [
                  { domain: "device-list", key: "native", count: 3 },
                  { domain: "sync-push", key: "native", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("fallback_reason AS key")) {
              return {
                success: true,
                results: [
                  { domain: "sync-push", key: "mirror_back_rejected", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("status_class")) {
              return {
                success: true,
                results: [
                  { domain: "device-list", status_class: "2xx", count: 3 },
                  { domain: "sync-push", status_class: "5xx", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("event_kind AS key")) {
              return {
                success: true,
                results: [
                  { domain: "device-list", key: "parity_mismatch", count: 2 },
                  { domain: "sync-pull", key: "compare_failed", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("FROM article_import_jobs") && sql.includes("GROUP BY status")) {
              return {
                success: true,
                results: [
                  { key: "queued", count: 2 },
                  { key: "failed", count: 1 },
                  { key: "dead_lettered", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("FROM article_import_jobs") && sql.includes("status IN ('failed', 'dead_lettered')")) {
              return {
                success: true,
                results: [{
                  id: "job_1",
                  status: "dead_lettered",
                  route: "native",
                  surface: "web",
                  trace_id: "req-1",
                  error_code: "missing_response_object",
                  last_failure_error_code: "missing_response_object",
                  fallback_reason: null,
                  queue_attempt_count: 3,
                  replay_count: 1,
                  updated_at_epoch_ms: 1_000,
                }] as T[],
              }
            }
            if (sql.includes("FROM account_export_jobs")) {
              return {
                success: true,
                results: [
                  { key: "queued", count: 1 },
                  { key: "completed", count: 2 },
                ] as T[],
              }
            }
            if (sql.includes("FROM account_data_delete_jobs")) {
              return {
                success: true,
                results: [
                  { key: "scheduled", count: 1 },
                  { key: "completed", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("FROM sync_compaction_runs") && sql.includes("GROUP BY status")) {
              return {
                success: true,
                results: [
                  { key: "completed", count: 3 },
                  { key: "dry_run_completed", count: 1 },
                ] as T[],
              }
            }
            if (sql.includes("FROM sync_compaction_runs") && sql.includes("ORDER BY COALESCE")) {
              return {
                success: true,
                results: [{
                  run_id: "cmp_1",
                  user_id: "usr_demo",
                  collection: "reading_history",
                  status: "completed",
                  cutoff_cursor_order: 120,
                  floor_cursor: "120",
                  floor_cursor_order: 120,
                  mutations_scanned: 50,
                  mutations_deleted: 50,
                  records_materialized: 10,
                  started_at: "2026-04-11T10:00:00.000Z",
                  completed_at: "2026-04-11T10:01:00.000Z",
                  error_code: null,
                }] as T[],
              }
            }
            if (sql.includes("FROM platform_route_events") && sql.includes("event_kind IN")) {
              return {
                success: true,
                results: [{
                  id: "evt_1",
                  occurred_at_epoch_ms: 900,
                  environment: "staging",
                  domain: "device-list",
                  event_kind: "parity_mismatch",
                  route: null,
                  mode: null,
                  fallback_reason: null,
                  response_status: null,
                  scope: "native_compare",
                  outcome: "parity_mismatch",
                  request_id: "req-1",
                  metadata_json: JSON.stringify({ nativeCount: 2, nodeCount: 3 }),
                }] as T[],
              }
            }
            return { success: true, results: [] as T[] }
          },
          async first<T = Row>(): Promise<T | null> {
            if (sql.includes("MIN(created_at_epoch_ms)")) {
              return { oldest_created_at_epoch_ms: 100 } as T
            }
            if (sql.includes("missing_request_count")) {
              return {
                missing_request_count: 1,
                missing_response_count: 2,
                missing_source_count: 0,
              } as T
            }
            return null
          },
        }
      },
    },
  }
}

function createContext(): AstraRequestContext {
  return {
    requestId: "req-1",
    nowEpochMs: 1_000,
    config: {
      environment: "staging",
      nodeRelayOrigin: new URL("https://relay.example"),
      articleImportMode: "shadow",
      articleImportModeOverrides: { web: "native" },
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: "shadow",
      deviceListReadMode: "native",
      deviceRevokeWriteMode: "proxy",
      syncBootstrapReadMode: "shadow",
      syncPullReadMode: "native",
      syncPushWriteMode: "native",
      syncMaxMutationsPerRequest: 200,
      articleImportAllowedHosts: [],
      articleImportBlockedHosts: [],
      articleImportForceProxyHosts: [],
      articleImportRateLimitMax: 30,
      articleImportRateLimitWindowSeconds: 60,
      articleImportMaxQueueAttempts: 3,
      articleImportMaxShadowBytes: 262_144,
      articleImportMaxNativeBytes: 2_097_152,
      articleImportArtifactRetentionDays: 14,
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
      waitUntil: vi.fn(),
    },
  }
}

describe("handlePlatformObservability", () => {
  it("returns unified platform route, parity, queue, and governance visibility", async () => {
    const response = await handlePlatformObservability(
      new Request("https://platform.example/__platform/observability?windowHours=12", {
        headers: {
          authorization: "Bearer op-token",
        },
      }),
      createEnv(),
      createContext(),
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      windowHours: number
      observability: {
        routeCounts: Record<string, Record<string, number>>
        parityCounts: Record<string, Record<string, number>>
        recentPlatformEvents: Array<{ domain: string; eventKind: string; metadata: Record<string, unknown> | null }>
      }
      governance: {
        articleImport: {
          byteCaps: { maxShadowBytes: number; maxNativeBytes: number }
        }
        continuityLifecycle: {
          exportArtifactRetentionDays: number
          deleteGracePeriodSeconds: number
        }
        syncLifecycle: {
          compactionBatchSize: number
          compactionDryRun: boolean
        }
      }
      articleImport: {
        backlog: { queued: number; deadLettered: number }
        artifactCompleteness: { missingResponseCount: number }
      }
      continuityLifecycle: {
        exportStatusCounts: Record<string, number>
        deleteStatusCounts: Record<string, number>
      }
      syncLifecycle: {
        compactionStatusCounts: Record<string, number>
        recentCompactionRuns: Array<{ runId: string; collection: string; status: string }>
      }
    }

    expect(payload.windowHours).toBe(12)
    expect(payload.observability.routeCounts["device-list"]?.native).toBe(3)
    expect(payload.observability.parityCounts["device-list"]?.parity_mismatch).toBe(2)
    expect(payload.observability.recentPlatformEvents[0]?.domain).toBe("device-list")
    expect(payload.governance.articleImport.byteCaps.maxShadowBytes).toBe(262_144)
    expect(payload.governance.continuityLifecycle.exportArtifactRetentionDays).toBe(7)
    expect(payload.governance.continuityLifecycle.deleteGracePeriodSeconds).toBe(604800)
    expect(payload.governance.syncLifecycle.compactionBatchSize).toBe(500)
    expect(payload.governance.syncLifecycle.compactionDryRun).toBe(true)
    expect(payload.articleImport.backlog.queued).toBe(2)
    expect(payload.articleImport.backlog.deadLettered).toBe(1)
    expect(payload.articleImport.artifactCompleteness.missingResponseCount).toBe(2)
    expect(payload.continuityLifecycle.exportStatusCounts.completed).toBe(2)
    expect(payload.continuityLifecycle.deleteStatusCounts.scheduled).toBe(1)
    expect(payload.syncLifecycle.compactionStatusCounts.completed).toBe(3)
    expect(payload.syncLifecycle.recentCompactionRuns[0]).toEqual(expect.objectContaining({
      runId: "cmp_1",
      collection: "reading_history",
      status: "completed",
    }))
  })

  it("rejects unauthorized requests when an operator token is configured", async () => {
    const response = await handlePlatformObservability(
      new Request("https://platform.example/__platform/observability"),
      createEnv(),
      createContext(),
    )

    expect(response.status).toBe(401)
  })
})
