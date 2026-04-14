import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { READING_HISTORY_STORAGE_KEY } from "./reading-history"
import {
  listOwnedReadingItems,
  removeOwnedReadingItem,
  setOwnedReadingStatus,
  syncRecentReadingHistoryToOwnedQueue,
  upsertOwnedArticleFromUrl,
} from "./owned-reading"

describe("owned reading storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("persists article by sanitized URL and preserves id on upsert", async () => {
    const first = await upsertOwnedArticleFromUrl({
      url: "https://example.com/a?q=1#h",
      title: "Article A",
      status: "saved",
    })
    const second = await upsertOwnedArticleFromUrl({
      url: "https://example.com/a#other",
      title: "Article A updated",
      status: "saved",
    })
    expect(second.id).toBe(first.id)
    expect(second.title).toBe("Article A updated")
    expect(second.sourceUrl).toBe("https://example.com/a")
    const list = await listOwnedReadingItems()
    expect(list).toHaveLength(1)
  })

  it("keeps in_progress when re-upserting as saved", async () => {
    const item = await upsertOwnedArticleFromUrl({
      url: "https://example.com/p",
      title: "P",
      status: "saved",
    })
    await setOwnedReadingStatus(item.id, "in_progress")
    await upsertOwnedArticleFromUrl({
      url: "https://example.com/p",
      title: "P",
      status: "saved",
    })
    const list = await listOwnedReadingItems()
    expect(list[0]?.status).toBe("in_progress")
  })

  it("syncRecentReadingHistoryToOwnedQueue merges history without dropping other types", async () => {
    setMockBrowser(createMockBrowser({
      [READING_HISTORY_STORAGE_KEY]: [
        {
          id: "https://news.example/x",
          url: "https://news.example/x",
          hostname: "news.example",
          title: "News X",
          wordsTranslated: 2,
          visitedAt: 5000,
        },
      ],
    }))

    await upsertOwnedArticleFromUrl({
      url: "https://other.example/o",
      title: "Other",
      status: "saved",
    })

    await syncRecentReadingHistoryToOwnedQueue(10)

    const list = await listOwnedReadingItems()
    const titles = new Set(list.map((r) => r.title))
    expect(titles.has("News X")).toBe(true)
    expect(titles.has("Other")).toBe(true)
  })

  it("removeOwnedReadingItem deletes row", async () => {
    const item = await upsertOwnedArticleFromUrl({
      url: "https://example.com/z",
      title: "Z",
      status: "saved",
    })
    await removeOwnedReadingItem(item.id)
    expect(await listOwnedReadingItems()).toHaveLength(0)
  })
})
