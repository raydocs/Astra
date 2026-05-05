import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

import { AstraError } from "../src/types/translation"
import { buildTranslationPrompt, parseTranslationsResponse } from "../src/utils/providers/openai"
import type { ProviderId } from "../src/types/config"

import type { RelayEnv, RelayTranslateRequest } from "./types"

// ---------------------------------------------------------------------------
// OpenRouter model resolution — uses configurable map from RelayEnv
// ---------------------------------------------------------------------------

function resolveOpenRouterModel(
  provider: ProviderId,
  model: string,
  modelMap: Record<string, string>,
): string {
  const key = `${provider}/${model}`
  return modelMap[key] ?? `${provider === "openai" ? "openai" : "google"}/${model}`
}

// ---------------------------------------------------------------------------
// Prompt / system message helpers
// ---------------------------------------------------------------------------

function systemPromptForTask(task: RelayTranslateRequest["task"]) {
  if (task === "custom") {
    return "You are a helpful AI assistant. Follow the user instructions precisely and return strict JSON."
  }

  if (task === "explain") {
    return "You are an expert bilingual reading coach. Explain source texts clearly and naturally while preserving nuance, and honor any learner profile instructions in the user prompt."
  }

  return "You are a professional translator. Preserve meaning, tone, and formatting while producing natural target-language output."
}

// ---------------------------------------------------------------------------
// Direct provider execution (original path)
// ---------------------------------------------------------------------------

async function generateWithProvider(params: {
  provider: ProviderId
  model: string
  apiKey: string
  request: RelayTranslateRequest
}): Promise<string> {
  const prompt = buildTranslationPrompt(params.request)
  const system = systemPromptForTask(params.request.task)

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
  request: RelayTranslateRequest
  modelMap: Record<string, string>
}): Promise<string> {
  const prompt = buildTranslationPrompt(params.request)
  const system = systemPromptForTask(params.request.task)
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
  return provider === "openai" ? env.openaiApiKey : env.googleApiKey
}

// ---------------------------------------------------------------------------
// Public API — relay translation entry point
// ---------------------------------------------------------------------------

export async function translateViaManagedProvider(
  request: RelayTranslateRequest,
  env: RelayEnv,
): Promise<string[]> {
  // Route through OpenRouter when configured (API key stays server-side only)
  if (env.useOpenRouter && env.openrouterApiKey) {
    const rawText = await generateViaOpenRouter({
      provider: request.provider,
      model: request.model,
      apiKey: env.openrouterApiKey,
      request,
      modelMap: env.openrouterModelMap,
    })
    return parseTranslationsResponse(rawText, request.texts.length)
  }

  // Direct provider path (original behavior)
  const apiKey = getProviderApiKey(request.provider, env)
  if (!apiKey) {
    throw new AstraError(
      "CONFIG_MISSING",
      request.provider === "openai"
        ? "OPENAI_API_KEY is not configured on the Astra relay."
        : "GOOGLE_GENERATIVE_AI_API_KEY is not configured on the Astra relay.",
    )
  }

  const rawText = await generateWithProvider({
    provider: request.provider,
    model: request.model,
    apiKey,
    request,
  })

  return parseTranslationsResponse(rawText, request.texts.length)
}
