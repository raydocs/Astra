import { AstraError } from "@/types/translation"

import { translateWithOpenAI } from "./openai"
import type { ConfiguredProvider, ProviderTranslationRequest } from "./types"

export async function translateWithProvider(
  provider: ConfiguredProvider,
  request: ProviderTranslationRequest,
): Promise<string[]> {
  const apiKey = provider.apiKey.trim()
  if (!apiKey) {
    throw new AstraError(
      "CONFIG_MISSING",
      "No API key configured. Open Astra popup to set your OpenAI API key.",
    )
  }

  switch (provider.id) {
    case "openai":
      return translateWithOpenAI({
        apiKey,
        baseURL: provider.baseURL,
        model: provider.model,
        ...request,
      })
    default: {
      const unsupportedProvider: never = provider.id
      throw new AstraError(
        "INVALID_RESPONSE",
        `Unsupported provider: ${String(unsupportedProvider)}`,
      )
    }
  }
}
