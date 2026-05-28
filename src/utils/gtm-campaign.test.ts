import { describe, expect, it } from "vitest"

import {
  ASTRA_GTM_CAMPAIGNS,
  ASTRA_GTM_COPY_DECK,
  ASTRA_GTM_DEMO_SCRIPTS,
  ASTRA_GTM_FIRST_VERSION_CHANNELS,
  detectGrowthCopyTechnicalTerms,
  evaluateAstraGtmReadiness,
  type AstraGtmReadinessEvidence,
} from "./gtm-campaign"

const readyEvidence: AstraGtmReadinessEvidence = {
  firstFourChannelsReady: true,
  demoScriptsUnder60Seconds: true,
  demoScriptsShowLearningLoop: true,
  growthCopyHasNoTechnicalTerms: true,
  promotedCapabilitiesReleaseGated: true,
  storeScreenshotsLearningLoopCount: 5,
  shareCardsHaveWatermark: true,
  referralRewardsDisabledUntilAbuseControls: true,
}

describe("Astra GTM campaign contract", () => {
  it("defines the first-version GTM channels and defers risky referral rewards", () => {
    expect(ASTRA_GTM_FIRST_VERSION_CHANNELS.filter((channel) => channel.firstVersion).map((channel) => channel.id)).toEqual([
      "chrome_web_store",
      "landing_page",
      "youtube_bilibili_short_demo",
      "share_card",
    ])
    expect(ASTRA_GTM_FIRST_VERSION_CHANNELS.find((channel) => channel.id === "referral")?.boundary)
      .toContain("No Pro-day reward promise")
  })

  it("ships five scenario-led campaigns and five sub-60-second demo scripts", () => {
    expect(ASTRA_GTM_CAMPAIGNS.map((campaign) => campaign.id)).toEqual([
      "read_one_article_keep_five_expressions",
      "watch_youtube_as_language_lesson",
      "no_api_keys_no_setup",
      "three_minutes_review_real_content",
      "your_learning_trail",
    ])
    expect(ASTRA_GTM_DEMO_SCRIPTS).toHaveLength(5)
    for (const script of ASTRA_GTM_DEMO_SCRIPTS) {
      expect(script.estimatedSeconds).toBeLessThanOrEqual(60)
      expect(script.steps.join(" ").toLowerCase()).toMatch(/save|review/)
      expect(script.releaseGateRequired).toBeTruthy()
    }
  })

  it("ships landing, store, social, and share-card copy without internal technical terms", () => {
    expect(ASTRA_GTM_COPY_DECK.landingHero.headline).toBe("Read anything. Learn what matters.")
    expect(ASTRA_GTM_COPY_DECK.socialPosts).toHaveLength(10)
    expect(ASTRA_GTM_COPY_DECK.shareCardTemplates.every((template) => template.watermark.toLowerCase().includes("astra"))).toBe(true)

    const userFacingCopy = [
      ASTRA_GTM_COPY_DECK.landingHero.headline,
      ASTRA_GTM_COPY_DECK.landingHero.subheadline,
      ASTRA_GTM_COPY_DECK.landingHero.primaryCta,
      ASTRA_GTM_COPY_DECK.storeListing.title,
      ASTRA_GTM_COPY_DECK.storeListing.shortDescription,
      ASTRA_GTM_COPY_DECK.storeListing.longDescriptionLead,
      ...ASTRA_GTM_COPY_DECK.socialPosts.map((post) => post.copy),
      ...ASTRA_GTM_COPY_DECK.shareCardTemplates.map((template) => `${template.front} ${template.back} ${template.watermark}`),
    ].join("\n")

    expect(detectGrowthCopyTechnicalTerms(userFacingCopy)).toEqual([])
    expect(detectGrowthCopyTechnicalTerms("Configure your OpenAI provider API key and relay token.")).toEqual([
      "provider",
      "api key",
      "openai",
      "relay",
      "token",
    ])
  })

  it("passes GTM readiness when first-version channels, learning-loop demos, release gates, and brand boundaries are evidenced", () => {
    const decision = evaluateAstraGtmReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks over-technical, ungated, non-watermarked, or reward-promising GTM", () => {
    const decision = evaluateAstraGtmReadiness({
      ...readyEvidence,
      firstFourChannelsReady: false,
      demoScriptsUnder60Seconds: false,
      demoScriptsShowLearningLoop: false,
      growthCopyHasNoTechnicalTerms: false,
      promotedCapabilitiesReleaseGated: false,
      shareCardsHaveWatermark: false,
      referralRewardsDisabledUntilAbuseControls: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "first_four_channels",
      "demo_under_60_seconds",
      "learning_loop_story",
      "technical_terms",
      "release_gate_alignment",
      "share_card_branding",
      "referral_reward_boundary",
    ])
  })

  it("warns when store screenshots under-cover the learning loop", () => {
    const decision = evaluateAstraGtmReadiness({
      ...readyEvidence,
      storeScreenshotsLearningLoopCount: 4,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual(["store_screenshot_loop_coverage"])
  })
})
