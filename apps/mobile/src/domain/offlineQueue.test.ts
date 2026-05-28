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
  serializeOfflineReviewQueue,
} from "./offlineQueue"

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

  it("maps skipped cards into conservative review schedule mutations", () => {
    const skippedEvent = createReviewEvent({
      cardId: "card-resilient",
      rating: "skip",
      deviceId: "device-mobile",
      appVersion: "0.1.0-test",
      offline: true,
      reviewedAt: new Date("2026-05-27T12:00:00.000Z"),
    })
    const queued = enqueueReviewEvent(EMPTY_OFFLINE_REVIEW_QUEUE, skippedEvent)
    const mutation = buildLegacyReviewScheduleMutation({
      operation: queued.operations[0],
      card: { cardId: "card-resilient", itemId: "vocab-resilient" },
      deviceId: "device-mobile",
    })

    expect(mutation.payload).toMatchObject({
      lastReviewGrade: "again",
      srsBox: 1,
      mobileReviewEventId: skippedEvent.eventId,
    })
  })

  it("serializes safely and creates current review_schedule sync mutations", () => {
    const queued = enqueueReviewEvent(EMPTY_OFFLINE_REVIEW_QUEUE, event)
    const restored = parseOfflineReviewQueue(serializeOfflineReviewQueue(queued))
    expect(restored.operations[0].event.cardId).toBe("card-resilient")

    const mutation = buildLegacyReviewScheduleMutation({
      operation: restored.operations[0],
      card: { cardId: "card-resilient", itemId: "vocab-resilient" },
      deviceId: "device-mobile",
      clientUpdatedAt: new Date("2026-05-27T12:05:00.000Z"),
    })
    expect(mutation).toMatchObject({
      collection: "review_schedule",
      recordId: "vocab-resilient",
      clientMutationId: restored.operations[0].operationId,
      payload: {
        vocabularyEntryId: "vocab-resilient",
        lastReviewGrade: "good",
        mobileReviewEventId: event.eventId,
      },
    })
  })
})
