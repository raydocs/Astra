import type { ServiceMode } from "../types/config"
import type { TranslationTask } from "../types/messages"
import {
  AstraFallbackReasonSchema,
  AstraOperatingMetadataSchema,
  AstraTaskClassSchema,
  type AstraCostBucket,
  type AstraFallbackReason,
  type AstraFeatureSurface,
  type AstraInternalRoute,
  type AstraLatencyBucket,
  type AstraOperatingMetadata,
  type AstraOperatingTier,
  type AstraTaskClass,
} from "../types/operating-model"

export const ASTRA_TASK_CLASSES = AstraTaskClassSchema.options
export const ASTRA_FALLBACK_REASONS = AstraFallbackReasonSchema.options

interface AstraRoutingPreferencePolicy {
  automatic: AstraInternalRoute
  fast: AstraInternalRoute
  balanced: AstraInternalRoute
  best_quality: AstraInternalRoute
}

interface AstraRoutingTierPolicy {
  free: AstraInternalRoute
  trial: AstraInternalRoute
  pro: AstraInternalRoute
  unknown: AstraInternalRoute
}

interface AstraRoutingFallbackStep {
  reason: AstraFallbackReason
  route: AstraInternalRoute
}

export interface AstraRoutingPolicy {
  taskClass: AstraTaskClass
  surface: AstraFeatureSurface
  costBucket: AstraCostBucket
  defaultRoute: AstraInternalRoute
  servicePreference: AstraRoutingPreferencePolicy
  tier: AstraRoutingTierPolicy
  privacyModeRoute: AstraInternalRoute
  fallbackLadder: readonly AstraRoutingFallbackStep[]
}

export const FALLBACK_REASON_ROUTE_POLICY: Record<AstraFallbackReason, { fallbackUsed: boolean; route: AstraInternalRoute }> = {
  none: { fallbackUsed: false, route: "balanced_path" },
  timeout: { fallbackUsed: true, route: "fast_path" },
  outage: { fallbackUsed: true, route: "balanced_path" },
  cost: { fallbackUsed: true, route: "fast_path" },
  length: { fallbackUsed: true, route: "partial_result_path" },
  quality: { fallbackUsed: true, route: "quality_path" },
  unknown: { fallbackUsed: true, route: "user_action_path" },
}

const DEFAULT_FALLBACK_LADDER: readonly AstraRoutingFallbackStep[] = [
  { reason: "timeout", route: "fast_path" },
  { reason: "outage", route: "balanced_path" },
  { reason: "cost", route: "fast_path" },
  { reason: "length", route: "partial_result_path" },
  { reason: "quality", route: "quality_path" },
  { reason: "unknown", route: "user_action_path" },
]

