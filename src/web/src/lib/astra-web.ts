import { z } from "zod"

import {
  AstraAccountSchema,
  AstraDeviceIdentitySchema,
  AstraSessionSchema,
  type AstraAccount,
  type AstraAccountExportJob,
  type AstraAppKind,
  type AstraBrowserFamily,
  type AstraCloudDataDeleteJob,
  type AstraCloudLearningMemoryDeletionReceipt,
  type AstraCloudLearningMemoryInventory,
  type AstraContinuityDeleteCollection,
  type AstraContinuityExportCollection,
  type AstraDeviceIdentity,
  type AstraDeviceListEntry,
  type AstraDevicePlatform,
  type AstraPlan,
  type AstraSession,
  type AstraTrialLifecycleContract,
  type AstraWeeklyDigestPreferenceResponse,
  type AstraWeeklyDigestSnapshot,
  type AstraSyncBootstrap,
  type AstraUsageSnapshot,
  type AstraSyncRepairRequest,
  type AstraSyncRepairResponse,
} from "@/types/auth"
import {
  DEFAULT_ASTRA_CONFIG,
  applyConfigSyncMutations,
  buildSyncSafeConfig,
  AstraConfigSchema,
  type AstraSyncedConfig,
  type AstraConfig,
  type AstraConfigInput,
  type ProviderId,
} from "@/types/config"
import {
  createTranslationError,
  toTranslationError,
  type TranslationError,
} from "@/types/translation"
import type {
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"
import {
  VideoNoteArtifactResponseSchema,
  VideoNoteCreateResponseSchema,
  VideoNoteStatusResponseSchema,
  type VideoNoteArtifact,
  type VideoNoteCreateRequest,
  type VideoNoteCreateResponse,
  type VideoNoteStatusResponse,
} from "@/types/video-notes"
import {
  buildAstraAccountExportDownloadUrl,
  createAstraAccountExportJob,
  createAstraCheckoutLink,
  createAstraTrialIntent,
  createAstraCloudDataDeleteJob,
  createAstraPortalLink,
  deleteAstraCloudLearningMemory,
  fetchAstraAccount,
  fetchAstraAccountExportJob,
  fetchAstraAccountSummary,
  fetchAstraCloudDataDeleteJob,
  fetchAstraCloudLearningMemoryInventory,
  fetchAstraContinuitySnapshot,
  fetchAstraTrialIntent,
  fetchAstraWeeklyDigest,
  repairAstraSyncState,
  updateAstraWeeklyDigestPreference,
  fetchAstraDevices,
  fetchAstraUsageSnapshot,
  pushAstraSyncMutations,
  revokeAstraDevice,
  updateAstraSyncCollectionPreference,
} from "@/utils/astra/account"
import {
  applyReadingHistorySyncMutations,
  type SyncedReadingHistoryEntry,
} from "@/utils/storage/reading-history-core"
import {
  applyStudyProgressSyncMutations,
  type SyncedStudyPageProgress,
  type StudyStep,
} from "@/utils/storage/study-progress-core"
import {
  SyncedVocabularyEntrySchema,
  applySyncedVocabularyMutations,
  type SyncedVocabularyEntry,
} from "@/utils/storage/vocabulary-core"
import {
  getCachedTranslations,
  setCachedTranslation,
  type TranslationCacheContext,
} from "@/utils/cache/translation-cache"
import { translateWithRelay } from "@/utils/providers/relay"
import {
  buildLibraryDocumentSnapshotSyncPayloads,
  LibraryDocumentSnapshotSyncChunkSchema,
  LibraryDocumentSnapshotSyncManifestSchema,
  LibraryItemSchema,
  listLibraryDocumentSnapshots,
  toLibraryDocumentSnapshotChunkRecordId,
  toLibraryDocumentSnapshotManifestRecordId,
  type LibraryDocumentSnapshotSyncChunk,
  type LibraryDocumentSnapshotSyncManifest,
  type LibraryItem,
} from "./workspace-store"

const WEB_API_BASE_URL_STORAGE_KEY = "astra.web.api-base-url.v1"
const WEB_CONFIG_STORAGE_KEY = "astra.web.config.v1"
const WEB_SESSION_STORAGE_KEY = "astra.web.session.v1"
const WEB_DEVICE_STORAGE_KEY = "astra.web.device.v1"
const WEB_TEXT_TRANSFER_STORAGE_KEY = "astra.web.text-transfer.v1"
const WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY = "astra.web.auth-sign-in-key.v1"
const WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY = "astra.web.auth-anonymous-key.v1"

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787/v1"
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano"
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

const TextTransferDraftSchema = z.object({
  title: z.string().trim().min(1),
  source: z.enum(["article", "pdf", "epub", "subtitle"]),
  text: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
})

const PendingWebSignInSchema = z.object({
  email: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
})

export type WebDeviceEntry = AstraDeviceListEntry
export type WebCloudLearningMemoryInventory = AstraCloudLearningMemoryInventory
export type WebCloudLearningMemoryDeletionReceipt = AstraCloudLearningMemoryDeletionReceipt
export type WebWeeklyDigestSnapshot = AstraWeeklyDigestSnapshot
export type WebWeeklyDigestPreferenceResponse = AstraWeeklyDigestPreferenceResponse
export type TextTransferDraft = z.infer<typeof TextTransferDraftSchema>

interface WebCloudCollectionHealth {
  key: "config" | "vocabulary" | "reading_history" | "study_progress"
  enabled: boolean
  defaultEnabled: boolean
  cursor: string | null
  mutationCount: number
  activeCount: number
}

interface WebCloudStudyProgressCoverage {
  read: number
  guided_read: number
  explain: number
  vocab_save: number
  vocab_review: number
}

export interface WebCloudLibraryDocumentSnapshot {
  libraryItemId: string
  manifest: LibraryDocumentSnapshotSyncManifest
  chunks: LibraryDocumentSnapshotSyncChunk[]
  complete: boolean
}

const WebSyncedDeepReadSessionRecordSchema = z.object({
  pageUrl: z.string().trim().min(1),
  pageTitle: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  metaDescription: z.string().trim().min(1).optional(),
  contentSummary: z.string().trim().min(1).optional(),
  articleExcerpt: z.string().trim().min(1).optional(),
  sentences: z.array(z.string().trim().min(1)).max(20),
  selectedSentenceAnchor: z.object({
    sentenceText: z.string().trim().min(1).optional(),
    sentenceHash: z.string().trim().min(1).optional(),
    sentenceIndex: z.number().int().nonnegative().optional(),
  }).optional(),
  selectedSentenceIndex: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type WebSyncedDeepReadSessionRecord = z.infer<typeof WebSyncedDeepReadSessionRecordSchema>

interface WebArticleImportRecentFailure {
  jobId: string
  status: "failed" | "dead_lettered" | string
  route: string
  surface: string
  targetHostname: string | null
  traceId: string
  errorCode: string | null
  lastFailureErrorCode: string | null
  fallbackReason: string | null
  queueAttemptCount: number
  replayCount: number
  deadLetteredAtEpochMs: number | null
  lastReplayedAtEpochMs: number | null
  lastReplayReason: string | null
  updatedAtEpochMs: number
}

export interface WebImportQueueObservability {
  fetchedAt: string
  environment: string
  requestId: string
  articleImport: {
    defaultMode: string
    queuePolicy: {
      maxAttempts: number
      operatorReplayEnabled: boolean
    }
    backlog: {
      queued: number
      failed: number
      deadLettered: number
      oldestQueuedAgeMs: number | null
    }
    routeCounts: Record<string, number>
    statusCounts: Record<string, number>
    surfaceCounts: Record<string, number>
    recentFailures: WebArticleImportRecentFailure[]
  }
}

export interface WebImportReplayResult {
  dryRun: boolean
  requestId: string
  summary: {
    selected: number
    replayed: number
    skipped: number
  }
}

export type WebFeatureFlagStatus = "on" | "off" | "gradual" | "kill"
export type WebFeatureFlagKey =
  | "ui.onboarding_goal_question"
  | "ui.library_home"
  | "ai.deep_explanation"
  | "ai.card_generation"
  | "source.video_learning"
  | "source.file_learning"
  | "safety.memory_writes"
  | "sync.learning_assets"
  | "emergency.disable_managed_ai"
  | "emergency.disable_long_content"
  | "emergency.disable_feature_for_site"
  | "emergency.disable_task_class"
  | "emergency.force_fast_mode"
  | "emergency.disable_provider_route"
  | "emergency.limit_free_high_cost"
  | "emergency.disable_digest"
  | "emergency.disable_share"
  | "emergency.privacy_lockdown"
export type WebKillSwitchCategory = "feature" | "site" | "task" | "tier" | "provider" | "privacy"

export interface WebFeatureFlagOverride {
  key: WebFeatureFlagKey
  status?: WebFeatureFlagStatus
  rolloutPercent?: number
  reason?: string
  changedBy?: string
  changedAt?: string
}

export interface WebKillSwitchRule {
  id: string
  category: WebKillSwitchCategory
  enabled: boolean
  reason: string
  safeMode: boolean
  fallbackMessage: string
  featureKey?: WebFeatureFlagKey
  hostname?: string
  taskClass?: string
  tier?: string
  providerId?: ProviderId
  privacyMode?: boolean
  surface?: string
}

export interface WebFeatureFlagChangeLogEntry {
  id: string
  changedAt: string
  changedBy: string
  reason: string
  overrideCount: number
  killSwitchCount: number
  previousGeneratedAt: string | null
}

export interface WebFeatureFlagRuntime {
  schema: "astra-feature-flag-runtime.v1"
  generatedAt: string
  overrides: WebFeatureFlagOverride[]
  killSwitches: WebKillSwitchRule[]
  changeLog: WebFeatureFlagChangeLogEntry[]
}

export interface WebCostUsageSummaryBucket {
  tier: string
  taskClass: string
  costBucket: string
  eventCount: number
  requestCount: number
  characterCount: number
  successCount: number
  failureCount: number
  fallbackCount: number
  estimatedSpendUsd: number
}

export interface WebCostUsageServiceModeSummary {
  serviceMode: string
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

export interface WebCostUsageCacheStatusSummary {
  cacheStatus: string
  eventCount: number
  requestCount: number
  characterCount: number
  share: number
  estimatedSpendUsd: number
}

export type WebCostUsageSpikeStatus = "none" | "watch" | "spike"
export type WebCostUsageRiskLevel = "low" | "watch" | "high"

export interface WebCostUsageDailyEstimateSummary {
  date: string | null
  estimatedSpendUsd: number
  previousDate: string | null
  previousEstimatedSpendUsd: number
  spikeRatio: number | null
  spikeStatus: WebCostUsageSpikeStatus
  riskLevel: WebCostUsageRiskLevel
}

export interface WebCostUsageSummary {
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
  dailyEstimate: WebCostUsageDailyEstimateSummary
  buckets: WebCostUsageSummaryBucket[]
  byServiceMode: WebCostUsageServiceModeSummary[]
  byCacheStatus: WebCostUsageCacheStatusSummary[]
}

export interface WebOpsCockpitSummary {
  schema: "astra-ops-cockpit-summary.v1"
  generatedAt: string
  privacy: {
    metadataOnly: boolean
    aggregateOnly: boolean
    readOnly: boolean
    contentIncluded: boolean
    perUserRows: boolean
    identifiersIncluded: boolean
    providerBillingIncluded: boolean
    crmRepliesIncluded: boolean
  }
  sources: {
    costUsageSummary: boolean
    supportReportSummary: boolean
    cancellationReasonSummary: boolean
    analyticsCohortSummary: boolean
    mobileRetentionSummary: boolean
    weeklyDigestDeliverySummary: boolean
    providerHealthSummary: boolean
    operatingReviewHelpers: boolean
  }
  metrics: {
    cost: {
      retainedEvents: number
      requests: number
      estimatedSpendUsd: number
      dailyEstimatedSpendUsd: number
      dailyRiskLevel: string
      dailySpikeStatus: string
      cacheHitRate: number | null
      topCostTaskClass: string | null
    }
    support: {
      totalReports: number
      weeklyTopIssueCount: number
      unresolvedCount: number
      urgentUnresolvedCount: number
      staleTriageCount: number
      followUpOverdueCount: number
      oldestUnresolvedAgeDays: number | null
      macroCoverageRate: number | null
    }
    retentionGrowth: {
      analyticsGrain: string
      analyticsEvents: number
      mobileRetentionGrain: string
      mobileRetentionEvents: number
      weeklyDigestDeliveryRuns: number
      cancellationSubmissions: number
      cancellationReasonCoverageRate: number | null
      topCancellationReason: string | null
    }
    providerHealth: {
      available: boolean
      retainedEvents: number
      incidentBucketCount: number
      watchBucketCount: number
    }
  }
  reviewCadence: Array<{
    cadence: string
    label: string
    focus: string
    requiredEvidence: string[]
    availableEvidence: string[]
    missingEvidence: string[]
  }>
  experimentGuardrails: Array<{
    area: string
    successMetric: string
    guardrailMetrics: string[]
    privacyRule: string
  }>
  riskFlags: Array<{ code: string; severity: "watch" | "pause_growth"; message: string }>
}

export type WebProviderHealthStatus = "healthy" | "watch" | "incident"

export interface WebProviderHealthSummaryBucket {
  provider: string
  model: string
  serviceMode: string
  taskClass: string
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
  healthStatus: WebProviderHealthStatus
}

export interface WebProviderHealthSummary {
  schema: "astra-provider-health-summary.v1"
  generatedAt: string
  source: "recent_user_usage_events"
  recentEventsPerUserLimit: number
  totalEvents: number
  totalRequests: number
  totalCharacters: number
  buckets: WebProviderHealthSummaryBucket[]
}

export type WebOpsUserUsageCategory = "light" | "normal" | "heavy" | "extreme"

export interface WebOpsUserLookupTaskSummary {
  taskClass: string
  eventCount: number
  successCount: number
  failureCount: number
  fallbackCount: number
  latencySampleCount: number
  latencyP95Ms: number | null
}

export interface WebOpsUserLookupResultWindow {
  mode: "exact_lookup"
  limit: number
  cursor: string | null
  nextCursor: string | null
  returnedCount: number
  totalMatched: number
  hasMore: boolean
}

export interface WebOpsUserLookupSnapshotBoundary {
  metadataOnly: boolean
  contentIncluded: boolean
  rawQueryIncluded: boolean
  exportAvailable: boolean
  recentTaskSummaryLimit: number
  excludedFields: string[]
}

export interface WebOpsUserLookupSummary {
  schema: "astra-ops-user-lookup.v1"
  generatedAt: string
  queryType: "email" | "email_hash" | "user_id"
  resultWindow: WebOpsUserLookupResultWindow
  snapshotBoundary: WebOpsUserLookupSnapshotBoundary
  user: {
    userId: string
    emailHash: string
    createdAt: string
    plan: string
    subscriptionStatus: string
    identityMode: string
    providerEntitlementCount: number
    limits: {
      dailyRequests: number
      dailyCharacters: number
      requestsPerMinute: number
    }
    usage: {
      usageDay: string
      requestsToday: number
      charactersToday: number
      totalRequests: number
      totalCharacters: number
      lastRequestAt: string | null
      recentEventCount: number
      usageCategory: WebOpsUserUsageCategory
    }
    devices: {
      activeCount: number
      revokedCount: number
    }
    sessions: {
      activeCount: number
      revokedCount: number
    }
    recentTaskSummary: WebOpsUserLookupTaskSummary[]
  }
}

export interface WebOpsAuditLogEntry {
  id: string
  timestamp: string
  actor: "operator" | "user" | "system"
  action: string
  outcome: "success" | "denied" | "failure"
  operatorTokenHash: string | null
  subjectUserId: string | null
  subjectEmailHash: string | null
  supportReportId: string | null
  metadata: Record<string, string | number | boolean | null>
  privacy: {
    userConsent: boolean | null
    contentIncluded: boolean
    contentAccess: "none" | "metadata_only" | "user_consented_content"
  }
}

export interface WebOpsAuditSummary {
  schema: "astra-ops-audit-summary.v1"
  generatedAt: string
  totalEvents: number
  retainedEventLimit: number
  byAction: Array<{ action: string; count: number }>
  byActor: Array<{ actor: string; count: number }>
  privacy: {
    userConsentTrueCount: number
    metadataOnlyCount: number
    contentIncludedCount: number
  }
  recent: WebOpsAuditLogEntry[]
}

export interface WebCancellationReasonSummary {
  schema: "astra-cancellation-reason-summary.v1"
  generatedAt: string
  totalSubmissions: number
  retainedEventLimit: number
  reasonCoverage: {
    submittedCount: number
    unknownReasonCount: number
    coverageRate: number | null
  }
  byReason: Array<{
    reason: string
    label: string
    productMeaning: string
    count: number
    share: number
  }>
  byPlan: Array<{ plan: string; count: number }>
  bySource: Array<{ source: string; count: number }>
}

export type WebSupportReportTriageStatus = "new" | "investigating" | "waiting_for_user" | "linked_known_issue" | "resolved" | "wont_fix"
export type WebSupportReportTriagePriority = "low" | "normal" | "high" | "urgent"
export type WebSupportReportFollowUpPath = "not_selected" | "known_issue" | "email_follow_up" | "support_queue" | "no_follow_up_needed"
export type WebSupportReportFollowUpStatus = "not_started" | "selected" | "handed_off" | "completed"
export type WebSupportReportFollowUpReason = "matched_known_issue" | "needs_manual_email" | "needs_support_queue_review" | "macro_ready" | "no_follow_up_needed" | "other_metadata_reason"

export interface WebSupportReportFollowUp {
  path: WebSupportReportFollowUpPath
  status: WebSupportReportFollowUpStatus
  macroId: string | null
  reason: WebSupportReportFollowUpReason | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface WebSupportFirstResponseMacro {
  id: string
  issueCategory: string
  title: string
  firstResponse: string
  nextStep: string
  privacyNote: string
  surfaces: string[]
}

export interface WebSupportReportTriage {
  status: WebSupportReportTriageStatus
  assignedTo: string | null
  priority: WebSupportReportTriagePriority
  resolution: string | null
  updatedAt: string | null
  updatedBy: string | null
  followUp: WebSupportReportFollowUp
}

export interface WebSupportReportSummaryBucket {
  key: string
  count: number
  latestSubmittedAt: string
  hostname: string | null
  featureSurface: string
  issueCategory: string | null
  extensionVersion: string
  browser: string
  membershipState: string
  privacyMode: boolean
  knownIssueId: string | null
  knownIssueStatus: string | null
  triageStatus: WebSupportReportTriageStatus
}

export interface WebSupportFirstResponseMacroSummary {
  schema: "astra-support-first-response-macros.v1" | string
  generatedAt: string
  threshold: number
  catalogCoverage: {
    coveredIssueCategories: number
    totalIssueCategories: number
    coverageRate: number
    ready: boolean
  }
  reportedCoverage: {
    coveredReports: number
    totalReports: number
    unknownIssueReports: number
    coverageRate: number | null
    ready: boolean | null
  }
  byIssueCategory: Array<{
    issueCategory: string
    count: number
    macroId: string | null
    title: string | null
    covered: boolean
  }>
  macros: Array<{
    id: string
    issueCategory: string
    title: string
    firstResponse: string
    nextStep: string
    privacyNote: string
    surfaces: string[]
  }>
}

export interface WebSupportReportWeeklyTopIssue {
  weekStart: string
  key: string
  reportCount: number
  latestSubmittedAt: string
  hostname: string | null
  featureSurface: string
  issueCategory: string | null
  knownIssueId: string | null
  knownIssueStatus: string | null
}

export interface WebSupportReportHandoffSummary {
  byPath: Array<{ path: WebSupportReportFollowUpPath; count: number }>
  byStatus: Array<{ status: WebSupportReportFollowUpStatus; count: number }>
}

export interface WebSupportReportSlaRiskSummary {
  generatedAt: string
  currentNow: string
  unresolvedCount: number
  urgentUnresolvedCount: number
  staleTriageByAgeBucket: {
    under24h: number
    from24hTo72h: number
    from72hTo168h: number
    over168h: number
  }
  followUpOverdueCount: number
  oldestUnresolvedAgeHours: number | null
  oldestUnresolvedAgeDays: number | null
}

export interface WebSupportReportSummary {
  totalReports: number
  generatedAt: string
  buckets: WebSupportReportSummaryBucket[]
  weeklyTopIssues: WebSupportReportWeeklyTopIssue[]
  macroCoverage: WebSupportFirstResponseMacroSummary | null
  handoffSummary: WebSupportReportHandoffSummary
  slaRisk: WebSupportReportSlaRiskSummary
}

export interface WebSupportReportListEntry {
  reportId: string
  status: string
  createdAt: string
  updatedAt: string
  submittedAt: string
  ownerEmail: string
  deviceId: string
  sessionId: string
  featureSurface: string
  action: string
  issueCategory: string | null
  errorCategory: string | null
  lastErrorCategory: string | null
  runtimeSurface: string | null
  hostname: string | null
  extensionVersion: string
  browser: string
  os: string
  locale: string
  membershipState: string
  privacyMode: boolean
  userMessageIncluded: boolean
  contactIncluded: boolean
  defaultContentIncluded: boolean
  knownIssue: { issueId: string; status: string; severity: string; workaroundKey: string | null } | null
  triage: WebSupportReportTriage
  recommendedMacro: WebSupportFirstResponseMacro | null
}

export interface WebSupportReportList {
  schema: "astra-support-report-inbox.v1" | string
  reports: WebSupportReportListEntry[]
}

export interface WebSupportReportTriageUpdate {
  status?: WebSupportReportTriageStatus
  assignedTo?: string | null
  priority?: WebSupportReportTriagePriority
  resolution?: string | null
  updatedBy?: string | null
  followUp?: Partial<WebSupportReportFollowUp>
}

export type WebTrialLifecycleContract = AstraTrialLifecycleContract
export type WebContinuityExportJob = AstraAccountExportJob
export type WebCloudDataDeleteJob = AstraCloudDataDeleteJob
export type WebSyncRepairResult = AstraSyncRepairResponse
export type WebVideoNoteCreateResponse = VideoNoteCreateResponse
export type WebVideoNoteStatusResponse = VideoNoteStatusResponse
export type WebVideoNoteArtifact = VideoNoteArtifact

export interface WebCloudAssetsWorkspace {
  serverTime: string | null
  fetchedAt: string
  bootstrap: AstraSyncBootstrap["collections"] | null
  config: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    recordCount: number
    syncedConfig: AstraSyncedConfig
  }
  vocabulary: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    count: number
    entries: SyncedVocabularyEntry[]
  }
  readingHistory: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    count: number
    entries: SyncedReadingHistoryEntry[]
  }
  studyProgress: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    pageCount: number
    pages: SyncedStudyPageProgress[]
    stepCoverage: WebCloudStudyProgressCoverage
  }
  deepReadSessions: {
    count: number
    sessions: WebSyncedDeepReadSessionRecord[]
  }
  library: {
    count: number
    items: LibraryItem[]
    snapshotCount: number
    snapshots: WebCloudLibraryDocumentSnapshot[]
  }
  syncHealth: {
    activeDeviceCount: number
    totalDeviceCount: number
    currentDeviceLastSyncAt: string | null
    maxMutationsPerRequest: number | null
    collections: WebCloudCollectionHealth[]
  }
  deferredCollections: Array<"reading_history" | "study_progress">
}

export interface WebTranslateRequest {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
  placeholderFormat?: TranslationPlaceholderFormat
}

export type WebTranslateResult =
  | { ok: true; translations: string[]; providerId: ProviderId }
  | { ok: false; error: TranslationError }

interface TranslateBatch {
  originalIndices: number[]
  texts: string[]
  charCount: number
}

interface TranslateSegment {
  originalIndex: number
  text: string
}

const MAX_BATCH_ITEMS = 12
const MAX_BATCH_CHARS = 8000
const MAX_CONCURRENCY = 4
const WEB_OWNED_READING_CONFIG_RECORD_PREFIX = "__owned_reading_metadata_v1__:"
const WEB_DEEP_READ_SESSION_CONFIG_RECORD_PREFIX = "__deep_read_session_v1__:"
const WEB_LIBRARY_CONFIG_RECORD_PREFIX = "__web_library_metadata_v1__:"
const WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX = "__web_library_document_snapshot_v1__:"

function createEmptyStudyProgressCoverage(): WebCloudStudyProgressCoverage {
  return {
    read: 0,
    guided_read: 0,
    explain: 0,
    vocab_save: 0,
    vocab_review: 0,
  }
}

function summarizeStudyProgressCoverage(pages: SyncedStudyPageProgress[]): WebCloudStudyProgressCoverage {
  return pages.reduce<WebCloudStudyProgressCoverage>((coverage, page) => {
    page.completedSteps.forEach((step) => {
      coverage[step as StudyStep] += 1
    })
    return coverage
  }, createEmptyStudyProgressCoverage())
}

function isWebPrivateConfigRecordId(recordId: string): boolean {
  return recordId.startsWith(WEB_OWNED_READING_CONFIG_RECORD_PREFIX)
    || recordId.startsWith(WEB_DEEP_READ_SESSION_CONFIG_RECORD_PREFIX)
    || recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)
    || recordId.startsWith(WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX)
}

