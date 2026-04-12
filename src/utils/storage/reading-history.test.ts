import { beforeEach, describe, expect, it } from "vitest"

import {
  READING_HISTORY_STORAGE_KEY,
  recordPageTranslation,
  getReadingHistory,
  clearReadingHistory,
  buildReadingHistoryRecordId,
} from "./reading-history"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

describe("reading-history storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("records and retrieves entries", async () => {
    await recordPageTranslation({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Test Article",
      wordsTranslated: 120,
      visitedAt: 1000,
    })

    const history = await getReadingHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Test Article",
      wordsTranslated: 120,
      visitedAt: 1000,
    })
    expect(history[0].id).toBe(buildReadingHistoryRecordId("https://example.com/article"))
  })

  it("deduplicates by sanitized URL and updates existing entry", async () => {
    await recordPageTranslation({
      url: "https://example.com/page?first=1#section-a",
      hostname: "example.com",
      title: "Old Title",
      wordsTranslated: 50,
      visitedAt: 1000,
    })

    await recordPageTranslation({
      url: "https://example.com/page?second=1#section-b",
      hostname: "example.com",
      title: "New Title",
      wordsTranslated: 100,
      visitedAt: 2000,
    })

    const history = await getReadingHistory()
    expect(history).toHaveLength(1)
    expect(history[0].url).toBe("https://example.com/page")
    expect(history[0].id).toBe("https://example.com/page")
    expect(history[0].title).toBe("New Title")
    expect(history[0].wordsTranslated).toBe(100)
    expect(history[0].visitedAt).toBe(2000)
  })

  it("returns entries in newest-first order", async () => {
    await recordPageTranslation({
      url: "https://example.com/first",
      hostname: "example.com",
      title: "First",
      wordsTranslated: 10,
      visitedAt: 1000,
    })

    await recordPageTranslation({
      url: "https://example.com/second",
      hostname: "example.com",
      title: "Second",
      wordsTranslated: 20,
      visitedAt: 2000,
    })

    await recordPageTranslation({
      url: "https://example.com/third",
      hostname: "example.com",
      title: "Third",
      wordsTranslated: 30,
      visitedAt: 3000,
    })

    const history = await getReadingHistory()
    expect(history).toHaveLength(3)
    expect(history[0].title).toBe("Third")
    expect(history[1].title).toBe("Second")
    expect(history[2].title).toBe("First")
  })

  it("respects MAX_ENTRIES limit (200)", async () => {
    // Pre-fill storage with 200 entries
    const entries = Array.from({ length: 200 }, (_, i) => ({
      id: `https://example.com/page-${i}`,
      url: `https://example.com/page-${i}`,
      hostname: "example.com",
      title: `Page ${i}`,
      wordsTranslated: i,
      visitedAt: i,
    }))

    const browser = setMockBrowser(createMockBrowser({
      [READING_HISTORY_STORAGE_KEY]: entries,
    })) as ReturnType<typeof createMockBrowser>

    // Add one more entry, which should evict the oldest
    await recordPageTranslation({
      url: "https://example.com/new-page",
      hostname: "example.com",
      title: "New Page",
      wordsTranslated: 999,
      visitedAt: 9999,
    })

    const history = await getReadingHistory()
    expect(history).toHaveLength(200)
    expect(history[0].url).toBe("https://example.com/new-page")
    // The oldest entry (page-0) should be evicted once the new item is prepended.
    expect(history.find((e) => e.url === "https://example.com/page-0")).toBeUndefined()
  })

  it("clears all history", async () => {
    await recordPageTranslation({
      url: "https://example.com/page",
      hostname: "example.com",
      title: "Page",
      wordsTranslated: 10,
      visitedAt: 1000,
    })

    await clearReadingHistory()

    const history = await getReadingHistory()
    expect(history).toHaveLength(0)
  })
})
