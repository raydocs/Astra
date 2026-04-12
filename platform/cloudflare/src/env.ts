import type { D1Database, KVNamespace, Queue, R2Bucket } from "./bindings"
import type { ArticleImportQueueMessage } from "./types/article-import"
import type { ContinuityLifecycleQueueMessage } from "./types/continuity-lifecycle"
import {
  ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_CLASS,
  ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_DAYS,
  ARTICLE_IMPORT_DEFAULT_MAX_NATIVE_BYTES,
  ARTICLE_IMPORT_DEFAULT_MAX_SHADOW_BYTES,
  ARTICLE_IMPORT_DEFAULT_QUEUE_MAX_ATTEMPTS,
  ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
} from "./types/article-import"
import {
  CONTINUITY_DELETE_DEFAULT_GRACE_PERIOD_SECONDS,
  CONTINUITY_EXPORT_DEFAULT_RETENTION_DAYS,
  CONTINUITY_JOB_HISTORY_DEFAULT_RETENTION_DAYS,
  CONTINUITY_TOMBSTONE_RETENTION_DEFAULT_DAYS,
} from "./types/continuity-lifecycle"

export type ArticleImportMode = "proxy" | "shadow" | "native"
export type AuthIssueMode = "proxy" | "shadow" | "native"
export type AuthSessionReadMode = "proxy" | "shadow" | "native"
export type AccountSummaryReadMode = "proxy" | "shadow" | "native"
export type AuthSessionRevokeWriteMode = "proxy" | "native"
export type DeviceListReadMode = "proxy" | "shadow" | "native"
export type DeviceRevokeWriteMode = "proxy" | "native"
export type SyncBootstrapReadMode = "proxy" | "shadow" | "native"
export type SyncPullReadMode = "proxy" | "shadow" | "native"
export type SyncPushWriteMode = "proxy" | "native"

export interface AstraPlatformEnv {
  ASTRA_PLATFORM_DB: D1Database
  ASTRA_IMPORT_PAYLOADS: R2Bucket
  ASTRA_IDEMPOTENCY_KV: KVNamespace
  ARTICLE_IMPORT_QUEUE: Queue<ArticleImportQueueMessage>
  CONTINUITY_LIFECYCLE_QUEUE?: Queue<ContinuityLifecycleQueueMessage>
  NODE_RELAY_ORIGIN: string
  ASTRA_SESSION_SECRET?: string
  ASTRA_PLATFORM_MIRROR_SECRET?: string
  ASTRA_FREE_DAILY_REQUESTS?: string
  ASTRA_FREE_DAILY_CHARACTERS?: string
  ASTRA_FREE_RPM?: string
  ASTRA_SESSION_TTL_MS?: string
  ARTICLE_IMPORT_MODE?: string
  ARTICLE_IMPORT_MODE_OVERRIDES?: string
  AUTH_ANONYMOUS_ISSUE_MODE?: string
  AUTH_SESSION_ISSUE_MODE?: string
  AUTH_SESSION_READ_MODE?: string
  AUTH_SESSION_REVOKE_WRITE_MODE?: string
  SESSION_PUBLIC_BASE_URL?: string
  ACCOUNT_SUMMARY_READ_MODE?: string
  DEVICE_LIST_READ_MODE?: string
  DEVICE_REVOKE_WRITE_MODE?: string
  SYNC_BOOTSTRAP_READ_MODE?: string
  SYNC_PULL_READ_MODE?: string
  SYNC_PUSH_WRITE_MODE?: string
  ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST?: string
  ARTICLE_IMPORT_ALLOWED_HOSTS?: string
  ARTICLE_IMPORT_BLOCKED_HOSTS?: string
  ARTICLE_IMPORT_FORCE_PROXY_HOSTS?: string
  ARTICLE_IMPORT_RATE_LIMIT_MAX?: string
  ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS?: string
  ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS?: string
  ARTICLE_IMPORT_MAX_SHADOW_BYTES?: string
  ARTICLE_IMPORT_MAX_NATIVE_BYTES?: string
  ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS?: string
  ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS?: string
  ARTICLE_IMPORT_OPERATOR_TOKEN?: string
  CONTINUITY_EXPORT_ARTIFACT_RETENTION_DAYS?: string
  CONTINUITY_DELETE_GRACE_PERIOD_SECONDS?: string
  CONTINUITY_JOB_HISTORY_RETENTION_DAYS?: string
  CONTINUITY_TOMBSTONE_RETENTION_DAYS?: string
  SYNC_TOMBSTONE_RETENTION_DAYS?: string
  SYNC_COMPACTION_BATCH_SIZE?: string
  SYNC_COMPACTION_DRY_RUN?: string
  ASTRA_ENV?: string
}