function parseWebLibraryItems(
  mutations: Array<{ recordId: string; operation: "upsert" | "delete"; payload?: unknown; serverUpdatedAt?: string }>,
): LibraryItem[] {
  const byId = new Map<string, LibraryItem>()
  const deleted = new Set<string>()

  for (const mutation of mutations) {
    if (!mutation.recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)) continue
    const libraryItemId = mutation.recordId.slice(WEB_LIBRARY_CONFIG_RECORD_PREFIX.length)
    if (!libraryItemId) continue

    if (mutation.operation === "delete") {
      byId.delete(libraryItemId)
      deleted.add(libraryItemId)
      continue
    }

    if (deleted.has(libraryItemId)) {
      deleted.delete(libraryItemId)
    }

    const parsed = LibraryItemSchema.safeParse(mutation.payload)
    if (parsed.success && !parsed.data.removedAt) {
      byId.set(parsed.data.id, parsed.data)
    }
  }

  return Array.from(byId.values()).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

function parseWebLibraryDocumentSnapshots(
  mutations: Array<{ recordId: string; operation: "upsert" | "delete"; payload?: unknown; serverUpdatedAt?: string }>,
): WebCloudLibraryDocumentSnapshot[] {
  const manifests = new Map<string, LibraryDocumentSnapshotSyncManifest>()
  const chunks = new Map<string, LibraryDocumentSnapshotSyncChunk[]>()
  const deleted = new Set<string>()

  for (const mutation of mutations) {
    if (!mutation.recordId.startsWith(WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX)) continue
    const manifestMatch = /^__web_library_document_snapshot_v1__:(.+):manifest$/.exec(mutation.recordId)
    const chunkMatch = /^__web_library_document_snapshot_v1__:(.+):chunk:(\d+)$/.exec(mutation.recordId)
    const libraryItemId = manifestMatch?.[1] ?? chunkMatch?.[1] ?? null
    if (!libraryItemId) continue

    if (mutation.operation === "delete") {
      manifests.delete(libraryItemId)
      chunks.delete(libraryItemId)
      deleted.add(libraryItemId)
      continue
    }

    if (deleted.has(libraryItemId)) deleted.delete(libraryItemId)

    if (manifestMatch) {
      const parsed = LibraryDocumentSnapshotSyncManifestSchema.safeParse(mutation.payload)
      if (parsed.success && parsed.data.libraryItemId === libraryItemId) {
        manifests.set(libraryItemId, parsed.data)
      }
      continue
    }

    if (chunkMatch) {
      const parsed = LibraryDocumentSnapshotSyncChunkSchema.safeParse(mutation.payload)
      if (parsed.success && parsed.data.libraryItemId === libraryItemId) {
        const list = chunks.get(libraryItemId) ?? []
        list[parsed.data.chunkIndex] = parsed.data
        chunks.set(libraryItemId, list)
      }
    }
  }

  return Array.from(manifests.entries())
    .map(([libraryItemId, manifest]) => {
      const orderedChunks = (chunks.get(libraryItemId) ?? []).filter(Boolean).sort((left, right) => left.chunkIndex - right.chunkIndex)
      return {
        libraryItemId,
        manifest,
        chunks: orderedChunks,
        complete: manifest.extractedTextStatus !== "available" || (orderedChunks.length === manifest.chunkCount && orderedChunks.every((chunk, index) => chunk.chunkIndex === index)),
      }
    })
    .sort((left, right) => right.manifest.updatedAt - left.manifest.updatedAt)
}

