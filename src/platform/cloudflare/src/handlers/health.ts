import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { jsonResponse } from "../lib/http"

export function handlePlatformHealth(
  _request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Response {
  return jsonResponse({
    ok: true,
    service: "astra-platform",
    requestId: ctx.requestId,
    environment: ctx.config.environment,
    articleImport: {
      defaultMode: ctx.config.articleImportMode,
      modeOverrides: ctx.config.articleImportModeOverrides,
      hostPolicyCounts: {
        allowedHosts: ctx.config.articleImportAllowedHosts.length,
        blockedHosts: ctx.config.articleImportBlockedHosts.length,
        forceProxyHosts: ctx.config.articleImportForceProxyHosts.length,
      },
      rateLimit: {
        maxRequestsPerWindow: ctx.config.articleImportRateLimitMax,
        windowSeconds: ctx.config.articleImportRateLimitWindowSeconds,
      },
      queuePolicy: {
        maxAttempts: ctx.config.articleImportMaxQueueAttempts,
        operatorReplayEnabled: Boolean(env.ARTICLE_IMPORT_OPERATOR_TOKEN?.trim()),
      },
      byteCaps: {
        maxShadowBytes: ctx.config.articleImportMaxShadowBytes,
        maxNativeBytes: ctx.config.articleImportMaxNativeBytes,
      },
      artifactGovernance: {
        retentionClass: ctx.config.articleImportArtifactRetentionClass,
        retentionDays: ctx.config.articleImportArtifactRetentionDays,
      },
      platformObservabilityPath: "/__platform/observability",
      observabilityPath: "/__platform/article-import/observability",
      operatorReplayPath: "/__platform/article-import/replay",
    },
    continuityLifecycle: {
      exportArtifactRetentionDays: ctx.config.continuityExportArtifactRetentionDays,
      deleteGracePeriodSeconds: ctx.config.continuityDeleteGracePeriodSeconds,
      jobHistoryRetentionDays: ctx.config.continuityJobHistoryRetentionDays,
      tombstoneRetentionDays: ctx.config.continuityTombstoneRetentionDays,
      routes: {
        createExport: "/v1/account/export",
        readExportStatus: "/v1/account/export/:jobId",
        createCloudDataDelete: "/v1/account/cloud-data-delete",
        readCloudDataDeleteStatus: "/v1/account/cloud-data-delete/:jobId",
      },
    },
    syncLifecycle: {
      tombstoneRetentionDays: ctx.config.syncTombstoneRetentionDays,
      compactionBatchSize: ctx.config.syncCompactionBatchSize,
      compactionDryRun: ctx.config.syncCompactionDryRun,
      routes: {
        repair: "/v1/sync/repair",
        compaction: "/__platform/sync/compaction",
      },
    },
    cutoverDomains: {
      authAnonymousIssueMode: ctx.config.authAnonymousIssueMode,
      authSessionIssueMode: ctx.config.authSessionIssueMode,
      authSessionReadMode: ctx.config.authSessionReadMode,
      authSessionRevokeWriteMode: ctx.config.authSessionRevokeWriteMode,
      accountSummaryReadMode: ctx.config.accountSummaryReadMode,
      deviceListReadMode: ctx.config.deviceListReadMode,
      deviceRevokeWriteMode: ctx.config.deviceRevokeWriteMode,
      syncBootstrapReadMode: ctx.config.syncBootstrapReadMode,
      syncPullReadMode: ctx.config.syncPullReadMode,
      syncPushWriteMode: ctx.config.syncPushWriteMode,
    },
    durableObjectsEnabled: false,
    bindings: {
      d1: Boolean(env.ASTRA_PLATFORM_DB),
      r2: Boolean(env.ASTRA_IMPORT_PAYLOADS),
      kv: Boolean(env.ASTRA_IDEMPOTENCY_KV),
      queue: Boolean(env.ARTICLE_IMPORT_QUEUE),
      continuityLifecycleQueue: Boolean(env.CONTINUITY_LIFECYCLE_QUEUE),
    },
    authIssuanceFoundation: {
      mirrorSecretConfigured: Boolean(ctx.config.platformMirrorSecret),
      sessionPublicBaseURL: ctx.config.sessionPublicBaseURL,
      internalMirrorBackPaths: {
        authenticated: "/_internal/cloudflare/auth/issue/authenticated",
        anonymous: "/_internal/cloudflare/auth/issue/anonymous",
      },
    },
  })
}
