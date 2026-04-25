import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  applyVocabularySyncMutations,
  buildSyncSafeVocabularyEntry,
  buildTerminologyGlossary,
  getVocabularyCount,
  getVocabularyEntries,
  hasVocabularyEntryByText,
  listGlossaryEntriesForHostname,
  removeVocabularyEntry,
  saveVocabularyEntry,
  serializeGlossary,
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

    expect(await getVocabularyCount()).toBe(1)
    await removeVocabularyEntry(entry.id)
    expect(await getVocabularyCount()).toBe(0)
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
