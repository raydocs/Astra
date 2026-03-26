import { z } from "zod"
import type { AstraSession } from "./auth"

export const ProviderIdSchema = z.enum(["openai", "gemini"])

export const TranslationModeSchema = z.enum(["bilingual", "translation-only"])
export const TranslationThemeSchema = z.enum(["default", "underline", "highlight"])
export const HoverTriggerSchema = z.enum(["alt", "always", "disabled"])
export const ContentScopeSchema = z.enum(["page", "article"])
export const InputTranslationSchema = z.enum(["enabled", "disabled"])
export const LanguageLevelSchema = z.enum(["beginner", "intermediate", "advanced"])

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

export const AstraConfigSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  hoverTrigger: HoverTriggerSchema.default("alt"),
  contentScope: ContentScopeSchema.default("page"),
  inputTranslation: InputTranslationSchema.default("enabled"),
  languageLevel: LanguageLevelSchema.default("intermediate"),
  privacyMode: z.boolean().default(false),
  provider: ProviderConfigSchema.default({
    id: "openai",
    accessToken: "",
    apiKey: "",
    model: "gpt-5.4-nano",
  }),
  presentation: PresentationSettingsSchema.default({
    mode: "bilingual",
    theme: "default",
    fontSize: 0.92,
    translationColor: "#64748b",
  }),
  sites: z.record(z.string(), SiteConfigSchema).default({}),
})

export const AstraConfigInputSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  inputTranslation: InputTranslationSchema.optional(),
  languageLevel: LanguageLevelSchema.optional(),
  privacyMode: z.boolean().optional(),
  provider: z.object({
    id: ProviderIdSchema.optional(),
    accessToken: z.string().optional(),
    relayBaseURL: z.string().optional(),
    model: z.string().trim().min(1).optional(),
  }).optional(),
  presentation: PresentationSettingsInputSchema.optional(),
  sites: z.record(z.string(), SiteConfigInputSchema).optional(),
})

export type ProviderId = z.infer<typeof ProviderIdSchema>
export type TranslationMode = z.infer<typeof TranslationModeSchema>
export type TranslationTheme = z.infer<typeof TranslationThemeSchema>
export type HoverTrigger = z.infer<typeof HoverTriggerSchema>
export type ContentScope = z.infer<typeof ContentScopeSchema>
export type InputTranslation = z.infer<typeof InputTranslationSchema>
export type PresentationSettings = z.infer<typeof PresentationSettingsSchema>
export type SiteConfig = z.infer<typeof SiteConfigSchema>
export type SiteConfigInput = z.infer<typeof SiteConfigInputSchema>
export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>
export type GeminiProviderConfig = z.infer<typeof GeminiProviderConfigSchema>
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>
export type AstraConfig = z.infer<typeof AstraConfigSchema>
export type AstraConfigInput = z.infer<typeof AstraConfigInputSchema>

export interface TranslationOverrides {
  targetLang?: string
  translationMode?: TranslationMode
  translationTheme?: TranslationTheme
  contentScope?: ContentScope
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
}

export const DEFAULT_ASTRA_CONFIG: AstraConfig = {
  version: 1,
  targetLang: "zh-CN",
  hoverTrigger: "alt",
  contentScope: "page" as const,
  inputTranslation: "enabled" as const,
  languageLevel: "intermediate" as const,
  privacyMode: false,
  provider: {
    id: "openai",
    accessToken: "",
    apiKey: "",
    model: "gpt-5.4-nano",
  },
  presentation: {
    mode: "bilingual",
    theme: "default",
    fontSize: 0.92,
    translationColor: "#64748b",
  },
  sites: {},
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

function normalizeSiteConfig(siteConfig?: Partial<SiteConfig> | null): SiteConfig {
  const targetLang = siteConfig?.targetLang?.trim()
  const presentation = siteConfig?.presentation
  const normalizedPresentation = presentation
    ? {
        ...(presentation.mode ? { mode: presentation.mode } : {}),
        ...(presentation.theme ? { theme: presentation.theme } : {}),
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
  }
}

export function isDefaultSiteConfig(siteConfig: SiteConfig): boolean {
  return siteConfig.enabled === true
    && siteConfig.alwaysTranslate === false
    && !siteConfig.targetLang
    && !siteConfig.hoverTrigger
    && !siteConfig.contentScope
    && (!siteConfig.presentation || Object.keys(siteConfig.presentation).length === 0)
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
    selectors: siteConfig?.selectors,
    excludeSelectors: siteConfig?.excludeSelectors,
    paragraphMinLength: siteConfig?.paragraphMinLength,
  }
}

export function hasProviderAccess(provider: ProviderConfig): boolean {
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
    hoverTrigger: config.hoverTrigger ?? DEFAULT_ASTRA_CONFIG.hoverTrigger,
    contentScope: config.contentScope ?? DEFAULT_ASTRA_CONFIG.contentScope,
    inputTranslation: config.inputTranslation ?? DEFAULT_ASTRA_CONFIG.inputTranslation,
    languageLevel: config.languageLevel ?? DEFAULT_ASTRA_CONFIG.languageLevel,
    privacyMode: config.privacyMode ?? DEFAULT_ASTRA_CONFIG.privacyMode,
    provider: normalizeProviderConfig(config.provider),
    presentation: normalizePresentation(config.presentation),
    sites,
  }
}
