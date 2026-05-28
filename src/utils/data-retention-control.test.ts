import { describe, expect, it } from "vitest"

import {
  ASTRA_COPYRIGHT_BOUNDARIES,
  ASTRA_DATA_CONTROL_REQUIREMENTS,
  ASTRA_DATA_RETENTION_POLICIES,
  evaluateAstraDataControlReadiness,
  getDataRetentionPolicy,
  type AstraDataControlEvidence,
} from "./data-retention-control"

const completeEvidence: AstraDataControlEvidence = {
  privacyModeVisible: true,
  deleteSavedItemAvailable: true,
  deleteRelatedReviewCardsAvailable: true,
  exportLearningDataAvailable: true,
  disableSyncForSourceAvailable: true,
  excludeFromDigestAvailable: true,
  deleteAccountDataHelpPathVisible: true,
  supportBundlePreviewVisible: true,
  supportBundleMetadataOnlyByDefault: true,
  exportExplainsCopyrightBoundary: true,
  canceledMemberCanViewExistingAssets: true,
  sourceDeleteCascadeChoiceExplicit: true,
  privacyModeCopyAvoidsLocalOnlyClaim: true,
}

describe("Astra data retention and user controls", () => {
  it("defines the macro-plan data categories with conservative full-content defaults", () => {
    expect(ASTRA_DATA_RETENTION_POLICIES.map((policy) => policy.category)).toEqual([
      "account_data",
      "settings",
      "source_metadata",
      "saved_snippets",
      "review_cards",
      "vocabulary",
      "full_page_text",
      "transcript_full_text",
      "telemetry",
      "support_bundle",
    ])

    expect(getDataRetentionPolicy("saved_snippets")).toMatchObject({
      defaultSave: "user_initiated",
      sync: "optional",
      deletionPath: "delete_snippet",
      defaultIncludesFullThirdPartyContent: false,
    })
    expect(getDataRetentionPolicy("full_page_text")).toMatchObject({
      defaultSave: "temporary_only",
      sync: "no",
      deletionPath: "not_persisted",
      defaultIncludesFullThirdPartyContent: true,
    })
    expect(getDataRetentionPolicy("support_bundle").retention).toContain("metadata-only")
  })

  it("defines copyright boundaries that prevent default full third-party redistribution", () => {
    expect(ASTRA_COPYRIGHT_BOUNDARIES.map((boundary) => boundary.contentType)).toEqual([
      "web_article",
      "youtube_transcript",
      "pdf_epub",
      "user_input",
      "ai_summary",
    ])
    expect(ASTRA_COPYRIGHT_BOUNDARIES.find((boundary) => boundary.contentType === "web_article")?.notDefault)
      .toContain("complete third-party articles")
    expect(ASTRA_COPYRIGHT_BOUNDARIES.find((boundary) => boundary.contentType === "youtube_transcript")?.notDefault)
      .toContain("full transcripts")
  })

  it("tracks P0 and P1 user-control requirements from section 26", () => {
    expect(ASTRA_DATA_CONTROL_REQUIREMENTS.map((control) => [control.id, control.priority])).toEqual([
      ["privacy_mode", "P0"],
      ["delete_saved_item", "P0"],
      ["delete_related_review_cards", "P0"],
      ["export_learning_data", "P1"],
      ["disable_sync_for_source", "P1"],
      ["exclude_from_digest", "P1"],
      ["delete_account_data_help", "P0"],
      ["support_bundle_preview", "P0"],
    ])
  })

  it("passes readiness when all controls and policy boundaries are evidenced", () => {
    const decision = evaluateAstraDataControlReadiness(completeEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks missing P0 controls and core policy boundaries", () => {
    const decision = evaluateAstraDataControlReadiness({
      ...completeEvidence,
      privacyModeVisible: false,
      deleteSavedItemAvailable: false,
      deleteRelatedReviewCardsAvailable: false,
      deleteAccountDataHelpPathVisible: false,
      supportBundlePreviewVisible: false,
      supportBundleMetadataOnlyByDefault: false,
      exportExplainsCopyrightBoundary: false,
      canceledMemberCanViewExistingAssets: false,
      sourceDeleteCascadeChoiceExplicit: false,
      privacyModeCopyAvoidsLocalOnlyClaim: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "privacy_mode",
      "delete_saved_item",
      "delete_related_review_cards",
      "delete_account_data_help",
      "support_bundle_preview",
      "support_metadata_only",
      "export_copyright_boundary",
      "canceled_member_asset_access",
      "source_delete_cascade_choice",
      "privacy_mode_copy_accuracy",
    ])
    expect(decision.warnings).toEqual([])
  })

  it("warns for missing P1 source/export convenience controls without blocking P0 readiness", () => {
    const decision = evaluateAstraDataControlReadiness({
      ...completeEvidence,
      exportLearningDataAvailable: false,
      disableSyncForSourceAvailable: false,
      excludeFromDigestAvailable: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "export_learning_data",
      "disable_sync_for_source",
      "exclude_from_digest",
    ])
  })
})
