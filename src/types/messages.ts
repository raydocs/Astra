import { z } from "zod"

import {
  ContentScopeSchema,
  TranslationModeSchema,
  TranslationThemeSchema,
  type ContentScope,
  type TranslationMode,
  type TranslationTheme,
} from "./config"
import type { TranslationError, TranslationSnapshot } from "./translation"

export const TranslationRequestContextSchema = z.object({
  pageTitle: z.string().trim().min(1).optional(),
  pageUrl: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  metaDescription: z.string().trim().min(1).optional(),
  contentSummary: z.string().trim().min(1).optional(),
  selectionContext: z.string().trim().min(1).optional(),
})

export const ContentTranslationOverridesSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  translationMode: TranslationModeSchema.optional(),
  translationTheme: TranslationThemeSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
})

export const TranslationTaskSchema = z.enum(["translate", "explain"])

export const TranslateBatchPayloadSchema = z.object({
  texts: z.array(z.string()),
  targetLang: z.string().min(1),
  sourceLang: z.string().min(1).optional(),
  context: TranslationRequestContextSchema.optional(),
  task: TranslationTaskSchema.optional(),
})

const TranslationErrorSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
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
})

const RuntimeResponseSchema = z.union([
  z.object({
    type: z.literal("runtime/translate-batch:success"),
    payload: z.object({
      translations: z.array(z.string()),
    }),
  }),
  z.object({
    type: z.literal("runtime/translate-batch:error"),
    error: TranslationErrorSchema,
  }),
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

export type TranslationRequestContext = z.infer<typeof TranslationRequestContextSchema>
export type TranslationTask = z.infer<typeof TranslationTaskSchema>
export type ContentTranslationOverrides = {
  targetLang?: string
  translationMode?: TranslationMode
  translationTheme?: TranslationTheme
  contentScope?: ContentScope
}

export interface RuntimeTranslateBatchRequest {
  type: "runtime/translate-batch"
  payload: z.infer<typeof TranslateBatchPayloadSchema>
}

export interface RuntimeTranslateBatchSuccessResponse {
  type: "runtime/translate-batch:success"
  payload: {
    translations: string[]
  }
}

export interface RuntimeTranslateBatchErrorResponse {
  type: "runtime/translate-batch:error"
  error: TranslationError
}

export type RuntimeRequest = RuntimeTranslateBatchRequest
export type RuntimeResponse =
  | RuntimeTranslateBatchSuccessResponse
  | RuntimeTranslateBatchErrorResponse

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

export function isRuntimeTranslateBatchRequest(
  value: unknown,
): value is RuntimeTranslateBatchRequest {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeTranslateBatchRequest>
  return candidate.type === "runtime/translate-batch"
    && TranslateBatchPayloadSchema.safeParse(candidate.payload).success
}

export function isRuntimeResponse(value: unknown): value is RuntimeResponse {
  return RuntimeResponseSchema.safeParse(value).success
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

export function isContentCommandResponse(
  value: unknown,
): value is ContentCommandResponse {
  return ContentCommandResponseSchema.safeParse(value).success
}
