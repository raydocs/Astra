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
})
