import { describe, expect, it } from "vitest"

import { createReviewEvent } from "./review"
import {
  EMPTY_OFFLINE_REVIEW_QUEUE,
  buildLegacyReviewScheduleMutation,
  compactSyncedReviewOperations,
  enqueueReviewEvent,
  getFlushableReviewOperations,
  markOperationRejected,
  markOperationSynced,
  markOperationsSyncing,
  parseOfflineReviewQueue,
  reviewRatingToGrade,
  serializeOfflineReviewQueue,
} from "./offlineQueue"
import { applyReview, createDefaultSrsFields } from "./srs"

describe("offline review queue", () => {
  const event = createReviewEvent({
    cardId: "card-resilient",
    rating: "good",
    deviceId: "device-mobile",
    appVersion: "0.1.0-test",
    offline: true,
    reviewedAt: new Date("2026-05-27T12:00:00.000Z"),
  })

  it("enqueues review events idempotently and preserves flush order", () => {
    const queued = enqueueReviewEvent(EMPTY_OFFLINE_REVIEW_QUEUE, event, new Date("2026-05-27T12:01:00.000Z"))
    const duplicate = enqueueReviewEvent(queued, event, new Date("2026-05-27T12:02:00.000Z"))

    expect(duplicate.operations).toHaveLength(1)
    expect(getFlushableReviewOperations(duplicate)).toHaveLength(1)
    expect(getFlushableReviewOperations(duplicate)[0].operationId).toBe(`pending_${event.eventId}`)
  })

  it("tracks syncing, rejection, synced, and compaction states", () => {
    const queued = enqueueReviewEvent(EMPTY_OFFLINE_REVIEW_QUEUE, event)
    const syncing = markOperationsSyncing(queued, [queued.operations[0].operationId], new Date("2026-05-27T12:03:00.000Z"))
    expect(syncing.operations[0]).toMatchObject({ status: "syncing", attempts: 1 })

    const rejected = markOperationRejected(syncing, queued.operations[0].operationId, "network offline")
    expect(rejected.operations[0]).toMatchObject({ status: "rejected", lastError: "network offline" })
    expect(getFlushableReviewOperations(rejected)).toHaveLength(1)

    const synced = markOperationSynced(rejected, queued.operations[0].operationId)
    expect(compactSyncedReviewOperations(synced).operations[0].status).toBe("synced")
  })

  it("maps mobile ratings to canonical SRS grades", () => {
    expect(reviewRatingToGrade("again")).toBe("again")
    expect(reviewRatingToGrade("skip")).toBe("again")
    expect(reviewRatingToGrade("good")).toBe("good")
    expect(reviewRatingToGrade("easy")).toBe("easy")
  })

  it("maps skipped cards into relearn schedule mutations (box 1, short interval)", () => {
    const reviewedAt = new Date("2026-05-27T12:00:00.000Z")
    const skippedEvent = createReviewEvent({
      cardId: "card-resilient",
      rating: "skip",
      deviceId: "device-mobile",
      appVersion: "0.1.0-test",
      offline: true,
      reviewedAt,
    })
    const queued = enqueueReviewEvent(EMPTY_OFFLINE_REVIEW_QUEUE, skippedEvent)
    const grade = reviewRatingToGrade("skip")
    const fields = applyReview(createDefaultSrsFields(reviewedAt.getTime()), { grade }, reviewedAt.getTime())
    const mutation = buildLegacyReviewScheduleMutation({
      operation: queued.operations[0],
      card: { cardId: "card-resilient", itemId: "vocab-resilient" },
      deviceId: "device-mobile",
      fields,
      grade,
    })

    expect(mutation.payload).toMatchObject({
      lastReviewGrade: "again",
      srsBox: 1,
      nextReviewAt: reviewedAt.getTime() + 10 * 60 * 1000,
      reviewCount: 1,
    })
  })

  it("serializes the computed SRS schedule into a review_schedule mutation", () => {
    const queued = enqueueReviewEvent(EMPTY_OFFLINE_REVIEW_QUEUE, event)
    const restored = parseOfflineReviewQueue(serializeOfflineReviewQueue(queued))
    expect(restored.operations[0].event.cardId).toBe("card-resilient")

    const reviewedAt = new Date(restored.operations[0].event.reviewedAt)
    const grade = reviewRatingToGrade("good")
    const fields = applyReview(createDefaultSrsFields(reviewedAt.getTime()), { grade }, reviewedAt.getTime())
    const mutation = buildLegacyReviewScheduleMutation({
      operation: restored.operations[0],
      card: { cardId: "card-resilient", itemId: "vocab-resilient" },
      deviceId: "device-mobile",
      fields,
      grade,
      clientUpdatedAt: new Date("2026-05-27T12:05:00.000Z"),
    })
    expect(mutation).toMatchObject({
      collection: "review_schedule",
      recordId: "vocab-resilient",
      clientMutationId: restored.operations[0].operationId,
      payload: {
        vocabularyEntryId: "vocab-resilient",
        lastReviewGrade: "good",
        srsBox: 2,
        nextReviewAt: reviewedAt.getTime() + 2 * 24 * 60 * 60 * 1000,
        reviewCount: 1,
      },
    })
    // Payload must carry EXACTLY the keys of the server's strict review_schedule
    // schema (VocabularyReviewScheduleRecordSchema in src/utils/storage/vocabulary-core.ts).
    // Any stray key (e.g. the old mobileReviewEventId) makes .strict().parse throw
    // server-side → INVALID_SYNC_PAYLOAD and the review never persists.
    expect(Object.keys(mutation.payload as Record<string, unknown>).sort()).toEqual([
      "lastReviewGrade",
      "lastReviewGradeAt",
      "lastReviewedAt",
      "nextReviewAt",
      "reviewCount",
      "srsBox",
      "updatedAt",
      "vocabularyEntryId",
    ])
  })
})
