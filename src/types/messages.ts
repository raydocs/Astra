import { z } from "zod"

import {
  AstraConfigInputSchema,
  AstraConfigSchema,
  ContentScopeSchema,
  ExplainModeSchema,
  LanguageLevelSchema,
  TranslationModeSchema,
  TranslationThemeSchema,
} from "./config"
import {
  VideoNoteCreateResponseSchema,
  VideoNotePlatformSchema,
  VideoNoteStatusResponseSchema,
  VideoNoteTranscriptCaptureSchema,
} from "./video-notes"
import type { TranslationError, TranslationSnapshot } from "./translation"

export const TranslationRequestContextSchema = z.object({
  pageTitle: z.string().trim().min(1).optional(),
  pageUrl: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  metaDescription: z.string().trim().min(1).optional(),
  contentSummary: z.string().trim().min(1).optional(),
  selectionContext: z.string().trim().min(1).optional(),
  /** Terminology glossary for consistent translation of domain-specific terms. */
  terminologyGlossary: z.string().trim().min(1).optional(),
  /** Explanation glossary: required source => preferred terms for learner-facing explanations. */
  explanationGlossary: z.string().trim().min(1).optional(),
})

export const ContentTranslationOverridesSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  translationMode: TranslationModeSchema.optional(),
  translationTheme: TranslationThemeSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
})

export const TranslationTaskSchema = z.enum(["translate", "explain", "custom"])
export const TranslationPlaceholderFormatSchema = z.enum(["astra-rich-text-v1"])

export const TranslateBatchPayloadSchema = z.object({
  texts: z.array(z.string()),
  targetLang: z.string().min(1),
  sourceLang: z.string().min(1).optional(),
  context: TranslationRequestContextSchema.optional(),
  task: TranslationTaskSchema.optional(),
  customSystemPrompt: z.string().max(2000).optional(),
  placeholderFormat: TranslationPlaceholderFormatSchema.optional(),
  languageLevel: LanguageLevelSchema.optional(),
  explainMode: ExplainModeSchema.optional(),
  explanationRepairInstruction: z.string().trim().min(1).max(1600).optional(),
})

const TranslationErrorCodeSchema = z.enum([
  "CONFIG_MISSING",
  "CONTENT_UNAVAILABLE",
  "PROVIDER_REQUEST_FAILED",
  "PROVIDER_PARSE_FAILED",
  "INVALID_RESPONSE",
  "SITE_DISABLED",
  "QUOTA_EXCEEDED",
  "UNKNOWN",
])

const TranslationErrorSchema = z.object({
  code: TranslationErrorCodeSchema,
  message: z.string().trim().min(1),
})

export const PageStudyContextSchema = TranslationRequestContextSchema.pick({
  pageTitle: true,
  pageUrl: true,
  hostname: true,
  metaDescription: true,
  contentSummary: true,
}).extend({
  articleExcerpt: z.string().trim().min(1).optional(),
})

const TranslationProgressSnapshotSchema = z.object({
  totalBlocks: z.number().int().nonnegative(),
  queuedBlocks: z.number().int().nonnegative(),
  inFlightBlocks: z.number().int().nonnegative(),
  translatedBlocks: z.number().int().nonnegative(),
  failedBlocks: z.number().int().nonnegative(),
})

const TranslationSiteSnapshotSchema = z.object({
  hostname: z.string().trim().min(1).nullable(),
  enabled: z.boolean(),
  alwaysTranslate: z.boolean(),
})

const TranslationSelectorDiagnosticsSchema = z.object({
  configured: z.array(z.string()),
  valid: z.array(z.string()),
  invalid: z.array(z.string()),
  matchedBlocks: z.number().int().nonnegative(),
})

const TranslationSiteRuleFilterStageIdSchema = z.enum([
  "collected-blocks",
  "after-include-filters",
  "after-exclude-filters",
  "after-paragraph-filter",
])

const TranslationSiteRuleFilterStageDiagnosticsSchema = z.object({
  id: TranslationSiteRuleFilterStageIdSchema,
  count: z.number().int().nonnegative(),
})

