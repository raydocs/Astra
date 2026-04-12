import { AstraError, type TranslationErrorCode } from "@/types/translation"
import {
  ProviderRoutingError,
  translateWithProviderDetailed,
} from "@/utils/providers/router"

import { evaluateProviderRouting, type ProviderRoutingExecution } from "../evaluators/provider-routing"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const FAIL_FAST_PROVIDER_ROUTING_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/utils/providers/router.ts",
    "src/entrypoints/background/index.ts",
    "src/types/messages.ts",
  ],
  suspectedSymbols: [
    "translateWithProviderDetailed",
    "classifyProviderFailure",
    "getProviderRoutingMetadataFromError",
  ],
  suspectedKeywords: [
    "provider fallback",
    "fail-fast",
    "metadata",
  ],
  risk: "cross-module",
}

const PROVIDER_ROUTING_HINTS: Record<string, ScenarioCodeHint> = {
  "provider-routing/direct-failure-falls-back-to-relay": {
    suspectedFiles: [
      "src/utils/providers/router.ts",
      "src/entrypoints/background/index.ts",
      "src/types/messages.ts",
      "src/types/config.ts",
    ],
    suspectedSymbols: [
      "translateWithProviderDetailed",
      "translateWithProvider",
      "getProviderRoutingMetadataFromError",
      "handleTranslate",
    ],
    suspectedKeywords: [
      "provider fallback",
      "relay",
      "apiKey",
      "transport",
      "metadata",
    ],
    risk: "cross-module",
  },
  "provider-routing/parse-failure-fails-fast": {
    suspectedFiles: [
      "src/utils/providers/router.ts",
      "src/entrypoints/background/index.ts",
      "src/types/messages.ts",
      "src/types/config.ts",
    ],
    suspectedSymbols: [
      "translateWithProviderDetailed",
      "classifyProviderFailure",
      "getProviderRoutingMetadataFromError",
      "handleTranslate",
    ],
    suspectedKeywords: [
      "provider fallback",
      "parse failure",
      "fail-fast",
      "transport",
      "metadata",
    ],
    risk: "cross-module",
  },
  "provider-routing/non-fallback-error-fails-fast": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: [
      "provider fallback",
      "fail-fast",
      "quota",
      "metadata",
    ],
  },
  "provider-routing/config-error-fails-fast": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: [
      "provider fallback",
      "fail-fast",
      "config missing",
      "metadata",
    ],
  },
  "provider-routing/content-unavailable-fails-fast": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: ["provider fallback", "fail-fast", "content unavailable", "metadata"],
  },
  "provider-routing/invalid-response-fails-fast": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: ["provider fallback", "fail-fast", "invalid response", "metadata"],
  },
  "provider-routing/site-disabled-fails-fast": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: ["provider fallback", "fail-fast", "site disabled", "metadata"],
  },
  "provider-routing/unknown-astra-error-fails-fast": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: ["provider fallback", "fail-fast", "unknown", "metadata"],
  },
  "provider-routing/non-astra-error-fails-fast-as-provider-request-failed": {
    ...FAIL_FAST_PROVIDER_ROUTING_HINT,
    suspectedKeywords: ["provider fallback", "plain error", "provider request failed", "metadata"],
  },
  "provider-routing/fallback-exhaustion-surfaces-relay-terminal-error": {
    suspectedFiles: [
      "src/utils/providers/router.ts",
      "src/entrypoints/background/index.ts",
      "src/types/messages.ts",
      "src/types/config.ts",
    ],
    suspectedSymbols: [
      "translateWithProviderDetailed",
      "classifyProviderFailure",
      "getProviderRoutingMetadataFromError",
      "handleTranslate",
    ],
    suspectedKeywords: [
      "provider fallback",
      "relay terminal error",
      "attemptedTransports",
      "metadata",
    ],
    risk: "cross-module",
  },
}