function toLibraryMetadataRecordId(itemId: string): string {
  return `${WEB_LIBRARY_CONFIG_RECORD_PREFIX}${itemId}`
}

function createWebClientMutationId(prefix: string): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && "randomUUID" in cryptoApi) {
    return `${prefix}:${cryptoApi.randomUUID()}`
  }
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

function chunkMutations<T>(mutations: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < mutations.length; index += size) {
    chunks.push(mutations.slice(index, index + size))
  }
  return chunks
}

function parseWebDeepReadSessions(
  mutations: Array<{ recordId: string; operation: "upsert" | "delete"; payload?: unknown }>,
): WebSyncedDeepReadSessionRecord[] {
  return mutations
    .filter((mutation) => mutation.recordId.startsWith(WEB_DEEP_READ_SESSION_CONFIG_RECORD_PREFIX))
    .filter((mutation) => mutation.operation === "upsert")
    .map((mutation) => WebSyncedDeepReadSessionRecordSchema.safeParse(mutation.payload))
    .filter((parsed): parsed is { success: true; data: WebSyncedDeepReadSessionRecord } => parsed.success)
    .map((parsed) => parsed.data)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

function readStringStorage(key: string): string | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStringStorage(key: string, value: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage write failures so the web shell can still run in restricted contexts.
  }
}

function readJsonStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = readStringStorage(key)
  if (!raw) return null

  try {
    return schema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeJsonStorage(key: string, value: unknown) {
  writeStringStorage(key, JSON.stringify(value))
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage removal failures for the same reason as writes above.
  }
}

export function normalizeApiBaseUrl(value: string | null | undefined): string {
  const raw = value?.trim()
  if (!raw) return DEFAULT_API_BASE_URL

  try {
    const url = new URL(raw)
    const normalizedPath = url.pathname.replace(/\/+$/, "")
    url.pathname = !normalizedPath || normalizedPath === "/"
      ? "/v1"
      : normalizedPath
    return url.toString().replace(/\/+$/, "")
  } catch {
    return raw.replace(/\/+$/, "")
  }
}

export function readApiBaseUrl(): string {
  return normalizeApiBaseUrl(readStringStorage(WEB_API_BASE_URL_STORAGE_KEY) ?? import.meta.env.VITE_ASTRA_API_BASE_URL)
}

export function readArticleImportBaseUrl(fallbackBaseUrl?: string | null): string {
  return normalizeApiBaseUrl(import.meta.env.VITE_ASTRA_PLATFORM_BASE_URL ?? fallbackBaseUrl ?? readApiBaseUrl())
}

export function saveApiBaseUrl(baseUrl: string): string {
  const normalized = normalizeApiBaseUrl(baseUrl)
  writeStringStorage(WEB_API_BASE_URL_STORAGE_KEY, normalized)
  return normalized
}

function generateOpaqueDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `astra-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createOpaqueIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `astra-web-idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase()
}

function detectPlatform(): AstraDevicePlatform {
  const userAgent = globalThis.navigator?.userAgent ?? ""
  const platform = globalThis.navigator?.platform ?? ""
  const normalized = `${platform} ${userAgent}`.toLowerCase()

  if (normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("ios")) return "ios"
  if (normalized.includes("android")) return "android"
  if (normalized.includes("mac")) return "macos"
  if (normalized.includes("win")) return "windows"
  if (normalized.includes("linux")) return "linux"
  return "unknown"
}

function detectBrowserFamily(): AstraBrowserFamily {
  const userAgent = (globalThis.navigator?.userAgent ?? "").toLowerCase()

  if (userAgent.includes("edg/")) return "edge"
  if (userAgent.includes("firefox/")) return "firefox"
  if (userAgent.includes("safari/") && !userAgent.includes("chrome/") && !userAgent.includes("chromium/")) return "safari"
  if (userAgent.includes("chrome/") || userAgent.includes("chromium/") || userAgent.includes("crios/")) return "chrome"
  return "unknown"
}

function detectAppKind(): AstraAppKind {
  const standaloneMedia = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(display-mode: standalone)").matches

  const legacyStandalone = typeof navigator !== "undefined"
    && "standalone" in navigator
    && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  return standaloneMedia || legacyStandalone ? "pwa" : "web"
}

function formatPlatformLabel(platform: AstraDevicePlatform): string {
  switch (platform) {
    case "macos":
      return "macOS"
    case "ios":
      return "iOS"
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1)
  }
}

function formatBrowserLabel(browserFamily: AstraBrowserFamily): string {
  switch (browserFamily) {
    case "edge":
      return "Edge"
    case "firefox":
      return "Firefox"
    case "safari":
      return "Safari"
    case "chrome":
      return "Chrome"
    default:
      return "Browser"
  }
}

function createDeviceIdentity(): AstraDeviceIdentity {
  const now = new Date().toISOString()
  const platform = detectPlatform()
  const browserFamily = detectBrowserFamily()
  const appKind = detectAppKind()

  return AstraDeviceIdentitySchema.parse({
    version: 1,
    deviceId: generateOpaqueDeviceId(),
    label: `${formatBrowserLabel(browserFamily)} on ${formatPlatformLabel(platform)}`,
    platform,
    browserFamily,
    appKind,
    appVersion: "0.1.0-web",
    createdAt: now,
    updatedAt: now,
  })
}

export function ensureWebDeviceIdentity(): AstraDeviceIdentity {
  const existing = readJsonStorage(WEB_DEVICE_STORAGE_KEY, AstraDeviceIdentitySchema)
  if (existing) {
    const refreshed = AstraDeviceIdentitySchema.parse({
      ...existing,
      appKind: detectAppKind(),
      updatedAt: new Date().toISOString(),
    })
    writeJsonStorage(WEB_DEVICE_STORAGE_KEY, refreshed)
    return refreshed
  }

  const created = createDeviceIdentity()
  writeJsonStorage(WEB_DEVICE_STORAGE_KEY, created)
  return created
}

function normalizeSessionPayload(
  payload: unknown,
  fallback: Pick<AstraSession, "deviceId" | "identityMode" | "relayBaseURL">,
): AstraSession {
  const candidate = typeof payload === "object" && payload !== null
    ? payload as Record<string, unknown>
    : {}

  return AstraSessionSchema.parse({
    ...candidate,
    deviceId: typeof candidate.deviceId === "string" ? candidate.deviceId : fallback.deviceId,
    identityMode:
      candidate.identityMode === "anonymous" || candidate.identityMode === "authenticated"
        ? candidate.identityMode
        : fallback.identityMode,
    relayBaseURL: typeof candidate.relayBaseURL === "string" && candidate.relayBaseURL.trim().length > 0
      ? candidate.relayBaseURL
      : fallback.relayBaseURL,
  })
}

async function readErrorMessage(response: Response, fallbackPrefix: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message || payload.message || `${fallbackPrefix} (${response.status})`
  } catch {
    return `${fallbackPrefix} (${response.status})`
  }
}

async function readAuthRequestFailure(response: Response, fallbackPrefix: string): Promise<{
  message: string
  fallbackReason: string | null
}> {
  const fallbackReason = response.headers.get("x-astra-platform-fallback-reason")?.trim() || null
  return {
    message: await readErrorMessage(response, fallbackPrefix),
    fallbackReason,
  }
}

function readPendingWebSignInAttempt(): z.infer<typeof PendingWebSignInSchema> | null {
  const attempt = readJsonStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY, PendingWebSignInSchema)
  if (!attempt) {
    removeStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY)
    return null
  }

  return {
    email: normalizeAccountEmail(attempt.email),
    idempotencyKey: attempt.idempotencyKey.trim(),
  }
}

function savePendingWebSignInAttempt(email: string, idempotencyKey: string) {
  writeJsonStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY, PendingWebSignInSchema.parse({
    email: normalizeAccountEmail(email),
    idempotencyKey: idempotencyKey.trim(),
  }))
}

function clearPendingWebSignInAttempt() {
  removeStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY)
}

function readPendingAnonymousSessionKey(): string | null {
  const key = readStringStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY)?.trim()
  if (!key) {
    removeStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY)
    return null
  }
  return key
}

function savePendingAnonymousSessionKey(idempotencyKey: string) {
  writeStringStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY, idempotencyKey.trim())
}

function clearPendingAnonymousSessionKey() {
  removeStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY)
}

export function readWebSession(): AstraSession | null {
  return readJsonStorage(WEB_SESSION_STORAGE_KEY, AstraSessionSchema)
}

export function saveWebSession(session: AstraSession): AstraSession {
  const normalized = AstraSessionSchema.parse(session)
  writeJsonStorage(WEB_SESSION_STORAGE_KEY, normalized)
  return normalized
}

export function clearWebSession() {
  removeStorage(WEB_SESSION_STORAGE_KEY)
}

export function readWebConfig(): AstraConfig {
  const stored = readJsonStorage(WEB_CONFIG_STORAGE_KEY, AstraConfigSchema)
  return AstraConfigSchema.parse({
    ...DEFAULT_ASTRA_CONFIG,
    ...(stored ?? {}),
    connectionMode: "astra",
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...(stored?.provider ?? {}),
      accessToken: "",
      apiKey: "",
    },
  })
}