const TranslationRuntimeDiagnosticsSchema = z.object({
  contentScope: z.string().optional(),
  effectiveContentScope: z.string().optional(),
  siteRules: z.object({
    inputBlockCount: z.number().int().nonnegative(),
    afterIncludeCount: z.number().int().nonnegative(),
    afterExcludeCount: z.number().int().nonnegative(),
    afterParagraphCount: z.number().int().nonnegative(),
    filterStages: z.array(TranslationSiteRuleFilterStageDiagnosticsSchema).optional(),
    selectors: TranslationSelectorDiagnosticsSchema,
    excludeSelectors: TranslationSelectorDiagnosticsSchema,
    paragraphMinLength: z.number().int().nonnegative().optional(),
  }).optional(),
}).passthrough()

const SubtitleQualitySnapshotSchema = z.object({
  surface: z.enum(["video", "meeting"]),
  active: z.boolean(),
  platform: z.string().trim().min(1).nullable(),
  pipeline: z.string().trim().min(1).nullable(),
  source: z.string().trim().min(1).nullable(),
  status: z.string().trim().min(1),
  anomalies: z.array(z.string()),
  translatedNodeCount: z.number().int().nonnegative(),
  sourceTextLength: z.number().int().nonnegative(),
  pendingRequestCount: z.number().int().nonnegative(),
  cacheSize: z.number().int().nonnegative(),
  capturedAt: z.number().int().nonnegative(),
})

const TranslationSnapshotSchema = z.object({
  phase: z.enum(["idle", "starting", "running", "stopping"]),
  sessionId: z.number().int().nonnegative(),
  targetLang: z.string().trim().min(1).nullable(),
  lastError: TranslationErrorSchema.nullable(),
  progress: TranslationProgressSnapshotSchema,
  presentation: z.object({
    mode: TranslationModeSchema,
    theme: TranslationThemeSchema,
  }),
  site: TranslationSiteSnapshotSchema,
  diagnostics: TranslationRuntimeDiagnosticsSchema.optional(),
  subtitleQuality: SubtitleQualitySnapshotSchema.optional(),
  framesTotal: z.number().int().nonnegative().optional(),
  framesTranslating: z.number().int().nonnegative().optional(),
})

const ProviderRoutingSuccessMetadataSchema = z.object({
  route: z.enum(["direct", "relay", "fallback"]),
  attemptedTransports: z.array(z.enum(["direct", "relay"])),
  finalTransport: z.enum(["direct", "relay"]),
  fallbackUsed: z.boolean(),
})

const ProviderRoutingErrorMetadataSchema = z.object({
  route: z.enum(["direct", "relay", "fallback"]).nullable(),
  attemptedTransports: z.array(z.enum(["direct", "relay"])),
  finalTransport: z.enum(["direct", "relay"]).nullable(),
  fallbackUsed: z.boolean(),
})

const RuntimeTranslateResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/translate-batch:success"),
    payload: z.object({
      translations: z.array(z.string()),
      metadata: ProviderRoutingSuccessMetadataSchema.optional(),
    }),
  }),
  z.object({
    type: z.literal("runtime/translate-batch:error"),
    error: TranslationErrorSchema,
    metadata: ProviderRoutingErrorMetadataSchema.optional(),
  }),
])

const RuntimeSaveConfigResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/save-config:success"),
    payload: z.object({
      config: AstraConfigSchema,
    }),
  }),
  z.object({
    type: z.literal("runtime/save-config:error"),
    error: TranslationErrorSchema,
  }),
])

const LearningContinuitySyncCountSchema = z.object({
  config: z.number().int().nonnegative(),
  vocabulary: z.number().int().nonnegative(),
  reading_history: z.number().int().nonnegative(),
  study_progress: z.number().int().nonnegative(),
})

const LearningContinuitySyncResultSchema = z.object({
  skipped: z.boolean(),
  reason: z.enum(["no-session", "anonymous-session", "missing-relay-base-url", "synced"]),
  pushed: LearningContinuitySyncCountSchema,
  pulled: LearningContinuitySyncCountSchema,
  rejected: z.number().int().nonnegative(),
})

const LearningContinuitySyncStatusSchema = z.object({
  inFlight: z.boolean(),
  queued: z.boolean(),
  lastReason: z.string().trim().min(1).nullable(),
  lastStartedAt: z.string().trim().min(1).nullable(),
  lastFinishedAt: z.string().trim().min(1).nullable(),
  lastResult: LearningContinuitySyncResultSchema.nullable(),
  lastError: z.string().trim().min(1).nullable(),
  accountEmail: z.string().trim().min(1).nullable(),
  stateLastRunAt: z.string().trim().min(1).nullable(),
  stateLastSuccessAt: z.string().trim().min(1).nullable(),
  stateLastError: z.string().trim().min(1).nullable(),
  cursors: z.object({
    config: z.string().trim().min(1).nullable(),
    vocabulary: z.string().trim().min(1).nullable(),
    reading_history: z.string().trim().min(1).nullable(),
    study_progress: z.string().trim().min(1).nullable(),
  }),
})

const RuntimeLearningContinuitySyncResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/learning-continuity-sync:success"),
    payload: z.object({
      status: LearningContinuitySyncStatusSchema,
      result: LearningContinuitySyncResultSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal("runtime/learning-continuity-sync:error"),
    error: TranslationErrorSchema,
    payload: z.object({
      status: LearningContinuitySyncStatusSchema,
    }).optional(),
  }),
])

const RuntimeLearningContinuitySyncStatusResponseSchema = z.object({
  type: z.literal("runtime/learning-continuity-sync-status:success"),
  payload: z.object({
    status: LearningContinuitySyncStatusSchema,
  }),
})

const TranslationCacheBucketStatsSchema = z.object({
  bucketKey: z.string(),
  providerId: z.string(),
  model: z.string(),
  connectionMode: z.string(),
  lookups: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  misses: z.number().int().nonnegative(),
  writes: z.number().int().nonnegative(),
  hitRate: z.number().nonnegative(),
  lastAccessedAt: z.number().int().nonnegative(),
})

const TranslationCacheStatsSchema = z.object({
  count: z.number().int().nonnegative(),
  oldestMs: z.number().int().nonnegative(),
  lookups: z.number().int().nonnegative(),
  hits: z.number().int().nonnegative(),
  misses: z.number().int().nonnegative(),
  writes: z.number().int().nonnegative(),
  hitRate: z.number().nonnegative(),
  buckets: z.array(TranslationCacheBucketStatsSchema),
})

const RuntimeTranslationCacheStatsResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/translation-cache-stats:success"),
    payload: TranslationCacheStatsSchema,
  }),
  z.object({
    type: z.literal("runtime/translation-cache-stats:error"),
    error: TranslationErrorSchema,
  }),
])

const RuntimeVideoNoteCreateFromCurrentTabPayloadSchema = z.object({
  forceRegenerate: z.boolean().optional(),
})

const RuntimeVideoNoteGetJobPayloadSchema = z.object({
  jobId: z.string().trim().min(1),
})

const RuntimeVideoNoteCreateResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/video-note:create-from-current-tab:success"),
    payload: VideoNoteCreateResponseSchema,
  }),
  z.object({
    type: z.literal("runtime/video-note:create-from-current-tab:error"),
    error: TranslationErrorSchema,
  }),
])

const RuntimeVideoNoteGetJobResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/video-note:get-job:success"),
    payload: VideoNoteStatusResponseSchema,
  }),
  z.object({
    type: z.literal("runtime/video-note:get-job:error"),
    error: TranslationErrorSchema,
  }),
])

const RuntimeResponseSchema = z.union([
  RuntimeTranslateResponseSchema,
  RuntimeSaveConfigResponseSchema,
  RuntimeLearningContinuitySyncResponseSchema,
  RuntimeLearningContinuitySyncStatusResponseSchema,
  RuntimeTranslationCacheStatsResponseSchema,
  RuntimeVideoNoteCreateResponseSchema,
  RuntimeVideoNoteGetJobResponseSchema,
])

const ContentCommandResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    state: TranslationSnapshotSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: TranslationErrorSchema,
    state: TranslationSnapshotSchema.optional(),
  }),
])

const ContentStudyContextResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    context: PageStudyContextSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: TranslationErrorSchema,
  }),
])

const ContentVideoNoteSourceSchema = z.object({
  sourceUrl: z.string().trim().url(),
  title: z.string().trim().min(1).nullable(),
  platform: VideoNotePlatformSchema,
  capture: VideoNoteTranscriptCaptureSchema.nullable(),
})

const ContentVideoNoteSourceResponseSchema = z.union([
  z.object({
    ok: z.literal(true),
    source: ContentVideoNoteSourceSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: TranslationErrorSchema,
  }),
])

export type TranslationRequestContext = z.infer<typeof TranslationRequestContextSchema>
export type PageStudyContext = z.infer<typeof PageStudyContextSchema>
export type TranslationTask = z.infer<typeof TranslationTaskSchema>
export type TranslationPlaceholderFormat = z.infer<typeof TranslationPlaceholderFormatSchema>
export type ContentTranslationOverrides = z.infer<typeof ContentTranslationOverridesSchema>
export type ContentVideoNoteSource = z.infer<typeof ContentVideoNoteSourceSchema>

