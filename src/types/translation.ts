import type {
  PresentationSettings,
  ResolvedSiteTranslationSettings,
} from "./config"

export type TranslationPhase = "idle" | "starting" | "running" | "stopping"

export type TranslationErrorCode =
  | "CONFIG_MISSING"
  | "CONTENT_UNAVAILABLE"
  | "PROVIDER_REQUEST_FAILED"
  | "PROVIDER_PARSE_FAILED"
  | "INVALID_RESPONSE"
  | "SITE_DISABLED"
  | "QUOTA_EXCEEDED"
  | "UNKNOWN"

export interface TranslationError {
  code: TranslationErrorCode
  message: string
}

export interface TranslationProgressSnapshot {
  totalBlocks: number
  queuedBlocks: number
  inFlightBlocks: number
  translatedBlocks: number
  failedBlocks: number
}

export interface TranslationSiteSnapshot {
  hostname: string | null
  enabled: boolean
  alwaysTranslate: boolean
}

export interface TranslationSnapshot {
  phase: TranslationPhase
  sessionId: number
  targetLang: string | null
  lastError: TranslationError | null
  progress: TranslationProgressSnapshot
  presentation: PresentationSettings
  site: TranslationSiteSnapshot
  /** Total number of translatable frames in the tab (set by background aggregation) */
  framesTotal?: number
  /** Number of frames currently translating (set by background aggregation) */
  framesTranslating?: number
}

export const EMPTY_TRANSLATION_PROGRESS: TranslationProgressSnapshot = {
  totalBlocks: 0,
  queuedBlocks: 0,
  inFlightBlocks: 0,
  translatedBlocks: 0,
  failedBlocks: 0,
}

export const DEFAULT_TRANSLATION_PRESENTATION: PresentationSettings = {
  mode: "bilingual",
  theme: "default",
  fontSize: 0.92,
  translationColor: "#64748b",
}

export const DEFAULT_TRANSLATION_SITE: TranslationSiteSnapshot = {
  hostname: null,
  enabled: true,
  alwaysTranslate: false,
}

export const IDLE_TRANSLATION_SNAPSHOT: TranslationSnapshot = {
  phase: "idle",
  sessionId: 0,
  targetLang: null,
  lastError: null,
  progress: { ...EMPTY_TRANSLATION_PROGRESS },
  presentation: { ...DEFAULT_TRANSLATION_PRESENTATION },
  site: { ...DEFAULT_TRANSLATION_SITE },
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

export function createSiteSnapshot(
  resolved: Pick<ResolvedSiteTranslationSettings, "hostname" | "enabled" | "alwaysTranslate">,
): TranslationSiteSnapshot {
  return {
    hostname: resolved.hostname,
    enabled: resolved.enabled,
    alwaysTranslate: resolved.alwaysTranslate,
  }
}
