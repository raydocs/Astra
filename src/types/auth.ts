import { z } from "zod"

import { AstraSyncCollectionSchema, ProviderIdSchema } from "./config"

export const AstraPlanSchema = z.enum(["free", "pro"])
export const AstraSubscriptionStatusSchema = z.enum(["active", "past_due", "canceled"])
export const AstraIdentityModeSchema = z.enum(["anonymous", "authenticated"])
export const AstraDevicePlatformSchema = z.enum(["macos", "windows", "linux", "ios", "android", "unknown"])
export const AstraBrowserFamilySchema = z.enum(["chrome", "edge", "firefox", "safari", "unknown"])
export const AstraAppKindSchema = z.enum(["extension", "web", "pwa"])
export const AstraDeviceStatusSchema = z.enum(["active", "revoked"])
export const AstraSyncOperationSchema = z.enum(["upsert", "delete"])
export const AstraSessionSummaryStatusSchema = z.enum(["active", "revoked", "expired"])
export const AstraContinuityExportCollectionSchema = z.enum(["config", "vocabulary", "review_schedule", "reading_history", "study_progress"])
export const AstraContinuityDeleteCollectionSchema = z.enum(["vocabulary", "review_schedule", "reading_history", "study_progress"])
export const AstraContinuityExportStatusSchema = z.enum(["queued", "running", "completed", "failed", "expired"])
export const AstraContinuityDeleteStatusSchema = z.enum(["queued", "scheduled", "running", "completed", "failed", "canceled"])

export const AstraQuotaSchema = z.object({
  dailyRequestsLimit: z.number().int().nonnegative().default(0),
  dailyCharactersLimit: z.number().int().nonnegative().default(0),
  requestsPerMinuteLimit: z.number().int().nonnegative().default(0),
  remainingDailyRequests: z.number().int().nonnegative().default(0),
  remainingDailyCharacters: z.number().int().nonnegative().default(0),
})

export const AstraUsageEventSchema = z.object({
  timestamp: z.string().trim().min(1),
  provider: ProviderIdSchema,
  requestCount: z.number().int().positive().default(1),
  characterCount: z.number().int().nonnegative().default(0),
})

export const AstraUsageSchema = z.object({
  totalRequests: z.number().int().nonnegative().default(0),
  totalCharacters: z.number().int().nonnegative().default(0),
  dailyRequestsUsed: z.number().int().nonnegative().default(0),
  dailyCharactersUsed: z.number().int().nonnegative().default(0),
  lastRequestAt: z.string().trim().min(1).nullable().default(null),
  recentEvents: z.array(AstraUsageEventSchema).default([]),
})

export const AstraAccountSchema = z.object({
  id: z.string().trim().min(1),
  relayBaseURL: z.string().trim().min(1),
  email: z.string().trim().min(1),
  billingEmail: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  plan: AstraPlanSchema.default("free"),
  subscriptionStatus: AstraSubscriptionStatusSchema.default("active"),
  providerEntitlements: z.array(ProviderIdSchema).default(["google_translate", "openai", "gemini"]),
})

export const AstraUsageSnapshotSchema = z.object({
  generatedAt: z.string().trim().min(1),
  quota: AstraQuotaSchema,
  usage: AstraUsageSchema,
})

export const AstraBillingLinkSchema = z.object({
  kind: z.enum(["checkout", "portal"]),
  url: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  plan: AstraPlanSchema.nullable().default(null),
})

export const AstraDeviceIdentitySchema = z.object({
  version: z.literal(1).default(1),
  deviceId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  platform: AstraDevicePlatformSchema.default("unknown"),
  browserFamily: AstraBrowserFamilySchema.default("unknown"),
  appKind: AstraAppKindSchema.default("extension"),
  appVersion: z.string().trim().min(1).default("0.1.0"),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
})

export const AstraDeviceListEntrySchema = z.object({
  deviceId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  platform: z.string().trim().min(1).nullable().default(null),
  browserFamily: z.string().trim().min(1).nullable().default(null),
  appKind: z.string().trim().min(1).default("extension"),
  appVersion: z.string().trim().min(1).nullable().default(null),
  firstSeenAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastSyncAt: z.string().trim().min(1).nullable().default(null),
  status: AstraDeviceStatusSchema.default("active"),
  isCurrentDevice: z.boolean().default(false),
})

export const AstraDevicesResponseSchema = z.object({
  devices: z.array(AstraDeviceListEntrySchema).default([]),
})

