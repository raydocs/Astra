import { z } from "zod"

import type { TranslationError, TranslationSnapshot } from "./translation"

export const TranslateBatchPayloadSchema = z.object({
  texts: z.array(z.string()),
  targetLang: z.string().min(1),
  sourceLang: z.string().min(1).optional(),
})

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
  payload?: {
    targetLang?: string
  }
}

export interface ContentStopTranslationCommand {
  type: "content/stop-translation"
}

export interface ContentToggleTranslationCommand {
  type: "content/toggle-translation"
  payload?: {
    targetLang?: string
  }
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
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<RuntimeResponse>

  if (candidate.type === "runtime/translate-batch:success") {
    return Array.isArray(candidate.payload?.translations)
  }

  if (candidate.type === "runtime/translate-batch:error") {
    return typeof candidate.error?.code === "string"
      && typeof candidate.error?.message === "string"
  }

  return false
}

export function isContentCommand(value: unknown): value is ContentCommand {
  if (typeof value !== "object" || value === null) return false

  const type = (value as { type?: string }).type
  return type === "content/get-translation-state"
    || type === "content/start-translation"
    || type === "content/stop-translation"
    || type === "content/toggle-translation"
}

export function isContentCommandResponse(
  value: unknown,
): value is ContentCommandResponse {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<ContentCommandResponse>

  if (candidate.ok === true) {
    return typeof candidate.state?.phase === "string"
  }

  if (candidate.ok === false) {
    return typeof candidate.error?.code === "string"
      && typeof candidate.error?.message === "string"
  }

  return false
}
