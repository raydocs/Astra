import { describe, expect, it } from "vitest"

import { ServiceModeSchema } from "../types/config"
import { AstraFallbackReasonSchema, AstraOperatingMetadataSchema, AstraTaskClassSchema } from "../types/operating-model"
import {
  ASTRA_FALLBACK_REASONS,
  ASTRA_ROUTING_POLICIES,
  ASTRA_TASK_CLASSES,
  FALLBACK_REASON_ROUTE_POLICY,
  assertRoutingPolicyCoverage,
  buildOperatingMetadata,
  getCostBucketForTask,
  getDefaultRouteForTask,
  getLatencyBucket,
  getTaskClassForTranslationTask,
  isHighCostTask,
  normalizeOperatingTier,
  validateRoutingPolicyCoverage,
} from "./operating-model"

describe("operating model helpers", () => {
  it("covers every canonical task class with an explicit internal policy/default route/fallback ladder", () => {
    expect(ASTRA_TASK_CLASSES).toEqual(AstraTaskClassSchema.options)
    expect(Object.keys(ASTRA_ROUTING_POLICIES).sort()).toEqual([...AstraTaskClassSchema.options].sort())

    for (const taskClass of AstraTaskClassSchema.options) {
      const policy = ASTRA_ROUTING_POLICIES[taskClass]
      expect(policy.taskClass).toBe(taskClass)
      expect(policy.defaultRoute).toBeTruthy()
      expect(policy.surface).toBeTruthy()
      expect(policy.costBucket).toBeTruthy()
      expect(policy.fallbackLadder.map((step) => step.reason)).toEqual(["timeout", "outage", "cost", "length", "quality", "unknown"])
      expect(Object.keys(policy.servicePreference).sort()).toEqual([...ServiceModeSchema.options].sort())
      expect(Object.keys(policy.tier).sort()).toEqual(["free", "pro", "trial", "unknown"].sort())
      expect(JSON.stringify(policy)).not.toMatch(/openai|gemini|google_translate|openrouter|gpt|model|provider/i)
    }

    expect(validateRoutingPolicyCoverage()).toEqual({ ok: true, missingTaskClasses: [], missingFallbackReasons: [] })
    expect(() => assertRoutingPolicyCoverage()).not.toThrow()
  })

  it("covers the complete fallback reason taxonomy with unknown as an explicit fallback", () => {
    expect(ASTRA_FALLBACK_REASONS).toEqual(AstraFallbackReasonSchema.options)
    expect(Object.keys(FALLBACK_REASON_ROUTE_POLICY).sort()).toEqual([...AstraFallbackReasonSchema.options].sort())
    expect(FALLBACK_REASON_ROUTE_POLICY.none).toMatchObject({ fallbackUsed: false })
    expect(FALLBACK_REASON_ROUTE_POLICY.unknown).toMatchObject({ fallbackUsed: true, route: "user_action_path" })
  })

  it("resolves routes from privacy mode, service preference, tier, and fallback reason without provider details", () => {
    expect(getDefaultRouteForTask({ taskClass: "deep_reading", serviceMode: "fast" })).toBe("partial_result_path")
    expect(getDefaultRouteForTask({ taskClass: "paragraph_understanding", tier: "free" })).toBe("fast_path")
    expect(getDefaultRouteForTask({ taskClass: "context_explanation", privacyMode: true })).toBe("balanced_path")
    expect(getDefaultRouteForTask({ taskClass: "paragraph_understanding", fallbackReason: "unknown" })).toBe("user_action_path")
  })

  it("maps task classes to cost buckets", () => {
    expect(getCostBucketForTask("instant_phrase")).toBe("low")
    expect(getCostBucketForTask("paragraph_understanding")).toBe("medium")
    expect(getCostBucketForTask("deep_reading")).toBe("high")
    expect(isHighCostTask("video_summary")).toBe(true)
    expect(isHighCostTask("review_card")).toBe(false)
  })

  it("buckets latency without storing content", () => {
    expect(getLatencyBucket(500)).toBe("instant")
    expect(getLatencyBucket(3_000)).toBe("fast")
    expect(getLatencyBucket(10_000)).toBe("standard")
    expect(getLatencyBucket(30_000)).toBe("slow")
    expect(getLatencyBucket(90_000)).toBe("long_running")
    expect(getLatencyBucket(null)).toBe("unknown")
  })

  it("normalizes tiers", () => {
    expect(normalizeOperatingTier("free")).toBe("free")
    expect(normalizeOperatingTier("trial")).toBe("trial")
    expect(normalizeOperatingTier("pro")).toBe("pro")
    expect(normalizeOperatingTier("expired")).toBe("unknown")
  })

  it("maps translation tasks to operating task classes", () => {
    expect(getTaskClassForTranslationTask("translate")).toBe("paragraph_understanding")
    expect(getTaskClassForTranslationTask("explain")).toBe("context_explanation")
    expect(getTaskClassForTranslationTask("custom")).toBe("writing_assist")
  })

  it("builds strict metadata-only records", () => {
    const metadata = buildOperatingMetadata({
      taskClass: "context_explanation",
      tier: "trial",
      durationMs: 4_000,
      cacheStatus: "hit",
      fallbackReason: "timeout",
      contentLengthBucket: "medium",
    })

    expect(metadata).toEqual({
      schema: "astra-operating-metadata.v1",
      taskClass: "context_explanation",
      surface: "selection",
      tier: "trial",
      costBucket: "medium",
      latencyBucket: "fast",
      cacheStatus: "hit",
      fallbackReason: "timeout",
      contentLengthBucket: "medium",
      fallbackUsed: true,
    })
  })

  it("rejects raw content-shaped metadata fields", () => {
    expect(() =>
      AstraOperatingMetadataSchema.parse({
        taskClass: "instant_phrase",
        surface: "selection",
        costBucket: "low",
        rawText: "hello",
      }),
    ).toThrow()
  })
})
