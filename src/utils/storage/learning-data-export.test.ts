import { beforeEach, describe, expect, it, vi } from "vitest"

const vocabularyEntries = vi.hoisted(() => vi.fn())
const ownedReadingItems = vi.hoisted(() => vi.fn())
const readingHistory = vi.hoisted(() => vi.fn())
const studyProgress = vi.hoisted(() => vi.fn())

vi.mock("./vocabulary", () => ({
  getVocabularyEntries: vocabularyEntries,
}))

vi.mock("./owned-reading", () => ({
  listOwnedReadingItems: ownedReadingItems,
}))

vi.mock("./reading-history", () => ({
  getReadingHistory: readingHistory,
}))

vi.mock("./study-progress", async () => {
  const actual = await vi.importActual<typeof import("./study-progress")>("./study-progress")
  return {
    ...actual,
    getStudyProgress: studyProgress,
  }
})

import { buildLearningDataExport, stringifyLearningDataExport } from "./learning-data-export"

describe("learning data export", () => {
  beforeEach(() => {
    vocabularyEntries.mockReset()
    ownedReadingItems.mockReset()
    readingHistory.mockReset()
    studyProgress.mockReset()
  })

  it("exports user learning assets with an explicit copyright/privacy boundary", async () => {
    const savedAt = Date.UTC(2026, 4, 25)
    vocabularyEntries.mockResolvedValue([{
      id: "vocab-1",
      text: "resilience",
      translation: "韧性",
      savedAt,
      nextReviewAt: savedAt,
      reviewCount: 0,
      lastReviewedAt: null,
      srsBox: 1,
      sourceContext: {
        surface: "selection_toolbar",
        pageTitle: "Article",
        pageUrl: "https://example.com/a?private=1",
        sentenceText: "The team showed resilience.",
      },
    }])
    ownedReadingItems.mockResolvedValue([])
    readingHistory.mockResolvedValue([{ url: "https://example.com/a", title: "Article", visitedAt: savedAt }])
    studyProgress.mockResolvedValue({
      pages: [{ url: "https://example.com/a", hostname: "example.com", title: "Article", completedSteps: ["read"], startedAt: savedAt, lastActivityAt: savedAt }],
      dailyStats: { date: "2026-05-25", pagesStudied: 1, sentencesExplained: 0, vocabSaved: 1, vocabReviewed: 0 },
    })

    const exported = await buildLearningDataExport({ generatedAt: "2026-05-27T12:00:00.000Z" })

    expect(exported.schema).toBe("astra-learning-data-export.v1")
    expect(exported.contentPolicy).toMatchObject({
      userInitiatedExport: true,
      includesFullPageText: false,
      includesFullTranscriptText: false,
    })
    expect(exported.summary.savedSnippetCount).toBe(1)
    expect(exported.summary.weeklyReviewableLearningMoments.reviewableLearningMoments).toBe(1)
    expect(stringifyLearningDataExport(exported)).toContain("copyrightBoundary")
  })
})
