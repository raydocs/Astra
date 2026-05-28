import { browser } from "#imports"
import { z } from "zod"

import { ExplainModeSchema, LanguageLevelSchema, type AstraConfig } from "@/types/config"

export const LEARNING_PROFILE_STORAGE_KEY = "astra.learning_profile.v1"
export const LEGACY_ONBOARDING_PRIMARY_GOAL_STORAGE_KEY = "astra.onboarding.primaryGoal.v1"

export const LearningProfileGoalSchema = z.enum([
  "read_articles_docs",
  "watch_tutorials",
  "save_expressions",
  "work_study",
  "exam_prep",
  "interest_reading",
  "build_vocabulary",
])
export type LearningProfileGoal = z.infer<typeof LearningProfileGoalSchema>

export const LearningProfileRememberedTermSourceSchema = z.enum([
  "saved_term",
  "user_correction",
  "import",
])
export type LearningProfileRememberedTermSource = z.infer<typeof LearningProfileRememberedTermSourceSchema>

export const LearningProfileRememberedTermSchema = z.object({
  id: z.string().trim().min(1),
  sourceTerm: z.string().trim().min(1).max(120),
  preferredTerm: z.string().trim().min(1).max(120),
  source: LearningProfileRememberedTermSourceSchema.default("saved_term"),
  hostname: z.string().trim().min(1).max(160).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict()
export type LearningProfileRememberedTerm = z.infer<typeof LearningProfileRememberedTermSchema>

export const LearningProfileSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  languageLevel: LanguageLevelSchema.default("intermediate"),
  explainMode: ExplainModeSchema.default("deep"),
  primaryGoal: LearningProfileGoalSchema.default("read_articles_docs"),
  dailyGoalMinutes: z.number().int().min(1).max(60).default(5),
  personalizationEnabled: z.boolean().default(true),
  excludedHostnames: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  rememberedTerms: z.array(LearningProfileRememberedTermSchema).max(200).default([]),
  updatedAt: z.string().datetime(),
}).strict()
export type LearningProfile = z.infer<typeof LearningProfileSchema>

export const LearningProfilePatchSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  languageLevel: LanguageLevelSchema.optional(),
  explainMode: ExplainModeSchema.optional(),
  primaryGoal: LearningProfileGoalSchema.optional(),
  dailyGoalMinutes: z.number().int().min(1).max(60).optional(),
  personalizationEnabled: z.boolean().optional(),
  excludedHostnames: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  rememberedTerms: z.array(LearningProfileRememberedTermSchema).max(200).optional(),
}).strict()
export type LearningProfilePatch = z.infer<typeof LearningProfilePatchSchema>

function nowIso(): string {
  return new Date().toISOString()
}

function stableTermId(sourceTerm: string, hostname?: string): string {
  const normalizedSource = sourceTerm.trim().toLowerCase().replace(/\s+/g, "_")
  const normalizedHost = hostname?.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, "_")
  return `lp_term_${encodeURIComponent(normalizedHost ? `${normalizedHost}_${normalizedSource}` : normalizedSource)}`
}

function normalizeHostnames(hostnames: readonly string[]): string[] {
  return Array.from(new Set(hostnames
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)))
    .slice(0, 100)
}

function buildDefaultLearningProfile(input: Partial<LearningProfile> = {}): LearningProfile {
  const updatedAt = input.updatedAt ?? nowIso()
  return LearningProfileSchema.parse({
    version: 1,
    targetLang: input.targetLang ?? "zh-CN",
    languageLevel: input.languageLevel ?? "intermediate",
    explainMode: input.explainMode ?? "deep",
    primaryGoal: input.primaryGoal ?? "read_articles_docs",
    dailyGoalMinutes: input.dailyGoalMinutes ?? 5,
    personalizationEnabled: input.personalizationEnabled ?? true,
    excludedHostnames: normalizeHostnames(input.excludedHostnames ?? []),
    rememberedTerms: input.rememberedTerms ?? [],
    updatedAt,
  })
}

function parseLearningProfile(value: unknown): LearningProfile | null {
  const parsed = LearningProfileSchema.safeParse(value)
  if (!parsed.success) return null
  return LearningProfileSchema.parse({
    ...parsed.data,
    excludedHostnames: normalizeHostnames(parsed.data.excludedHostnames),
  })
}

