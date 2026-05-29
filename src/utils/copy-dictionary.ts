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
  proValue: "Pro includes longer videos, deeper explanations, synced learning history, and unlimited review cards.",
  dailyFreeReached: "You’ve used today’s free reading. It refreshes tomorrow, or Pro keeps longer videos and deeper explanations going.",
  continueTomorrow: "You can continue tomorrow, or upgrade for longer reading.",
  proBusy: "Astra is processing a lot of long content. Some tasks may take longer.",
  canceledPlan: "Your saved learning items stay in your account. Pro features will pause after the current period.",
  welcomeBack: "Welcome back. Your learning history is still here.",
} as const

export type CopyDictionaryKey = keyof typeof COPY_DICTIONARY

// Membership / paywall copy that users read in their own language. Each key here
// has matching `_locales/{en,zh_CN}` entries; `localizedOrFallback` (defined
// below, hoisted) resolves the active-locale string and falls back to the
// English value above when extension i18n is unavailable (web app / unit tests).
// Keys NOT listed here stay English-only for now.
const COPY_DICTIONARY_MESSAGE_KEYS: Partial<Record<CopyDictionaryKey, string>> = {
  proValue: "copyProValue",
  dailyFreeReached: "copyDailyFreeReached",
  freeLimit: "copyFreeLimit",
  proLongContent: "copyProLongContent",
  continueTomorrow: "copyContinueTomorrow",
}

export function getUserCopy(key: CopyDictionaryKey): string {
  const messageKey = COPY_DICTIONARY_MESSAGE_KEYS[key]
  return messageKey ? localizedOrFallback(messageKey, COPY_DICTIONARY[key]) : COPY_DICTIONARY[key]
}

/**
 * Single source of truth for the user-facing service-mode ("Astra AI style")
 * labels. Ordinary users only ever see these human-intent words — never
 * provider, model, token, or the raw "serviceMode" enum. Localized via i18n
 * (en + zh); the English map below is also the fallback when i18n is
 * unavailable (e.g. unit tests / non-extension contexts). Surfaces (options,
 * popup controls, FloatBall) render via getServiceModeLabel, never hard-coded.
 */
export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  automatic: "Auto",
  fast: "Faster",
  balanced: "Balanced",
  best_quality: "Study mode",
}

const SERVICE_MODE_MESSAGE_KEYS: Record<ServiceMode, string> = {
  automatic: "serviceModeAutomatic",
  fast: "serviceModeFast",
  balanced: "serviceModeBalanced",
  best_quality: "serviceModeBestQuality",
}

// Localize via the extension i18n message table when available. Accessed through
// globalThis (not WXT's "#imports") so this module stays usable in the web app /
// unit tests, where there is no extension i18n and the English fallback is used.
export function localizedOrFallback(key: string, fallback: string): string {
  try {
    const i18n =
      (globalThis as { chrome?: { i18n?: { getMessage?: (name: string) => string } } }).chrome?.i18n
      ?? (globalThis as { browser?: { i18n?: { getMessage?: (name: string) => string } } }).browser?.i18n
    const localized = i18n?.getMessage?.(key) ?? ""
    return localized && localized !== key ? localized : fallback
  } catch {
    return fallback
  }
}

export function getServiceModeLabel(mode: ServiceMode): string {
  return localizedOrFallback(SERVICE_MODE_MESSAGE_KEYS[mode], SERVICE_MODE_LABELS[mode])
}

/** Reading layout the user sees on the FloatBall — human words, not enum values. */
export function getReadingModeLabel(mode: "bilingual" | "translation-only"): string {
  return mode === "bilingual"
    ? localizedOrFallback("floatBallModeBilingual", "Bilingual")
    : localizedOrFallback("floatBallModeTranslationOnly", "Translation only")
}

/** Page coverage label on the FloatBall — human words, not "contentScope". */
export function getContentScopeLabel(scope: "full_page" | string): string {
  return scope === "full_page"
    ? localizedOrFallback("floatBallScopeFullPage", "Full page")
    : localizedOrFallback("floatBallScopeImmersive", "Immersive")
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

  // A Free learner who has used an included monthly sample (deep reading / video
  // lesson) has already felt the value — frame the wall as the reason to go Pro,
  // never as a cold limit error. Server raises this as "<task> monthly allowance
  // exceeded for the <plan> plan." (user-store assertUsageCapacity).
  if (messageMatches(message, /monthly allowance/)) {
    return "proValue"
  }

  // Today's included reading is used up (daily Fair-Use ceiling: "Daily request /
  // character quota exceeded."). Human, refresh-tomorrow framing — kept distinct
  // from the per-minute rate limit, which should still read as "retry in a moment."
  if (messageMatches(message, /daily (request|character) quota|daily reading|today'?s free/)) {
    return "dailyFreeReached"
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
