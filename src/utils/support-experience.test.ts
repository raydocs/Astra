import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  ASTRA_SUPPORT_BUNDLE_FIELDS,
  ASTRA_SUPPORT_ENTRIES,
  ASTRA_SUPPORT_FORBIDDEN_DEFAULT_CONTENT_FIELDS,
  ASTRA_SUPPORT_HELP_TOPICS,
  evaluateAstraSupportExperienceReadiness,
  findForbiddenSupportContentFields,
  helpCenterTopicIds,
  supportBundleFieldIds,
  type AstraSupportExperienceReadinessEvidence,
} from "./support-experience"

const readyEvidence: AstraSupportExperienceReadinessEvidence = {
  reportThisPageEntryAvailable: true,
  sendFeedbackEntryAvailable: true,
  contactSupportEntryAvailable: true,
  copySupportBundleEntryAvailable: true,
  helpCenterEntryAvailable: true,
  statusPageEntryAvailable: true,
  knownLimitationsEntryAvailable: true,
  metadataOnlyBundleFieldsAvailable: true,
  sensitiveContentExcludedByDefault: true,
  bundlePreviewBeforeSubmit: true,
  helpCenterTopicsCovered: true,
  knownLimitationsPublished: true,
  statusPageBoundaryDefined: true,
  supportCopyDoesNotRequireDevtools: true,
  authenticatedSubmitOrDownloadFallback: true,
}

describe("Astra support experience contract", () => {
  it("defines the Section 14 support entry points", () => {
    expect(ASTRA_SUPPORT_ENTRIES.map((entry) => entry.id)).toEqual([
      "report_this_page",
      "send_feedback",
      "contact_support",
      "copy_support_bundle",
      "help_center",
      "status_page",
      "known_limitations",
    ])
    expect(ASTRA_SUPPORT_ENTRIES.find((entry) => entry.id === "report_this_page")?.priority).toBe("P0")
    expect(ASTRA_SUPPORT_ENTRIES.find((entry) => entry.id === "status_page")?.priority).toBe("P1")
  })

  it("codifies the metadata-only support bundle field set", () => {
    expect(supportBundleFieldIds()).toEqual([
      "extension_version",
      "browser",
      "os",
      "page_hostname",
      "feature_surface",
      "last_action",
      "error_category",
      "membership_state_category",
      "privacy_mode_state",
      "timestamp",
    ])

    for (const field of ASTRA_SUPPORT_BUNDLE_FIELDS) {
      expect(field.sensitiveBodyContent).toBe(false)
    }
    expect(ASTRA_SUPPORT_BUNDLE_FIELDS.find((field) => field.id === "page_hostname")?.source).toContain("no path/query/full URL")
  })

  it("lists forbidden default content fields for support reports", () => {
    expect(ASTRA_SUPPORT_FORBIDDEN_DEFAULT_CONTENT_FIELDS).toEqual([
      "pageText",
      "selectedText",
      "savedSnippetText",
      "videoTranscriptText",
      "screenshot",
      "userInputText",
      "promptText",
      "modelOutputText",
      "fullUrl",
      "urlPath",
      "queryString",
    ])
    expect(findForbiddenSupportContentFields(["extensionVersion", "pageText", "fullUrl", "featureSurface"])).toEqual([
      "pageText",
      "fullUrl",
    ])
  })

  it("defines the required help center topic matrix", () => {
    expect(helpCenterTopicIds()).toEqual([
      "translate_first_page",
      "pages_cannot_be_translated",
      "automatic_ai_handling",
      "save_and_review_sentences",
      "privacy_mode",
      "delete_your_data",
      "video_has_no_captions",
      "membership_works",
    ])
    expect(ASTRA_SUPPORT_HELP_TOPICS.filter((topic) => topic.priority === "P0").map((topic) => topic.id)).toEqual([
      "translate_first_page",
      "pages_cannot_be_translated",
      "automatic_ai_handling",
      "save_and_review_sentences",
      "privacy_mode",
      "delete_your_data",
    ])
    expect(ASTRA_SUPPORT_HELP_TOPICS.map((topic) => topic.docPath)).toEqual([
      "docs/help/translate-first-page.md",
      "docs/help/pages-cannot-be-translated.md",
      "docs/help/automatic-ai-handling.md",
      "docs/help/save-and-review-sentences.md",
      "docs/help/privacy-mode.md",
      "docs/help/delete-your-data.md",
      "docs/help/video-has-no-captions.md",
      "docs/help/membership-works.md",
    ])
  })

  it("keeps every required help topic linked to an ordinary-language repo doc", () => {
    for (const topic of ASTRA_SUPPORT_HELP_TOPICS) {
      expect(existsSync(topic.docPath), topic.docPath).toBe(true)
      const content = readFileSync(topic.docPath, "utf8")
      expect(content).toContain(`# ${topic.title}`)
      expect(content).not.toContain("TODO")
      expect(content.toLowerCase()).not.toContain("devtools")
    }
    expect(existsSync("docs/help/known-limitations.md")).toBe(true)
    expect(existsSync("docs/status.md")).toBe(true)
  })

  it("passes readiness when entries, bundle, help, known limitations, and fallback evidence exist", () => {
    const decision = evaluateAstraSupportExperienceReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when P0 support entry, privacy, help, and fallback guarantees are missing", () => {
    const decision = evaluateAstraSupportExperienceReadiness({
      ...readyEvidence,
      reportThisPageEntryAvailable: false,
      contactSupportEntryAvailable: false,
      copySupportBundleEntryAvailable: false,
      helpCenterEntryAvailable: false,
      knownLimitationsEntryAvailable: false,
      metadataOnlyBundleFieldsAvailable: false,
      sensitiveContentExcludedByDefault: false,
      bundlePreviewBeforeSubmit: false,
      helpCenterTopicsCovered: false,
      knownLimitationsPublished: false,
      supportCopyDoesNotRequireDevtools: false,
      authenticatedSubmitOrDownloadFallback: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "report_this_page_entry",
      "contact_support_entry",
      "copy_support_bundle_entry",
      "help_center_entry",
      "known_limitations_entry",
      "metadata_only_bundle_fields",
      "sensitive_content_excluded",
      "bundle_preview_before_submit",
      "help_center_topics",
      "known_limitations_public",
      "support_copy_non_devtools",
      "authenticated_or_download_fallback",
    ])
  })

  it("keeps send-feedback and status-page gaps as warnings", () => {
    const decision = evaluateAstraSupportExperienceReadiness({
      ...readyEvidence,
      sendFeedbackEntryAvailable: false,
      statusPageEntryAvailable: false,
      statusPageBoundaryDefined: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "send_feedback_entry",
      "status_page_entry",
      "status_page_boundary",
    ])
  })
})
