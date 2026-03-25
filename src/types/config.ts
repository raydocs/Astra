import { z } from "zod"

export const ProviderIdSchema = z.literal("openai")

export const TranslationModeSchema = z.enum(["bilingual", "translation-only"])
export const TranslationThemeSchema = z.enum(["default", "underline", "highlight"])
export const HoverTriggerSchema = z.enum(["alt", "always", "disabled"])
export const ContentScopeSchema = z.enum(["page", "article"])

export const PresentationSettingsSchema = z.object({
  mode: TranslationModeSchema.default("bilingual"),
  theme: TranslationThemeSchema.default("default"),
})

export const PresentationSettingsInputSchema = z.object({
  mode: TranslationModeSchema.optional(),
  theme: TranslationThemeSchema.optional(),
})

export const SiteConfigSchema = z.object({
  enabled: z.boolean().default(true),
  alwaysTranslate: z.boolean().default(false),
  targetLang: z.string().trim().min(1).optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  presentation: PresentationSettingsInputSchema.optional(),
})

export const SiteConfigInputSchema = z.object({
  enabled: z.boolean().optional(),
  alwaysTranslate: z.boolean().optional(),
  targetLang: z.string().trim().min(1).optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  presentation: PresentationSettingsInputSchema.optional(),
})

export const OpenAIProviderConfigSchema = z.object({
  id: ProviderIdSchema.default("openai"),
  apiKey: z.string().default(""),
  baseURL: z.string().optional(),
  model: z.string().trim().min(1).default("gpt-4o-mini"),
})

export const AstraConfigSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  hoverTrigger: HoverTriggerSchema.default("alt"),
  contentScope: ContentScopeSchema.default("page"),
  provider: OpenAIProviderConfigSchema.default({
    id: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  }),
  presentation: PresentationSettingsSchema.default({
    mode: "bilingual",
    theme: "default",
  }),
  sites: z.record(z.string(), SiteConfigSchema).default({}),
})

export const AstraConfigInputSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  hoverTrigger: HoverTriggerSchema.optional(),
  contentScope: ContentScopeSchema.optional(),
  provider: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
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
export type PresentationSettings = z.infer<typeof PresentationSettingsSchema>
export type SiteConfig = z.infer<typeof SiteConfigSchema>
export type SiteConfigInput = z.infer<typeof SiteConfigInputSchema>
export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>
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
}

export const DEFAULT_ASTRA_CONFIG: AstraConfig = {
  version: 1,
  targetLang: "zh-CN",
  hoverTrigger: "alt",
  contentScope: "page" as const,
  provider: {
    id: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  },
  presentation: {
    mode: "bilingual",
    theme: "default",
  },
  sites: {},
}

function normalizePresentation(
  presentation?: Partial<PresentationSettings> | null,
): PresentationSettings {
  return {
    mode: presentation?.mode ?? DEFAULT_ASTRA_CONFIG.presentation.mode,
    theme: presentation?.theme ?? DEFAULT_ASTRA_CONFIG.presentation.theme,
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
    },
  }
}

export function normalizeConfig(config: AstraConfig): AstraConfig {
  const baseURL = config.provider.baseURL?.trim()
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
    provider: {
      id: "openai",
      apiKey: config.provider.apiKey.trim(),
      model: config.provider.model.trim() || DEFAULT_ASTRA_CONFIG.provider.model,
      ...(baseURL ? { baseURL } : {}),
    },
    presentation: normalizePresentation(config.presentation),
    sites,
  }
}