export const ASTRA_ROUTING_POLICIES: Record<AstraTaskClass, AstraRoutingPolicy> = {
  instant_phrase: {
    taskClass: "instant_phrase",
    surface: "selection",
    costBucket: "low",
    defaultRoute: "fast_path",
    servicePreference: { automatic: "fast_path", fast: "fast_path", balanced: "balanced_path", best_quality: "balanced_path" },
    tier: { free: "fast_path", trial: "fast_path", pro: "balanced_path", unknown: "fast_path" },
    privacyModeRoute: "fast_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  paragraph_understanding: {
    taskClass: "paragraph_understanding",
    surface: "page",
    costBucket: "medium",
    defaultRoute: "balanced_path",
    servicePreference: { automatic: "balanced_path", fast: "fast_path", balanced: "balanced_path", best_quality: "quality_path" },
    tier: { free: "fast_path", trial: "balanced_path", pro: "balanced_path", unknown: "balanced_path" },
    privacyModeRoute: "fast_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  context_explanation: {
    taskClass: "context_explanation",
    surface: "selection",
    costBucket: "medium",
    defaultRoute: "quality_path",
    servicePreference: { automatic: "quality_path", fast: "balanced_path", balanced: "quality_path", best_quality: "quality_path" },
    tier: { free: "balanced_path", trial: "quality_path", pro: "quality_path", unknown: "balanced_path" },
    privacyModeRoute: "balanced_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  deep_reading: {
    taskClass: "deep_reading",
    surface: "page",
    costBucket: "high",
    defaultRoute: "long_context_path",
    servicePreference: { automatic: "long_context_path", fast: "partial_result_path", balanced: "long_context_path", best_quality: "quality_path" },
    tier: { free: "partial_result_path", trial: "long_context_path", pro: "long_context_path", unknown: "partial_result_path" },
    privacyModeRoute: "partial_result_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  video_summary: {
    taskClass: "video_summary",
    surface: "video",
    costBucket: "high",
    defaultRoute: "batch_background_path",
    servicePreference: { automatic: "batch_background_path", fast: "partial_result_path", balanced: "batch_background_path", best_quality: "quality_path" },
    tier: { free: "partial_result_path", trial: "batch_background_path", pro: "batch_background_path", unknown: "partial_result_path" },
    privacyModeRoute: "partial_result_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  review_card: {
    taskClass: "review_card",
    surface: "review",
    costBucket: "low",
    defaultRoute: "template_path",
    servicePreference: { automatic: "template_path", fast: "template_path", balanced: "balanced_path", best_quality: "balanced_path" },
    tier: { free: "template_path", trial: "balanced_path", pro: "balanced_path", unknown: "template_path" },
    privacyModeRoute: "template_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  writing_assist: {
    taskClass: "writing_assist",
    surface: "writing",
    costBucket: "medium",
    defaultRoute: "quality_path",
    servicePreference: { automatic: "quality_path", fast: "balanced_path", balanced: "quality_path", best_quality: "quality_path" },
    tier: { free: "balanced_path", trial: "quality_path", pro: "quality_path", unknown: "balanced_path" },
    privacyModeRoute: "balanced_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
  digest: {
    taskClass: "digest",
    surface: "digest",
    costBucket: "medium",
    defaultRoute: "batch_background_path",
    servicePreference: { automatic: "batch_background_path", fast: "template_path", balanced: "batch_background_path", best_quality: "quality_path" },
    tier: { free: "template_path", trial: "batch_background_path", pro: "batch_background_path", unknown: "template_path" },
    privacyModeRoute: "template_path",
    fallbackLadder: DEFAULT_FALLBACK_LADDER,
  },
}

export const TASK_COST_BUCKETS: Record<AstraTaskClass, AstraCostBucket> = Object.fromEntries(
  ASTRA_TASK_CLASSES.map((taskClass) => [taskClass, ASTRA_ROUTING_POLICIES[taskClass].costBucket]),
) as Record<AstraTaskClass, AstraCostBucket>

export const DEFAULT_TASK_SURFACES: Record<AstraTaskClass, AstraFeatureSurface> = Object.fromEntries(
  ASTRA_TASK_CLASSES.map((taskClass) => [taskClass, ASTRA_ROUTING_POLICIES[taskClass].surface]),
) as Record<AstraTaskClass, AstraFeatureSurface>

export function getRoutingPolicyForTask(taskClass: AstraTaskClass): AstraRoutingPolicy {
  return ASTRA_ROUTING_POLICIES[taskClass]
}

export function getDefaultRouteForTask(input: {
  taskClass: AstraTaskClass
  tier?: AstraOperatingTier
  serviceMode?: ServiceMode
  privacyMode?: boolean
  fallbackReason?: AstraFallbackReason
}): AstraInternalRoute {
  if (input.fallbackReason && input.fallbackReason !== "none") {
    return FALLBACK_REASON_ROUTE_POLICY[input.fallbackReason].route
  }
  const policy = getRoutingPolicyForTask(input.taskClass)
  if (input.privacyMode) return policy.privacyModeRoute
  if (input.serviceMode) return policy.servicePreference[input.serviceMode]
  if (input.tier) return policy.tier[input.tier]
  return policy.defaultRoute
}

export function validateRoutingPolicyCoverage(): { ok: boolean; missingTaskClasses: AstraTaskClass[]; missingFallbackReasons: AstraFallbackReason[] } {
  const missingTaskClasses = ASTRA_TASK_CLASSES.filter((taskClass) => {
    const policy = ASTRA_ROUTING_POLICIES[taskClass]
    return !policy?.defaultRoute || policy.fallbackLadder.length === 0
  })
  const missingFallbackReasons = ASTRA_FALLBACK_REASONS.filter((reason) => !FALLBACK_REASON_ROUTE_POLICY[reason])
  return {
    ok: missingTaskClasses.length === 0 && missingFallbackReasons.length === 0,
    missingTaskClasses,
    missingFallbackReasons,
  }
}

export function assertRoutingPolicyCoverage(): void {
  const coverage = validateRoutingPolicyCoverage()
  if (!coverage.ok) {
    throw new Error(`Astra routing policy coverage incomplete: taskClasses=${coverage.missingTaskClasses.join(",")}; fallbackReasons=${coverage.missingFallbackReasons.join(",")}`)
  }
}

export function getCostBucketForTask(taskClass: AstraTaskClass): AstraCostBucket {
  return getRoutingPolicyForTask(taskClass).costBucket
}

export function isHighCostTask(taskClass: AstraTaskClass): boolean {
  const bucket = getCostBucketForTask(taskClass)
  return bucket === "high" || bucket === "long_running"
}

export function getLatencyBucket(durationMs: number | null | undefined): AstraLatencyBucket {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) return "unknown"
  if (durationMs <= 1_500) return "instant"
  if (durationMs <= 5_000) return "fast"
  if (durationMs <= 15_000) return "standard"
  if (durationMs <= 60_000) return "slow"
  return "long_running"
}

