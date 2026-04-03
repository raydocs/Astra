import { z } from "zod"

import {
  AstraConfigInputSchema,
  AstraConfigSchema,
  ContentScopeSchema,
  TranslationModeSchema,
  TranslationThemeSchema,
} from "./config"
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
  framesTotal: z.number().int().nonnegative().optional(),
  framesTranslating: z.number().int().nonnegative().optional(),
})

const ProviderRoutingSuccessMetadataSchema = z.object({
  attemptedTransports: z.array(z.enum(["direct", "relay"])),
  finalTransport: z.enum(["direct", "relay"]),
  fallbackUsed: z.boolean(),
})

const ProviderRoutingErrorMetadataSchema = z.object({
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

const RuntimeResponseSchema = z.union([
  RuntimeTranslateResponseSchema,
  RuntimeSaveConfigResponseSchema,
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

export type TranslationRequestContext = z.infer<typeof TranslationRequestContextSchema>
export type PageStudyContext = z.infer<typeof PageStudyContextSchema>
export type TranslationTask = z.infer<typeof TranslationTaskSchema>
export type TranslationPlaceholderFormat = z.infer<typeof TranslationPlaceholderFormatSchema>
export type ContentTranslationOverrides = z.infer<typeof ContentTranslationOverridesSchema>

export interface RuntimeTranslateBatchRequest {
  type: "runtime/translate-batch"
  payload: z.infer<typeof TranslateBatchPayloadSchema>
}

export interface RuntimeTranslateBatchSuccessResponse {
  type: "runtime/translate-batch:success"
  payload: {
    translations: string[]
    metadata?: {
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

export type RuntimeRequest =
  | RuntimeTranslateBatchRequest
  | RuntimeTabCommandRequest
  | RuntimeCurrentTabCommandRequest
  | RuntimeSaveConfigRequest
export type RuntimeResponse =
  | RuntimeTranslateBatchSuccessResponse
  | RuntimeTranslateBatchErrorResponse
  | RuntimeSaveConfigSuccessResponse
  | RuntimeSaveConfigErrorResponse

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

export interface ContentToggleTranslationCommand {
  type: "content/toggle-translation"
  payload?: ContentTranslationOverrides
}

export type ContentCommand =
  | ContentGetTranslationStateCommand
  | ContentStartTranslationCommand
  | ContentStopTranslationCommand
  | ContentToggleTranslationCommand

export type ContentCommandResponse =
  | { ok: true; state: TranslationSnapshot }
  | { ok: false; error: TranslationError; state?: TranslationSnapshot }

export type ContentStudyContextResponse =
  | { ok: true; context: PageStudyContext }
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

export function isContentCommand(value: unknown): value is ContentCommand {
  if (typeof value !== "object" || value === null) return false

  const candidate = value as { type?: string; payload?: unknown }

  switch (candidate.type) {
    case "content/get-translation-state":
    case "content/stop-translation":
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
