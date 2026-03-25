import { z } from "zod"

export const ProviderIdSchema = z.literal("openai")

export const OpenAIProviderConfigSchema = z.object({
  id: ProviderIdSchema.default("openai"),
  apiKey: z.string().default(""),
  baseURL: z.string().optional(),
  model: z.string().trim().min(1).default("gpt-4o-mini"),
})

export const AstraConfigSchema = z.object({
  version: z.literal(1).default(1),
  targetLang: z.string().trim().min(1).default("zh-CN"),
  provider: OpenAIProviderConfigSchema.default({
    id: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  }),
})

export const AstraConfigInputSchema = z.object({
  targetLang: z.string().trim().min(1).optional(),
  provider: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    model: z.string().trim().min(1).optional(),
  }).optional(),
})

export type ProviderId = z.infer<typeof ProviderIdSchema>
export type OpenAIProviderConfig = z.infer<typeof OpenAIProviderConfigSchema>
export type AstraConfig = z.infer<typeof AstraConfigSchema>
export type AstraConfigInput = z.infer<typeof AstraConfigInputSchema>

export const DEFAULT_ASTRA_CONFIG: AstraConfig = {
  version: 1,
  targetLang: "zh-CN",
  provider: {
    id: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
  },
}

export function normalizeConfig(config: AstraConfig): AstraConfig {
  const baseURL = config.provider.baseURL?.trim()

  return {
    version: 1,
    targetLang: config.targetLang.trim() || DEFAULT_ASTRA_CONFIG.targetLang,
    provider: {
      id: "openai",
      apiKey: config.provider.apiKey.trim(),
      model: config.provider.model.trim() || DEFAULT_ASTRA_CONFIG.provider.model,
      ...(baseURL ? { baseURL } : {}),
    },
  }
}
