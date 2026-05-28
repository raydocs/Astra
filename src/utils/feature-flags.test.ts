import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const store: Record<string, unknown> = {}

vi.mock("#imports", () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (patch: Record<string, unknown>) => {
          Object.assign(store, patch)
        }),
      },
    },
  },
}))

import {
  FEATURE_FLAG_AUDIT_STORAGE_KEY,
  FEATURE_FLAG_STORAGE_KEY,
  KillSwitchRuleSchema,
  V0_KILL_SWITCHES,
  decideFeatureFlag,
  decideKillSwitch,
  evaluateFeatureFlag,
  evaluateKillSwitch,
  getFeatureFlag,
  listFeatureFlags,
  readFeatureFlagAuditLog,
  writeFeatureFlagOverride,
  writeRemoteFeatureFlagRuntime,
} from "./feature-flags"

describe("feature flags", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists a registry with emergency kill switches and safe fallback copy", () => {
    const flags = listFeatureFlags()

    expect(flags.some((flag) => flag.key === "emergency.disable_long_content")).toBe(true)
    expect(flags.some((flag) => flag.key === "emergency.privacy_lockdown")).toBe(true)
    expect(flags.some((flag) => flag.key === "emergency.disable_provider_route")).toBe(true)
    expect(flags.some((flag) => flag.key === "safety.memory_writes")).toBe(true)
    expect(flags.every((flag) => flag.fallback.safeMode)).toBe(true)
    expect(flags.every((flag) => flag.audit.reason.length > 0)).toBe(true)
  })

  it("blocks excluded plan/browser/hostname cohorts", () => {
    const videoFlag = getFeatureFlag("source.video_learning")

    expect(evaluateFeatureFlag(videoFlag, {
      plan: "free",
      browser: "chrome",
      hostname: "youtube.com",
    })).toMatchObject({ enabled: false, reason: "plan free excluded" })

    expect(evaluateFeatureFlag(videoFlag, {
      plan: "pro",
      browser: "firefox",
      hostname: "youtube.com",
    })).toMatchObject({ enabled: false, reason: "browser firefox excluded" })

    expect(evaluateFeatureFlag(videoFlag, {
      plan: "pro",
      browser: "chrome",
      hostname: "netflix.com",
    })).toMatchObject({ enabled: false, reason: "hostname excluded" })
  })

  it("defines typed V0 kill-switch categories", () => {
    expect(V0_KILL_SWITCHES.map((rule) => rule.category)).toEqual([
      "feature",
      "site",
      "task",
      "tier",
      "provider",
      "privacy",
    ])
    for (const rule of V0_KILL_SWITCHES) {
      expect(KillSwitchRuleSchema.parse(rule)).toEqual(rule)
      expect(rule.safeMode).toBe(true)
      expect(rule.fallbackMessage).not.toMatch(/provider|model|API key|token|quota|upstream|relay|prompt|rate limit/i)
    }
  })

  it("evaluates kill switches by category and metadata", () => {
    const rules = [
      KillSwitchRuleSchema.parse({
        id: "site-page-off",
        category: "site",
        enabled: true,
        featureKey: "emergency.disable_feature_for_site",
        hostname: "example.com",
        surface: "page",
        reason: "Site incident",
        fallbackMessage: "This feature is temporarily limited on this site.",
      }),
      KillSwitchRuleSchema.parse({
        id: "task-off",
        category: "task",
        enabled: true,
        taskClass: "video_summary",
        reason: "Task incident",
        fallbackMessage: "Astra is temporarily using a simpler mode.",
      }),
    ]

    expect(evaluateKillSwitch({
      featureKey: "emergency.disable_feature_for_site",
      hostname: "www.example.com",
      surface: "page",
    }, rules)).toMatchObject({ active: true, category: "site", safeMode: true })

    expect(evaluateKillSwitch({ taskClass: "video_summary" }, rules)).toMatchObject({
      active: true,
      category: "task",
    })

    expect(evaluateKillSwitch({ hostname: "other.example" }, rules)).toMatchObject({
      active: false,
      reason: "no kill switch matched",
    })
  })

  it("treats kill status as disabled safe mode", () => {
    const decision = evaluateFeatureFlag({
      ...getFeatureFlag("ai.deep_explanation"),
      status: "kill",
    }, { plan: "pro" })

    expect(decision).toMatchObject({
      enabled: false,
      killed: true,
      reason: "kill switch active",
      safeMode: true,
    })
  })

  it("applies remote feature-flag runtime before local overrides and V0 kill switches", async () => {
    await writeFeatureFlagOverride({
      key: "emergency.disable_managed_ai",
      status: "on",
      reason: "local test override",
      changedBy: "local",
      changedAt: "2026-05-27T11:00:00.000Z",
    })
    await writeRemoteFeatureFlagRuntime({
      schema: "astra-feature-flag-runtime.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      overrides: [{
        key: "emergency.disable_managed_ai",
        status: "kill",
        reason: "remote incident",
        changedBy: "ops",
        changedAt: "2026-05-27T12:00:00.000Z",
      }],
      killSwitches: [{
        id: "remote-site-off",
        category: "site",
        enabled: true,
        safeMode: true,
        hostname: "example.com",
        reason: "remote site incident",
        fallbackMessage: "This feature is temporarily limited on this site.",
      }],
      changeLog: [],
    })

    await expect(decideFeatureFlag("emergency.disable_managed_ai", { plan: "pro" }))
      .resolves.toMatchObject({ enabled: false, killed: true })
    await expect(decideKillSwitch({ hostname: "www.example.com" }))
      .resolves.toMatchObject({ active: true, category: "site", reason: "remote site incident" })
  })


  it("persists local overrides and audit events", async () => {
    await writeFeatureFlagOverride({
      key: "ai.deep_explanation",
      status: "kill",
      reason: "provider incident",
      changedBy: "ops",
      changedAt: "2026-05-27T12:00:00.000Z",
    })

    expect(store[FEATURE_FLAG_STORAGE_KEY]).toEqual([
      {
        key: "ai.deep_explanation",
        status: "kill",
        reason: "provider incident",
        changedBy: "ops",
        changedAt: "2026-05-27T12:00:00.000Z",
      },
    ])

    await expect(decideFeatureFlag("ai.deep_explanation", { plan: "pro" }))
      .resolves.toMatchObject({ enabled: false, killed: true })

    const audit = await readFeatureFlagAuditLog()
    expect(audit[0]).toMatchObject({
      key: "ai.deep_explanation",
      previousStatus: "on",
      nextStatus: "kill",
      changedBy: "ops",
      reason: "provider incident",
    })
    expect(store[FEATURE_FLAG_AUDIT_STORAGE_KEY]).toHaveLength(1)
  })
})
