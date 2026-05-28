import type { ServiceMode } from "@/types/config"
import type { TranslationRequestContext, TranslationTask } from "@/types/messages"

export interface ServiceModeSchedulingInput {
  requestedServiceMode?: ServiceMode
  texts: string[]
  task?: TranslationTask
  context?: TranslationRequestContext
  privacyMode?: boolean
  requestSource?: string
  tier?: string
}

export interface ServiceModeSchedulingDecision {
  serviceMode?: ServiceMode
  reason:
    | "missing"
    | "explicit-fast"
    | "explicit-best-quality"
    | "empty"
    | "learning-task-quality"
    | "terminology-quality"
    | "long-content-quality"
    | "subtitle-density-fast"
    | "short-content-fast"
    | "medium-content-balanced"
    | "privacy-balanced"
    | "requested-balanced"
    | "requested-automatic"
  stats: {
    textCount: number
    totalTextLength: number
    maxTextLength: number
    averageTextLength: number
  }
}

function computeStats(texts: string[]): ServiceModeSchedulingDecision["stats"] {
  const normalizedTexts = texts.map((text) => text.trim()).filter(Boolean)
  const totalTextLength = normalizedTexts.reduce((sum, text) => sum + text.length, 0)
  const maxTextLength = normalizedTexts.length > 0
    ? Math.max(...normalizedTexts.map((text) => text.length))
    : 0
  const averageTextLength = normalizedTexts.length > 0
    ? totalTextLength / normalizedTexts.length
    : 0

  return {
    textCount: normalizedTexts.length,
    totalTextLength,
    maxTextLength,
    averageTextLength,
  }
}

function createDecision(
  serviceMode: ServiceMode | undefined,
  reason: ServiceModeSchedulingDecision["reason"],
  stats: ServiceModeSchedulingDecision["stats"],
): ServiceModeSchedulingDecision {
  return { serviceMode, reason, stats }
}

export function scheduleServiceMode({
  requestedServiceMode,
  texts,
  task = "translate",
  context,
  privacyMode = false,
}: ServiceModeSchedulingInput): ServiceModeSchedulingDecision {
  const stats = computeStats(texts)

  if (!requestedServiceMode) {
    return createDecision(undefined, "missing", stats)
  }

  if (requestedServiceMode === "fast") {
    return createDecision("fast", "explicit-fast", stats)
  }

  if (requestedServiceMode === "best_quality") {
    return createDecision("best_quality", "explicit-best-quality", stats)
  }

  if (stats.textCount === 0) {
    return createDecision(requestedServiceMode, "empty", stats)
  }

  const hasTerminologyGlossary = !!context?.terminologyGlossary?.trim()
  const hasExplanationGlossary = !!context?.explanationGlossary?.trim()
  const hasGlossary = hasTerminologyGlossary || hasExplanationGlossary
  const allShortTexts = stats.maxTextLength <= 90
  const subtitleDensityLikely = stats.textCount >= 8
    && stats.averageTextLength <= 110
    && stats.totalTextLength <= 1800
  const longOrTechnicalContent = stats.maxTextLength >= 700
    || stats.totalTextLength >= 1400
    || stats.averageTextLength >= 500
  const mediumContent = stats.maxTextLength >= 260
    || stats.totalTextLength >= 700
    || stats.averageTextLength >= 160

  if (task !== "translate") {
    return createDecision("best_quality", "learning-task-quality", stats)
  }

  if (hasGlossary) {
    return createDecision("best_quality", "terminology-quality", stats)
  }

  if (longOrTechnicalContent) {
    return createDecision("best_quality", "long-content-quality", stats)
  }

  if (subtitleDensityLikely) {
    return createDecision("fast", "subtitle-density-fast", stats)
  }

  if (allShortTexts && stats.totalTextLength <= 360) {
    return createDecision("fast", "short-content-fast", stats)
  }

  if (mediumContent) {
    return createDecision("balanced", "medium-content-balanced", stats)
  }

  if (privacyMode && requestedServiceMode === "automatic") {
    return createDecision("balanced", "privacy-balanced", stats)
  }

  if (requestedServiceMode === "balanced") {
    return createDecision("balanced", "requested-balanced", stats)
  }

  return createDecision("automatic", "requested-automatic", stats)
}

export function resolveScheduledServiceMode(input: ServiceModeSchedulingInput): ServiceMode | undefined {
  return scheduleServiceMode(input).serviceMode
}
