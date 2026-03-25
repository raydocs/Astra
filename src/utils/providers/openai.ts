/**
 * OpenAI provider for AI translation using Vercel AI SDK.
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { z } from "zod"

import { AstraError } from "@/types/translation"

export interface TranslationOptions {
  apiKey: string
  baseURL?: string
  model?: string
  texts: string[]
  targetLang: string
  sourceLang?: string
}

const ProviderResponseSchema = z.object({
  translations: z.array(z.string()),
})

function stripCodeFence(rawText: string): string {
  const trimmed = rawText.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

export function parseTranslationsResponse(
  rawText: string,
  expectedCount: number,
): string[] {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(stripCodeFence(rawText))
  } catch {
    throw new AstraError(
      "PROVIDER_PARSE_FAILED",
      "Translation provider returned invalid JSON.",
    )
  }

  const parsed = ProviderResponseSchema.safeParse(parsedJson)
  if (!parsed.success) {
    throw new AstraError(
      "PROVIDER_PARSE_FAILED",
      "Translation provider returned an invalid response shape.",
    )
  }

  const translations = parsed.data.translations.map((item) => item.trim())
  if (translations.length !== expectedCount) {
    throw new AstraError(
      "PROVIDER_PARSE_FAILED",
      `Translation provider returned ${translations.length} translations for ${expectedCount} inputs.`,
    )
  }

  return translations
}

export async function translateWithOpenAI(
  options: TranslationOptions,
): Promise<string[]> {
  const {
    apiKey,
    baseURL,
    model = "gpt-4o-mini",
    texts,
    targetLang,
    sourceLang,
  } = options

  const openai = createOpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
  })

  const sourceHint = sourceLang ? ` from ${sourceLang}` : ""
  const prompt = [
    `Translate each input text${sourceHint} to ${targetLang}.`,
    `Return strict JSON only in this exact shape: {"translations":["..."]}.`,
    `The "translations" array must contain exactly ${texts.length} strings in the same order as the input.`,
    "Do not include markdown, code fences, numbering, or explanations.",
    `Input JSON: ${JSON.stringify({ texts })}`,
  ].join("\n\n")

  try {
    const { text } = await generateText({
      model: openai(model),
      system:
        "You are a professional translator. Preserve the meaning, tone, and formatting of each source text while producing natural target-language output.",
      prompt,
    })

    return parseTranslationsResponse(text, texts.length)
  } catch (error) {
    if (error instanceof AstraError) {
      throw error
    }

    throw new AstraError(
      "PROVIDER_REQUEST_FAILED",
      error instanceof Error ? error.message : "OpenAI translation request failed.",
    )
  }
}
