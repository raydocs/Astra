import type { ProviderId } from "../src/types/config"
import type {
  AstraAccount,
  AstraPlan,
  AstraSession,
  AstraSubscriptionStatus,
  AstraUsageSnapshot,
} from "../src/types/auth"
import type {
  VideoNoteArtifact,
  VideoNoteCreateRequest,
  VideoNoteJobStatus,
  VideoNotePlatform,
  VideoNoteTranscriptSource,
} from "../src/types/video-notes"
import type { AstraSessionClaims } from "../src/utils/astra/session-token"
import type { ProviderTranslationRequest } from "../src/utils/providers/types"
import type { D1Database } from "../platform/cloudflare/src/bindings"

export const SYNC_COLLECTIONS = ["config", "vocabulary", "review_schedule", "reading_history", "study_progress"] as const

export type SyncCollection = (typeof SYNC_COLLECTIONS)[number]
export type SyncOperation = "upsert" | "delete"
export type IdentityMode = "anonymous" | "authenticated"
export type DeviceStatus = "active" | "revoked"
export type SessionStatus = "active" | "revoked"

export interface RelayEnv {
  port: number
  host: string
  publicBaseURL: string
  sessionPublicBaseURL: string
  sessionSecret: string
  platformMirrorSecret?: string
  userDbPath: string
  videoNoteStorePath: string
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
  openrouterApiKey: string
  /** When set, all managed translations route through OpenRouter instead of direct provider keys. */
  useOpenRouter: boolean
  /** Maps Astra provider/model keys to OpenRouter model IDs. Configurable via ASTRA_OPENROUTER_MODEL_MAP env. */
  openrouterModelMap: Record<string, string>
  freeDailyRequests: number
  freeDailyCharacters: number
  freeRpm: number
  proDailyRequests: number
  proDailyCharacters: number
  proRpm: number
  sessionTtlMs: number
  syncMaxMutationsPerRequest: number
  videoNoteMaxConcurrentJobs: number
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
  provider: ProviderId
  model: string
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

export interface ServerUsageEvent {
  timestamp: string
  provider: ProviderId
  requestCount: number
  characterCount: number
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
}

export interface ServerUserSyncPreferences {
  reading_history: boolean
  study_progress: boolean
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