export const AstraSyncCollectionBootstrapStateSchema = z.object({
  enabled: z.boolean().default(false),
  defaultEnabled: z.boolean().default(false),
  cursor: z.string().trim().min(1).nullable().default(null),
})

export const AstraSyncBootstrapSchema = z.object({
  serverTime: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  collections: z.record(AstraSyncCollectionSchema, AstraSyncCollectionBootstrapStateSchema),
  limits: z.object({
    maxMutationsPerRequest: z.number().int().positive(),
  }),
  transport: z.object({
    deviceHeader: z.literal("X-Astra-Device-Id"),
    idempotencyKey: z.literal("clientMutationId"),
    cursorMode: z.literal("per-collection"),
  }),
})

export const AstraSyncMutationInputSchema = z.object({
  collection: AstraSyncCollectionSchema,
  schemaVersion: z.number().int().positive(),
  recordId: z.string().trim().min(1),
  operation: AstraSyncOperationSchema,
  clientMutationId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  clientUpdatedAt: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const AstraSyncMutationAckSchema = z.object({
  collection: AstraSyncCollectionSchema,
  clientMutationId: z.string().trim().min(1),
  recordId: z.string().trim().min(1),
  operation: AstraSyncOperationSchema,
  serverUpdatedAt: z.string().trim().min(1),
  cursor: z.string().trim().min(1),
  deduped: z.boolean().default(false),
})

export const AstraSyncMutationRejectionSchema = z.object({
  collection: AstraSyncCollectionSchema,
  clientMutationId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
})

export const AstraSyncMutationRecordSchema = AstraSyncMutationInputSchema.extend({
  ownerId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  serverMutationId: z.string().trim().min(1),
  serverUpdatedAt: z.string().trim().min(1),
  cursor: z.string().trim().min(1),
})

export const AstraSyncPushResponseSchema = z.object({
  serverTime: z.string().trim().min(1),
  accepted: z.array(AstraSyncMutationAckSchema).default([]),
  rejected: z.array(AstraSyncMutationRejectionSchema).default([]),
  nextCursors: z.record(AstraSyncCollectionSchema, z.string().trim().min(1).nullable()),
})

export const AstraSyncPullResponseSchema = z.object({
  serverTime: z.string().trim().min(1),
  deltas: z.record(AstraSyncCollectionSchema, z.array(AstraSyncMutationRecordSchema).default([])),
  nextCursors: z.record(AstraSyncCollectionSchema, z.string().trim().min(1).nullable()),
})

export const AstraSyncRepairRequestSchema = z.object({
  collections: z.array(AstraSyncCollectionSchema).min(1).default([
    "config",
    "vocabulary",
    "review_schedule",
    "reading_history",
    "study_progress",
  ]),
})

export const AstraSyncRepairRecordSchema = z.object({
  recordId: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().default(null),
  lastClientMutationId: z.string().trim().min(1),
  lastDeviceId: z.string().trim().min(1),
  lastServerUpdatedAt: z.string().trim().min(1),
  cursor: z.string().trim().min(1),
})

export const AstraSyncRepairCollectionSchema = z.object({
  enabled: z.boolean().default(false),
  defaultEnabled: z.boolean().default(false),
  latestCursor: z.string().trim().min(1).nullable().default(null),
  compactionFloorCursor: z.string().trim().min(1).nullable().default(null),
  records: z.array(AstraSyncRepairRecordSchema).default([]),
})

export const AstraSyncRepairResponseSchema = z.object({
  serverTime: z.string().trim().min(1),
  collections: z.record(AstraSyncCollectionSchema, AstraSyncRepairCollectionSchema),
})

export const AstraSessionSchema = z.object({
  version: z.literal(1).default(1),
  sessionToken: z.string().trim().min(1),
  sessionId: z.string().trim().min(1).nullable().default(null),
  deviceId: z.string().trim().min(1).nullable().default(null),
  identityMode: AstraIdentityModeSchema.default("authenticated"),
  relayBaseURL: z.string().trim().min(1),
  email: z.string().trim().min(1),
  plan: AstraPlanSchema.default("free"),
  subscriptionStatus: AstraSubscriptionStatusSchema.default("active"),
  providerEntitlements: z.array(ProviderIdSchema).default(["google_translate", "openai", "gemini"]),
  quota: AstraQuotaSchema.default({
    dailyRequestsLimit: 0,
    dailyCharactersLimit: 0,
    requestsPerMinuteLimit: 0,
    remainingDailyRequests: 0,
    remainingDailyCharacters: 0,
  }),
  usage: AstraUsageSchema.default({
    totalRequests: 0,
    totalCharacters: 0,
    dailyRequestsUsed: 0,
    dailyCharactersUsed: 0,
    lastRequestAt: null,
    recentEvents: [],
  }),
  issuedAt: z.string().trim().min(1).nullable().default(null),
  expiresAt: z.string().trim().min(1).nullable().default(null),
})

export const AstraSyncCollectionSummarySchema = z.object({
  enabled: z.boolean().default(false),
  defaultEnabled: z.boolean().default(false),
  cursor: z.string().trim().min(1).nullable().default(null),
  mutationCount: z.number().int().nonnegative().default(0),
  activeCount: z.number().int().nonnegative().default(0),
  lastSyncAt: z.string().trim().min(1).nullable().default(null),
  compactionFloorCursor: z.string().trim().min(1).nullable().default(null),
})

export const AstraAccountSummarySchema = z.object({
  serverTime: z.string().trim().min(1),
  account: AstraAccountSchema,
  usage: AstraUsageSnapshotSchema,
  session: z.object({
    sessionId: z.string().trim().min(1).nullable().default(null),
    deviceId: z.string().trim().min(1).nullable().default(null),
    issuedAt: z.string().trim().min(1).nullable().default(null),
    expiresAt: z.string().trim().min(1).nullable().default(null),
    identityMode: AstraIdentityModeSchema.default("authenticated"),
    status: AstraSessionSummaryStatusSchema.default("active"),
  }),
  devices: z.object({
    activeCount: z.number().int().nonnegative().default(0),
    revokedCount: z.number().int().nonnegative().default(0),
    current: AstraDeviceListEntrySchema.nullable().default(null),
    entries: z.array(AstraDeviceListEntrySchema).default([]),
  }),
  sync: z.object({
    maxMutationsPerRequest: z.number().int().positive(),
    collections: z.record(AstraSyncCollectionSchema, AstraSyncCollectionSummarySchema),
  }),
})

export const AstraContinuityLifecyclePolicySchema = z.object({
  exportArtifactRetentionDays: z.number().int().positive(),
  deleteGracePeriodSeconds: z.number().int().nonnegative(),
  jobHistoryRetentionDays: z.number().int().positive(),
  tombstoneRetentionDays: z.number().int().positive(),
})

export const AstraAccountExportRequestSchema = z.object({
  collections: z.array(AstraContinuityExportCollectionSchema).min(1).default([
    "config",
    "vocabulary",
    "review_schedule",
    "reading_history",
    "study_progress",
  ]),
})

export const AstraCloudDataDeleteRequestSchema = z.object({
  collections: z.array(AstraContinuityDeleteCollectionSchema).min(1),
})

export const AstraLifecycleJobErrorSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
}).nullable().default(null)

