import { browser } from "#imports"

import {
  AstraConfigInputSchema,
  AstraConfigSchema,
  AstraSyncedConfigSchema,
  DEFAULT_ASTRA_CONFIG,
  DEFAULT_SUBTITLE_QUALITY_CONTROLS,
  buildSyncSafeConfig,
  getDefaultProviderModel,
  mergeSyncSafeConfig,
  normalizeConfig,
  normalizeSiteKey,
  summarizeConfigContinuity,
  type AstraConfig,
  type AstraConfigContinuitySummary,
  type AstraConfigInput,
  type AstraConfigSyncOptions,
  type AstraSyncedConfig,
} from "@/types/config"

export const ASTRA_CONFIG_STORAGE_KEY = "astra.config.v1"

const LEGACY_KEYS = ["apiKey", "baseURL", "model", "targetLang"] as const

function buildConfigFromUnknown(value: unknown): AstraConfig | null {
  const parsed = AstraConfigSchema.safeParse(value)
  if (!parsed.success) return null
  return normalizeConfig(parsed.data)
}

async function clearLegacyConfigKeys(): Promise<void> {
  if (typeof browser.storage.local.remove === "function") {
    await browser.storage.local.remove([...LEGACY_KEYS])
  }
}

async function persistConfig(config: AstraConfig): Promise<void> {
  const normalized = normalizeConfig(config)

  await browser.storage.local.set({
    [ASTRA_CONFIG_STORAGE_KEY]: normalized,
  })
  await clearLegacyConfigKeys()
}

export async function migrateLegacyConfig(): Promise<AstraConfig> {
  const legacy = await browser.storage.local.get([...LEGACY_KEYS])

  const config = normalizeConfig({
    ...DEFAULT_ASTRA_CONFIG,
    targetLang:
      typeof legacy.targetLang === "string" && legacy.targetLang.trim().length > 0
        ? legacy.targetLang
        : DEFAULT_ASTRA_CONFIG.targetLang,
    hoverTrigger: DEFAULT_ASTRA_CONFIG.hoverTrigger,
    provider: {
      id: "openai",
      accessToken: typeof legacy.apiKey === "string" ? legacy.apiKey : "",
      apiKey: "",
      model:
        typeof legacy.model === "string" && legacy.model.trim().length > 0
          ? legacy.model
          : DEFAULT_ASTRA_CONFIG.provider.model,
      ...(typeof legacy.baseURL === "string" && legacy.baseURL.trim().length > 0
        ? { relayBaseURL: legacy.baseURL }
        : {}),
    },
    tts: DEFAULT_ASTRA_CONFIG.tts,
    presentation: DEFAULT_ASTRA_CONFIG.presentation,
    subtitleQualityControls: DEFAULT_SUBTITLE_QUALITY_CONTROLS,
    sites: {},
  })

  await persistConfig(config)
  return config
}

export async function readConfig(): Promise<AstraConfig> {
  const stored = await browser.storage.local.get(ASTRA_CONFIG_STORAGE_KEY)
  const parsed = buildConfigFromUnknown(stored[ASTRA_CONFIG_STORAGE_KEY])

  if (parsed) {
    if (JSON.stringify(parsed) !== JSON.stringify(stored[ASTRA_CONFIG_STORAGE_KEY])) {
      await persistConfig(parsed)
    }
    return parsed
  }

  return migrateLegacyConfig()
}

export async function readSyncSafeConfig(
  options: AstraConfigSyncOptions = {},
): Promise<AstraSyncedConfig> {
  const config = await readConfig()
  return buildSyncSafeConfig(config, options)
}

export async function replaceConfig(config: AstraConfig): Promise<AstraConfig> {
  const normalized = normalizeConfig(config)
  await persistConfig(normalized)
  return normalized
}

export async function applySyncSafeConfig(input: AstraSyncedConfig): Promise<AstraConfig> {
  const syncedConfig = AstraSyncedConfigSchema.parse(input)
  const currentConfig = await readConfig()
  const nextConfig = mergeSyncSafeConfig(currentConfig, syncedConfig)

  await persistConfig(nextConfig)
  return nextConfig
}

export async function readConfigContinuitySummary(): Promise<AstraConfigContinuitySummary> {
  const config = await readConfig()
  return summarizeConfigContinuity(config)
}

