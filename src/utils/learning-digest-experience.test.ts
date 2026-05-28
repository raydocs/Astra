import { describe, expect, it } from "vitest"

import {
  ASTRA_DIGEST_CONTENT_ITEMS,
  ASTRA_DIGEST_COPY_EXAMPLES,
  ASTRA_DIGEST_SURFACES,
  evaluateAstraDigestReadiness,
  type AstraDigestReadinessEvidence,
} from "./learning-digest-experience"

const readyEvidence: AstraDigestReadinessEvidence = {
  showsLongTermLearningValue: true,
  weeklyContentCoversRequiredItems: true,
  includesReviewAndContinueActions: true,
  deliveryIsLowInterruption: true,
  emailAndNotificationAreOptionalAndControlled: true,
  digestCopyExamplesRepresented: true,
  summariesAvoidRawContentByDefault: true,
  privacyModeRestrictsExternalDelivery: true,
}

describe("Astra Learning Digest experience contract", () => {
  it("defines weekly digest content coverage", () => {
    expect(ASTRA_DIGEST_CONTENT_ITEMS.map((item) => item.id)).toEqual([
      "pages_read_this_week",
      "videos_watched_this_week",
      "new_saved_words_sentences",
      "reviewed_cards",
      "common_topics",
      "repeated_vocabulary",
      "recommended_review",
      "recommended_continue",
    ])
    expect(ASTRA_DIGEST_CONTENT_ITEMS.every((item) => item.privacyBoundary.length > 20)).toBe(true)
    expect(ASTRA_DIGEST_CONTENT_ITEMS.find((item) => item.id === "recommended_review")?.privacyBoundary).toContain("due-card counts")
  })

  it("keeps digest delivery low interruption by default", () => {
    expect(ASTRA_DIGEST_SURFACES.map((surface) => surface.id)).toEqual([
      "popup_card",
      "web_companion_page",
      "optional_email",
      "optional_notification",
    ])
    expect(ASTRA_DIGEST_SURFACES.filter((surface) => surface.launchTiming === "now").map((surface) => surface.id)).toEqual([
      "popup_card",
      "web_companion_page",
    ])
    expect(ASTRA_DIGEST_SURFACES.filter((surface) => surface.launchTiming === "later_optional").every((surface) => surface.controlRequirement.includes("Requires"))).toBe(true)
  })

  it("preserves the macro-plan digest copy examples with safe allowed data", () => {
    expect(ASTRA_DIGEST_COPY_EXAMPLES.map((example) => example.copy)).toEqual([
      "You learned 12 expressions from 3 pages this week.",
      "5 cards are ready for a quick review.",
      "You kept seeing “resilience” across two articles.",
      "Continue your YouTube lesson from 08:32.",
    ])
    expect(ASTRA_DIGEST_COPY_EXAMPLES.find((example) => example.id === "continue_video_timestamp")?.allowedData).toContain("timestamp")
  })

  it("passes readiness when digest is useful, actionable, low-interruption, and privacy-safe", () => {
    const decision = evaluateAstraDigestReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when digest value, coverage, actions, delivery controls, or privacy boundaries are missing", () => {
    const decision = evaluateAstraDigestReadiness({
      ...readyEvidence,
      showsLongTermLearningValue: false,
      weeklyContentCoversRequiredItems: false,
      includesReviewAndContinueActions: false,
      deliveryIsLowInterruption: false,
      emailAndNotificationAreOptionalAndControlled: false,
      summariesAvoidRawContentByDefault: false,
      privacyModeRestrictsExternalDelivery: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "long_term_value_visible",
      "weekly_content_coverage",
      "review_and_continue_actions",
      "low_interrupt_delivery",
      "optional_email_notification_controls",
      "privacy_safe_summary",
      "privacy_mode_channel_boundary",
    ])
  })

  it("warns, without blocking, when macro copy examples are not represented", () => {
    const decision = evaluateAstraDigestReadiness({
      ...readyEvidence,
      digestCopyExamplesRepresented: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual(["example_copy_present"])
  })
})
