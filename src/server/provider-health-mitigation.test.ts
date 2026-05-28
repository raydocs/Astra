import { describe, expect, it } from "vitest"

import { recommendProviderHealthMitigation } from "./provider-health-mitigation"
import type { ProviderHealthSummary } from "./types"

const baseSummary = (bucketOverrides: Partial<ProviderHealthSummary["buckets"][number]> = {}): ProviderHealthSummary => ({
  schema: "astra-provider-health-summary.v1",
  generatedAt: "2026-05-28T00:00:00.000Z",
  source: "recent_user_usage_events",
  recentEventsPerUserLimit: 10,
  totalEvents: 4,
  totalRequests: 4,
  totalCharacters: 40,
  buckets: [{
    provider: "openai",
    model: "gpt-4.1-mini",
    serviceMode: "balanced",
    taskClass: "paragraph_understanding",
    eventCount: 4,
    requestCount: 4,
    characterCount: 40,
    successCount: 4,
    failureCount: 0,
    fallbackCount: 0,
    successRate: 1,
    fallbackRate: 0,
    latencySampleCount: 4,
    latencyP50Ms: 120,
    latencyP95Ms: 180,
    healthStatus: "healthy",
    ...bucketOverrides,
  }],
})

describe("provider health mitigation", () => {
  it("does not change healthy provider routing", () => {
    const recommendation = recommendProviderHealthMitigation({
      summary: baseSummary(),
      scheduledPayload: {
        provider: "openai",
        model: "gpt-4.1-mini",
        serviceMode: "balanced",
        texts: ["hello"],
        targetLang: "zh-CN",
      },
      entitlements: ["openai", "gemini"],
      taskClass: "paragraph_understanding",
    })

    expect(recommendation).toMatchObject({
      action: "none",
      fallbackReason: "none",
      provider: "openai",
      model: "gpt-4.1-mini",
      serviceMode: "balanced",
    })
  })

  it("reroutes providerless incident traffic to a fast healthy entitled provider", () => {
    const recommendation = recommendProviderHealthMitigation({
      summary: baseSummary({
        healthStatus: "incident",
        successCount: 1,
        failureCount: 3,
        successRate: 0.25,
      }),
      scheduledPayload: {
        provider: "openai",
        model: "gpt-4.1-mini",
        serviceMode: "balanced",
        texts: ["hello"],
        targetLang: "zh-CN",
      },
      entitlements: ["openai", "gemini"],
      taskClass: "paragraph_understanding",
    })

    expect(recommendation).toMatchObject({
      action: "reroute_healthy_provider",
      fallbackReason: "outage",
      healthStatus: "incident",
      provider: "gemini",
      model: "gemini-3.1-flash-lite-preview",
      serviceMode: "fast",
      avoidProviders: ["openai"],
    })
  })

  it("keeps explicit degraded provider requests on the provider but forces fast stable mode", () => {
    const recommendation = recommendProviderHealthMitigation({
      summary: baseSummary({ healthStatus: "watch", failureCount: 1, successCount: 3, successRate: 0.75 }),
      scheduledPayload: {
        provider: "openai",
        model: "gpt-4.1-mini",
        serviceMode: "balanced",
        texts: ["hello"],
        targetLang: "zh-CN",
      },
      entitlements: ["openai", "gemini"],
      taskClass: "paragraph_understanding",
      requestedProvider: "openai",
    })

    expect(recommendation).toMatchObject({
      action: "force_fast_mode",
      fallbackReason: "outage",
      healthStatus: "watch",
      provider: "openai",
      model: "gpt-4.1-nano",
      serviceMode: "fast",
    })
  })
})
