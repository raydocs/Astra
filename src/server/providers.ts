import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

import { AstraError } from "../types/translation"
import type { ManagedProviderMetadata, ManagedProviderTranslationResult } from "./types"
import { WEB_AI_UNTRUSTED_CONTENT_RULE } from "../utils/ai-safety"
import { translateWithGoogleTranslate } from "../utils/providers/google-translate"
import { buildTranslationPrompt, parseTranslationsResponse } from "../utils/providers/openai"
import { getDefaultProviderModel, type ProviderId, type ServiceMode } from "../types/config"
import { resolveScheduledServiceMode } from "../utils/service-mode-scheduler"

import type { RelayEnv, RelayTranslateRequest, ResolvedRelayTranslateRequest } from "./types"
// ---------------------------------------------------------------------------
// OpenRouter model resolution — uses configurable map from RelayEnv
// ---------------------------------------------------------------------------

function chooseFirstEntitledProvider(
  entitlements: readonly ProviderId[],
  candidates: readonly ProviderId[],
  avoidProviders: readonly ProviderId[] = [],
): ProviderId {
  const avoid = new Set<ProviderId>(avoidProviders)
  for (const candidate of candidates) {
    if (entitlements.includes(candidate) && !avoid.has(candidate)) return candidate
  }
  return entitlements.find((provider) => !avoid.has(provider)) ?? entitlements[0] ?? "openai"
}

const DEFAULT_MANAGED_PROVIDER_ENTITLEMENTS = ["google_translate", "openai", "gemini"] as const satisfies readonly ProviderId[]
const EXPLANATION_PROVIDER_PRIORITY = ["openai", "gemini"] as const satisfies readonly ProviderId[]
const FAST_TRANSLATE_PROVIDER_PRIORITY = ["google_translate", "openai", "gemini"] as const satisfies readonly ProviderId[]
const BALANCED_TRANSLATE_PROVIDER_PRIORITY = ["openai", "gemini", "google_translate"] as const satisfies readonly ProviderId[]

export function resolveManagedProviderForServiceMode(params: {
  serviceMode: ServiceMode
  task?: RelayTranslateRequest["task"]
  entitlements?: ProviderId[]
  avoidProviders?: ProviderId[]
}): ProviderId {
  const entitlements: readonly ProviderId[] = params.entitlements?.length ? params.entitlements : DEFAULT_MANAGED_PROVIDER_ENTITLEMENTS
  const task = params.task ?? "translate"

  if (task !== "translate") {
    return chooseFirstEntitledProvider(entitlements, EXPLANATION_PROVIDER_PRIORITY, params.avoidProviders)
  }

  if (params.serviceMode === "fast") {
    return chooseFirstEntitledProvider(entitlements, FAST_TRANSLATE_PROVIDER_PRIORITY, params.avoidProviders)
  }

  return chooseFirstEntitledProvider(entitlements, BALANCED_TRANSLATE_PROVIDER_PRIORITY, params.avoidProviders)
}

export function resolveManagedProviderModel(params: {
  provider: ProviderId
  requestedModel?: string
  serviceMode?: ServiceMode
}): string {
  const requestedModel = params.requestedModel ?? getDefaultProviderModel(params.provider)
  if (params.provider === "google_translate") return requestedModel

  if (params.provider === "openai") {
    if (params.serviceMode === "fast") return "gpt-4.1-nano"
    if (params.serviceMode === "balanced") return "gpt-4.1-mini"
    return requestedModel
  }

  if (params.serviceMode === "fast") return "gemini-3.1-flash-lite-preview"
  if (params.serviceMode === "balanced") return "gemini-3.0-flash"
  return requestedModel
}

export function resolveManagedTranslationRequest(
  request: RelayTranslateRequest,
  options: { entitlements?: ProviderId[]; avoidProviders?: ProviderId[] } = {},
): ResolvedRelayTranslateRequest {
  const serviceMode = resolveScheduledServiceMode({
    requestedServiceMode: request.serviceMode ?? "automatic",
    texts: request.texts,
    context: request.context,
    task: request.task,
  }) ?? "automatic"
  const provider = request.provider ?? resolveManagedProviderForServiceMode({
    serviceMode,
    task: request.task,
    entitlements: options.entitlements,
    avoidProviders: options.avoidProviders,
  })
  const model = resolveManagedProviderModel({
    provider,
    requestedModel: request.model,
    serviceMode,
  })

  return {
    ...request,
    provider,
    serviceMode,
    model,
  }
}

function resolveOpenRouterModel(
  provider: ProviderId,
  model: string,
  modelMap: Record<string, string>,
): string {
  const key = `${provider}/${model}`
  if (modelMap[key]) return modelMap[key]
  if (provider === "openai") return `openai/${model}`
  if (provider === "gemini") return `google/${model}`
  return model
}

// ---------------------------------------------------------------------------
// Prompt / system message helpers
// ---------------------------------------------------------------------------

function systemPromptForTask(task: RelayTranslateRequest["task"], serviceMode: RelayTranslateRequest["serviceMode"]) {
  const serviceModeSuffix = serviceMode === "fast"
    ? " Use a fast, concise strategy."
    : serviceMode === "best_quality"
      ? " Use the available context carefully for terminology consistency and nuanced output."
      : serviceMode === "balanced"
        ? " Balance speed and quality."
        : " Choose the best speed/quality strategy automatically."

  if (task === "custom") {
    return `You are a helpful AI assistant. Follow the trusted task instructions and return strict JSON. ${WEB_AI_UNTRUSTED_CONTENT_RULE}${serviceModeSuffix}`
  }

  if (task === "explain") {
    return `You are an expert bilingual reading coach. Explain source texts clearly and naturally while preserving nuance, and honor any learner profile instructions in the user prompt. ${WEB_AI_UNTRUSTED_CONTENT_RULE}${serviceModeSuffix}`
  }

  return `You are a professional translator. Preserve meaning, tone, and formatting while producing natural target-language output. ${WEB_AI_UNTRUSTED_CONTENT_RULE}${serviceModeSuffix}`
}

