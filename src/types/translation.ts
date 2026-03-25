export type TranslationPhase = "idle" | "starting" | "running" | "stopping"

export type TranslationErrorCode =
  | "CONFIG_MISSING"
  | "CONTENT_UNAVAILABLE"
  | "PROVIDER_REQUEST_FAILED"
  | "PROVIDER_PARSE_FAILED"
  | "INVALID_RESPONSE"
  | "UNKNOWN"

export interface TranslationError {
  code: TranslationErrorCode
  message: string
}

export interface TranslationSnapshot {
  phase: TranslationPhase
  sessionId: number
  targetLang: string | null
  lastError: TranslationError | null
}

export const IDLE_TRANSLATION_SNAPSHOT: TranslationSnapshot = {
  phase: "idle",
  sessionId: 0,
  targetLang: null,
  lastError: null,
}

export class AstraError extends Error {
  readonly code: TranslationErrorCode

  constructor(code: TranslationErrorCode, message: string) {
    super(message)
    this.name = "AstraError"
    this.code = code
  }
}

export function createTranslationError(
  code: TranslationErrorCode,
  message: string,
): TranslationError {
  return { code, message }
}

export function toTranslationError(
  error: unknown,
  fallbackCode: TranslationErrorCode = "UNKNOWN",
): TranslationError {
  if (error instanceof AstraError) {
    return createTranslationError(error.code, error.message)
  }

  if (error instanceof Error) {
    return createTranslationError(fallbackCode, error.message)
  }

  return createTranslationError(fallbackCode, "Unexpected error.")
}

export function isTranslationActive(snapshot: TranslationSnapshot): boolean {
  return snapshot.phase !== "idle"
}
