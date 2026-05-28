import { describe, expect, it } from "vitest"

import { buildMobileReviewShareText, buildMobileReviewSpeechText, buildMobileSavedItemSpeechText, buildTodayReviewQueue, buildWeeklyDigestSnapshot, createReviewEvent, sampleMobileReviewSnapshot } from "./review"

describe("mobile review domain", () => {
  it("builds a source-backed due queue capped for Today Review", () => {
    const queue = buildTodayReviewQueue(sampleMobileReviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))

    expect(queue).toHaveLength(2)
    expect(queue[0]).toMatchObject({
      cardId: "card-resilient",
      front: "resilient",
      sourceTitle: "The Future of Distributed Systems",
      sourceType: "page",
    })
    expect(queue[1].type).toBe("sentence")
  })

  it("builds a quiet weekly digest from saved items and local review events", () => {
    const event = createReviewEvent({
      cardId: "card-resilient",
      rating: "good",
      deviceId: "device-mobile",
      appVersion: "0.1.0-test",
      offline: true,
      reviewedAt: new Date("2026-05-27T12:00:00.000Z"),
    })

    const digest = buildWeeklyDigestSnapshot(sampleMobileReviewSnapshot, [event], new Date("2026-05-29T12:00:00.000Z"))

    expect(digest).toMatchObject({
      digestId: "digest_2026-05-25",
      savedCount: 2,
      reviewedCount: 1,
      highlightedWords: ["resilient"],
      highlightedSentences: ["The catch is that consistency becomes a moving target."],
      nextReviewCount: 0,
    })
    expect(digest.sourceBreakdown).toEqual([
      { type: "doc", count: 1 },
      { type: "page", count: 1 },
    ])
  })

  it("builds front-only speech text from a review card", () => {
    const snapshot = {
      ...sampleMobileReviewSnapshot,
      sources: sampleMobileReviewSnapshot.sources.map((source) => source.sourceId === "source-distributed-systems"
        ? { ...source, url: "https://example.com/private/article?token=secret" }
        : source),
      savedItems: sampleMobileReviewSnapshot.savedItems.map((item) => item.itemId === "item-resilient"
        ? {
          ...item,
          translation: "secret translation",
          explanation: "secret explanation",
          context: "secret source context",
        }
        : item),
    }
    const [card] = buildTodayReviewQueue(snapshot, new Date("2026-05-27T12:00:00.000Z"))

    const speechText = buildMobileReviewSpeechText(card)

    expect(speechText).toBe("resilient")
    expect(speechText).not.toContain("https://")
    expect(speechText).not.toContain("example.com/private")
    expect(speechText).not.toContain("token=secret")
    expect(speechText).not.toContain("secret translation")
    expect(speechText).not.toContain("secret explanation")
    expect(speechText).not.toContain("secret source context")
    expect(speechText).not.toContain("The Future of Distributed Systems")
  })

  it("builds front-only speech text from a saved Library item", () => {
    const item = {
      ...sampleMobileReviewSnapshot.savedItems[0],
      text: "  resilient   systems  ",
      translation: "secret translation",
      explanation: "secret explanation",
      context: "secret source context",
    }
    const speechText = buildMobileSavedItemSpeechText(item)

    expect(speechText).toBe("resilient systems")
    expect(speechText).not.toContain("secret translation")
    expect(speechText).not.toContain("secret explanation")
    expect(speechText).not.toContain("secret source context")
    expect(speechText).not.toContain("https://")
  })

  it("builds privacy-safe share text from a review card", () => {
    const snapshot = {
      ...sampleMobileReviewSnapshot,
      sources: sampleMobileReviewSnapshot.sources.map((source) => source.sourceId === "source-distributed-systems"
        ? { ...source, url: "https://example.com/private/article?token=secret" }
        : source),
    }
    const [card] = buildTodayReviewQueue(snapshot, new Date("2026-05-27T12:00:00.000Z"))

    const shareText = buildMobileReviewShareText(card)

    expect(shareText).toContain("Expression: resilient")
    expect(shareText).toContain("Meaning: 能恢复的；有韧性的")
    expect(shareText).toContain("Note: Here it describes a system that keeps working after failures.")
    expect(shareText).toContain("Source: The Future of Distributed Systems (page)")
    expect(shareText).not.toContain("https://")
    expect(shareText).not.toContain("example.com/private")
    expect(shareText).not.toContain("token=secret")
  })

  it("builds privacy-safe share text from a saved item and source context", () => {
    const item = sampleMobileReviewSnapshot.savedItems[1]
    const source = {
      ...sampleMobileReviewSnapshot.sources[1],
      url: "https://notes.example/full/path?private=true",
    }

    const shareText = buildMobileReviewShareText({ item, source })

    expect(shareText).toContain("Expression: The catch is that consistency becomes a moving target.")
    expect(shareText).toContain("Meaning: 问题在于，一致性会变成一个不断变化的目标。")
    expect(shareText).toContain("Source: Designing Data-Intensive Applications notes (doc)")
    expect(shareText).not.toContain("https://")
    expect(shareText).not.toContain("notes.example/full/path")
    expect(shareText).not.toContain("private=true")
  })

  it("filters Today Review to one source when requested", () => {
    const queue = buildTodayReviewQueue(
      sampleMobileReviewSnapshot,
      new Date("2026-05-27T12:00:00.000Z"),
      { sourceId: "source-design-notes" },
    )

    expect(queue.map((card) => card.cardId)).toEqual(["card-moving-target"])
    expect(queue[0].sourceTitle).toBe("Designing Data-Intensive Applications notes")
  })

  it("creates append-only review events for offline sync", () => {
    const event = createReviewEvent({
      cardId: "card-resilient",
      rating: "good",
      deviceId: "device-mobile",
      appVersion: "0.1.0-test",
      offline: true,
      reviewedAt: new Date("2026-05-27T12:00:00.000Z"),
    })

    expect(event).toMatchObject({
      cardId: "card-resilient",
      rating: "good",
      deviceId: "device-mobile",
      offline: true,
      appVersion: "0.1.0-test",
      reviewedAt: "2026-05-27T12:00:00.000Z",
    })
    expect(event.eventId).toMatch(/^review_/)
  })
})
