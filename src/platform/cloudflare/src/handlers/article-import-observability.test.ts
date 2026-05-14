import { describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import type { D1PreparedStatement, D1RunResult } from "../bindings"
import { handleArticleImportObservability } from "./article-import-observability"

function createEnv(): AstraPlatformEnv {
  return {
    ASTRA_PLATFORM_DB: {
      prepare<Row = Record<string, unknown>>(query: string): D1PreparedStatement<Row> {
        const normalized = query.replace(/\s+/g, " ").trim()

        const statement: D1PreparedStatement<Row> = {
          bind() {
            return statement
          },
          async run<T = Row>(): Promise<D1RunResult<T>> {
            return { success: true, results: [] as T[] }
          },
          async all<T = Row>(): Promise<D1RunResult<T>> {
            if (normalized.includes("GROUP BY route")) {
              return { success: true, results: [{ key: "proxy", count: 2 }, { key: "native", count: 1 }] as T[] }
            }
            if (normalized.includes("GROUP BY status")) {
              return { success: true, results: [{ key: "queued", count: 3 }, { key: "dead_lettered", count: 1 }] as T[] }
            }
            if (normalized.includes("GROUP BY surface")) {
              return { success: true, results: [{ key: "web", count: 4 }] as T[] }
            }
            if (normalized.includes("LIMIT 10")) {
              return {
                success: true,
                results: [{
                  id: "job_123",
                  status: "dead_lettered",
                  route: "shadow-proxy",
                  surface: "web",
                  target_hostname: "example.com",
                  error_code: "missing_response_object",
                  last_failure_error_code: "missing_response_object",
                  fallback_reason: null,
                  queue_attempt_count: 3,
                  replay_count: 2,
                  dead_lettered_at_epoch_ms: 900,
                  last_replayed_at_epoch_ms: 950,
                  last_replay_reason: "r2 restored",
                  trace_id: "req_123",
                  updated_at_epoch_ms: 1000,
                }] as T[],
              }
            }
            return { success: true, results: [] as T[] }
          },
          async first<T = Row>(): Promise<T | null> {
            if (normalized.includes("MIN(created_at_epoch_ms)")) {
              return { oldest_created_at_epoch_ms: 500 } as T
            }
            return {
              missing_request_count: 1,
              missing_response_count: 2,
              missing_source_count: 0,
            } as T
          },
        }

        return statement
      },
    },
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
    ARTICLE_IMPORT_MODE: "shadow",
    ARTICLE_IMPORT_MODE_OVERRIDES: "web=native",
    ARTICLE_IMPORT_ALLOWED_HOSTS: "docs.astra.example",
    ARTICLE_IMPORT_BLOCKED_HOSTS: "blocked.example",
    ARTICLE_IMPORT_FORCE_PROXY_HOSTS: "legacy.example",
    ARTICLE_IMPORT_RATE_LIMIT_MAX: "12",
    ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS: "60",
    ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS: "4",
    ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS: "14",
    ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS: "operator-review",
    ARTICLE_IMPORT_OPERATOR_TOKEN: "operator-secret",
    ASTRA_ENV: "staging",
  }
}

function createContext(): AstraRequestContext {
  return {
    requestId: "req_obs",
    nowEpochMs: 5_000,
    config: {
      environment: "staging",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "shadow",
      articleImportModeOverrides: { web: "native" },
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: "proxy",
      deviceListReadMode: "proxy",
      deviceRevokeWriteMode: "proxy",
      syncBootstrapReadMode: "proxy",
      syncPullReadMode: "proxy",
      syncPushWriteMode: "proxy",
      syncMaxMutationsPerRequest: 200,
      articleImportAllowedHosts: ["docs.astra.example"],
      articleImportBlockedHosts: ["blocked.example"],
      articleImportForceProxyHosts: ["legacy.example"],
      articleImportRateLimitMax: 12,
      articleImportRateLimitWindowSeconds: 60,
      articleImportMaxQueueAttempts: 4,
      articleImportMaxShadowBytes: 262_144,
      articleImportMaxNativeBytes: 2_097_152,
      articleImportArtifactRetentionDays: 14,
      articleImportArtifactRetentionClass: "operator-review",
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

describe("handleArticleImportObservability", () => {
  it("returns rollout controls, queue visibility, and recent failures", async () => {
    const response = await handleArticleImportObservability(
      new Request("https://platform.astra.example/__platform/article-import/observability", {
        headers: {
          authorization: "Bearer operator-secret",
        },
      }),
      createEnv(),
      createContext(),
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      articleImport: {
        defaultMode: string
        modeOverrides: Record<string, string>
        routeCounts: Record<string, number>
        backlog: { queued: number; failed: number; deadLettered: number; oldestQueuedAgeMs: number | null }
        artifactGovernance: { retentionClass: string; retentionDays: number }
        artifactCompleteness: { missingRequestCount: number; missingResponseCount: number }
        queuePolicy: { operatorReplayEnabled: boolean }
        recentFailures: Array<{ jobId: string; queueAttemptCount: number; replayCount: number }>
      }
    }

    expect(payload.articleImport.defaultMode).toBe("shadow")
    expect(payload.articleImport.modeOverrides).toEqual({ web: "native" })
    expect(payload.articleImport.routeCounts).toEqual({ proxy: 2, native: 1 })
    expect(payload.articleImport.backlog).toEqual({
      queued: 3,
      failed: 0,
      deadLettered: 1,
      oldestQueuedAgeMs: 4_500,
    })
    expect(payload.articleImport.queuePolicy.operatorReplayEnabled).toBe(true)
    expect(payload.articleImport.artifactGovernance).toEqual({
      retentionClass: "operator-review",
      retentionDays: 14,
    })
    expect(payload.articleImport.artifactCompleteness.missingRequestCount).toBe(1)
    expect(payload.articleImport.artifactCompleteness.missingResponseCount).toBe(2)
    expect(payload.articleImport.recentFailures).toEqual([
      expect.objectContaining({
        jobId: "job_123",
        queueAttemptCount: 3,
        replayCount: 2,
        lastReplayReason: "r2 restored",
      }),
    ])
  })

  it("requires an operator token when replay is enabled", async () => {
    const response = await handleArticleImportObservability(
      new Request("https://platform.astra.example/__platform/article-import/observability"),
      createEnv(),
      createContext(),
    )

    expect(response.status).toBe(401)
  })
})