export function saveWebConfig(config: AstraConfig): AstraConfig {
  const normalized = AstraConfigSchema.parse({
    ...config,
    connectionMode: "astra",
    provider: {
      ...config.provider,
      accessToken: "",
      apiKey: "",
    },
  })
  writeJsonStorage(WEB_CONFIG_STORAGE_KEY, normalized)
  return normalized
}

export function mergeWebConfig(current: AstraConfig, patch: AstraConfigInput): AstraConfig {
  const next = AstraConfigSchema.parse({
    ...current,
    ...patch,
    connectionMode: "astra",
    provider: {
      ...current.provider,
      ...(patch.provider ?? {}),
      accessToken: "",
      apiKey: "",
    },
    tts: {
      ...current.tts,
      ...(patch.tts ?? {}),
    },
    presentation: {
      ...current.presentation,
      ...(patch.presentation ?? {}),
    },
    sites: {
      ...current.sites,
      ...(patch.sites ?? {}),
    },
    customActions: patch.customActions ?? current.customActions,
  })

  return saveWebConfig(next)
}

export async function createWebSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
  email: string
  password: string
}): Promise<AstraSession> {
  const baseURL = normalizeApiBaseUrl(params.baseURL)
  const normalizedEmail = normalizeAccountEmail(params.email)
  const pendingAttempt = readPendingWebSignInAttempt()
  const idempotencyKey = pendingAttempt?.email === normalizedEmail
    ? pendingAttempt.idempotencyKey
    : createOpaqueIdempotencyKey()

  if (pendingAttempt?.email !== normalizedEmail || pendingAttempt?.idempotencyKey !== idempotencyKey) {
    savePendingWebSignInAttempt(normalizedEmail, idempotencyKey)
  }

  try {
    const response = await fetch(`${baseURL}/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-Astra-Device-Id": params.device.deviceId,
      },
      body: JSON.stringify({
        email: params.email.trim(),
        password: params.password,
        deviceId: params.device.deviceId,
        device: {
          label: params.device.label,
          platform: params.device.platform,
          browserFamily: params.device.browserFamily,
          appKind: params.device.appKind,
          appVersion: params.device.appVersion,
        },
      }),
    })

    if (!response.ok) {
      const error = await readAuthRequestFailure(response, "Astra sign-in failed")
      if (error.fallbackReason !== "mirror_back_commit_unknown") {
        clearPendingWebSignInAttempt()
      }
      throw new Error(error.message)
    }

    clearPendingWebSignInAttempt()
    return normalizeSessionPayload(await response.json(), {
      deviceId: params.device.deviceId,
      identityMode: "authenticated",
      relayBaseURL: baseURL,
    })
  } catch (error) {
    throw error
  }
}

export async function createWebAnonymousSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
}): Promise<AstraSession> {
  const baseURL = normalizeApiBaseUrl(params.baseURL)
  const pendingKey = readPendingAnonymousSessionKey()
  const idempotencyKey = pendingKey ?? createOpaqueIdempotencyKey()

  if (!pendingKey) {
    savePendingAnonymousSessionKey(idempotencyKey)
  }

  try {
    const response = await fetch(`${baseURL}/auth/anonymous`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-Astra-Device-Id": params.device.deviceId,
      },
      body: JSON.stringify({
        deviceId: params.device.deviceId,
        installId: params.device.deviceId,
        device: {
          label: params.device.label,
          platform: params.device.platform,
          browserFamily: params.device.browserFamily,
          appKind: params.device.appKind,
          appVersion: params.device.appVersion,
        },
      }),
    })

    if (!response.ok) {
      const error = await readAuthRequestFailure(response, "Astra free start failed")
      if (error.fallbackReason !== "mirror_back_commit_unknown") {
        clearPendingAnonymousSessionKey()
      }
      throw new Error(error.message)
    }

    clearPendingAnonymousSessionKey()
    return normalizeSessionPayload(await response.json(), {
      deviceId: params.device.deviceId,
      identityMode: "anonymous",
      relayBaseURL: baseURL,
    })
  } catch (error) {
    throw error
  }
}

export async function importWebLibraryMetadataToAccount(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  items: LibraryItem[]
}): Promise<{ accepted: number; rejected: number; metadataAccepted: number; snapshotAccepted: number; snapshotRejected: number; oversizedSnapshots: number }> {
  const now = new Date().toISOString()
  const activeItems = params.items.filter((item) => !item.removedAt)
  const documentSnapshots = new Map((await listLibraryDocumentSnapshots(activeItems.map((item) => item.id))).map((snapshot) => [snapshot.libraryItemId, snapshot]))
  const metadataMutations = activeItems.map((item) => {
    const payload = LibraryItemSchema.parse({
      ...item,
      ownerMode: "account",
      accountId: params.session.email,
      syncState: "synced",
      updatedAt: now,
      metadata: {
        ...item.metadata,
        originalFileBytesSynced: false,
        requiresReimportForBinaryView: true,
      },
    })
    return {
      collection: "config" as const,
      schemaVersion: 1,
      recordId: toLibraryMetadataRecordId(item.id),
      operation: "upsert" as const,
      clientMutationId: createWebClientMutationId(`web-library:${item.id}`),
      deviceId: params.device.deviceId,
      clientUpdatedAt: now,
      payload,
    }
  })

  const snapshotMutations = activeItems.flatMap((item) => {
    const snapshot = documentSnapshots.get(item.id)
    if (!snapshot) return []
    const payloads = buildLibraryDocumentSnapshotSyncPayloads(snapshot)
    return [
      {
        collection: "config" as const,
        schemaVersion: 1,
        recordId: toLibraryDocumentSnapshotManifestRecordId(item.id),
        operation: "upsert" as const,
        clientMutationId: createWebClientMutationId(`web-library-snapshot:${item.id}:manifest`),
        deviceId: params.device.deviceId,
        clientUpdatedAt: now,
        payload: payloads.manifest,
      },
      ...payloads.chunks.map((chunk) => ({
        collection: "config" as const,
        schemaVersion: 1,
        recordId: toLibraryDocumentSnapshotChunkRecordId(item.id, chunk.chunkIndex),
        operation: "upsert" as const,
        clientMutationId: createWebClientMutationId(`web-library-snapshot:${item.id}:chunk:${chunk.chunkIndex}`),
        deviceId: params.device.deviceId,
        clientUpdatedAt: now,
        payload: chunk,
      })),
    ]
  })

  const mutations = [...metadataMutations, ...snapshotMutations]
  if (mutations.length === 0) {
    return { accepted: 0, rejected: 0, metadataAccepted: 0, snapshotAccepted: 0, snapshotRejected: 0, oversizedSnapshots: 0 }
  }

  const accepted: Array<{ recordId: string }> = []
  const rejected: Array<{ clientMutationId: string }> = []
  for (const batch of chunkMutations(mutations, 40)) {
    const response = await pushAstraSyncMutations({
      baseURL: params.session.relayBaseURL,
      sessionToken: params.session.sessionToken,
      deviceId: params.device.deviceId,
      mutations: batch,
    })
    accepted.push(...response.accepted)
    rejected.push(...response.rejected)
  }

  const snapshotRecordPrefix = WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX
  const metadataAccepted = accepted.filter((entry) => entry.recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)).length
  const snapshotAccepted = accepted.filter((entry) => entry.recordId.startsWith(snapshotRecordPrefix)).length
  const snapshotRejected = rejected.filter((entry) => entry.clientMutationId.includes("web-library-snapshot:")).length

  return {
    accepted: accepted.length,
    rejected: rejected.length,
    metadataAccepted,
    snapshotAccepted,
    snapshotRejected,
    oversizedSnapshots: Array.from(documentSnapshots.values()).filter((snapshot) => snapshot.extractedText.status === "oversized").length,
  }
}

export async function refreshWebSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
  sessionToken: string
}): Promise<AstraSession> {
  const baseURL = normalizeApiBaseUrl(params.baseURL)
  const response = await fetch(`${baseURL}/auth/session`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": params.device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra session refresh failed"))
  }

  return normalizeSessionPayload(await response.json(), {
    deviceId: params.device.deviceId,
    identityMode: "authenticated",
    relayBaseURL: baseURL,
  })
}

export async function revokeWebSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
  sessionToken: string
}) {
  const response = await fetch(`${normalizeApiBaseUrl(params.baseURL)}/auth/session`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": params.device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra sign-out failed"))
  }
}

export async function createWebContinuityExport(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  collections?: AstraContinuityExportCollection[]
  idempotencyKey?: string
}): Promise<WebContinuityExportJob> {
  return createAstraAccountExportJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    request: params.collections ? { collections: params.collections } : undefined,
    idempotencyKey: params.idempotencyKey,
  })
}

export async function fetchWebContinuityExportJob(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  jobId: string
}): Promise<WebContinuityExportJob> {
  return fetchAstraAccountExportJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    jobId: params.jobId,
  })
}

export async function downloadWebContinuityExport(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  jobId: string
}): Promise<Blob> {
  const response = await fetch(buildAstraAccountExportDownloadUrl({
    baseURL: params.session.relayBaseURL,
    jobId: params.jobId,
  }), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.session.sessionToken}`,
      "X-Astra-Device-Id": params.device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra continuity export download failed"))
  }

  return response.blob()
}

export async function createWebCloudDataDelete(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  collections: AstraContinuityDeleteCollection[]
  idempotencyKey?: string
}): Promise<WebCloudDataDeleteJob> {
  return createAstraCloudDataDeleteJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    request: { collections: params.collections },
    idempotencyKey: params.idempotencyKey,
  })
}

export async function repairWebCloudSync(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  request?: AstraSyncRepairRequest
}): Promise<WebSyncRepairResult> {
  return repairAstraSyncState({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    request: params.request,
  })
}

export async function fetchWebCloudDataDeleteJob(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  jobId: string
}): Promise<WebCloudDataDeleteJob> {
  return fetchAstraCloudDataDeleteJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    jobId: params.jobId,
  })
}

