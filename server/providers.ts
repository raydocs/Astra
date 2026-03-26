import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

import { AstraError } from "../src/types/translation"
import { buildTranslationPrompt, parseTranslationsResponse } from "../src/utils/providers/openai"
import type { ProviderId } from "../src/types/config"

import type { RelayEnv, RelayTranslateRequest } from "./types"

function systemPromptForTask(task: RelayTranslateRequest["task"]) {
  if (task === "custom") {
    return "You are a helpful AI assistant. Follow the user instructions precisely and return strict JSON."
  }

  if (task === "explain") {
    return "You are an expert bilingual reading coach. Explain source texts clearly and naturally while preserving nuance."
  }

  return "You are a professional translator. Preserve meaning, tone, and formatting while producing natural target-language output."
}

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

function getProviderApiKey(provider: ProviderId, env: RelayEnv): string {
  return provider === "openai" ? env.openaiApiKey : env.googleApiKey
}

export async function translateViaManagedProvider(
  request: RelayTranslateRequest,
  env: RelayEnv,
): Promise<string[]> {
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