async function executeProviderRoutingScenario(options: {
  directFailure: AstraError
  relayResult?: string[]
  relayFailure?: AstraError
}) {
  let directAttemptCount = 0
  let relayAttemptCount = 0
  let relayRequest: ProviderRoutingExecution["relayRequest"] = null

  try {
    const result = await translateWithProviderDetailed(
      {
        id: "openai",
        apiKey: "  openai-key  ",
        accessToken: "  astra-token  ",
        relayBaseURL: " https://astra.example/v1/ ",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
        context: { pageTitle: "Provider fallback bench" },
        placeholderFormat: "astra-rich-text-v1",
        languageLevel: "advanced",
      },
      {
        translateWithOpenAI: async () => {
          directAttemptCount += 1
          throw options.directFailure
        },
        translateWithGemini: async () => {
          directAttemptCount += 1
          throw new AstraError("PROVIDER_REQUEST_FAILED", "unexpected gemini path")
        },
        translateWithRelay: async (request) => {
          relayAttemptCount += 1
          relayRequest = {
            texts: request.texts,
            targetLang: request.targetLang,
            ...(request.task ? { task: request.task } : {}),
            ...(request.context ? { context: request.context as Record<string, unknown> } : {}),
            ...(request.placeholderFormat ? { placeholderFormat: request.placeholderFormat } : {}),
            ...(request.languageLevel ? { languageLevel: request.languageLevel } : {}),
          }
          if (options.relayFailure) {
            throw options.relayFailure
          }
          return options.relayResult ?? ["RELAY:hello"]
        },
      },
    )

    return {
      directAttemptCount,
      relayAttemptCount,
      fallbackUsed: result.metadata.fallbackUsed,
      finalTransport: result.metadata.finalTransport,
      attemptedTransports: result.metadata.attemptedTransports,
      translations: result.translations,
      errorCode: null,
      relayRequest,
    } satisfies ProviderRoutingExecution
  } catch (error) {
    if (!(error instanceof ProviderRoutingError)) {
      throw error
    }

    return {
      directAttemptCount,
      relayAttemptCount,
      fallbackUsed: error.metadata.fallbackUsed,
      finalTransport: error.metadata.finalTransport,
      attemptedTransports: error.metadata.attemptedTransports,
      translations: [],
      errorCode: error.code,
      relayRequest,
    } satisfies ProviderRoutingExecution
  }
}

const FAIL_FAST_PROVIDER_ROUTING_SCENARIOS: Array<{
  id: string
  title: string
  fixture: string
  errorCode: TranslationErrorCode
  message: string
  task: string
}> = [
  {
    id: "provider-routing/non-fallback-error-fails-fast",
    title: "Non-fallback-eligible provider error fails fast without touching relay",
    fixture: "provider-routing-fail-fast",
    errorCode: "QUOTA_EXCEEDED",
    message: "quota exhausted",
    task: "Verify that a non-fallback-eligible direct provider error does not trigger relay and still preserves routing metadata.",
  },
  {
    id: "provider-routing/config-error-fails-fast",
    title: "Config-related direct provider errors fail fast without relay fallback",
    fixture: "provider-routing-config-fail-fast",
    errorCode: "CONFIG_MISSING",
    message: "direct config missing",
    task: "Verify that config-related direct provider errors fail fast and preserve direct-only routing metadata.",
  },
  {
    id: "provider-routing/content-unavailable-fails-fast",
    title: "Content-unavailable provider errors fail fast without relay fallback",
    fixture: "provider-routing-content-unavailable-fail-fast",
    errorCode: "CONTENT_UNAVAILABLE",
    message: "content unavailable",
    task: "Verify that content-unavailable direct provider errors fail fast and preserve direct-only routing metadata.",
  },
  {
    id: "provider-routing/invalid-response-fails-fast",
    title: "Invalid-response provider errors fail fast without relay fallback",
    fixture: "provider-routing-invalid-response-fail-fast",
    errorCode: "INVALID_RESPONSE",
    message: "invalid response",
    task: "Verify that invalid-response direct provider errors fail fast and preserve direct-only routing metadata.",
  },
  {
    id: "provider-routing/site-disabled-fails-fast",
    title: "Site-disabled provider errors fail fast without relay fallback",
    fixture: "provider-routing-site-disabled-fail-fast",
    errorCode: "SITE_DISABLED",
    message: "site disabled",
    task: "Verify that site-disabled direct provider errors fail fast and preserve direct-only routing metadata.",
  },
  {
    id: "provider-routing/unknown-astra-error-fails-fast",
    title: "Explicit UNKNOWN AstraError inputs fail fast without relay fallback",
    fixture: "provider-routing-unknown-astra-fail-fast",
    errorCode: "UNKNOWN",
    message: "unknown error",
    task: "Verify that explicit AstraError(UNKNOWN) inputs fail fast and preserve direct-only routing metadata.",
  },
]