export async function fetchWebCloudLearningMemoryInventory(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebCloudLearningMemoryInventory> {
  return fetchAstraCloudLearningMemoryInventory({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
  })
}

export async function deleteWebCloudLearningMemory(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebCloudLearningMemoryDeletionReceipt> {
  return deleteAstraCloudLearningMemory({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
  })
}

export async function fetchWebWeeklyDigest(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebWeeklyDigestSnapshot> {
  return fetchAstraWeeklyDigest({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
  })
}

export async function updateWebWeeklyDigestPreference(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  enabled: boolean
}): Promise<WebWeeklyDigestPreferenceResponse> {
  return updateAstraWeeklyDigestPreference({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    enabled: params.enabled,
  })
}

export async function fetchWebAccountWorkspace(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<{
  account: AstraAccount | null
  usage: AstraUsageSnapshot | null
  devices: WebDeviceEntry[] | null
  deviceError: string | null
}> {
  try {
    const summary = await fetchAstraAccountSummary({
      baseURL: params.session.relayBaseURL,
      sessionToken: params.session.sessionToken,
      deviceId: params.device.deviceId,
    })

    return {
      account: AstraAccountSchema.parse(summary.account),
      usage: summary.usage,
      devices: summary.devices.entries,
      deviceError: null,
    }
  } catch {
    const [account, usage, devices] = await Promise.allSettled([
      fetchAstraAccount({
        baseURL: params.session.relayBaseURL,
        sessionToken: params.session.sessionToken,
      }),
      fetchAstraUsageSnapshot({
        baseURL: params.session.relayBaseURL,
        sessionToken: params.session.sessionToken,
      }),
      fetchWebDevices({
        baseURL: params.session.relayBaseURL,
        sessionToken: params.session.sessionToken,
        deviceId: params.device.deviceId,
      }),
    ])

    return {
      account: account.status === "fulfilled" ? AstraAccountSchema.parse(account.value) : null,
      usage: usage.status === "fulfilled" ? usage.value : null,
      devices: devices.status === "fulfilled" ? devices.value : null,
      deviceError: devices.status === "rejected"
        ? (devices.reason instanceof Error ? devices.reason.message : "Astra device list request failed")
        : null,
    }
  }
}

function countActiveRecords<T extends { recordId: string; operation: "upsert" | "delete"; payload?: unknown | null }>(
  mutations: T[],
): number {
  const active = new Set<string>()
  mutations.forEach((mutation) => {
    if (mutation.operation === "delete") {
      active.delete(mutation.recordId)
      return
    }
    active.add(mutation.recordId)
  })
  return active.size
}

export async function fetchWebCloudAssets(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebCloudAssetsWorkspace> {
  const snapshot = await fetchAstraContinuitySnapshot({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    includePull: true,
  })

  const configMutations = snapshot.pull?.deltas.config ?? []
  const appConfigMutations = configMutations.filter((mutation) => !isWebPrivateConfigRecordId(mutation.recordId))
  const deepReadSessions = parseWebDeepReadSessions(configMutations)
  const libraryItems = parseWebLibraryItems(configMutations)
  const librarySnapshots = parseWebLibraryDocumentSnapshots(configMutations)
  const vocabularyMutations = snapshot.pull?.deltas.vocabulary ?? []
  const readingHistoryMutations = snapshot.pull?.deltas.reading_history ?? []
  const studyProgressMutations = snapshot.pull?.deltas.study_progress ?? []
  const syncedConfig = buildSyncSafeConfig(
    applyConfigSyncMutations(DEFAULT_ASTRA_CONFIG, appConfigMutations),
    { includeManagedRelayBaseURL: true },
  )
  const syncedVocabulary = applySyncedVocabularyMutations([], vocabularyMutations)
    .map((entry) => SyncedVocabularyEntrySchema.parse(entry))
    .sort((a, b) => b.savedAt - a.savedAt)
  const readingHistoryEntries = applyReadingHistorySyncMutations([], readingHistoryMutations)
  const studyProgressPages = applyStudyProgressSyncMutations([], studyProgressMutations)
  const stepCoverage = summarizeStudyProgressCoverage(studyProgressPages)
  const currentDevice = snapshot.devices.find((entry) => entry.isCurrentDevice || entry.deviceId === params.device.deviceId) ?? null
  const collectionHealth: WebCloudCollectionHealth[] = [
    {
      key: "config",
      enabled: snapshot.bootstrap.collections.config.enabled,
      defaultEnabled: snapshot.bootstrap.collections.config.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.config ?? snapshot.bootstrap.collections.config.cursor,
      mutationCount: configMutations.length,
      activeCount: countActiveRecords(appConfigMutations),
    },
    {
      key: "vocabulary",
      enabled: snapshot.bootstrap.collections.vocabulary.enabled,
      defaultEnabled: snapshot.bootstrap.collections.vocabulary.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.vocabulary ?? snapshot.bootstrap.collections.vocabulary.cursor,
      mutationCount: vocabularyMutations.length,
      activeCount: syncedVocabulary.length,
    },
    {
      key: "reading_history",
      enabled: snapshot.bootstrap.collections.reading_history.enabled,
      defaultEnabled: snapshot.bootstrap.collections.reading_history.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.reading_history ?? snapshot.bootstrap.collections.reading_history.cursor,
      mutationCount: readingHistoryMutations.length,
      activeCount: readingHistoryEntries.length,
    },
    {
      key: "study_progress",
      enabled: snapshot.bootstrap.collections.study_progress.enabled,
      defaultEnabled: snapshot.bootstrap.collections.study_progress.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.study_progress ?? snapshot.bootstrap.collections.study_progress.cursor,
      mutationCount: studyProgressMutations.length,
      activeCount: studyProgressPages.length,
    },
  ]

  return {
    serverTime: snapshot.pull?.serverTime ?? snapshot.bootstrap.serverTime,
    fetchedAt: new Date().toISOString(),
    bootstrap: snapshot.bootstrap.collections,
    config: {
      enabled: snapshot.bootstrap.collections.config.enabled,
      defaultEnabled: snapshot.bootstrap.collections.config.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.config ?? snapshot.bootstrap.collections.config.cursor,
      recordCount: countActiveRecords(appConfigMutations),
      syncedConfig,
    },
    vocabulary: {
      enabled: snapshot.bootstrap.collections.vocabulary.enabled,
      defaultEnabled: snapshot.bootstrap.collections.vocabulary.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.vocabulary ?? snapshot.bootstrap.collections.vocabulary.cursor,
      count: countActiveRecords(vocabularyMutations),
      entries: syncedVocabulary,
    },
    readingHistory: {
      enabled: snapshot.bootstrap.collections.reading_history.enabled,
      defaultEnabled: snapshot.bootstrap.collections.reading_history.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.reading_history ?? snapshot.bootstrap.collections.reading_history.cursor,
      count: readingHistoryEntries.length,
      entries: readingHistoryEntries,
    },
    studyProgress: {
      enabled: snapshot.bootstrap.collections.study_progress.enabled,
      defaultEnabled: snapshot.bootstrap.collections.study_progress.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.study_progress ?? snapshot.bootstrap.collections.study_progress.cursor,
      pageCount: studyProgressPages.length,
      pages: studyProgressPages,
      stepCoverage,
    },
    deepReadSessions: {
      count: deepReadSessions.length,
      sessions: deepReadSessions,
    },
    library: {
      count: libraryItems.length,
      items: libraryItems,
      snapshotCount: librarySnapshots.length,
      snapshots: librarySnapshots,
    },
    syncHealth: {
      activeDeviceCount: snapshot.devices.filter((entry) => entry.status === "active").length,
      totalDeviceCount: snapshot.devices.length,
      currentDeviceLastSyncAt: currentDevice?.lastSyncAt ?? null,
      maxMutationsPerRequest: snapshot.bootstrap.limits.maxMutationsPerRequest,
      collections: collectionHealth,
    },
    deferredCollections: [
      ...(snapshot.bootstrap.collections.reading_history.enabled ? [] : ["reading_history" as const]),
      ...(snapshot.bootstrap.collections.study_progress.enabled ? [] : ["study_progress" as const]),
    ],
  }
}

function buildPlatformObservabilityUrl(baseURL: string): string {
  return new URL("/__platform/article-import/observability", normalizeApiBaseUrl(baseURL)).toString()
}

function buildPlatformReplayUrl(baseURL: string): string {
  return new URL("/__platform/article-import/replay", normalizeApiBaseUrl(baseURL)).toString()
}

function buildOpsSupportReportsUrl(baseURL: string, suffix = ""): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/support/reports${suffix}`
}

function buildOpsFeatureFlagsUrl(baseURL: string): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/feature-flags`
}

function buildOpsCostUsageSummaryUrl(baseURL: string): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/cost/usage-summary`
}

function buildOpsCockpitSummaryUrl(baseURL: string): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/cockpit/summary`
}

function buildOpsProviderHealthSummaryUrl(baseURL: string): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/provider-health/summary`
}

function buildOpsAuditSummaryUrl(baseURL: string): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/audit/summary`
}

function buildOpsCancellationReasonSummaryUrl(baseURL: string): string {
  return `${normalizeApiBaseUrl(baseURL)}/ops/cancellations/reasons/summary`
}

function buildOpsUserLookupUrl(baseURL: string, query: string): string {
  const url = new URL(`${normalizeApiBaseUrl(baseURL)}/ops/users/lookup`)
  url.searchParams.set("query", query.trim())
  return url.toString()
}

function buildOperatorHeaders(operatorToken: string, contentType = false): Record<string, string> {
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    "x-astra-operator-token": operatorToken.trim(),
  }
}

