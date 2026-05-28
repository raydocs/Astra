import type {
  AstraAppKind,
  AstraBrowserFamily,
  AstraDeviceStatus,
  AstraIdentityMode,
  AstraPlan,
  AstraSubscriptionStatus,
  AstraUsageEvent,
} from "../../../../types/auth"
import type { ProviderId } from "../../../../types/config"

export const SHADOW_SYNC_COLLECTIONS = [
  "config",
  "vocabulary",
  "review_schedule",
  "reading_history",
  "study_progress",
] as const

export type ShadowSyncCollection = (typeof SHADOW_SYNC_COLLECTIONS)[number]
export type ShadowSessionStatus = "active" | "revoked"
export type ShadowSyncOperation = "upsert" | "delete"
export type ShadowIdentityMode = AstraIdentityMode
export type ShadowPlan = AstraPlan
export type ShadowSubscriptionStatus = AstraSubscriptionStatus
export type ShadowBrowserFamily = AstraBrowserFamily
export type ShadowAppKind = AstraAppKind
export type ShadowDeviceStatus = AstraDeviceStatus
export type ShadowCredentialKind = "password"
export type ShadowCredentialHashAlgorithm = "sha256_v1"
export type ShadowAuthIssueRouteKind = "anonymous" | "session"
export type ShadowNodeMirrorStatus = "pending" | "completed" | "failed"

export interface ShadowUserSyncPreferences {
  reading_history: boolean
  study_progress: boolean
  weekly_digest: boolean
}

export interface ShadowUserSnapshot {
  id: string
  email: string
  billingEmail: string
  createdAt: string
  plan: ShadowPlan
  subscriptionStatus: ShadowSubscriptionStatus
  identityMode: ShadowIdentityMode
  installId?: string | null
  providerEntitlements: ProviderId[]
  syncPreferences: ShadowUserSyncPreferences
  shadowUpdatedAt?: string
}

export interface ShadowUserRow extends ShadowUserSnapshot {
  installId: string | null
  shadowUpdatedAt: string
}

export interface ShadowUserCredentialSnapshot {
  userId: string
  credentialKind: ShadowCredentialKind
  passwordHash: string
  passwordHashAlg: ShadowCredentialHashAlgorithm
  updatedAt: string
  shadowUpdatedAt?: string
}

export interface ShadowUserCredentialRow extends ShadowUserCredentialSnapshot {
  shadowUpdatedAt: string
}

export interface ShadowUserUsageSnapshot {
  userId: string
  usageDay: string
  dailyRequestsLimit: number
  dailyCharactersLimit: number
  requestsPerMinuteLimit: number
  requestsToday: number
  charactersToday: number
  totalRequests: number
  totalCharacters: number
  lastRequestAt?: string | null
  recentEvents: AstraUsageEvent[]
  shadowUpdatedAt?: string
}

export interface ShadowUserUsageRow extends ShadowUserUsageSnapshot {
  lastRequestAt: string | null
  shadowUpdatedAt: string
}

export interface ShadowSessionSnapshot {
  sessionId: string
  userId: string
  deviceId: string
  identityMode: ShadowIdentityMode
  issuedAt: string
  expiresAt?: string | null
  createdAt: string
  lastSeenAt: string
  lastVerifiedAt?: string | null
  status: ShadowSessionStatus
  revokedAt?: string | null
  tokenHash?: string | null
  tokenHashAlg?: string | null
  shadowUpdatedAt?: string
}

export interface ShadowSessionRow extends ShadowSessionSnapshot {
  expiresAt: string | null
  lastVerifiedAt: string | null
  revokedAt: string | null
  tokenHash: string | null
  tokenHashAlg: string | null
  shadowUpdatedAt: string
}

export interface ShadowDeviceSnapshot {
  userId: string
  deviceId: string
  identityMode: ShadowIdentityMode
  label: string
  platform?: string | null
  browserFamily?: string | null
  appKind: string
  appVersion?: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastSyncAt?: string | null
  status: ShadowDeviceStatus
  revokedAt?: string | null
  updatedAt: string
  shadowUpdatedAt?: string
}

export interface ShadowDeviceRow extends ShadowDeviceSnapshot {
  id: string
  platform: string | null
  browserFamily: string | null
  appVersion: string | null
  lastSyncAt: string | null
  revokedAt: string | null
  shadowUpdatedAt: string
}

export interface ShadowDeviceListEntry {
  deviceId: string
  label: string
  platform: string | null
  browserFamily: string | null
  appKind: string
  appVersion: string | null
  firstSeenAt: string
  lastSeenAt: string
  lastSyncAt: string | null
  status: ShadowDeviceStatus
  isCurrentDevice: boolean
}

