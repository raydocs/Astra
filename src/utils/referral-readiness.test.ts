import { describe, expect, it } from "vitest"

import {
  ASTRA_REFERRAL_CONVERSION_RATE_LIMIT_POLICY,
  ASTRA_REFERRAL_INVITE_RATE_LIMIT_POLICY,
  ASTRA_REFERRAL_READINESS_SCHEMA_ID,
  buildAstraReferralInviteMetadata,
  evaluateAstraReferralIdentityRisk,
  evaluateAstraReferralReadiness,
  isAstraReferralMetadataSafe,
  sanitizeAstraReferralCampaign,
  type AstraReferralReadinessEvidence,
} from "./referral-readiness"

const READY_EVIDENCE: AstraReferralReadinessEvidence = {
  rewardsDisabled: true,
  rewardGrantsEnabled: false,
  sampleContentFirst: true,
  metadataOnlyEvents: true,
  inviteRateLimitsEnforced: true,
  conversionRateLimitsEnforced: true,
  selfReferralBlocked: true,
  duplicateDeviceBlocked: true,
  duplicateInstallBlocked: true,
  duplicatePaymentIdentityBlocked: true,
  rewardLedgerIdempotencyReady: true,
  operatorAuditReady: true,
}

describe("referral readiness contract", () => {
  it("builds canonical non-rewarding referral metadata", () => {
    expect(buildAstraReferralInviteMetadata({
      trigger: "sample_review_complete",
      campaign: "First_90-Growth",
    })).toEqual({
      schema: ASTRA_REFERRAL_READINESS_SCHEMA_ID,
      source: "sample_lesson",
      surface: "sample_lesson",
      landingSource: "referral",
      referralType: "non_rewarding",
      rewardAvailable: false,
      sampleContentOnly: true,
      trigger: "sample_review_complete",
      campaign: "first_90-growth",
    })
  })

  it("omits unsafe campaign values", () => {
    expect(sanitizeAstraReferralCampaign("https://evil.example/?email=a@b.com")).toBeUndefined()
    expect(buildAstraReferralInviteMetadata({ campaign: "../checkout?plan=pro" })).not.toHaveProperty("campaign")
  })

  it("rejects raw content, URL, email, payment, checkout, and user-content-like metadata fields", () => {
    const safe = buildAstraReferralInviteMetadata()
    expect(isAstraReferralMetadataSafe(safe)).toBe(true)

    for (const unsafePatch of [
      { pageUrl: "https://example.test/page" },
      { articleExcerpt: "raw sentence" },
      { email: "person@example.test" },
      { paymentMethod: "card" },
      { checkoutSessionId: "cs_test" },
      { userContent: "selected text" },
      { nested: { contentSummary: "summary" } },
    ]) {
      expect(isAstraReferralMetadataSafe({ ...safe, ...unsafePatch })).toBe(false)
    }
  })

  it("defines invite and conversion rate-limit policies across account, device, and IP scopes", () => {
    expect(ASTRA_REFERRAL_INVITE_RATE_LIMIT_POLICY).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: "invite", subject: "referrer" }),
      expect.objectContaining({ scope: "invite", subject: "device" }),
      expect.objectContaining({ scope: "invite", subject: "ip" }),
    ]))
    expect(ASTRA_REFERRAL_CONVERSION_RATE_LIMIT_POLICY).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: "conversion", subject: "invitee" }),
      expect.objectContaining({ scope: "conversion", subject: "device" }),
      expect.objectContaining({ scope: "conversion", subject: "ip" }),
    ]))
  })

  it("blocks readiness when any required control is missing", () => {
    for (const key of Object.keys(READY_EVIDENCE) as Array<keyof AstraReferralReadinessEvidence>) {
      const evidence = { ...READY_EVIDENCE, [key]: key === "rewardGrantsEnabled" ? true : false }
      const decision = evaluateAstraReferralReadiness(evidence)
      expect(decision.controlsReady, key).toBe(false)
      expect(decision.missingControls.length, key).toBeGreaterThan(0)
      expect(decision.rewardGrantsEnabled).toBe(false)
    }
  })

  it("marks controls ready only when all anti-abuse gates pass while rewards remain disabled", () => {
    expect(evaluateAstraReferralReadiness(READY_EVIDENCE)).toEqual({
      schema: ASTRA_REFERRAL_READINESS_SCHEMA_ID,
      controlsReady: true,
      rewardGrantsEnabled: false,
      missingControls: [],
    })
  })

  it("keeps serialized readiness decisions free of grant, trial, Pro, checkout, payment, or subscription data", () => {
    const serialized = JSON.stringify(evaluateAstraReferralReadiness(READY_EVIDENCE)).toLowerCase()
    expect(serialized).not.toContain("trial")
    expect(serialized).not.toContain("pro")
    expect(serialized).not.toContain("checkout")
    expect(serialized).not.toContain("payment")
    expect(serialized).not.toContain("subscription")
    expect(serialized).not.toContain("entitlement")
    expect(serialized).not.toContain("grantdata")
  })

  it("flags self-referral, duplicate identity, and missing identity evidence", () => {
    expect(evaluateAstraReferralIdentityRisk({
      referrerAccountId: "acct_1",
      inviteeAccountId: "acct_1",
      duplicateDevice: true,
      duplicateInstall: true,
      duplicatePaymentOrBillingIdentity: true,
      selfReferralChecked: true,
      duplicateDeviceChecked: true,
      duplicateInstallChecked: true,
      duplicatePaymentOrBillingChecked: true,
    })).toMatchObject({
      blocked: true,
      risks: ["self_referral", "duplicate_device", "duplicate_install", "duplicate_billing_identity"],
      evidenceGaps: [],
    })

    expect(evaluateAstraReferralIdentityRisk({
      selfReferralChecked: false,
      duplicateDeviceChecked: false,
      duplicateInstallChecked: false,
      duplicatePaymentOrBillingChecked: false,
    }).evidenceGaps).toEqual([
      "self_referral_check",
      "duplicate_device_check",
      "duplicate_install_check",
      "duplicate_billing_check",
    ])
  })
})
