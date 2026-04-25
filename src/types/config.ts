import { z } from "zod"
import type { AstraSession } from "./auth"

export const ProviderIdSchema = z.enum(["openai", "gemini"])

export const TranslationModeSchema = z.enum(["bilingual", "translation-only"])
export const TranslationThemeSchema = z.enum(["default", "underline", "highlight"])
export const HoverTriggerSchema = z.enum(["alt", "always", "disabled"])
export const ContentScopeSchema = z.enum(["page", "article"])
export const InputTranslationSchema = z.enum(["enabled", "disabled"])
export const InputTranslationModeSchema = z.enum(["replace", "bilingual"])
export const LanguageLevelSchema = z.enum(["beginner", "intermediate", "advanced"])
export const ExplainModeSchema = z.enum(["beginner", "exam", "deep"])
export const TTSEngineSchema = z.enum(["browser", "edge"])
export const AstraSyncCollectionSchema = z.enum(["config", "vocabulary", "reading_history", "study_progress"])

export const PresentationSettingsSchema = z.object({
  mode: TranslationModeSchema.default("bilingual"),
  theme: TranslationThemeSchema.default("default"),
  fontSize: z.number().min(0.5).max(2.0).default(0.92),
  translationColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$|^rgb(a)?\(|^hsl(a)?\(/).default("#64748b"),
})

export const PresentationSettingsInputSchema = z.object({
  mode: TranslationModeSchema.optional(),
  fontSize: z.number().min(0.5).max(2.0).optional(),
  translationColor: z.string().optional(),
  theme: TranslationThemeSchema.optional(),
})

export const TTSSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  engine: TTSEngineSchema.default("browser"),
  voiceName: z.string().trim().min(1).optional(),
  rate: z.number().min(0.5).max(2.0).default(0.9),
  pitch: z.number().min(0.5).max(2.0).default(1.0),
  highlightSentences: z.boolean().default(true),
})

export const TTSSettingsInputSchema = z.object({
  enabled: z.boolean().optional(),
  engine: TTSEngineSchema.optional(),
  voiceName: z.string().optional(),
  rate: z.number().min(0.5).max(2.0).optional(),
  pitch: z.number().min(0.5).max(2.0).optional(),
  highlightSentences: z.boolean().optional(),
})

export const SiteConfigSchema = z.object({
  enabled: z.boolean().default(true),
  alwaysTranslate: z.boolean().default(false),
  targetLang: z.string().trim().min(1).optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  presentation: PresentationSettingsInputSchema.optional(),
  /** CSS selectors limiting translation scope to matching elements. */
  selectors: z.array(z.string()).optional(),
  /** CSS selectors for elements to exclude from translation. */
  excludeSelectors: z.array(z.string()).optional(),
  /** Minimum text length for a block to be translated. */
  paragraphMinLength: z.number().int().min(0).optional(),
  /** Custom CSS injected into the page when this site config is active. */
  customCss: z.string().max(5000).optional(),
})

export const SiteConfigInputSchema = z.object({
  enabled: z.boolean().optional(),
  alwaysTranslate: z.boolean().optional(),
  targetLang: z.string().trim().min(1).optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  presentation: PresentationSettingsInputSchema.optional(),
  selectors: z.array(z.string()).optional(),
  excludeSelectors: z.array(z.string()).optional(),
  paragraphMinLength: z.number().int().min(0).optional(),
  customCss: z.string().max(5000).optional(),
})

const ManagedProviderBaseSchema = z.object({
  accessToken: z.string().default(""),
  apiKey: z.string().default(""),
  relayBaseURL: z.string().url().optional(),
  model: z.string().trim().min(1),
})

export const OpenAIProviderConfigSchema = ManagedProviderBaseSchema.extend({
  id: z.literal("openai").default("openai"),
  model: z.string().trim().min(1).default("gpt-5.4-nano"),
})

export const GeminiProviderConfigSchema = ManagedProviderBaseSchema.extend({
  id: z.literal("gemini"),
  model: z.string().trim().min(1).default("gemini-3.1-flash-lite-preview"),
})

