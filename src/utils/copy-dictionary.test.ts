import { describe, expect, it } from "vitest"

import { COPY_DICTIONARY, assertUserCopyIsPlain, findForbiddenUserCopyTerms, getSafeAiUnavailableCopy, getUserCopy } from "./copy-dictionary"

describe("copy dictionary", () => {
  it("returns known user-facing copy", () => {
    expect(getUserCopy("aiReady")).toBe("Astra AI is ready.")
    expect(getUserCopy("supportPrivacy")).toContain("not your page text")
  })

  it("keeps dictionary copy free of restricted technical language", () => {
    for (const copy of Object.values(COPY_DICTIONARY)) {
      expect(findForbiddenUserCopyTerms(copy)).toEqual([])
    }
  })

  it("detects restricted technical language in new copy", () => {
    expect(findForbiddenUserCopyTerms("Provider token failed")).toEqual(["provider", "token"])
    expect(findForbiddenUserCopyTerms("Free beta quotas and rate limits may apply")).toEqual(["quota", "quotas", "rate limit", "rate limits"])
    expect(findForbiddenUserCopyTerms("browser.permissions activeTab optional host manifest runtime revoke policy")).toEqual([
      "browser.permissions",
      "activetab",
      "optional host",
      "manifest",
      "runtime revoke",
    ])
    expect(findForbiddenUserCopyTerms("Use page once, remember this site, or pause this site.")).toEqual([])
    expect(() => assertUserCopyIsPlain("Provider token failed")).toThrow("restricted technical language")
  })

  it("maps AI unavailable diagnostics to membership-safe copy", () => {
    expect(getSafeAiUnavailableCopy({ code: "CONFIG_MISSING", message: "No API key configured." }))
      .toBe("Sign in to use Astra AI")
    expect(getSafeAiUnavailableCopy({ code: "PROVIDER_REQUEST_FAILED", message: "Relay unavailable" }))
      .toBe("Your membership is active. Astra is reconnecting.")
    expect(getSafeAiUnavailableCopy({ code: "PROVIDER_REQUEST_FAILED", message: "model unavailable from upstream provider" }))
      .toBe("Astra is temporarily busy. Retry in a moment.")
    expect(getSafeAiUnavailableCopy({ code: "QUOTA_EXCEEDED", message: "token limit exceeded" }))
      .toBe("Astra is temporarily busy. Retry in a moment.")
    expect(getSafeAiUnavailableCopy({ code: "CONTENT_UNAVAILABLE", message: "Protected page" }))
      .toBe("This page is protected. Try selection translation or Deep Read.")
  })

  it("turns a used-up included sample into a value-framed Pro reason, not a cold limit", () => {
    // Server raises QUOTA_EXCEEDED with this message once a Free user has spent
    // their included monthly deep-reading / video sample — the moment to explain Pro.
    expect(getSafeAiUnavailableCopy({ code: "QUOTA_EXCEEDED", message: "deep_reading monthly allowance exceeded for the free plan." }))
      .toBe(COPY_DICTIONARY.proValue)
    expect(getSafeAiUnavailableCopy({ code: "QUOTA_EXCEEDED", message: "video_summary monthly allowance exceeded for the free plan." }))
      .toBe(COPY_DICTIONARY.proValue)
  })

  it("frames the daily Fair-Use ceiling as today's reading refreshing, not a busy retry", () => {
    expect(getSafeAiUnavailableCopy({ code: "PROVIDER_REQUEST_FAILED", message: "Daily request quota exceeded." }))
      .toBe(COPY_DICTIONARY.dailyFreeReached)
    expect(getSafeAiUnavailableCopy({ code: "PROVIDER_REQUEST_FAILED", message: "Daily character quota exceeded." }))
      .toBe(COPY_DICTIONARY.dailyFreeReached)
    // A transient per-minute rate limit is genuinely temporary and must still ask to retry.
    expect(getSafeAiUnavailableCopy({ code: "PROVIDER_REQUEST_FAILED", message: "Rate limit exceeded for the current minute." }))
      .toBe("Astra is temporarily busy. Retry in a moment.")
  })
})
