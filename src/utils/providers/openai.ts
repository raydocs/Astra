/**
 * OpenAI provider for AI translation using Vercel AI SDK.
 */

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { z } from "zod"

import { AstraError } from "@/types/translation"

import type { ProviderTranslationRequest } from "./types"

export interface TranslationOptions extends ProviderTranslationRequest {
  apiKey: string
  baseURL?: string
  model?: string
}

const ProviderResponseSchema = z.object({
  translations: z.array(z.string()),
})

function stripCodeFence(rawText: string): string {
  const trimmed = rawText.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : trimmed
}

function truncate(value: string | undefined, maxChars: number): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars).trim()}…` : trimmed
}

export function buildTranslationPrompt({
  texts,
  targetLang,
  sourceLang,
  context,
  task = "translate",
}: Pick<TranslationOptions, "texts" | "targetLang" | "sourceLang" | "context" | "task">): string {
  const sourceHint = sourceLang ? ` from ${sourceLang}` : ""
  const contextPayload = {
    pageTitle: truncate(context?.pageTitle, 200),
    pageUrl: truncate(context?.pageUrl, 300),
    hostname: truncate(context?.hostname, 120),
    metaDescription: truncate(context?.metaDescription, 300),
    contentSummary: truncate(context?.contentSummary, 800),
    selectionContext: truncate(context?.selectionContext, 400),
  }

  const hasContext = Object.values(contextPayload).some(Boolean)

  const instructions = task === "explain"
    ? [
        `Explain each input text${sourceHint} for a reader who wants to understand it in ${targetLang}.`,
        "Keep the explanation concise but useful: clarify meaning, implied context, tone, and any important vocabulary or phrasing.",
        "Use any provided page context only to disambiguate terminology, referents, and tone.",
        "Do not repeat the raw source text unless it is necessary for clarity.",
      ]
    : [
        `Translate each input text${sourceHint} to ${targetLang}.`,
        "Use any provided page context only to disambiguate terminology, referents, and tone.",
        "Do not translate the context itself unless it appears in the input texts.",
      ]

  return [
    ...instructions,
    `Return strict JSON only in this exact shape: {\"translations\":[\"...\"]}.`,
    `The \"translations\" array must contain exactly ${texts.length} strings in the same order as the input.`,
    "Do not include markdown, code fences, numbering, or any keys other than \"translations\".",
    ...(hasContext
      ? [`Context JSON: ${JSON.stringify(contextPayload)}`]
      : []),
    `Input JSON: ${JSON.stringify({ texts })}`,
  ].join("\n\n")
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
    context,
    task = "translate",
  } = options

  const openai = createOpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
  })

  const prompt = buildTranslationPrompt({
    texts,
    targetLang,
    sourceLang,
    context,
    task,
  })

  try {
    const { text } = await generateText({
      model: openai(model),
      system:
        task === "explain"
          ? "You are an expert bilingual reading coach. Explain source texts clearly and naturally for the target-language reader while preserving nuance and context."
          : "You are a professional translator. Preserve the meaning, tone, and formatting of each source text while producing natural target-language output.",
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
