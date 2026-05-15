/**
 * Static provider capability & pricing registry.
 * Used in options diagnostics and cost estimation.
 */

import type { ProviderId } from "@/types/config"

export interface ProviderCapability {
  id: ProviderId
  name: string
  models: ProviderModelInfo[]
  supportsDirectAccess: boolean
  supportsRelay: boolean
  maxBatchSize: number
  maxInputCharsPerRequest: number
}

export interface ProviderModelInfo {
  id: string
  label: string
  inputCostPer1kTokens: number  // USD
  outputCostPer1kTokens: number // USD
  maxContextTokens: number
  recommended: boolean
}

export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability> = {
  google_translate: {
    id: "google_translate",
    name: "Google Translate",
    models: [
      {
        id: "nmt",
        label: "Cloud Translation Basic NMT",
        inputCostPer1kTokens: 0.0,
        outputCostPer1kTokens: 0.0,
        maxContextTokens: 30000,
        recommended: true,
      },
    ],
    supportsDirectAccess: true,
    supportsRelay: true,
    maxBatchSize: 20,
    maxInputCharsPerRequest: 8000,
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    models: [
      {
        id: "gpt-5.4-nano",
        label: "GPT-5.4 Nano",
        inputCostPer1kTokens: 0.0001,
        outputCostPer1kTokens: 0.0004,
        maxContextTokens: 1000000,
        recommended: true,
      },
      {
        id: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        inputCostPer1kTokens: 0.0004,
        outputCostPer1kTokens: 0.0016,
        maxContextTokens: 1000000,
        recommended: false,
      },
      {
        id: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        inputCostPer1kTokens: 0.0001,
        outputCostPer1kTokens: 0.0004,
        maxContextTokens: 1000000,
        recommended: false,
      },
    ],
    supportsDirectAccess: true,
    supportsRelay: true,
    maxBatchSize: 20,
    maxInputCharsPerRequest: 8000,
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    models: [
      {
        id: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite",
        inputCostPer1kTokens: 0.0,
        outputCostPer1kTokens: 0.0,
        maxContextTokens: 1000000,
        recommended: true,
      },
      {
        id: "gemini-3.0-flash",
        label: "Gemini 3.0 Flash",
        inputCostPer1kTokens: 0.00001,
        outputCostPer1kTokens: 0.00004,
        maxContextTokens: 1000000,
        recommended: false,
      },
    ],
    supportsDirectAccess: true,
    supportsRelay: true,
    maxBatchSize: 20,
    maxInputCharsPerRequest: 10000,
  },
}

export function getProviderCapability(providerId: ProviderId): ProviderCapability {
  return PROVIDER_CAPABILITIES[providerId]
}

export function getModelInfo(providerId: ProviderId, modelId: string): ProviderModelInfo | null {
  const provider = PROVIDER_CAPABILITIES[providerId]
  return provider?.models.find((m) => m.id === modelId) ?? null
}

export function estimateCost(
  providerId: ProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = getModelInfo(providerId, modelId)
  if (!model) return 0
  return (inputTokens / 1000) * model.inputCostPer1kTokens
    + (outputTokens / 1000) * model.outputCostPer1kTokens
}

export type ProviderHealthStatus = "connected" | "partial" | "disconnected"

export interface ProviderDiagnostics {
  providerId: ProviderId
  providerName: string
  status: ProviderHealthStatus
  directAccess: boolean
  relayAccess: boolean
  model: string
  modelLabel: string | null
  estimatedCostPerPage: string
}

export function diagnoseProvider(config: {
  providerId: ProviderId
  model: string
  apiKey: string
  accessToken: string
  relayBaseURL?: string
}): ProviderDiagnostics {
  const capability = PROVIDER_CAPABILITIES[config.providerId]
  const modelInfo = getModelInfo(config.providerId, config.model)
  const hasApiKey = config.apiKey.trim().length > 0
  const hasRelay = config.accessToken.trim().length > 0
    && (config.relayBaseURL?.trim().length ?? 0) > 0

  let status: ProviderHealthStatus = "disconnected"
  if (hasApiKey && hasRelay) status = "connected"
  else if (hasApiKey || hasRelay) status = "partial"

  // Estimate cost for a typical 2000-word page
  const typicalInputTokens = 2000
  const typicalOutputTokens = 2500
  const cost = estimateCost(config.providerId, config.model, typicalInputTokens, typicalOutputTokens)

  return {
    providerId: config.providerId,
    providerName: capability.name,
    status,
    directAccess: hasApiKey,
    relayAccess: hasRelay,
    model: config.model,
    modelLabel: modelInfo?.label ?? null,
    estimatedCostPerPage: cost > 0 ? `~$${cost.toFixed(4)}` : "Free",
  }
}
