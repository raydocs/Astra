import { z } from "zod"

import { AstraError } from "@/types/translation"

import type { ProviderTranslationRequest } from "./types"

export interface GoogleTranslateOptions extends ProviderTranslationRequest {
  apiKey: string
  model?: string
}

const GoogleTranslateResponseSchema = z.object({
  data: z.object({
    translations: z.array(z.object({
      translatedText: z.string(),
      detectedSourceLanguage: z.string().optional(),
      model: z.string().optional(),
    })),
  }),
})

function buildGoogleTranslateUrl(apiKey: string): string {
  const url = new URL("https://translation.googleapis.com/language/translate/v2")
  url.searchParams.set("key", apiKey)
  return url.toString()
}

function normalizeLanguageCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

async function readGoogleTranslateError(response: Response): Promise<string> {
  try {
    const body = await response.json() as {
      error?: { message?: string; status?: string }
    }
    const message = body.error?.message?.trim()
    if (message) return message
  } catch {
    // fall through to status text
  }

  return response.statusText || "Google Translate request failed."
}

export async function translateWithGoogleTranslate(options: GoogleTranslateOptions): Promise<string[]> {
  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    throw new AstraError("CONFIG_MISSING", "GOOGLE_TRANSLATE_API_KEY is not configured.")
  }

  const target = normalizeLanguageCode(options.targetLang)
  if (!target) {
    throw new AstraError("CONFIG_MISSING", "Target language is required for Google Translate.")
  }

  const texts = options.texts.map((text) => text ?? "")
  if (texts.length === 0) return []

  const body: Record<string, unknown> = {
    q: texts,
    target,
    format: "text",
    model: options.model?.trim() || "nmt",
  }
  const source = normalizeLanguageCode(options.sourceLang)
  if (source) body.source = source

  const response = await fetch(buildGoogleTranslateUrl(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", await readGoogleTranslateError(response))
  }

  const payload = await response.json()
  const parsed = GoogleTranslateResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AstraError("PROVIDER_PARSE_FAILED", "Google Translate returned an invalid response.")
  }

  const translations = parsed.data.data.translations.map((item) => item.translatedText.trim())
  if (translations.length !== texts.length) {
    throw new AstraError("INVALID_RESPONSE", `Expected ${texts.length} translations, received ${translations.length}.`)
  }

  return translations
}