export interface RuntimeTranslateBatchRequest {
  type: "runtime/translate-batch"
  payload: z.infer<typeof TranslateBatchPayloadSchema>
}

export interface RuntimeTranslateBatchSuccessResponse {
  type: "runtime/translate-batch:success"
    payload: {
      translations: string[]
      metadata?: {
        route: "direct" | "relay" | "fallback"
        attemptedTransports: Array<"direct" | "relay">
        finalTransport: "direct" | "relay"
        fallbackUsed: boolean
    }
  }
}

export interface RuntimeTranslateBatchErrorResponse {
  type: "runtime/translate-batch:error"
  error: TranslationError
  metadata?: {
    route: "direct" | "relay" | "fallback" | null
    attemptedTransports: Array<"direct" | "relay">
    finalTransport: "direct" | "relay" | null
    fallbackUsed: boolean
  }
}

export interface RuntimeTabCommandRequest {
  type: "runtime/tab-command"
  tabId: number
  command: ContentCommand
}

export interface RuntimeCurrentTabCommandRequest {
  type: "runtime/current-tab-command"
  command: ContentCommand
}

export interface RuntimeSaveConfigRequest {
  type: "runtime/save-config"
  payload: z.infer<typeof AstraConfigInputSchema>
}

export interface RuntimeLearningContinuitySyncRequest {
  type: "runtime/learning-continuity-sync"
  reason?: string
}

export interface RuntimeLearningContinuitySyncStatusRequest {
  type: "runtime/learning-continuity-sync-status"
}

export interface RuntimeTranslationCacheStatsRequest {
  type: "runtime/translation-cache-stats"
}

export interface RuntimeVideoNoteCreateFromCurrentTabRequest {
  type: "runtime/video-note:create-from-current-tab"
  payload?: z.infer<typeof RuntimeVideoNoteCreateFromCurrentTabPayloadSchema>
}

export interface RuntimeVideoNoteGetJobRequest {
  type: "runtime/video-note:get-job"
  payload: z.infer<typeof RuntimeVideoNoteGetJobPayloadSchema>
}

export interface RuntimeSaveConfigSuccessResponse {
  type: "runtime/save-config:success"
  payload: {
    config: z.infer<typeof AstraConfigSchema>
  }
}

export interface RuntimeSaveConfigErrorResponse {
  type: "runtime/save-config:error"
  error: TranslationError
}

export type LearningContinuitySyncResult = z.infer<typeof LearningContinuitySyncResultSchema>
export type LearningContinuitySyncStatus = z.infer<typeof LearningContinuitySyncStatusSchema>

export interface RuntimeLearningContinuitySyncSuccessResponse {
  type: "runtime/learning-continuity-sync:success"
  payload: {
    status: LearningContinuitySyncStatus
    result: LearningContinuitySyncResult | null
  }
}

export interface RuntimeLearningContinuitySyncErrorResponse {
  type: "runtime/learning-continuity-sync:error"
  error: TranslationError
  payload?: {
    status: LearningContinuitySyncStatus
  }
}

export interface RuntimeLearningContinuitySyncStatusSuccessResponse {
  type: "runtime/learning-continuity-sync-status:success"
  payload: {
    status: LearningContinuitySyncStatus
  }
}

export type TranslationCacheStats = z.infer<typeof TranslationCacheStatsSchema>

export interface RuntimeTranslationCacheStatsSuccessResponse {
  type: "runtime/translation-cache-stats:success"
  payload: TranslationCacheStats
}

export interface RuntimeTranslationCacheStatsErrorResponse {
  type: "runtime/translation-cache-stats:error"
  error: TranslationError
}

export interface RuntimeVideoNoteCreateFromCurrentTabSuccessResponse {
  type: "runtime/video-note:create-from-current-tab:success"
  payload: z.infer<typeof VideoNoteCreateResponseSchema>
}

export interface RuntimeVideoNoteCreateFromCurrentTabErrorResponse {
  type: "runtime/video-note:create-from-current-tab:error"
  error: TranslationError
}

export interface RuntimeVideoNoteGetJobSuccessResponse {
  type: "runtime/video-note:get-job:success"
  payload: z.infer<typeof VideoNoteStatusResponseSchema>
}