const NON_ASTRA_ERROR_PROVIDER_ROUTING_SCENARIO: BenchmarkScenario<ProviderRoutingExecution> = {
  id: "provider-routing/non-astra-error-fails-fast-as-provider-request-failed",
  title: "Plain non-AstraError failures fail fast and surface as PROVIDER_REQUEST_FAILED",
  surface: "provider-routing",
  fixture: "provider-routing-plain-error-fail-fast",
  task: "Verify that unexpected non-AstraError direct failures fail fast, do not touch relay, and are wrapped as PROVIDER_REQUEST_FAILED with direct-only metadata.",
  codeHint: PROVIDER_ROUTING_HINTS["provider-routing/non-astra-error-fails-fast-as-provider-request-failed"],
  run: async () => {
    let directAttemptCount = 0
    let relayAttemptCount = 0

    try {
      await translateWithProviderDetailed(
        {
          id: "openai",
          apiKey: "  openai-key  ",
          accessToken: "  astra-token  ",
          relayBaseURL: " https://astra.example/v1/ ",
          model: "gpt-5.4-nano",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
          task: "translate",
          context: { pageTitle: "Provider fallback bench" },
          placeholderFormat: "astra-rich-text-v1",
          languageLevel: "advanced",
        },
        {
          translateWithOpenAI: async () => {
            directAttemptCount += 1
            throw new Error("socket hung up")
          },
          translateWithGemini: async () => {
            directAttemptCount += 1
            throw new AstraError("PROVIDER_REQUEST_FAILED", "unexpected gemini path")
          },
          translateWithRelay: async () => {
            relayAttemptCount += 1
            return ["RELAY:hello"]
          },
        },
      )
      throw new Error("Expected provider routing to fail fast for non-AstraError input.")
    } catch (error) {
      if (!(error instanceof ProviderRoutingError)) {
        throw error
      }

      return {
        directAttemptCount,
        relayAttemptCount,
        fallbackUsed: error.metadata.fallbackUsed,
        finalTransport: error.metadata.finalTransport,
        attemptedTransports: error.metadata.attemptedTransports,
        translations: [],
        errorCode: error.code,
        relayRequest: null,
      } satisfies ProviderRoutingExecution
    }
  },
  evaluate: (execution) => evaluateProviderRouting(execution, {
    shouldFallback: false,
    expectedFinalTransport: null,
    expectedErrorCode: "PROVIDER_REQUEST_FAILED",
  }),
}

export const providerRoutingScenarios: BenchmarkScenario<ProviderRoutingExecution>[] = [
  {
    id: "provider-routing/direct-failure-falls-back-to-relay",
    title: "Direct provider failure falls back to relay without dropping request metadata",
    surface: "provider-routing",
    fixture: "provider-routing-fallback",
    task: "Verify that a direct provider transport failure falls back to relay and preserves request fields.",
    codeHint: PROVIDER_ROUTING_HINTS["provider-routing/direct-failure-falls-back-to-relay"],
    run: async () => executeProviderRoutingScenario({
      directFailure: new AstraError("PROVIDER_REQUEST_FAILED", "direct provider unavailable"),
      relayResult: ["RELAY:hello"],
    }),
    evaluate: (execution) => evaluateProviderRouting(execution, {
      shouldFallback: true,
      expectedFinalTransport: "relay",
      expectedErrorCode: null,
    }),
  },
  {
    id: "provider-routing/parse-failure-fails-fast",
    title: "Direct parse failures fail fast without relay fallback",
    surface: "provider-routing",
    fixture: "provider-routing-parse-fail-fast",
    task: "Verify that direct provider parse failures fail fast, preserve direct-only routing metadata, and do not mask adapter defects behind relay.",
    codeHint: PROVIDER_ROUTING_HINTS["provider-routing/parse-failure-fails-fast"],
    run: async () => executeProviderRoutingScenario({
      directFailure: new AstraError("PROVIDER_PARSE_FAILED", "malformed direct payload"),
    }),
    evaluate: (execution) => evaluateProviderRouting(execution, {
      shouldFallback: false,
      expectedFinalTransport: null,
      expectedErrorCode: "PROVIDER_PARSE_FAILED",
    }),
  },
  ...FAIL_FAST_PROVIDER_ROUTING_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    surface: "provider-routing",
    fixture: scenario.fixture,
    task: scenario.task,
    codeHint: PROVIDER_ROUTING_HINTS[scenario.id] ?? FAIL_FAST_PROVIDER_ROUTING_HINT,
    run: async () => executeProviderRoutingScenario({
      directFailure: new AstraError(scenario.errorCode, scenario.message),
    }),
    evaluate: (execution: ProviderRoutingExecution) => evaluateProviderRouting(execution, {
      shouldFallback: false,
      expectedFinalTransport: null,
      expectedErrorCode: scenario.errorCode,
    }),
  } satisfies BenchmarkScenario<ProviderRoutingExecution>)),
  NON_ASTRA_ERROR_PROVIDER_ROUTING_SCENARIO,
  {
    id: "provider-routing/fallback-exhaustion-surfaces-relay-terminal-error",
    title: "Fallback exhaustion preserves relay terminal error metadata",
    surface: "provider-routing",
    fixture: "provider-routing-fallback-exhaustion",
    task: "Verify that when direct fails with a fallback-eligible error and relay also fails, the terminal relay error and attempted transport chain are preserved.",
    codeHint: PROVIDER_ROUTING_HINTS["provider-routing/fallback-exhaustion-surfaces-relay-terminal-error"],
    run: async () => executeProviderRoutingScenario({
      directFailure: new AstraError("PROVIDER_REQUEST_FAILED", "direct provider unavailable"),
      relayFailure: new AstraError("PROVIDER_REQUEST_FAILED", "relay provider unavailable"),
    }),
    evaluate: (execution) => evaluateProviderRouting(execution, {
      shouldFallback: true,
      expectedFinalTransport: "relay",
      expectedErrorCode: "PROVIDER_REQUEST_FAILED",
      expectRelaySuccess: false,
    }),
  },
]
