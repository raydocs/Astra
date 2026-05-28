import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import { ProviderIdSchema } from "../types/config"
import {
  AstraFeatureSurfaceSchema,
  AstraOperatingTierSchema,
  AstraTaskClassSchema,
} from "../types/operating-model"

import type { RelayEnv } from "./types"

const FeatureFlagStatusSchema = z.enum(["on", "off", "gradual", "kill"])
const FeatureFlagKeySchema = z.enum([
  "ui.onboarding_goal_question",
  "ui.library_home",
  "ai.deep_explanation",
  "ai.card_generation",
  "source.video_learning",
  "source.file_learning",
  "safety.memory_writes",
  "sync.learning_assets",
  "emergency.disable_managed_ai",
  "emergency.disable_long_content",
  "emergency.disable_feature_for_site",
  "emergency.disable_task_class",
  "emergency.force_fast_mode",
  "emergency.disable_provider_route",
  "emergency.limit_free_high_cost",
  "emergency.disable_digest",
  "emergency.disable_share",
  "emergency.privacy_lockdown",
])
const KillSwitchCategorySchema = z.enum(["feature", "site", "task", "tier", "provider", "privacy"])

const RemoteFeatureFlagOverrideSchema = z.object({
  key: FeatureFlagKeySchema,
  status: FeatureFlagStatusSchema.optional(),
  rolloutPercent: z.number().min(0).max(100).optional(),
  reason: z.string().trim().min(1).max(240).optional(),
  changedBy: z.string().trim().min(1).max(80).optional(),
  changedAt: z.string().datetime().optional(),
}).strict()

const RemoteFeatureFlagChangeLogEntrySchema = z.object({
  id: z.string().trim().min(1).max(120),
  changedAt: z.string().datetime(),
  changedBy: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(240),
  overrideCount: z.number().int().nonnegative(),
  killSwitchCount: z.number().int().nonnegative(),
  previousGeneratedAt: z.string().datetime().nullable().default(null),
}).strict()

const RemoteKillSwitchRuleSchema = z.object({
  id: z.string().trim().min(1).max(120),
  category: KillSwitchCategorySchema,
  enabled: z.boolean(),
  reason: z.string().trim().min(1).max(240),
  safeMode: z.boolean().default(true),
  fallbackMessage: z.string().trim().min(1).max(240),
  featureKey: FeatureFlagKeySchema.optional(),
  hostname: z.string().trim().min(1).max(160).optional(),
  taskClass: AstraTaskClassSchema.optional(),
  tier: AstraOperatingTierSchema.optional(),
  providerId: ProviderIdSchema.optional(),
  privacyMode: z.boolean().optional(),
  surface: AstraFeatureSurfaceSchema.optional(),
}).strict()

export const RemoteFeatureFlagRuntimeSchema = z.object({
  schema: z.literal("astra-feature-flag-runtime.v1"),
  generatedAt: z.string().datetime(),
  overrides: z.array(RemoteFeatureFlagOverrideSchema).max(100).default([]),
  killSwitches: z.array(RemoteKillSwitchRuleSchema).max(100).default([]),
  changeLog: z.array(RemoteFeatureFlagChangeLogEntrySchema).max(50).default([]),
}).strict()

export type RemoteFeatureFlagRuntime = z.infer<typeof RemoteFeatureFlagRuntimeSchema>

async function createEmptyFeatureFlagRuntime(): Promise<RemoteFeatureFlagRuntime> {
  return {
    schema: "astra-feature-flag-runtime.v1",
    generatedAt: new Date(0).toISOString(),
    overrides: [],
    killSwitches: [],
    changeLog: [],
  }
}

function buildChangeLogEntry(
  runtime: RemoteFeatureFlagRuntime,
  previous: RemoteFeatureFlagRuntime,
): z.infer<typeof RemoteFeatureFlagChangeLogEntrySchema> {
  const draftChangeLogEntry = runtime.changeLog.find((entry) => entry.id.startsWith("ffdraft_"))
  const firstOverride = runtime.overrides[0]
  const firstEnabledKillSwitch = runtime.killSwitches.find((rule) => rule.enabled)
  return RemoteFeatureFlagChangeLogEntrySchema.parse({
    id: `ffchg_${randomUUID()}`,
    changedAt: runtime.generatedAt,
    changedBy: draftChangeLogEntry?.changedBy ?? firstOverride?.changedBy ?? "operator",
    reason: draftChangeLogEntry?.reason ?? firstOverride?.reason ?? firstEnabledKillSwitch?.reason ?? "Feature-flag runtime updated.",
    overrideCount: runtime.overrides.length,
    killSwitchCount: runtime.killSwitches.length,
    previousGeneratedAt: previous.generatedAt,
  })
}

async function loadAuthoritativeFeatureFlagRuntime(env: RelayEnv): Promise<RemoteFeatureFlagRuntime> {
  try {
    const raw = await readFile(env.featureFlagRuntimePath, "utf8")
    const parsed = RemoteFeatureFlagRuntimeSchema.safeParse(JSON.parse(raw))
    if (parsed.success) {
      return parsed.data
    }
    const empty = await createEmptyFeatureFlagRuntime()
    await saveAuthoritativeFeatureFlagRuntime(env, empty)
    return empty
  } catch {
    const empty = await createEmptyFeatureFlagRuntime()
    await saveAuthoritativeFeatureFlagRuntime(env, empty)
    return empty
  }
}

async function saveAuthoritativeFeatureFlagRuntime(env: RelayEnv, runtime: RemoteFeatureFlagRuntime): Promise<void> {
  await mkdir(dirname(env.featureFlagRuntimePath), { recursive: true })
  await writeFile(env.featureFlagRuntimePath, JSON.stringify(runtime, null, 2))
}

export class FileFeatureFlagRuntimeStore {
  private cache: RemoteFeatureFlagRuntime | null = null

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<RemoteFeatureFlagRuntime> {
    if (this.cache) return this.cache
    const runtime = await loadAuthoritativeFeatureFlagRuntime(this.env)
    this.cache = runtime
    return runtime
  }

  async getRuntime(): Promise<RemoteFeatureFlagRuntime> {
    return this.load()
  }

  async replaceRuntime(input: unknown): Promise<RemoteFeatureFlagRuntime> {
    const inputRecord = typeof input === "object" && input !== null && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {}
    const previous = await this.load()
    const draft = RemoteFeatureFlagRuntimeSchema.parse({
      generatedAt: new Date().toISOString(),
      ...inputRecord,
      schema: "astra-feature-flag-runtime.v1",
    })
    const runtime = RemoteFeatureFlagRuntimeSchema.parse({
      ...draft,
      changeLog: [buildChangeLogEntry(draft, previous), ...previous.changeLog].slice(0, 50),
    })
    this.cache = runtime
    await saveAuthoritativeFeatureFlagRuntime(this.env, runtime)
    return runtime
  }
}
