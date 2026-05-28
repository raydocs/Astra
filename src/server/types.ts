import type { ProviderId, ServiceMode } from "../types/config"
import type { TranslationTask } from "../types/messages"
import type { TranslationErrorCode } from "../types/translation"
import type {
  AstraCacheStatus,
  AstraContentLengthBucket,
  AstraCostBucket,
  AstraFallbackReason,
  AstraFeatureSurface,
  AstraLatencyBucket,
  AstraOperatingTier,
  AstraTaskClass,
} from "../types/operating-model"
import type {
  AstraAccount,
  AstraPlan,
  AstraSession,
  AstraSubscriptionStatus,
  AstraUsageSnapshot,
} from "../types/auth"
import type {
  VideoNoteArtifact,
  VideoNoteCreateRequest,
  VideoNoteJobStatus,
  VideoNotePlatform,
  VideoNoteTranscriptSource,
} from "../types/video-notes"
import type { AstraSessionClaims } from "../utils/astra/session-token"
import type { ProviderTranslationRequest } from "../utils/providers/types"
import type { D1Database } from "../platform/cloudflare/src/bindings"
import type { AstraOpsRoleId } from "../utils/ops-console"

export const SYNC_COLLECTIONS = ["config", "vocabulary", "review_schedule", "reading_history", "study_progress"] as const

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number]
export type SyncOperation = "upsert" | "delete"
export type IdentityMode = "anonymous" | "authenticated"
export type DeviceStatus = "active" | "revoked"
export type SessionStatus = "active" | "revoked"

export interface RelayOperatorPrincipal {
  id: string
  role: AstraOpsRoleId
  token: string
}

export interface RelayEnv {
  port: number
  host: string
  publicBaseURL: string
  sessionPublicBaseURL: string
  sessionSecret: string
  platformMirrorSecret?: string
  operatorPrincipals: RelayOperatorPrincipal[]
  userDbPath: string
  videoNoteStorePath: string
  longRunningTaskStorePath?: string
  supportReportInboxPath: string
  supportKnownIssueStorePath: string
  featureFlagRuntimePath: string
  opsAuditLogPath?: string
  cancellationReasonStorePath?: string
  analyticsEventStorePath?: string
  loginEmail: string
  loginPassword: string
  plan: AstraPlan
  subscriptionStatus: AstraSubscriptionStatus
  providerEntitlements: ProviderId[]
  billingCheckoutBaseURL: string
  billingPortalBaseURL: string
  corsAllowedOrigins?: string[]
  openaiApiKey: string
  googleApiKey: string
  googleTranslateApiKey?: string
  openrouterApiKey: string
  /** When set, all managed translations route through OpenRouter instead of direct provider keys. */
  useOpenRouter: boolean
  /** Maps Astra provider/model keys to OpenRouter model IDs. Configurable via ASTRA_OPENROUTER_MODEL_MAP env. */
  openrouterModelMap: Record<string, string>
  freeDailyRequests: number
  freeDailyCharacters: number
  freeRpm: number
  trialDailyRequests: number
  trialDailyCharacters: number
  trialRpm: number
  proDailyRequests: number
  proDailyCharacters: number
  proRpm: number
  sessionTtlMs: number
  syncMaxMutationsPerRequest: number
  videoNoteMaxConcurrentJobs: number
  /** Development/test only: echo passwordless sign-in codes in API responses instead of email delivery. */
  emailSignInCodeDevelopmentEcho: boolean
  /** Production email delivery path for passwordless sign-in codes. */
  emailDeliveryProvider?: "resend"
  emailDeliveryResendApiKey?: string
  emailDeliveryResendFrom?: string
  emailDeliveryResendApiBaseUrl?: string
  /** Allowed Google OAuth client IDs/audiences for production ID-token verification. */
  oauthGoogleClientIds?: string[]
  /** Allowed Apple OAuth client IDs/audiences, usually bundle ID or Services ID. */
  oauthAppleClientIds?: string[]
  /** Development/test only: accepts pre-verified OAuth identity payloads. Keep false in production. */
  oauthIdentityDevelopmentRedeem: boolean
  cloudflareShadow?: RelayCloudflareShadowConfig
}