export function buildLearningProfileFromConfig(
  config: Pick<AstraConfig, "targetLang" | "languageLevel" | "explainMode">,
  primaryGoal: LearningProfileGoal = "read_articles_docs",
): LearningProfile {
  return buildDefaultLearningProfile({
    targetLang: config.targetLang,
    languageLevel: config.languageLevel,
    explainMode: config.explainMode,
    primaryGoal,
  })
}

export async function readLearningProfile(): Promise<LearningProfile> {
  const stored = await browser.storage.local.get([
    LEARNING_PROFILE_STORAGE_KEY,
    LEGACY_ONBOARDING_PRIMARY_GOAL_STORAGE_KEY,
  ])
  const parsed = parseLearningProfile(stored[LEARNING_PROFILE_STORAGE_KEY])
  if (parsed) return parsed

  const legacyGoal = LearningProfileGoalSchema.safeParse(stored[LEGACY_ONBOARDING_PRIMARY_GOAL_STORAGE_KEY])
  return buildDefaultLearningProfile({
    primaryGoal: legacyGoal.success ? legacyGoal.data : "read_articles_docs",
  })
}

export async function replaceLearningProfile(profile: LearningProfile): Promise<LearningProfile> {
  const normalized = LearningProfileSchema.parse({
    ...profile,
    excludedHostnames: normalizeHostnames(profile.excludedHostnames),
    rememberedTerms: profile.rememberedTerms.slice(0, 200),
  })
  await browser.storage.local.set({ [LEARNING_PROFILE_STORAGE_KEY]: normalized })
  return normalized
}

export async function updateLearningProfile(patchInput: LearningProfilePatch): Promise<LearningProfile> {
  const patch = LearningProfilePatchSchema.parse(patchInput)
  const current = await readLearningProfile()
  return replaceLearningProfile({
    ...current,
    ...patch,
    excludedHostnames: patch.excludedHostnames
      ? normalizeHostnames(patch.excludedHostnames)
      : current.excludedHostnames,
    rememberedTerms: patch.rememberedTerms ?? current.rememberedTerms,
    updatedAt: nowIso(),
  })
}

export async function rememberPreferredTerm(params: {
  sourceTerm: string
  preferredTerm: string
  source?: LearningProfileRememberedTermSource
  hostname?: string | null
}): Promise<LearningProfile> {
  const current = await readLearningProfile()
  const timestamp = nowIso()
  const hostname = params.hostname?.trim().toLowerCase() || undefined
  const id = stableTermId(params.sourceTerm, hostname)
  const existing = current.rememberedTerms.find((term) => term.id === id)
  const nextTerm = LearningProfileRememberedTermSchema.parse({
    id,
    sourceTerm: params.sourceTerm,
    preferredTerm: params.preferredTerm,
    source: params.source ?? existing?.source ?? "saved_term",
    hostname,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  })
  return updateLearningProfile({
    rememberedTerms: [
      nextTerm,
      ...current.rememberedTerms.filter((term) => term.id !== id),
    ].slice(0, 200),
  })
}

export async function forgetRememberedTerm(termId: string): Promise<LearningProfile> {
  const current = await readLearningProfile()
  return updateLearningProfile({
    rememberedTerms: current.rememberedTerms.filter((term) => term.id !== termId),
  })
}

export async function setPersonalizationEnabled(enabled: boolean): Promise<LearningProfile> {
  return updateLearningProfile({ personalizationEnabled: enabled })
}

export async function excludeHostnameFromPersonalization(hostname: string): Promise<LearningProfile> {
  const current = await readLearningProfile()
  return updateLearningProfile({
    excludedHostnames: normalizeHostnames([...current.excludedHostnames, hostname]),
  })
}

export async function allowHostnamePersonalization(hostname: string): Promise<LearningProfile> {
  const normalized = hostname.trim().toLowerCase()
  const current = await readLearningProfile()
  return updateLearningProfile({
    excludedHostnames: current.excludedHostnames.filter((value) => value !== normalized),
  })
}
