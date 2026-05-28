import { AstraError, type TranslationErrorCode } from "@/types/translation"
import { trackEvent } from "@/utils/telemetry"

import { translateWithGemini } from "./gemini"
import { translateWithGoogleTranslate } from "./google-translate"
import { translateWithOpenAI } from "./openai"
import { translateWithRelay } from "./relay"
import { summarizeProviderRoute, type ProviderTransport, type ProviderRoute, type ProviderFallbackReason } from "./routing-metadata"
import type { ConfiguredProvider, ProviderTranslationRequest } from "./types"

export type { ProviderTransport, ProviderRoute, ProviderFallbackReason } from "./routing-metadata"
export interface ProviderRoutingMetadata {
  attemptedTransports: ProviderTransport[]
  finalTransport: ProviderTransport | null
  fallbackUsed: boolean
  fallbackReason: ProviderFallbackReason
  route: ProviderRoute | null
}

export interface ProviderRoutingSuccessMetadata extends ProviderRoutingMetadata {
  finalTransport: ProviderTransport
  route: ProviderRoute
}

export interface ProviderTranslationResult {
  translations: string[]
  metadata: ProviderRoutingSuccessMetadata
}

export interface ProviderRouterDependencies {
  translateWithOpenAI: typeof translateWithOpenAI
  translateWithGemini: typeof translateWithGemini
  translateWithGoogleTranslate: typeof translateWithGoogleTranslate
  translateWithRelay: typeof translateWithRelay
}

export type ProviderFailurePolicy = "fallback-to-relay" | "fail-fast"

export const PROVIDER_FAILURE_POLICY: Record<TranslationErrorCode, ProviderFailurePolicy> = {
  CONFIG_MISSING: "fail-fast",
  CONTENT_UNAVAILABLE: "fail-fast",
  PROVIDER_REQUEST_FAILED: "fallback-to-relay",
  PROVIDER_PARSE_FAILED: "fail-fast",
  INVALID_RESPONSE: "fail-fast",
  SITE_DISABLED: "fail-fast",
  QUOTA_EXCEEDED: "fail-fast",
  UNKNOWN: "fail-fast",
}

const DEFAULT_ROUTER_DEPENDENCIES: ProviderRouterDependencies = {
  translateWithOpenAI,
  translateWithGemini,
  translateWithGoogleTranslate,
  translateWithRelay,
}

let currentRouterDependencies: ProviderRouterDependencies = DEFAULT_ROUTER_DEPENDENCIES

export function setProviderRouterDependenciesForTests(
  overrides: Partial<ProviderRouterDependencies>,
): void {
  currentRouterDependencies = {
    ...DEFAULT_ROUTER_DEPENDENCIES,
    ...overrides,
  }
}

export function resetProviderRouterDependenciesForTests(): void {
  currentRouterDependencies = DEFAULT_ROUTER_DEPENDENCIES
}

export class ProviderRoutingError extends AstraError {
  readonly metadata: ProviderRoutingMetadata

  constructor(code: TranslationErrorCode, message: string, metadata: ProviderRoutingMetadata) {
    super(code, message)
    this.name = "ProviderRoutingError"
    this.metadata = metadata
  }
}

function normalizeProviderCredentials(provider: ConfiguredProvider) {
  const apiKey = provider.apiKey.trim()
  const accessToken = provider.accessToken.trim()
  const relayBaseURL = provider.relayBaseURL?.trim()

  return {
    ...provider,
    apiKey,
    accessToken,
    ...(relayBaseURL ? { relayBaseURL } : {}),
  }
}

function hasDirectAccess(provider: ConfiguredProvider): boolean {
  return provider.apiKey.length > 0
}

function hasRelayAccess(provider: ConfiguredProvider): boolean {
  return provider.accessToken.length > 0 && (provider.relayBaseURL?.length ?? 0) > 0
}

const NETWORK_ERROR_PATTERNS = /\b(fetch|network|econnrefused|econnreset|enotfound|timeout|abort|socket|dns|tls|ssl|connect|epipe|ehostunreach|enetunreach)\b/i
const TIMEOUT_ERROR_PATTERNS = /\b(timeout|abort)\b/i

export function classifyProviderFallbackReason(error: unknown): ProviderFallbackReason {
  if (error instanceof AstraError) {
    if (error.code === "QUOTA_EXCEEDED") return "cost"
    if (error.code === "CONTENT_UNAVAILABLE") return "length"
    if (error.code === "PROVIDER_PARSE_FAILED" || error.code === "INVALID_RESPONSE") return "quality"
    if (error.code === "PROVIDER_REQUEST_FAILED") {
      return TIMEOUT_ERROR_PATTERNS.test(error.message) ? "timeout" : "outage"
    }
    return "unknown"
  }

  if (error instanceof Error) {
    if (TIMEOUT_ERROR_PATTERNS.test(error.message)) return "timeout"
    if (NETWORK_ERROR_PATTERNS.test(error.message)) return "outage"
  }

  return "unknown"
}

export function classifyProviderFailure(error: unknown): ProviderFailurePolicy {
  if (error instanceof AstraError) {
    return PROVIDER_FAILURE_POLICY[error.code]
  }

  if (error instanceof Error && NETWORK_ERROR_PATTERNS.test(error.message)) {
    return "fallback-to-relay"
  }

  return "fail-fast"
}

