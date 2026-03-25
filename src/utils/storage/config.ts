import { browser } from "#imports"

import {
  AstraConfigInputSchema,
  AstraConfigSchema,
  DEFAULT_ASTRA_CONFIG,
  normalizeConfig,
  type AstraConfig,
  type AstraConfigInput,
} from "@/types/config"

export const ASTRA_CONFIG_STORAGE_KEY = "astra.config.v1"

const LEGACY_KEYS = ["apiKey", "baseURL", "model", "targetLang"] as const

function buildConfigFromUnknown(value: unknown): AstraConfig | null {
  const parsed = AstraConfigSchema.safeParse(value)
  if (!parsed.success) return null
  return normalizeConfig(parsed.data)
}

async function persistConfig(config: AstraConfig): Promise<void> {
  const normalized = normalizeConfig(config)

  await browser.storage.local.set({
    [ASTRA_CONFIG_STORAGE_KEY]: normalized,
    apiKey: normalized.provider.apiKey,
    baseURL: normalized.provider.baseURL ?? "",
    model: normalized.provider.model,
    targetLang: normalized.targetLang,
  })
}

export async function migrateLegacyConfig(): Promise<AstraConfig> {
  const legacy = await browser.storage.local.get([...LEGACY_KEYS])

  const config = normalizeConfig({
    ...DEFAULT_ASTRA_CONFIG,
    targetLang:
      typeof legacy.targetLang === "string" && legacy.targetLang.trim().length > 0
        ? legacy.targetLang
        : DEFAULT_ASTRA_CONFIG.targetLang,
    provider: {
      id: "openai",
      apiKey: typeof legacy.apiKey === "string" ? legacy.apiKey : "",
      model:
        typeof legacy.model === "string" && legacy.model.trim().length > 0
          ? legacy.model
          : DEFAULT_ASTRA_CONFIG.provider.model,
      ...(typeof legacy.baseURL === "string" && legacy.baseURL.trim().length > 0
        ? { baseURL: legacy.baseURL }
        : {}),
    },
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

export async function saveConfig(input: AstraConfigInput): Promise<AstraConfig> {
  const parsedInput = AstraConfigInputSchema.parse(input)
  const currentConfig = await readConfig()

  const nextConfig = normalizeConfig({
    ...currentConfig,
    ...(parsedInput.targetLang ? { targetLang: parsedInput.targetLang } : {}),
    provider: {
      ...currentConfig.provider,
      ...(parsedInput.provider?.apiKey !== undefined
        ? { apiKey: parsedInput.provider.apiKey }
        : {}),
      ...(parsedInput.provider?.model !== undefined
        ? { model: parsedInput.provider.model }
        : {}),
      ...(parsedInput.provider?.baseURL !== undefined
        ? {
            ...(parsedInput.provider.baseURL.trim().length > 0
              ? { baseURL: parsedInput.provider.baseURL }
              : { baseURL: undefined }),
          }
        : {}),
    },
  })

  await persistConfig(nextConfig)
  return nextConfig
}