export interface PlatformConfig {
  environment: string
  nodeRelayOrigin: URL
  platformMirrorSecret?: string | null
  sessionPublicBaseURL?: string | null
  articleImportMode: ArticleImportMode
  articleImportModeOverrides: Partial<Record<string, ArticleImportMode>>
  authAnonymousIssueMode?: AuthIssueMode
  authSessionIssueMode?: AuthIssueMode
  authSessionReadMode: AuthSessionReadMode
  authSessionRevokeWriteMode: AuthSessionRevokeWriteMode
  accountSummaryReadMode: AccountSummaryReadMode
  deviceListReadMode: DeviceListReadMode
  deviceRevokeWriteMode: DeviceRevokeWriteMode
  syncBootstrapReadMode: SyncBootstrapReadMode
  syncPullReadMode: SyncPullReadMode
  syncPushWriteMode: SyncPushWriteMode
  syncMaxMutationsPerRequest: number
  articleImportAllowedHosts: string[]
  articleImportBlockedHosts: string[]
  articleImportForceProxyHosts: string[]
  articleImportRateLimitMax: number | null
  articleImportRateLimitWindowSeconds: number
  articleImportMaxQueueAttempts: number
  articleImportMaxShadowBytes: number
  articleImportMaxNativeBytes: number
  articleImportArtifactRetentionDays: number
  articleImportArtifactRetentionClass: string
  continuityExportArtifactRetentionDays: number
  continuityDeleteGracePeriodSeconds: number
  continuityJobHistoryRetentionDays: number
  continuityTombstoneRetentionDays: number
  syncTombstoneRetentionDays: number
  syncCompactionBatchSize: number
  syncCompactionDryRun: boolean
}

function parseArticleImportMode(value: string | undefined): ArticleImportMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported ARTICLE_IMPORT_MODE: ${value}`)
}

function parseAuthIssueMode(value: string | undefined, envName: string): AuthIssueMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported ${envName}: ${value}`)
}

function parseAuthSessionReadMode(value: string | undefined): AuthSessionReadMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported AUTH_SESSION_READ_MODE: ${value}`)
}

function parseAuthSessionRevokeWriteMode(value: string | undefined): AuthSessionRevokeWriteMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "native") {
    return value
  }
  throw new Error(`Unsupported AUTH_SESSION_REVOKE_WRITE_MODE: ${value}`)
}

function parseAccountSummaryReadMode(value: string | undefined): AccountSummaryReadMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported ACCOUNT_SUMMARY_READ_MODE: ${value}`)
}

function parseDeviceListReadMode(value: string | undefined): DeviceListReadMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported DEVICE_LIST_READ_MODE: ${value}`)
}

function parseDeviceRevokeWriteMode(value: string | undefined): DeviceRevokeWriteMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "native") {
    return value
  }
  throw new Error(`Unsupported DEVICE_REVOKE_WRITE_MODE: ${value}`)
}

function parseSyncBootstrapReadMode(value: string | undefined): SyncBootstrapReadMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported SYNC_BOOTSTRAP_READ_MODE: ${value}`)
}

function parseSyncPullReadMode(value: string | undefined): SyncPullReadMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "shadow" || value === "native") {
    return value
  }
  throw new Error(`Unsupported SYNC_PULL_READ_MODE: ${value}`)
}

function parseSyncPushWriteMode(value: string | undefined): SyncPushWriteMode {
  if (!value) return "proxy"
  if (value === "proxy" || value === "native") {
    return value
  }
  throw new Error(`Unsupported SYNC_PUSH_WRITE_MODE: ${value}`)
}