export const ProviderConfigSchema = z.discriminatedUnion("id", [
  OpenAIProviderConfigSchema,
  GeminiProviderConfigSchema,
])

export const CustomActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelZh: z.string().min(1),
  systemPrompt: z.string().min(1),
  enabled: z.boolean().default(true),
})

export type CustomAction = z.infer<typeof CustomActionSchema>

export const ConnectionModeSchema = z.enum(["astra", "custom"])

export const AstraConfigSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  connectionMode: ConnectionModeSchema.default("astra"),
  hoverTrigger: HoverTriggerSchema.default("alt"),
  contentScope: ContentScopeSchema.default("page"),
  inputTranslation: InputTranslationSchema.default("enabled"),
  inputTranslationMode: InputTranslationModeSchema.default("replace"),
  languageLevel: LanguageLevelSchema.default("intermediate"),
  explainMode: ExplainModeSchema.default("deep"),
  privacyMode: z.boolean().default(false),
  provider: ProviderConfigSchema.default({
    id: "openai",
    accessToken: "",
    apiKey: "",
    model: "gpt-5.4-nano",
  }),
  tts: TTSSettingsSchema.default({
    enabled: true,
    engine: "browser",
    rate: 0.9,
    pitch: 1.0,
    highlightSentences: true,
  }),
  presentation: PresentationSettingsSchema.default({
    mode: "bilingual",
    theme: "default",
    fontSize: 0.92,
    translationColor: "#64748b",
  }),
  sites: z.record(z.string(), SiteConfigSchema).default({}),
  customActions: z.array(CustomActionSchema).default([]),
})

export const AstraConfigInputSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  connectionMode: ConnectionModeSchema.optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  inputTranslation: InputTranslationSchema.optional(),
  inputTranslationMode: InputTranslationModeSchema.optional(),
  languageLevel: LanguageLevelSchema.optional(),
  explainMode: ExplainModeSchema.optional(),
  privacyMode: z.boolean().optional(),
  provider: z.object({
    id: ProviderIdSchema.optional(),
    accessToken: z.string().optional(),
    apiKey: z.string().optional(),
    relayBaseURL: z.string().optional(),
    model: z.string().trim().min(1).optional(),
  }).optional(),
  tts: TTSSettingsInputSchema.optional(),
  presentation: PresentationSettingsInputSchema.optional(),
  sites: z.record(z.string(), SiteConfigInputSchema).optional(),
  customActions: z.array(CustomActionSchema).optional(),
})

export const AstraSyncedProviderConfigSchema = z.object({
  id: ProviderIdSchema,
  model: z.string().trim().min(1),
  relayBaseURL: z.string().trim().url().optional(),
})

export const AstraSyncedTTSSettingsSchema = TTSSettingsSchema.omit({
  voiceName: true,
})

export const AstraSyncedConfigSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  connectionMode: ConnectionModeSchema.default("astra"),
  hoverTrigger: HoverTriggerSchema.default("alt"),
  contentScope: ContentScopeSchema.default("page"),
  inputTranslation: InputTranslationSchema.default("enabled"),
  inputTranslationMode: InputTranslationModeSchema.default("replace"),
  languageLevel: LanguageLevelSchema.default("intermediate"),
  explainMode: ExplainModeSchema.default("deep"),
  privacyMode: z.boolean().default(false),
  provider: AstraSyncedProviderConfigSchema.default({
    id: "openai",
    model: "gpt-5.4-nano",
  }),
  tts: AstraSyncedTTSSettingsSchema.default({
    enabled: true,
    engine: "browser",
    rate: 0.9,
    pitch: 1.0,
    highlightSentences: true,
  }),
  presentation: PresentationSettingsSchema.default({
    mode: "bilingual",
    theme: "default",
    fontSize: 0.92,
    translationColor: "#64748b",
  }),
  sites: z.record(z.string(), SiteConfigSchema).default({}),
  customActions: z.array(CustomActionSchema).default([]),
})

export const AstraSyncedConfigGlobalSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  connectionMode: ConnectionModeSchema.default("astra"),
  hoverTrigger: HoverTriggerSchema.default("alt"),
  contentScope: ContentScopeSchema.default("page"),
  inputTranslation: InputTranslationSchema.default("enabled"),
  inputTranslationMode: InputTranslationModeSchema.default("replace"),
  languageLevel: LanguageLevelSchema.default("intermediate"),
  explainMode: ExplainModeSchema.default("deep"),
  privacyMode: z.boolean().default(false),
  provider: AstraSyncedProviderConfigSchema.default({
    id: "openai",
    model: "gpt-5.4-nano",
  }),
  tts: AstraSyncedTTSSettingsSchema.default({
    enabled: true,
    engine: "browser",
    rate: 0.9,
    pitch: 1.0,
    highlightSentences: true,
  }),
  presentation: PresentationSettingsSchema.default({
    mode: "bilingual",
    theme: "default",
    fontSize: 0.92,
    translationColor: "#64748b",
  }),
})

export const AstraConfigSyncRecordKindSchema = z.enum(["global", "site", "custom_action"])
export const CONFIG_SYNC_GLOBAL_RECORD_ID = "global" as const
export const CONFIG_SYNC_SITE_RECORD_PREFIX = "site:" as const
export const CONFIG_SYNC_CUSTOM_ACTION_RECORD_PREFIX = "custom_action:" as const

export const AstraConfigSyncRecordSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("global"),
    config: AstraSyncedConfigGlobalSchema,
  }),
  z.object({
    kind: z.literal("site"),
    hostname: z.string().trim().min(1),
    site: SiteConfigSchema,
  }),
  z.object({
    kind: z.literal("custom_action"),
    action: CustomActionSchema,
  }),
])

export type ProviderId = z.infer<typeof ProviderIdSchema>
export type AstraSyncCollection = z.infer<typeof AstraSyncCollectionSchema>
export type ConnectionMode = z.infer<typeof ConnectionModeSchema>
export type TranslationMode = z.infer<typeof TranslationModeSchema>
export type TranslationTheme = z.infer<typeof TranslationThemeSchema>
export type HoverTrigger = z.infer<typeof HoverTriggerSchema>
export type ContentScope = z.infer<typeof ContentScopeSchema>
export type InputTranslation = z.infer<typeof InputTranslationSchema>
export type InputTranslationMode = z.infer<typeof InputTranslationModeSchema>
export type LanguageLevel = z.infer<typeof LanguageLevelSchema>
export type ExplainMode = z.infer<typeof ExplainModeSchema>
export type TTSEngine = z.infer<typeof TTSEngineSchema>
export type PresentationSettings = z.infer<typeof PresentationSettingsSchema>
export type TTSSettings = z.infer<typeof TTSSettingsSchema>
export type SiteConfig = z.infer<typeof SiteConfigSchema>
export type SiteConfigInput = z.infer<typeof SiteConfigInputSchema>
export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>
export type GeminiProviderConfig = z.infer<typeof GeminiProviderConfigSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>
export type AstraConfig = z.infer<typeof AstraConfigSchema>
export type AstraConfigInput = z.infer<typeof AstraConfigInputSchema>
export type AstraSyncedProviderConfig = z.infer<typeof AstraSyncedProviderConfigSchema>
export type AstraSyncedTTSSettings = z.infer<typeof AstraSyncedTTSSettingsSchema>
export type AstraSyncedConfig = z.infer<typeof AstraSyncedConfigSchema>
export type AstraSyncedConfigGlobal = z.infer<typeof AstraSyncedConfigGlobalSchema>
export type AstraConfigSyncRecordKind = z.infer<typeof AstraConfigSyncRecordKindSchema>
export type AstraConfigSyncRecord = z.infer<typeof AstraConfigSyncRecordSchema>

export interface AstraConfigSyncOptions {
  includeManagedRelayBaseURL?: boolean
}

export interface AstraConfigContinuitySummary {
  localOnlyFields: string[]
  hasProviderSecrets: boolean
  hasCustomRelayBaseURL: boolean
  hasDeviceVoiceName: boolean
}

