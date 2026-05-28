import type { ServiceMode } from "@/types/config"
import type { TranslationError, TranslationErrorCode } from "@/types/translation"

export const FORBIDDEN_USER_COPY_TERMS = [
  "provider",
  "model",
  "api key",
  "token",
  "quota",
  "quotas",
  "upstream",
  "relay",
  "prompt",
  "rate limit",
  "rate limits",
  "browser.permissions",
  "browser api",
  "browser apis",
  "activetab",
  "host access",
  "host permission",
  "host permissions",
  "broad host access",
  "optional host",
  "manifest",
  "runtime policy",
  "runtime revoke",
] as const

export type ForbiddenUserCopyTerm = (typeof FORBIDDEN_USER_COPY_TERMS)[number]

export const COPY_DICTIONARY = {
  aiReady: "Astra AI is ready.",
  signInAstraAi: "Sign in to use Astra AI",
  membershipReconnecting: "Your membership is active. Astra is reconnecting.",
  astraTemporarilyBusy: "Astra is temporarily busy. Retry in a moment.",
  pageProtectedTrySelection: "This page is protected. Try selection translation or Deep Read.",
  fasterMode: "Faster understanding",
  bestQuality: "Best for long or technical content",
  longContent: "This is long. Astra will process it in parts.",
  freeLimit: "You’ve used today’s free long-content experience.",
  retry: "Try again",
  stableMode: "Astra switched to a more stable mode.",
  savedResult: "Using a saved result.",
  syncIssue: "Your learning record is saved on this device for now.",
  supportPrivacy: "We’ll include technical details, not your page text.",
  proLongContent: "Longer videos and deeper explanations are included with Pro.",
  continueTomorrow: "You can continue tomorrow, or upgrade for longer reading.",
  proBusy: "Astra is processing a lot of long content. Some tasks may take longer.",
  canceledPlan: "Your saved learning items stay in your account. Pro features will pause after the current period.",
  welcomeBack: "Welcome back. Your learning history is still here.",
} as const

export type CopyDictionaryKey = keyof typeof COPY_DICTIONARY

export function getUserCopy(key: CopyDictionaryKey): string {
  return COPY_DICTIONARY[key]
}

/**
 * Single source of truth for the user-facing service-mode (Astra AI style)
 * labels. Ordinary users only ever see these human words — never provider,
 * model, or token language. Surfaces (options, popup controls, FloatBall) must
 * render labels via getServiceModeLabel rather than hard-coding strings.
 */
export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  automatic: "Automatic",
  fast: "Fast",
  balanced: "Balanced",
  best_quality: "Best quality",
}

export function getServiceModeLabel(mode: ServiceMode): string {
  return SERVICE_MODE_LABELS[mode]
}

export function findForbiddenUserCopyTerms(copy: string): ForbiddenUserCopyTerm[] {
  const normalized = copy.toLocaleLowerCase()
  return FORBIDDEN_USER_COPY_TERMS.filter((term) => normalized.includes(term))
}

export function assertUserCopyIsPlain(copy: string): string {
  const terms = findForbiddenUserCopyTerms(copy)
  if (terms.length > 0) {
    throw new Error(`User copy contains restricted technical language: ${terms.join(", ")}`)
  }
  return copy
}

type AiUnavailableCopyInput = Partial<Pick<TranslationError, "code" | "message">> | null | undefined

export interface SafeAiUnavailableCopyOptions {
  siteEnabled?: boolean
  fallbackCopy?: string
}

function messageMatches(message: string, pattern: RegExp): boolean {
  return pattern.test(message.toLocaleLowerCase())
}

function classifyMessage(message: string): CopyDictionaryKey | null {
  if (!message.trim()) return null

  if (messageMatches(message, /api key|access token|not configured|missing key|sign in|signed in|authentication|unauthenticated|unauthorized/)) {
    return "signInAstraAi"
  }

  if (messageMatches(message, /protected|permission|access revoked|content unavailable|site disabled|cannot run on this page|unsupported page/)) {
    return "pageProtectedTrySelection"
  }

  if (messageMatches(message, /relay|network|fetch|timeout|timed out|abort|connection|reconnect/)) {
    return "membershipReconnecting"
  }

  if (messageMatches(message, /provider|model|upstream|rate limit|quota|token limit|too many|busy|unavailable|incomplete|invalid response|empty response/)) {
    return "astraTemporarilyBusy"
  }

  return null
}

export function getSafeAiUnavailableCopy(
  error?: AiUnavailableCopyInput,
  options: SafeAiUnavailableCopyOptions = {},
): string {
  if (options.siteEnabled === false) {
    return getUserCopy("pageProtectedTrySelection")
  }

  const code = error?.code as TranslationErrorCode | undefined
  const message = error?.message ?? ""
  const messageClassification = classifyMessage(message)

  if (code === "CONFIG_MISSING") {
    return getUserCopy("signInAstraAi")
  }

  if (code === "CONTENT_UNAVAILABLE" || code === "SITE_DISABLED") {
    return getUserCopy("pageProtectedTrySelection")
  }

  if (messageClassification) {
    return getUserCopy(messageClassification)
  }

  if (options.fallbackCopy && findForbiddenUserCopyTerms(options.fallbackCopy).length === 0) {
    return options.fallbackCopy
  }

  if (code === "PROVIDER_REQUEST_FAILED") {
    return getUserCopy("membershipReconnecting")
  }

  if (
    code === "PROVIDER_PARSE_FAILED"
    || code === "INVALID_RESPONSE"
    || code === "QUOTA_EXCEEDED"
    || code === "UNKNOWN"
  ) {
    return getUserCopy("astraTemporarilyBusy")
  }

  return getUserCopy("astraTemporarilyBusy")
}
