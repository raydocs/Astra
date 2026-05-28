import { describe, expect, it } from "vitest"

import {
  ASTRA_LIBRARY_ASSET_TYPES,
  ASTRA_LIBRARY_DEFAULT_COPY,
  ASTRA_LIBRARY_HOME_QUESTIONS,
  ASTRA_LIBRARY_ORGANIZATION_DIMENSIONS,
  evaluateAstraLibraryReadiness,
  type AstraLibraryReadinessEvidence,
} from "./learning-library-experience"

const readyEvidence: AstraLibraryReadinessEvidence = {
  assetTypesRepresentMacroSet: true,
  autoOrganizationCoversRequiredDimensions: true,
  defaultUxAvoidsFolderManagement: true,
  homeShowsRecentlyLearned: true,
  homeShowsReviewToday: true,
  homeShowsContinueLearning: true,
  savedItemsCanReturnToSource: true,
  libraryFeelsLikeLearningTrailNotDatabase: true,
  digestAndSummariesAvoidFullContentByDefault: true,
}

describe("Astra Learning Library experience contract", () => {
  it("defines the macro-plan Library asset set", () => {
    expect(ASTRA_LIBRARY_ASSET_TYPES.map((assetType) => assetType.id)).toEqual([
      "saved_pages",
      "saved_videos",
      "saved_files",
      "saved_sentences",
      "saved_words",
      "video_notes",
      "reading_queue",
      "review_queue",
      "personal_glossary",
      "learning_digest",
    ])
    expect(ASTRA_LIBRARY_ASSET_TYPES.every((assetType) => assetType.defaultStorageBoundary.length > 20)).toBe(true)
    expect(ASTRA_LIBRARY_ASSET_TYPES.find((assetType) => assetType.id === "learning_digest")?.defaultStorageBoundary).toContain("no page text")
  })

  it("keeps Library organization automatic instead of manual folder management", () => {
    expect(ASTRA_LIBRARY_ORGANIZATION_DIMENSIONS.map((dimension) => dimension.id)).toEqual([
      "source_type",
      "website",
      "video_channel",
      "topic",
      "difficulty",
      "recently_learned",
      "due_for_review",
      "mastered",
      "common_terms",
    ])
    expect(ASTRA_LIBRARY_ORGANIZATION_DIMENSIONS.every((dimension) => dimension.userManagedByDefault === false)).toBe(true)
  })

  it("answers only the three Library home questions in the default path", () => {
    expect(ASTRA_LIBRARY_HOME_QUESTIONS.map((question) => question.userQuestion)).toEqual([
      "What did I recently learn?",
      "What should I review today?",
      "What can I continue reading or watching?",
    ])
    expect(ASTRA_LIBRARY_HOME_QUESTIONS.map((question) => question.primaryAction)).toEqual([
      "Open recent item",
      "Start review",
      "Continue source",
    ])
    expect(ASTRA_LIBRARY_DEFAULT_COPY).toEqual([
      "Your learning trail",
      "Recently learned",
      "Review today",
      "Continue learning",
      "Saved from this source",
    ])
  })

  it("passes readiness when the Library is a source-backed learning trail", () => {
    const decision = evaluateAstraLibraryReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when the Library loses asset coverage, home answers, return paths, or privacy boundaries", () => {
    const decision = evaluateAstraLibraryReadiness({
      ...readyEvidence,
      assetTypesRepresentMacroSet: false,
      autoOrganizationCoversRequiredDimensions: false,
      defaultUxAvoidsFolderManagement: false,
      homeShowsRecentlyLearned: false,
      homeShowsReviewToday: false,
      homeShowsContinueLearning: false,
      savedItemsCanReturnToSource: false,
      digestAndSummariesAvoidFullContentByDefault: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "asset_types_covered",
      "auto_organization_dimensions",
      "no_folder_management_default",
      "home_recently_learned",
      "home_review_today",
      "home_continue_learning",
      "return_to_source",
      "privacy_safe_digest",
    ])
  })

  it("warns, without blocking, when the Library starts to feel like a database", () => {
    const decision = evaluateAstraLibraryReadiness({
      ...readyEvidence,
      libraryFeelsLikeLearningTrailNotDatabase: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual(["learning_trail_not_database"])
  })
})