export interface RuntimeVideoNoteGetJobErrorResponse {
  type: "runtime/video-note:get-job:error"
  error: TranslationError
}

export type RuntimeRequest =
  | RuntimeTranslateBatchRequest
  | RuntimeTabCommandRequest
  | RuntimeCurrentTabCommandRequest
  | RuntimeSaveConfigRequest
  | RuntimeLearningContinuitySyncRequest
  | RuntimeLearningContinuitySyncStatusRequest
  | RuntimeTranslationCacheStatsRequest
  | RuntimeVideoNoteCreateFromCurrentTabRequest
  | RuntimeVideoNoteGetJobRequest
export type RuntimeResponse =
  | RuntimeTranslateBatchSuccessResponse
  | RuntimeTranslateBatchErrorResponse
  | RuntimeSaveConfigSuccessResponse
  | RuntimeSaveConfigErrorResponse
  | RuntimeLearningContinuitySyncSuccessResponse
  | RuntimeLearningContinuitySyncErrorResponse
  | RuntimeLearningContinuitySyncStatusSuccessResponse
  | RuntimeTranslationCacheStatsSuccessResponse
  | RuntimeTranslationCacheStatsErrorResponse
  | RuntimeVideoNoteCreateFromCurrentTabSuccessResponse
  | RuntimeVideoNoteCreateFromCurrentTabErrorResponse
  | RuntimeVideoNoteGetJobSuccessResponse
  | RuntimeVideoNoteGetJobErrorResponse

export interface ContentGetTranslationStateCommand {
  type: "content/get-translation-state"
}

export interface ContentStartTranslationCommand {
  type: "content/start-translation"
  payload?: ContentTranslationOverrides
}

export interface ContentStopTranslationCommand {
  type: "content/stop-translation"
}

export interface ContentGetStudyContextCommand {
  type: "content/get-study-context"
}

export interface ContentGetVideoNoteSourceCommand {
  type: "content/get-video-note-source"
}

export interface ContentDetectArticleCommand {
  type: "content/detect-article"
}

export interface ContentDetectArticleResponse {
  ok: boolean
  selector?: string
}

export interface ContentToggleTranslationCommand {
  type: "content/toggle-translation"
  payload?: ContentTranslationOverrides
}

export interface ContentRetryFailedCommand {
  type: "content/retry-failed"
}

export type ContentCommand =
  | ContentGetTranslationStateCommand
  | ContentStartTranslationCommand
  | ContentStopTranslationCommand
  | ContentToggleTranslationCommand
  | ContentRetryFailedCommand

export type ContentCommandResponse =
  | { ok: true; state: TranslationSnapshot }
  | { ok: false; error: TranslationError; state?: TranslationSnapshot }

export type ContentStudyContextResponse =
  | { ok: true; context: PageStudyContext }
  | { ok: false; error: TranslationError }

export type ContentVideoNoteSourceResponse =
  | { ok: true; source: ContentVideoNoteSource }
  | { ok: false; error: TranslationError }

export function isRuntimeTranslateBatchRequest(
  value: unknown,
): value is RuntimeTranslateBatchRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeTranslateBatchRequest>
  return candidate.type === "runtime/translate-batch"
    && TranslateBatchPayloadSchema.safeParse(candidate.payload).success
}

export function isRuntimeTabCommandRequest(
  value: unknown,
): value is RuntimeTabCommandRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeTabCommandRequest>
  return candidate.type === "runtime/tab-command"
    && typeof candidate.tabId === "number"
    && isContentCommand(candidate.command)
}

export function isRuntimeCurrentTabCommandRequest(
  value: unknown,
): value is RuntimeCurrentTabCommandRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeCurrentTabCommandRequest>
  return candidate.type === "runtime/current-tab-command"
    && isContentCommand(candidate.command)
}

export function isRuntimeSaveConfigRequest(
  value: unknown,
): value is RuntimeSaveConfigRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeSaveConfigRequest>
  return candidate.type === "runtime/save-config"
    && AstraConfigInputSchema.safeParse(candidate.payload).success
}

export function isRuntimeLearningContinuitySyncRequest(
  value: unknown,
): value is RuntimeLearningContinuitySyncRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeLearningContinuitySyncRequest>
  return candidate.type === "runtime/learning-continuity-sync"
    && (candidate.reason === undefined || typeof candidate.reason === "string")
}

