import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import {
  AstraAccountSchema,
  AstraAccountSummarySchema,
  AstraPlanSchema,
  AstraQuotaSchema,
  AstraSessionSchema,
  AstraSubscriptionStatusSchema,
  AstraUsageEventSchema,
  AstraUsageSchema,
  AstraUsageSnapshotSchema,
  type AstraAccount,
  type AstraAccountSummary,
  type AstraQuota,
  type AstraUsage,
  type AstraUsageSnapshot,
} from "../types/auth"
import { ProviderIdSchema, ServiceModeSchema, type ProviderId, type ServiceMode } from "../types/config"
import {
  AstraCacheStatusSchema,
  AstraContentLengthBucketSchema,
  AstraCostBucketSchema,
  AstraFallbackReasonSchema,
  AstraFeatureSurfaceSchema,
  AstraLatencyBucketSchema,
  AstraOperatingTierSchema,
  AstraTaskClassSchema,
  type AstraCostBucket,
  type AstraTaskClass,
} from "../types/operating-model"
import { AstraError } from "../types/translation"
import { isSyncCollectionEnabled, validateSyncMutationPayload } from "../utils/astra/sync-push"
import { buildAstraAnonymousIdentity } from "../utils/astra/anonymous-identity"
import {
  hashAstraCredentialSecret,
  verifyAstraCredentialSecret,
} from "../utils/astra/credential-hash"
import { getPlanEntitlement, shouldMeterTask } from "../utils/entitlements"

import { buildRelaySession, issueSession, verifySessionToken } from "./auth"
import { createRelayCloudflareShadowBridge } from "./cloudflare-shadow"
import type {
  AuthenticatedSession,
  CloudLearningMemoryDeletionReceipt,
  CloudLearningMemoryInventory,
  DeviceListEntry,
  DeviceMetadataInput,
  DeviceStatus,
  IdentityMode,
  MirroredAnonymousIssueInput,
  MirroredAuthenticatedIssueInput,
  RelayEnv,
  RelaySession,
  MobileRetentionSummary,
  MobileRetentionSummaryGrain,
  CostUsageSummary,
  CostUsageSummaryBucket,
  CostUsageServiceModeSummary,
  CostUsageCacheStatusSummary,
  ProviderHealthSummary,
  ProviderHealthSummaryBucket,
  ProviderHealthStatus,
  CostUsageRiskLevel,
  CostUsageSpikeStatus,
  ManagedProviderRoute,
  ServerUsageEvent,
  OpsUserLookupQueryType,
  OpsUserLookupSummary,
  OpsUserLookupTaskSummary,
  OpsUserUsageCategory,
  ServerDeviceRecord,
  ServerMobileRetentionEvent,
  ServerMobileRetentionEventInput,
  ServerOAuthIdentityRecord,
  ServerSessionRecord,
  ServerSyncMutationRecord,
  ServerUserLimits,
  ServerUserRecord,
  ServerUserSyncPreferences,
  ServerUsageEventMetadata,
  ServerUserUsage,
  SyncBootstrapResponse,
  SyncCollection,
  SyncMutationAck,
  SyncMutationInput,
  SyncMutationRejection,
  SyncPullResponse,
  SyncPushResponse,
  AstraDigestSourceType,
  AstraWeeklyDigestSnapshot,
} from "./types"
import { SYNC_COLLECTIONS } from "./types"

const ServerUserLimitsSchema = z.object({
  dailyRequests: z.number().int().nonnegative(),
  dailyCharacters: z.number().int().nonnegative(),
  requestsPerMinute: z.number().int().nonnegative(),
})

const ServerUsageEventMetadataSchema = z.object({
  model: z.string().trim().min(1).optional(),
  task: z.enum(["translate", "explain", "custom"]).optional(),
  textCount: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  taskClass: AstraTaskClassSchema.optional(),
  costBucket: AstraCostBucketSchema.optional(),
  latencyBucket: AstraLatencyBucketSchema.optional(),
  cacheStatus: AstraCacheStatusSchema.optional(),
  fallbackReason: AstraFallbackReasonSchema.optional(),
  tier: AstraOperatingTierSchema.optional(),
  surface: AstraFeatureSurfaceSchema.optional(),
  contentLengthBucket: AstraContentLengthBucketSchema.optional(),
  providerRoute: z.enum(["direct", "openrouter"]).optional(),
  fallbackUsed: z.boolean().optional(),
  success: z.boolean().optional(),
  errorCode: z.enum([
    "CONFIG_MISSING",
    "CONTENT_UNAVAILABLE",
    "PROVIDER_REQUEST_FAILED",
    "PROVIDER_PARSE_FAILED",
    "INVALID_RESPONSE",
    "SITE_DISABLED",
    "QUOTA_EXCEEDED",
    "UNKNOWN",
  ]).optional(),
}).strict()

function coerceNonnegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback
}

function pickParsed<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const ServerStoredUsageEventSchema = z.preprocess((raw) => {
  const record = typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  const timestamp = typeof record.timestamp === "string" && record.timestamp.trim()
    ? record.timestamp
    : new Date(0).toISOString()
  const provider = pickParsed(ProviderIdSchema, record.provider) ?? "openai"
  const serviceMode = pickParsed(ServiceModeSchema, record.serviceMode) ?? "automatic"
  const parsedMetadata = ServerUsageEventMetadataSchema.partial().safeParse({
    model: typeof record.model === "string" && record.model.trim() ? record.model : undefined,
    task: record.task,
    textCount: typeof record.textCount === "number" ? coerceNonnegativeInteger(record.textCount) : undefined,
    durationMs: typeof record.durationMs === "number" ? coerceNonnegativeInteger(record.durationMs) : undefined,
    taskClass: record.taskClass,
    costBucket: record.costBucket,
    latencyBucket: record.latencyBucket,
    cacheStatus: record.cacheStatus,
    fallbackReason: record.fallbackReason,
    tier: record.tier,
    surface: record.surface,
    contentLengthBucket: record.contentLengthBucket,
    providerRoute: record.providerRoute,
    fallbackUsed: record.fallbackUsed,
    success: record.success,
    errorCode: record.errorCode,
  })
  const metadata = parsedMetadata.success ? parsedMetadata.data : {}

  return {
    timestamp,
    provider,
    serviceMode,
    requestCount: coerceNonnegativeInteger(record.requestCount),
    characterCount: coerceNonnegativeInteger(record.characterCount),
    ...metadata,
  }
}, AstraUsageEventSchema)

const MonthlyTaskRequestsSchema = z.record(z.string(), z.number().int().nonnegative()).transform((record) => {
  const parsed: Partial<Record<AstraTaskClass, number>> = {}
  for (const [key, value] of Object.entries(record)) {
    const taskClass = AstraTaskClassSchema.safeParse(key)
    if (taskClass.success) parsed[taskClass.data] = value
  }
  return parsed
})

const ServerUsageSchema = z.object({
  usageDay: z.string().trim().min(1),
  requestsToday: z.number().int().nonnegative(),
  charactersToday: z.number().int().nonnegative(),
  totalRequests: z.number().int().nonnegative(),
  totalCharacters: z.number().int().nonnegative(),
  lastRequestAt: z.string().trim().min(1).nullable(),
  recentRequestTimestamps: z.array(z.string().trim().min(1)),
  recentEvents: z.array(ServerStoredUsageEventSchema),
  taskUsageMonth: z.string().trim().min(1).default("1970-01"),
  monthlyTaskRequests: MonthlyTaskRequestsSchema.default({}),
}).transform<ServerUserUsage>((usage) => ({
  ...usage,
  taskUsageMonth: usage.taskUsageMonth,
  monthlyTaskRequests: usage.monthlyTaskRequests,
}))

const IdentityModeSchema = z.enum(["anonymous", "authenticated"]).default("authenticated")
const DeviceStatusSchema = z.enum(["active", "revoked"]).default("active")
const SessionStatusSchema = z.enum(["active", "revoked"]).default("active")
const SyncCollectionSchema = z.enum(SYNC_COLLECTIONS)
const SyncOperationSchema = z.enum(["upsert", "delete"])

const ServerUserSyncPreferencesSchema = z.object({
  reading_history: z.boolean().default(false),
  study_progress: z.boolean().default(false),
  weekly_digest: z.boolean().default(true),
})

function createDefaultSyncPreferences(): ServerUserSyncPreferences {
  return {
    reading_history: false,
    study_progress: false,
    weekly_digest: true,
  }
}

const ServerUserRecordSchema = z.object({
  id: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1),
  billingEmail: z.string().trim().min(1).optional(),
  createdAt: z.string().trim().min(1).optional(),
  passwordHash: z.string().trim().min(1),
  plan: AstraPlanSchema,
  subscriptionStatus: AstraSubscriptionStatusSchema,
  providerEntitlements: z.array(ProviderIdSchema),
  limits: ServerUserLimitsSchema,
  usage: ServerUsageSchema,
  identityMode: IdentityModeSchema,
  syncPreferences: ServerUserSyncPreferencesSchema.default(createDefaultSyncPreferences()),
  installId: z.string().trim().min(1).optional(),
}).transform((record) => ({
  ...record,
  id: record.id ?? buildUserId(record.email),
  billingEmail: record.billingEmail ?? record.email,
  createdAt: record.createdAt ?? new Date().toISOString(),
}))

const ServerDeviceRecordSchema = z.object({
  deviceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  identityMode: IdentityModeSchema,
  label: z.string().trim().min(1),
  platform: z.string().trim().min(1).nullable(),
  browserFamily: z.string().trim().min(1).nullable(),
  appKind: z.string().trim().min(1),
  appVersion: z.string().trim().min(1).nullable(),
  firstSeenAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastSyncAt: z.string().trim().min(1).nullable(),
  status: DeviceStatusSchema,
  expoPushToken: z.string().trim().min(1).nullable().default(null),
  expoPushTokenUpdatedAt: z.string().trim().min(1).nullable().default(null),
  expoPushTokenPlatform: z.string().trim().min(1).nullable().default(null),
  updatedAt: z.string().trim().min(1),
  revokedAt: z.string().trim().min(1).nullable(),
})

const ServerSessionRecordSchema = z.object({
  sessionId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  identityMode: IdentityModeSchema,
  issuedAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1).nullable(),
  createdAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastVerifiedAt: z.string().trim().min(1).nullable(),
  status: SessionStatusSchema,
  revokedAt: z.string().trim().min(1).nullable(),
})

const ServerOAuthIdentityRecordSchema = z.object({
  provider: z.enum(["apple", "google"]),
  subject: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1).nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  lastRedeemedAt: z.string().trim().min(1),
}) satisfies z.ZodType<ServerOAuthIdentityRecord>

const ServerSyncMutationRecordSchema = z.object({
  ownerId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  serverMutationId: z.string().trim().min(1),
  serverUpdatedAt: z.string().trim().min(1),
  cursor: z.string().trim().min(1),
  collection: SyncCollectionSchema,
  schemaVersion: z.number().int().positive(),
  recordId: z.string().trim().min(1),
  operation: SyncOperationSchema,
  clientMutationId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  clientUpdatedAt: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
})

const AstraDigestSourceTypeSchema = z.enum(["page", "video", "pdf", "doc", "book", "writing", "saved"])
const AstraWeeklyDigestSnapshotSchema = z.object({
  digestId: z.string().trim().min(1),
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  reviewedCount: z.number().int().nonnegative(),
  savedCount: z.number().int().nonnegative(),
  sourceBreakdown: z.array(z.object({
    type: AstraDigestSourceTypeSchema,
    count: z.number().int().nonnegative(),
  })),
  highlightedWords: z.array(z.string()),
  highlightedSentences: z.array(z.string()),
  nextReviewCount: z.number().int().nonnegative(),
  generatedAt: z.string().trim().min(1),
}) satisfies z.ZodType<AstraWeeklyDigestSnapshot>

const ServerWeeklyDigestRecordSchema = z.object({
  ownerId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  digestId: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  snapshot: AstraWeeklyDigestSnapshotSchema,
})

const ServerMobileRetentionEventSchema = z.object({
  ownerId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  eventId: z.string().trim().min(1).max(120),
  name: z.enum([
    "app_opened",
    "app_hydrated",
    "review_rated",
    "review_skipped",
    "sync_attempted",
    "sync_succeeded",
    "sync_failed",
    "reminder_preference_changed",
    "notification_tapped",
    "sign_in_succeeded",
    "sign_in_failed",
    "link_succeeded",
    "link_failed",
    "source_hidden",
    "source_restored",
    "source_removed",
    "cloud_learning_delete_requested",
    "cloud_learning_delete_succeeded",
    "cloud_learning_delete_failed",
  ]),
  clientTimestamp: z.number().finite(),
  receivedAt: z.string().trim().min(1),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
}) satisfies z.ZodType<ServerMobileRetentionEvent>

const LegacyServerUserDatabaseSchema = z.object({
  version: z.literal(1),
  users: z.array(ServerUserRecordSchema),
})

