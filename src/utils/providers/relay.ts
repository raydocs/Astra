import { z } from "zod"

import { AstraError } from "@/types/translation"
import type { ProviderId } from "@/types/config"

import type { ProviderTranslationRequest } from "./types"

export interface RelayTranslationOptions extends ProviderTranslationRequest {
  providerId: ProviderId
  accessToken: string
  relayBaseURL?: string
  model: string
}

const RelayResponseSchema = z.object({
  translations: z.array(z.string()),
})

function buildRelayUrl(relayBaseURL: string): string {
  const trimmed = relayBaseURL.trim().replace(/\/+$/, "")
  return `${trimmed}/translate`
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string }
    const message = data.error?.message ?? data.message
    if (typeof message === "string" && message.trim().length > 0) {
      return message
    }
  } catch {
    // Fall through to text parsing.
  }

  try {
    const text = await response.text()
    if (text.trim().length > 0) {
      return text.trim()
    }
  } catch {
    // Ignore body parsing failures.
  }

  return `Astra relay request failed with status ${response.status}.`
}

export async function translateWithRelay(
  options: RelayTranslationOptions,
): Promise<string[]> {
  const {
    providerId,
    accessToken,
    relayBaseURL,
    model,
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
  } = options

  const endpoint = relayBaseURL?.trim()
  if (!endpoint) {
    throw new AstraError(
      "CONFIG_MISSING",
      "No Astra relay URL configured. Open Astra popup to set your Astra API base URL.",
    )
  }

  try {
    const response = await fetch(buildRelayUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        provider: providerId,
        model,
        texts,
        targetLang,
        ...(sourceLang ? { sourceLang } : {}),
        ...(context ? { context } : {}),
        ...(task ? { task } : {}),
        ...(customSystemPrompt ? { customSystemPrompt } : {}),
        ...(languageLevel ? { languageLevel } : {}),
        ...(explainMode ? { explainMode } : {}),
        ...(explanationRepairInstruction ? { explanationRepairInstruction } : {}),
        ...(placeholderFormat ? { placeholderFormat } : {}),
      }),
    })

    if (!response.ok) {
      throw new AstraError(
        "PROVIDER_REQUEST_FAILED",
        await readErrorMessage(response),
      )
    }

    const parsed = RelayResponseSchema.safeParse(await response.json())
    if (!parsed.success) {
      throw new AstraError(
        "PROVIDER_PARSE_FAILED",
        "Astra relay returned an invalid response shape.",
      )
    }

    if (parsed.data.translations.length !== texts.length) {
      throw new AstraError(
        "PROVIDER_PARSE_FAILED",
        `Astra relay returned ${parsed.data.translations.length} translations for ${texts.length} inputs.`,
      )
    }

    return parsed.data.translations.map((item) => item.trim())
  } catch (error) {
    if (error instanceof AstraError) {
      throw error
    }

    throw new AstraError(
      "PROVIDER_REQUEST_FAILED",
      error instanceof Error ? error.message : "Astra relay translation request failed.",
    )
  }
}
