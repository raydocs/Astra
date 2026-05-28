export const ASTRA_CANCELLATION_REASON_OPTIONS = [
  {
    value: "too_expensive",
    label: "Too expensive",
    productMeaning: "Pricing or value communication needs work.",
  },
  {
    value: "did_not_use_it",
    label: "Didn’t use it",
    productMeaning: "Activation or retention failed.",
  },
  {
    value: "did_not_work_on_my_sites",
    label: "Didn’t work on my sites",
    productMeaning: "Site coverage or support quality needs work.",
  },
  {
    value: "too_slow",
    label: "Too slow",
    productMeaning: "Routing or performance needs work.",
  },
  {
    value: "privacy_concerns",
    label: "Privacy concerns",
    productMeaning: "Trust, disclosure, or privacy controls need work.",
  },
  {
    value: "expected_different_features",
    label: "Expected different features",
    productMeaning: "Positioning or copy created a mismatch.",
  },
  {
    value: "found_another_tool",
    label: "Found another tool",
    productMeaning: "Competitive alternative won the workflow.",
  },
  {
    value: "temporary_break",
    label: "Temporary break",
    productMeaning: "Win-back or pause/resume opportunity.",
  },
  {
    value: "other",
    label: "Other",
    productMeaning: "Needs manual review.",
  },
] as const

export const ASTRA_CANCELLATION_REASON_VALUES = ASTRA_CANCELLATION_REASON_OPTIONS.map((option) => option.value)
export const ASTRA_CANCELLATION_REASON_SOURCE_VALUES = ["billing_portal", "refund_request", "settings", "support", "unknown"] as const

export type AstraCancellationReason = typeof ASTRA_CANCELLATION_REASON_OPTIONS[number]["value"]
export type AstraCancellationReasonSource = typeof ASTRA_CANCELLATION_REASON_SOURCE_VALUES[number]

export interface AstraCancellationReasonSubmission {
  reason: AstraCancellationReason
  plan: "free" | "trial" | "pro" | "unknown"
  source: AstraCancellationReasonSource
  submittedAt: string
}

const ASTRA_CANCELLATION_REASON_VALUE_SET = new Set<string>(ASTRA_CANCELLATION_REASON_VALUES)
const ASTRA_CANCELLATION_REASON_SOURCE_SET = new Set<string>(ASTRA_CANCELLATION_REASON_SOURCE_VALUES)

export function isAstraCancellationReason(value: unknown): value is AstraCancellationReason {
  return typeof value === "string" && ASTRA_CANCELLATION_REASON_VALUE_SET.has(value)
}

export function normalizeAstraCancellationReason(value: unknown): AstraCancellationReason {
  return isAstraCancellationReason(value) ? value : "other"
}

export function isAstraCancellationReasonSource(value: unknown): value is AstraCancellationReasonSource {
  return typeof value === "string" && ASTRA_CANCELLATION_REASON_SOURCE_SET.has(value)
}

export function normalizeAstraCancellationReasonSource(value: unknown): AstraCancellationReasonSource {
  return isAstraCancellationReasonSource(value) ? value : "unknown"
}

export function buildAstraCancellationReasonSubmission(input: {
  reason: unknown
  plan?: AstraCancellationReasonSubmission["plan"] | null
  source?: AstraCancellationReasonSubmission["source"] | null
  submittedAt?: Date | string | null
}): AstraCancellationReasonSubmission {
  const submittedAt = input.submittedAt instanceof Date
    ? input.submittedAt.toISOString()
    : typeof input.submittedAt === "string" && input.submittedAt.trim()
      ? new Date(input.submittedAt).toISOString()
      : new Date().toISOString()

  return {
    reason: normalizeAstraCancellationReason(input.reason),
    plan: input.plan ?? "unknown",
    source: normalizeAstraCancellationReasonSource(input.source),
    submittedAt,
  }
}
