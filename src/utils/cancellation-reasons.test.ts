import { describe, expect, it } from "vitest"

import {
  ASTRA_CANCELLATION_REASON_OPTIONS,
  buildAstraCancellationReasonSubmission,
  isAstraCancellationReason,
  normalizeAstraCancellationReason,
  normalizeAstraCancellationReasonSource,
} from "./cancellation-reasons"

describe("cancellation reasons", () => {
  it("keeps the plan-defined refund/cancellation reasons normalized", () => {
    expect(ASTRA_CANCELLATION_REASON_OPTIONS.map((option) => option.label)).toEqual([
      "Too expensive",
      "Didn’t use it",
      "Didn’t work on my sites",
      "Too slow",
      "Privacy concerns",
      "Expected different features",
      "Found another tool",
      "Temporary break",
      "Other",
    ])
    expect(ASTRA_CANCELLATION_REASON_OPTIONS.every((option) => option.productMeaning.length > 0)).toBe(true)
  })

  it("normalizes unknown cancellation reasons to other", () => {
    expect(isAstraCancellationReason("too_slow")).toBe(true)
    expect(isAstraCancellationReason("not-a-reason")).toBe(false)
    expect(normalizeAstraCancellationReason("privacy_concerns")).toBe("privacy_concerns")
    expect(normalizeAstraCancellationReason("not-a-reason")).toBe("other")
  })

  it("normalizes unknown cancellation reason sources to unknown", () => {
    expect(normalizeAstraCancellationReasonSource("refund_request")).toBe("refund_request")
    expect(normalizeAstraCancellationReasonSource("free_text_note")).toBe("unknown")
  })

  it("builds metadata-only cancellation reason submissions", () => {
    expect(buildAstraCancellationReasonSubmission({
      reason: "did_not_work_on_my_sites",
      plan: "trial",
      source: "billing_portal",
      submittedAt: "2026-05-27T12:00:00.000Z",
    })).toEqual({
      reason: "did_not_work_on_my_sites",
      plan: "trial",
      source: "billing_portal",
      submittedAt: "2026-05-27T12:00:00.000Z",
    })
  })
})
