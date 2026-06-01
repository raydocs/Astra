import { describe, expect, it } from "vitest"

import type { OwnedReadingItem } from "./owned-reading"
import {
  buildLearningAssetProjection,
  buildLocalWeeklyDigestViewModel,
  deriveClozeCards,
  deriveVideoMomentCards,
  deriveWeeklyReviewableLearningMoments,
  reviewCardFromVocabularyEntry,
  savedSnippetFromVocabularyEntry,
  sourceContentFromOwnedReadingItem,
  vocabularyItemFromVocabularyEntry,
} from "./learning-assets"
import type { VocabularyEntry } from "./vocabulary-core"

describe("learning asset adapters", () => {
  const savedAt = Date.UTC(2026, 4, 25)
  const reviewedAt = Date.UTC(2026, 4, 26)

  const vocabularyEntry: VocabularyEntry = {
    id: "vocab-1",
    text: "resilience",
    translation: "韧性",
    explanation: "Useful word for describing recovery under pressure.",
    context: "The team showed resilience.",
    savedAt,
    srsBox: 3,
    nextReviewAt: Date.UTC(2026, 4, 28),
    reviewCount: 1,
    lastReviewedAt: reviewedAt,
    lastReviewGrade: "good",
    sourceContext: {
      surface: "popup_deep_read",
      pageTitle: "The Quiet Architecture of Reading",
      pageUrl: "https://example.com/article?utm=secret#note",
      hostname: "example.com",
      sentenceText: "The team showed resilience under pressure.",
      sentenceIndex: 4,
      contentSummary: "An article about reading habits.",
      languageLevel: "intermediate",
    },
  }

  it("maps owned reading rows to SourceContent", () => {
    const item: OwnedReadingItem = {
      id: "or_article_https%3A%2F%2Fexample.com%2Fa",
      sourceType: "article",
      title: "A sample article",
      sourceUrl: "https://example.com/a",
      openedAt: savedAt,
      updatedAt: reviewedAt,
      status: "in_progress",
      progress: { fraction: 0.42, sentenceIndex: 7 },
    }

    expect(sourceContentFromOwnedReadingItem({
      ...item,
      userControl: { syncEnabled: false, excludedFromDigest: true, privacyModeAtCapture: true },
    })).toMatchObject({
      id: item.id,
      type: "page",
      title: "A sample article",
      progress: {
        status: "in_progress",
        percent: 42,
        lastPosition: { selectorAnchor: "sentence:7" },
      },
      userControl: {
        syncEnabled: false,
        excludedFromDigest: true,
        privacyModeAtCapture: true,
      },
    })
  })

  it("projects a legacy vocabulary entry into SavedSnippet, VocabularyItem, and ReviewCard", () => {
    const snippet = savedSnippetFromVocabularyEntry(vocabularyEntry)
    const vocabularyItem = vocabularyItemFromVocabularyEntry(vocabularyEntry, "zh-CN")
    const card = reviewCardFromVocabularyEntry(vocabularyEntry)

    expect(snippet).toMatchObject({
      id: "snippet_vocab-1",
      text: "The team showed resilience under pressure.",
      translation: "韧性",
      reviewCardIds: ["card_vocab-1"],
    })
    expect(snippet.sourceContentId).toBe("src_https%3A%2F%2Fexample.com%2Farticle")

    expect(vocabularyItem).toMatchObject({
      id: "vocab-1",
      surfaceText: "resilience",
      normalizedText: "resilience",
      language: "unknown",
      targetLanguage: "zh-CN",
      translation: "韧性",
      sourceSnippetIds: ["snippet_vocab-1"],
      masteryState: "familiar",
      examples: [{
        snippetId: "snippet_vocab-1",
        sentence: "The team showed resilience under pressure.",
        translation: "韧性",
      }],
      createdAt: savedAt,
      updatedAt: reviewedAt,
    })

    expect(card).toMatchObject({
      id: "card_vocab-1",
      cardType: "word",
      front: "resilience",
      state: "familiar",
      linkedSnippetId: "snippet_vocab-1",
      linkedVocabularyId: "vocab-1",
    })
  })

  it("excludes source-controlled items from weekly digest metrics", () => {
    const ownedReadingItem: OwnedReadingItem = {
      id: "or_article_digest_excluded",
      sourceType: "article",
      title: "Digest excluded article",
      sourceUrl: "https://example.com/article",
      openedAt: savedAt,
      updatedAt: reviewedAt,
      status: "saved",
      userControl: { syncEnabled: true, excludedFromDigest: true, privacyModeAtCapture: false },
    }
    const linkedVocabularyEntry: VocabularyEntry = {
      ...vocabularyEntry,
      sourceContext: {
        ...vocabularyEntry.sourceContext!,
        ownedReadingItemId: ownedReadingItem.id,
        ownedReadingSourceType: "article",
        ownedReadingTitle: ownedReadingItem.title,
      },
    }

    const projection = buildLearningAssetProjection({
      vocabularyEntries: [linkedVocabularyEntry],
      ownedReadingItems: [ownedReadingItem],
    })
    expect(projection.vocabularyItems).toHaveLength(1)
    const summary = deriveWeeklyReviewableLearningMoments(projection, {
      weekStartAt: Date.UTC(2026, 4, 24),
      weekEndAt: Date.UTC(2026, 4, 31),
    })

    expect(summary.savedSnippetCount).toBe(0)
    expect(summary.reviewableLearningMoments).toBe(0)
  })

  it("builds a local weekly digest view model without raw learning content", () => {
    const projection = buildLearningAssetProjection({ vocabularyEntries: [vocabularyEntry] })
    expect(projection.vocabularyItems[0]).toMatchObject({
      id: "vocab-1",
      sourceSnippetIds: ["snippet_vocab-1"],
      masteryState: "familiar",
    })
    const digest = buildLocalWeeklyDigestViewModel(projection, {
      weekStartAt: Date.UTC(2026, 4, 24),
      weekEndAt: Date.UTC(2026, 4, 31),
    })

    expect(digest).toMatchObject({
      savedSnippetCount: 1,
      reviewedCardCount: 1,
      sourceCount: 1,
      headline: "You saved 1 reviewable moment this week.",
      sourceBreakdown: [expect.objectContaining({
        title: "The Quiet Architecture of Reading",
        type: "page",
        savedSnippetCount: 1,
        reviewedCardCount: 1,
      })],
    })
    expect(digest.detail).toContain("1 source contributed")
    expect(JSON.stringify(digest)).not.toContain("resilience")
    expect(JSON.stringify(digest)).not.toContain("The team showed")
  })

  it("builds digest topics, repeated vocabulary, review count, and continue target from metadata-safe assets", () => {
    const projection = buildLearningAssetProjection({ vocabularyEntries: [vocabularyEntry] })
    projection.sourceContents[0] = {
      ...projection.sourceContents[0]!,
      summary: { short: "Reading habits", topics: ["reading", "resilience"], difficulty: "intermediate" },
      progress: { status: "reviewed", percent: 42, lastPosition: { selectorAnchor: "sentence:4" } },
    }
    projection.sourceContents.push({
      ...projection.sourceContents[0]!,
      id: "src_https%3A%2F%2Fexample.org%2Fsecond",
      title: "Second article",
      canonicalUrl: "https://example.org/second",
      hostname: "example.org",
      lastStudiedAt: reviewedAt + 1,
      summary: { short: "Another topic source", topics: ["resilience"], difficulty: "intermediate" },
      progress: { status: "in_progress", percent: 64, lastPosition: { selectorAnchor: "sentence:9" } },
    })
    projection.savedSnippets.push({
      ...projection.savedSnippets[0]!,
      id: "snippet_vocab-2",
      sourceContentId: "src_https%3A%2F%2Fexample.org%2Fsecond",
      reviewCardIds: ["card_vocab-2"],
    })
    projection.vocabularyItems.push({
      ...projection.vocabularyItems[0]!,
      id: "vocab-2",
      sourceSnippetIds: ["snippet_vocab-2"],
      updatedAt: reviewedAt,
    })
    projection.reviewCards.push({
      ...projection.reviewCards[0]!,
      id: "card_vocab-2",
      linkedSnippetId: "snippet_vocab-2",
      linkedVocabularyId: "vocab-2",
      linkedSourceContentId: "src_https%3A%2F%2Fexample.org%2Fsecond",
      lastReviewedAt: reviewedAt,
    })

    const digest = buildLocalWeeklyDigestViewModel(projection, {
      weekStartAt: Date.UTC(2026, 4, 24),
      weekEndAt: Date.UTC(2026, 4, 31),
    })

    expect(digest.commonTopics).toEqual([
      { label: "resilience", sourceCount: 2 },
      { label: "reading", sourceCount: 1 },
    ])
    expect(digest.repeatedVocabulary).toEqual([{ surfaceText: "resilience", sourceCount: 2, reviewCount: 2 }])
    expect(digest.recommendedReviewCount).toBe(2)
    expect(digest.recommendedContinueTarget).toEqual(expect.objectContaining({
      sourceContentId: "src_https%3A%2F%2Fexample.org%2Fsecond",
      title: "Second article",
      type: "page",
      lastPositionLabel: "sentence 10",
    }))
    expect(JSON.stringify(digest)).not.toContain("The team showed")
  })

  it("calculates weekly reviewable learning moments without storing raw telemetry content", () => {
    const projection = buildLearningAssetProjection({ vocabularyEntries: [vocabularyEntry] })
    const summary = deriveWeeklyReviewableLearningMoments(projection, {
      weekStartAt: Date.UTC(2026, 4, 24),
      weekEndAt: Date.UTC(2026, 4, 31),
    })

    expect(summary).toMatchObject({
      savedSnippetCount: 1,
      reviewedCardCount: 1,
      returnToSourceCount: 1,
      reviewableLearningMoments: 1,
    })
    expect(summary.weightedReviewableLearningMoments).toBe(3.7)
    expect(JSON.stringify(summary)).not.toContain("resilience")
    expect(JSON.stringify(summary)).not.toContain("The team showed")
  })
})

