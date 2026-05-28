import { describe, expect, it } from "vitest"

import {
  KnownIssueMetadataSchema,
  SupportReportDraftSchema,
  buildSupportBundle,
  buildSupportReportDraft,
  describeKnownIssueForUser,
  describeSupportBundle,
  isMetadataOnlySupportBundle,
} from "./support-bundle"

describe("support bundle", () => {
  it("builds metadata-only support bundles by default", () => {
    const bundle = buildSupportBundle({
      extensionVersion: "1.2.3",
      browser: "Chrome 125",
      os: "macOS",
      locale: "zh-CN",
      featureSurface: "page",
      action: "translate_page",
      errorCategory: "provider_timeout",
      timestamp: new Date("2026-05-27T12:00:00.000Z"),
      hostname: "https://example.com/article?private=1",
      privacyMode: true,
      membershipState: "free",
      operatingMetadata: {
        taskClass: "paragraph_understanding",
        costBucket: "medium",
        latencyBucket: "slow",
        cacheStatus: "miss",
        fallbackReason: "timeout",
        tier: "free",
        surface: "page",
      },
    })

    expect(bundle).toMatchObject({
      schema: "astra-support-bundle.v1",
      reportId: expect.stringMatching(/^rpt_/),
      hostname: "example.com",
      userMessageIncluded: false,
      contactIncluded: false,
      contentIncluded: { enabled: false, type: "none" },
    })
    expect(isMetadataOnlySupportBundle(bundle)).toBe(true)
    expect(bundle.operatingMetadata).toMatchObject({
      taskClass: "paragraph_understanding",
      costBucket: "medium",
      cacheStatus: "miss",
      tier: "free",
    })

    const serialized = JSON.stringify(bundle)
    expect(serialized).not.toContain("article?private")
    expect(serialized).not.toContain("page text")
  })

  it("records report metadata without page content", () => {
    const bundle = buildSupportBundle({
      extensionVersion: "1.2.3",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "page",
      action: "report_issue",
      issueCategory: "translation_quality",
      lastErrorCategory: "provider_timeout",
      runtimeSurface: "popup",
      timestamp: "2026-05-27T12:00:00.000Z",
      hostname: "https://example.com/private/path?token=secret",
      privacyMode: true,
    })

    expect(bundle.issueCategory).toBe("translation_quality")
    expect(bundle.lastErrorCategory).toBe("provider_timeout")
    expect(bundle.runtimeSurface).toBe("popup")
    expect(bundle.hostname).toBe("example.com")
    expect(bundle.userMessageIncluded).toBe(false)
    expect(bundle.contactIncluded).toBe(false)
    expect(JSON.stringify(bundle)).not.toContain("token=secret")
    expect(describeSupportBundle(bundle)).toContain("Issue: translation_quality")
    expect(describeSupportBundle(bundle)).toContain("No user-entered message included")
    expect(describeSupportBundle(bundle)).toContain("No contact info included")
  })

  it("builds support report drafts with metadata-only defaults", () => {
    const draft = buildSupportReportDraft({
      reportId: "rpt_testcase1",
      extensionVersion: "1.2.3",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "video",
      action: "report_issue",
      issueCategory: "video_subtitles",
      timestamp: "2026-05-27T12:00:00.000Z",
      hostname: "https://video.example/watch/private?secret=1",
      privacyMode: false,
      knownIssue: {
        issueId: "known-video-captions",
        status: "investigating",
        featureSurface: "video",
        issueCategory: "video_subtitles",
        hostname: "video.example",
        affectedVersions: ["1.2.3"],
        firstSeenAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T12:00:00.000Z",
      },
    })

    expect(draft).toMatchObject({
      schema: "astra-support-report-draft.v1",
      reportId: "rpt_testcase1",
      status: "draft",
      defaultContentIncluded: false,
      bundle: {
        hostname: "video.example",
        contentIncluded: { enabled: false, type: "none" },
      },
      knownIssue: { issueId: "known-video-captions" },
    })
    expect(SupportReportDraftSchema.parse(draft)).toEqual(draft)
    expect(JSON.stringify(draft)).not.toContain("secret=1")
  })

  it("parses known issue metadata without content fields", () => {
    const knownIssue = KnownIssueMetadataSchema.parse({
      issueId: "known-page-protected",
      status: "workaround",
      featureSurface: "page",
      issueCategory: "page_not_working",
      hostname: "example.com",
      firstSeenAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T12:00:00.000Z",
      workaroundKey: "try_selection_instead",
    })

    expect(knownIssue).toMatchObject({
      issueId: "known-page-protected",
      affectedVersions: [],
    })
    expect(JSON.stringify(knownIssue)).not.toContain("pageText")
  })

  it("formats known issue metadata as user-safe status copy", () => {
    const issue = KnownIssueMetadataSchema.parse({
      issueId: "issue_youtube_subtitles_beta",
      status: "workaround",
      featureSurface: "video",
      issueCategory: "video_subtitles",
      firstSeenAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T12:00:00.000Z",
      workaroundKey: "try_transcript_panel",
    })

    expect(describeKnownIssueForUser(issue)).toBe("Known issue: Workaround available. Try the transcript panel or retry later.")
    expect(describeKnownIssueForUser(issue)).not.toContain("issue_youtube_subtitles_beta")
    expect(describeKnownIssueForUser(issue)).not.toContain("try_transcript_panel")
  })

  it("makes content inclusion explicit in the preview copy", () => {
    const bundle = buildSupportBundle({
      extensionVersion: "1.2.3",
      browser: "Firefox",
      os: "Linux",
      locale: "en-US",
      featureSurface: "review",
      action: "review_card_failed",
      timestamp: "2026-05-27T12:00:00.000Z",
      privacyMode: false,
      contentIncluded: { enabled: true, type: "user_note" },
    })

    expect(isMetadataOnlySupportBundle(bundle)).toBe(false)
    expect(describeSupportBundle(bundle)).toContain("User chose to include user_note")
  })
})