export const AstraAccountExportJobSchema = z.object({
  jobId: z.string().trim().min(1),
  scope: AstraAccountExportRequestSchema,
  status: AstraContinuityExportStatusSchema,
  requestedAt: z.string().trim().min(1),
  startedAt: z.string().trim().min(1).nullable().default(null),
  completedAt: z.string().trim().min(1).nullable().default(null),
  failedAt: z.string().trim().min(1).nullable().default(null),
  expiresAt: z.string().trim().min(1).nullable().default(null),
  artifact: z.object({
    objectKey: z.string().trim().min(1).nullable().default(null),
    sha256: z.string().trim().min(1).nullable().default(null),
    bytes: z.number().int().nonnegative().nullable().default(null),
    downloadPath: z.string().trim().min(1).nullable().default(null),
  }).default({
    objectKey: null,
    sha256: null,
    bytes: null,
    downloadPath: null,
  }),
  error: AstraLifecycleJobErrorSchema,
  policy: AstraContinuityLifecyclePolicySchema,
})

export const AstraCloudDataDeleteJobSchema = z.object({
  jobId: z.string().trim().min(1),
  scope: AstraCloudDataDeleteRequestSchema,
  status: AstraContinuityDeleteStatusSchema,
  requestedAt: z.string().trim().min(1),
  scheduledForAt: z.string().trim().min(1),
  startedAt: z.string().trim().min(1).nullable().default(null),
  completedAt: z.string().trim().min(1).nullable().default(null),
  failedAt: z.string().trim().min(1).nullable().default(null),
  canceledAt: z.string().trim().min(1).nullable().default(null),
  gracePeriodSeconds: z.number().int().nonnegative(),
  deletedRecords: z.object({
    vocabulary: z.number().int().nonnegative().optional(),
    review_schedule: z.number().int().nonnegative().optional(),
    reading_history: z.number().int().nonnegative().optional(),
    study_progress: z.number().int().nonnegative().optional(),
  }).default({}),
  error: AstraLifecycleJobErrorSchema,
  policy: AstraContinuityLifecyclePolicySchema,
})