const ServerUserDatabaseSchema = z.object({
  version: z.literal(2),
  users: z.array(ServerUserRecordSchema),
  devices: z.array(ServerDeviceRecordSchema).default([]),
  sessions: z.array(ServerSessionRecordSchema).default([]),
  oauthIdentities: z.array(ServerOAuthIdentityRecordSchema).default([]),
  syncMutations: z.array(ServerSyncMutationRecordSchema).default([]),
  weeklyDigests: z.array(ServerWeeklyDigestRecordSchema).default([]),
  mobileRetentionEvents: z.array(ServerMobileRetentionEventSchema).default([]),
  nextSyncCursor: z.number().int().nonnegative().default(0),
})

export type ServerUserDatabase = z.infer<typeof ServerUserDatabaseSchema>

const WEEKLY_DIGEST_ARCHIVE_LIMIT_PER_USER = 26
const MOBILE_RETENTION_EVENTS_LIMIT_PER_USER = 500

type SessionContext = {
  user: ServerUserRecord
  session: ServerSessionRecord
  device: ServerDeviceRecord | null
}

function buildUserId(email: string): string {
  return `usr_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12)}`
}

function buildEmailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
}

function buildOAuthUserEmail(provider: "apple" | "google", subject: string): string {
  const hash = createHash("sha256").update(`${provider}:${subject.trim()}`).digest("hex").slice(0, 16)
  return `oauth_${provider}_${hash}@astra.oauth`
}

function getCurrentUsageDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function getCurrentUsageMonth(now: Date): string {
  return now.toISOString().slice(0, 7)
}

function defaultLimits(plan: ServerUserRecord["plan"], env?: RelayEnv): ServerUserLimits {
  if (env) {
    if (plan === "pro") {
      return { dailyRequests: env.proDailyRequests, dailyCharacters: env.proDailyCharacters, requestsPerMinute: env.proRpm }
    }
    if (plan === "trial") {
      return { dailyRequests: env.trialDailyRequests, dailyCharacters: env.trialDailyCharacters, requestsPerMinute: env.trialRpm }
    }
    return { dailyRequests: env.freeDailyRequests, dailyCharacters: env.freeDailyCharacters, requestsPerMinute: env.freeRpm }
  }
  return { dailyRequests: 2000, dailyCharacters: 500_000, requestsPerMinute: 120 }
}

function defaultEntitlements(_plan: ServerUserRecord["plan"]): ServerUserRecord["providerEntitlements"] {
  return ["google_translate", "openai", "gemini"]
}

function freeFirstEntitlements(env: RelayEnv): ServerUserRecord["providerEntitlements"] {
  return env.providerEntitlements.length ? env.providerEntitlements : defaultEntitlements("free")
}

function applyTemporaryFreeDefaults(db: ServerUserDatabase, env: RelayEnv): ServerUserDatabase {
  return {
    ...db,
    users: db.users.map((user) => ({
      ...user,
      providerEntitlements: freeFirstEntitlements(env),
    })),
  }
}

function createEmptyUsage(now: Date = new Date()): ServerUserUsage {
  return {
    usageDay: getCurrentUsageDay(now),
    requestsToday: 0,
    charactersToday: 0,
    totalRequests: 0,
    totalCharacters: 0,
    lastRequestAt: null,
    recentRequestTimestamps: [],
    recentEvents: [],
    taskUsageMonth: getCurrentUsageMonth(now),
    monthlyTaskRequests: {},
  }
}

async function createSeedDatabase(env: RelayEnv): Promise<ServerUserDatabase> {
  return {
    version: 2,
    users: [{
      id: buildUserId(env.loginEmail),
      email: env.loginEmail,
      billingEmail: env.loginEmail,
      createdAt: new Date().toISOString(),
      passwordHash: await hashAstraCredentialSecret(env.loginPassword),
      plan: env.plan,
      subscriptionStatus: env.subscriptionStatus,
      providerEntitlements: env.providerEntitlements.length ? env.providerEntitlements : defaultEntitlements(env.plan),
      limits: defaultLimits(env.plan, env),
      usage: createEmptyUsage(),
      identityMode: "authenticated",
      syncPreferences: createDefaultSyncPreferences(),
    }],
    devices: [],
    sessions: [],
    oauthIdentities: [],
    syncMutations: [],
    weeklyDigests: [],
    mobileRetentionEvents: [],
    nextSyncCursor: 0,
  }
}

async function migrateDatabase(
  raw: unknown,
  env: RelayEnv,
  options: {
    seedOnInvalid?: boolean
  } = {},
): Promise<ServerUserDatabase> {
  const legacy = LegacyServerUserDatabaseSchema.safeParse(raw)
  if (legacy.success) {
    return applyTemporaryFreeDefaults({
      version: 2,
      users: legacy.data.users,
      devices: [],
      sessions: [],
      oauthIdentities: [],
      syncMutations: [],
      weeklyDigests: [],
      mobileRetentionEvents: [],
      nextSyncCursor: 0,
    }, env)
  }

  const current = ServerUserDatabaseSchema.safeParse(raw)
  if (current.success) {
    return applyTemporaryFreeDefaults(current.data, env)
  }

  if (options.seedOnInvalid ?? true) {
    return createSeedDatabase(env)
  }

  throw new Error("Authoritative user database has an invalid or unsupported shape.")
}

function buildAccount(user: ServerUserRecord, relayBaseURL: string): AstraAccount {
  return AstraAccountSchema.parse({
    id: user.id,
    relayBaseURL,
    email: user.email,
    billingEmail: user.billingEmail,
    createdAt: user.createdAt,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    providerEntitlements: user.providerEntitlements,
  })
}

function buildQuota(user: ServerUserRecord): AstraQuota {
  return AstraQuotaSchema.parse({
    dailyRequestsLimit: user.limits.dailyRequests,
    dailyCharactersLimit: user.limits.dailyCharacters,
    requestsPerMinuteLimit: user.limits.requestsPerMinute,
    remainingDailyRequests: Math.max(0, user.limits.dailyRequests - user.usage.requestsToday),
    remainingDailyCharacters: Math.max(0, user.limits.dailyCharacters - user.usage.charactersToday),
  })
}

function buildUsage(user: ServerUserRecord): AstraUsage {
  return AstraUsageSchema.parse({
    totalRequests: user.usage.totalRequests,
    totalCharacters: user.usage.totalCharacters,
    dailyRequestsUsed: user.usage.requestsToday,
    dailyCharactersUsed: user.usage.charactersToday,
    lastRequestAt: user.usage.lastRequestAt,
    recentEvents: user.usage.recentEvents,
  })
}

function buildUsageSnapshot(user: ServerUserRecord, generatedAt: string): AstraUsageSnapshot {
  return AstraUsageSnapshotSchema.parse({
    generatedAt,
    quota: buildQuota(user),
    usage: buildUsage(user),
  })
}

function startOfDigestWeek(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = start.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + mondayOffset)
  return start
}

function mobileRetentionBucketForTimestamp(timestamp: number, grain: MobileRetentionSummaryGrain): string {
  const eventDate = new Date(timestamp)
  const utcDay = new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate()))
  return grain === "week" ? startOfDigestWeek(utcDay).toISOString().slice(0, 10) : utcDay.toISOString().slice(0, 10)
}

function stringFromSyncPayload(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function numberFromSyncPayload(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function sourceTypeForSyncedVocabularyEntry(record: Record<string, unknown>): AstraDigestSourceType {
  const sourceContext = record.sourceContext && typeof record.sourceContext === "object"
    ? record.sourceContext as Record<string, unknown>
    : {}

  if (sourceContext.surface === "subtitle_reader" || sourceContext.surface === "video_transcript") return "video"
  if (sourceContext.ownedReadingSourceType === "pdf") return "pdf"
  if (sourceContext.ownedReadingSourceType === "epub") return "book"
  if (sourceContext.ownedReadingSourceType === "subtitle-file") return "doc"
  if (
    stringFromSyncPayload(sourceContext.pageUrl)
    || stringFromSyncPayload(record.url)
    || stringFromSyncPayload(record.hostname)
    || stringFromSyncPayload(sourceContext.hostname)
  ) return "page"
  return "saved"
}

function syncPayloadRecord(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  return payload && typeof payload === "object" ? payload : null
}

function buildDeviceListEntries(
  db: ServerUserDatabase,
  email: string,
  currentDeviceId?: string,
  identityMode?: IdentityMode,
): DeviceListEntry[] {
  return db.devices
    .filter((device) => device.email === email.trim() && (!identityMode || device.identityMode === identityMode))
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      platform: device.platform,
      browserFamily: device.browserFamily,
      appKind: device.appKind,
      appVersion: device.appVersion,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      status: device.status,
      isCurrentDevice: currentDeviceId === device.deviceId,
    }))
}

function countActiveSyncRecords(mutations: ServerSyncMutationRecord[]): number {
  const activeRecordIds = new Set<string>()
  for (const mutation of mutations) {
    if (mutation.operation === "delete") {
      activeRecordIds.delete(mutation.recordId)
      continue
    }
    activeRecordIds.add(mutation.recordId)
  }
  return activeRecordIds.size
}

function resolveSessionSummaryStatus(
  session: ServerSessionRecord,
  now: Date,
): "active" | "revoked" | "expired" {
  if (session.status === "revoked" || session.revokedAt) {
    return "revoked"
  }
  if (isSessionExpired(session.expiresAt, now)) {
    return "expired"
  }
  return "active"
}

function buildSyncCollectionSummaries(
  db: ServerUserDatabase,
  user: ServerUserRecord,
): AstraAccountSummary["sync"]["collections"] {
  return {
    config: buildSyncCollectionSummary(db, user, "config"),
    vocabulary: buildSyncCollectionSummary(db, user, "vocabulary"),
    review_schedule: buildSyncCollectionSummary(db, user, "review_schedule"),
    reading_history: buildSyncCollectionSummary(db, user, "reading_history"),
    study_progress: buildSyncCollectionSummary(db, user, "study_progress"),
  }
}

function getSyncCollectionEnabled(user: ServerUserRecord, collection: SyncCollection): boolean {
  if (collection === "reading_history") return user.syncPreferences.reading_history
  if (collection === "study_progress") return user.syncPreferences.study_progress
  return true
}

function getSyncCollectionDefaultEnabled(collection: SyncCollection): boolean {
  return collection === "config" || collection === "vocabulary" || collection === "review_schedule"
}

function getUserSyncMutations(
  db: ServerUserDatabase,
  user: ServerUserRecord,
  collection: SyncCollection,
): ServerSyncMutationRecord[] {
  return db.syncMutations
    .filter((mutation) =>
      (mutation.email === user.email || mutation.ownerId === user.id) && mutation.collection === collection,
    )
    .sort((a, b) => parseCursor(a.cursor) - parseCursor(b.cursor))
}

function buildSyncCollectionSummary(
  db: ServerUserDatabase,
  user: ServerUserRecord,
  collection: SyncCollection,
): AstraAccountSummary["sync"]["collections"][SyncCollection] {
  const mutations = getUserSyncMutations(db, user, collection)
  const latestMutation = mutations.at(-1) ?? null

  return {
    enabled: getSyncCollectionEnabled(user, collection),
    defaultEnabled: getSyncCollectionDefaultEnabled(collection),
    cursor: latestMutation?.cursor ?? null,
    mutationCount: mutations.length,
    activeCount: countActiveSyncRecords(mutations),
    lastSyncAt: latestMutation?.serverUpdatedAt ?? null,
    compactionFloorCursor: null,
  }
}

function pruneUsageWindow(usage: ServerUserUsage, now: Date): ServerUserUsage {
  const currentDay = getCurrentUsageDay(now)
  const currentMonth = getCurrentUsageMonth(now)
  const recentWindow = now.getTime() - 60_000
  const timestamps = usage.recentRequestTimestamps.filter((value) => {
    const time = Date.parse(value)
    return Number.isFinite(time) && time >= recentWindow
  })

  const nextUsage: ServerUserUsage = usage.taskUsageMonth !== currentMonth
    ? {
        ...usage,
        taskUsageMonth: currentMonth,
        monthlyTaskRequests: {},
      }
    : usage

  if (nextUsage.usageDay !== currentDay) {
    return {
      ...nextUsage,
      usageDay: currentDay,
      requestsToday: 0,
      charactersToday: 0,
      recentRequestTimestamps: timestamps,
    }
  }

  return {
    ...nextUsage,
    recentRequestTimestamps: timestamps,
  }
}

function normalizeUsageEventMetadata(metadata: ServerUsageEventMetadata | undefined): ServerUsageEventMetadata {
  if (!metadata) return {}
  return ServerUsageEventMetadataSchema.parse(metadata)
}

function calculateNearestRankPercentile(samples: number[], percentile: number): number | null {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((left, right) => left - right)
  const rank = Math.max(0, Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1))
  return sorted[rank] ?? null
}

const COST_ESTIMATE_REGISTRY_VERSION = "internal_deterministic_v1" as const

