import { describe, expect, it, vi } from "vitest"

import type { MobileAstraClient, MobileDeviceIdentity } from "../api/astraClient"
import { buildMobileReviewShareText, buildTodayReviewQueue, sampleMobileReviewSnapshot } from "../domain/review"
import {
  DEFAULT_MOBILE_APP_STATE,
  MOBILE_SESSION_TOKEN_STORAGE_KEY,
  applyCloudVocabularyToMobileState,
  applyMobileSyncPullResult,
  applyMobileReviewPushResult,
  buildPendingMobileReviewMutations,
  loadMobileAppState,
  markMobileReviewCardNotUseful,
  markMobileReviewMutationsSyncing,
  parseMobileAppState,
  recordMobileReviewRating,
  refreshMobileReviewData,
  removeMobileSourceFromDevice,
  restoreMobileSourceOnDevice,
  refreshMobileCloudReviewDataDeleteJob,
  requestMobileCloudReviewDataDelete,
  saveMobileAppState,
  setMobileSourceHidden,
  setMobileSourcePrivate,
  signInMobileAppState,
  syncPendingMobileReviewEvents,
  updateMobileReminderPreference,
} from "./mobileAppState"
import { MemoryMobileKeyValueStorage } from "./mobileStorage"

const device: MobileDeviceIdentity = {
  deviceId: "device-mobile",
  label: "iPhone preview",
  platform: "ios",
  appKind: "mobile",
  appVersion: "0.1.0-test",
}