export function normalizeOperatingTier(value: string | null | undefined): AstraOperatingTier {
  if (value === "free" || value === "trial" || value === "pro") return value
  return "unknown"
}

export function getTaskClassForTranslationTask(task: TranslationTask | null | undefined): AstraTaskClass {
  if (task === "explain") return "context_explanation"
  if (task === "custom") return "writing_assist"
  return "paragraph_understanding"
}

export function getTaskClassForTranslationRequest(input: {
  task?: TranslationTask | null
  surface?: AstraFeatureSurface | null
  characterCount?: number | null
  maxTextLength?: number | null
}): AstraTaskClass {
  if (input.task === "custom") return "writing_assist"
  if (input.task === "explain") return "context_explanation"
  if (input.surface === "video") return "video_summary"
  if (input.surface === "review") return "review_card"
  if (input.surface === "digest") return "digest"
  if (input.surface === "file" && (input.characterCount ?? 0) >= 6_000) return "deep_reading"
  if (input.surface === "selection" && (input.maxTextLength ?? input.characterCount ?? 0) <= 90) return "instant_phrase"
  if ((input.characterCount ?? 0) >= 12_000) return "deep_reading"
  return "paragraph_understanding"
}

export interface BuildOperatingMetadataInput {
  taskClass: AstraTaskClass
  surface?: AstraFeatureSurface
  tier?: string | null
  durationMs?: number | null
  cacheStatus?: AstraOperatingMetadata["cacheStatus"]
  fallbackReason?: AstraOperatingMetadata["fallbackReason"]
  contentLengthBucket?: AstraOperatingMetadata["contentLengthBucket"]
}

export function buildOperatingMetadata(input: BuildOperatingMetadataInput): AstraOperatingMetadata {
  const fallbackReason = input.fallbackReason ?? "none"
  const fallbackPolicy = FALLBACK_REASON_ROUTE_POLICY[fallbackReason]
  return AstraOperatingMetadataSchema.parse({
    taskClass: input.taskClass,
    surface: input.surface ?? DEFAULT_TASK_SURFACES[input.taskClass],
    tier: normalizeOperatingTier(input.tier),
    costBucket: getCostBucketForTask(input.taskClass),
    latencyBucket: getLatencyBucket(input.durationMs),
    cacheStatus: input.cacheStatus ?? "unknown",
    fallbackReason,
    contentLengthBucket: input.contentLengthBucket ?? "unknown",
    fallbackUsed: fallbackPolicy.fallbackUsed,
  })
}
