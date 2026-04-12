/**
 * AI-assisted image description and translation.
 *
 * DISCLAIMER: This module does NOT perform real OCR. It sends the image URL
 * to an AI provider and asks it to describe any visible text. The provider
 * may hallucinate text that is not actually present, and the image URL is
 * transmitted to the remote provider, which may leak private/authenticated URLs.
 *
 * Uses the Astra translation pipeline with a custom prompt to describe
 * and translate text visible in images. Since we lack a dedicated OCR library,
 * we ask the AI provider to describe the image at a given URL.
 */

import { translateTexts } from "@/utils/translate/translate"

const MIN_DIMENSION = 100

/**
 * Feature flag for the AI-assisted image description feature.
 * Disabled by default because the current implementation sends only the
 * image URL (not pixel data) to the provider, which cannot reliably extract
 * text and may leak private URLs to the AI service.
 */
export function isOcrFeatureEnabled(): boolean {
  return false
}

/**
 * Check whether an image element is large enough to plausibly contain
 * translatable text (i.e. not a tiny icon or spacer).
 */
export function isTranslatableImage(element: HTMLImageElement): boolean {
  const width = element.naturalWidth || element.width
  const height = element.naturalHeight || element.height
  return width > MIN_DIMENSION && height > MIN_DIMENSION
}

/**
 * Describe and translate text from an image URL using the AI provider.
 *
 * NOTE: This is AI-assisted image description, not real OCR. The provider
 * receives only the URL string, not the actual image pixels, so it cannot
 * truly read text from the image. Results are best-effort and may be
 * inaccurate or fabricated.
 */
export async function extractTextFromImage(
  imageUrl: string,
  targetLang: string,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const systemPrompt = [
    "You are an AI assistant that describes visible text in images.",
    "The user will provide an image URL. Based on any context you can infer from the URL,",
    "describe what text might be visible in this image.",
    "IMPORTANT: You are receiving only a URL, not the actual image data.",
    "Be honest about uncertainty — only describe text you are reasonably confident about.",
    "Your job is to:",
    "1. Describe any visible text that might appear in this image at the given URL.",
    "2. Translate ALL described text into the target language.",
    "3. Return ONLY the translated text, preserving layout with line breaks where appropriate.",
    "If you cannot determine any text, reply with: [No text detected]",
  ].join("\n")

  const userText = [
    `Describe any visible text in this image at URL: ${imageUrl}`,
    `Target language: ${targetLang}`,
    "",
    "Please describe any visible text from this image and translate it.",
  ].join("\n")

  try {
    const result = await translateTexts({
      texts: [userText],
      targetLang,
      task: "custom",
      customSystemPrompt: systemPrompt,
    })

    if (!result.ok) {
      return { ok: false, message: result.error.message }
    }

    const text = result.translations[0]?.trim()
    if (!text) {
      return { ok: false, message: "Empty response from provider." }
    }

    return { ok: true, text }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Image text extraction failed.",
    }
  }
}