export interface ShadowSyncCollectionSnapshot {
  userId: string
  collection: ShadowSyncCollection
  enabled: boolean
  defaultEnabled: boolean
  lastIssuedCursor?: string | null
  lastServerUpdatedAt?: string | null
  compactionFloorCursor?: string | null
  compactionFloorCursorOrder?: number | null
  lastCompactedAt?: string | null
  shadowUpdatedAt?: string
}

export interface ShadowSyncCollectionRow extends ShadowSyncCollectionSnapshot {
  lastIssuedCursor: string | null
  lastServerUpdatedAt: string | null
  compactionFloorCursor: string | null
  compactionFloorCursorOrder: number | null
  lastCompactedAt: string | null
  shadowUpdatedAt: string
}

export interface ShadowSyncMutationSnapshot {
  userId: string
  collection: ShadowSyncCollection
  collectionEnabled?: boolean
  collectionDefaultEnabled?: boolean
  schemaVersion: number
  recordId: string
  operation: ShadowSyncOperation
  clientMutationId: string
  deviceId: string
  clientUpdatedAt: string
  serverUpdatedAt: string
  cursor: string
  payload?: Record<string, unknown> | null
  tombstoneRetainedUntil?: string | null
  serverMutationId?: string
  shadowUpdatedAt?: string
}

export interface ShadowSyncMutationRow extends ShadowSyncMutationSnapshot {
  serverMutationId: string
  payload: Record<string, unknown> | null
  shadowUpdatedAt: string
}

export interface ShadowSyncRecordStateSnapshot {
  userId: string
  collection: ShadowSyncCollection
  recordId: string
  isDeleted: boolean
  payload?: Record<string, unknown> | null
  lastClientMutationId: string
  lastDeviceId: string
  lastServerUpdatedAt: string
  lastCursor: string
  lastCursorOrder: number
  tombstoneRetainedUntil?: string | null
  shadowUpdatedAt?: string
}

export interface ShadowSyncRecordStateRow extends ShadowSyncRecordStateSnapshot {
  payload: Record<string, unknown> | null
  tombstoneRetainedUntil: string | null
  shadowUpdatedAt: string
}

export interface ShadowSyncCompactionRunSnapshot {
  runId: string
  userId: string
  collection: ShadowSyncCollection
  status: string
  cutoffCursorOrder: number
  floorCursor?: string | null
  floorCursorOrder?: number | null
  mutationsScanned: number
  mutationsDeleted: number
  recordsMaterialized: number
  startedAt?: string | null
  completedAt?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export interface ShadowSyncCompactionRunRow extends ShadowSyncCompactionRunSnapshot {
  floorCursor: string | null
  floorCursorOrder: number | null
  startedAt: string | null
  completedAt: string | null
  errorCode: string | null
  errorMessage: string | null
}

export interface ShadowAuthIssueRequestSnapshot {
  requestKey: string
  routeKind: ShadowAuthIssueRouteKind
  userId?: string | null
  installId?: string | null
  deviceId: string
  sessionId: string
  nodeMirrorStatus: ShadowNodeMirrorStatus
  createdAt: string
  lastAttemptAt: string
  completedAt?: string | null
  failedAt?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  shadowUpdatedAt?: string
}

export interface ShadowAuthIssueRequestRow extends ShadowAuthIssueRequestSnapshot {
  userId: string | null
  installId: string | null
  completedAt: string | null
  failedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  shadowUpdatedAt: string
}

export interface ShadowSyncMutationUpsertResult {
  row: ShadowSyncMutationRow
  deduped: boolean
  previousRecordState: ShadowSyncRecordStateRow | null
}

export interface ShadowSyncBootstrap {
  serverTime: string
  deviceId: string
  collections: Record<ShadowSyncCollection, ShadowSyncCollectionRow>
  limits: {
    maxMutationsPerRequest: number
  }
  transport: {
    deviceHeader: "X-Astra-Device-Id"
    idempotencyKey: "clientMutationId"
    cursorMode: "per-collection"
  }
}

export interface ShadowSyncCursorExpired {
  collection: ShadowSyncCollection
  requestedCursor: string | null
  compactionFloorCursor: string
}

export interface ShadowSyncPullResult {
  serverTime: string
  deltas: Record<ShadowSyncCollection, ShadowSyncMutationRow[]>
  nextCursors: Record<ShadowSyncCollection, string | null>
  cursorExpired?: ShadowSyncCursorExpired | null
}
