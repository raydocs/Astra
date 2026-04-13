import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  applyVocabularySyncMutations,
  buildSyncSafeVocabularyEntry,
  getVocabularyCount,
  getVocabularyEntries,
  removeVocabularyEntry,
  saveVocabularyEntry,
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
        articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
        sentenceText: "The ephemeral phase passes quickly.",
        sentenceIndex: 0,
      },
    })

    const entries = await getVocabularyEntries()
    expect(entries[0].sourceContext).toEqual({
      surface: "popup_deep_read",
      pageTitle: "Example article",
      articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
      sentenceText: "The ephemeral phase passes quickly.",
      sentenceIndex: 0,
    })
  })

  it("merges source context when resaving a deduped entry", async () => {
    await saveVocabularyEntry({
      text: "review",
      url: "https://example.com/article",
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
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
      sentenceText: "Review this sentence.",
      articleExcerpt: "Review this sentence. Then continue reading.",
      sentenceIndex: 1,
    })
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
        sentenceText: "Original sentence",
        articleExcerpt: "Original sentence. Supporting excerpt.",
      },
    })
  })
})