export type AstraPlan = z.infer<typeof AstraPlanSchema>
export type AstraSubscriptionStatus = z.infer<typeof AstraSubscriptionStatusSchema>
export type AstraIdentityMode = z.infer<typeof AstraIdentityModeSchema>
export type AstraDevicePlatform = z.infer<typeof AstraDevicePlatformSchema>
export type AstraBrowserFamily = z.infer<typeof AstraBrowserFamilySchema>
export type AstraAppKind = z.infer<typeof AstraAppKindSchema>
export type AstraDeviceStatus = z.infer<typeof AstraDeviceStatusSchema>
export type AstraSyncOperation = z.infer<typeof AstraSyncOperationSchema>
export type AstraSessionSummaryStatus = z.infer<typeof AstraSessionSummaryStatusSchema>
export type AstraContinuityExportCollection = z.infer<typeof AstraContinuityExportCollectionSchema>
export type AstraContinuityDeleteCollection = z.infer<typeof AstraContinuityDeleteCollectionSchema>
export type AstraContinuityExportStatus = z.infer<typeof AstraContinuityExportStatusSchema>
export type AstraContinuityDeleteStatus = z.infer<typeof AstraContinuityDeleteStatusSchema>
export type AstraQuota = z.infer<typeof AstraQuotaSchema>
export type AstraUsage = z.infer<typeof AstraUsageSchema>
export type AstraUsageEvent = z.infer<typeof AstraUsageEventSchema>
export type AstraAccount = z.infer<typeof AstraAccountSchema>
export type AstraUsageSnapshot = z.infer<typeof AstraUsageSnapshotSchema>
export type AstraBillingLink = z.infer<typeof AstraBillingLinkSchema>
export type AstraDeviceIdentity = z.infer<typeof AstraDeviceIdentitySchema>
export type AstraDeviceListEntry = z.infer<typeof AstraDeviceListEntrySchema>
export type AstraDevicesResponse = z.infer<typeof AstraDevicesResponseSchema>
export type AstraSyncCollectionBootstrapState = z.infer<typeof AstraSyncCollectionBootstrapStateSchema>
export type AstraSyncBootstrap = z.infer<typeof AstraSyncBootstrapSchema>
export type AstraSyncMutationInput = z.infer<typeof AstraSyncMutationInputSchema>
export type AstraSyncMutationAck = z.infer<typeof AstraSyncMutationAckSchema>
export type AstraSyncMutationRejection = z.infer<typeof AstraSyncMutationRejectionSchema>
export type AstraSyncMutationRecord = z.infer<typeof AstraSyncMutationRecordSchema>
export type AstraSyncPushResponse = z.infer<typeof AstraSyncPushResponseSchema>
export type AstraSyncPullResponse = z.infer<typeof AstraSyncPullResponseSchema>
export type AstraSyncRepairRequest = z.infer<typeof AstraSyncRepairRequestSchema>
export type AstraSyncRepairRecord = z.infer<typeof AstraSyncRepairRecordSchema>
export type AstraSyncRepairCollection = z.infer<typeof AstraSyncRepairCollectionSchema>
export type AstraSyncRepairResponse = z.infer<typeof AstraSyncRepairResponseSchema>
export type AstraSession = z.infer<typeof AstraSessionSchema>
export type AstraSyncCollectionSummary = z.infer<typeof AstraSyncCollectionSummarySchema>
export type AstraAccountSummary = z.infer<typeof AstraAccountSummarySchema>
export type AstraContinuityLifecyclePolicy = z.infer<typeof AstraContinuityLifecyclePolicySchema>
export type AstraAccountExportRequest = z.infer<typeof AstraAccountExportRequestSchema>
export type AstraCloudDataDeleteRequest = z.infer<typeof AstraCloudDataDeleteRequestSchema>
export type AstraAccountExportJob = z.infer<typeof AstraAccountExportJobSchema>
export type AstraCloudDataDeleteJob = z.infer<typeof AstraCloudDataDeleteJobSchema>