export interface RelayShadowEvent {
  kind: "shadow-write" | "read-parity"
  scope: string
  outcome: "failed" | "mismatch"
  message: string
  details?: Record<string, unknown>
}

export interface RelayCloudflareShadowConfig {
  writeEnabled: boolean
  readParityEnabled: boolean
  accountId?: string
  databaseId?: string
  apiToken?: string
  apiBaseUrl?: string
  db?: D1Database
  onEvent?: (event: RelayShadowEvent) => void
}

export type SessionClaims = AstraSessionClaims

export type AstraDigestSourceType = "page" | "video" | "pdf" | "doc" | "book" | "writing" | "saved"

export interface AstraDigestSourceBreakdownItem {
  type: AstraDigestSourceType
  count: number
}

export interface AstraWeeklyDigestSnapshot {
  digestId: string
  periodStart: string
  periodEnd: string
  reviewedCount: number
  savedCount: number
  sourceBreakdown: AstraDigestSourceBreakdownItem[]
  highlightedWords: string[]
  highlightedSentences: string[]
  nextReviewCount: number
  generatedAt: string
}

export type RelaySession = AstraSession & {
  sessionId: string
  deviceId: string
  issuedAt: string
  identityMode: IdentityMode
}

export interface AuthenticatedSession {
  token: string
  session: RelaySession
  claims: SessionClaims
}

export interface ValidatedSessionContext {
  token: string
  claims: SessionClaims
  session: RelaySession
  sessionRecord: ServerSessionRecord
  device: ServerDeviceRecord
  user: ServerUserRecord
}

export interface AuthenticatedAccount {
  account: AstraAccount
  usage: AstraUsageSnapshot
}

export interface RelayTranslateRequest extends ProviderTranslationRequest {
  /** Optional for ordinary managed-service clients; legacy/advanced clients may still send it. */
  provider?: ProviderId
  /** Optional for ordinary managed-service clients; the relay resolves a model from serviceMode when omitted. */
  model?: string
}

export interface ResolvedRelayTranslateRequest extends ProviderTranslationRequest {
  provider: ProviderId
  model: string
}

export type ManagedProviderRoute = "direct" | "openrouter"

export interface ManagedProviderMetadata {
  provider: ProviderId
  model: string
  serviceMode?: ServiceMode
  route: ManagedProviderRoute
  attemptedRoutes: ManagedProviderRoute[]
  finalRoute: ManagedProviderRoute
  fallbackUsed: boolean
  fallbackReason: AstraFallbackReason
}

export interface ManagedProviderTranslationResult {
  translations: string[]
  metadata: ManagedProviderMetadata
}

export interface ServerUsageEventMetadata {
  model?: string
  task?: TranslationTask
  textCount?: number
  durationMs?: number
  taskClass?: AstraTaskClass
  costBucket?: AstraCostBucket
  latencyBucket?: AstraLatencyBucket
  cacheStatus?: AstraCacheStatus
  fallbackReason?: AstraFallbackReason
  tier?: AstraOperatingTier
  surface?: AstraFeatureSurface
  contentLengthBucket?: AstraContentLengthBucket
  providerRoute?: ManagedProviderRoute
  fallbackUsed?: boolean
  success?: boolean
  errorCode?: TranslationErrorCode
}

export interface DeviceMetadataInput {
  deviceId: string
  label?: string | null
  platform?: string | null
  browserFamily?: string | null
  appKind?: string | null
  appVersion?: string | null
}

export interface DeviceListEntry {
  deviceId: string
  label: string
  platform: string | null
  browserFamily: string | null
  appKind: string
  appVersion: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastSyncAt: string | null
  status: DeviceStatus
  isCurrentDevice: boolean
}

export interface ServerDeviceRecord {
  deviceId: string
  userId: string
  email: string
  identityMode: IdentityMode
  label: string
  platform: string | null
  browserFamily: string | null
  appKind: string
  appVersion: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastSyncAt: string | null
  status: DeviceStatus
  expoPushToken: string | null
  expoPushTokenUpdatedAt: string | null
  expoPushTokenPlatform: string | null
  updatedAt: string
  revokedAt: string | null
}

