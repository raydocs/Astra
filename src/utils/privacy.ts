/**
 * Privacy filtering — sanitize translation context when privacy mode is enabled.
 */

import type { TranslationRequestContext } from "@/types/messages"

/** Patterns that indicate a sensitive input field (name, id, aria-label, placeholder) */
const SENSITIVE_INPUT_PATTERNS = [
  /password/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /expir/i,
  /ssn/i,
  /social.?security/i,
  /tax.?id/i,
  /passport/i,
  /bank.?account/i,
  /routing.?number/i,
  /secret/i,
  /token/i,
  /\bpin\b/i,
]

/** HTML autocomplete tokens that indicate sensitive fields */
const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set([
  "cc-name", "cc-number", "cc-exp", "cc-exp-month", "cc-exp-year",
  "cc-csc", "cc-type", "new-password", "current-password",
  "one-time-code",
])

/**
 * Check whether an input element appears to be a sensitive field
 * that should not be translated.
 */
export function isSensitiveInput(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : ""
  if (type === "password" || type === "hidden") return true

  // Check autocomplete attribute against known sensitive tokens
  const autocomplete = (element.getAttribute("autocomplete") ?? "").trim().toLowerCase()
  if (autocomplete && SENSITIVE_AUTOCOMPLETE_TOKENS.has(autocomplete)) return true

  const fieldsToCheck = [
    element.name,
    element.id,
    autocomplete,
    element.getAttribute("aria-label") ?? "",
    element.placeholder ?? "",
  ]

  return fieldsToCheck.some((field) =>
    SENSITIVE_INPUT_PATTERNS.some((pattern) => pattern.test(field)),
  )
}

function stripUrlSensitiveComponents(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url.split(/[?#]/, 1)[0] ?? url
  }
}

/**
 * Strip context fields that could leak private page content.
 * When privacy mode is enabled, only hostname and pageUrl path are preserved.
 */
export function sanitizeTranslationContext(
  context: TranslationRequestContext,
): TranslationRequestContext {
  return {
    ...(context.hostname ? { hostname: context.hostname } : {}),
    ...(context.pageUrl ? { pageUrl: stripUrlSensitiveComponents(context.pageUrl) } : {}),
    // Strip: pageTitle, metaDescription, contentSummary, selectionContext
  }
}

/**
 * Authoritative transport-boundary privacy enforcement for translation requests.
 *
 * Caller surfaces may still pre-sanitize earlier for local UI behavior, but the
 * background transport boundary must not rely on caller discipline alone.
 */
export function sanitizeTranslationContextForTransport(
  context: TranslationRequestContext | undefined,
  privacyMode: boolean,
): TranslationRequestContext | undefined {
  if (!context) return undefined
  return privacyMode ? sanitizeTranslationContext(context) : context
}