export interface TranslationOverrides {
  targetLang?: string
  translationMode?: TranslationMode
  translationTheme?: TranslationTheme
  contentScope?: ContentScope
  selectors?: string[]
  excludeSelectors?: string[]
  paragraphMinLength?: number
}

export interface ResolvedSiteTranslationSettings {
  hostname: string | null
  enabled: boolean
  alwaysTranslate: boolean
  targetLang: string
  hoverTrigger: HoverTrigger
  contentScope: ContentScope
  presentation: PresentationSettings
  selectors?: string[]
  excludeSelectors?: string[]
  paragraphMinLength?: number
  customCss?: string
}

export interface AstraConfigSyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown | null
}

export interface AstraConfigSyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown | null
}

export const DEFAULT_ASTRA_CONFIG: AstraConfig = {
  version: 1,
  targetLang: "zh-CN",
  connectionMode: "astra",
  hoverTrigger: "alt",
  contentScope: "page" as const,
  inputTranslation: "enabled" as const,
  inputTranslationMode: "replace" as const,
  languageLevel: "intermediate" as const,
  explainMode: "deep" as const,
  privacyMode: false,
  provider: {
    id: "openai",
    accessToken: "",
    apiKey: "",
    model: "gpt-5.4-nano",
  },
  tts: {
    enabled: true,
    engine: "browser",
    rate: 0.9,
    pitch: 1.0,
    highlightSentences: true,
  },
  presentation: {
    mode: "bilingual",
    theme: "default",
    fontSize: 0.92,
    translationColor: "#64748b",
  },
  sites: {},
  customActions: [],
}

export function getDefaultProviderModel(providerId: ProviderId): string {
  switch (providerId) {
    case "openai":
      return "gpt-5.4-nano"
    case "gemini":
      return "gemini-3.1-flash-lite-preview"
  }
}

export function createDefaultProviderConfig(providerId: ProviderId = "openai"): ProviderConfig {
  return {
    id: providerId,
    accessToken: "",
    apiKey: "",
    model: getDefaultProviderModel(providerId),
  }
}

function normalizePresentation(
  presentation?: Partial<PresentationSettings> | null,
): PresentationSettings {
  return {
    mode: presentation?.mode ?? DEFAULT_ASTRA_CONFIG.presentation.mode,
    theme: presentation?.theme ?? DEFAULT_ASTRA_CONFIG.presentation.theme,
    fontSize: presentation?.fontSize ?? DEFAULT_ASTRA_CONFIG.presentation.fontSize,
    translationColor: presentation?.translationColor ?? DEFAULT_ASTRA_CONFIG.presentation.translationColor,
  }
}

function normalizeTTSSettings(tts?: Partial<TTSSettings> | null): TTSSettings {
  const voiceName = tts?.voiceName?.trim()

  return {
    enabled: tts?.enabled ?? DEFAULT_ASTRA_CONFIG.tts.enabled,
    engine: tts?.engine ?? DEFAULT_ASTRA_CONFIG.tts.engine,
    rate: tts?.rate ?? DEFAULT_ASTRA_CONFIG.tts.rate,
    pitch: tts?.pitch ?? DEFAULT_ASTRA_CONFIG.tts.pitch,
    highlightSentences: tts?.highlightSentences ?? DEFAULT_ASTRA_CONFIG.tts.highlightSentences,
    ...(voiceName ? { voiceName } : {}),
  }
}

