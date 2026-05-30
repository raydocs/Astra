import type { MobileSyncMutationInput } from "../api/astraClient"
import type { ReviewCard, ReviewEvent, ReviewRating } from "./review"
import type { ReviewGrade, SrsFields } from "./srs"

export type PendingOperationStatus = "pending" | "syncing" | "synced" | "rejected"

export interface PendingReviewOperation {
  operationId: string
  event: ReviewEvent
  card?: Pick<ReviewCard, "cardId" | "itemId">
  status: PendingOperationStatus
  attempts: number
  createdAt: string
  updatedAt: string
  lastError?: string
}

export interface OfflineReviewQueueState {
  version: 1
  operations: PendingReviewOperation[]
}

export const EMPTY_OFFLINE_REVIEW_QUEUE: OfflineReviewQueueState = {
  version: 1,
  operations: [],
}

export function createPendingReviewOperation(event: ReviewEvent, now = new Date(), card?: Pick<ReviewCard, "cardId" | "itemId">): PendingReviewOperation {
  return {
    operationId: `pending_${event.eventId}`,
    event,
    card,
    status: "pending",
    attempts: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

export function enqueueReviewEvent(
  queue: OfflineReviewQueueState,
  event: ReviewEvent,
  now = new Date(),
  card?: Pick<ReviewCard, "cardId" | "itemId">,
): OfflineReviewQueueState {
  if (queue.operations.some((operation) => operation.event.eventId === event.eventId)) return queue
  return {
    version: 1,
    operations: [createPendingReviewOperation(event, now, card), ...queue.operations],
  }
}

export function markOperationsSyncing(queue: OfflineReviewQueueState, operationIds: string[], now = new Date()): OfflineReviewQueueState {
  const ids = new Set(operationIds)
  return {
    version: 1,
    operations: queue.operations.map((operation) => ids.has(operation.operationId)
      ? { ...operation, status: "syncing", attempts: operation.attempts + 1, updatedAt: now.toISOString(), lastError: undefined }
      : operation),
  }
}

export function markOperationSynced(queue: OfflineReviewQueueState, operationId: string, now = new Date()): OfflineReviewQueueState {
  return {
    version: 1,
    operations: queue.operations.map((operation) => operation.operationId === operationId
      ? { ...operation, status: "synced", updatedAt: now.toISOString(), lastError: undefined }
      : operation),
  }
}

export function markOperationRejected(queue: OfflineReviewQueueState, operationId: string, error: string, now = new Date()): OfflineReviewQueueState {
  return {
    version: 1,
    operations: queue.operations.map((operation) => operation.operationId === operationId
      ? { ...operation, status: "rejected", updatedAt: now.toISOString(), lastError: error }
      : operation),
  }
}

export function getFlushableReviewOperations(queue: OfflineReviewQueueState, maxCount = 25): PendingReviewOperation[] {
  return queue.operations
    .filter((operation) => operation.status === "pending" || operation.status === "rejected")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, maxCount)
}

export function compactSyncedReviewOperations(queue: OfflineReviewQueueState, keepLatest = 50): OfflineReviewQueueState {
  const synced = queue.operations.filter((operation) => operation.status === "synced").slice(0, keepLatest)
  const active = queue.operations.filter((operation) => operation.status !== "synced")
  return { version: 1, operations: [...active, ...synced] }
}

export function serializeOfflineReviewQueue(queue: OfflineReviewQueueState): string {
  return JSON.stringify(queue)
}

export function parseOfflineReviewQueue(value: string | null | undefined): OfflineReviewQueueState {
  if (!value) return EMPTY_OFFLINE_REVIEW_QUEUE
  try {
    const parsed = JSON.parse(value) as Partial<OfflineReviewQueueState>
    if (parsed.version !== 1 || !Array.isArray(parsed.operations)) return EMPTY_OFFLINE_REVIEW_QUEUE
    return {
      version: 1,
      operations: parsed.operations.filter((operation): operation is PendingReviewOperation => Boolean(
        operation
        && typeof operation.operationId === "string"
        && typeof operation.event?.eventId === "string"
        && typeof operation.event?.cardId === "string"
        && (!operation.card || (typeof operation.card.cardId === "string" && typeof operation.card.itemId === "string")),
      )),
    }
  } catch {
    return EMPTY_OFFLINE_REVIEW_QUEUE
  }
}

/** Map a mobile review rating to the canonical SRS grade. Mobile has no "hard"; "skip" relearns like "again". */
export function reviewRatingToGrade(rating: ReviewRating): ReviewGrade {
  switch (rating) {
    case "again":
    case "skip":
      return "again"
    case "good":
      return "good"
    case "easy":
      return "easy"
  }
}

/**
 * Serialize a graded review into a review_schedule sync mutation. The SRS state
 * (`fields`) is computed by the caller via the shared Leitner scheduler so mobile
 * schedules identically to web/desktop — this builder does NOT invent intervals.
 */
export function buildLegacyReviewScheduleMutation(params: {
  operation: PendingReviewOperation
  card: Pick<ReviewCard, "cardId" | "itemId">
  deviceId: string
  fields: SrsFields
  grade: ReviewGrade
  clientUpdatedAt?: Date
}): MobileSyncMutationInput {
  const reviewedAt = new Date(params.operation.event.reviewedAt)
  const clientUpdatedAt = params.clientUpdatedAt ?? reviewedAt
  return {
    collection: "review_schedule",
    schemaVersion: 1,
    recordId: params.card.itemId,
    operation: "upsert",
    clientMutationId: params.operation.operationId,
    deviceId: params.deviceId,
    clientUpdatedAt: clientUpdatedAt.toISOString(),
    payload: {
      vocabularyEntryId: params.card.itemId,
      lastReviewedAt: params.fields.lastReviewedAt ?? reviewedAt.getTime(),
      lastReviewGrade: params.grade,
      lastReviewGradeAt: reviewedAt.getTime(),
      reviewCount: params.fields.reviewCount,
      srsBox: params.fields.srsBox,
      nextReviewAt: params.fields.nextReviewAt,
      updatedAt: clientUpdatedAt.getTime(),
    },
  }
}