const ESTIMATED_COST_BUCKET_USD_PER_1K_CHARS: Record<AstraCostBucket | "unknown", number> = {
  low: 0.00008,
  medium: 0.00025,
  high: 0.0008,
  long_running: 0.0012,
  unknown: 0.0002,
}

const ESTIMATED_SERVICE_MODE_USD_PER_1K_CHARS: Record<ServiceMode, number> = {
  automatic: 0.00035,
  fast: 0.00018,
  balanced: 0.0003,
  best_quality: 0.00055,
}

const ESTIMATED_TASK_MULTIPLIER: Record<AstraTaskClass | "unknown", number> = {
  instant_phrase: 0.7,
  paragraph_understanding: 1,
  context_explanation: 1.1,
  deep_reading: 1.4,
  video_summary: 1.5,
  review_card: 0.65,
  writing_assist: 1.15,
  digest: 1.25,
  unknown: 1,
}

const ESTIMATED_PROVIDER_ROUTE_MULTIPLIER: Record<ManagedProviderRoute, number> = {
  direct: 1,
  openrouter: 1.15,
}

const ESTIMATED_REQUEST_OVERHEAD_USD = 0.00002

function roundEstimatedSpend(value: number): number {
  return Number(Math.max(0, value).toFixed(6))
}

function estimateUsageEventSpendUsd(event: ServerUsageEvent): number {
  const costBucket = event.costBucket ?? "unknown"
  const taskClass = event.taskClass ?? "unknown"
  const providerRoute = event.providerRoute ?? "direct"
  const charsInThousands = Math.max(0, event.characterCount) / 1000
  const requestCount = Math.max(0, event.requestCount)
  return roundEstimatedSpend(
    charsInThousands
    * (ESTIMATED_COST_BUCKET_USD_PER_1K_CHARS[costBucket] + ESTIMATED_SERVICE_MODE_USD_PER_1K_CHARS[event.serviceMode])
    * ESTIMATED_TASK_MULTIPLIER[taskClass]
    * ESTIMATED_PROVIDER_ROUTE_MULTIPLIER[providerRoute]
    + requestCount * ESTIMATED_REQUEST_OVERHEAD_USD,
  )
}

function getUsageEventUtcDate(event: ServerUsageEvent): string | null {
  const time = Date.parse(event.timestamp)
  if (!Number.isFinite(time)) return null
  return new Date(time).toISOString().slice(0, 10)
}

function getPreviousUtcDate(date: string): string {
  const previous = new Date(`${date}T00:00:00.000Z`)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous.toISOString().slice(0, 10)
}

function deriveCostSpikeStatus(currentSpend: number, previousSpend: number, spikeRatio: number | null): CostUsageSpikeStatus {
  if (currentSpend >= 0.02 && (previousSpend === 0 || (spikeRatio ?? 0) >= 3)) return "spike"
  if (currentSpend >= 0.01 && (previousSpend === 0 || (spikeRatio ?? 0) >= 2)) return "watch"
  return "none"
}

function deriveCostRiskLevel(dailySpend: number, spikeStatus: CostUsageSpikeStatus): CostUsageRiskLevel {
  if (dailySpend >= 0.05 || spikeStatus === "spike") return "high"
  if (dailySpend >= 0.01 || spikeStatus === "watch") return "watch"
  return "low"
}

function classifyOpsUserUsage(usage: ServerUserUsage): OpsUserUsageCategory {
  if (usage.requestsToday >= 500 || usage.charactersToday >= 150_000 || usage.recentEvents.length >= 10) return "extreme"
  if (usage.requestsToday >= 100 || usage.charactersToday >= 50_000 || usage.recentEvents.length >= 7) return "heavy"
  if (usage.requestsToday >= 10 || usage.charactersToday >= 5_000 || usage.recentEvents.length >= 3) return "normal"
  return "light"
}

function assertUsageCapacity(user: ServerUserRecord, usage: ServerUserUsage, characterCount: number, taskClass?: AstraTaskClass) {
  if (user.subscriptionStatus !== "active") {
    throw new AstraError("CONFIG_MISSING", `Subscription is not active: ${user.subscriptionStatus}.`)
  }

  if (usage.recentRequestTimestamps.length >= user.limits.requestsPerMinute) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", "Rate limit exceeded for the current minute.")
  }

  if (usage.requestsToday + 1 > user.limits.dailyRequests) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", "Daily request quota exceeded.")
  }

  if (usage.charactersToday + characterCount > user.limits.dailyCharacters) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", "Daily character quota exceeded.")
  }

  if (taskClass && shouldMeterTask(taskClass)) {
    const entitlement = getPlanEntitlement(user.plan, taskClass)
    if (entitlement.monthlyAllowance !== null) {
      const used = usage.monthlyTaskRequests[taskClass] ?? 0
      if (used + 1 > entitlement.monthlyAllowance) {
        throw new AstraError(
          "QUOTA_EXCEEDED",
          `${taskClass} monthly allowance exceeded for the ${user.plan} plan.`,
        )
      }
    }
  }
}

function coerceNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function capitalize(value: string): string {
  return value.length ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value
}

function buildDefaultDeviceLabel(device: DeviceMetadataInput): string {
  const browser = coerceNullableText(device.browserFamily)
  const platform = coerceNullableText(device.platform)
  if (browser && platform) {
    return `${capitalize(browser)} on ${capitalize(platform)}`
  }
  if (browser) return capitalize(browser)
  if (platform) return capitalize(platform)
  return device.appKind?.trim() === "web" ? "Astra web" : "Astra extension"
}

function buildCursorMap(value: string | null = null): Record<SyncCollection, string | null> {
  return {
    config: value,
    vocabulary: value,
    review_schedule: value,
    reading_history: value,
    study_progress: value,
  }
}

function parseCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  const parsed = Number(cursor)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function isSessionExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false
  const time = Date.parse(expiresAt)
  return Number.isFinite(time) && time <= now.getTime()
}

