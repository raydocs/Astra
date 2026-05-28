import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import type { OwnedReadingThemePackPackagePayload } from "./owned-reading"
import { getVocabularySourceSurfaceLabel } from "./vocabulary-core"
import {
  applyVocabularyReviewScheduleSyncMutationsToStorage,
  applyVocabularySyncMutations,
  buildSyncSafeVocabularyEntry,
  buildTerminologyGlossary,
  deriveWeeklyVocabularyRoi,
  getVocabularyCount,
  getVocabularyEntries,
  hasVocabularyEntryByText,
  readSyncSafeVocabularyReviewSchedules,
  importVocabularyEntriesFromThemePackPayload,
  previewVocabularyEntriesFromThemePackPayload,
  listGlossaryEntriesForHostname,
  recordVocabularyReviewSchedule,
  removeVocabularyEntry,
  removeVocabularyEntries,
  saveVocabularyEntry,
  serializeGlossary,
  VOCABULARY_REVIEW_SCHEDULE_STORAGE_KEY,
  VOCABULARY_STORAGE_KEY,
} from "./vocabulary"

describe("vocabulary storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("saves and retrieves a vocabulary entry", async () => {
    const entry = await saveVocabularyEntry({
      text: "ephemeral",
      translation: "短暂的",
      context: "The ephemeral beauty of cherry blossoms",
      url: "https://example.com/article",
      hostname: "example.com",
    })

    expect(entry.id).toBeTruthy()
    expect(entry.savedAt).toBeGreaterThan(0)
    expect(entry.text).toBe("ephemeral")

    const entries = await getVocabularyEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].text).toBe("ephemeral")
    expect(entries[0].translation).toBe("短暂的")
  })

  it("accepts sample lesson entries with source context", async () => {
    const entry = await saveVocabularyEntry({
      text: "inhabit a difficult sentence",
      translation: "进入一句难懂的话",
      context: "To inhabit a difficult sentence, you have to be willing to sit with it.",
      url: "astra-sample://first-lesson/quiet-reading",
      hostname: "astra-sample",
      sourceContext: {
        surface: "sample_lesson",
        pageTitle: "Astra Sample Lesson: The Quiet Architecture of Reading",
        pageUrl: "astra-sample://first-lesson/quiet-reading",
        hostname: "astra-sample",
        sentenceText: "To inhabit a difficult sentence, you have to be willing to sit with it.",
        sentenceIndex: 0,
        ownedReadingSourceType: "article",
        ownedReadingTitle: "Astra Sample Lesson: The Quiet Architecture of Reading",
      },
    })

    expect(entry.sourceContext?.surface).toBe("sample_lesson")
    expect(getVocabularySourceSurfaceLabel(entry.sourceContext?.surface)).toBe("Sample lesson")

    const entries = await getVocabularyEntries()
    expect(entries[0].sourceContext?.surface).toBe("sample_lesson")
  })

  it("deduplicates entries with same text and url", async () => {
    await saveVocabularyEntry({
      text: "hello",
      translation: "你好",
      url: "https://example.com/page",
    })

    await saveVocabularyEntry({
      text: "hello",
      translation: "你好（更新）",
      url: "https://example.com/page",
    })

    const entries = await getVocabularyEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].translation).toBe("你好（更新）")
  })

  it("allows same text from different urls", async () => {
    await saveVocabularyEntry({
      text: "hello",
      url: "https://a.com",
    })

    await saveVocabularyEntry({
      text: "hello",
      url: "https://b.com",
    })

    expect(await getVocabularyCount()).toBe(2)
  })

  it("removes an entry by id", async () => {
    const entry = await saveVocabularyEntry({
      text: "remove-me",
    })

    await recordVocabularyReviewSchedule({
      vocabularyEntryId: entry.id,
      srsBox: 3,
      nextReviewAt: 300,
      reviewCount: 1,
      lastReviewedAt: 200,
      grade: "good",
    })

    expect(await getVocabularyCount()).toBe(1)
    await removeVocabularyEntry(entry.id)
    expect(await getVocabularyCount()).toBe(0)
    expect(await readSyncSafeVocabularyReviewSchedules()).toEqual([])
  })

  it("bulk removes entries and their review schedule records", async () => {
    const keep = await saveVocabularyEntry({ text: "keep" })
    const removeA = await saveVocabularyEntry({ text: "remove-a" })
    const removeB = await saveVocabularyEntry({ text: "remove-b" })

    await applyVocabularyReviewScheduleSyncMutationsToStorage([
      {
        recordId: keep.id,
        operation: "upsert",
        payload: {
          vocabularyEntryId: keep.id,
          srsBox: 2,
          nextReviewAt: 200,
          reviewCount: 1,
          lastReviewedAt: 100,
          lastReviewGrade: "good",
          lastReviewGradeAt: 100,
          updatedAt: 100,
        },
      },
      {
        recordId: removeA.id,
        operation: "upsert",
        payload: {
          vocabularyEntryId: removeA.id,
          srsBox: 4,
          nextReviewAt: 400,
          reviewCount: 2,
          lastReviewedAt: 300,
          lastReviewGrade: "easy",
          lastReviewGradeAt: 300,
          updatedAt: 300,
        },
      },
      {
        recordId: removeB.id,
        operation: "upsert",
        payload: {
          vocabularyEntryId: removeB.id,
          srsBox: 1,
          nextReviewAt: 500,
          reviewCount: 1,
          lastReviewedAt: 450,
          lastReviewGrade: "again",
          lastReviewGradeAt: 450,
          updatedAt: 450,
        },
      },
    ])

    await removeVocabularyEntries([removeA.id, removeB.id])

    expect((await getVocabularyEntries()).map((entry) => entry.id)).toEqual([keep.id])
    expect(await readSyncSafeVocabularyReviewSchedules()).toEqual([expect.objectContaining({ vocabularyEntryId: keep.id })])
    const storage = (globalThis as { __ASTRA_TEST_BROWSER__?: { __storage?: Record<string, unknown> } }).__ASTRA_TEST_BROWSER__?.__storage ?? {}
    expect(storage[VOCABULARY_REVIEW_SCHEDULE_STORAGE_KEY]).toEqual([expect.objectContaining({ vocabularyEntryId: keep.id })])
  })

  it("prepends new entries (most recent first)", async () => {
    await saveVocabularyEntry({ text: "first" })
    await saveVocabularyEntry({ text: "second" })

    const entries = await getVocabularyEntries()
    expect(entries[0].text).toBe("second")
    expect(entries[1].text).toBe("first")
  })

  it("returns empty array when no entries exist", async () => {
    const entries = await getVocabularyEntries()
    expect(entries).toEqual([])
    expect(await getVocabularyCount()).toBe(0)
  })

  it("checks whether a vocabulary entry already exists by source text", async () => {
    await saveVocabularyEntry({
      text: "Hello world",
      translation: "你好，世界",
      url: "https://example.com/page-a",
    })
    await saveVocabularyEntry({
      text: "Hello world",
      translation: "你好，世界（另一个来源）",
      url: "https://example.com/page-b",
    })

    expect(await hasVocabularyEntryByText("hello world")).toBe(true)
    expect(await hasVocabularyEntryByText("  HELLO WORLD  ")).toBe(true)
    expect(await hasVocabularyEntryByText("goodbye world")).toBe(false)
  })

  it("derives weekly vocabulary ROI from saved and reviewed SRS entries", () => {
    const now = new Date("2026-04-09T12:00:00.000Z").getTime()
    const entries = [
      {
        id: "mastered-this-week",
        text: "retained",
        savedAt: now - 2 * 24 * 60 * 60_000,
        srsBox: 4,
        nextReviewAt: now + 2 * 24 * 60 * 60_000,
        reviewCount: 3,
        lastReviewedAt: now - 60_000,
      },
      {
        id: "missed-review",
        text: "retry",
        savedAt: now - 3 * 24 * 60 * 60_000,
        srsBox: 1,
        nextReviewAt: now + 24 * 60 * 60_000,
        reviewCount: 1,
        lastReviewedAt: now - 2 * 60_000,
      },
      {
        id: "old-mastered",
        text: "old",
        savedAt: now - 10 * 24 * 60 * 60_000,
        srsBox: 5,
        nextReviewAt: now + 10 * 24 * 60 * 60_000,
        reviewCount: 5,
        lastReviewedAt: now - 9 * 24 * 60 * 60_000,
      },
    ]

    expect(deriveWeeklyVocabularyRoi(entries, { now })).toEqual({
      window: {
        startAt: now - 7 * 24 * 60 * 60_000,
        endAt: now,
        days: 7,
      },
      savedCount: 2,
      reviewedCount: 2,
      masteredCount: 1,
      reviewHitCount: 1,
      reviewAttemptCount: 2,
      reviewHitRate: 50,
    })
  })

  it("builds a sync-safe vocabulary entry without SRS fields and with sanitized urls", async () => {
    const entry = await saveVocabularyEntry({
      text: "router",
      translation: "路由器",
      url: "https://example.com/page?x=1#fragment",
    })

    const synced = buildSyncSafeVocabularyEntry(entry)
    expect(synced).not.toHaveProperty("srsBox")
    expect(synced.url).toBe("https://example.com/page")
  })

  it("imports verified theme-pack vocabulary entries into existing local storage only", async () => {
    await saveVocabularyEntry({
      text: "existing",
      url: "https://example.com/article",
      translation: "已存在",
    })

    const payload: OwnedReadingThemePackPackagePayload = {
      schema: "astra-owned-reading-theme-pack-payload.v3",
      generatedAt: "2026-04-29T00:00:00.000Z",
      ownedReading: {
        schema: "astra-owned-reading-theme-packs.v1",
        generatedAt: "2026-04-29T00:00:00.000Z",
        assetCount: 1,
        themePackCount: 1,
        themePacks: [{
          id: "theme_article-example-com",
          themeKey: "article:example.com",
          title: "Articles from example.com",
          assetCount: 1,
          assets: [{
            id: "or_article_example",
            sourceType: "article",
            sourceTypeLabel: "Article",
            title: "Example article",
            status: "saved",
            openedAt: 100,
            updatedAt: 100,
            sourceUrl: "https://example.com/article",
            localUri: null,
            readingHistoryRecordId: "https://example.com/article",
            studyProgressRecordId: "https://example.com/article",
          }],
        }],
      },
      vocabularyEntries: [
        {
          id: "entry-new",
          text: "assetized",
          translation: "资产化",
          url: "https://example.com/article",
          hostname: "example.com",
          savedAt: 200,
          sourceContext: {
            surface: "popup_deep_read",
            pageTitle: "Example article",
            pageUrl: "https://example.com/article",
            hostname: "example.com",
            ownedReadingItemId: "or_article_example",
            ownedReadingSourceType: "article",
            ownedReadingTitle: "Example article",
          },
        },
        {
          id: "entry-unlinked",
          text: "outside",
          savedAt: 300,
        },
      ],
    }

    const preview = await previewVocabularyEntriesFromThemePackPayload(payload)
    const first = await importVocabularyEntriesFromThemePackPayload(payload)
    const conflictPreview = await previewVocabularyEntriesFromThemePackPayload(payload)
    const second = await importVocabularyEntriesFromThemePackPayload(payload)

    expect(preview).toEqual({
      totalCount: 1,
      importedCount: 1,
      skippedCount: 0,
      conflicts: [],
      rollback: { removeCount: 1 },
    })
    expect(first).toEqual({ importedCount: 1, skippedCount: 0 })
    expect(conflictPreview).toEqual({
      totalCount: 1,
      importedCount: 0,
      skippedCount: 1,
      conflicts: [{ id: "entry-new", text: "assetized", reason: "id" }],
      rollback: { removeCount: 0 },
    })
    expect(second).toEqual({ importedCount: 0, skippedCount: 1 })
    expect((await getVocabularyEntries()).map((entry) => entry.id)).toContain("entry-new")
    expect((await getVocabularyEntries()).map((entry) => entry.id)).not.toContain("entry-unlinked")
  })

  it("round-trips subtitle_reader source context metadata", async () => {
    await saveVocabularyEntry({
      text: "Hello from subtitles",
      context: "sample.srt · row 1",
      url: "astra-local://subtitle/sample.srt",
      hostname: "subtitle-reader",
      sourceContext: {
        surface: "subtitle_reader",
        pageTitle: "sample.srt",
        pageUrl: "astra-local://subtitle/sample.srt",
        hostname: "subtitle-reader",
        contentSummary: "SRT · 12 items",
        sentenceText: "Hello from subtitles",
        sentenceIndex: 0,
        ownedReadingItemId: "or_subtitle_sample",
        ownedReadingSourceType: "subtitle-file",
        ownedReadingTitle: "sample.srt · SRT · 12 items",
      },
    })

    const entries = await getVocabularyEntries()
    expect(entries[0].url).toBe("astra-local://subtitle/sample.srt")
    expect(entries[0].hostname).toBe("subtitle-reader")
    expect(entries[0].sourceContext?.surface).toBe("subtitle_reader")
    expect(entries[0].sourceContext?.pageTitle).toBe("sample.srt")
    expect(entries[0].sourceContext?.pageUrl).toBe("astra-local://subtitle/sample.srt")
    expect(entries[0].sourceContext?.contentSummary).toBe("SRT · 12 items")
    expect(entries[0].sourceContext?.ownedReadingItemId).toBe("or_subtitle_sample")
  })

  it("round-trips popup source context metadata", async () => {
    await saveVocabularyEntry({
      text: "ephemeral",
      explanation: "Used in the article to describe a short-lived phase.",
      context: "The ephemeral phase passes quickly.",
      url: "https://example.com/article",
      hostname: "example.com",
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        pageUrl: "https://example.com/article?view=full",
        hostname: "example.com",
        articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
        sentenceText: "The ephemeral phase passes quickly.",
        sentenceIndex: 0,
        languageLevel: "beginner",
        explainMode: "exam",
        ownedReadingItemId: "or_article_example",
        ownedReadingSourceType: "article",
        ownedReadingTitle: "Example article",
        studyProgressRecordId: "https://example.com/article?tracked=1",
      },
    })

    const entries = await getVocabularyEntries()
    expect(entries[0].sourceContext).toEqual({
      surface: "popup_deep_read",
      pageTitle: "Example article",
      pageUrl: "https://example.com/article",
      hostname: "example.com",
      articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
      sentenceText: "The ephemeral phase passes quickly.",
      sentenceHash: expect.stringMatching(/^fnv1a:/),
      sentenceIndex: 0,
      languageLevel: "beginner",
      explainMode: "exam",
      ownedReadingItemId: "or_article_example",
      ownedReadingSourceType: "article",
      ownedReadingTitle: "Example article",
      studyProgressRecordId: "https://example.com/article",
    })
  })

  it("merges source context when resaving a deduped entry", async () => {
    await saveVocabularyEntry({
      text: "review",
      url: "https://example.com/article",
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        pageUrl: "https://example.com/article#section",
        hostname: "example.com",
        sentenceText: "Review this sentence.",
      },
    })

    await saveVocabularyEntry({
      text: "review",
      url: "https://example.com/article",
      explanation: "A follow-up explanation.",
      sourceContext: {
        surface: "popup_deep_read",
        articleExcerpt: "Review this sentence. Then continue reading.",
        sentenceIndex: 1,
      },
    })

    const entries = await getVocabularyEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].sourceContext).toEqual({
      surface: "popup_deep_read",
      pageTitle: "Example article",
      pageUrl: "https://example.com/article",
      hostname: "example.com",
      sentenceText: "Review this sentence.",
      sentenceHash: expect.stringMatching(/^fnv1a:/),
      articleExcerpt: "Review this sentence. Then continue reading.",
      sentenceIndex: 1,
    })
  })

  it("preserves owned reading source link metadata when resaving a deduped entry", async () => {
    await saveVocabularyEntry({
      text: "continuity",
      url: "https://example.com/article",
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        ownedReadingItemId: "or_article_example",
        ownedReadingSourceType: "article",
        ownedReadingTitle: "Example article",
        studyProgressRecordId: "https://example.com/article",
      },
    })

    await saveVocabularyEntry({
      text: "continuity",
      url: "https://example.com/article",
      sourceContext: {
        surface: "popup_deep_read",
        sentenceText: "Continuity sentence.",
      },
    })

    const entries = await getVocabularyEntries()
    expect(entries[0].sourceContext).toEqual({
      surface: "popup_deep_read",
      pageTitle: "Example article",
      pageUrl: "https://example.com/article",
      contentSummary: undefined,
      articleExcerpt: undefined,
      hostname: undefined,
      sentenceText: "Continuity sentence.",
      sentenceHash: expect.stringMatching(/^fnv1a:/),
      ownedReadingItemId: "or_article_example",
      ownedReadingSourceType: "article",
      ownedReadingTitle: "Example article",
      studyProgressRecordId: "https://example.com/article",
    })
  })

  it("builds the canonical terminology glossary with hostname entries before global entries", async () => {
    await saveVocabularyEntry({
      text: "Astra",
      translation: "旧词条",
      glossaryEnabled: true,
      glossaryScope: "global",
    })
    await saveVocabularyEntry({
      text: "router",
      glossaryTargetText: "路由器",
      glossaryEnabled: true,
      glossaryScope: "global",
    })
    await saveVocabularyEntry({
      text: "Astra",
      translation: "阿斯特拉",
      hostname: "example.com",
      glossaryEnabled: true,
      glossaryScope: "hostname",
    })

    const entries = await listGlossaryEntriesForHostname("example.com")
    expect(entries.map((entry) => entry.text)).toEqual(["Astra", "router"])
    expect(serializeGlossary(entries)).toBe("Astra => 阿斯特拉\nrouter => 路由器")
    expect(await buildTerminologyGlossary("example.com")).toBe("Astra => 阿斯特拉\nrouter => 路由器")
  })

  it("uses only global glossary entries when hostname is unavailable", async () => {
    await saveVocabularyEntry({
      text: "router",
      glossaryTargetText: "路由器",
      glossaryEnabled: true,
      glossaryScope: "global",
    })
    await saveVocabularyEntry({
      text: "Astra",
      translation: "阿斯特拉",
      hostname: "example.com",
      glossaryEnabled: true,
      glossaryScope: "hostname",
    })

    expect(await buildTerminologyGlossary(undefined)).toBe("router => 路由器")
  })

  it("escapes embedded newlines and separator-like content in the canonical glossary format", async () => {
    await saveVocabularyEntry({
      text: "Line 1\nLine 2 => term",
      glossaryTargetText: "target\nline => value",
      glossaryEnabled: true,
      glossaryScope: "global",
    })

    expect(await buildTerminologyGlossary(undefined)).toBe("Line 1\\nLine 2 \\=> term => target\\nline \\=> value")
  })

  it("projects safe default review schedule records for old entries", async () => {
    setMockBrowser(createMockBrowser({
      [VOCABULARY_STORAGE_KEY]: [{
        id: "old-word",
        text: "legacy",
        savedAt: 100,
        srsBox: 2,
        nextReviewAt: 200,
      }],
    }))

    const entries = await getVocabularyEntries()
    expect(entries[0]).toMatchObject({
      id: "old-word",
      srsBox: 2,
      nextReviewAt: 200,
      reviewCount: 0,
      lastReviewedAt: null,
    })

    const schedules = await readSyncSafeVocabularyReviewSchedules()
    expect(schedules).toEqual([expect.objectContaining({
      vocabularyEntryId: "old-word",
      srsBox: 2,
      nextReviewAt: 200,
      reviewCount: 0,
      lastReviewedAt: null,
      lastReviewGrade: null,
      lastReviewGradeAt: null,
      updatedAt: 100,
    })])
  })

  it("applies review schedule sync records separately from vocabulary text records", async () => {
    const entry = await saveVocabularyEntry({
      text: "durable",
      srsBox: 1,
      nextReviewAt: 100,
      reviewCount: 0,
      lastReviewedAt: null,
    })

    await applyVocabularyReviewScheduleSyncMutationsToStorage([{
      recordId: entry.id,
      operation: "upsert",
      payload: {
        vocabularyEntryId: entry.id,
        srsBox: 4,
        nextReviewAt: 400,
        reviewCount: 3,
        lastReviewedAt: 350,
        lastReviewGrade: "easy",
        lastReviewGradeAt: 350,
        updatedAt: Date.now() + 1_000,
      },
    }])

    const entries = await getVocabularyEntries()
    expect(entries[0]).toMatchObject({
      id: entry.id,
      text: "durable",
      srsBox: 4,
      nextReviewAt: 400,
      reviewCount: 3,
      lastReviewedAt: 350,
      lastReviewGrade: "easy",
      lastReviewGradeAt: 350,
    })

    const schedules = await readSyncSafeVocabularyReviewSchedules()
    expect(schedules).toEqual([expect.objectContaining({
      vocabularyEntryId: entry.id,
      srsBox: 4,
      nextReviewAt: 400,
      reviewCount: 3,
      lastReviewGrade: "easy",
    })])
  })

  it("applies synced vocabulary updates while preserving local review progress", async () => {
    const existing = await saveVocabularyEntry({
      text: "review",
      translation: "复习",
      srsBox: 4,
      nextReviewAt: 200,
      reviewCount: 3,
      lastReviewedAt: 150,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Original title",
        pageUrl: "https://example.com/review?from=sync",
        hostname: "example.com",
        sentenceText: "Original sentence",
      },
    })

    const nextEntries = applyVocabularySyncMutations(await getVocabularyEntries(), [{
      recordId: existing.id,
      operation: "upsert",
      payload: {
        id: existing.id,
        text: "review",
        translation: "回顾",
        savedAt: existing.savedAt,
        sourceContext: {
          surface: "popup_deep_read",
          articleExcerpt: "Original sentence. Supporting excerpt.",
        },
      },
    }])

    expect(nextEntries[0]).toMatchObject({
      id: existing.id,
      translation: "回顾",
      srsBox: 4,
      reviewCount: 3,
      lastReviewedAt: 150,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Original title",
        pageUrl: "https://example.com/review",
        hostname: "example.com",
        sentenceText: "Original sentence",
        articleExcerpt: "Original sentence. Supporting excerpt.",
      },
    })
  })
})
