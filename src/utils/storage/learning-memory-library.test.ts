import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { buildLearningProfileFromConfig } from "./learning-profile"
import { replaceOwnedReadingItems, type OwnedReadingItem } from "./owned-reading"
import { replaceReadingHistory } from "./reading-history"
import { replaceStudyProgressPages, type StudyPageProgress } from "./study-progress"
import { replaceVocabularyEntries, replaceVocabularyReviewSchedules, getVocabularyEntries, readSyncSafeVocabularyReviewSchedules } from "./vocabulary"
import type { VocabularyEntry, VocabularyReviewScheduleRecord } from "./vocabulary-core"
import {
  buildLearningMemoryLibraryView,
  buildLearningMemoryLibraryViewFromState,
  deleteLearningMemoryLibrarySources,
  setLearningMemoryLibrarySourceControls,
} from "./learning-memory-library"

describe("learning memory library", () => {
  const now = Date.UTC(2026, 4, 27, 12)
  const profile = {
    ...buildLearningProfileFromConfig({
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
    }),
    rememberedTerms: [{
      id: "lp_term_docs_example_render",
      sourceTerm: "render",
      preferredTerm: "渲染",
      source: "user_correction" as const,
      hostname: "docs.example",
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    }],
  }

  const ownedArticle: OwnedReadingItem = {
    id: "or_article_docs",
    sourceType: "article",
    title: "Docs article",
    sourceUrl: "https://docs.example/guide",
    openedAt: now - 2_000,
    updatedAt: now - 1_000,
    status: "saved",
    readingHistoryRecordId: "https://docs.example/guide",
    studyProgressRecordId: "https://docs.example/guide",
    userControl: { syncEnabled: true, excludedFromDigest: false, privacyModeAtCapture: false },
  }

  const savedEntry: VocabularyEntry = {
    id: "entry-render",
    text: "render",
    translation: "渲染",
    explanation: "Raw model explanation should not be in the memory timeline.",
    context: "The full raw sentence should not be shown here.",
    url: "https://docs.example/guide?token=secret#frag",
    hostname: "docs.example",
    savedAt: now,
    srsBox: 2,
    nextReviewAt: now + 86_400_000,
    reviewCount: 1,
    lastReviewedAt: now - 500,
    sourceContext: {
      surface: "popup_deep_read",
      pageTitle: "Docs article",
      pageUrl: "https://docs.example/guide?token=secret#frag",
      hostname: "docs.example",
      sentenceText: "The full raw sentence should not be shown here.",
      articleExcerpt: "A long page excerpt should not be part of rows.",
      ownedReadingItemId: "or_article_docs",
      ownedReadingSourceType: "article",
      ownedReadingTitle: "Docs article",
      studyProgressRecordId: "https://docs.example/guide?token=secret#frag",
    },
  }

  const studyPage: StudyPageProgress = {
    url: "https://docs.example/guide?token=secret#frag",
    hostname: "docs.example",
    title: "Docs article",
    completedSteps: ["read", "explain", "vocab_save"],
    sentencesExplained: 2,
    vocabSaved: 1,
    vocabReviewed: 0,
    startedAt: now - 10_000,
    lastActivityAt: now - 100,
  }

  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("builds a local-only per-source memory view without raw content or sensitive URL details in row fields", () => {
    const view = buildLearningMemoryLibraryViewFromState({
      generatedAt: "2026-05-27T12:00:00.000Z",
      privacyMode: true,
      learningProfile: profile,
      vocabularyEntries: [savedEntry],
      ownedReadingItems: [ownedArticle],
      readingHistory: [{
        id: "https://docs.example/guide?token=secret#frag",
        url: "https://docs.example/guide?token=secret#frag",
        hostname: "docs.example",
        title: "Docs article",
        wordsTranslated: 42,
        visitedAt: now - 3_000,
      }],
      studyProgress: {
        pages: [studyPage],
        dailyStats: { date: "2026-05-27", pagesStudied: 1, sentencesExplained: 2, vocabSaved: 1, vocabReviewed: 0 },
      },
    })

    expect(view).toMatchObject({
      schema: "astra-learning-memory-library.v1",
      localOnly: true,
      summary: { sourceCount: 1, rememberedTermCount: 1, savedCardCount: 1 },
      contentPolicy: {
        localOnly: true,
        includesFullPageText: false,
        includesFullTranscriptText: false,
        includesPromptText: false,
        includesModelOutput: false,
        includesFullUrlPaths: false,
        actionRefsAreInternal: true,
      },
    })
    expect(view.inventory.sections.map((section) => section.id)).toContain("source_history")
    expect(view.rememberedTerms[0]).toEqual(expect.objectContaining({ sourceTerm: "render", preferredTerm: "渲染", hostname: "docs.example" }))

    const row = view.sourceRows[0]
    expect(row).toMatchObject({
      title: "Docs article",
      sourceType: "article",
      hostname: "docs.example",
      savedCardCount: 1,
      readingHistoryCount: 1,
      studyProgressEventCount: 3,
      sentencesExplained: 2,
      syncEnabled: true,
      excludedFromDigest: false,
    })
    expect(row.timeline.map((event) => event.label)).toEqual(expect.arrayContaining([
      "Saved review card",
      "Study loop progress",
      "Page translation activity",
      "Source saved locally",
    ]))

    const publicRows = view.sourceRows.map(({ actionRef: _actionRef, ...publicRow }) => publicRow)
    const serialized = JSON.stringify(publicRows)
    expect(serialized).not.toContain("token=secret")
    expect(serialized).not.toContain("#frag")
    expect(serialized).not.toContain("The full raw sentence")
    expect(serialized).not.toContain("Raw model explanation")
    expect(serialized).not.toContain("A long page excerpt")
    expect(serialized).not.toContain("https://docs.example/guide")

    expect(row.actionRef).toMatchObject({
      ownedReadingItemId: "or_article_docs",
      vocabularyEntryIds: ["entry-render"],
      readingHistoryRecordIds: ["https://docs.example/guide"],
      studyProgressRecordIds: ["https://docs.example/guide"],
    })
  })

  it("sanitizes URL-like source titles before rendering memory rows", () => {
    const view = buildLearningMemoryLibraryViewFromState({
      generatedAt: "2026-05-27T12:00:00.000Z",
      learningProfile: profile,
      readingHistory: [{
        id: "https://private.example/path/to/page?token=secret#frag",
        url: "https://private.example/path/to/page?token=secret#frag",
        hostname: "private.example",
        title: "https://private.example/path/to/page?token=secret#frag",
        wordsTranslated: 5,
        visitedAt: now,
      }],
    })

    expect(view.sourceRows).toHaveLength(1)
    expect(view.sourceRows[0].title).toBe("private.example")
    const publicRows = view.sourceRows.map(({ actionRef: _actionRef, ...publicRow }) => publicRow)
    const serialized = JSON.stringify(publicRows)
    expect(serialized).not.toContain("/path/to/page")
    expect(serialized).not.toContain("token=secret")
    expect(serialized).not.toContain("#frag")
  })

  it("applies local source controls and source-history-only deletion without deleting saved cards", async () => {
    await replaceOwnedReadingItems([ownedArticle])
    await replaceReadingHistory([{
      id: "https://docs.example/guide?token=secret#frag",
      url: "https://docs.example/guide?token=secret#frag",
      hostname: "docs.example",
      title: "Docs article",
      wordsTranslated: 42,
      visitedAt: now - 3_000,
    }])
    await replaceStudyProgressPages([studyPage])
    await replaceVocabularyEntries([savedEntry])

    const view = await buildLearningMemoryLibraryView({ generatedAt: "2026-05-27T12:00:00.000Z" })
    const ref = view.sourceRows[0].actionRef

    await expect(setLearningMemoryLibrarySourceControls([ref], { syncEnabled: false, excludedFromDigest: true })).resolves.toMatchObject({
      selectedCount: 1,
      updatedSourceControlCount: 1,
    })

    const controlled = await buildLearningMemoryLibraryView({ generatedAt: "2026-05-27T12:00:00.000Z" })
    expect(controlled.sourceRows[0]).toMatchObject({ syncEnabled: false, excludedFromDigest: true })

    await expect(deleteLearningMemoryLibrarySources([ref], "source_history_only")).resolves.toMatchObject({
      selectedCount: 1,
      removedSavedCardCount: 0,
    })

    expect(await getVocabularyEntries()).toHaveLength(1)
    const afterDelete = await buildLearningMemoryLibraryView({ generatedAt: "2026-05-27T12:00:00.000Z" })
    expect(afterDelete.sourceRows).toHaveLength(1)
    expect(afterDelete.sourceRows[0]).toMatchObject({
      savedCardCount: 1,
      readingHistoryCount: 0,
      studyProgressEventCount: 0,
    })
  })

  it("deletes selected source history plus saved cards and review schedules when requested", async () => {
    const schedule: VocabularyReviewScheduleRecord = {
      vocabularyEntryId: savedEntry.id,
      srsBox: 3,
      nextReviewAt: now + 10_000,
      reviewCount: 2,
      lastReviewedAt: now - 1_000,
      lastReviewGrade: "good",
      lastReviewGradeAt: now - 1_000,
      updatedAt: now - 1_000,
    }
    await replaceOwnedReadingItems([ownedArticle])
    await replaceReadingHistory([{
      id: "https://docs.example/guide",
      url: "https://docs.example/guide",
      hostname: "docs.example",
      title: "Docs article",
      wordsTranslated: 42,
      visitedAt: now - 3_000,
    }])
    await replaceStudyProgressPages([studyPage])
    await replaceVocabularyEntries([savedEntry])
    await replaceVocabularyReviewSchedules([schedule])

    const view = await buildLearningMemoryLibraryView({ generatedAt: "2026-05-27T12:00:00.000Z" })
    await expect(deleteLearningMemoryLibrarySources([view.sourceRows[0].actionRef], "source_and_saved_cards")).resolves.toMatchObject({
      selectedCount: 1,
      removedSavedCardCount: 1,
    })

    expect(await getVocabularyEntries()).toEqual([])
    expect(await readSyncSafeVocabularyReviewSchedules()).toEqual([])
    const afterDelete = await buildLearningMemoryLibraryView({ generatedAt: "2026-05-27T12:00:00.000Z" })
    expect(afterDelete.sourceRows).toEqual([])
  })
})