export async function loadAuthoritativeUserDatabase(
  env: RelayEnv,
  options: {
    seedIfMissing?: boolean
    persistNormalized?: boolean
  } = {},
): Promise<ServerUserDatabase> {
  const seedIfMissing = options.seedIfMissing ?? true
  const persistNormalized = options.persistNormalized ?? true

  try {
    const raw = await readFile(env.userDbPath, "utf8")
    const parsedJson = JSON.parse(raw)
    const parsed = await migrateDatabase(parsedJson, env, {
      seedOnInvalid: seedIfMissing,
    })

    if (persistNormalized) {
      const rawNormalized = JSON.stringify(parsedJson)
      const parsedNormalized = JSON.stringify(parsed)
      if (parsedNormalized !== rawNormalized) {
        await saveAuthoritativeUserDatabase(env, parsed)
      }
    }

    return parsed
  } catch (error) {
    if (seedIfMissing) {
      const seed = await createSeedDatabase(env)
      await saveAuthoritativeUserDatabase(env, seed)
      return seed
    }

    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to load authoritative user database at ${env.userDbPath}: ${detail}`)
  }
}

export async function saveAuthoritativeUserDatabase(
  env: RelayEnv,
  db: ServerUserDatabase,
): Promise<void> {
  await mkdir(dirname(env.userDbPath), { recursive: true })
  await writeFile(env.userDbPath, JSON.stringify(db, null, 2))
}

const OPS_USER_LOOKUP_RESULT_LIMIT = 1
const OPS_USER_LOOKUP_TASK_SUMMARY_LIMIT = 6
const OPS_USER_LOOKUP_EXCLUDED_FIELDS = [
  "email",
  "billingEmail",
  "deviceId",
  "sessionId",
  "provider",
  "model",
  "prompt",
  "rawText",
  "rawQuery",
  "fullUrl",
]

export class FileUserStore {
  private cache: ServerUserDatabase | null = null
  private readonly cloudflareShadow

  constructor(private readonly env: RelayEnv) {
    this.cloudflareShadow = createRelayCloudflareShadowBridge(env)
  }

  private async load(): Promise<ServerUserDatabase> {
    if (this.cache) return this.cache

    const parsed = await loadAuthoritativeUserDatabase(this.env)
    this.cache = parsed
    return parsed
  }

  private async save(db: ServerUserDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeUserDatabase(this.env, db)
  }

  private refreshUserUsage(db: ServerUserDatabase, email: string, now: Date): { user: ServerUserRecord; changed: boolean } | null {
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]
    const nextUsage = pruneUsageWindow(user.usage, now)
    const changed = JSON.stringify(nextUsage) !== JSON.stringify(user.usage)
    if (changed) {
      db.users[userIndex] = { ...user, usage: nextUsage }
    }

    return { user: db.users[userIndex], changed }
  }

  async lookupOpsUser(query: string, now: Date = new Date(), options: { limit?: number } = {}): Promise<OpsUserLookupSummary | null> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return null

    const db = await this.load()
    const lowerQuery = normalizedQuery.toLowerCase()
    const queryType: OpsUserLookupQueryType = normalizedQuery.includes("@")
      ? "email"
      : /^[a-f0-9]{64}$/i.test(normalizedQuery)
        ? "email_hash"
        : lowerQuery.startsWith("usr_")
          ? "user_id"
          : "email"
    const userIndex = db.users.findIndex((user) => {
      if (queryType === "user_id") return user.id === normalizedQuery
      if (queryType === "email_hash") return buildEmailHash(user.email) === lowerQuery
      return user.email.trim().toLowerCase() === lowerQuery
    })
    if (userIndex === -1) return null

    const user = db.users[userIndex]!
    const devices = db.devices.filter((device) => device.email === user.email || device.userId === user.id)
    const sessions = db.sessions.filter((session) => session.email === user.email || session.userId === user.id)
    const taskBuckets = new Map<string, OpsUserLookupTaskSummary>()
    const latencySamplesByTask = new Map<string, number[]>()

    for (const event of user.usage.recentEvents) {
      const taskClass = event.taskClass ?? "unknown"
      const bucket = taskBuckets.get(taskClass) ?? {
        taskClass,
        eventCount: 0,
        successCount: 0,
        failureCount: 0,
        fallbackCount: 0,
        latencySampleCount: 0,
        latencyP95Ms: null,
      }
      bucket.eventCount += 1
      if (event.success === false) bucket.failureCount += 1
      else bucket.successCount += 1
      if (event.fallbackUsed === true) bucket.fallbackCount += 1
      if (typeof event.durationMs === "number" && Number.isFinite(event.durationMs)) {
        const sample = Math.max(0, Math.round(event.durationMs))
        const samples = latencySamplesByTask.get(taskClass) ?? []
        samples.push(sample)
        latencySamplesByTask.set(taskClass, samples)
        bucket.latencySampleCount += 1
      }
      taskBuckets.set(taskClass, bucket)
    }

    const requestedLimit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit ?? OPS_USER_LOOKUP_RESULT_LIMIT)) : OPS_USER_LOOKUP_RESULT_LIMIT
    const resultLimit = Math.min(OPS_USER_LOOKUP_RESULT_LIMIT, requestedLimit)
    const recentTaskSummary = [...taskBuckets.entries()].map(([taskClass, bucket]) => ({
      ...bucket,
      latencyP95Ms: calculateNearestRankPercentile(latencySamplesByTask.get(taskClass) ?? [], 0.95),
    })).sort((left, right) =>
      right.eventCount - left.eventCount
      || left.taskClass.localeCompare(right.taskClass),
    ).slice(0, OPS_USER_LOOKUP_TASK_SUMMARY_LIMIT)

    return {
      schema: "astra-ops-user-lookup.v1",
      generatedAt: now.toISOString(),
      queryType,
      resultWindow: {
        mode: "exact_lookup",
        limit: resultLimit,
        cursor: null,
        nextCursor: null,
        returnedCount: 1,
        totalMatched: 1,
        hasMore: false,
      },
      snapshotBoundary: {
        metadataOnly: true,
        contentIncluded: false,
        rawQueryIncluded: false,
        exportAvailable: false,
        recentTaskSummaryLimit: OPS_USER_LOOKUP_TASK_SUMMARY_LIMIT,
        excludedFields: OPS_USER_LOOKUP_EXCLUDED_FIELDS,
      },
      user: {
        userId: user.id,
        emailHash: buildEmailHash(user.email),
        createdAt: user.createdAt,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        identityMode: user.identityMode,
        providerEntitlementCount: user.providerEntitlements.length,
        limits: user.limits,
        usage: {
          usageDay: user.usage.usageDay,
          requestsToday: user.usage.requestsToday,
          charactersToday: user.usage.charactersToday,
          totalRequests: user.usage.totalRequests,
          totalCharacters: user.usage.totalCharacters,
          lastRequestAt: user.usage.lastRequestAt,
          recentEventCount: user.usage.recentEvents.length,
          usageCategory: classifyOpsUserUsage(user.usage),
        },
        devices: {
          activeCount: devices.filter((device) => device.status === "active").length,
          revokedCount: devices.filter((device) => device.status === "revoked").length,
        },
        sessions: {
          activeCount: sessions.filter((session) => session.status === "active").length,
          revokedCount: sessions.filter((session) => session.status === "revoked").length,
        },
        recentTaskSummary,
      },
    }
  }

  async summarizeProviderHealth(now: Date = new Date()): Promise<ProviderHealthSummary> {
    const db = await this.load()
    const buckets = new Map<string, ProviderHealthSummaryBucket>()
    const latencySamplesByKey = new Map<string, number[]>()
    let totalEvents = 0
    let totalRequests = 0
    let totalCharacters = 0

    const healthStatusRank: Record<ProviderHealthStatus, number> = {
      incident: 0,
      watch: 1,
      healthy: 2,
    }

    const deriveHealthStatus = (bucket: Pick<ProviderHealthSummaryBucket, "eventCount" | "failureCount" | "fallbackCount">): ProviderHealthStatus => {
      if (bucket.eventCount === 0) return "healthy"
      const failureRate = bucket.failureCount / bucket.eventCount
      const fallbackRate = bucket.fallbackCount / bucket.eventCount
      if (failureRate >= 0.25 || fallbackRate >= 0.5) return "incident"
      if (failureRate > 0 || fallbackRate > 0) return "watch"
      return "healthy"
    }

    for (const user of db.users) {
      for (const event of user.usage.recentEvents) {
        const provider = event.provider
        const model = event.model?.trim() || "unknown"
        const serviceMode = event.serviceMode
        const taskClass = event.taskClass ?? "unknown"
        const key = `${provider}:${model}:${serviceMode}:${taskClass}`
        const bucket = buckets.get(key) ?? {
          provider,
          model,
          serviceMode,
          taskClass,
          eventCount: 0,
          requestCount: 0,
          characterCount: 0,
          successCount: 0,
          failureCount: 0,
          fallbackCount: 0,
          successRate: null,
          fallbackRate: null,
          latencySampleCount: 0,
          latencyP50Ms: null,
          latencyP95Ms: null,
          healthStatus: "healthy",
        }

        bucket.eventCount += 1
        bucket.requestCount += event.requestCount
        bucket.characterCount += event.characterCount
        if (event.success === false) {
          bucket.failureCount += 1
        } else {
          bucket.successCount += 1
        }
        if (event.fallbackUsed === true) {
          bucket.fallbackCount += 1
        }
        if (typeof event.durationMs === "number" && Number.isFinite(event.durationMs)) {
          const sample = Math.max(0, Math.round(event.durationMs))
          const samples = latencySamplesByKey.get(key) ?? []
          samples.push(sample)
          latencySamplesByKey.set(key, samples)
          bucket.latencySampleCount += 1
        }

        buckets.set(key, bucket)
        totalEvents += 1
        totalRequests += event.requestCount
        totalCharacters += event.characterCount
      }
    }

    return {
      schema: "astra-provider-health-summary.v1",
      generatedAt: now.toISOString(),
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents,
      totalRequests,
      totalCharacters,
      buckets: [...buckets.entries()]
        .map(([key, bucket]) => {
          const samples = latencySamplesByKey.get(key) ?? []
          return {
            ...bucket,
            successRate: bucket.eventCount > 0 ? Number((bucket.successCount / bucket.eventCount).toFixed(4)) : null,
            fallbackRate: bucket.eventCount > 0 ? Number((bucket.fallbackCount / bucket.eventCount).toFixed(4)) : null,
            latencyP50Ms: calculateNearestRankPercentile(samples, 0.5),
            latencyP95Ms: calculateNearestRankPercentile(samples, 0.95),
            healthStatus: deriveHealthStatus(bucket),
          }
        })
        .sort((left, right) =>
          healthStatusRank[left.healthStatus] - healthStatusRank[right.healthStatus]
          || right.eventCount - left.eventCount
          || left.provider.localeCompare(right.provider)
          || left.model.localeCompare(right.model)
          || left.serviceMode.localeCompare(right.serviceMode)
          || left.taskClass.localeCompare(right.taskClass),
        ),
    }
  }

  async summarizeRecentUsageCost(now: Date = new Date()): Promise<CostUsageSummary> {
    const db = await this.load()
    const buckets = new Map<string, CostUsageSummaryBucket>()
    const serviceModeBuckets = new Map<ServiceMode, CostUsageServiceModeSummary>()
    const cacheStatusBuckets = new Map<string, CostUsageCacheStatusSummary>()
    const latencySamplesByServiceMode = new Map<ServiceMode, number[]>()
    const dailyEstimatedSpend = new Map<string, number>()
    let latestEventDate: string | null = null
    let totalEvents = 0
    let totalRequests = 0
    let totalCharacters = 0
    let totalEstimatedSpendUsd = 0

    for (const user of db.users) {
      for (const event of user.usage.recentEvents) {
        const tier = event.tier ?? (user.plan === "free" || user.plan === "trial" || user.plan === "pro" ? user.plan : "unknown")
        const taskClass = event.taskClass ?? "unknown"
        const costBucket = event.costBucket ?? "unknown"
        const key = `${tier}:${taskClass}:${costBucket}`
        const bucket = buckets.get(key) ?? {
          tier,
          taskClass,
          costBucket,
          eventCount: 0,
          requestCount: 0,
          characterCount: 0,
          successCount: 0,
          failureCount: 0,
          fallbackCount: 0,
          estimatedSpendUsd: 0,
        }
        const serviceModeBucket = serviceModeBuckets.get(event.serviceMode) ?? {
          serviceMode: event.serviceMode,
          eventCount: 0,
          requestCount: 0,
          characterCount: 0,
          successCount: 0,
          failureCount: 0,
          fallbackCount: 0,
          latencySampleCount: 0,
          latencyP50Ms: null,
          latencyP95Ms: null,
          estimatedSpendUsd: 0,
        }
        const cacheStatus = event.cacheStatus ?? "unknown"
        const cacheStatusBucket = cacheStatusBuckets.get(cacheStatus) ?? {
          cacheStatus,
          eventCount: 0,
          requestCount: 0,
          characterCount: 0,
          share: 0,
          estimatedSpendUsd: 0,
        }

        const estimatedSpendUsd = estimateUsageEventSpendUsd(event)
        const eventDate = getUsageEventUtcDate(event)

        bucket.eventCount += 1
        bucket.requestCount += event.requestCount
        bucket.characterCount += event.characterCount
        bucket.estimatedSpendUsd = roundEstimatedSpend(bucket.estimatedSpendUsd + estimatedSpendUsd)
        serviceModeBucket.eventCount += 1
        serviceModeBucket.requestCount += event.requestCount
        serviceModeBucket.characterCount += event.characterCount
        serviceModeBucket.estimatedSpendUsd = roundEstimatedSpend(serviceModeBucket.estimatedSpendUsd + estimatedSpendUsd)
        cacheStatusBucket.eventCount += 1
        cacheStatusBucket.requestCount += event.requestCount
        cacheStatusBucket.characterCount += event.characterCount
        cacheStatusBucket.estimatedSpendUsd = roundEstimatedSpend(cacheStatusBucket.estimatedSpendUsd + estimatedSpendUsd)
        if (event.success === false) {
          bucket.failureCount += 1
          serviceModeBucket.failureCount += 1
        } else {
          bucket.successCount += 1
          serviceModeBucket.successCount += 1
        }
        if (event.fallbackUsed || (event.fallbackReason && event.fallbackReason !== "none")) {
          bucket.fallbackCount += 1
          serviceModeBucket.fallbackCount += 1
        }
        if (typeof event.durationMs === "number" && Number.isFinite(event.durationMs)) {
          const sample = Math.max(0, Math.round(event.durationMs))
          const samples = latencySamplesByServiceMode.get(event.serviceMode) ?? []
          samples.push(sample)
          latencySamplesByServiceMode.set(event.serviceMode, samples)
          serviceModeBucket.latencySampleCount += 1
        }

        buckets.set(key, bucket)
        serviceModeBuckets.set(event.serviceMode, serviceModeBucket)
        cacheStatusBuckets.set(cacheStatus, cacheStatusBucket)
        totalEvents += 1
        totalRequests += event.requestCount
        totalCharacters += event.characterCount
        totalEstimatedSpendUsd = roundEstimatedSpend(totalEstimatedSpendUsd + estimatedSpendUsd)
        if (eventDate) {
          dailyEstimatedSpend.set(eventDate, roundEstimatedSpend((dailyEstimatedSpend.get(eventDate) ?? 0) + estimatedSpendUsd))
          if (!latestEventDate || eventDate > latestEventDate) {
            latestEventDate = eventDate
          }
        }
      }
    }

    const byCacheStatus = [...cacheStatusBuckets.values()]
      .map((bucket) => ({
        ...bucket,
        share: totalEvents > 0 ? Number((bucket.eventCount / totalEvents).toFixed(4)) : 0,
      }))
      .sort((left, right) => right.eventCount - left.eventCount || left.cacheStatus.localeCompare(right.cacheStatus))
    const cacheableEvents = byCacheStatus
      .filter((bucket) => bucket.cacheStatus === "hit" || bucket.cacheStatus === "partial" || bucket.cacheStatus === "miss")
      .reduce((sum, bucket) => sum + bucket.eventCount, 0)
    const cacheHitEvents = byCacheStatus.find((bucket) => bucket.cacheStatus === "hit")?.eventCount ?? 0
    const activeSpendDate = latestEventDate
    const previousSpendDate = activeSpendDate ? getPreviousUtcDate(activeSpendDate) : null
    const dailyEstimatedSpendUsd = activeSpendDate ? roundEstimatedSpend(dailyEstimatedSpend.get(activeSpendDate) ?? 0) : 0
    const previousDailyEstimatedSpendUsd = previousSpendDate ? roundEstimatedSpend(dailyEstimatedSpend.get(previousSpendDate) ?? 0) : 0
    const spikeRatio = previousDailyEstimatedSpendUsd > 0
      ? Number((dailyEstimatedSpendUsd / previousDailyEstimatedSpendUsd).toFixed(4))
      : dailyEstimatedSpendUsd > 0
        ? null
        : 0
    const spikeStatus = deriveCostSpikeStatus(dailyEstimatedSpendUsd, previousDailyEstimatedSpendUsd, spikeRatio)

    return {
      schema: "astra-cost-usage-summary.v1",
      generatedAt: now.toISOString(),
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents,
      totalRequests,
      totalCharacters,
      totalEstimatedSpendUsd,
      estimateRegistry: COST_ESTIMATE_REGISTRY_VERSION,
      cacheHitRate: cacheableEvents > 0 ? Number((cacheHitEvents / cacheableEvents).toFixed(4)) : null,
      dailyEstimate: {
        date: activeSpendDate,
        estimatedSpendUsd: dailyEstimatedSpendUsd,
        previousDate: previousSpendDate,
        previousEstimatedSpendUsd: previousDailyEstimatedSpendUsd,
        spikeRatio,
        spikeStatus,
        riskLevel: deriveCostRiskLevel(dailyEstimatedSpendUsd, spikeStatus),
      },
      buckets: [...buckets.values()].sort((left, right) =>
        left.tier.localeCompare(right.tier)
        || left.taskClass.localeCompare(right.taskClass)
        || left.costBucket.localeCompare(right.costBucket),
      ),
      byServiceMode: [...serviceModeBuckets.values()]
        .map((bucket) => {
          const samples = latencySamplesByServiceMode.get(bucket.serviceMode) ?? []
          return {
            ...bucket,
            latencyP50Ms: calculateNearestRankPercentile(samples, 0.5),
            latencyP95Ms: calculateNearestRankPercentile(samples, 0.95),
          }
        })
        .sort((left, right) => left.serviceMode.localeCompare(right.serviceMode)),
      byCacheStatus,
    }
  }

  private upsertDevice(
    db: ServerUserDatabase,
    user: ServerUserRecord,
    identityMode: IdentityMode,
    device: DeviceMetadataInput,
    now: Date,
    options: { reactivate?: boolean } = {},
  ): ServerDeviceRecord {
    const timestamp = now.toISOString()
    const existingIndex = db.devices.findIndex((record) =>
      record.email === user.email && record.deviceId === device.deviceId,
    )

    const label = coerceNullableText(device.label) ?? (existingIndex >= 0 ? db.devices[existingIndex]!.label : buildDefaultDeviceLabel(device))
    const platform = coerceNullableText(device.platform)
    const browserFamily = coerceNullableText(device.browserFamily)
    const appKind = coerceNullableText(device.appKind) ?? (existingIndex >= 0 ? db.devices[existingIndex]!.appKind : "extension")
    const appVersion = coerceNullableText(device.appVersion)

    if (existingIndex >= 0) {
      const existing = db.devices[existingIndex]!
      const status: DeviceStatus = options.reactivate ? "active" : existing.status
      const next: ServerDeviceRecord = {
        ...existing,
        identityMode,
        label,
        platform: platform ?? existing.platform,
        browserFamily: browserFamily ?? existing.browserFamily,
        appKind,
        appVersion: appVersion ?? existing.appVersion,
        expoPushToken: existing.expoPushToken ?? null,
        expoPushTokenUpdatedAt: existing.expoPushTokenUpdatedAt ?? null,
        expoPushTokenPlatform: existing.expoPushTokenPlatform ?? null,
        lastSeenAt: timestamp,
        updatedAt: timestamp,
        status,
        revokedAt: status === "revoked" ? existing.revokedAt : null,
      }
      db.devices[existingIndex] = next
      return next
    }

    const record: ServerDeviceRecord = {
      deviceId: device.deviceId,
      userId: user.id,
      email: user.email,
      identityMode,
      label,
      platform,
      browserFamily,
      appKind,
      appVersion,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastSyncAt: null,
      status: options.reactivate ? "active" : "active",
      expoPushToken: null,
      expoPushTokenUpdatedAt: null,
      expoPushTokenPlatform: null,
      updatedAt: timestamp,
      revokedAt: null,
    }
    db.devices.push(record)
    return record
  }

  private upsertMirroredDevice(
    db: ServerUserDatabase,
    device: ServerDeviceRecord,
  ): ServerDeviceRecord {
    const existingIndex = db.devices.findIndex((record) => record.deviceId === device.deviceId)
    const next = ServerDeviceRecordSchema.parse(device)
    if (existingIndex >= 0) {
      db.devices[existingIndex] = next
      return next
    }

    db.devices.push(next)
    return next
  }

  private upsertMirroredSession(
    db: ServerUserDatabase,
    session: ServerSessionRecord,
  ): ServerSessionRecord {
    const existingIndex = db.sessions.findIndex((record) => record.sessionId === session.sessionId)
    const next = ServerSessionRecordSchema.parse(session)
    if (existingIndex >= 0) {
      db.sessions[existingIndex] = next
      return next
    }

    db.sessions.push(next)
    return next
  }

  private nextSyncCursor(db: ServerUserDatabase): string {
    db.nextSyncCursor += 1
    return String(db.nextSyncCursor)
  }

  private getLatestCursor(db: ServerUserDatabase, email: string, collection: SyncCollection): string | null {
    const latest = db.syncMutations
      .filter((mutation) => mutation.email === email && mutation.collection === collection)
      .sort((a, b) => parseCursor(b.cursor) - parseCursor(a.cursor))[0]
    return latest?.cursor ?? null
  }

  async findUserByEmail(email: string): Promise<ServerUserRecord | null> {
    const db = await this.load()
    return db.users.find((user) => user.email === email.trim()) ?? null
  }

  async listWeeklyDigestRecipients(limit = 50): Promise<Array<{ userId: string; email: string }>> {
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 200))
    if (boundedLimit === 0) return []
    const db = await this.load()
    return db.users
      .filter((user) => user.identityMode === "authenticated" && user.syncPreferences.weekly_digest === true)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.email.localeCompare(right.email))
      .slice(0, boundedLimit)
      .map((user) => ({ userId: user.id, email: user.email }))
  }

  async listWeeklyDigestPushRecipients(limit = 50): Promise<Array<{ userId: string; email: string; deviceId: string; expoPushToken: string }>> {
    const boundedLimit = Math.max(0, Math.min(Math.floor(limit), 200))
    if (boundedLimit === 0) return []
    const db = await this.load()
    const optedInUsers = new Map(db.users
      .filter((user) => user.identityMode === "authenticated" && user.syncPreferences.weekly_digest === true)
      .map((user) => [user.id, user]))

    return db.devices
      .filter((device) => {
        const user = optedInUsers.get(device.userId)
        return Boolean(
          user
          && device.identityMode === "authenticated"
          && device.status === "active"
          && device.expoPushToken,
        )
      })
      .sort((left, right) => left.firstSeenAt.localeCompare(right.firstSeenAt) || left.deviceId.localeCompare(right.deviceId))
      .slice(0, boundedLimit)
      .map((device) => ({
        userId: device.userId,
        email: optedInUsers.get(device.userId)!.email,
        deviceId: device.deviceId,
        expoPushToken: device.expoPushToken!,
      }))
  }

  async findAnonymousUserByInstallId(installId: string): Promise<ServerUserRecord | null> {
    const db = await this.load()
    return db.users.find(
      (user) => user.identityMode === "anonymous" && user.installId === installId,
    ) ?? null
  }

  async createAnonymousUser(installId?: string): Promise<ServerUserRecord> {
    if (installId) {
      const existing = await this.findAnonymousUserByInstallId(installId)
      if (existing) return existing
    }

    const db = await this.load()
    const identity = await buildAstraAnonymousIdentity({
      installId,
      entropy: installId ? undefined : randomUUID(),
    })

    const plan = "free" as const
    const record: ServerUserRecord = {
      id: identity.userId,
      email: identity.email,
      billingEmail: identity.email,
      createdAt: new Date().toISOString(),
      passwordHash: await hashAstraCredentialSecret(identity.placeholderPassword),
      plan,
      subscriptionStatus: "active",
      providerEntitlements: defaultEntitlements(plan),
      limits: defaultLimits(plan, this.env),
      usage: createEmptyUsage(),
      identityMode: "anonymous",
      syncPreferences: createDefaultSyncPreferences(),
      ...(installId ? { installId } : {}),
    }

    db.users.push(record)
    await this.save(db)
    return record
  }

  async redeemOAuthIdentity(identity: {
    provider: "apple" | "google"
    subject: string
    email?: string | null
    emailVerified?: boolean
  }): Promise<ServerUserRecord> {
    const db = await this.load()
    const provider = identity.provider
    const subject = identity.subject.trim()
    const normalizedEmail = identity.email?.trim().toLowerCase() || null
    const emailVerified = Boolean(identity.emailVerified)
    const timestamp = new Date().toISOString()

    const existingIdentityIndex = db.oauthIdentities.findIndex((record) =>
      record.provider === provider && record.subject === subject,
    )
    if (existingIdentityIndex >= 0) {
      const existingIdentity = db.oauthIdentities[existingIdentityIndex]!
      db.oauthIdentities[existingIdentityIndex] = {
        ...existingIdentity,
        email: normalizedEmail ?? existingIdentity.email,
        emailVerified: existingIdentity.emailVerified || emailVerified,
        updatedAt: timestamp,
        lastRedeemedAt: timestamp,
      }
      const existingUser = db.users.find((user) => user.id === existingIdentity.userId) ?? null
      if (existingUser) {
        await this.save(db)
        return existingUser
      }
    }

    const normalizedEmailInUse = normalizedEmail
      ? db.users.some((record) => record.email.toLowerCase() === normalizedEmail)
      : false
    const oauthEmail = normalizedEmail && !normalizedEmailInUse
      ? normalizedEmail
      : buildOAuthUserEmail(provider, subject)
    let user = db.users.find((record) => record.email.toLowerCase() === oauthEmail) ?? null

    if (!user) {
      const plan = "free" as const
      user = {
        id: buildUserId(oauthEmail),
        email: oauthEmail,
        billingEmail: oauthEmail,
        createdAt: timestamp,
        passwordHash: await hashAstraCredentialSecret(`oauth-unusable-${randomUUID()}`),
        plan,
        subscriptionStatus: "active",
        providerEntitlements: defaultEntitlements(plan),
        limits: defaultLimits(plan, this.env),
        usage: createEmptyUsage(),
        identityMode: "authenticated",
        syncPreferences: createDefaultSyncPreferences(),
      }
      db.users.push(user)
    }

    const record: ServerOAuthIdentityRecord = {
      provider,
      subject,
      userId: user.id,
      email: normalizedEmail,
      emailVerified,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastRedeemedAt: timestamp,
    }
    if (existingIdentityIndex >= 0) db.oauthIdentities[existingIdentityIndex] = record
    else db.oauthIdentities.push(record)
    await this.save(db)
    return user
  }

  async validateCredentials(email: string, password: string): Promise<ServerUserRecord | null> {
    const user = await this.findUserByEmail(email)
    if (!user) return null
    const valid = await verifyAstraCredentialSecret(password, user.passwordHash)
    if (!valid) return null
    await this.cloudflareShadow?.mirrorUserCredential(user)
    return user
  }

  async issueBoundSession(params: {
    user: ServerUserRecord
    identityMode?: IdentityMode
    device: DeviceMetadataInput
    now?: Date
  }): Promise<AuthenticatedSession> {
    const db = await this.load()
    const now = params.now ?? new Date()
    const timestamp = now.toISOString()
    const identityMode = params.identityMode ?? params.user.identityMode
    const device = this.upsertDevice(db, params.user, identityMode, params.device, now, {
      reactivate: identityMode === "authenticated",
    })

    const sessionRecord: ServerSessionRecord = {
      sessionId: randomUUID(),
      userId: params.user.id,
      email: params.user.email,
      deviceId: device.deviceId,
      identityMode,
      issuedAt: timestamp,
      expiresAt: this.env.sessionTtlMs > 0 ? new Date(now.getTime() + this.env.sessionTtlMs).toISOString() : null,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      lastVerifiedAt: timestamp,
      status: "active",
      revokedAt: null,
    }

    db.sessions.push(sessionRecord)
    await this.save(db)

    const issued = await issueSession(params.user, sessionRecord, this.env)
    await this.cloudflareShadow?.mirrorIssuedSession({
      user: params.user,
      device,
      session: sessionRecord,
      token: issued.token,
    })

    return issued
  }

  async getSessionContext(email: string, sessionId: string): Promise<SessionContext | null> {
    const db = await this.load()
    const refreshed = this.refreshUserUsage(db, email, new Date())
    if (!refreshed) return null

    const session = db.sessions.find((record) => record.email === email.trim() && record.sessionId === sessionId) ?? null
    if (!session) {
      if (refreshed.changed) await this.save(db)
      return null
    }

    const device = db.devices.find((record) => record.email === email.trim() && record.deviceId === session.deviceId) ?? null
    if (refreshed.changed) await this.save(db)

    const context = {
      user: refreshed.user,
      session,
      device,
    }
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, new Date().toISOString())
    }
    await this.cloudflareShadow?.compareSessionLookup(context)
    return context
  }

  async touchSession(
    sessionId: string,
    params: {
      seenAt?: Date
      syncAt?: Date
    } = {},
  ): Promise<void> {
    const db = await this.load()
    const sessionIndex = db.sessions.findIndex((record) => record.sessionId === sessionId)
    if (sessionIndex === -1) return

    const session = db.sessions[sessionIndex]!
    const seenAt = params.seenAt?.toISOString()
    const syncAt = params.syncAt?.toISOString()
    const nextSession: ServerSessionRecord = {
      ...session,
      lastSeenAt: seenAt ?? session.lastSeenAt,
      lastVerifiedAt: seenAt ?? session.lastVerifiedAt,
    }
    db.sessions[sessionIndex] = nextSession

    const deviceIndex = db.devices.findIndex((record) => record.email === session.email && record.deviceId === session.deviceId)
    if (deviceIndex >= 0) {
      const device = db.devices[deviceIndex]!
      db.devices[deviceIndex] = {
        ...device,
        lastSeenAt: seenAt ?? device.lastSeenAt,
        lastSyncAt: syncAt ?? device.lastSyncAt,
        updatedAt: seenAt ?? syncAt ?? device.updatedAt,
      }
    }

    await this.save(db)

    const user = db.users.find((record) => record.id === session.userId) ?? null
    const nextDevice = db.devices.find((record) => record.email === session.email && record.deviceId === session.deviceId) ?? null
    if (user) {
      await this.cloudflareShadow?.mirrorTouchedSession({
        user,
        device: nextDevice,
        session: nextSession,
      })
    }
  }

  async revokeSession(email: string, sessionId: string, now: Date = new Date()): Promise<boolean> {
    const db = await this.load()
    const sessionIndex = db.sessions.findIndex((record) =>
      record.email === email.trim() && record.sessionId === sessionId,
    )
    if (sessionIndex === -1) return false

    const timestamp = now.toISOString()
    db.sessions[sessionIndex] = {
      ...db.sessions[sessionIndex]!,
      status: "revoked",
      revokedAt: timestamp,
      lastVerifiedAt: timestamp,
    }
    await this.save(db)

    const user = db.users.find((record) => record.email === email.trim()) ?? null
    if (user) {
      await this.cloudflareShadow?.mirrorRevokedSession({
        user,
        session: db.sessions[sessionIndex]!,
      })
    }

    return true
  }

  async deleteAccountFoundation(
    email: string,
    now: Date = new Date(),
  ): Promise<{
    found: boolean
    userId: string | null
    deletedAt: string
    removedUserCount: number
    removedDeviceCount: number
    removedSessionCount: number
    removedSyncMutationCount: number
    removedWeeklyDigestCount: number
    removedMobileRetentionEventCount: number
  }> {
    const db = await this.load()
    const normalizedEmail = email.trim()
    const user = db.users.find((record) => record.email === normalizedEmail) ?? null
    const deletedAt = now.toISOString()
    if (!user) {
      return {
        found: false,
        userId: null,
        deletedAt,
        removedUserCount: 0,
        removedDeviceCount: 0,
        removedSessionCount: 0,
        removedSyncMutationCount: 0,
        removedWeeklyDigestCount: 0,
        removedMobileRetentionEventCount: 0,
      }
    }

    const belongsToDeletedUser = (record: { userId?: string; ownerId?: string; email: string }): boolean => (
      record.email === normalizedEmail || record.userId === user.id || record.ownerId === user.id
    )
    const beforeUsers = db.users.length
    const beforeDevices = db.devices.length
    const beforeSessions = db.sessions.length
    const beforeSyncMutations = db.syncMutations.length
    const beforeWeeklyDigests = db.weeklyDigests.length
    const beforeMobileRetentionEvents = db.mobileRetentionEvents.length

    db.users = db.users.filter((record) => record.email !== normalizedEmail && record.id !== user.id)
    db.devices = db.devices.filter((record) => !belongsToDeletedUser(record))
    db.sessions = db.sessions.filter((record) => !belongsToDeletedUser(record))
    db.oauthIdentities = db.oauthIdentities.filter((record) => record.userId !== user.id)
    db.syncMutations = db.syncMutations.filter((record) => !belongsToDeletedUser(record))
    db.weeklyDigests = db.weeklyDigests.filter((record) => !belongsToDeletedUser(record))
    db.mobileRetentionEvents = db.mobileRetentionEvents.filter((record) => !belongsToDeletedUser(record))

    await this.save(db)

    return {
      found: true,
      userId: user.id,
      deletedAt,
      removedUserCount: beforeUsers - db.users.length,
      removedDeviceCount: beforeDevices - db.devices.length,
      removedSessionCount: beforeSessions - db.sessions.length,
      removedSyncMutationCount: beforeSyncMutations - db.syncMutations.length,
      removedWeeklyDigestCount: beforeWeeklyDigests - db.weeklyDigests.length,
      removedMobileRetentionEventCount: beforeMobileRetentionEvents - db.mobileRetentionEvents.length,
    }
  }

  async revokeDevice(
    email: string,
    deviceId: string,
    now: Date = new Date(),
  ): Promise<{ found: boolean; revokedSessionCount: number }> {
    const db = await this.load()
    const deviceIndex = db.devices.findIndex((record) =>
      record.email === email.trim()
      && record.deviceId === deviceId
      && record.identityMode === "authenticated",
    )

    if (deviceIndex === -1) {
      return { found: false, revokedSessionCount: 0 }
    }

    const timestamp = now.toISOString()
    const existingDevice = db.devices[deviceIndex]!
    db.devices[deviceIndex] = {
      ...existingDevice,
      status: "revoked",
      revokedAt: existingDevice.revokedAt ?? timestamp,
      updatedAt: timestamp,
    }

    let revokedSessionCount = 0
    db.sessions = db.sessions.map((record) => {
      if (record.email !== email.trim() || record.deviceId !== deviceId) {
        return record
      }

      if (record.status !== "revoked") {
        revokedSessionCount += 1
      }

      return {
        ...record,
        status: "revoked",
        revokedAt: record.revokedAt ?? timestamp,
        lastVerifiedAt: timestamp,
      }
    })

    await this.save(db)

    const user = db.users.find((record) => record.email === email.trim()) ?? null
    if (user) {
      const revokedDevice = db.devices[deviceIndex]!
      const revokedSessions = db.sessions.filter((record) =>
        record.email === email.trim() && record.deviceId === deviceId,
      )
      await this.cloudflareShadow?.mirrorRevokedDevice({
        user,
        device: revokedDevice,
        sessions: revokedSessions,
      })
    }

    return {
      found: true,
      revokedSessionCount,
    }
  }

  async listDevices(email: string, currentDeviceId?: string): Promise<DeviceListEntry[]> {
    const db = await this.load()
    const devices = buildDeviceListEntries(db, email, currentDeviceId, "authenticated")

    const user = db.users.find((record) => record.email === email.trim()) ?? null
    if (user) {
      await this.cloudflareShadow?.compareDeviceList({
        user,
        currentDeviceId,
        devices,
      })
    }

    return devices
  }

  async getSession(email: string, token: string): Promise<RelaySession | null> {
    const claims = await verifySessionToken(token, this.env)
    if (!claims || claims.email !== email.trim()) return null

    const context = await this.getSessionContext(email, claims.sessionId)
    if (!context || context.session.status !== "active" || !context.device || context.device.status !== "active") {
      return null
    }

    if (context.session.deviceId !== claims.deviceId || isSessionExpired(context.session.expiresAt)) {
      return null
    }

    return buildRelaySession(context.user, token, context.session, this.env.sessionPublicBaseURL)
  }

  async upsertMirroredAuthenticatedIssue(
    params: MirroredAuthenticatedIssueInput,
  ): Promise<{ user: ServerUserRecord; device: ServerDeviceRecord; session: ServerSessionRecord }> {
    const db = await this.load()
    const user = db.users.find((record) => record.id === params.userId) ?? null
    if (!user || user.email !== params.email.trim()) {
      throw new Error(`Authenticated mirror-back user was not found: ${params.userId}`)
    }
    if (params.device.userId !== user.id || params.device.email !== user.email) {
      throw new Error("Authenticated mirror-back device does not match the authoritative user.")
    }
    if (
      params.session.userId !== user.id
      || params.session.email !== user.email
      || params.session.deviceId !== params.device.deviceId
    ) {
      throw new Error("Authenticated mirror-back session does not match the authoritative user/device.")
    }

    const device = this.upsertMirroredDevice(db, params.device)
    const session = this.upsertMirroredSession(db, params.session)
    await this.save(db)

    return { user, device, session }
  }

  async upsertMirroredAnonymousIssue(
    params: MirroredAnonymousIssueInput,
  ): Promise<{ user: ServerUserRecord; device: ServerDeviceRecord; session: ServerSessionRecord }> {
    const db = await this.load()
    const parsedUser = ServerUserRecordSchema.parse(params.user)
    const existingById = db.users.find((record) => record.id === parsedUser.id) ?? null
    const conflictingInstallUser = parsedUser.installId
      ? db.users.find((record) =>
          record.identityMode === "anonymous"
          && record.installId === parsedUser.installId
          && record.id !== parsedUser.id,
        ) ?? null
      : null

    if (conflictingInstallUser) {
      throw new Error(
        `Anonymous mirror-back installId already belongs to ${conflictingInstallUser.id}: ${parsedUser.installId}`,
      )
    }

    const user = existingById ?? parsedUser
    if (!existingById) {
      db.users.push(user)
    }

    if (params.device.userId !== user.id || params.device.email !== user.email) {
      throw new Error("Anonymous mirror-back device does not match the mirrored user.")
    }
    if (
      params.session.userId !== user.id
      || params.session.email !== user.email
      || params.session.deviceId !== params.device.deviceId
    ) {
      throw new Error("Anonymous mirror-back session does not match the mirrored user/device.")
    }

    const device = this.upsertMirroredDevice(db, params.device)
    const session = this.upsertMirroredSession(db, params.session)
    await this.save(db)

    return { user, device, session }
  }

  async getAccount(email: string): Promise<AstraAccount | null> {
    const db = await this.load()
    const refreshed = this.refreshUserUsage(db, email, new Date())
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, new Date().toISOString())
    }
    return buildAccount(refreshed.user, this.env.publicBaseURL)
  }

  async getUsageSnapshot(email: string): Promise<AstraUsageSnapshot | null> {
    const db = await this.load()
    const refreshed = this.refreshUserUsage(db, email, new Date())
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, new Date().toISOString())
    }
    return buildUsageSnapshot(refreshed.user, new Date().toISOString())
  }

  async getAccountSummary(params: {
    email: string
    currentDeviceId?: string
    currentSessionId?: string
    serverTime?: string
  }): Promise<AstraAccountSummary | null> {
    const db = await this.load()
    const now = params.serverTime ? new Date(params.serverTime) : new Date()
    const refreshed = this.refreshUserUsage(db, params.email, now)
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, now.toISOString())
    }

    const identityMode = db.sessions.find((session) =>
      session.email === params.email.trim() && session.sessionId === params.currentSessionId,
    )?.identityMode ?? refreshed.user.identityMode
    const devices = buildDeviceListEntries(db, params.email, params.currentDeviceId, identityMode)
    const currentSession = params.currentSessionId
      ? (db.sessions.find((session) =>
          session.email === params.email.trim() && session.sessionId === params.currentSessionId,
        ) ?? null)
      : null

    return AstraAccountSummarySchema.parse({
      serverTime: now.toISOString(),
      account: buildAccount(refreshed.user, this.env.publicBaseURL),
      usage: buildUsageSnapshot(refreshed.user, now.toISOString()),
      session: {
        sessionId: currentSession?.sessionId ?? null,
        deviceId: currentSession?.deviceId ?? params.currentDeviceId ?? null,
        issuedAt: currentSession?.issuedAt ?? null,
        expiresAt: currentSession?.expiresAt ?? null,
        identityMode,
        status: currentSession ? resolveSessionSummaryStatus(currentSession, now) : "revoked",
      },
      devices: {
        activeCount: devices.filter((device) => device.status === "active").length,
        revokedCount: devices.filter((device) => device.status === "revoked").length,
        current: devices.find((device) => device.isCurrentDevice) ?? null,
        entries: devices,
      },
      sync: {
        maxMutationsPerRequest: this.env.syncMaxMutationsPerRequest,
        collections: buildSyncCollectionSummaries(db, refreshed.user),
      },
    })
  }

  async exportAccountData(params: {
    email: string
    currentDeviceId?: string
    currentSessionId?: string
    serverTime?: string
  }): Promise<Record<string, unknown> | null> {
    const db = await this.load()
    const now = params.serverTime ? new Date(params.serverTime) : new Date()
    const refreshed = this.refreshUserUsage(db, params.email, now)
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, now.toISOString())
    }

    const user = refreshed.user
    const belongsToUser = (record: { ownerId?: string; userId?: string; email?: string }) =>
      record.email === user.email || record.ownerId === user.id || record.userId === user.id
    const devices = db.devices.filter(belongsToUser)
    const sessions = db.sessions.filter(belongsToUser)
    const oauthIdentities = db.oauthIdentities.filter((identity) => identity.userId === user.id)
    const syncMutations = db.syncMutations.filter(belongsToUser)
    const weeklyDigests = db.weeklyDigests.filter(belongsToUser)
    const mobileRetentionEvents = db.mobileRetentionEvents.filter(belongsToUser)

    return {
      schema: "astra-account-data-export.v1",
      generatedAt: now.toISOString(),
      account: {
        id: user.id,
        email: user.email,
        billingEmail: user.billingEmail,
        createdAt: user.createdAt,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        providerEntitlements: user.providerEntitlements,
        identityMode: user.identityMode,
        syncPreferences: user.syncPreferences,
        limits: user.limits,
        usage: user.usage,
      },
      currentSession: {
        sessionId: params.currentSessionId ?? null,
        deviceId: params.currentDeviceId ?? null,
      },
      devices: devices.map((device) => ({
        deviceId: device.deviceId,
        label: device.label,
        platform: device.platform,
        browserFamily: device.browserFamily,
        appKind: device.appKind,
        appVersion: device.appVersion,
        firstSeenAt: device.firstSeenAt,
        lastSeenAt: device.lastSeenAt,
        lastSyncAt: device.lastSyncAt,
        status: device.status,
        isCurrentDevice: device.deviceId === params.currentDeviceId,
        expoPushTokenStored: Boolean(device.expoPushToken),
        expoPushTokenUpdatedAt: device.expoPushTokenUpdatedAt,
        expoPushTokenPlatform: device.expoPushTokenPlatform,
        updatedAt: device.updatedAt,
        revokedAt: device.revokedAt,
      })),
      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        identityMode: session.identityMode,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        lastVerifiedAt: session.lastVerifiedAt,
        status: session.status,
        revokedAt: session.revokedAt,
        isCurrentSession: session.sessionId === params.currentSessionId,
      })),
      oauthIdentities: oauthIdentities.map((identity) => ({
        provider: identity.provider,
        subject: identity.subject,
        email: identity.email,
        emailVerified: identity.emailVerified,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
        lastRedeemedAt: identity.lastRedeemedAt,
      })),
      syncMutations,
      weeklyDigests: weeklyDigests.map((record) => ({
        digestId: record.digestId,
        generatedAt: record.generatedAt,
        snapshot: record.snapshot,
      })),
      mobileRetentionEvents: mobileRetentionEvents.map((event) => ({
        deviceId: event.deviceId,
        eventId: event.eventId,
        name: event.name,
        clientTimestamp: event.clientTimestamp,
        receivedAt: event.receivedAt,
        metadata: event.metadata,
      })),
    }
  }

  async getCloudLearningMemoryInventory(params: {
    email: string
    serverTime?: string
  }): Promise<CloudLearningMemoryInventory | null> {
    const db = await this.load()
    const now = params.serverTime ? new Date(params.serverTime) : new Date()
    const user = db.users.find((record) => record.email === params.email.trim()) ?? null
    if (!user) return null

    const weeklyDigests = db.weeklyDigests
      .filter((record) => record.email === user.email || record.ownerId === user.id)
      .sort((left, right) => Date.parse(left.generatedAt) - Date.parse(right.generatedAt))
    const latestDigest = weeklyDigests.at(-1) ?? null

    return {
      schema: "astra-cloud-learning-memory-inventory.v1",
      generatedAt: now.toISOString(),
      account: {
        userId: user.id,
        identityMode: user.identityMode,
      },
      collections: [
        ...SYNC_COLLECTIONS.map((collection) => {
          const mutations = getUserSyncMutations(db, user, collection)
          const latestMutation = mutations.at(-1) ?? null
          return {
            collection,
            enabled: getSyncCollectionEnabled(user, collection),
            defaultEnabled: getSyncCollectionDefaultEnabled(collection),
            mutationCount: mutations.length,
            activeCount: countActiveSyncRecords(mutations),
            cursor: latestMutation?.cursor ?? null,
            lastUpdatedAt: latestMutation?.serverUpdatedAt ?? null,
          }
        }),
        {
          collection: "weekly_digest_archive" as const,
          enabled: user.syncPreferences.weekly_digest,
          defaultEnabled: true,
          mutationCount: weeklyDigests.length,
          activeCount: weeklyDigests.length,
          cursor: null,
          lastUpdatedAt: latestDigest?.generatedAt ?? null,
        },
      ],
      preferences: user.syncPreferences,
      privacy: {
        metadataOnly: true,
        rawContentIncluded: false,
        rawUrlsIncluded: false,
        emailsIncluded: false,
        deviceSessionIdsIncluded: false,
        syncPayloadBodiesIncluded: false,
        promptModelOutputsIncluded: false,
        externalProviderReceiptsIncluded: false,
        localBrowserDeletionIncluded: false,
      },
    }
  }

  async deleteCloudLearningMemory(params: {
    email: string
    now?: Date
  }): Promise<CloudLearningMemoryDeletionReceipt | null> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === params.email.trim()) ?? null
    if (!user) return null

    const belongsToUser = (record: { ownerId?: string; email?: string }) =>
      record.email === user.email || record.ownerId === user.id
    const collectionReceipts = SYNC_COLLECTIONS.map((collection) => {
      const mutations = getUserSyncMutations(db, user, collection)
      const latestMutation = mutations.at(-1) ?? null
      return {
        collection,
        clearedMutationCount: mutations.length,
        clearedActiveCount: countActiveSyncRecords(mutations),
        previousCursor: latestMutation?.cursor ?? null,
      }
    })
    const weeklyDigests = db.weeklyDigests.filter(belongsToUser)
    const receipts: CloudLearningMemoryDeletionReceipt["collections"] = [
      ...collectionReceipts,
      {
        collection: "weekly_digest_archive",
        clearedMutationCount: weeklyDigests.length,
        clearedActiveCount: weeklyDigests.length,
        previousCursor: null,
      },
    ]

    db.syncMutations = db.syncMutations.filter((record) => !belongsToUser(record))
    db.weeklyDigests = db.weeklyDigests.filter((record) => !belongsToUser(record))
    await this.save(db)

    return {
      schema: "astra-cloud-learning-memory-deletion-receipt.v1",
      deletedAt: (params.now ?? new Date()).toISOString(),
      account: {
        userId: user.id,
        identityMode: user.identityMode,
      },
      collections: receipts,
      totals: {
        clearedMutationCount: receipts.reduce((sum, receipt) => sum + receipt.clearedMutationCount, 0),
        clearedActiveCount: receipts.reduce((sum, receipt) => sum + receipt.clearedActiveCount, 0),
      },
      boundary: {
        metadataOnly: true,
        cloudServerSideOnly: true,
        rawContentIncluded: false,
        externalProviderDeletionIncluded: false,
        localBrowserDeletionIncluded: false,
      },
    }
  }

  async updatePlan(email: string, plan: ServerUserRecord["plan"]): Promise<AstraAccount | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]!
    const nextUsage = pruneUsageWindow(user.usage, new Date())
    db.users[userIndex] = {
      ...user,
      plan,
      subscriptionStatus: "active",
      providerEntitlements: defaultEntitlements(plan),
      limits: defaultLimits(plan, this.env),
      usage: nextUsage,
    }
    await this.save(db)
    await this.cloudflareShadow?.mirrorUserUsage(db.users[userIndex]!, new Date().toISOString())
    await this.cloudflareShadow?.mirrorSyncPreferences(db.users[userIndex]!, new Date().toISOString())

    return buildAccount(db.users[userIndex]!, this.env.publicBaseURL)
  }

  async assertCanTranslate(params: {
    email: string
    characterCount: number
    taskClass?: AstraTaskClass
    timestamp?: Date
  }): Promise<void> {
    const db = await this.load()
    const now = params.timestamp ?? new Date()
    const userIndex = db.users.findIndex((user) => user.email === params.email)
    if (userIndex === -1) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const user = db.users[userIndex]!
    const usage = pruneUsageWindow(user.usage, now)
    assertUsageCapacity(user, usage, params.characterCount, params.taskClass)
  }

  async recordTranslationUsage(params: {
    email: string
    provider: ProviderId
    serviceMode?: ServiceMode
    characterCount: number
    metadata?: ServerUsageEventMetadata
    timestamp?: Date
  }): Promise<RelaySession> {
    const db = await this.load()
    const now = params.timestamp ?? new Date()
    const userIndex = db.users.findIndex((user) => user.email === params.email)
    if (userIndex === -1) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const user = db.users[userIndex]!
    const usage = pruneUsageWindow(user.usage, now)
    const metadata = normalizeUsageEventMetadata(params.metadata)
    assertUsageCapacity(user, usage, params.characterCount, metadata.taskClass)

    const timestamp = now.toISOString()
    const monthlyTaskRequests = metadata.taskClass && shouldMeterTask(metadata.taskClass)
      ? {
          ...usage.monthlyTaskRequests,
          [metadata.taskClass]: (usage.monthlyTaskRequests[metadata.taskClass] ?? 0) + 1,
        }
      : usage.monthlyTaskRequests
    const nextUsage: ServerUserUsage = {
      ...usage,
      requestsToday: usage.requestsToday + 1,
      charactersToday: usage.charactersToday + params.characterCount,
      totalRequests: usage.totalRequests + 1,
      totalCharacters: usage.totalCharacters + params.characterCount,
      lastRequestAt: timestamp,
      recentRequestTimestamps: [...usage.recentRequestTimestamps, timestamp],
      monthlyTaskRequests,
      recentEvents: [
        {
          timestamp,
          provider: params.provider,
          serviceMode: params.serviceMode ?? "automatic",
          requestCount: 1,
          characterCount: params.characterCount,
          ...metadata,
          success: metadata.success ?? true,
        },
        ...usage.recentEvents,
      ].slice(0, 10),
    }

    db.users[userIndex] = {
      ...user,
      usage: nextUsage,
    }

    await this.save(db)
    await this.cloudflareShadow?.mirrorUserUsage(db.users[userIndex]!, timestamp)
    const syntheticSession: ServerSessionRecord = {
      sessionId: "session-updated",
      userId: db.users[userIndex]!.id,
      email: db.users[userIndex]!.email,
      deviceId: "unknown-device",
      identityMode: db.users[userIndex]!.identityMode,
      issuedAt: timestamp,
      expiresAt: null,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      lastVerifiedAt: timestamp,
      status: "active",
      revokedAt: null,
    }
    return buildRelaySession(
      db.users[userIndex]!,
      "session-updated",
      syntheticSession,
      this.env.sessionPublicBaseURL,
    )
  }

  async recordTranslationDecisionFailure(params: {
    email: string
    provider: ProviderId
    serviceMode?: ServiceMode
    characterCount: number
    metadata?: ServerUsageEventMetadata
    timestamp?: Date
  }): Promise<void> {
    const db = await this.load()
    const now = params.timestamp ?? new Date()
    const userIndex = db.users.findIndex((user) => user.email === params.email)
    if (userIndex === -1) return

    const user = db.users[userIndex]!
    const usage = pruneUsageWindow(user.usage, now)
    const timestamp = now.toISOString()
    const metadata = normalizeUsageEventMetadata(params.metadata)
    const nextUsage: ServerUserUsage = {
      ...usage,
      recentEvents: [
        {
          timestamp,
          provider: params.provider,
          serviceMode: params.serviceMode ?? "automatic",
          requestCount: 0,
          characterCount: params.characterCount,
          ...metadata,
          success: false,
        },
        ...usage.recentEvents,
      ].slice(0, 10),
    }

    db.users[userIndex] = {
      ...user,
      usage: nextUsage,
    }

    await this.save(db)
    await this.cloudflareShadow?.mirrorUserUsage(db.users[userIndex]!, timestamp)
  }

  async summarizeMobileRetention(params: { grain?: MobileRetentionSummaryGrain; now?: Date } = {}): Promise<MobileRetentionSummary> {
    const db = await this.load()
    const grain = params.grain === "week" ? "week" : "day"
    const buckets = new Map<string, MobileRetentionSummary["buckets"][number]>()
    const byEventName = new Map<ServerMobileRetentionEvent["name"], number>()

    for (const event of db.mobileRetentionEvents) {
      const bucket = mobileRetentionBucketForTimestamp(event.clientTimestamp, grain)
      const bucketKey = `${bucket}:${event.name}`
      const currentBucket = buckets.get(bucketKey) ?? { bucket, eventName: event.name, count: 0 }
      currentBucket.count += 1
      buckets.set(bucketKey, currentBucket)
      byEventName.set(event.name, (byEventName.get(event.name) ?? 0) + 1)
    }

    return {
      schema: "astra-mobile-retention-summary.v1",
      generatedAt: (params.now ?? new Date()).toISOString(),
      source: "metadata_only_mobile_retention_events",
      retainedEventsPerUserLimit: MOBILE_RETENTION_EVENTS_LIMIT_PER_USER,
      grain,
      totalEvents: db.mobileRetentionEvents.length,
      buckets: [...buckets.values()].sort((left, right) => left.bucket.localeCompare(right.bucket) || left.eventName.localeCompare(right.eventName)),
      byEventName: [...byEventName.entries()]
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((left, right) => right.count - left.count || left.eventName.localeCompare(right.eventName)),
      privacy: {
        metadataOnly: true,
        aggregateOnly: true,
        perUserRows: false,
        rawContentIncluded: false,
        identifiersIncluded: false,
      },
    }
  }

  async recordMobileRetentionEvents(params: {
    email: string
    deviceId: string
    events: ServerMobileRetentionEventInput[]
    now?: Date
  }): Promise<{ acceptedCount: number; serverTime: string }> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === params.email.trim())
    if (!user || user.identityMode !== "authenticated") {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const serverTime = (params.now ?? new Date()).toISOString()
    const existingKeys = new Set(db.mobileRetentionEvents
      .filter((event) => event.email === user.email || event.ownerId === user.id)
      .map((event) => `${event.deviceId}:${event.eventId}`))
    const accepted: ServerMobileRetentionEvent[] = []

    for (const event of params.events) {
      const key = `${params.deviceId}:${event.id}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      accepted.push(ServerMobileRetentionEventSchema.parse({
        ownerId: user.id,
        email: user.email,
        deviceId: params.deviceId,
        eventId: event.id,
        name: event.name,
        clientTimestamp: event.timestamp,
        receivedAt: serverTime,
        metadata: event.metadata,
      }))
    }

    if (accepted.length > 0) {
      const otherUsers = db.mobileRetentionEvents.filter((event) => event.email !== user.email && event.ownerId !== user.id)
      const userEvents = [...accepted, ...db.mobileRetentionEvents.filter((event) => event.email === user.email || event.ownerId === user.id)]
        .sort((left, right) => right.clientTimestamp - left.clientTimestamp || Date.parse(right.receivedAt) - Date.parse(left.receivedAt))
        .slice(0, MOBILE_RETENTION_EVENTS_LIMIT_PER_USER)
      db.mobileRetentionEvents = [...otherUsers, ...userEvents]
      await this.save(db)
    }

    return { acceptedCount: accepted.length, serverTime }
  }

  async updateSyncCollectionPreference(
    email: string,
    collection: "reading_history" | "study_progress",
    enabled: boolean,
  ): Promise<ServerUserSyncPreferences | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((record) => record.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]!
    const syncPreferences = {
      ...createDefaultSyncPreferences(),
      ...user.syncPreferences,
      [collection]: enabled,
    }

    db.users[userIndex] = {
      ...user,
      syncPreferences,
    }
    await this.save(db)
    await this.cloudflareShadow?.mirrorSyncPreferences(db.users[userIndex]!, new Date().toISOString())
    return syncPreferences
  }

  async updateCurrentDevicePushToken(params: {
    email: string
    deviceId: string
    expoPushToken: string | null
    platform?: string | null
    now?: Date
  }): Promise<ServerDeviceRecord | null> {
    const db = await this.load()
    const deviceIndex = db.devices.findIndex((record) =>
      record.email === params.email.trim()
      && record.deviceId === params.deviceId
      && record.identityMode === "authenticated"
      && record.status === "active",
    )
    if (deviceIndex === -1) return null

    const timestamp = (params.now ?? new Date()).toISOString()
    const token = coerceNullableText(params.expoPushToken)
    const platform = coerceNullableText(params.platform)
    const device = db.devices[deviceIndex]!
    db.devices[deviceIndex] = {
      ...device,
      expoPushToken: token,
      expoPushTokenUpdatedAt: token ? timestamp : null,
      expoPushTokenPlatform: token ? platform : null,
      updatedAt: timestamp,
    }
    await this.save(db)
    return db.devices[deviceIndex]!
  }

  async updateWeeklyDigestPreference(
    email: string,
    enabled: boolean,
  ): Promise<ServerUserSyncPreferences | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((record) => record.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]!
    const syncPreferences = {
      ...createDefaultSyncPreferences(),
      ...user.syncPreferences,
      weekly_digest: enabled,
    }

    db.users[userIndex] = {
      ...user,
      syncPreferences,
    }
    await this.save(db)
    await this.cloudflareShadow?.mirrorSyncPreferences(db.users[userIndex]!, new Date().toISOString())
    return syncPreferences
  }

  async getSyncBootstrap(email: string, deviceId: string): Promise<SyncBootstrapResponse> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const bootstrap = {
      serverTime: new Date().toISOString(),
      deviceId,
      collections: {
        config: {
          enabled: true,
          defaultEnabled: true,
          cursor: this.getLatestCursor(db, email, "config"),
        },
        vocabulary: {
          enabled: true,
          defaultEnabled: true,
          cursor: this.getLatestCursor(db, email, "vocabulary"),
        },
        review_schedule: {
          enabled: true,
          defaultEnabled: true,
          cursor: this.getLatestCursor(db, email, "review_schedule"),
        },
        reading_history: {
          enabled: user.syncPreferences.reading_history,
          defaultEnabled: false,
          cursor: this.getLatestCursor(db, email, "reading_history"),
        },
        study_progress: {
          enabled: user.syncPreferences.study_progress,
          defaultEnabled: false,
          cursor: this.getLatestCursor(db, email, "study_progress"),
        },
      },
      limits: {
        maxMutationsPerRequest: this.env.syncMaxMutationsPerRequest,
      },
      transport: {
        deviceHeader: "X-Astra-Device-Id",
        idempotencyKey: "clientMutationId",
        cursorMode: "per-collection",
      },
    } satisfies SyncBootstrapResponse

    await this.cloudflareShadow?.compareSyncBootstrap({
      user,
      bootstrap,
      maxMutationsPerRequest: this.env.syncMaxMutationsPerRequest,
    })

    return bootstrap
  }

  async getWeeklyDigest(email: string, now: Date = new Date(), options: { archive?: boolean } = {}): Promise<AstraWeeklyDigestSnapshot | null> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) return null

    const periodStart = startOfDigestWeek(now)
    const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const periodStartTime = periodStart.getTime()
    const periodEndTime = periodEnd.getTime()
    const nextReviewUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const latestVocabulary = new Map<string, ServerSyncMutationRecord>()
    const latestSchedules = new Map<string, ServerSyncMutationRecord>()
    const mutations = db.syncMutations
      .filter((mutation) =>
        mutation.email === user.email
        && (mutation.collection === "vocabulary" || mutation.collection === "review_schedule"),
      )
      .sort((left, right) => parseCursor(left.cursor) - parseCursor(right.cursor))

    for (const mutation of mutations) {
      const target = mutation.collection === "vocabulary" ? latestVocabulary : latestSchedules
      if (mutation.operation === "delete") {
        target.delete(mutation.recordId)
        continue
      }
      target.set(mutation.recordId, mutation)
    }

    const savedThisWeek: Array<{
      text: string
      itemType: "word" | "sentence"
      savedAt: number
      sourceType: AstraDigestSourceType
    }> = []

    for (const mutation of latestVocabulary.values()) {
      const record = syncPayloadRecord(mutation.payload)
      if (!record) continue
      const text = stringFromSyncPayload(record.text)
      if (!text) continue
      const fallbackSavedAt = Date.parse(mutation.clientUpdatedAt || mutation.serverUpdatedAt)
      const savedAt = numberFromSyncPayload(record.savedAt, Number.isFinite(fallbackSavedAt) ? fallbackSavedAt : 0)
      if (savedAt < periodStartTime || savedAt >= periodEndTime) continue
      savedThisWeek.push({
        text,
        itemType: text.includes(" ") || text.length > 48 ? "sentence" : "word",
        savedAt,
        sourceType: sourceTypeForSyncedVocabularyEntry(record),
      })
    }

    savedThisWeek.sort((left, right) => right.savedAt - left.savedAt || left.text.localeCompare(right.text))

    const reviewedIds = new Set<string>()
    let nextReviewCount = 0
    for (const mutation of latestSchedules.values()) {
      const record = syncPayloadRecord(mutation.payload)
      if (!record) continue
      const vocabularyEntryId = stringFromSyncPayload(record.vocabularyEntryId) ?? mutation.recordId
      if (!latestVocabulary.has(vocabularyEntryId)) continue
      const lastReviewedAt = numberFromSyncPayload(record.lastReviewedAt, 0)
      if (lastReviewedAt >= periodStartTime && lastReviewedAt < periodEndTime) {
        reviewedIds.add(vocabularyEntryId)
      }

      const srsBox = numberFromSyncPayload(record.srsBox, 1)
      const nextReviewAt = numberFromSyncPayload(record.nextReviewAt, 0)
      if (srsBox < 5 && nextReviewAt > now.getTime() && nextReviewAt <= nextReviewUntil.getTime()) {
        nextReviewCount += 1
      }
    }

    const sourceCounts = new Map<AstraDigestSourceType, number>()
    for (const item of savedThisWeek) {
      sourceCounts.set(item.sourceType, (sourceCounts.get(item.sourceType) ?? 0) + 1)
    }

    const digest = AstraWeeklyDigestSnapshotSchema.parse({
      digestId: `digest_${periodStart.toISOString().slice(0, 10)}`,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      reviewedCount: reviewedIds.size,
      savedCount: savedThisWeek.length,
      sourceBreakdown: [...sourceCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
      highlightedWords: savedThisWeek.filter((item) => item.itemType === "word").slice(0, 3).map((item) => item.text),
      highlightedSentences: savedThisWeek.filter((item) => item.itemType === "sentence").slice(0, 2).map((item) => item.text),
      nextReviewCount,
      generatedAt: now.toISOString(),
    })

    if (options.archive !== false) {
      const archiveRecord = ServerWeeklyDigestRecordSchema.parse({
        ownerId: user.id,
        email: user.email,
        digestId: digest.digestId,
        generatedAt: digest.generatedAt,
        snapshot: digest,
      })
      const otherUsers = db.weeklyDigests.filter((record) => record.email !== user.email && record.ownerId !== user.id)
      const userArchive = [
        archiveRecord,
        ...db.weeklyDigests.filter((record) =>
          (record.email === user.email || record.ownerId === user.id) && record.digestId !== digest.digestId,
        ),
      ]
        .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt) || right.digestId.localeCompare(left.digestId))
        .slice(0, WEEKLY_DIGEST_ARCHIVE_LIMIT_PER_USER)
      db.weeklyDigests = [...otherUsers, ...userArchive]
      await this.save(db)
    }

    return digest
  }

  async pushSyncMutations(
    email: string,
    deviceId: string,
    mutations: SyncMutationInput[],
    now: Date = new Date(),
  ): Promise<SyncPushResponse> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const accepted: SyncMutationAck[] = []
    const rejected: SyncMutationRejection[] = []
    const timestamp = now.toISOString()

    for (const mutation of mutations) {
      if (mutation.deviceId !== deviceId) {
        rejected.push({
          collection: mutation.collection,
          clientMutationId: mutation.clientMutationId,
          code: "DEVICE_MISMATCH",
          message: "Sync mutation deviceId must match the authenticated device.",
        })
        continue
      }

      if (mutation.schemaVersion !== 1) {
        rejected.push({
          collection: mutation.collection,
          clientMutationId: mutation.clientMutationId,
          code: "SCHEMA_VERSION_UNSUPPORTED",
          message: `Unsupported sync schemaVersion: ${mutation.schemaVersion}.`,
        })
        continue
      }

      const existing = db.syncMutations.find((record) =>
        record.email === email.trim() && record.clientMutationId === mutation.clientMutationId,
      )
      if (existing) {
        accepted.push({
          collection: existing.collection,
          clientMutationId: existing.clientMutationId,
          recordId: existing.recordId,
          operation: existing.operation,
          serverUpdatedAt: existing.serverUpdatedAt,
          cursor: existing.cursor,
          deduped: true,
        })
        continue
      }

      const validated = validateSyncMutationPayload(user.syncPreferences, mutation)
      if ("code" in validated) {
        rejected.push(validated)
        continue
      }

      const stored: ServerSyncMutationRecord = {
        ownerId: user.id,
        email: user.email,
        serverMutationId: randomUUID(),
        serverUpdatedAt: timestamp,
        cursor: this.nextSyncCursor(db),
        ...validated,
      }
      db.syncMutations.push(stored)
      accepted.push({
        collection: stored.collection,
        clientMutationId: stored.clientMutationId,
        recordId: stored.recordId,
        operation: stored.operation,
        serverUpdatedAt: stored.serverUpdatedAt,
        cursor: stored.cursor,
        deduped: false,
      })
    }

    await this.save(db)

    if (accepted.length > 0) {
      const acceptedMutationIds = new Set(accepted.map((entry) => entry.clientMutationId))
      const storedMutations = db.syncMutations.filter((record) =>
        record.email === email.trim() && acceptedMutationIds.has(record.clientMutationId),
      )
      await this.cloudflareShadow?.mirrorSyncMutations({
        user,
        mutations: storedMutations,
        shadowUpdatedAt: timestamp,
      })
    }

    return {
      serverTime: timestamp,
      accepted,
      rejected,
      nextCursors: {
        config: this.getLatestCursor(db, email, "config"),
        vocabulary: this.getLatestCursor(db, email, "vocabulary"),
        review_schedule: this.getLatestCursor(db, email, "review_schedule"),
        reading_history: this.getLatestCursor(db, email, "reading_history"),
        study_progress: this.getLatestCursor(db, email, "study_progress"),
      },
    }
  }

  async pullSyncMutations(
    email: string,
    cursors: Partial<Record<SyncCollection, string | null>> = {},
  ): Promise<SyncPullResponse> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }
    const deltas = {
      config: [] as ServerSyncMutationRecord[],
      vocabulary: [] as ServerSyncMutationRecord[],
      review_schedule: [] as ServerSyncMutationRecord[],
      reading_history: [] as ServerSyncMutationRecord[],
      study_progress: [] as ServerSyncMutationRecord[],
    }

    for (const collection of SYNC_COLLECTIONS) {
      const isOptionalCollection = collection === "reading_history" || collection === "study_progress"
      const explicitlyRequested = Object.prototype.hasOwnProperty.call(cursors, collection)
      if (isOptionalCollection && (!explicitlyRequested || !isSyncCollectionEnabled(user.syncPreferences, collection))) {
        deltas[collection] = []
        continue
      }

      const cursor = parseCursor(cursors[collection])
      deltas[collection] = db.syncMutations
        .filter((mutation) => mutation.email === email.trim() && mutation.collection === collection && parseCursor(mutation.cursor) > cursor)
        .sort((a, b) => parseCursor(a.cursor) - parseCursor(b.cursor))
    }

    const result = {
      serverTime: new Date().toISOString(),
      deltas,
      nextCursors: {
        config: deltas.config.at(-1)?.cursor ?? this.getLatestCursor(db, email, "config") ?? cursors.config ?? null,
        vocabulary: deltas.vocabulary.at(-1)?.cursor ?? this.getLatestCursor(db, email, "vocabulary") ?? cursors.vocabulary ?? null,
        review_schedule: deltas.review_schedule.at(-1)?.cursor ?? this.getLatestCursor(db, email, "review_schedule") ?? cursors.review_schedule ?? null,
        reading_history: deltas.reading_history.at(-1)?.cursor ?? (Object.prototype.hasOwnProperty.call(cursors, "reading_history")
          ? (this.getLatestCursor(db, email, "reading_history") ?? cursors.reading_history ?? null)
          : null),
        study_progress: deltas.study_progress.at(-1)?.cursor ?? (Object.prototype.hasOwnProperty.call(cursors, "study_progress")
          ? (this.getLatestCursor(db, email, "study_progress") ?? cursors.study_progress ?? null)
          : null),
      },
    } satisfies SyncPullResponse

    await this.cloudflareShadow?.compareSyncPull({
      user,
      cursors,
      result,
    })

    return result
  }
}
