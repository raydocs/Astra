import { describe, expect, it } from "vitest"

import {
  ASTRA_SUPPORT_FIRST_RESPONSE_MACRO_COVERAGE_THRESHOLD,
  ASTRA_SUPPORT_FIRST_RESPONSE_MACROS,
  findSupportFirstResponseMacro,
  findSupportFirstResponseMacroById,
  summarizeSupportFirstResponseMacroCoverage,
} from "./support-response-macros"

const FORBIDDEN_SUPPORT_COPY_TERMS = /\b(api key|provider|model|prompt|token|devtools|stack trace|debug)\b/i

describe("Astra support first-response macros", () => {
  it("covers every support issue category with ordinary-language metadata-safe copy", () => {
    const summary = summarizeSupportFirstResponseMacroCoverage({ generatedAt: "2026-05-27T00:00:00.000Z" })

    expect(summary.schema).toBe("astra-support-first-response-macros.v1")
    expect(summary.threshold).toBe(ASTRA_SUPPORT_FIRST_RESPONSE_MACRO_COVERAGE_THRESHOLD)
    expect(summary.catalogCoverage).toEqual({
      coveredIssueCategories: 8,
      totalIssueCategories: 8,
      coverageRate: 1,
      ready: true,
    })
    expect(summary.macros.map((macro) => macro.issueCategory)).toEqual([
      "translation_quality",
      "page_not_working",
      "video_subtitles",
      "file_reader",
      "review_library",
      "account_access",
      "privacy_question",
      "other",
    ])

    for (const macro of ASTRA_SUPPORT_FIRST_RESPONSE_MACROS) {
      const copy = [macro.title, macro.firstResponse, macro.nextStep, macro.privacyNote].join(" ")
      expect(copy).not.toMatch(FORBIDDEN_SUPPORT_COPY_TERMS)
      expect(macro.privacyNote.toLowerCase()).toMatch(/metadata|do not|ask before|unless|passwords|payment/)
    }
  })

  it("computes reported first-response macro coverage without user content", () => {
    const summary = summarizeSupportFirstResponseMacroCoverage({
      generatedAt: "2026-05-27T00:00:00.000Z",
      totalReports: 5,
      reportBuckets: [
        { issueCategory: "page_not_working", count: 2 },
        { issueCategory: "privacy_question", count: 1 },
        { issueCategory: null, count: 2 },
      ],
    })

    expect(summary.reportedCoverage).toEqual({
      coveredReports: 3,
      totalReports: 5,
      unknownIssueReports: 2,
      coverageRate: 0.6,
      ready: false,
    })
    expect(summary.byIssueCategory[0]).toMatchObject({ issueCategory: "page_not_working", count: 2, covered: true })
    expect(summary.byIssueCategory).toEqual(expect.arrayContaining([
      expect.objectContaining({ issueCategory: "unknown", count: 2, macroId: null, covered: false }),
    ]))
    expect(JSON.stringify(summary)).not.toContain("user@example.com")
    expect(JSON.stringify(summary)).not.toContain("Hello, world.")
  })

  it("returns null reported coverage when no reports have been submitted", () => {
    const summary = summarizeSupportFirstResponseMacroCoverage({ generatedAt: "2026-05-27T00:00:00.000Z" })

    expect(summary.reportedCoverage).toEqual({
      coveredReports: 0,
      totalReports: 0,
      unknownIssueReports: 0,
      coverageRate: null,
      ready: null,
    })
  })

  it("finds macros by valid issue category or id and rejects unknown values", () => {
    expect(findSupportFirstResponseMacro("video_subtitles")?.id).toBe("macro_video_subtitles")
    expect(findSupportFirstResponseMacro("billing_body_text")).toBeNull()
    expect(findSupportFirstResponseMacro(null)).toBeNull()
    expect(findSupportFirstResponseMacroById("macro_review_library")?.issueCategory).toBe("review_library")
    expect(findSupportFirstResponseMacroById("macro_unknown")).toBeNull()
    expect(findSupportFirstResponseMacroById(null)).toBeNull()
  })
})