export async function saveConfig(input: AstraConfigInput): Promise<AstraConfig> {
  const parsedInput = AstraConfigInputSchema.parse(input)
  const currentConfig = await readConfig()

  const mergedSites = { ...currentConfig.sites }
  if (parsedInput.sites) {
    Object.entries(parsedInput.sites).forEach(([key, value]) => {
      const normalizedKey = normalizeSiteKey(key)
      if (!normalizedKey || !value) return

      mergedSites[normalizedKey] = {
        enabled: value.enabled ?? true,
        alwaysTranslate: value.alwaysTranslate ?? false,
        ...(value.targetLang ? { targetLang: value.targetLang } : {}),
        ...(value.hoverTrigger ? { hoverTrigger: value.hoverTrigger } : {}),
        ...(value.contentScope ? { contentScope: value.contentScope } : {}),
        ...(value.presentation && Object.keys(value.presentation).length > 0
          ? { presentation: value.presentation }
          : {}),
        ...(value.provider && Object.keys(value.provider).length > 0
          ? { provider: value.provider }
          : {}),
        ...(value.selectors?.length ? { selectors: value.selectors } : {}),
        ...(value.excludeSelectors?.length ? { excludeSelectors: value.excludeSelectors } : {}),
        ...(value.paragraphMinLength != null ? { paragraphMinLength: value.paragraphMinLength } : {}),
        ...(value.customCss ? { customCss: value.customCss } : {}),
        ...(value.includePathPatterns?.length ? { includePathPatterns: value.includePathPatterns } : {}),
        ...(value.excludePathPatterns?.length ? { excludePathPatterns: value.excludePathPatterns } : {}),
      }
    })
  }

  const nextConfig = normalizeConfig({
    ...currentConfig,
    ...(parsedInput.targetLang ? { targetLang: parsedInput.targetLang } : {}),
    ...(parsedInput.connectionMode !== undefined
      ? { connectionMode: parsedInput.connectionMode }
      : {}),
    ...(parsedInput.hoverTrigger ? { hoverTrigger: parsedInput.hoverTrigger } : {}),
    ...(parsedInput.contentScope ? { contentScope: parsedInput.contentScope } : {}),
    ...(parsedInput.inputTranslation !== undefined
      ? { inputTranslation: parsedInput.inputTranslation }
      : {}),
    ...(parsedInput.inputTranslationMode !== undefined
      ? { inputTranslationMode: parsedInput.inputTranslationMode }
      : {}),
    ...(parsedInput.languageLevel !== undefined
      ? { languageLevel: parsedInput.languageLevel }
      : {}),
    ...(parsedInput.explainMode !== undefined
      ? { explainMode: parsedInput.explainMode }
      : {}),
    ...(parsedInput.explanationGlossary !== undefined
      ? { explanationGlossary: parsedInput.explanationGlossary }
      : {}),
    ...(parsedInput.privacyMode !== undefined
      ? { privacyMode: parsedInput.privacyMode }
      : {}),
    provider: {
      ...currentConfig.provider,
      ...(parsedInput.provider?.id !== undefined
        ? {
            id: parsedInput.provider.id,
            model:
              currentConfig.provider.id === parsedInput.provider.id
                ? currentConfig.provider.model
                : getDefaultProviderModel(parsedInput.provider.id),
          }
        : {}),
      ...(parsedInput.provider?.accessToken !== undefined
        ? { accessToken: parsedInput.provider.accessToken }
        : {}),
      ...(parsedInput.provider?.apiKey !== undefined
        ? { apiKey: parsedInput.provider.apiKey }
        : {}),
      ...(parsedInput.provider?.model !== undefined
        ? { model: parsedInput.provider.model }
        : {}),
      ...(parsedInput.provider?.relayBaseURL !== undefined
        ? {
            ...(parsedInput.provider.relayBaseURL.trim().length > 0
              ? { relayBaseURL: parsedInput.provider.relayBaseURL }
              : { relayBaseURL: undefined }),
          }
        : {}),
    },
    tts: {
      ...currentConfig.tts,
      ...parsedInput.tts,
    },
    presentation: {
      ...currentConfig.presentation,
      ...parsedInput.presentation,
    },
    subtitleQualityControls: {
      ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
      ...(currentConfig.subtitleQualityControls ?? {}),
      ...(parsedInput.subtitleQualityControls ?? {}),
    },
    sites: mergedSites,
    ...(parsedInput.customActions !== undefined
      ? { customActions: parsedInput.customActions }
      : {}),
  })

  await persistConfig(nextConfig)
  return nextConfig
}