export function isRuntimeLearningContinuitySyncStatusRequest(
  value: unknown,
): value is RuntimeLearningContinuitySyncStatusRequest {
  if (typeof value !== "object" || value === null) return false
  return (value as Partial<RuntimeLearningContinuitySyncStatusRequest>).type === "runtime/learning-continuity-sync-status"
}

export function isRuntimeTranslationCacheStatsRequest(
  value: unknown,
): value is RuntimeTranslationCacheStatsRequest {
  if (typeof value !== "object" || value === null) return false
  return (value as Partial<RuntimeTranslationCacheStatsRequest>).type === "runtime/translation-cache-stats"
}

export function isRuntimeVideoNoteCreateFromCurrentTabRequest(
  value: unknown,
): value is RuntimeVideoNoteCreateFromCurrentTabRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeVideoNoteCreateFromCurrentTabRequest>
  return candidate.type === "runtime/video-note:create-from-current-tab"
    && (candidate.payload === undefined || RuntimeVideoNoteCreateFromCurrentTabPayloadSchema.safeParse(candidate.payload).success)
}

export function isRuntimeVideoNoteGetJobRequest(
  value: unknown,
): value is RuntimeVideoNoteGetJobRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeVideoNoteGetJobRequest>
  return candidate.type === "runtime/video-note:get-job"
    && RuntimeVideoNoteGetJobPayloadSchema.safeParse(candidate.payload).success
}

export function isRuntimeResponse(value: unknown): value is RuntimeResponse {
  return RuntimeResponseSchema.safeParse(value).success
}

export function isRuntimeTranslateResponse(
  value: unknown,
): value is RuntimeTranslateBatchSuccessResponse | RuntimeTranslateBatchErrorResponse {
  return RuntimeTranslateResponseSchema.safeParse(value).success
}

export function isRuntimeSaveConfigResponse(
  value: unknown,
): value is RuntimeSaveConfigSuccessResponse | RuntimeSaveConfigErrorResponse {
  return RuntimeSaveConfigResponseSchema.safeParse(value).success
}

export function isRuntimeLearningContinuitySyncResponse(
  value: unknown,
): value is RuntimeLearningContinuitySyncSuccessResponse | RuntimeLearningContinuitySyncErrorResponse {
  return RuntimeLearningContinuitySyncResponseSchema.safeParse(value).success
}

export function isRuntimeLearningContinuitySyncStatusResponse(
  value: unknown,
): value is RuntimeLearningContinuitySyncStatusSuccessResponse {
  return RuntimeLearningContinuitySyncStatusResponseSchema.safeParse(value).success
}

export function isRuntimeTranslationCacheStatsResponse(
  value: unknown,
): value is RuntimeTranslationCacheStatsSuccessResponse | RuntimeTranslationCacheStatsErrorResponse {
  return RuntimeTranslationCacheStatsResponseSchema.safeParse(value).success
}

export function isContentCommand(value: unknown): value is ContentCommand {
  if (typeof value !== "object" || value === null) return false

  const candidate = value as { type?: string; payload?: unknown }

  switch (candidate.type) {
    case "content/get-translation-state":
    case "content/stop-translation":
    case "content/retry-failed":
      return true
    case "content/start-translation":
    case "content/toggle-translation":
      return candidate.payload === undefined
        || ContentTranslationOverridesSchema.safeParse(candidate.payload).success
    default:
      return false
  }
}

export function isContentStudyContextCommand(
  value: unknown,
): value is ContentGetStudyContextCommand {
  if (typeof value !== "object" || value === null) return false
  return (value as { type?: string }).type === "content/get-study-context"
}

export function isContentVideoNoteSourceCommand(
  value: unknown,
): value is ContentGetVideoNoteSourceCommand {
  if (typeof value !== "object" || value === null) return false
  return (value as { type?: string }).type === "content/get-video-note-source"
}

export function isContentDetectArticleCommand(
  value: unknown,
): value is ContentDetectArticleCommand {
  if (typeof value !== "object" || value === null) return false
  return (value as { type?: string }).type === "content/detect-article"
}

export function isContentCommandResponse(
  value: unknown,
): value is ContentCommandResponse {
  return ContentCommandResponseSchema.safeParse(value).success
}

export function isContentStudyContextResponse(
  value: unknown,
): value is ContentStudyContextResponse {
  return ContentStudyContextResponseSchema.safeParse(value).success
}

export function isContentVideoNoteSourceResponse(
  value: unknown,
): value is ContentVideoNoteSourceResponse {
  return ContentVideoNoteSourceResponseSchema.safeParse(value).success
}