export interface ServerSessionRecord {
  sessionId: string
  userId: string
  email: string
  deviceId: string
  identityMode: IdentityMode
  issuedAt: string
  expiresAt: string | null
  createdAt: string
  lastSeenAt: string
  lastVerifiedAt: string | null
  status: SessionStatus
  revokedAt: string | null
}

export interface ServerUserLimits {
  dailyRequests: number
  dailyCharacters: number
  requestsPerMinute: number
}

export type ServerMobileRetentionEventName =
  | "app_opened"
  | "app_hydrated"
  | "review_rated"
  | "review_skipped"
  | "sync_attempted"
  | "sync_succeeded"
  | "sync_failed"
  | "reminder_preference_changed"
  | "notification_tapped"
  | "sign_in_succeeded"
  | "sign_in_failed"
  | "link_succeeded"
  | "link_failed"
  | "source_hidden"
  | "source_restored"
  | "source_removed"
  | "cloud_learning_delete_requested"
  | "cloud_learning_delete_succeeded"
  | "cloud_learning_delete_failed"

export interface ServerMobileRetentionEvent {
  ownerId: string
  email: string
  deviceId: string
  eventId: string
  name: ServerMobileRetentionEventName
  clientTimestamp: number
  receivedAt: string
  metadata: Record<string, string | number | boolean | null>
}

export interface ServerMobileRetentionEventInput {
  id: string
  name: ServerMobileRetentionEventName
  timestamp: number
  metadata: Record<string, string | number | boolean | null>
}

export type MobileRetentionSummaryGrain = "day" | "week"

export interface MobileRetentionSummaryBucket {
  bucket: string
  eventName: ServerMobileRetentionEventName
  count: number
}

export interface MobileRetentionSummaryEventCount {
  eventName: ServerMobileRetentionEventName
  count: number
}

export interface MobileRetentionSummary {
  schema: "astra-mobile-retention-summary.v1"
  generatedAt: string
  source: "metadata_only_mobile_retention_events"
  retainedEventsPerUserLimit: number
  grain: MobileRetentionSummaryGrain
  totalEvents: number
  buckets: MobileRetentionSummaryBucket[]
  byEventName: MobileRetentionSummaryEventCount[]
  privacy: {
    metadataOnly: true
    aggregateOnly: true
    perUserRows: false
    rawContentIncluded: false
    identifiersIncluded: false
  }
}

export interface ServerUsageEvent extends ServerUsageEventMetadata {
  timestamp: string
  provider: ProviderId
  serviceMode: ServiceMode
  requestCount: number
  characterCount: number
}

export interface CostUsageSummaryBucket {
  tier: AstraOperatingTier
  taskClass: AstraTaskClass | "unknown"
  costBucket: AstraCostBucket | "unknown"
  eventCount: number
  requestCount: number
  characterCount: number
  successCount: number
  failureCount: number
  fallbackCount: number
  estimatedSpendUsd: number
}

export interface CostUsageServiceModeSummary {
  serviceMode: ServiceMode
  eventCount: number
  requestCount: number
  characterCount: number
  successCount: number
  failureCount: number
  fallbackCount: number
  latencySampleCount: number
  latencyP50Ms: number | null
  latencyP95Ms: number | null
  estimatedSpendUsd: number
}

export interface CostUsageCacheStatusSummary {
  cacheStatus: AstraCacheStatus
  eventCount: number
  requestCount: number
  characterCount: number
  share: number
  estimatedSpendUsd: number
}

export type CostUsageSpikeStatus = "none" | "watch" | "spike"
export type CostUsageRiskLevel = "low" | "watch" | "high"

export interface CostUsageDailyEstimateSummary {
  date: string | null
  estimatedSpendUsd: number
  previousDate: string | null
  previousEstimatedSpendUsd: number
  spikeRatio: number | null
  spikeStatus: CostUsageSpikeStatus
  riskLevel: CostUsageRiskLevel
}

export interface CostUsageSummary {
  schema: "astra-cost-usage-summary.v1"
  generatedAt: string
  source: "recent_user_usage_events"
  recentEventsPerUserLimit: number
  totalEvents: number
  totalRequests: number
  totalCharacters: number
  totalEstimatedSpendUsd: number
  estimateRegistry: "internal_deterministic_v1"
  cacheHitRate: number | null
  dailyEstimate: CostUsageDailyEstimateSummary
  buckets: CostUsageSummaryBucket[]
  byServiceMode: CostUsageServiceModeSummary[]
  byCacheStatus: CostUsageCacheStatusSummary[]
}