export async function fetchWebCostUsageSummary(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebCostUsageSummary> {
  const response = await fetch(buildOpsCostUsageSummaryUrl(params.baseURL), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra cost usage summary request failed"))
  }

  const payload = await response.json() as WebCostUsageSummary
  return {
    schema: payload.schema ?? "astra-cost-usage-summary.v1",
    generatedAt: payload.generatedAt ?? "",
    source: "recent_user_usage_events",
    recentEventsPerUserLimit: Number(payload.recentEventsPerUserLimit ?? 0),
    totalEvents: Number(payload.totalEvents ?? 0),
    totalRequests: Number(payload.totalRequests ?? 0),
    totalCharacters: Number(payload.totalCharacters ?? 0),
    totalEstimatedSpendUsd: Number(payload.totalEstimatedSpendUsd ?? 0),
    estimateRegistry: payload.estimateRegistry ?? "internal_deterministic_v1",
    cacheHitRate: payload.cacheHitRate == null ? null : Number(payload.cacheHitRate),
    dailyEstimate: {
      date: payload.dailyEstimate?.date ?? null,
      estimatedSpendUsd: Number(payload.dailyEstimate?.estimatedSpendUsd ?? 0),
      previousDate: payload.dailyEstimate?.previousDate ?? null,
      previousEstimatedSpendUsd: Number(payload.dailyEstimate?.previousEstimatedSpendUsd ?? 0),
      spikeRatio: payload.dailyEstimate?.spikeRatio == null ? null : Number(payload.dailyEstimate.spikeRatio),
      spikeStatus: payload.dailyEstimate?.spikeStatus ?? "none",
      riskLevel: payload.dailyEstimate?.riskLevel ?? "low",
    },
    buckets: (payload.buckets ?? []).map((bucket) => ({
      tier: bucket.tier ?? "unknown",
      taskClass: bucket.taskClass ?? "unknown",
      costBucket: bucket.costBucket ?? "unknown",
      eventCount: Number(bucket.eventCount ?? 0),
      requestCount: Number(bucket.requestCount ?? 0),
      characterCount: Number(bucket.characterCount ?? 0),
      successCount: Number(bucket.successCount ?? 0),
      failureCount: Number(bucket.failureCount ?? 0),
      fallbackCount: Number(bucket.fallbackCount ?? 0),
      estimatedSpendUsd: Number(bucket.estimatedSpendUsd ?? 0),
    })),
    byServiceMode: (payload.byServiceMode ?? []).map((bucket) => ({
      serviceMode: bucket.serviceMode ?? "automatic",
      eventCount: Number(bucket.eventCount ?? 0),
      requestCount: Number(bucket.requestCount ?? 0),
      characterCount: Number(bucket.characterCount ?? 0),
      successCount: Number(bucket.successCount ?? 0),
      failureCount: Number(bucket.failureCount ?? 0),
      fallbackCount: Number(bucket.fallbackCount ?? 0),
      latencySampleCount: Number(bucket.latencySampleCount ?? 0),
      latencyP50Ms: bucket.latencyP50Ms == null ? null : Number(bucket.latencyP50Ms),
      latencyP95Ms: bucket.latencyP95Ms == null ? null : Number(bucket.latencyP95Ms),
      estimatedSpendUsd: Number(bucket.estimatedSpendUsd ?? 0),
    })),
    byCacheStatus: (payload.byCacheStatus ?? []).map((bucket) => ({
      cacheStatus: bucket.cacheStatus ?? "unknown",
      eventCount: Number(bucket.eventCount ?? 0),
      requestCount: Number(bucket.requestCount ?? 0),
      characterCount: Number(bucket.characterCount ?? 0),
      share: Number(bucket.share ?? 0),
      estimatedSpendUsd: Number(bucket.estimatedSpendUsd ?? 0),
    })),
  }
}

export async function fetchWebOpsCockpitSummary(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebOpsCockpitSummary> {
  const response = await fetch(buildOpsCockpitSummaryUrl(params.baseURL), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra ops cockpit summary request failed"))
  }

  const payload = await response.json() as WebOpsCockpitSummary
  return {
    schema: payload.schema ?? "astra-ops-cockpit-summary.v1",
    generatedAt: payload.generatedAt ?? "",
    privacy: {
      metadataOnly: Boolean(payload.privacy?.metadataOnly ?? false),
      aggregateOnly: Boolean(payload.privacy?.aggregateOnly ?? false),
      readOnly: Boolean(payload.privacy?.readOnly ?? false),
      contentIncluded: Boolean(payload.privacy?.contentIncluded ?? false),
      perUserRows: Boolean(payload.privacy?.perUserRows ?? false),
      identifiersIncluded: Boolean(payload.privacy?.identifiersIncluded ?? false),
      providerBillingIncluded: Boolean(payload.privacy?.providerBillingIncluded ?? false),
      crmRepliesIncluded: Boolean(payload.privacy?.crmRepliesIncluded ?? false),
    },
    sources: {
      costUsageSummary: Boolean(payload.sources?.costUsageSummary ?? false),
      supportReportSummary: Boolean(payload.sources?.supportReportSummary ?? false),
      cancellationReasonSummary: Boolean(payload.sources?.cancellationReasonSummary ?? false),
      analyticsCohortSummary: Boolean(payload.sources?.analyticsCohortSummary ?? false),
      mobileRetentionSummary: Boolean(payload.sources?.mobileRetentionSummary ?? false),
      weeklyDigestDeliverySummary: Boolean(payload.sources?.weeklyDigestDeliverySummary ?? false),
      providerHealthSummary: Boolean(payload.sources?.providerHealthSummary ?? false),
      operatingReviewHelpers: Boolean(payload.sources?.operatingReviewHelpers ?? false),
    },
    metrics: {
      cost: {
        retainedEvents: Number(payload.metrics?.cost?.retainedEvents ?? 0),
        requests: Number(payload.metrics?.cost?.requests ?? 0),
        estimatedSpendUsd: Number(payload.metrics?.cost?.estimatedSpendUsd ?? 0),
        dailyEstimatedSpendUsd: Number(payload.metrics?.cost?.dailyEstimatedSpendUsd ?? 0),
        dailyRiskLevel: payload.metrics?.cost?.dailyRiskLevel ?? "low",
        dailySpikeStatus: payload.metrics?.cost?.dailySpikeStatus ?? "none",
        cacheHitRate: payload.metrics?.cost?.cacheHitRate == null ? null : Number(payload.metrics.cost.cacheHitRate),
        topCostTaskClass: payload.metrics?.cost?.topCostTaskClass ?? null,
      },
      support: {
        totalReports: Number(payload.metrics?.support?.totalReports ?? 0),
        weeklyTopIssueCount: Number(payload.metrics?.support?.weeklyTopIssueCount ?? 0),
        unresolvedCount: Number(payload.metrics?.support?.unresolvedCount ?? 0),
        urgentUnresolvedCount: Number(payload.metrics?.support?.urgentUnresolvedCount ?? 0),
        staleTriageCount: Number(payload.metrics?.support?.staleTriageCount ?? 0),
        followUpOverdueCount: Number(payload.metrics?.support?.followUpOverdueCount ?? 0),
        oldestUnresolvedAgeDays: payload.metrics?.support?.oldestUnresolvedAgeDays == null ? null : Number(payload.metrics.support.oldestUnresolvedAgeDays),
        macroCoverageRate: payload.metrics?.support?.macroCoverageRate == null ? null : Number(payload.metrics.support.macroCoverageRate),
      },
      retentionGrowth: {
        analyticsGrain: payload.metrics?.retentionGrowth?.analyticsGrain ?? "week",
        analyticsEvents: Number(payload.metrics?.retentionGrowth?.analyticsEvents ?? 0),
        mobileRetentionGrain: payload.metrics?.retentionGrowth?.mobileRetentionGrain ?? "week",
        mobileRetentionEvents: Number(payload.metrics?.retentionGrowth?.mobileRetentionEvents ?? 0),
        weeklyDigestDeliveryRuns: Number(payload.metrics?.retentionGrowth?.weeklyDigestDeliveryRuns ?? 0),
        cancellationSubmissions: Number(payload.metrics?.retentionGrowth?.cancellationSubmissions ?? 0),
        cancellationReasonCoverageRate: payload.metrics?.retentionGrowth?.cancellationReasonCoverageRate == null ? null : Number(payload.metrics.retentionGrowth.cancellationReasonCoverageRate),
        topCancellationReason: payload.metrics?.retentionGrowth?.topCancellationReason ?? null,
      },
      providerHealth: {
        available: Boolean(payload.metrics?.providerHealth?.available ?? false),
        retainedEvents: Number(payload.metrics?.providerHealth?.retainedEvents ?? 0),
        incidentBucketCount: Number(payload.metrics?.providerHealth?.incidentBucketCount ?? 0),
        watchBucketCount: Number(payload.metrics?.providerHealth?.watchBucketCount ?? 0),
      },
    },
    reviewCadence: (payload.reviewCadence ?? []).map((item) => ({
      cadence: item.cadence ?? "weekly",
      label: item.label ?? "Operating review",
      focus: item.focus ?? "Review aggregate operating signals.",
      requiredEvidence: Array.isArray(item.requiredEvidence) ? item.requiredEvidence : [],
      availableEvidence: Array.isArray(item.availableEvidence) ? item.availableEvidence : [],
      missingEvidence: Array.isArray(item.missingEvidence) ? item.missingEvidence : [],
    })),
    experimentGuardrails: (payload.experimentGuardrails ?? []).map((guardrail) => ({
      area: guardrail.area ?? "unknown",
      successMetric: guardrail.successMetric ?? "conversion_event",
      guardrailMetrics: Array.isArray(guardrail.guardrailMetrics) ? guardrail.guardrailMetrics : [],
      privacyRule: guardrail.privacyRule ?? "Metadata only.",
    })),
    riskFlags: (payload.riskFlags ?? []).map((flag) => ({
      code: flag.code ?? "unknown",
      severity: flag.severity === "pause_growth" ? "pause_growth" : "watch",
      message: flag.message ?? "Review operating risk.",
    })),
  }
}

export async function fetchWebProviderHealthSummary(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebProviderHealthSummary> {
  const response = await fetch(buildOpsProviderHealthSummaryUrl(params.baseURL), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra provider health summary request failed"))
  }

  const payload = await response.json() as WebProviderHealthSummary
  return {
    schema: payload.schema ?? "astra-provider-health-summary.v1",
    generatedAt: payload.generatedAt ?? "",
    source: "recent_user_usage_events",
    recentEventsPerUserLimit: Number(payload.recentEventsPerUserLimit ?? 0),
    totalEvents: Number(payload.totalEvents ?? 0),
    totalRequests: Number(payload.totalRequests ?? 0),
    totalCharacters: Number(payload.totalCharacters ?? 0),
    buckets: (payload.buckets ?? []).map((bucket) => ({
      provider: bucket.provider ?? "unknown",
      model: bucket.model ?? "unknown",
      serviceMode: bucket.serviceMode ?? "automatic",
      taskClass: bucket.taskClass ?? "unknown",
      eventCount: Number(bucket.eventCount ?? 0),
      requestCount: Number(bucket.requestCount ?? 0),
      characterCount: Number(bucket.characterCount ?? 0),
      successCount: Number(bucket.successCount ?? 0),
      failureCount: Number(bucket.failureCount ?? 0),
      fallbackCount: Number(bucket.fallbackCount ?? 0),
      successRate: bucket.successRate == null ? null : Number(bucket.successRate),
      fallbackRate: bucket.fallbackRate == null ? null : Number(bucket.fallbackRate),
      latencySampleCount: Number(bucket.latencySampleCount ?? 0),
      latencyP50Ms: bucket.latencyP50Ms == null ? null : Number(bucket.latencyP50Ms),
      latencyP95Ms: bucket.latencyP95Ms == null ? null : Number(bucket.latencyP95Ms),
      healthStatus: bucket.healthStatus ?? "healthy",
    })),
  }
}

export async function fetchWebOpsAuditSummary(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebOpsAuditSummary> {
  const response = await fetch(buildOpsAuditSummaryUrl(params.baseURL), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra ops audit summary request failed"))
  }

  const payload = await response.json() as WebOpsAuditSummary
  return {
    schema: payload.schema ?? "astra-ops-audit-summary.v1",
    generatedAt: payload.generatedAt ?? "",
    totalEvents: Number(payload.totalEvents ?? 0),
    retainedEventLimit: Number(payload.retainedEventLimit ?? 0),
    byAction: (payload.byAction ?? []).map((bucket) => ({
      action: bucket.action ?? "unknown",
      count: Number(bucket.count ?? 0),
    })),
    byActor: (payload.byActor ?? []).map((bucket) => ({
      actor: bucket.actor ?? "system",
      count: Number(bucket.count ?? 0),
    })),
    privacy: {
      userConsentTrueCount: Number(payload.privacy?.userConsentTrueCount ?? 0),
      metadataOnlyCount: Number(payload.privacy?.metadataOnlyCount ?? 0),
      contentIncludedCount: Number(payload.privacy?.contentIncludedCount ?? 0),
    },
    recent: (payload.recent ?? []).map((entry) => ({
      id: entry.id ?? "",
      timestamp: entry.timestamp ?? "",
      actor: entry.actor ?? "system",
      action: entry.action ?? "unknown",
      outcome: entry.outcome ?? "success",
      operatorTokenHash: entry.operatorTokenHash ?? null,
      subjectUserId: entry.subjectUserId ?? null,
      subjectEmailHash: entry.subjectEmailHash ?? null,
      supportReportId: entry.supportReportId ?? null,
      metadata: entry.metadata ?? {},
      privacy: {
        userConsent: entry.privacy?.userConsent ?? null,
        contentIncluded: Boolean(entry.privacy?.contentIncluded ?? false),
        contentAccess: entry.privacy?.contentAccess ?? "none",
      },
    })),
  }
}

export async function fetchWebCancellationReasonSummary(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebCancellationReasonSummary> {
  const response = await fetch(buildOpsCancellationReasonSummaryUrl(params.baseURL), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra cancellation reason summary request failed"))
  }

  const payload = await response.json() as WebCancellationReasonSummary
  return {
    schema: payload.schema ?? "astra-cancellation-reason-summary.v1",
    generatedAt: payload.generatedAt ?? "",
    totalSubmissions: Number(payload.totalSubmissions ?? 0),
    retainedEventLimit: Number(payload.retainedEventLimit ?? 0),
    reasonCoverage: {
      submittedCount: Number(payload.reasonCoverage?.submittedCount ?? 0),
      unknownReasonCount: Number(payload.reasonCoverage?.unknownReasonCount ?? 0),
      coverageRate: payload.reasonCoverage?.coverageRate == null ? null : Number(payload.reasonCoverage.coverageRate),
    },
    byReason: (payload.byReason ?? []).map((bucket) => ({
      reason: bucket.reason ?? "other",
      label: bucket.label ?? bucket.reason ?? "Other",
      productMeaning: bucket.productMeaning ?? "Needs manual review.",
      count: Number(bucket.count ?? 0),
      share: Number(bucket.share ?? 0),
    })),
    byPlan: (payload.byPlan ?? []).map((bucket) => ({
      plan: bucket.plan ?? "unknown",
      count: Number(bucket.count ?? 0),
    })),
    bySource: (payload.bySource ?? []).map((bucket) => ({
      source: bucket.source ?? "unknown",
      count: Number(bucket.count ?? 0),
    })),
  }
}

export async function fetchWebOpsUserLookup(params: {
  baseURL: string
  operatorToken: string
  query: string
}): Promise<WebOpsUserLookupSummary> {
  const response = await fetch(buildOpsUserLookupUrl(params.baseURL, params.query), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra user lookup request failed"))
  }

  const payload = await response.json() as WebOpsUserLookupSummary
  return {
    schema: payload.schema ?? "astra-ops-user-lookup.v1",
    generatedAt: payload.generatedAt ?? "",
    queryType: payload.queryType ?? "email",
    resultWindow: {
      mode: payload.resultWindow?.mode ?? "exact_lookup",
      limit: Number(payload.resultWindow?.limit ?? 1),
      cursor: payload.resultWindow?.cursor ?? null,
      nextCursor: payload.resultWindow?.nextCursor ?? null,
      returnedCount: Number(payload.resultWindow?.returnedCount ?? (payload.user ? 1 : 0)),
      totalMatched: Number(payload.resultWindow?.totalMatched ?? (payload.user ? 1 : 0)),
      hasMore: Boolean(payload.resultWindow?.hasMore ?? false),
    },
    snapshotBoundary: {
      metadataOnly: Boolean(payload.snapshotBoundary?.metadataOnly ?? true),
      contentIncluded: Boolean(payload.snapshotBoundary?.contentIncluded ?? false),
      rawQueryIncluded: Boolean(payload.snapshotBoundary?.rawQueryIncluded ?? false),
      exportAvailable: Boolean(payload.snapshotBoundary?.exportAvailable ?? false),
      recentTaskSummaryLimit: Number(payload.snapshotBoundary?.recentTaskSummaryLimit ?? 6),
      excludedFields: Array.isArray(payload.snapshotBoundary?.excludedFields) ? payload.snapshotBoundary.excludedFields : [],
    },
    user: {
      userId: payload.user?.userId ?? "",
      emailHash: payload.user?.emailHash ?? "",
      createdAt: payload.user?.createdAt ?? "",
      plan: payload.user?.plan ?? "unknown",
      subscriptionStatus: payload.user?.subscriptionStatus ?? "unknown",
      identityMode: payload.user?.identityMode ?? "authenticated",
      providerEntitlementCount: Number(payload.user?.providerEntitlementCount ?? 0),
      limits: {
        dailyRequests: Number(payload.user?.limits?.dailyRequests ?? 0),
        dailyCharacters: Number(payload.user?.limits?.dailyCharacters ?? 0),
        requestsPerMinute: Number(payload.user?.limits?.requestsPerMinute ?? 0),
      },
      usage: {
        usageDay: payload.user?.usage?.usageDay ?? "",
        requestsToday: Number(payload.user?.usage?.requestsToday ?? 0),
        charactersToday: Number(payload.user?.usage?.charactersToday ?? 0),
        totalRequests: Number(payload.user?.usage?.totalRequests ?? 0),
        totalCharacters: Number(payload.user?.usage?.totalCharacters ?? 0),
        lastRequestAt: payload.user?.usage?.lastRequestAt ?? null,
        recentEventCount: Number(payload.user?.usage?.recentEventCount ?? 0),
        usageCategory: payload.user?.usage?.usageCategory ?? "light",
      },
      devices: {
        activeCount: Number(payload.user?.devices?.activeCount ?? 0),
        revokedCount: Number(payload.user?.devices?.revokedCount ?? 0),
      },
      sessions: {
        activeCount: Number(payload.user?.sessions?.activeCount ?? 0),
        revokedCount: Number(payload.user?.sessions?.revokedCount ?? 0),
      },
      recentTaskSummary: (payload.user?.recentTaskSummary ?? []).map((bucket) => ({
        taskClass: bucket.taskClass ?? "unknown",
        eventCount: Number(bucket.eventCount ?? 0),
        successCount: Number(bucket.successCount ?? 0),
        failureCount: Number(bucket.failureCount ?? 0),
        fallbackCount: Number(bucket.fallbackCount ?? 0),
        latencySampleCount: Number(bucket.latencySampleCount ?? 0),
        latencyP95Ms: bucket.latencyP95Ms == null ? null : Number(bucket.latencyP95Ms),
      })),
    },
  }
}

const DEFAULT_WEB_SUPPORT_FOLLOW_UP: WebSupportReportFollowUp = {
  path: "not_selected",
  status: "not_started",
  macroId: null,
  reason: null,
  updatedAt: null,
  updatedBy: null,
}

function parseWebSupportMacro(payload: WebSupportFirstResponseMacro | null | undefined): WebSupportFirstResponseMacro | null {
  if (!payload) return null
  return {
    id: payload.id ?? "",
    issueCategory: payload.issueCategory ?? "unknown",
    title: payload.title ?? "",
    firstResponse: payload.firstResponse ?? "",
    nextStep: payload.nextStep ?? "",
    privacyNote: payload.privacyNote ?? "",
    surfaces: payload.surfaces ?? [],
  }
}

function parseWebSupportFollowUp(payload: Partial<WebSupportReportFollowUp> | null | undefined): WebSupportReportFollowUp {
  return {
    ...DEFAULT_WEB_SUPPORT_FOLLOW_UP,
    ...(payload ?? {}),
    macroId: payload?.macroId ?? null,
    reason: payload?.reason ?? null,
    updatedAt: payload?.updatedAt ?? null,
    updatedBy: payload?.updatedBy ?? null,
  }
}

function parseWebSupportTriage(payload: Partial<WebSupportReportTriage> | null | undefined): WebSupportReportTriage {
  return {
    status: payload?.status ?? "new",
    assignedTo: payload?.assignedTo ?? null,
    priority: payload?.priority ?? "normal",
    resolution: payload?.resolution ?? null,
    updatedAt: payload?.updatedAt ?? null,
    updatedBy: payload?.updatedBy ?? null,
    followUp: parseWebSupportFollowUp(payload?.followUp),
  }
}

function parseWebSupportHandoffSummary(payload: WebSupportReportHandoffSummary | null | undefined): WebSupportReportHandoffSummary {
  return {
    byPath: (payload?.byPath ?? []).map((bucket) => ({ path: bucket.path ?? "not_selected", count: Number(bucket.count ?? 0) })),
    byStatus: (payload?.byStatus ?? []).map((bucket) => ({ status: bucket.status ?? "not_started", count: Number(bucket.count ?? 0) })),
  }
}

function parseWebSupportSlaRiskSummary(payload: WebSupportReportSlaRiskSummary | null | undefined, fallbackGeneratedAt: string): WebSupportReportSlaRiskSummary {
  return {
    generatedAt: payload?.generatedAt ?? fallbackGeneratedAt,
    currentNow: payload?.currentNow ?? payload?.generatedAt ?? fallbackGeneratedAt,
    unresolvedCount: Number(payload?.unresolvedCount ?? 0),
    urgentUnresolvedCount: Number(payload?.urgentUnresolvedCount ?? 0),
    staleTriageByAgeBucket: {
      under24h: Number(payload?.staleTriageByAgeBucket?.under24h ?? 0),
      from24hTo72h: Number(payload?.staleTriageByAgeBucket?.from24hTo72h ?? 0),
      from72hTo168h: Number(payload?.staleTriageByAgeBucket?.from72hTo168h ?? 0),
      over168h: Number(payload?.staleTriageByAgeBucket?.over168h ?? 0),
    },
    followUpOverdueCount: Number(payload?.followUpOverdueCount ?? 0),
    oldestUnresolvedAgeHours: payload?.oldestUnresolvedAgeHours == null ? null : Number(payload.oldestUnresolvedAgeHours),
    oldestUnresolvedAgeDays: payload?.oldestUnresolvedAgeDays == null ? null : Number(payload.oldestUnresolvedAgeDays),
  }
}

function parseWebSupportFirstResponseMacroSummary(payload: WebSupportFirstResponseMacroSummary | null | undefined): WebSupportFirstResponseMacroSummary | null {
  if (!payload) return null
  return {
    schema: payload.schema ?? "astra-support-first-response-macros.v1",
    generatedAt: payload.generatedAt ?? "",
    threshold: Number(payload.threshold ?? 0.8),
    catalogCoverage: {
      coveredIssueCategories: Number(payload.catalogCoverage?.coveredIssueCategories ?? 0),
      totalIssueCategories: Number(payload.catalogCoverage?.totalIssueCategories ?? 0),
      coverageRate: Number(payload.catalogCoverage?.coverageRate ?? 0),
      ready: Boolean(payload.catalogCoverage?.ready ?? false),
    },
    reportedCoverage: {
      coveredReports: Number(payload.reportedCoverage?.coveredReports ?? 0),
      totalReports: Number(payload.reportedCoverage?.totalReports ?? 0),
      unknownIssueReports: Number(payload.reportedCoverage?.unknownIssueReports ?? 0),
      coverageRate: payload.reportedCoverage?.coverageRate == null ? null : Number(payload.reportedCoverage.coverageRate),
      ready: payload.reportedCoverage?.ready == null ? null : Boolean(payload.reportedCoverage.ready),
    },
    byIssueCategory: (payload.byIssueCategory ?? []).map((bucket) => ({
      issueCategory: bucket.issueCategory ?? "unknown",
      count: Number(bucket.count ?? 0),
      macroId: bucket.macroId ?? null,
      title: bucket.title ?? null,
      covered: Boolean(bucket.covered ?? false),
    })),
    macros: (payload.macros ?? []).map((macro) => parseWebSupportMacro(macro)).filter((macro): macro is WebSupportFirstResponseMacro => Boolean(macro)),
  }
}

export async function fetchWebSupportReportSummary(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebSupportReportSummary> {
  const response = await fetch(buildOpsSupportReportsUrl(params.baseURL, "/summary"), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra support report summary request failed"))
  }

  const payload = await response.json() as WebSupportReportSummary
  const generatedAt = payload.generatedAt ?? ""
  return {
    totalReports: Number(payload.totalReports ?? 0),
    generatedAt,
    buckets: (payload.buckets ?? []).map((bucket) => ({
      ...bucket,
      count: Number(bucket.count ?? 0),
      hostname: bucket.hostname ?? null,
      issueCategory: bucket.issueCategory ?? null,
      knownIssueId: bucket.knownIssueId ?? null,
      knownIssueStatus: bucket.knownIssueStatus ?? null,
    })),
    weeklyTopIssues: (payload.weeklyTopIssues ?? []).map((issue) => ({
      ...issue,
      reportCount: Number(issue.reportCount ?? 0),
      hostname: issue.hostname ?? null,
      issueCategory: issue.issueCategory ?? null,
      knownIssueId: issue.knownIssueId ?? null,
      knownIssueStatus: issue.knownIssueStatus ?? null,
    })),
    macroCoverage: parseWebSupportFirstResponseMacroSummary(payload.macroCoverage),
    handoffSummary: parseWebSupportHandoffSummary(payload.handoffSummary),
    slaRisk: parseWebSupportSlaRiskSummary(payload.slaRisk, generatedAt),
  }
}

export async function fetchWebSupportReports(params: {
  baseURL: string
  operatorToken: string
}): Promise<WebSupportReportList> {
  const response = await fetch(buildOpsSupportReportsUrl(params.baseURL), {
    method: "GET",
    headers: buildOperatorHeaders(params.operatorToken),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra support report list request failed"))
  }

  const payload = await response.json() as WebSupportReportList
  return {
    schema: payload.schema ?? "astra-support-report-inbox.v1",
    reports: (payload.reports ?? []).map((report) => ({
      ...report,
      ownerEmail: report.ownerEmail ?? "",
      deviceId: report.deviceId ?? "",
      sessionId: report.sessionId ?? "",
      issueCategory: report.issueCategory ?? null,
      errorCategory: report.errorCategory ?? null,
      lastErrorCategory: report.lastErrorCategory ?? null,
      runtimeSurface: report.runtimeSurface ?? null,
      hostname: report.hostname ?? null,
      knownIssue: report.knownIssue ?? null,
      triage: parseWebSupportTriage(report.triage),
      recommendedMacro: parseWebSupportMacro(report.recommendedMacro),
    })),
  }
}

export async function updateWebSupportReportTriage(params: {
  baseURL: string
  operatorToken: string
  reportId: string
  patch: WebSupportReportTriageUpdate
}): Promise<WebSupportReportListEntry> {
  const response = await fetch(buildOpsSupportReportsUrl(params.baseURL, `/${encodeURIComponent(params.reportId)}/triage`), {
    method: "PATCH",
    headers: buildOperatorHeaders(params.operatorToken, true),
    body: JSON.stringify(params.patch),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra support report triage update failed"))
  }

  const payload = await response.json() as { report?: WebSupportReportListEntry }
  if (!payload.report) {
    throw new Error("Astra support report triage response was missing the report.")
  }
  return {
    ...payload.report,
    triage: parseWebSupportTriage(payload.report.triage),
    recommendedMacro: parseWebSupportMacro(payload.report.recommendedMacro),
  }
}

export async function fetchWebFeatureFlagRuntime(params: {
  baseURL: string
}): Promise<WebFeatureFlagRuntime> {
  const response = await fetch(buildOpsFeatureFlagsUrl(params.baseURL), {
    method: "GET",
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra feature-flag runtime request failed"))
  }

  const payload = await response.json() as WebFeatureFlagRuntime
  return {
    schema: "astra-feature-flag-runtime.v1",
    generatedAt: payload.generatedAt ?? "",
    overrides: payload.overrides ?? [],
    killSwitches: (payload.killSwitches ?? []).map((rule) => ({
      ...rule,
      enabled: Boolean(rule.enabled),
      safeMode: rule.safeMode ?? true,
    })),
    changeLog: payload.changeLog ?? [],
  }
}

export async function updateWebFeatureFlagRuntime(params: {
  baseURL: string
  operatorToken: string
  runtime: WebFeatureFlagRuntime
}): Promise<WebFeatureFlagRuntime> {
  const response = await fetch(buildOpsFeatureFlagsUrl(params.baseURL), {
    method: "PUT",
    headers: buildOperatorHeaders(params.operatorToken, true),
    body: JSON.stringify(params.runtime),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra feature-flag runtime update failed"))
  }

  const payload = await response.json() as WebFeatureFlagRuntime
  return {
    schema: "astra-feature-flag-runtime.v1",
    generatedAt: payload.generatedAt ?? "",
    overrides: payload.overrides ?? [],
    killSwitches: (payload.killSwitches ?? []).map((rule) => ({
      ...rule,
      enabled: Boolean(rule.enabled),
      safeMode: rule.safeMode ?? true,
    })),
    changeLog: payload.changeLog ?? [],
  }
}

export async function fetchWebImportQueueObservability(params: {
  baseURL: string
  operatorToken?: string | null
}): Promise<WebImportQueueObservability> {
  const response = await fetch(buildPlatformObservabilityUrl(params.baseURL), {
    method: "GET",
    headers: {
      ...(params.operatorToken?.trim()
        ? { "x-astra-operator-token": params.operatorToken.trim() }
        : {}),
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra import observability request failed"))
  }

  const payload = await response.json() as {
    requestId?: string
    environment?: string
    articleImport?: {
      defaultMode?: string
      queuePolicy?: { maxAttempts?: number; operatorReplayEnabled?: boolean }
      backlog?: { queued?: number; failed?: number; deadLettered?: number; oldestQueuedAgeMs?: number | null }
      routeCounts?: Record<string, number>
      statusCounts?: Record<string, number>
      surfaceCounts?: Record<string, number>
      recentFailures?: WebArticleImportRecentFailure[]
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    requestId: payload.requestId ?? "",
    environment: payload.environment ?? "unknown",
    articleImport: {
      defaultMode: payload.articleImport?.defaultMode ?? "unknown",
      queuePolicy: {
        maxAttempts: Number(payload.articleImport?.queuePolicy?.maxAttempts ?? 0),
        operatorReplayEnabled: Boolean(payload.articleImport?.queuePolicy?.operatorReplayEnabled),
      },
      backlog: {
        queued: Number(payload.articleImport?.backlog?.queued ?? 0),
        failed: Number(payload.articleImport?.backlog?.failed ?? 0),
        deadLettered: Number(payload.articleImport?.backlog?.deadLettered ?? 0),
        oldestQueuedAgeMs: payload.articleImport?.backlog?.oldestQueuedAgeMs ?? null,
      },
      routeCounts: payload.articleImport?.routeCounts ?? {},
      statusCounts: payload.articleImport?.statusCounts ?? {},
      surfaceCounts: payload.articleImport?.surfaceCounts ?? {},
      recentFailures: (payload.articleImport?.recentFailures ?? []).map((failure) => ({
        ...failure,
        queueAttemptCount: Number(failure.queueAttemptCount ?? 0),
        replayCount: Number(failure.replayCount ?? 0),
        updatedAtEpochMs: Number(failure.updatedAtEpochMs ?? 0),
        deadLetteredAtEpochMs: failure.deadLetteredAtEpochMs ?? null,
        lastReplayedAtEpochMs: failure.lastReplayedAtEpochMs ?? null,
      })),
    },
  }
}

export async function replayWebImportJobs(params: {
  baseURL: string
  operatorToken: string
  limit?: number
  dryRun?: boolean
  reason?: string | null
  status?: "failed" | "dead_lettered"
}): Promise<WebImportReplayResult> {
  const response = await fetch(buildPlatformReplayUrl(params.baseURL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-astra-operator-token": params.operatorToken.trim(),
    },
    body: JSON.stringify({
      status: params.status ?? "dead_lettered",
      limit: params.limit ?? 20,
      dryRun: params.dryRun ?? false,
      reason: params.reason ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra import replay request failed"))
  }

  const payload = await response.json() as {
    requestId?: string
    dryRun?: boolean
    summary?: {
      selected?: number
      replayed?: number
      skipped?: number
    }
  }

  return {
    requestId: payload.requestId ?? "",
    dryRun: Boolean(payload.dryRun),
    summary: {
      selected: Number(payload.summary?.selected ?? 0),
      replayed: Number(payload.summary?.replayed ?? 0),
      skipped: Number(payload.summary?.skipped ?? 0),
    },
  }
}

export async function updateWebSyncCollectionPreference(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  collection: "reading_history" | "study_progress"
  enabled: boolean
}): Promise<void> {
  await updateAstraSyncCollectionPreference({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    collection: params.collection,
    enabled: params.enabled,
  })
}

export async function fetchWebDevices(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
}): Promise<WebDeviceEntry[]> {
  return fetchAstraDevices(params)
}

export async function revokeWebDevice(params: {
  baseURL: string
  sessionToken: string
  currentDeviceId: string
  targetDeviceId: string
}): Promise<WebDeviceEntry[]> {
  return revokeAstraDevice({
    baseURL: params.baseURL,
    sessionToken: params.sessionToken,
    deviceId: params.currentDeviceId,
    targetDeviceId: params.targetDeviceId,
  })
}

export async function createWebTrialIntent(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebTrialLifecycleContract> {
  return createAstraTrialIntent({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
  })
}

export async function fetchWebTrialIntent(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebTrialLifecycleContract> {
  return fetchAstraTrialIntent({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
  })
}

export async function openBillingCheckout(params: {
  session: AstraSession
  plan: AstraPlan
}): Promise<string> {
  const link = await createAstraCheckoutLink({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    plan: params.plan,
  })

  return link.url
}

export async function openBillingPortal(params: {
  session: AstraSession
}): Promise<string> {
  const link = await createAstraPortalLink({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
  })

  return link.url
}

export async function createWebVideoNoteJob(params: {
  session: AstraSession
  request: VideoNoteCreateRequest
}): Promise<WebVideoNoteCreateResponse> {
  const response = await fetch(`${params.session.relayBaseURL}/video-notes/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.session.sessionToken}`,
    },
    body: JSON.stringify(params.request),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Video-note job creation failed"))
  }

  return VideoNoteCreateResponseSchema.parse(await response.json())
}

export async function fetchWebVideoNoteJob(params: {
  session: AstraSession
  jobId: string
}): Promise<WebVideoNoteStatusResponse> {
  const response = await fetch(`${params.session.relayBaseURL}/video-notes/jobs/${encodeURIComponent(params.jobId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.session.sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Video-note job fetch failed"))
  }

  return VideoNoteStatusResponseSchema.parse(await response.json())
}

export async function fetchWebVideoNoteArtifact(params: {
  session: AstraSession
  jobId: string
}): Promise<WebVideoNoteArtifact> {
  const response = await fetch(`${params.session.relayBaseURL}/video-notes/jobs/${encodeURIComponent(params.jobId)}/artifact`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.session.sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Video-note artifact fetch failed"))
  }

  const payload = VideoNoteArtifactResponseSchema.parse(await response.json())
  return payload.artifact
}

function serializeTranslationRequestContext(context?: TranslationRequestContext): string {
  return JSON.stringify({
    pageTitle: context?.pageTitle?.trim() || "",
    pageUrl: context?.pageUrl?.trim() || "",
    hostname: context?.hostname?.trim() || "",
    metaDescription: context?.metaDescription?.trim() || "",
    contentSummary: context?.contentSummary?.trim() || "",
    selectionContext: context?.selectionContext?.trim() || "",
    terminologyGlossary: context?.terminologyGlossary?.trim() || "",
  })
}

function buildTranslationCacheContext(
  config: AstraConfig,
  request: WebTranslateRequest,
): TranslationCacheContext {
  return {
    providerId: config.provider.id,
    model: config.provider.model,
    connectionMode: config.connectionMode,
    serviceMode: config.serviceMode,
    routingKey: "astra",
    languageLevel: config.languageLevel,
    sourceLang: request.sourceLang,
    requestContextKey: serializeTranslationRequestContext(request.context),
  }
}

function splitIntoSegments(
  texts: string[],
  options: { preservePlaceholderTokens?: boolean } = {},
): TranslateSegment[] {
  return texts.flatMap((text, originalIndex) => {
    if (options.preservePlaceholderTokens) {
      return [{ originalIndex, text }]
    }

    const codePoints = Array.from(text)
    if (codePoints.length <= MAX_BATCH_CHARS) {
      return [{ originalIndex, text }]
    }

    const segments: TranslateSegment[] = []
    for (let start = 0; start < codePoints.length; start += MAX_BATCH_CHARS) {
      segments.push({
        originalIndex,
        text: codePoints.slice(start, start + MAX_BATCH_CHARS).join(""),
      })
    }

    return segments
  })
}

function createBatches(segments: TranslateSegment[]): TranslateBatch[] {
  const batches: TranslateBatch[] = []
  let currentBatch: TranslateBatch = { originalIndices: [], texts: [], charCount: 0 }

  segments.forEach(({ originalIndex, text }) => {
    const nextCharCount = currentBatch.charCount + text.length
    const shouldFlush = currentBatch.texts.length > 0
      && (currentBatch.texts.length >= MAX_BATCH_ITEMS || nextCharCount > MAX_BATCH_CHARS)

    if (shouldFlush) {
      batches.push(currentBatch)
      currentBatch = { originalIndices: [], texts: [], charCount: 0 }
    }

    currentBatch.originalIndices.push(originalIndex)
    currentBatch.texts.push(text)
    currentBatch.charCount += text.length
  })

  if (currentBatch.texts.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

async function withConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const taskIndex = nextIndex
      nextIndex += 1

      if (taskIndex >= tasks.length) return
      results[taskIndex] = await tasks[taskIndex]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

function isCacheable(
  task: TranslationTask,
  customSystemPrompt?: string,
  placeholderFormat?: TranslationPlaceholderFormat,
): boolean {
  return task === "translate" && !customSystemPrompt && !placeholderFormat
}

function resolveProviderSelection(
  session: AstraSession,
  config: AstraConfig,
): { providerId: ProviderId; model: string } {
  const requestedProvider = config.provider.id
  if (session.providerEntitlements.includes(requestedProvider)) {
    return {
      providerId: requestedProvider,
      model: config.provider.model,
    }
  }

  const fallbackProvider = (session.providerEntitlements[0] as ProviderId | undefined) ?? requestedProvider
  return {
    providerId: fallbackProvider,
    model: fallbackProvider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL,
  }
}

export async function translateWithWebRelay(params: {
  session: AstraSession
  config: AstraConfig
  request: WebTranslateRequest
}): Promise<WebTranslateResult> {
  const { request, session, config } = params
  const {
    texts,
    targetLang,
    sourceLang,
    context,
    task = "translate",
    customSystemPrompt,
    placeholderFormat,
  } = request

  if (texts.length === 0) {
    return {
      ok: true,
      translations: [],
      providerId: config.provider.id,
    }
  }

  const cacheable = isCacheable(task, customSystemPrompt, placeholderFormat)
  const cacheContext = cacheable ? buildTranslationCacheContext(config, request) : null
  const shouldUseCache = cacheable && cacheContext !== null

  let cachedResults = new Map<number, string>()
  if (shouldUseCache && cacheContext) {
    try {
      cachedResults = await getCachedTranslations(
        texts.map((text) => ({
          text,
          targetLang,
          cacheContext,
        })),
      )
    } catch {
      cachedResults = new Map()
    }
  }

  const uncachedEntries: Array<{ originalIndex: number; text: string }> = []
  for (let index = 0; index < texts.length; index += 1) {
    if (!cachedResults.has(index)) {
      uncachedEntries.push({ originalIndex: index, text: texts[index] })
    }
  }

  if (uncachedEntries.length === 0) {
    return {
      ok: true,
      translations: texts.map((_, index) => cachedResults.get(index) ?? ""),
      providerId: config.provider.id,
    }
  }

  const uncachedTexts = uncachedEntries.map((entry) => entry.text)
  const segments = splitIntoSegments(uncachedTexts, {
    preservePlaceholderTokens: placeholderFormat === "astra-rich-text-v1",
  })
  const batches = createBatches(segments)
  const provider = resolveProviderSelection(session, config)

  const batchTasks = batches.map((batch) => async () => translateWithRelay({
    providerId: provider.providerId,
    accessToken: session.sessionToken,
    relayBaseURL: session.relayBaseURL,
    model: provider.model,
    texts: batch.texts,
    targetLang,
    ...(sourceLang ? { sourceLang } : {}),
    ...(context ? { context } : {}),
    ...(task ? { task } : {}),
    ...(customSystemPrompt ? { customSystemPrompt } : {}),
    ...(config.languageLevel ? { languageLevel: config.languageLevel } : {}),
    serviceMode: config.serviceMode,
    ...(placeholderFormat ? { placeholderFormat } : {}),
  }))

  let batchResults: string[][]
  try {
    batchResults = await withConcurrency(batchTasks, MAX_CONCURRENCY)
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "PROVIDER_REQUEST_FAILED") }
  }

  const uncachedTranslations = Array.from({ length: uncachedTexts.length }, () => "")
  for (const [batchIndex, batchResult] of batchResults.entries()) {
    const batch = batches[batchIndex]

    if (batchResult.length !== batch.texts.length) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Translation batch response length did not match the request.",
        ),
      }
    }

    batch.originalIndices.forEach((originalIndex, translationIndex) => {
      uncachedTranslations[originalIndex] += batchResult[translationIndex]
    })
  }

  if (shouldUseCache && cacheContext) {
    for (let index = 0; index < uncachedEntries.length; index += 1) {
      void setCachedTranslation(
        uncachedEntries[index].text,
        targetLang,
        uncachedTranslations[index],
        cacheContext,
      ).catch(() => {})
    }
  }

  const translations = Array.from({ length: texts.length }, () => "")
  for (const [index, cachedTranslation] of cachedResults.entries()) {
    translations[index] = cachedTranslation
  }

  for (let index = 0; index < uncachedEntries.length; index += 1) {
    translations[uncachedEntries[index].originalIndex] = uncachedTranslations[index]
  }

  return {
    ok: true,
    translations,
    providerId: provider.providerId,
  }
}

export function saveTextTransferDraft(draft: Omit<TextTransferDraft, "createdAt">) {
  writeJsonStorage(WEB_TEXT_TRANSFER_STORAGE_KEY, {
    ...draft,
    createdAt: new Date().toISOString(),
  })
}

export function readTextTransferDraft(): TextTransferDraft | null {
  return readJsonStorage(WEB_TEXT_TRANSFER_STORAGE_KEY, TextTransferDraftSchema)
}

export function clearTextTransferDraft() {
  removeStorage(WEB_TEXT_TRANSFER_STORAGE_KEY)
}