function metadataFor(
  attemptedTransports: ProviderTransport[],
  finalTransport: ProviderTransport | null,
  fallbackReason: ProviderFallbackReason = "none",
): ProviderRoutingMetadata {
  const route = summarizeProviderRoute(attemptedTransports, finalTransport)
  return {
    attemptedTransports: [...attemptedTransports],
    finalTransport,
    fallbackUsed: route === "fallback",
    fallbackReason,
    route,
  }
}

function wrapProviderRoutingError(
  error: unknown,
  attemptedTransports: ProviderTransport[],
  finalTransport: ProviderTransport | null,
): ProviderRoutingError {
  const metadata = metadataFor(attemptedTransports, finalTransport, classifyProviderFallbackReason(error))

  if (error instanceof ProviderRoutingError) {
    return error
  }

  if (error instanceof AstraError) {
    return new ProviderRoutingError(error.code, error.message, metadata)
  }

  return new ProviderRoutingError(
    "PROVIDER_REQUEST_FAILED",
    error instanceof Error ? error.message : "Provider routing failed.",
    metadata,
  )
}

export function getProviderRoutingMetadataFromError(error: unknown): ProviderRoutingMetadata | null {
  return error instanceof ProviderRoutingError ? error.metadata : null
}

async function translateDirect(
  provider: ConfiguredProvider,
  request: ProviderTranslationRequest,
  deps: ProviderRouterDependencies,
): Promise<string[]> {
  const apiKey = provider.apiKey

  switch (provider.id) {
    case "google_translate":
      return deps.translateWithGoogleTranslate({
        apiKey,
        model: provider.model,
        ...request,
      })
    case "openai":
      return deps.translateWithOpenAI({
        apiKey,
        model: provider.model,
        ...request,
      })
    case "gemini":
      return deps.translateWithGemini({
        apiKey,
        model: provider.model,
        ...request,
      })
  }
}

async function translateViaRelay(
  provider: ConfiguredProvider,
  request: ProviderTranslationRequest,
  deps: ProviderRouterDependencies,
): Promise<string[]> {
  return deps.translateWithRelay({
    providerId: provider.id,
    accessToken: provider.accessToken,
    relayBaseURL: provider.relayBaseURL,
    model: provider.model,
    ...request,
  })
}

export async function translateWithProviderDetailed(
  provider: ConfiguredProvider,
  request: ProviderTranslationRequest,
  deps: ProviderRouterDependencies = currentRouterDependencies,
): Promise<ProviderTranslationResult> {
  const normalizedProvider = normalizeProviderCredentials(provider)
  const directAvailable = hasDirectAccess(normalizedProvider)
  const relayAvailable = hasRelayAccess(normalizedProvider)
  const attemptedTransports: ProviderTransport[] = []
  let fallbackReason: ProviderFallbackReason = "none"

  if (directAvailable) {
    attemptedTransports.push("direct")
    try {
      const translations = await translateDirect(normalizedProvider, request, deps)
      return {
        translations,
        metadata: metadataFor(attemptedTransports, "direct") as ProviderRoutingSuccessMetadata,
      }
    } catch (error) {
      const failurePolicy = classifyProviderFailure(error)
      fallbackReason = classifyProviderFallbackReason(error)
      if (!relayAvailable || failurePolicy !== "fallback-to-relay") {
        const wrapped = wrapProviderRoutingError(error, attemptedTransports, null)
        trackEvent({
          type: "translation_error",
          data: {
            code: wrapped.code,
            message: wrapped.message,
            providerId: normalizedProvider.id,
            transport: "direct",
            attemptedTransports: [...attemptedTransports],
          },
        })
        throw wrapped
      }
    }
  }

  if (relayAvailable) {
    attemptedTransports.push("relay")
    try {
      const translations = await translateViaRelay(normalizedProvider, request, deps)
      return {
        translations,
        metadata: metadataFor(attemptedTransports, "relay", fallbackReason) as ProviderRoutingSuccessMetadata,
      }
    } catch (error) {
      const wrapped = wrapProviderRoutingError(error, attemptedTransports, "relay")
      trackEvent({
        type: "translation_error",
        data: {
          code: wrapped.code,
          message: wrapped.message,
          providerId: normalizedProvider.id,
          transport: "relay",
          attemptedTransports: [...attemptedTransports],
        },
      })
      throw wrapped
    }
  }

  const configError = new ProviderRoutingError(
    "CONFIG_MISSING",
    "Sign in to use Astra AI, or try again after Astra reconnects.",
    metadataFor(attemptedTransports, null),
  )
  trackEvent({
    type: "translation_error",
    data: {
      code: configError.code,
      message: configError.message,
      providerId: normalizedProvider.id,
      attemptedTransports: [...attemptedTransports],
    },
  })
  throw configError
}

export async function translateWithProvider(
  provider: ConfiguredProvider,
  request: ProviderTranslationRequest,
  deps: ProviderRouterDependencies = currentRouterDependencies,
): Promise<string[]> {
  const result = await translateWithProviderDetailed(provider, request, deps)
  return result.translations
}