function normalizeSiteConfig(siteConfig?: Partial<SiteConfig> | null): SiteConfig {
  const targetLang = siteConfig?.targetLang?.trim()
  const presentation = siteConfig?.presentation
  const normalizedPresentation = presentation
    ? {
        ...(presentation.mode ? { mode: presentation.mode } : {}),
        ...(presentation.theme ? { theme: presentation.theme } : {}),
        ...(presentation.fontSize != null ? { fontSize: presentation.fontSize } : {}),
        ...(presentation.translationColor ? { translationColor: presentation.translationColor } : {}),
      }
    : undefined

  return {
    enabled: siteConfig?.enabled ?? true,
    alwaysTranslate: siteConfig?.alwaysTranslate ?? false,
    ...(targetLang ? { targetLang } : {}),
    ...(siteConfig?.hoverTrigger ? { hoverTrigger: siteConfig.hoverTrigger } : {}),
    ...(siteConfig?.contentScope ? { contentScope: siteConfig.contentScope } : {}),
    ...(normalizedPresentation && Object.keys(normalizedPresentation).length > 0
      ? { presentation: normalizedPresentation }
      : {}),
    ...(siteConfig?.selectors ? { selectors: siteConfig.selectors } : {}),
    ...(siteConfig?.excludeSelectors ? { excludeSelectors: siteConfig.excludeSelectors } : {}),
    ...(siteConfig?.paragraphMinLength != null ? { paragraphMinLength: siteConfig.paragraphMinLength } : {}),
    ...(siteConfig?.customCss ? { customCss: siteConfig.customCss } : {}),
  }
}

export function isDefaultSiteConfig(siteConfig: SiteConfig): boolean {
  return siteConfig.enabled === true
    && siteConfig.alwaysTranslate === false
    && !siteConfig.targetLang
    && !siteConfig.hoverTrigger
    && !siteConfig.contentScope
    && (!siteConfig.presentation || Object.keys(siteConfig.presentation).length === 0)
    && !siteConfig.selectors?.length
    && !siteConfig.excludeSelectors?.length
    && siteConfig.paragraphMinLength == null
    && !siteConfig.customCss
}

