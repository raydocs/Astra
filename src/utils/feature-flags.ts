import { browser } from "#imports"
import { z } from "zod"

import { ProviderIdSchema } from "@/types/config"
import {
  AstraFeatureSurfaceSchema,
  AstraOperatingTierSchema,
  AstraTaskClassSchema,
} from "@/types/operating-model"

export const FeatureFlagStatusSchema = z.enum(["on", "off", "gradual", "kill"])
export type FeatureFlagStatus = z.infer<typeof FeatureFlagStatusSchema>

export const FeatureFlagOwnerSchema = z.enum(["product", "engineering", "ops"])
export type FeatureFlagOwner = z.infer<typeof FeatureFlagOwnerSchema>

export const FeatureFlagKeySchema = z.enum([
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
export type FeatureFlagKey = z.infer<typeof FeatureFlagKeySchema>

export const FeatureFlagPlanSchema = z.enum(["free", "trial", "pro", "expired", "unknown"])
export type FeatureFlagPlan = z.infer<typeof FeatureFlagPlanSchema>

export const FeatureFlagBrowserSchema = z.enum(["chrome", "firefox", "safari", "edge", "unknown"])
export type FeatureFlagBrowser = z.infer<typeof FeatureFlagBrowserSchema>

export const FeatureFlagSchema = z.object({
  key: FeatureFlagKeySchema,
  description: z.string(),
  owner: FeatureFlagOwnerSchema,
  status: FeatureFlagStatusSchema,
  rollout: z.object({
    percent: z.number().min(0).max(100).default(100),
    plans: z.array(FeatureFlagPlanSchema).default(["free", "trial", "pro", "expired", "unknown"]),
    locales: z.array(z.string()).default([]),
    browser: z.array(FeatureFlagBrowserSchema).default([]),
    hostnames: z.array(z.string()).default([]),
  }),
  fallback: z.object({
    userMessageKey: z.string(),
    safeMode: z.boolean(),
  }),
  audit: z.object({
    changedBy: z.string(),
    changedAt: z.string(),
    reason: z.string(),
  }),
})
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>

export const FeatureFlagOverrideSchema = z.object({
  key: FeatureFlagKeySchema,
  status: FeatureFlagStatusSchema.optional(),
  rolloutPercent: z.number().min(0).max(100).optional(),
  reason: z.string().optional(),
  changedBy: z.string().optional(),
  changedAt: z.string().optional(),
})
export type FeatureFlagOverride = z.infer<typeof FeatureFlagOverrideSchema>

export const FeatureFlagAuditEventSchema = z.object({
  key: FeatureFlagKeySchema,
  previousStatus: FeatureFlagStatusSchema,
  nextStatus: FeatureFlagStatusSchema,
  changedBy: z.string(),
  changedAt: z.string(),
  reason: z.string(),
})
export type FeatureFlagAuditEvent = z.infer<typeof FeatureFlagAuditEventSchema>

export const KillSwitchCategorySchema = z.enum(["feature", "site", "task", "tier", "provider", "privacy"])
export type KillSwitchCategory = z.infer<typeof KillSwitchCategorySchema>

export const KillSwitchRuleSchema = z.object({
  id: z.string().trim().min(1),
  category: KillSwitchCategorySchema,
  enabled: z.boolean(),
  reason: z.string().trim().min(1),
  safeMode: z.boolean().default(true),
  fallbackMessage: z.string().trim().min(1),
  featureKey: FeatureFlagKeySchema.optional(),
  hostname: z.string().trim().min(1).optional(),
  taskClass: AstraTaskClassSchema.optional(),
  tier: AstraOperatingTierSchema.optional(),
  providerId: ProviderIdSchema.optional(),
  privacyMode: z.boolean().optional(),
  surface: AstraFeatureSurfaceSchema.optional(),
}).strict()
export type KillSwitchRule = z.infer<typeof KillSwitchRuleSchema>

export interface KillSwitchContext {
  featureKey?: FeatureFlagKey | null
  hostname?: string | null
  taskClass?: z.infer<typeof AstraTaskClassSchema> | null
  tier?: z.infer<typeof AstraOperatingTierSchema> | null
  providerId?: z.infer<typeof ProviderIdSchema> | null
  privacyMode?: boolean | null
  surface?: z.infer<typeof AstraFeatureSurfaceSchema> | null
}

export interface KillSwitchDecision {
  active: boolean
  rule: KillSwitchRule | null
  category: KillSwitchCategory | null
  reason: string
  fallbackMessage: string | null
  safeMode: boolean
}

export interface FeatureFlagContext {
  userId?: string | null
  plan?: FeatureFlagPlan
  locale?: string | null
  browser?: FeatureFlagBrowser
  hostname?: string | null
}

export interface FeatureFlagDecision {
  key: FeatureFlagKey
  enabled: boolean
  killed: boolean
  reason: string
  fallbackMessage: string
  safeMode: boolean
}

export const FEATURE_FLAG_STORAGE_KEY = "astra.feature_flags.overrides.v1"
export const REMOTE_FEATURE_FLAG_RUNTIME_STORAGE_KEY = "astra.feature_flags.remote_runtime.v1"
export const FEATURE_FLAG_AUDIT_STORAGE_KEY = "astra.feature_flags.audit.v1"
const MAX_AUDIT_EVENTS = 100

export const RemoteFeatureFlagChangeLogEntrySchema = z.object({
  id: z.string().trim().min(1),
  changedAt: z.string().datetime(),
  changedBy: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  overrideCount: z.number().int().nonnegative(),
  killSwitchCount: z.number().int().nonnegative(),
  previousGeneratedAt: z.string().datetime().nullable().default(null),
}).strict()
export type RemoteFeatureFlagChangeLogEntry = z.infer<typeof RemoteFeatureFlagChangeLogEntrySchema>

export const RemoteFeatureFlagRuntimeSchema = z.object({
  schema: z.literal("astra-feature-flag-runtime.v1"),
  generatedAt: z.string().datetime(),
  overrides: z.array(FeatureFlagOverrideSchema).max(100).default([]),
  killSwitches: z.array(KillSwitchRuleSchema).max(100).default([]),
  changeLog: z.array(RemoteFeatureFlagChangeLogEntrySchema).max(50).default([]),
}).strict()
export type RemoteFeatureFlagRuntime = z.infer<typeof RemoteFeatureFlagRuntimeSchema>

const DEFAULT_CHANGED_AT = "2026-05-27T00:00:00.000Z"

export const FEATURE_FLAGS: Record<FeatureFlagKey, FeatureFlag> = {
  "ui.onboarding_goal_question": {
    key: "ui.onboarding_goal_question",
    description: "Show the P0 persona/JTBD goal question in onboarding.",
    owner: "product",
    status: "on",
    rollout: { percent: 100, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra will use a default reading goal for now.", safeMode: true },
    audit: { changedBy: "product", changedAt: DEFAULT_CHANGED_AT, reason: "Macro product upgrade M1 activation." },
  },
  "ui.library_home": {
    key: "ui.library_home",
    description: "Enable the Learning Library home/dashboard surface.",
    owner: "product",
    status: "gradual",
    rollout: { percent: 50, plans: ["free", "trial", "pro", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Library is using the classic vocabulary and reading queue for now.", safeMode: true },
    audit: { changedBy: "product", changedAt: DEFAULT_CHANGED_AT, reason: "Gradual rollout while Library home matures." },
  },
  "ai.deep_explanation": {
    key: "ai.deep_explanation",
    description: "Allow deeper AI explanations for selected sentences and Deep Read.",
    owner: "engineering",
    status: "on",
    rollout: { percent: 100, plans: ["free", "trial", "pro", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra is temporarily using a simpler explanation mode.", safeMode: true },
    audit: { changedBy: "engineering", changedAt: DEFAULT_CHANGED_AT, reason: "P0 understanding layer." },
  },
  "ai.card_generation": {
    key: "ai.card_generation",
    description: "Generate reviewable cards from saved snippets.",
    owner: "engineering",
    status: "on",
    rollout: { percent: 100, plans: ["free", "trial", "pro", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Saved items are kept as snippets until cards are available again.", safeMode: true },
    audit: { changedBy: "engineering", changedAt: DEFAULT_CHANGED_AT, reason: "Learning loop productization." },
  },
  "source.video_learning": {
    key: "source.video_learning",
    description: "Enable supported video learning surfaces.",
    owner: "engineering",
    status: "gradual",
    rollout: { percent: 50, plans: ["trial", "pro", "unknown"], locales: [], browser: ["chrome", "edge"], hostnames: ["youtube.com", "youtu.be", "bilibili.com"] },
    fallback: { userMessageKey: "Video learning is limited on this site for now.", safeMode: true },
    audit: { changedBy: "product", changedAt: DEFAULT_CHANGED_AT, reason: "Beta video support boundary." },
  },
  "source.file_learning": {
    key: "source.file_learning",
    description: "Enable file learning surfaces for PDF/EPUB/subtitle-file.",
    owner: "engineering",
    status: "gradual",
    rollout: { percent: 75, plans: ["free", "trial", "pro", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "File learning is temporarily unavailable.", safeMode: true },
    audit: { changedBy: "product", changedAt: DEFAULT_CHANGED_AT, reason: "File surfaces remain beta." },
  },
  "safety.memory_writes": {
    key: "safety.memory_writes",
    description: "Allow AI-assisted long-term glossary/preference writes after user confirmation.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra will ask before remembering long-term preferences.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Default deny until preference-confirmation flow is complete." },
  },
  "sync.learning_assets": {
    key: "sync.learning_assets",
    description: "Enable cloud sync for learning assets beyond local storage.",
    owner: "engineering",
    status: "gradual",
    rollout: { percent: 25, plans: ["trial", "pro"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Your local learning data is safe; sync is temporarily paused.", safeMode: true },
    audit: { changedBy: "engineering", changedAt: DEFAULT_CHANGED_AT, reason: "Cautious rollout for learning asset sync." },
  },
  "emergency.disable_managed_ai": {
    key: "emergency.disable_managed_ai",
    description: "Emergency kill switch for managed AI calls.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra is temporarily using a simpler mode.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Emergency switch default off." },
  },
  "emergency.disable_long_content": {
    key: "emergency.disable_long_content",
    description: "Emergency kill switch for long content analysis.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Long content analysis is temporarily limited.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Cost/risk switch default off." },
  },
  "emergency.disable_feature_for_site": {
    key: "emergency.disable_feature_for_site",
    description: "Emergency site-specific feature shutdown.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "This feature is temporarily limited on this site.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Site safety switch default off." },
  },
  "emergency.disable_task_class": {
    key: "emergency.disable_task_class",
    description: "Emergency task-class shutdown.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra is temporarily using a simpler mode.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Task safety switch default off." },
  },
  "emergency.force_fast_mode": {
    key: "emergency.force_fast_mode",
    description: "Emergency force faster processing path.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra is temporarily using a faster mode.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Speed safety switch default off." },
  },
  "emergency.disable_provider_route": {
    key: "emergency.disable_provider_route",
    description: "Emergency internal route shutdown.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Astra switched to a more stable mode.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Internal route switch default off." },
  },
  "emergency.limit_free_high_cost": {
    key: "emergency.limit_free_high_cost",
    description: "Emergency Free-tier long-content limiter.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "You can continue tomorrow, or upgrade for longer reading.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Free cost safety switch default off." },
  },
  "emergency.disable_digest": {
    key: "emergency.disable_digest",
    description: "Emergency digest shutdown.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Learning summaries are temporarily paused.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Digest safety switch default off." },
  },
  "emergency.disable_share": {
    key: "emergency.disable_share",
    description: "Emergency sharing shutdown.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Sharing is temporarily unavailable.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Sharing safety switch default off." },
  },
  "emergency.privacy_lockdown": {
    key: "emergency.privacy_lockdown",
    description: "Emergency privacy lockdown for non-essential processing.",
    owner: "ops",
    status: "off",
    rollout: { percent: 0, plans: ["free", "trial", "pro", "expired", "unknown"], locales: [], browser: [], hostnames: [] },
    fallback: { userMessageKey: "Privacy Mode is using the safest settings.", safeMode: true },
    audit: { changedBy: "ops", changedAt: DEFAULT_CHANGED_AT, reason: "Privacy safety switch default off." },
  },
}

export const V0_KILL_SWITCHES: KillSwitchRule[] = [
  {
    id: "v0-global-feature-shutdown",
    category: "feature",
    enabled: false,
    reason: "Disable a feature globally during incidents.",
    fallbackMessage: "This feature is temporarily unavailable.",
    safeMode: true,
  },
  {
    id: "v0-feature-site-shutdown",
    category: "site",
    enabled: false,
    reason: "Disable a feature for a problematic site.",
    fallbackMessage: "This feature is temporarily limited on this site.",
    safeMode: true,
  },
  {
    id: "v0-task-class-shutdown",
    category: "task",
    enabled: false,
    reason: "Pause a task class during incidents.",
    fallbackMessage: "Astra is temporarily using a simpler mode.",
    safeMode: true,
  },
  {
    id: "v0-tier-high-cost-limit",
    category: "tier",
    enabled: false,
    tier: "free",
    reason: "Limit expensive Free-tier work during cost spikes.",
    fallbackMessage: "You can continue tomorrow, or upgrade for longer reading.",
    safeMode: true,
  },
  {
    id: "v0-internal-route-shutdown",
    category: "provider",
    enabled: false,
    reason: "Pause an internal route during instability.",
    fallbackMessage: "Astra switched to a more stable mode.",
    safeMode: true,
  },
  {
    id: "v0-privacy-lockdown",
    category: "privacy",
    enabled: false,
    privacyMode: true,
    reason: "Force safest behavior for privacy incidents.",
    fallbackMessage: "Privacy Mode is using the safest settings.",
    safeMode: true,
  },
].map((rule) => KillSwitchRuleSchema.parse(rule))

function stableBucket(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % 100
}

function hostnameMatches(flagHostnames: string[], hostname: string | null | undefined): boolean {
  if (flagHostnames.length === 0) return true
  const normalized = hostname?.toLowerCase().replace(/^www\./, "")
  if (!normalized) return false
  return flagHostnames.some((flagHost) => {
    const host = flagHost.toLowerCase().replace(/^www\./, "")
    return normalized === host || normalized.endsWith(`.${host}`)
  })
}

function killSwitchMatches(rule: KillSwitchRule, context: KillSwitchContext): boolean {
  if (!rule.enabled) return false
  if (rule.featureKey && rule.featureKey !== context.featureKey) return false
  if (rule.hostname && !hostnameMatches([rule.hostname], context.hostname)) return false
  if (rule.taskClass && rule.taskClass !== context.taskClass) return false
  if (rule.tier && rule.tier !== context.tier) return false
  if (rule.providerId && rule.providerId !== context.providerId) return false
  if (rule.privacyMode != null && rule.privacyMode !== context.privacyMode) return false
  if (rule.surface && rule.surface !== context.surface) return false
  return true
}

export function evaluateKillSwitch(
  context: KillSwitchContext,
  rules: readonly KillSwitchRule[] = V0_KILL_SWITCHES,
): KillSwitchDecision {
  const activeRule = rules.find((rule) => killSwitchMatches(rule, context)) ?? null
  if (!activeRule) {
    return {
      active: false,
      rule: null,
      category: null,
      reason: "no kill switch matched",
      fallbackMessage: null,
      safeMode: false,
    }
  }

  return {
    active: true,
    rule: activeRule,
    category: activeRule.category,
    reason: activeRule.reason,
    fallbackMessage: activeRule.fallbackMessage,
    safeMode: activeRule.safeMode,
  }
}

function applyOverride(flag: FeatureFlag, override?: FeatureFlagOverride | null): FeatureFlag {
  if (!override) return flag
  return FeatureFlagSchema.parse({
    ...flag,
    status: override.status ?? flag.status,
    rollout: {
      ...flag.rollout,
      percent: override.rolloutPercent ?? flag.rollout.percent,
    },
    audit: {
      changedBy: override.changedBy ?? flag.audit.changedBy,
      changedAt: override.changedAt ?? flag.audit.changedAt,
      reason: override.reason ?? flag.audit.reason,
    },
  })
}

export function evaluateFeatureFlag(
  flag: FeatureFlag,
  context: FeatureFlagContext = {},
): FeatureFlagDecision {
  if (flag.status === "kill") {
    return {
      key: flag.key,
      enabled: false,
      killed: true,
      reason: "kill switch active",
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  if (flag.status === "off") {
    return {
      key: flag.key,
      enabled: false,
      killed: false,
      reason: "flag off",
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  const plan = context.plan ?? "unknown"
  if (flag.rollout.plans.length > 0 && !flag.rollout.plans.includes(plan)) {
    return {
      key: flag.key,
      enabled: false,
      killed: false,
      reason: `plan ${plan} excluded`,
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  const locale = context.locale?.trim()
  if (flag.rollout.locales.length > 0 && (!locale || !flag.rollout.locales.includes(locale))) {
    return {
      key: flag.key,
      enabled: false,
      killed: false,
      reason: `locale ${locale ?? "unknown"} excluded`,
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  const browserName = context.browser ?? "unknown"
  if (flag.rollout.browser.length > 0 && !flag.rollout.browser.includes(browserName)) {
    return {
      key: flag.key,
      enabled: false,
      killed: false,
      reason: `browser ${browserName} excluded`,
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  if (!hostnameMatches(flag.rollout.hostnames, context.hostname)) {
    return {
      key: flag.key,
      enabled: false,
      killed: false,
      reason: "hostname excluded",
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  if (flag.status === "on") {
    return {
      key: flag.key,
      enabled: true,
      killed: false,
      reason: "flag on",
      fallbackMessage: flag.fallback.userMessageKey,
      safeMode: flag.fallback.safeMode,
    }
  }

  const bucketKey = context.userId ?? `${context.browser ?? "unknown"}:${context.locale ?? "unknown"}:${flag.key}`
  const bucket = stableBucket(`${flag.key}:${bucketKey}`)
  const enabled = bucket < flag.rollout.percent
  return {
    key: flag.key,
    enabled,
    killed: false,
    reason: enabled ? `gradual rollout bucket ${bucket}` : `outside gradual rollout bucket ${bucket}`,
    fallbackMessage: flag.fallback.userMessageKey,
    safeMode: flag.fallback.safeMode,
  }
}

export function getFeatureFlag(
  key: FeatureFlagKey,
  overrides: FeatureFlagOverride[] = [],
): FeatureFlag {
  const flag = FEATURE_FLAGS[key]
  const override = overrides.find((entry) => entry.key === key)
  return applyOverride(flag, override)
}

export function listFeatureFlags(overrides: FeatureFlagOverride[] = []): FeatureFlag[] {
  return FeatureFlagKeySchema.options.map((key) => getFeatureFlag(key, overrides))
}

export async function readFeatureFlagOverrides(): Promise<FeatureFlagOverride[]> {
  const result = await browser.storage.local.get(FEATURE_FLAG_STORAGE_KEY)
  const raw = result[FEATURE_FLAG_STORAGE_KEY]
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const parsed = FeatureFlagOverrideSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export async function readRemoteFeatureFlagRuntime(): Promise<RemoteFeatureFlagRuntime | null> {
  const result = await browser.storage.local.get(REMOTE_FEATURE_FLAG_RUNTIME_STORAGE_KEY)
  const parsed = RemoteFeatureFlagRuntimeSchema.safeParse(result[REMOTE_FEATURE_FLAG_RUNTIME_STORAGE_KEY])
  return parsed.success ? parsed.data : null
}

export async function writeRemoteFeatureFlagRuntime(runtime: RemoteFeatureFlagRuntime): Promise<RemoteFeatureFlagRuntime> {
  const parsed = RemoteFeatureFlagRuntimeSchema.parse(runtime)
  await browser.storage.local.set({ [REMOTE_FEATURE_FLAG_RUNTIME_STORAGE_KEY]: parsed })
  return parsed
}

function requireFeatureFlagBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) throw new Error("Astra API base URL is required.")
  return trimmed.replace(/\/+$/, "")
}

export async function refreshRemoteFeatureFlagRuntime(baseURL: string): Promise<RemoteFeatureFlagRuntime> {
  const response = await fetch(`${requireFeatureFlagBaseURL(baseURL)}/ops/feature-flags`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Astra feature-flag runtime request failed with status ${response.status}.`)
  }
  return writeRemoteFeatureFlagRuntime(RemoteFeatureFlagRuntimeSchema.parse(await response.json()))
}

export async function readEffectiveFeatureFlagOverrides(): Promise<FeatureFlagOverride[]> {
  const [remote, local] = await Promise.all([
    readRemoteFeatureFlagRuntime(),
    readFeatureFlagOverrides(),
  ])
  return [...(remote?.overrides ?? []), ...local]
}

export async function readEffectiveKillSwitchRules(): Promise<KillSwitchRule[]> {
  const remote = await readRemoteFeatureFlagRuntime()
  return [...(remote?.killSwitches ?? []), ...V0_KILL_SWITCHES]
}

export async function writeFeatureFlagOverride(override: FeatureFlagOverride): Promise<FeatureFlag> {
  const parsed = FeatureFlagOverrideSchema.parse({
    ...override,
    changedAt: override.changedAt ?? new Date().toISOString(),
  })
  const existing = await readFeatureFlagOverrides()
  const previous = getFeatureFlag(parsed.key, existing)
  const nextOverrides = [parsed, ...existing.filter((entry) => entry.key !== parsed.key)]
  await browser.storage.local.set({ [FEATURE_FLAG_STORAGE_KEY]: nextOverrides })
  const next = getFeatureFlag(parsed.key, nextOverrides)
  await appendFeatureFlagAuditEvent({
    key: parsed.key,
    previousStatus: previous.status,
    nextStatus: next.status,
    changedBy: parsed.changedBy ?? "local",
    changedAt: parsed.changedAt ?? new Date().toISOString(),
    reason: parsed.reason ?? "local override",
  })
  return next
}

export async function appendFeatureFlagAuditEvent(event: FeatureFlagAuditEvent): Promise<void> {
  const parsed = FeatureFlagAuditEventSchema.parse(event)
  const result = await browser.storage.local.get(FEATURE_FLAG_AUDIT_STORAGE_KEY)
  const raw = result[FEATURE_FLAG_AUDIT_STORAGE_KEY]
  const existing = Array.isArray(raw)
    ? raw.flatMap((item) => {
        const itemParsed = FeatureFlagAuditEventSchema.safeParse(item)
        return itemParsed.success ? [itemParsed.data] : []
      })
    : []
  await browser.storage.local.set({
    [FEATURE_FLAG_AUDIT_STORAGE_KEY]: [parsed, ...existing].slice(0, MAX_AUDIT_EVENTS),
  })
}

export async function readFeatureFlagAuditLog(): Promise<FeatureFlagAuditEvent[]> {
  const result = await browser.storage.local.get(FEATURE_FLAG_AUDIT_STORAGE_KEY)
  const raw = result[FEATURE_FLAG_AUDIT_STORAGE_KEY]
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const parsed = FeatureFlagAuditEventSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export async function decideFeatureFlag(
  key: FeatureFlagKey,
  context: FeatureFlagContext = {},
): Promise<FeatureFlagDecision> {
  const overrides = await readEffectiveFeatureFlagOverrides()
  return evaluateFeatureFlag(getFeatureFlag(key, overrides), context)
}

export async function decideKillSwitch(context: KillSwitchContext): Promise<KillSwitchDecision> {
  return evaluateKillSwitch(context, await readEffectiveKillSwitchRules())
}
