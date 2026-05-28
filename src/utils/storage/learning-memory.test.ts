import { describe, expect, it } from "vitest"

import { buildLearningProfileFromConfig } from "./learning-profile"
import {
  LEARNING_MEMORY_WRITE_AUDIT_REGISTRY,
  buildLearningMemoryInventoryFromState,
  evaluateLearningMemoryWritePolicy,
} from "./learning-memory"
import type { OwnedReadingItem } from "./owned-reading"
import type { StudyProgressStore } from "./study-progress"
import type { VocabularyEntry } from "./vocabulary-core"

describe("learning memory inventory", () => {
  const savedAt = Date.UTC(2026, 4, 25)
  const profile = {
    ...buildLearningProfileFromConfig({
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
    }, "read_articles_docs"),
    rememberedTerms: [{
      id: "lp_term_docs.example_render",
      sourceTerm: "render",
      preferredTerm: "渲染",
      source: "user_correction" as const,
      hostname: "docs.example",
      createdAt: "2026-05-25T00:00:00.000Z",
      updatedAt: "2026-05-25T00:00:00.000Z",
    }],
    excludedHostnames: ["private.example"],
  }

  const vocabularyEntry: VocabularyEntry = {
    id: "vocab-1",
    text: "resilience",
    translation: "韧性",
    explanation: "Useful word for describing recovery under pressure.",
    context: "The team showed resilience.",
    savedAt,
    nextReviewAt: savedAt,
    reviewCount: 1,
    lastReviewedAt: savedAt,
    srsBox: 3,
    sourceContext: {
      surface: "popup_deep_read",
      pageTitle: "Article",
      pageUrl: "https://example.com/a?private=1#note",
      hostname: "example.com",
      sentenceText: "The team showed resilience.",
    },
  }

  const ownedReadingItem: OwnedReadingItem = {
    id: "or_article_example",
    sourceType: "article",
    title: "Article",
    sourceUrl: "https://example.com/a",
    openedAt: savedAt,
    updatedAt: savedAt,
    status: "in_progress",
    userControl: { syncEnabled: true, excludedFromDigest: false, privacyModeAtCapture: true },
  }

  const studyProgress: StudyProgressStore = {
    pages: [{
      url: "https://example.com/a",
      hostname: "example.com",
      title: "Article",
      completedSteps: ["read", "vocab_save"],
      sentencesExplained: 1,
      vocabSaved: 1,
      vocabReviewed: 0,
      startedAt: savedAt,
      lastActivityAt: savedAt,
    }],
    dailyStats: {
      date: "2026-05-25",
      pagesStudied: 1,
      sentencesExplained: 1,
      vocabSaved: 1,
      vocabReviewed: 0,
    },
  }

  it("summarizes what Astra remembers without full content fields", () => {
    const inventory = buildLearningMemoryInventoryFromState({
      generatedAt: "2026-05-27T12:00:00.000Z",
      privacyMode: true,
      learningProfile: profile,
      vocabularyEntries: [vocabularyEntry],
      ownedReadingItems: [ownedReadingItem],
      readingHistory: [{
        id: "https://example.com/a",
        url: "https://example.com/a",
        hostname: "example.com",
        title: "Article",
        wordsTranslated: 120,
        visitedAt: savedAt,
      }],
      studyProgress,
    })

    expect(inventory).toMatchObject({
      schema: "astra-learning-memory-inventory.v1",
      privacyMode: true,
      personalizationEnabled: true,
      summary: {
        rememberedTermCount: 1,
        savedSnippetCount: 1,
        reviewCardCount: 1,
        ownedReadingCount: 1,
        readingHistoryCount: 1,
        studyProgressPageCount: 1,
      },
      contentPolicy: {
        includesFullPageText: false,
        includesFullTranscriptText: false,
        includesPromptText: false,
        includesModelOutput: false,
        includesFullUrlPaths: false,
      },
    })
    expect(inventory.sections.map((section) => section.id)).toEqual([
      "learning_profile",
      "remembered_terms",
      "saved_snippets",
      "source_history",
      "review_state",
      "privacy_controls",
    ])
    expect(inventory.privacyModeEffect).toContain("Privacy Mode is on")

    const serialized = JSON.stringify(inventory)
    expect(serialized).not.toContain("The team showed resilience")
    expect(serialized).not.toContain("private=1")
    expect(inventory.contentPolicy.description).toMatch(/does not include[^.]*prompts/i)
  })

  it("suppresses automatic personalization memory under Privacy Mode", () => {
    expect(evaluateLearningMemoryWritePolicy({
      surface: "topic_signal",
      privacyMode: true,
      personalizationEnabled: true,
    })).toMatchObject({
      decision: "suppress",
      reason: "Privacy Mode blocks automatic personalization memory.",
      allowedFields: [],
    })

    expect(evaluateLearningMemoryWritePolicy({
      surface: "source_history",
      privacyMode: true,
      personalizationEnabled: true,
    })).toMatchObject({
      decision: "reduce",
      allowedFields: ["sourceType", "hostname", "status", "count", "timestampBucket"],
      userFacingCopy: "Privacy Mode keeps this memory lightweight.",
    })
  })

  it("allows user-initiated saves while respecting personalization opt-outs", () => {
    expect(evaluateLearningMemoryWritePolicy({
      surface: "user_saved_snippet",
      privacyMode: true,
      personalizationEnabled: false,
      userInitiated: true,
    })).toMatchObject({
      decision: "allow",
      userFacingCopy: "Saved for your next review.",
    })

    expect(evaluateLearningMemoryWritePolicy({
      surface: "remembered_term",
      privacyMode: false,
      personalizationEnabled: true,
      userInitiated: false,
    })).toMatchObject({
      decision: "suppress",
      reason: "Remembered terms require explicit user confirmation.",
      userFacingCopy: "Astra will not save glossary or preference changes unless you confirm them.",
    })

    expect(evaluateLearningMemoryWritePolicy({
      surface: "remembered_term",
      privacyMode: false,
      personalizationEnabled: true,
      userInitiated: true,
    })).toMatchObject({
      decision: "allow",
      userFacingCopy: "Astra remembered this term for future reading.",
    })

    expect(evaluateLearningMemoryWritePolicy({
      surface: "remembered_term",
      privacyMode: false,
      personalizationEnabled: false,
      userInitiated: true,
    })).toMatchObject({
      decision: "suppress",
      reason: "Personalization memory is disabled.",
    })

    expect(evaluateLearningMemoryWritePolicy({
      surface: "study_progress",
      privacyMode: false,
      personalizationEnabled: true,
      hostnameExcluded: true,
    })).toMatchObject({
      decision: "suppress",
      reason: "This site is excluded from personalization memory.",
    })
  })

  it("registers graph-writing surfaces for Privacy Mode audit coverage", () => {
    expect(LEARNING_MEMORY_WRITE_AUDIT_REGISTRY.map((entry) => entry.id)).toEqual([
      "reading_history.record_page_translation",
      "study_progress.record_study_event",
      "owned_reading.upsert_owned_article_from_url",
      "owned_reading.sync_recent_reading_history_to_owned_queue",
      "vocabulary.save_vocabulary_entry",
      "vocabulary.record_vocabulary_review_schedule",
      "learning_profile.remember_preferred_term",
      "future.topic_signal",
      "future.digest_summary",
    ])

    expect(LEARNING_MEMORY_WRITE_AUDIT_REGISTRY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          functionName: "recordPageTranslation",
          surface: "source_history",
          initiation: "automatic",
          privacyModeExpectation: "reduce",
          userInitiated: false,
        }),
        expect.objectContaining({
          functionName: "recordStudyEvent",
          surface: "study_progress",
          initiation: "automatic",
          privacyModeExpectation: "reduce",
          userInitiated: false,
        }),
        expect.objectContaining({
          functionName: "upsertOwnedArticleFromUrl",
          surface: "source_history",
          initiation: "automatic",
          privacyModeExpectation: "reduce",
          userInitiated: false,
        }),
        expect.objectContaining({
          functionName: "syncRecentReadingHistoryToOwnedQueue",
          surface: "source_history",
          initiation: "automatic",
          privacyModeExpectation: "reduce",
          userInitiated: false,
        }),
        expect.objectContaining({
          functionName: "saveVocabularyEntry",
          surface: "user_saved_snippet",
          initiation: "explicit_user",
          privacyModeExpectation: "allow",
          userInitiated: true,
        }),
        expect.objectContaining({
          functionName: "recordVocabularyReviewSchedule",
          surface: "review_state",
          initiation: "explicit_user",
          privacyModeExpectation: "allow",
          userInitiated: true,
        }),
      ]),
    )
  })

  it("keeps registry expectations executable against the shared write policy", () => {
    for (const entry of LEARNING_MEMORY_WRITE_AUDIT_REGISTRY) {
      const result = evaluateLearningMemoryWritePolicy({
        surface: entry.surface,
        privacyMode: true,
        personalizationEnabled: true,
        userInitiated: entry.userInitiated,
      })

      expect(result.decision, entry.id).toBe(entry.privacyModeExpectation)
    }
  })

  it("documents that registry entries do not store raw content", () => {
    for (const entry of LEARNING_MEMORY_WRITE_AUDIT_REGISTRY) {
      expect(entry.contentBoundary).toEqual({
        storesFullPageText: false,
        storesFullTranscriptText: false,
        storesPromptText: false,
        storesModelOutput: false,
        storesRawUrlWithQueryOrHash: false,
      })
    }

    const registryJson = JSON.stringify(LEARNING_MEMORY_WRITE_AUDIT_REGISTRY)
    expect(registryJson).not.toContain("The team showed resilience")
    expect(registryJson).not.toContain("private=1")
    expect(registryJson).not.toContain("token=secret")
    expect(registryJson).not.toContain("fullTranscript")
    expect(registryJson).not.toContain("promptText")
    expect(registryJson).not.toContain("modelOutput")
  })
})
