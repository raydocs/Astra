import { describe, expect, it } from "vitest"

import { buildTodayReviewQueue } from "./review"
import { buildMobileReviewSnapshotFromCloudVocabulary } from "./cloudVocabulary"

describe("cloud vocabulary mobile snapshot mapping", () => {
  it("maps synced vocabulary entries into source-backed mobile review cards", () => {
    const snapshot = buildMobileReviewSnapshotFromCloudVocabulary({
      entries: [
        {
          id: "vocab-resilient",
          text: "resilient",
          translation: "能恢复的；有韧性的",
          explanation: "A system that keeps working after failures.",
          savedAt: Date.UTC(2026, 4, 27, 9, 0, 0),
          sourceContext: {
            pageTitle: "The Future of Distributed Systems",
            hostname: "example.com",
            pageUrl: "https://example.com/distributed-systems",
            sentenceText: "The system remained resilient after multiple node failures.",
          },
        },
        {
          id: "vocab-moving-target",
          text: "The catch is that consistency becomes a moving target.",
          translation: "问题在于，一致性会变成一个不断变化的目标。",
          savedAt: Date.UTC(2026, 4, 27, 9, 5, 0),
          sourceContext: {
            ownedReadingSourceType: "pdf",
            ownedReadingTitle: "Designing Data-Intensive Applications notes",
          },
        },
      ],
      reviewSchedules: [{
        vocabularyEntryId: "vocab-resilient",
        nextReviewAt: Date.UTC(2026, 4, 27, 10, 0, 0),
        srsBox: 2,
        reviewCount: 1,
        lastReviewedAt: Date.UTC(2026, 4, 26, 10, 0, 0),
      }],
    })

    expect(snapshot.sources).toHaveLength(2)
    expect(snapshot.sources[0]).toMatchObject({ title: "Designing Data-Intensive Applications notes", type: "pdf" })
    expect(snapshot.sources.find((source) => source.title === "The Future of Distributed Systems")).toMatchObject({
      type: "page",
      url: "https://example.com/distributed-systems",
    })
    expect(snapshot.savedItems.find((item) => item.itemId === "vocab-resilient")).toMatchObject({
      sourceId: expect.stringContaining("the-future-of-distributed-systems"),
      itemType: "word",
      context: "The system remained resilient after multiple node failures.",
    })
    expect(snapshot.reviewCards.find((card) => card.itemId === "vocab-resilient")).toMatchObject({
      cardType: "word",
      state: "learning",
      priority: 4,
    })

    const queue = buildTodayReviewQueue(snapshot, new Date("2026-05-27T12:00:00.000Z"))
    expect(queue.map((card) => card.front)).toEqual([
      "The catch is that consistency becomes a moving target.",
      "resilient",
    ])
    expect(queue.find((card) => card.front === "resilient")?.sourceUrl).toBe("https://example.com/distributed-systems")
  })
})