export type ProviderHealthStatus = "healthy" | "watch" | "incident"

export interface ProviderHealthSummaryBucket {
  provider: ProviderId
  model: string
  serviceMode: ServiceMode
  taskClass: AstraTaskClass | "unknown"
  eventCount: number
  requestCount: number
  characterCount: number
  successCount: number
  failureCount: number
  fallbackCount: number
  successRate: number | null
  fallbackRate: number | null
  latencySampleCount: number
  latencyP50Ms: number | null
  latencyP95Ms: number | null
  healthStatus: ProviderHealthStatus
}

export interface ProviderHealthSummary {
  schema: "astra-provider-health-summary.v1"
  generatedAt: string
  source: "recent_user_usage_events"
  recentEventsPerUserLimit: number
  totalEvents: number
  totalRequests: number
  totalCharacters: number
  buckets: ProviderHealthSummaryBucket[]
}

export type OpsUserLookupQueryType = "email" | "email_hash" | "user_id"
export type OpsUserUsageCategory = "light" | "normal" | "heavy" | "extreme"

export interface OpsUserLookupTaskSummary {
  taskClass: AstraTaskClass | "unknown"
  eventCount: number
  successCount: number
  failureCount: number
  fallbackCount: number
  latencySampleCount: number
  latencyP95Ms: number | null
}

export interface OpsUserLookupResultWindow {
  mode: "exact_lookup"
  limit: number
  cursor: string | null
  nextCursor: string | null
  returnedCount: number
  totalMatched: number
  hasMore: boolean
}

export interface OpsUserLookupSnapshotBoundary {
  metadataOnly: true
  contentIncluded: false
  rawQueryIncluded: false
  exportAvailable: false
  recentTaskSummaryLimit: number
  excludedFields: string[]
}

export interface OpsUserLookupSummary {
  schema: "astra-ops-user-lookup.v1"
  generatedAt: string
  queryType: OpsUserLookupQueryType
  resultWindow: OpsUserLookupResultWindow
  snapshotBoundary: OpsUserLookupSnapshotBoundary
  user: {
    userId: string
    emailHash: string
    createdAt: string
    plan: AstraOperatingTier
    subscriptionStatus: "active" | "past_due" | "canceled"
    identityMode: IdentityMode
    providerEntitlementCount: number
    limits: ServerUserLimits
    usage: {
      usageDay: string
      requestsToday: number
      charactersToday: number
      totalRequests: number
      totalCharacters: number
      lastRequestAt: string | null
      recentEventCount: number
      usageCategory: OpsUserUsageCategory
    }
    devices: {
      activeCount: number
      revokedCount: number
    }
    sessions: {
      activeCount: number
      revokedCount: number
    }
    recentTaskSummary: OpsUserLookupTaskSummary[]
  }
}

export interface ServerUserUsage {
  usageDay: string
  requestsToday: number
  charactersToday: number
  totalRequests: number
  totalCharacters: number
  lastRequestAt: string | null
  recentRequestTimestamps: string[]
  recentEvents: ServerUsageEvent[]
  taskUsageMonth: string
  monthlyTaskRequests: Partial<Record<AstraTaskClass, number>>
}

export interface ServerUserSyncPreferences {
  reading_history: boolean
  study_progress: boolean
  weekly_digest: boolean
}

export type ServerOAuthIdentityProvider = "apple" | "google"

export interface ServerOAuthIdentityRecord {
  provider: ServerOAuthIdentityProvider
  subject: string
  userId: string
  email: string | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  lastRedeemedAt: string
}

export interface ServerUserRecord {
  id: string
  email: string
  billingEmail: string
  createdAt: string
  passwordHash: string
  plan: AstraPlan
  subscriptionStatus: AstraSubscriptionStatus
  providerEntitlements: ProviderId[]
  limits: ServerUserLimits
  usage: ServerUserUsage
  identityMode: IdentityMode
  syncPreferences: ServerUserSyncPreferences
  installId?: string
}

