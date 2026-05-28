import { z } from "zod"

export const AstraTaskClassSchema = z.enum([
  "instant_phrase",
  "paragraph_understanding",
  "context_explanation",
  "deep_reading",
  "video_summary",
  "review_card",
  "writing_assist",
  "digest",
])
export type AstraTaskClass = z.infer<typeof AstraTaskClassSchema>

export const AstraCostBucketSchema = z.enum(["low", "medium", "high", "long_running"])
export type AstraCostBucket = z.infer<typeof AstraCostBucketSchema>

export const AstraLatencyBucketSchema = z.enum(["unknown", "instant", "fast", "standard", "slow", "long_running"])
export type AstraLatencyBucket = z.infer<typeof AstraLatencyBucketSchema>

export const AstraCacheStatusSchema = z.enum(["unknown", "disabled", "miss", "partial", "hit"])
export type AstraCacheStatus = z.infer<typeof AstraCacheStatusSchema>

export const AstraFallbackReasonSchema = z.enum(["none", "timeout", "outage", "cost", "length", "quality", "unknown"])
export type AstraFallbackReason = z.infer<typeof AstraFallbackReasonSchema>

export const AstraInternalRouteSchema = z.enum([
  "cache_first",
  "fast_path",
  "balanced_path",
  "quality_path",
  "long_context_path",
  "batch_background_path",
  "template_path",
  "partial_result_path",
  "user_action_path",
])
export type AstraInternalRoute = z.infer<typeof AstraInternalRouteSchema>

export const AstraOperatingTierSchema = z.enum(["free", "trial", "pro", "unknown"])
export type AstraOperatingTier = z.infer<typeof AstraOperatingTierSchema>

export const AstraFeatureSurfaceSchema = z.enum([
  "page",
  "selection",
  "video",
  "file",
  "review",
  "library",
  "account",
  "onboarding",
  "settings",
  "writing",
  "digest",
])
export type AstraFeatureSurface = z.infer<typeof AstraFeatureSurfaceSchema>

export const AstraContentLengthBucketSchema = z.enum(["unknown", "short", "medium", "long", "very_long"])
export type AstraContentLengthBucket = z.infer<typeof AstraContentLengthBucketSchema>

export const AstraOperatingMetadataSchema = z.object({
  schema: z.literal("astra-operating-metadata.v1").default("astra-operating-metadata.v1"),
  taskClass: AstraTaskClassSchema,
  surface: AstraFeatureSurfaceSchema,
  tier: AstraOperatingTierSchema.default("unknown"),
  costBucket: AstraCostBucketSchema,
  latencyBucket: AstraLatencyBucketSchema.default("unknown"),
  cacheStatus: AstraCacheStatusSchema.default("unknown"),
  fallbackReason: AstraFallbackReasonSchema.default("none"),
  contentLengthBucket: AstraContentLengthBucketSchema.default("unknown"),
  fallbackUsed: z.boolean().default(false),
}).strict()
export type AstraOperatingMetadata = z.infer<typeof AstraOperatingMetadataSchema>
