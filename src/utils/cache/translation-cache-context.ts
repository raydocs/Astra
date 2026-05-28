import type { AstraConfig } from "@/types/config"
import type {
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"

export interface TranslationCacheContext {
  providerId?: string
  model?: string
  connectionMode?: string
  serviceMode?: string
  routingKey?: string
  languageLevel?: string
  sourceLang?: string
  requestContextKey?: string
}

export function isTranslationCacheable(
  task: TranslationTask = "translate",
  customSystemPrompt?: string,
  placeholderFormat?: TranslationPlaceholderFormat,
): boolean {
  return task === "translate" && !customSystemPrompt && !placeholderFormat
}

export function serializeTranslationRequestContext(
  context?: TranslationRequestContext,
): string {
  return JSON.stringify({
    pageTitle: context?.pageTitle?.trim() || "",
    pageUrl: context?.pageUrl?.trim() || "",
    hostname: context?.hostname?.trim() || "",
    metaDescription: context?.metaDescription?.trim() || "",
    contentSummary: context?.contentSummary?.trim() || "",
    selectionContext: context?.selectionContext?.trim() || "",
    terminologyGlossary: context?.terminologyGlossary?.trim() || "",
    explanationGlossary: context?.explanationGlossary?.trim() || "",
    translationMemory: context?.translationMemory?.trim() || "",
  })
}

export function buildTranslationCacheContext(
  config: Pick<AstraConfig, "provider" | "connectionMode" | "languageLevel" | "serviceMode">,
  request: {
    sourceLang?: string
    context?: TranslationRequestContext
    serviceMode?: string
  },
): TranslationCacheContext {
  const relayBaseURL = config.provider.relayBaseURL?.trim()

  return {
    providerId: config.provider.id,
    model: config.provider.model,
    connectionMode: config.connectionMode,
    serviceMode: request.serviceMode ?? config.serviceMode,
    routingKey: config.connectionMode === "astra"
      ? "astra"
      : relayBaseURL && relayBaseURL.length > 0
        ? relayBaseURL
        : "custom",
    languageLevel: config.languageLevel,
    sourceLang: request.sourceLang,
    requestContextKey: serializeTranslationRequestContext(request.context),
  }
}