describe("mobile app state", () => {
  it("persists and restores session/review state without native storage dependencies", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const state = {
      ...DEFAULT_MOBILE_APP_STATE,
      sampleDeck: false,
      lastSyncedAt: "2026-05-27T12:00:00.000Z",
      weeklyDigest: {
        digestId: "digest_2026-05-25",
        periodStart: "2026-05-25T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
        reviewedCount: 1,
        savedCount: 1,
        sourceBreakdown: [{ type: "page" as const, count: 1 }],
        highlightedWords: ["resilient"],
        highlightedSentences: [],
        nextReviewCount: 1,
        generatedAt: "2026-05-27T12:00:00.000Z",
      },
    }

    await saveMobileAppState(storage, state)
    const restored = await loadMobileAppState(storage)

    expect(restored).toMatchObject({ sampleDeck: false, lastSyncedAt: "2026-05-27T12:00:00.000Z", weeklyDigest: { digestId: "digest_2026-05-25" } })
    expect(restored.reviewSnapshot.sources[0].title).toBe(sampleMobileReviewSnapshot.sources[0].title)
  })

  it("persists source-level Today visibility controls", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const hidden = setMobileSourceHidden(
      DEFAULT_MOBILE_APP_STATE,
      "source-distributed-systems",
      true,
    )

    expect(hidden.hiddenSourceIds).toEqual(["source-distributed-systems"])
    expect(hidden.reviewSnapshot.sources.find((source) => source.sourceId === "source-distributed-systems")?.hidden).toBe(true)
    expect(buildTodayReviewQueue(hidden.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z")).map((card) => card.cardId)).toEqual(["card-moving-target"])

    await saveMobileAppState(storage, hidden)
    const restored = await loadMobileAppState(storage)
    expect(restored.hiddenSourceIds).toEqual(["source-distributed-systems"])
    expect(buildTodayReviewQueue(restored.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z")).map((card) => card.cardId)).toEqual(["card-moving-target"])

    const visible = setMobileSourceHidden(restored, "source-distributed-systems", false)
    expect(visible.hiddenSourceIds).toEqual([])
    expect(buildTodayReviewQueue(visible.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))).toHaveLength(2)
  })

  it("keeps source title privacy local while preserving review cards", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const cloudInput = {
      entries: [{
        id: "vocab-private",
        text: "resilient",
        translation: "能恢复的；有韧性的",
        explanation: "Keeps working after disruption.",
        savedAt: Date.UTC(2026, 4, 27, 9, 0, 0),
        sourceContext: {
          pageTitle: "Distributed Systems",
          pageUrl: "https://example.com/post",
          hostname: "example.com",
          sentenceText: "The system remained resilient after multiple node failures.",
        },
      }],
      reviewSchedules: [{
        vocabularyEntryId: "vocab-private",
        nextReviewAt: Date.UTC(2026, 4, 27, 0, 0, 0),
        srsBox: 1,
        reviewCount: 0,
        lastReviewedAt: null,
      }],
    }
    const refreshedFromCloud = applyCloudVocabularyToMobileState(DEFAULT_MOBILE_APP_STATE, cloudInput, new Date("2026-05-27T12:00:00.000Z"))
    const sourceId = refreshedFromCloud.reviewSnapshot.sources[0].sourceId
    const privateState = setMobileSourcePrivate(refreshedFromCloud, sourceId, true)

    expect(privateState.privateSourceIds).toEqual([sourceId])
    expect(privateState.privateSourceItemIds).toEqual(["vocab-private"])
    expect(privateState.reviewSnapshot.sources[0]).toMatchObject({ sourceId, title: "Private source", private: true })
    expect(privateState.reviewSnapshot.sources[0].origin).toBeUndefined()
    expect(privateState.reviewSnapshot.sources[0].url).toBeUndefined()
    const todayQueue = buildTodayReviewQueue(privateState.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))
    expect(todayQueue).toHaveLength(1)
    expect(todayQueue[0]).toMatchObject({ sourceId, sourceTitle: "Private source", sourceUrl: undefined })
    expect(buildMobileReviewShareText(todayQueue[0])).toContain("Source: Private source (page)")

    await saveMobileAppState(storage, privateState)
    const restored = await loadMobileAppState(storage)
    expect(restored.privateSourceIds).toEqual([sourceId])
    expect(restored.privateSourceItemIds).toEqual(["vocab-private"])
    expect(buildTodayReviewQueue(restored.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))[0]).toMatchObject({ sourceTitle: "Private source", sourceUrl: undefined })

    const refreshedAgain = applyCloudVocabularyToMobileState(restored, cloudInput, new Date("2026-05-27T12:05:00.000Z"))
    expect(refreshedAgain.privateSourceIds).toEqual([sourceId])
    expect(refreshedAgain.privateSourceItemIds).toEqual(["vocab-private"])
    expect(buildTodayReviewQueue(refreshedAgain.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))[0].sourceTitle).toBe("Private source")

    const changedCloudInput = {
      ...cloudInput,
      entries: [{
        ...cloudInput.entries[0],
        sourceContext: {
          ...cloudInput.entries[0].sourceContext,
          pageTitle: "Distributed Systems Handbook",
          pageUrl: "https://docs.example.org/handbook",
          hostname: "docs.example.org",
        },
      }],
    }
    const refreshedWithChangedSourceId = applyCloudVocabularyToMobileState(restored, changedCloudInput, new Date("2026-05-27T12:06:00.000Z"))
    const changedSourceId = refreshedWithChangedSourceId.reviewSnapshot.sources[0].sourceId
    expect(changedSourceId).not.toBe(sourceId)
    expect(refreshedWithChangedSourceId.privateSourceIds).toEqual([changedSourceId])
    expect(refreshedWithChangedSourceId.privateSourceItemIds).toEqual(["vocab-private"])
    expect(refreshedWithChangedSourceId.reviewSnapshot.sources[0]).toMatchObject({ sourceId: changedSourceId, title: "Private source", private: true })
    expect(buildTodayReviewQueue(refreshedWithChangedSourceId.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))[0]).toMatchObject({ sourceId: changedSourceId, sourceTitle: "Private source", sourceUrl: undefined })

    const publicAfterChangedSourceId = setMobileSourcePrivate(refreshedWithChangedSourceId, changedSourceId, false)
    expect(publicAfterChangedSourceId.privateSourceIds).toEqual([])
    expect(publicAfterChangedSourceId.privateSourceItemIds).toEqual([])
    expect(publicAfterChangedSourceId.reviewSnapshot.sources[0]).toMatchObject({ sourceId: changedSourceId, title: "Distributed Systems Handbook", origin: "docs.example.org", url: "https://docs.example.org/handbook" })

    const pulled = applyMobileSyncPullResult(refreshedAgain, {
      serverTime: "2026-05-27T12:10:00.000Z",
      deltas: {},
      nextCursors: { vocabulary: "voc-2", review_schedule: "rev-2" },
    }, new Date("2026-05-27T12:10:00.000Z"))
    expect(pulled.privateSourceIds).toEqual([sourceId])
    expect(pulled.privateSourceItemIds).toEqual(["vocab-private"])
    expect(buildTodayReviewQueue(pulled.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))[0]).toMatchObject({ sourceTitle: "Private source", sourceUrl: undefined })

    const publicState = setMobileSourcePrivate(pulled, sourceId, false)
    expect(publicState.privateSourceIds).toEqual([])
    expect(publicState.privateSourceItemIds).toEqual([])
    expect(publicState.reviewSnapshot.sources[0]).toMatchObject({ title: "Distributed Systems", origin: "example.com", url: "https://example.com/post" })

    const removed = removeMobileSourceFromDevice(setMobileSourcePrivate(refreshedAgain, sourceId, true), sourceId, new Date("2026-05-27T12:15:00.000Z"))
    expect(removed.privateSourceIds).toEqual([])
    expect(removed.privateSourceItemIds).toEqual([])
  })

  it("removes a source from this phone and supports undo", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const removed = removeMobileSourceFromDevice(
      DEFAULT_MOBILE_APP_STATE,
      "source-distributed-systems",
      new Date("2026-05-27T12:00:00.000Z"),
    )

    expect(removed.removedSourceIds).toEqual(["source-distributed-systems"])
    expect(removed.lastRemovedSource).toMatchObject({
      sourceId: "source-distributed-systems",
      title: "The Future of Distributed Systems",
      removedAt: "2026-05-27T12:00:00.000Z",
    })
    expect(removed.reviewSnapshot.sources.map((source) => source.sourceId)).not.toContain("source-distributed-systems")
    expect(buildTodayReviewQueue(removed.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z")).map((card) => card.cardId)).toEqual(["card-moving-target"])

    await saveMobileAppState(storage, removed)
    const restoredFromStorage = await loadMobileAppState(storage)
    expect(restoredFromStorage.removedSourceIds).toEqual(["source-distributed-systems"])
    expect(restoredFromStorage.reviewSnapshot.sources.map((source) => source.sourceId)).not.toContain("source-distributed-systems")

    const restored = restoreMobileSourceOnDevice(restoredFromStorage, "source-distributed-systems")
    expect(restored.removedSourceIds).toEqual([])
    expect(restored.lastRemovedSource).toBeNull()
    expect(buildTodayReviewQueue(restored.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z"))).toHaveLength(2)
  })

  it("marks a low-value card as not useful on this phone", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const dismissed = markMobileReviewCardNotUseful(DEFAULT_MOBILE_APP_STATE, "card-resilient")

    expect(dismissed.dismissedReviewCardIds).toEqual(["card-resilient"])
    expect(buildTodayReviewQueue(dismissed.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z")).map((card) => card.cardId)).toEqual(["card-moving-target"])
    expect(dismissed.message).toBe("Card removed from Today on this phone.")

    await saveMobileAppState(storage, dismissed)
    const restored = await loadMobileAppState(storage)
    expect(restored.dismissedReviewCardIds).toEqual(["card-resilient"])
    expect(buildTodayReviewQueue(restored.reviewSnapshot, new Date("2026-05-27T12:00:00.000Z")).map((card) => card.cardId)).toEqual(["card-moving-target"])
  })

  it("persists local reminder preferences with safe defaults", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const updated = updateMobileReminderPreference(
      DEFAULT_MOBILE_APP_STATE,
      { reviewReminder: "weekdays", preferredTime: "morning", weeklyDigest: false },
      new Date("2026-05-27T12:00:00.000Z"),
    )

    await saveMobileAppState(storage, updated)
    const restored = await loadMobileAppState(storage)

    expect(restored.reminderPreference).toMatchObject({
      reviewReminder: "weekdays",
      preferredTime: "morning",
      weeklyDigest: false,
      updatedAt: "2026-05-27T12:00:00.000Z",
    })
  })

  it("signs in through the mobile client and stores the returned session", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const client = {
      signIn: vi.fn(async () => ({
        version: 1,
        sessionToken: "session-token",
        sessionId: "session-1",
        deviceId: "device-mobile",
        identityMode: "authenticated",
        relayBaseURL: "https://relay.example/v1",
        email: "user@example.com",
        plan: "pro",
        subscriptionStatus: "active",
        expiresAt: "2026-05-28T00:00:00.000Z",
      })),
    } as unknown as MobileAstraClient

    const next = await signInMobileAppState({
      state: DEFAULT_MOBILE_APP_STATE,
      client,
      storage,
      device,
      email: "user@example.com",
      password: "secret",
      idempotencyKey: "idem-mobile",
    })

    expect(client.signIn).toHaveBeenCalledWith(expect.objectContaining({ email: "user@example.com", device }))
    expect(next.session?.sessionToken).toBe("session-token")
    expect(next.sampleDeck).toBe(false)
    expect(next.reviewSnapshot.reviewCards).toHaveLength(0)
    expect(await storage.getItem(MOBILE_SESSION_TOKEN_STORAGE_KEY)).toBe("session-token")
    expect(await storage.getItem("astra.mobile.app-state.v1")).not.toContain("session-token")
    expect((await loadMobileAppState(storage)).session?.email).toBe("user@example.com")
    expect((await loadMobileAppState(storage)).session?.sessionToken).toBe("session-token")
  })

  it("records real review ratings into pending sync mutations but keeps samples local-only", () => {
    const sample = recordMobileReviewRating({
      state: DEFAULT_MOBILE_APP_STATE,
      cardId: "card-resilient",
      rating: "good",
      device,
      now: new Date("2026-05-27T12:00:00.000Z"),
    })
    expect(sample.offlineQueue.operations).toHaveLength(0)

    const realState = { ...DEFAULT_MOBILE_APP_STATE, sampleDeck: false }
    const rated = recordMobileReviewRating({
      state: realState,
      cardId: "card-resilient",
      rating: "good",
      device,
      now: new Date("2026-05-27T12:00:00.000Z"),
    })
    const pending = buildPendingMobileReviewMutations(rated, device)
    const pendingAfterSnapshotRefresh = buildPendingMobileReviewMutations({ ...rated, reviewSnapshot: { sources: [], savedItems: [], reviewCards: [] } }, device)

    expect(pending).toHaveLength(1)
    expect(pendingAfterSnapshotRefresh).toHaveLength(1)
    expect(pending[0].mutation).toMatchObject({
      collection: "review_schedule",
      recordId: "item-resilient",
      deviceId: "device-mobile",
    })

    const synced = applyMobileReviewPushResult(rated, {
      accepted: [{ collection: "review_schedule", recordId: "item-resilient", clientMutationId: pending[0].operation.operationId }],
      rejected: [],
      nextCursors: {},
    }, new Date("2026-05-27T12:05:00.000Z"))
    expect(synced.syncStatus).toBe("ready")
    expect(synced.lastSyncedAt).toBe("2026-05-27T12:05:00.000Z")
    expect(synced.syncCursors.review_schedule).toBeNull()
  })

  it("syncs pending review events through the mobile client", async () => {
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const rated = recordMobileReviewRating({
      state: { ...DEFAULT_MOBILE_APP_STATE, session, sampleDeck: false },
      cardId: "card-resilient",
      rating: "good",
      device,
      now: new Date("2026-05-27T12:00:00.000Z"),
    })
    const client = {
      pushSyncMutations: vi.fn(async () => ({
        accepted: [{
          collection: "review_schedule",
          recordId: "item-resilient",
          clientMutationId: rated.offlineQueue.operations[0].operationId,
        }],
        rejected: [],
        nextCursors: {},
      })),
    } as unknown as MobileAstraClient

    const synced = await syncPendingMobileReviewEvents({
      state: rated,
      client,
      device,
      syncedAt: new Date("2026-05-27T12:10:00.000Z"),
    })

    expect(client.pushSyncMutations).toHaveBeenCalledWith(expect.objectContaining({
      session,
      device,
      mutations: [expect.objectContaining({ collection: "review_schedule", recordId: "item-resilient" })],
    }))
    expect(synced.syncStatus).toBe("ready")
    expect(synced.offlineQueue.operations[0].status).toBe("synced")
  })

  it("keeps unacknowledged push operations retryable", () => {
    const rated = recordMobileReviewRating({
      state: { ...DEFAULT_MOBILE_APP_STATE, sampleDeck: false },
      cardId: "card-resilient",
      rating: "good",
      device,
      now: new Date("2026-05-27T12:00:00.000Z"),
    })
    const operationId = rated.offlineQueue.operations[0].operationId
    const syncing = markMobileReviewMutationsSyncing(rated, [operationId])
    const result = applyMobileReviewPushResult(syncing, { accepted: [], rejected: [], nextCursors: {} })

    expect(result.syncStatus).toBe("error")
    expect(result.offlineQueue.operations[0]).toMatchObject({ status: "rejected" })
    expect(buildPendingMobileReviewMutations(result, device)).toHaveLength(1)
  })

  it("keeps failed sync operations retryable", async () => {
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const rated = recordMobileReviewRating({
      state: { ...DEFAULT_MOBILE_APP_STATE, session, sampleDeck: false },
      cardId: "card-resilient",
      rating: "good",
      device,
      now: new Date("2026-05-27T12:00:00.000Z"),
    })
    const client = {
      pushSyncMutations: vi.fn(async () => {
        throw new Error("offline")
      }),
    } as unknown as MobileAstraClient

    const failed = await syncPendingMobileReviewEvents({ state: rated, client, device })
    const retryable = buildPendingMobileReviewMutations(failed, device)

    expect(failed.syncStatus).toBe("offline")
    expect(failed.offlineQueue.operations[0]).toMatchObject({ status: "rejected" })
    expect(retryable).toHaveLength(1)
  })

  it("applies sync pull deltas into mobile review cards and cursors", async () => {
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const pulled = applyMobileSyncPullResult({ ...DEFAULT_MOBILE_APP_STATE, session, sampleDeck: false }, {
      serverTime: "2026-05-27T12:00:00.000Z",
      deltas: {
        vocabulary: [{
          collection: "vocabulary",
          schemaVersion: 1,
          recordId: "vocab-1",
          operation: "upsert",
          clientMutationId: "mut-vocab-1",
          deviceId: "device-web",
          clientUpdatedAt: "2026-05-27T09:00:00.000Z",
          cursor: "voc-1",
          payload: {
            id: "vocab-1",
            text: "resilient",
            translation: "能恢复的；有韧性的",
            savedAt: Date.UTC(2026, 4, 27, 9, 0, 0),
            sourceContext: { pageTitle: "Distributed Systems", hostname: "example.com" },
          },
        }],
        review_schedule: [{
          collection: "review_schedule",
          schemaVersion: 1,
          recordId: "vocab-1",
          operation: "upsert",
          clientMutationId: "mut-review-1",
          deviceId: "device-web",
          clientUpdatedAt: "2026-05-27T09:05:00.000Z",
          cursor: "rev-1",
          payload: { vocabularyEntryId: "vocab-1", nextReviewAt: Date.UTC(2026, 4, 27, 0, 0, 0), srsBox: 1, reviewCount: 0, lastReviewedAt: null },
        }],
      },
      nextCursors: { vocabulary: "voc-1", review_schedule: "rev-1" },
    }, new Date("2026-05-27T12:00:00.000Z"))

    expect(pulled.reviewSnapshot.savedItems[0]).toMatchObject({ itemId: "vocab-1", text: "resilient" })
    expect(pulled.reviewSnapshot.reviewCards[0]).toMatchObject({ itemId: "vocab-1", cardType: "word" })
    expect(pulled.syncCursors).toMatchObject({ vocabulary: "voc-1", review_schedule: "rev-1" })

    const weeklyDigest = {
      digestId: "digest_2026-05-25",
      periodStart: "2026-05-25T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
      reviewedCount: 1,
      savedCount: 1,
      sourceBreakdown: [{ type: "page" as const, count: 1 }],
      highlightedWords: ["resilient"],
      highlightedSentences: [],
      nextReviewCount: 1,
      generatedAt: "2026-05-27T12:05:00.000Z",
    }
    const client = {
      pullSyncDeltas: vi.fn(async () => ({ serverTime: "2026-05-27T12:05:00.000Z", deltas: {}, nextCursors: { vocabulary: "voc-1", review_schedule: "rev-1" } })),
      fetchWeeklyDigest: vi.fn(async () => weeklyDigest),
    } as unknown as MobileAstraClient
    const refreshed = await refreshMobileReviewData({ state: pulled, client, device, syncedAt: new Date("2026-05-27T12:05:00.000Z") })
    expect(client.pullSyncDeltas).toHaveBeenCalledWith(expect.objectContaining({
      cursors: { vocabulary: "voc-1", review_schedule: "rev-1" },
    }))
    expect(client.fetchWeeklyDigest).toHaveBeenCalledWith(expect.objectContaining({
      session,
      device,
      now: new Date("2026-05-27T12:05:00.000Z"),
    }))
    expect(refreshed.weeklyDigest).toMatchObject({ digestId: "digest_2026-05-25", highlightedWords: ["resilient"] })

    const clientWithoutArchive = {
      pullSyncDeltas: vi.fn(async () => ({ serverTime: "2026-05-27T12:10:00.000Z", deltas: {}, nextCursors: { vocabulary: "voc-1", review_schedule: "rev-1" } })),
    } as unknown as MobileAstraClient
    const localFallback = await refreshMobileReviewData({ state: { ...pulled, weeklyDigest }, client: clientWithoutArchive, device })
    expect(localFallback.weeklyDigest).toBeNull()
  })

  it("requests cloud review data deletion and clears local review state", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    const secureStorage = new MemoryMobileKeyValueStorage()
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const state = {
      ...DEFAULT_MOBILE_APP_STATE,
      session,
      sampleDeck: false,
      cloudVocabulary: { entries: [{ id: "vocab-1", text: "resilient", savedAt: Date.UTC(2026, 4, 27, 9, 0, 0) }], reviewSchedules: [] },
      privateSourceIds: ["source-private"],
      privateSourceItemIds: ["vocab-1"],
      syncCursors: { vocabulary: "voc-1", review_schedule: "rev-1" },
      lastSyncedAt: "2026-05-27T12:00:00.000Z",
      reminderPreference: { reviewReminder: "daily" as const, preferredTime: "morning" as const, weeklyDigest: false, updatedAt: "2026-05-27T11:00:00.000Z" },
    }
    const client = {
      requestCloudDataDelete: vi.fn(async () => ({
        jobId: "del_job_1",
        scope: { collections: ["vocabulary", "review_schedule"] },
        status: "scheduled",
        requestedAt: "2026-05-27T12:00:00.000Z",
        scheduledForAt: "2026-06-03T12:00:00.000Z",
        completedAt: null,
        gracePeriodSeconds: 604800,
      })),
    } as unknown as MobileAstraClient

    const next = await requestMobileCloudReviewDataDelete({
      state,
      client,
      device,
      storage,
      secureStorage,
      idempotencyKey: "delete-1",
    })

    expect(client.requestCloudDataDelete).toHaveBeenCalledWith(expect.objectContaining({
      session,
      device,
      collections: ["vocabulary", "review_schedule"],
      idempotencyKey: "delete-1",
    }))
    expect(next.session).toBe(session)
    expect(next.sampleDeck).toBe(true)
    expect(next.cloudVocabulary.entries).toHaveLength(0)
    expect(next.privateSourceIds).toEqual([])
    expect(next.privateSourceItemIds).toEqual([])
    expect(next.syncCursors).toMatchObject({ vocabulary: null, review_schedule: null })
    expect(next.pendingCloudReviewDataDeleteJob).toMatchObject({ jobId: "del_job_1", status: "scheduled" })
    expect(next.cloudReviewDataDeleteJobHistory[0]).toMatchObject({ jobId: "del_job_1", status: "scheduled" })
    expect(next.reminderPreference).toMatchObject({ reviewReminder: "daily", preferredTime: "morning", weeklyDigest: false })
    expect(next.message).toContain("del_job_1")
    expect(await secureStorage.getItem(MOBILE_SESSION_TOKEN_STORAGE_KEY)).toBe("session-token")

    const pullClient = { pullSyncDeltas: vi.fn() } as unknown as MobileAstraClient
    const refreshed = await refreshMobileReviewData({ state: next, client: pullClient, device })
    expect((pullClient.pullSyncDeltas as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect(refreshed.message).toContain("deletion is pending")
  })

  it("does not clear local review state when cloud deletion is rejected", async () => {
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const state = { ...DEFAULT_MOBILE_APP_STATE, session, sampleDeck: false }
    const client = {
      requestCloudDataDelete: vi.fn(async () => ({
        jobId: "del_job_failed",
        scope: { collections: ["vocabulary", "review_schedule"] },
        status: "failed",
        requestedAt: "2026-05-27T12:00:00.000Z",
        scheduledForAt: "2026-06-03T12:00:00.000Z",
        completedAt: null,
        gracePeriodSeconds: 604800,
      })),
    } as unknown as MobileAstraClient

    await expect(requestMobileCloudReviewDataDelete({
      state,
      client,
      device,
      storage: new MemoryMobileKeyValueStorage(),
      idempotencyKey: "delete-failed",
    })).rejects.toThrow("delete job was not accepted")
  })

  it("refreshes pending cloud deletion job status", async () => {
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const state = {
      ...DEFAULT_MOBILE_APP_STATE,
      session,
      sampleDeck: false,
      cloudVocabulary: { entries: [{ id: "vocab-1", text: "resilient", savedAt: Date.UTC(2026, 4, 27, 9, 0, 0) }], reviewSchedules: [] },
      privateSourceIds: ["source-private"],
      privateSourceItemIds: ["vocab-1"],
      removedSourceIds: ["source-removed"],
      syncCursors: { vocabulary: "voc-1", review_schedule: "rev-1" },
      lastSyncedAt: "2026-05-27T12:00:00.000Z",
      pendingCloudReviewDataDeleteJob: {
        jobId: "del_job_1",
        status: "scheduled" as const,
        requestedAt: "2026-05-27T12:00:00.000Z",
        scheduledForAt: "2026-06-03T12:00:00.000Z",
      },
    }
    const client = {
      fetchCloudDataDeleteJob: vi.fn(async () => ({
        jobId: "del_job_1",
        scope: { collections: ["vocabulary", "review_schedule"] },
        status: "completed",
        requestedAt: "2026-05-27T12:00:00.000Z",
        scheduledForAt: "2026-06-03T12:00:00.000Z",
        completedAt: "2026-06-03T12:01:00.000Z",
        gracePeriodSeconds: 604800,
      })),
    } as unknown as MobileAstraClient

    const refreshed = await refreshMobileCloudReviewDataDeleteJob({ state, client, device })

    expect(client.fetchCloudDataDeleteJob).toHaveBeenCalledWith(expect.objectContaining({ session, device, jobId: "del_job_1" }))
    expect(refreshed.pendingCloudReviewDataDeleteJob).toBeNull()
    expect(refreshed.sampleDeck).toBe(true)
    expect(refreshed.cloudVocabulary.entries).toHaveLength(0)
    expect(refreshed.privateSourceIds).toEqual([])
    expect(refreshed.privateSourceItemIds).toEqual([])
    expect(refreshed.removedSourceIds).toEqual([])
    expect(refreshed.syncCursors).toMatchObject({ vocabulary: null, review_schedule: null })
    expect(refreshed.lastSyncedAt).toBeNull()
    expect(refreshed.cloudReviewDataDeleteJobHistory).toHaveLength(1)
    expect(refreshed.cloudReviewDataDeleteJobHistory[0]).toMatchObject({ jobId: "del_job_1", status: "completed", completedAt: "2026-06-03T12:01:00.000Z" })
    expect(refreshed.message).toContain("completed")
  })

  it("restores bounded cloud deletion job history from storage", () => {
    const history = Array.from({ length: 7 }, (_, index) => ({
      jobId: `del_job_${index}`,
      status: index === 0 ? "completed" : "failed",
      requestedAt: "2026-05-27T12:00:00.000Z",
      scheduledForAt: "2026-06-03T12:00:00.000Z",
      completedAt: index === 0 ? "2026-06-03T12:01:00.000Z" : null,
    }))

    const parsed = parseMobileAppState(JSON.stringify({
      version: 1,
      cloudReviewDataDeleteJobHistory: [...history, { jobId: "bad", status: "unknown" }],
    }))

    expect(parsed.cloudReviewDataDeleteJobHistory).toHaveLength(5)
    expect(parsed.cloudReviewDataDeleteJobHistory[0]).toMatchObject({ jobId: "del_job_0", status: "completed" })
  })

  it("keeps pending cloud deletion status retryable when status refresh fails", async () => {
    const session = {
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    }
    const state = {
      ...DEFAULT_MOBILE_APP_STATE,
      session,
      pendingCloudReviewDataDeleteJob: {
        jobId: "del_job_1",
        status: "scheduled" as const,
        requestedAt: "2026-05-27T12:00:00.000Z",
        scheduledForAt: "2026-06-03T12:00:00.000Z",
      },
    }
    const client = {
      fetchCloudDataDeleteJob: vi.fn(async () => {
        throw new Error("offline")
      }),
    } as unknown as MobileAstraClient

    const refreshed = await refreshMobileCloudReviewDataDeleteJob({ state, client, device })

    expect(refreshed.pendingCloudReviewDataDeleteJob).toEqual(state.pendingCloudReviewDataDeleteJob)
    expect(refreshed.syncStatus).toBe("offline")
  })

  it("applies cloud vocabulary snapshots as real mobile review data", () => {
    const next = applyCloudVocabularyToMobileState(DEFAULT_MOBILE_APP_STATE, {
      entries: [{
        id: "vocab-1",
        text: "resilient",
        translation: "能恢复的；有韧性的",
        savedAt: Date.UTC(2026, 4, 27, 9, 0, 0),
        sourceContext: { pageTitle: "Distributed Systems", hostname: "example.com" },
      }],
      reviewSchedules: [],
    }, new Date("2026-05-27T12:00:00.000Z"))

    expect(next.sampleDeck).toBe(false)
    expect(next.reviewSnapshot.savedItems[0]).toMatchObject({ itemId: "vocab-1", text: "resilient" })
  })
})