describe("video moment cards (derived view)", () => {
  const savedAt = Date.UTC(2026, 4, 25)
  const videoEntry: VocabularyEntry = {
    id: "vocab-video-1",
    text: "be willing to sit with it",
    translation: "愿意静下心来慢慢琢磨它",
    explanation: "Stay with a hard idea patiently.",
    context: "YouTube transcript · 2:05",
    savedAt,
    srsBox: 1,
    nextReviewAt: savedAt,
    reviewCount: 0,
    lastReviewedAt: null,
    sourceContext: {
      surface: "video_transcript",
      pageTitle: "The Quiet Architecture of Reading (talk)",
      pageUrl: "https://www.youtube.com/watch?v=abc123",
      hostname: "www.youtube.com",
      sentenceText: "you have to be willing to sit with it",
      videoTimestampMs: 125_000,
    },
  }

  it("classifies a YouTube transcript save as a video_moment and carries the timestamp", () => {
    const card = reviewCardFromVocabularyEntry(videoEntry)
    expect(card.cardType).toBe("video_moment")

    const snippet = savedSnippetFromVocabularyEntry(videoEntry)
    expect(snippet.anchor.timestampMs).toBe(125_000)

    const projection = buildLearningAssetProjection({ vocabularyEntries: [videoEntry] })
    const source = projection.sourceContents[0]
    expect(source?.type).toBe("video")
    expect(source?.progress.lastPosition?.timestampMs).toBe(125_000)
  })

  it("derives a VideoMomentCard with a replay URL and formatted timestamp", () => {
    const projection = buildLearningAssetProjection({ vocabularyEntries: [videoEntry] })
    const moments = deriveVideoMomentCards(projection)

    expect(moments).toHaveLength(1)
    const moment = moments[0]!
    expect(moment.videoTitle).toBe("The Quiet Architecture of Reading (talk)")
    expect(moment.timestampMs).toBe(125_000)
    expect(moment.formattedTimestamp).toBe("2:05")
    expect(moment.replayUrl).toBe("https://www.youtube.com/watch?v=abc123&t=125s")
    expect(moment.front).toBe("be willing to sit with it")
  })

  it("returns no video moments for a plain page save", () => {
    const pageEntry: VocabularyEntry = {
      ...videoEntry,
      id: "vocab-page-1",
      sourceContext: { surface: "popup_deep_read", pageTitle: "Article", pageUrl: "https://example.com/a", hostname: "example.com" },
    }
    const projection = buildLearningAssetProjection({ vocabularyEntries: [pageEntry] })
    expect(deriveVideoMomentCards(projection)).toHaveLength(0)
  })

  it("derives a cloze card from a word saved with its source sentence", () => {
    const wordWithSentence: VocabularyEntry = {
      id: "vocab-cloze-1",
      text: "resilience",
      translation: "韧性",
      savedAt: Date.UTC(2026, 4, 27),
      srsBox: 2,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Article",
        pageUrl: "https://example.com/a",
        hostname: "example.com",
        sentenceText: "The team showed resilience under pressure.",
      },
    }
    const projection = buildLearningAssetProjection({ vocabularyEntries: [wordWithSentence] })
    const clozes = deriveClozeCards(projection)
    expect(clozes).toHaveLength(1)
    expect(clozes[0]).toMatchObject({
      reviewCardId: "card_vocab-cloze-1",
      prompt: "The team showed _____ under pressure.",
      answer: "resilience",
    })
  })

  it("derives no cloze when the saved word has no real source sentence", () => {
    const wordOnly: VocabularyEntry = {
      id: "vocab-word-only",
      text: "resilience",
      translation: "韧性",
      savedAt: Date.UTC(2026, 4, 27),
      srsBox: 1,
      sourceContext: { surface: "popup_deep_read", pageTitle: "Article", pageUrl: "https://example.com/a", hostname: "example.com" },
    }
    const projection = buildLearningAssetProjection({ vocabularyEntries: [wordOnly] })
    expect(deriveClozeCards(projection)).toHaveLength(0)
  })
})
