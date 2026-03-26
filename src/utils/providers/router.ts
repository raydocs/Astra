import { AstraError } from "@/types/translation"

import { translateWithGemini } from "./gemini"
import { translateWithOpenAI } from "./openai"
import { translateWithRelay } from "./relay"
import type { ConfiguredProvider, ProviderTranslationRequest } from "./types"

export async function translateWithProvider(
  provider: ConfiguredProvider,
  request: ProviderTranslationRequest,
): Promise<string[]> {
  const apiKey = provider.apiKey?.trim()
  const accessToken = provider.accessToken.trim()

  // Direct provider access when user has their own API key
  if (apiKey) {
    switch (provider.id) {
      case "openai":
        return translateWithOpenAI({
          apiKey,
          model: provider.model,
          ...request,
        })
      case "gemini":
        return translateWithGemini({
          apiKey,
          model: provider.model,
          ...request,
        })
    }
  }

  // Relay access via Astra-managed session
  if (!accessToken) {
    throw new AstraError(
      "CONFIG_MISSING",
      "No API key or Astra access token configured. Open Astra popup to configure your provider.",
    )
  }

  return translateWithRelay({
    providerId: provider.id,
    accessToken,
    relayBaseURL: provider.relayBaseURL,
    model: provider.model,
    ...request,
  })
}
