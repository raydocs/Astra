/**
 * Gemini provider for AI translation using Vercel AI SDK.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

import { AstraError } from "@/types/translation"
import { WEB_AI_UNTRUSTED_CONTENT_RULE } from "@/utils/ai-safety"
import { buildTranslationPrompt, parseTranslationsResponse } from "./openai"
import type { ProviderTranslationRequest } from "./types"

export interface GeminiTranslationOptions extends ProviderTranslationRequest {
  apiKey: string
  model?: string
}

export async function translateWithGemini(
  options: GeminiTranslationOptions,
): Promise<string[]> {
  const {
    apiKey,
    model = "gemini-2.0-flash",
    texts,
    targetLang,
    sourceLang,
    context,
    task = "translate",
    customSystemPrompt,
    languageLevel,
    explainMode,
    explanationRepairInstruction,
    placeholderFormat,
  } = options

  const google = createGoogleGenerativeAI({ apiKey })

  const prompt = buildTranslationPrompt({
    texts,
    targetLang,
    sourceLang,
    context,
    task,
    customSystemPrompt,
    languageLevel,
    explainMode,
    explanationRepairInstruction,
    placeholderFormat,
  })

  const systemMessage = task === "custom" && customSystemPrompt
    ? `You are a helpful AI assistant. Follow the trusted task instructions and return the result in the requested JSON format. ${WEB_AI_UNTRUSTED_CONTENT_RULE}`
    : task === "explain"
      ? `You are an expert bilingual reading coach. Explain source texts clearly and naturally for the target-language reader while preserving nuance and context. ${WEB_AI_UNTRUSTED_CONTENT_RULE}`
      : `You are a professional translator. Preserve the meaning, tone, and formatting of each source text while producing natural target-language output. ${WEB_AI_UNTRUSTED_CONTENT_RULE}`

  try {
    const { text } = await generateText({
      model: google(model),
      system: systemMessage,
      prompt,
    })

    return parseTranslationsResponse(text, texts.length)
  } catch (error) {
    if (error instanceof AstraError) {
      throw error
    }

    throw new AstraError(
      "PROVIDER_REQUEST_FAILED",
      error instanceof Error ? error.message : "Gemini translation request failed.",
    )
  }
}