// ---------------------------------------------------------------------------
// Direct provider execution (original path)
// ---------------------------------------------------------------------------

async function generateWithProvider(params: {
  provider: ProviderId
  model: string
  apiKey: string
  request: ResolvedRelayTranslateRequest
}): Promise<string> {
  if (params.provider === "google_translate") {
    const translations = await translateWithGoogleTranslate({
      apiKey: params.apiKey,
      model: params.model,
      texts: params.request.texts,
      targetLang: params.request.targetLang,
      sourceLang: params.request.sourceLang,
    })
    return JSON.stringify({ translations })
  }

  const prompt = buildTranslationPrompt(params.request)
  const system = systemPromptForTask(params.request.task, params.request.serviceMode)

  if (params.provider === "openai") {
    const openai = createOpenAI({ apiKey: params.apiKey })
    const { text } = await generateText({
      model: openai(params.model),
      system,
      prompt,
    })
    return text
  }

  const google = createGoogleGenerativeAI({ apiKey: params.apiKey })
  const { text } = await generateText({
    model: google(params.model),
    system,
    prompt,
  })
  return text
}

// ---------------------------------------------------------------------------
// OpenRouter execution — all models via single OpenRouter API key
// ---------------------------------------------------------------------------

async function generateViaOpenRouter(params: {
  provider: ProviderId
  model: string
  apiKey: string
  request: ResolvedRelayTranslateRequest
  modelMap: Record<string, string>
}): Promise<string> {
  const prompt = buildTranslationPrompt(params.request)
  const system = systemPromptForTask(params.request.task, params.request.serviceMode)
  const routerModel = resolveOpenRouterModel(params.provider, params.model, params.modelMap)

  // OpenRouter uses the OpenAI-compatible API format
  const openrouter = createOpenAI({
    apiKey: params.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  })

  const { text } = await generateText({
    model: openrouter(routerModel),
    system,
    prompt,
  })

  return text
}

// ---------------------------------------------------------------------------
// Provider API key resolution
// ---------------------------------------------------------------------------

function getProviderApiKey(provider: ProviderId, env: RelayEnv): string {
  switch (provider) {
    case "google_translate":
      return env.googleTranslateApiKey ?? ""
    case "openai":
      return env.openaiApiKey
    case "gemini":
      return env.googleApiKey
  }
}

function getMissingApiKeyMessage(provider: ProviderId): string {
  switch (provider) {
    case "google_translate":
      return "GOOGLE_TRANSLATE_API_KEY is not configured on the Astra relay."
    case "openai":
      return "OPENAI_API_KEY is not configured on the Astra relay."
    case "gemini":
      return "GOOGLE_GENERATIVE_AI_API_KEY is not configured on the Astra relay."
  }
}

// ---------------------------------------------------------------------------
// Public API — relay translation entry point
// ---------------------------------------------------------------------------

function buildManagedProviderMetadata(params: {
  request: ResolvedRelayTranslateRequest
  route: ManagedProviderMetadata["route"]
}): ManagedProviderMetadata {
  return {
    provider: params.request.provider,
    model: params.request.model,
    serviceMode: params.request.serviceMode ?? "automatic",
    route: params.route,
    attemptedRoutes: [params.route],
    finalRoute: params.route,
    fallbackUsed: false,
    fallbackReason: "none",
  }
}

export async function translateViaManagedProviderDetailed(
  request: RelayTranslateRequest,
  env: RelayEnv,
): Promise<ManagedProviderTranslationResult> {
  const scheduledRequest = resolveManagedTranslationRequest(request)

  // Route through OpenRouter when configured (API key stays server-side only)
  if (env.useOpenRouter && env.openrouterApiKey && scheduledRequest.provider !== "google_translate") {
    const rawText = await generateViaOpenRouter({
      provider: scheduledRequest.provider,
      model: scheduledRequest.model,
      apiKey: env.openrouterApiKey,
      request: scheduledRequest,
      modelMap: env.openrouterModelMap,
    })
    return {
      translations: parseTranslationsResponse(rawText, scheduledRequest.texts.length),
      metadata: buildManagedProviderMetadata({ request: scheduledRequest, route: "openrouter" }),
    }
  }

  // Direct provider path (original behavior)
  const apiKey = getProviderApiKey(scheduledRequest.provider, env)
  if (!apiKey) {
    throw new AstraError(
      "CONFIG_MISSING",
      getMissingApiKeyMessage(scheduledRequest.provider),
    )
  }

  const rawText = await generateWithProvider({
    provider: scheduledRequest.provider,
    model: scheduledRequest.model,
    apiKey,
    request: scheduledRequest,
  })

  return {
    translations: parseTranslationsResponse(rawText, scheduledRequest.texts.length),
    metadata: buildManagedProviderMetadata({ request: scheduledRequest, route: "direct" }),
  }
}

export async function translateViaManagedProvider(
  request: RelayTranslateRequest,
  env: RelayEnv,
): Promise<string[]> {
  const result = await translateViaManagedProviderDetailed(request, env)
  return result.translations
}