export interface MirroredAuthenticatedIssueInput {
  userId: string
  email: string
  device: ServerDeviceRecord
  session: ServerSessionRecord
}

export interface MirroredAnonymousIssueInput {
  user: ServerUserRecord
  device: ServerDeviceRecord
  session: ServerSessionRecord
}

export interface SyncMutationInput {
  collection: SyncCollection
  schemaVersion: number
  recordId: string
  operation: SyncOperation
  clientMutationId: string
  deviceId: string
  clientUpdatedAt: string
  payload?: Record<string, unknown> | null
}

export interface ServerSyncMutationRecord extends SyncMutationInput {
  ownerId: string
  email: string
  serverMutationId: string
  serverUpdatedAt: string
  cursor: string
}

export interface SyncCollectionBootstrapState {
  enabled: boolean
  defaultEnabled: boolean
  cursor: string | null
}

export interface SyncBootstrapResponse {
  serverTime: string
  deviceId: string
  collections: Record<SyncCollection, SyncCollectionBootstrapState>
  limits: {
    maxMutationsPerRequest: number
  }
  transport: {
    deviceHeader: "X-Astra-Device-Id"
    idempotencyKey: "clientMutationId"
    cursorMode: "per-collection"
  }
}

export interface SyncMutationAck {
  collection: SyncCollection
  clientMutationId: string
  recordId: string
  operation: SyncOperation
  serverUpdatedAt: string
  cursor: string
  deduped: boolean
}

export interface SyncMutationRejection {
  collection: SyncCollection
  clientMutationId: string
  code: string
  message: string
}

export interface SyncPushResponse {
  serverTime: string
  accepted: SyncMutationAck[]
  rejected: SyncMutationRejection[]
  nextCursors: Record<SyncCollection, string | null>
}

export interface SyncPullResponse {
  serverTime: string
  deltas: Record<SyncCollection, ServerSyncMutationRecord[]>
  nextCursors: Record<SyncCollection, string | null>
}

export interface CloudLearningMemoryCollectionInventory {
  collection: SyncCollection | "weekly_digest_archive"
  enabled: boolean
  defaultEnabled: boolean
  mutationCount: number
  activeCount: number
  cursor: string | null
  lastUpdatedAt: string | null
}

export interface CloudLearningMemoryInventory {
  schema: "astra-cloud-learning-memory-inventory.v1"
  generatedAt: string
  account: {
    userId: string
    identityMode: IdentityMode
  }
  collections: CloudLearningMemoryCollectionInventory[]
  preferences: ServerUserSyncPreferences
  privacy: {
    metadataOnly: true
    rawContentIncluded: false
    rawUrlsIncluded: false
    emailsIncluded: false
    deviceSessionIdsIncluded: false
    syncPayloadBodiesIncluded: false
    promptModelOutputsIncluded: false
    externalProviderReceiptsIncluded: false
    localBrowserDeletionIncluded: false
  }
}

export interface CloudLearningMemoryDeletionCollectionReceipt {
  collection: SyncCollection | "weekly_digest_archive"
  clearedMutationCount: number
  clearedActiveCount: number
  previousCursor: string | null
}

export interface CloudLearningMemoryDeletionReceipt {
  schema: "astra-cloud-learning-memory-deletion-receipt.v1"
  deletedAt: string
  account: {
    userId: string
    identityMode: IdentityMode
  }
  collections: CloudLearningMemoryDeletionCollectionReceipt[]
  totals: {
    clearedMutationCount: number
    clearedActiveCount: number
  }
  boundary: {
    metadataOnly: true
    cloudServerSideOnly: true
    rawContentIncluded: false
    externalProviderDeletionIncluded: false
    localBrowserDeletionIncluded: false
  }
}

export interface VideoNoteJobRecord {
  id: string
  ownerEmail: string
  sourceUrl: string
  sourceKey: string
  platform: VideoNotePlatform
  title: string | null
  status: VideoNoteJobStatus
  transcriptSource: VideoNoteTranscriptSource | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  artifactId: string | null
  request: VideoNoteCreateRequest
}

export interface VideoNoteArtifactRecord extends VideoNoteArtifact {
  ownerEmail: string
}
