import { describe, expect, it } from "vitest"

import { buildAstraGrowthLandingUrl, buildReferralInvite, buildSentenceShareCard } from "./sentence-card"

describe("sentence-card growth sharing", () => {
  it("builds a trackable sentence-card landing URL without source URLs", () => {
    const card = buildSentenceShareCard({
      sentence: "To inhabit a difficult sentence, you have to be willing to sit with it.",
      translation: "要真正进入一句难懂的话，你必须愿意在它面前停留。",
      sourceTitle: "Astra Sample Lesson: The Quiet Architecture of Reading",
      landingBaseUrl: "https://astra.example/start?existing=1",
    })

    expect(card.payload.url).toBe("https://astra.example/start?existing=1&utm_source=sentence_card&utm_medium=share&utm_campaign=first_90_growth_mvp&share=sentence")
    expect(card.payload.text).toContain("Astra sentence card")
    expect(card.payload.text).toContain("Shared from Astra")
    expect(card.telemetry).toEqual({
      source: "sample_lesson",
      surface: "sample_lesson",
      shareType: "sentence_card",
      landingSource: "sentence_card",
      contentOrigin: "sample_lesson",
      contentLengthBucket: "short",
      hasSourceTitle: true,
    })

    const serializedTelemetry = JSON.stringify(card.telemetry)
    expect(serializedTelemetry).not.toContain("http")
    expect(serializedTelemetry).not.toContain("To inhabit")
    expect(serializedTelemetry).not.toContain("要真正进入")
    expect(serializedTelemetry).not.toContain("articleExcerpt")
    expect(serializedTelemetry).not.toContain("contentSummary")
  })

  it("marks user-selected sentence cards as metadata-only user content", () => {
    const longSentence = `${"A learner-selected sentence can be useful without exposing page URLs. ".repeat(6)}tail`
    const card = buildSentenceShareCard({
      sentence: longSentence,
      translation: `${"这是一段用户选择的内容。".repeat(20)}`,
      sourceTitle: "Private Article Title That Is Optional",
      contentOrigin: "user_selected",
    })

    expect(card.payload.text).toContain("Astra sentence card")
    expect(card.payload.text).toContain("…")
    expect(card.payload.text).not.toContain("tail")
    expect(card.telemetry).toEqual(expect.objectContaining({
      contentOrigin: "user_selected",
      contentLengthBucket: "long",
      hasSourceTitle: true,
    }))
    expect(JSON.stringify(card.telemetry)).not.toContain("learner-selected")
    expect(JSON.stringify(card.telemetry)).not.toContain("Private Article")
  })

  it("builds a non-rewarding referral invite for abuse-safe MVP tracking", () => {
    const invite = buildReferralInvite({ landingBaseUrl: "https://astra.example/", trigger: "sample_review_complete" })

    expect(invite.payload.url).toBe("https://astra.example/?utm_source=referral&utm_medium=invite&utm_campaign=first_90_growth_mvp&referral=non_rewarding")
    expect(invite.payload.text).toContain("Try Astra on a sample page")
    expect(invite.telemetry).toEqual({
      schema: "astra-referral-readiness.v1",
      source: "sample_lesson",
      surface: "sample_lesson",
      referralType: "non_rewarding",
      landingSource: "referral",
      rewardAvailable: false,
      sampleContentOnly: true,
      trigger: "sample_review_complete",
    })
  })

  it("keeps growth landing params explicit", () => {
    expect(buildAstraGrowthLandingUrl({ source: "sentence_card", medium: "share", share: "sentence" }))
      .toBe("https://astra.so/?utm_source=sentence_card&utm_medium=share&utm_campaign=first_90_growth_mvp&share=sentence")
  })

  it("sanitizes campaign values in growth URLs and referral telemetry", () => {
    const invite = buildReferralInvite({ campaign: "../checkout?plan=pro&email=a@b.test" })

    expect(invite.payload.url).toBe("https://astra.so/?utm_source=referral&utm_medium=invite&utm_campaign=first_90_growth_mvp&referral=non_rewarding")
    expect(invite.telemetry).not.toHaveProperty("campaign")
  })
})