export function normalizeSiteKey(hostnameOrUrl: string): string | null {
  const raw = hostnameOrUrl.trim()
  if (!raw) return null

  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`)
    const hostname = url.hostname.trim().toLowerCase().replace(/\.+$/, "")
    return hostname || null
  } catch {
    const hostname = raw.toLowerCase().replace(/\.+$/, "")
    return hostname || null
  }
}

export function resolveSiteTranslationSettings(
  config: AstraConfig,
  hostnameOrUrl: string | null | undefined,
  overrides: TranslationOverrides = {},
): ResolvedSiteTranslationSettings {
  const hostname = hostnameOrUrl ? normalizeSiteKey(hostnameOrUrl) : null
  const siteConfig = hostname ? config.sites[hostname] : undefined
  const basePresentation = normalizePresentation(config.presentation)

  return {
    hostname,
    enabled: siteConfig?.enabled ?? true,
    alwaysTranslate: siteConfig?.alwaysTranslate ?? false,
    targetLang: overrides.targetLang?.trim()
      || siteConfig?.targetLang?.trim()
      || config.targetLang,
    hoverTrigger: siteConfig?.hoverTrigger ?? config.hoverTrigger,
    contentScope: overrides.contentScope ?? siteConfig?.contentScope ?? config.contentScope,
    presentation: {
      mode: overrides.translationMode
        ?? siteConfig?.presentation?.mode
        ?? basePresentation.mode,
      theme: overrides.translationTheme
        ?? siteConfig?.presentation?.theme
        ?? basePresentation.theme,
      fontSize: siteConfig?.presentation?.fontSize ?? basePresentation.fontSize,
      translationColor: siteConfig?.presentation?.translationColor ?? basePresentation.translationColor,
    },
    selectors: overrides.selectors ?? siteConfig?.selectors,
    excludeSelectors: overrides.excludeSelectors ?? siteConfig?.excludeSelectors,
    paragraphMinLength: overrides.paragraphMinLength ?? siteConfig?.paragraphMinLength,
    customCss: siteConfig?.customCss,
  }
}

export function hasProviderAccess(provider: ProviderConfig): boolean {
  // Direct mode: apiKey is sufficient
  if ((provider.apiKey ?? "").trim().length > 0) return true
  // Relay mode: need both accessToken and relayBaseURL
  return provider.accessToken.trim().length > 0 && (provider.relayBaseURL?.trim().length ?? 0) > 0
}

export function resolveManagedProviderConfig(
  provider: ProviderConfig,
  session?: AstraSession | null,
): ProviderConfig {
  const sessionToken = session?.sessionToken?.trim()
  const relayBaseURL = session?.relayBaseURL?.trim() || provider.relayBaseURL?.trim()

  return {
    ...provider,
    accessToken: sessionToken && sessionToken.length > 0
      ? sessionToken
      : provider.accessToken,
    ...(relayBaseURL ? { relayBaseURL } : {}),
  }
}

export function hasResolvedProviderAccess(
  provider: ProviderConfig,
  session?: AstraSession | null,
): boolean {
  return hasProviderAccess(resolveManagedProviderConfig(provider, session))
}

function normalizeProviderConfig(provider?: Partial<ProviderConfig> | null): ProviderConfig {
  const providerId = provider?.id ?? DEFAULT_ASTRA_CONFIG.provider.id
  const relayBaseURL = provider?.relayBaseURL?.trim()

  return {
    id: providerId,
    accessToken: provider?.accessToken?.trim() ?? "",
    apiKey: provider?.apiKey?.trim() ?? "",
    model: provider?.model?.trim() || getDefaultProviderModel(providerId),
    ...(relayBaseURL ? { relayBaseURL } : {}),
  }
}

export function normalizeConfig(config: AstraConfig): AstraConfig {
  const sites = Object.fromEntries(
    Object.entries(config.sites ?? {}).flatMap(([key, siteConfig]) => {
      const normalizedKey = normalizeSiteKey(key)
      if (!normalizedKey) return []

      const normalizedSite = normalizeSiteConfig(siteConfig)
      if (isDefaultSiteConfig(normalizedSite)) return []

      return [[normalizedKey, normalizedSite]]
    }),
  )

  return {
    version: 1,
    targetLang: config.targetLang.trim() || DEFAULT_ASTRA_CONFIG.targetLang,
    connectionMode: config.connectionMode ?? DEFAULT_ASTRA_CONFIG.connectionMode,
    hoverTrigger: config.hoverTrigger ?? DEFAULT_ASTRA_CONFIG.hoverTrigger,
    contentScope: config.contentScope ?? DEFAULT_ASTRA_CONFIG.contentScope,
    inputTranslation: config.inputTranslation ?? DEFAULT_ASTRA_CONFIG.inputTranslation,
    inputTranslationMode: config.inputTranslationMode ?? DEFAULT_ASTRA_CONFIG.inputTranslationMode,
    languageLevel: config.languageLevel ?? DEFAULT_ASTRA_CONFIG.languageLevel,
    explainMode: config.explainMode ?? DEFAULT_ASTRA_CONFIG.explainMode,
    privacyMode: config.privacyMode ?? DEFAULT_ASTRA_CONFIG.privacyMode,
    provider: normalizeProviderConfig(config.provider),
    tts: normalizeTTSSettings(config.tts),
    presentation: normalizePresentation(config.presentation),
    sites,
    customActions: config.customActions ?? [],
  }
}

export function buildSyncSafeConfig(
  config: AstraConfig,
  options: AstraConfigSyncOptions = {},
): AstraSyncedConfig {
  const normalized = normalizeConfig(config)
  const relayBaseURL = options.includeManagedRelayBaseURL
    ? normalized.provider.relayBaseURL?.trim()
    : undefined

  return AstraSyncedConfigSchema.parse({
    version: normalized.version,
    targetLang: normalized.targetLang,
    connectionMode: normalized.connectionMode,
    hoverTrigger: normalized.hoverTrigger,
    contentScope: normalized.contentScope,
    inputTranslation: normalized.inputTranslation,
    inputTranslationMode: normalized.inputTranslationMode,
    languageLevel: normalized.languageLevel,
    explainMode: normalized.explainMode,
    privacyMode: normalized.privacyMode,
    provider: {
      id: normalized.provider.id,
      model: normalized.provider.model,
      ...(relayBaseURL ? { relayBaseURL } : {}),
    },
    tts: {
      enabled: normalized.tts.enabled,
      engine: normalized.tts.engine,
      rate: normalized.tts.rate,
      pitch: normalized.tts.pitch,
      highlightSentences: normalized.tts.highlightSentences,
    },
    presentation: normalized.presentation,
    sites: normalized.sites,
    customActions: normalized.customActions,
  })
}

export function buildSyncSafeConfigGlobal(
  config: AstraConfig,
  options: AstraConfigSyncOptions = {},
): AstraSyncedConfigGlobal {
  const normalized = normalizeConfig(config)
  const relayBaseURL = options.includeManagedRelayBaseURL && normalized.connectionMode === "astra"
    ? normalized.provider.relayBaseURL?.trim()
    : undefined

  return AstraSyncedConfigGlobalSchema.parse({
    version: normalized.version,
    targetLang: normalized.targetLang,
    connectionMode: normalized.connectionMode,
    hoverTrigger: normalized.hoverTrigger,
    contentScope: normalized.contentScope,
    inputTranslation: normalized.inputTranslation,
    inputTranslationMode: normalized.inputTranslationMode,
    languageLevel: normalized.languageLevel,
    explainMode: normalized.explainMode,
    privacyMode: normalized.privacyMode,
    provider: {
      id: normalized.provider.id,
      model: normalized.provider.model,
      ...(relayBaseURL ? { relayBaseURL } : {}),
    },
    tts: {
      enabled: normalized.tts.enabled,
      engine: normalized.tts.engine,
      rate: normalized.tts.rate,
      pitch: normalized.tts.pitch,
      highlightSentences: normalized.tts.highlightSentences,
    },
    presentation: normalized.presentation,
  })
}

export function mergeSyncSafeConfig(
  currentConfig: AstraConfig,
  syncedConfig: AstraSyncedConfig,
): AstraConfig {
  const normalizedCurrent = normalizeConfig(currentConfig)
  const parsedSyncedConfig = AstraSyncedConfigSchema.parse(syncedConfig)

  return normalizeConfig({
    ...normalizedCurrent,
    ...parsedSyncedConfig,
    provider: {
      ...normalizedCurrent.provider,
      id: parsedSyncedConfig.provider.id,
      model: parsedSyncedConfig.provider.model,
      ...(parsedSyncedConfig.provider.relayBaseURL !== undefined
        ? { relayBaseURL: parsedSyncedConfig.provider.relayBaseURL }
        : {}),
    },
    explainMode: parsedSyncedConfig.explainMode,
    tts: {
      ...normalizedCurrent.tts,
      ...parsedSyncedConfig.tts,
    },
    presentation: parsedSyncedConfig.presentation,
    sites: parsedSyncedConfig.sites,
    customActions: parsedSyncedConfig.customActions,
  })
}

export function buildConfigSiteSyncRecordId(hostname: string): string {
  const normalized = normalizeSiteKey(hostname)
  if (!normalized) {
    throw new Error("Site sync record hostname is required.")
  }
  return `${CONFIG_SYNC_SITE_RECORD_PREFIX}${normalized}`
}

export function buildConfigCustomActionSyncRecordId(actionId: string): string {
  const normalized = actionId.trim()
  if (!normalized) {
    throw new Error("Custom action sync record id is required.")
  }
  return `${CONFIG_SYNC_CUSTOM_ACTION_RECORD_PREFIX}${normalized}`
}

export function buildConfigSyncRecordMap(
  config: AstraConfig,
  options: AstraConfigSyncOptions = {},
): Record<string, AstraConfigSyncRecord> {
  const normalized = normalizeConfig(config)
  const globalRecord = buildSyncSafeConfigGlobal(normalized, options)

  return {
    [CONFIG_SYNC_GLOBAL_RECORD_ID]: {
      kind: "global",
      config: globalRecord,
    },
    ...Object.fromEntries(
      Object.entries(normalized.sites).map(([hostname, site]) => [
        buildConfigSiteSyncRecordId(hostname),
        {
          kind: "site" as const,
          hostname,
          site,
        },
      ]),
    ),
    ...Object.fromEntries(
      normalized.customActions.map((action) => [
        buildConfigCustomActionSyncRecordId(action.id),
        {
          kind: "custom_action" as const,
          action,
        },
      ]),
    ),
  }
}

export function applyConfigSyncMutation(
  currentConfig: AstraConfig,
  mutation: AstraConfigSyncMutationLike,
): AstraConfig {
  const normalizedCurrent = normalizeConfig(currentConfig)

  if (mutation.operation === "delete") {
    if (mutation.recordId === CONFIG_SYNC_GLOBAL_RECORD_ID) {
      return normalizedCurrent
    }

    if (mutation.recordId.startsWith(CONFIG_SYNC_SITE_RECORD_PREFIX)) {
      const hostname = normalizeSiteKey(mutation.recordId.slice(CONFIG_SYNC_SITE_RECORD_PREFIX.length))
      if (!hostname) return normalizedCurrent

      const nextSites = { ...normalizedCurrent.sites }
      delete nextSites[hostname]
      return normalizeConfig({
        ...normalizedCurrent,
        sites: nextSites,
      })
    }

    if (mutation.recordId.startsWith(CONFIG_SYNC_CUSTOM_ACTION_RECORD_PREFIX)) {
      const actionId = mutation.recordId.slice(CONFIG_SYNC_CUSTOM_ACTION_RECORD_PREFIX.length).trim()
      if (!actionId) return normalizedCurrent

      return normalizeConfig({
        ...normalizedCurrent,
        customActions: normalizedCurrent.customActions.filter((action) => action.id !== actionId),
      })
    }

    return normalizedCurrent
  }

  const parsedPayload = AstraConfigSyncRecordSchema.parse(mutation.payload)

  if (parsedPayload.kind === "global") {
    return normalizeConfig({
      ...normalizedCurrent,
      ...parsedPayload.config,
      provider: {
        ...normalizedCurrent.provider,
        id: parsedPayload.config.provider.id,
        model: parsedPayload.config.provider.model,
        ...(parsedPayload.config.provider.relayBaseURL !== undefined
          ? { relayBaseURL: parsedPayload.config.provider.relayBaseURL }
          : {}),
      },
      tts: {
        ...normalizedCurrent.tts,
        ...parsedPayload.config.tts,
      },
      presentation: {
        ...normalizedCurrent.presentation,
        ...parsedPayload.config.presentation,
      },
    })
  }

  if (parsedPayload.kind === "site") {
    const hostname = normalizeSiteKey(parsedPayload.hostname)
    if (!hostname) return normalizedCurrent

    return normalizeConfig({
      ...normalizedCurrent,
      sites: {
        ...normalizedCurrent.sites,
        [hostname]: parsedPayload.site,
      },
    })
  }

  const existingIndex = normalizedCurrent.customActions.findIndex((action) => action.id === parsedPayload.action.id)
  const nextActions = [...normalizedCurrent.customActions]
  if (existingIndex >= 0) {
    nextActions[existingIndex] = parsedPayload.action
  } else {
    nextActions.push(parsedPayload.action)
  }

  return normalizeConfig({
    ...normalizedCurrent,
    customActions: nextActions,
  })
}

export function applyConfigSyncMutations(
  currentConfig: AstraConfig,
  mutations: AstraConfigSyncMutationLike[],
): AstraConfig {
  return mutations.reduce(
    (config, mutation) => applyConfigSyncMutation(config, mutation),
    normalizeConfig(currentConfig),
  )
}

export function summarizeConfigContinuity(config: AstraConfig): AstraConfigContinuitySummary {
  const normalized = normalizeConfig(config)
  const localOnlyFields = [
    ...(normalized.provider.apiKey.trim().length > 0 ? ["provider.apiKey"] : []),
    ...(normalized.provider.accessToken.trim().length > 0 ? ["provider.accessToken"] : []),
    ...(normalized.provider.relayBaseURL?.trim().length ? ["provider.relayBaseURL"] : []),
    ...(normalized.tts.voiceName?.trim().length ? ["tts.voiceName"] : []),
  ]

  return {
    localOnlyFields,
    hasProviderSecrets: localOnlyFields.includes("provider.apiKey")
      || localOnlyFields.includes("provider.accessToken"),
    hasCustomRelayBaseURL: localOnlyFields.includes("provider.relayBaseURL"),
    hasDeviceVoiceName: localOnlyFields.includes("tts.voiceName"),
  }
}