function parseCsvList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function parsePositiveInteger(
  value: string | undefined,
  envName: string,
  fallback: number | null,
): number | null {
  if (!value?.trim()) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${envName}: ${value}`)
  }
  return parsed
}

function parseArticleImportModeOverrides(value: string | undefined): Partial<Record<string, ArticleImportMode>> {
  if (!value?.trim()) return {}

  const overrides: Partial<Record<string, ArticleImportMode>> = {}
  for (const pair of value.split(",")) {
    const trimmed = pair.trim()
    if (!trimmed) continue

    const [surface, mode, ...rest] = trimmed.split("=").map((entry) => entry.trim().toLowerCase())
    if (!surface || !mode || rest.length > 0) {
      throw new Error(`Invalid ARTICLE_IMPORT_MODE_OVERRIDES entry: ${pair}`)
    }

    overrides[surface] = parseArticleImportMode(mode)
  }

  return overrides
}

function parseOptionalString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false
  }
  throw new Error(`Invalid boolean value: ${value}`)
}

export function parsePlatformConfig(env: AstraPlatformEnv): PlatformConfig {
  let nodeRelayOrigin: URL
  try {
    nodeRelayOrigin = new URL(env.NODE_RELAY_ORIGIN)
  } catch {
    throw new Error(`Invalid NODE_RELAY_ORIGIN: ${env.NODE_RELAY_ORIGIN}`)
  }

  return {
    environment: env.ASTRA_ENV?.trim() || "local",
    nodeRelayOrigin,
    platformMirrorSecret: env.ASTRA_PLATFORM_MIRROR_SECRET?.trim() || null,
    sessionPublicBaseURL: env.SESSION_PUBLIC_BASE_URL?.trim() || null,
    articleImportMode: parseArticleImportMode(env.ARTICLE_IMPORT_MODE),
    articleImportModeOverrides: parseArticleImportModeOverrides(env.ARTICLE_IMPORT_MODE_OVERRIDES),
    authAnonymousIssueMode: parseAuthIssueMode(env.AUTH_ANONYMOUS_ISSUE_MODE, "AUTH_ANONYMOUS_ISSUE_MODE"),
    authSessionIssueMode: parseAuthIssueMode(env.AUTH_SESSION_ISSUE_MODE, "AUTH_SESSION_ISSUE_MODE"),
    authSessionReadMode: parseAuthSessionReadMode(env.AUTH_SESSION_READ_MODE),
    authSessionRevokeWriteMode: parseAuthSessionRevokeWriteMode(env.AUTH_SESSION_REVOKE_WRITE_MODE),
    accountSummaryReadMode: parseAccountSummaryReadMode(env.ACCOUNT_SUMMARY_READ_MODE),
    deviceListReadMode: parseDeviceListReadMode(env.DEVICE_LIST_READ_MODE),
    deviceRevokeWriteMode: parseDeviceRevokeWriteMode(env.DEVICE_REVOKE_WRITE_MODE),
    syncBootstrapReadMode: parseSyncBootstrapReadMode(env.SYNC_BOOTSTRAP_READ_MODE),
    syncPullReadMode: parseSyncPullReadMode(env.SYNC_PULL_READ_MODE),
    syncPushWriteMode: parseSyncPushWriteMode(env.SYNC_PUSH_WRITE_MODE),
    syncMaxMutationsPerRequest: parsePositiveInteger(
      env.ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST,
      "ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST",
      200,
    ) ?? 200,
    articleImportAllowedHosts: parseCsvList(env.ARTICLE_IMPORT_ALLOWED_HOSTS),
    articleImportBlockedHosts: parseCsvList(env.ARTICLE_IMPORT_BLOCKED_HOSTS),
    articleImportForceProxyHosts: parseCsvList(env.ARTICLE_IMPORT_FORCE_PROXY_HOSTS),
    articleImportRateLimitMax: parsePositiveInteger(env.ARTICLE_IMPORT_RATE_LIMIT_MAX, "ARTICLE_IMPORT_RATE_LIMIT_MAX", null),
    articleImportRateLimitWindowSeconds: parsePositiveInteger(
      env.ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS,
      "ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS",
      ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    ) ?? ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    articleImportMaxQueueAttempts: parsePositiveInteger(
      env.ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS,
      "ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS",
      ARTICLE_IMPORT_DEFAULT_QUEUE_MAX_ATTEMPTS,
    ) ?? ARTICLE_IMPORT_DEFAULT_QUEUE_MAX_ATTEMPTS,
    articleImportMaxShadowBytes: parsePositiveInteger(
      env.ARTICLE_IMPORT_MAX_SHADOW_BYTES,
      "ARTICLE_IMPORT_MAX_SHADOW_BYTES",
      ARTICLE_IMPORT_DEFAULT_MAX_SHADOW_BYTES,
    ) ?? ARTICLE_IMPORT_DEFAULT_MAX_SHADOW_BYTES,
    articleImportMaxNativeBytes: parsePositiveInteger(
      env.ARTICLE_IMPORT_MAX_NATIVE_BYTES,
      "ARTICLE_IMPORT_MAX_NATIVE_BYTES",
      ARTICLE_IMPORT_DEFAULT_MAX_NATIVE_BYTES,
    ) ?? ARTICLE_IMPORT_DEFAULT_MAX_NATIVE_BYTES,
    articleImportArtifactRetentionDays: parsePositiveInteger(
      env.ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS,
      "ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS",
      ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_DAYS,
    ) ?? ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_DAYS,
    articleImportArtifactRetentionClass: parseOptionalString(
      env.ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS,
      ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_CLASS,
    ),
    continuityExportArtifactRetentionDays: parsePositiveInteger(
      env.CONTINUITY_EXPORT_ARTIFACT_RETENTION_DAYS,
      "CONTINUITY_EXPORT_ARTIFACT_RETENTION_DAYS",
      CONTINUITY_EXPORT_DEFAULT_RETENTION_DAYS,
    ) ?? CONTINUITY_EXPORT_DEFAULT_RETENTION_DAYS,
    continuityDeleteGracePeriodSeconds: parsePositiveInteger(
      env.CONTINUITY_DELETE_GRACE_PERIOD_SECONDS,
      "CONTINUITY_DELETE_GRACE_PERIOD_SECONDS",
      CONTINUITY_DELETE_DEFAULT_GRACE_PERIOD_SECONDS,
    ) ?? CONTINUITY_DELETE_DEFAULT_GRACE_PERIOD_SECONDS,
    continuityJobHistoryRetentionDays: parsePositiveInteger(
      env.CONTINUITY_JOB_HISTORY_RETENTION_DAYS,
      "CONTINUITY_JOB_HISTORY_RETENTION_DAYS",
      CONTINUITY_JOB_HISTORY_DEFAULT_RETENTION_DAYS,
    ) ?? CONTINUITY_JOB_HISTORY_DEFAULT_RETENTION_DAYS,
    continuityTombstoneRetentionDays: parsePositiveInteger(
      env.CONTINUITY_TOMBSTONE_RETENTION_DAYS,
      "CONTINUITY_TOMBSTONE_RETENTION_DAYS",
      CONTINUITY_TOMBSTONE_RETENTION_DEFAULT_DAYS,
    ) ?? CONTINUITY_TOMBSTONE_RETENTION_DEFAULT_DAYS,
    syncTombstoneRetentionDays: parsePositiveInteger(
      env.SYNC_TOMBSTONE_RETENTION_DAYS,
      "SYNC_TOMBSTONE_RETENTION_DAYS",
      CONTINUITY_TOMBSTONE_RETENTION_DEFAULT_DAYS,
    ) ?? CONTINUITY_TOMBSTONE_RETENTION_DEFAULT_DAYS,
    syncCompactionBatchSize: parsePositiveInteger(
      env.SYNC_COMPACTION_BATCH_SIZE,
      "SYNC_COMPACTION_BATCH_SIZE",
      500,
    ) ?? 500,
    syncCompactionDryRun: parseBoolean(env.SYNC_COMPACTION_DRY_RUN, true),
  }
}
