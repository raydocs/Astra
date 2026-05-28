import { describe, expect, it } from "vitest"

import { MemoryMobileKeyValueStorage } from "../state/mobileStorage"
import {
  MOBILE_RETENTION_ANALYTICS_MAX_EVENTS,
  MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS,
  MOBILE_RETENTION_ANALYTICS_STORAGE_KEY,
  MOBILE_RETENTION_ANALYTICS_UPLOADED_EVENT_IDS_STORAGE_KEY,
  MOBILE_RETENTION_ANALYTICS_UPLOAD_SCHEMA,
  aggregateMobileRetentionDashboard,
  buildMobileRetentionUploadBatch,
  buildMobileRetentionUploadBatchFromEvents,
  buildPendingMobileRetentionUploadBatch,
  buildReminderAnalyticsMetadata,
  getMobileRetentionUploadedEventIds,
  getRecentMobileRetentionEvents,
  markMobileRetentionEventsUploaded,
  parseStoredMobileRetentionEvents,
  parseStoredMobileRetentionUploadedEventIds,
  sanitizeMobileRetentionEventMetadata,
  sanitizeMobileRetentionMetadata,
  trackMobileRetentionEvent,
} from "./retentionAnalytics"

describe("mobile retention analytics", () => {
  it("persists bounded recent events newest first", async () => {
    const storage = new MemoryMobileKeyValueStorage()

    for (let index = 0; index < MOBILE_RETENTION_ANALYTICS_MAX_EVENTS + 5; index += 1) {
      await trackMobileRetentionEvent({
        storage,
        name: "sync_attempted",
        data: { pendingCount: index },
        timestamp: Date.UTC(2026, 4, 1, 12, 0, index),
      })
    }

    const events = await getRecentMobileRetentionEvents(storage, 500)
    expect(events).toHaveLength(MOBILE_RETENTION_ANALYTICS_MAX_EVENTS)
    expect(events[0].data.pendingCount).toBe(MOBILE_RETENTION_ANALYTICS_MAX_EVENTS + 4)
    expect(events.at(-1)?.data.pendingCount).toBe(5)
  })

  it("serializes overlapping writes without dropping events", async () => {
    const storage = new MemoryMobileKeyValueStorage()

    await Promise.all(Array.from({ length: 12 }, (_, index) => trackMobileRetentionEvent({
      storage,
      name: "sync_attempted",
      data: { pendingCount: index },
      timestamp: Date.UTC(2026, 4, 27, 12, 0, index),
    })))

    const events = await getRecentMobileRetentionEvents(storage, 20)
    expect(events).toHaveLength(12)
    expect(events.map((event) => event.data.pendingCount).sort((a, b) => Number(a) - Number(b))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it("keeps event payloads privacy-safe", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    await trackMobileRetentionEvent({
      storage,
      name: "review_rated",
      data: {
        rating: "good",
        cardText: "should not keep text because key is not allowlisted by value length but this value is short",
        text: "secret card text",
        snippet: "selected snippet",
        context: "sentence context",
        fullUrl: "https://example.com/path?q=1",
        email: "learner@example.com",
        token: "secret-token",
        secretLabel: "secret value",
        reason: "secret-token",
        sourceType: "article",
        dueCount: 3,
      },
      timestamp: Date.UTC(2026, 4, 27, 12, 0, 0),
    })

    const raw = await storage.getItem(MOBILE_RETENTION_ANALYTICS_STORAGE_KEY)
    expect(raw).not.toContain("secret card text")
    expect(raw).not.toContain("selected snippet")
    expect(raw).not.toContain("sentence context")
    expect(raw).not.toContain("https://example.com")
    expect(raw).not.toContain("learner@example.com")
    expect(raw).not.toContain("secret-token")
    expect(raw).not.toContain("secret value")

    const [event] = parseStoredMobileRetentionEvents(raw)
    expect(event.data).toMatchObject({ rating: "good", sourceType: "article", dueCount: 3 })
    expect(event.data).not.toHaveProperty("cardText")
    expect(event.data).not.toHaveProperty("text")
    expect(event.data).not.toHaveProperty("snippet")
    expect(event.data).not.toHaveProperty("fullUrl")
    expect(event.data).not.toHaveProperty("secretLabel")
    expect(event.data).not.toHaveProperty("reason")
  })

  it("builds a bounded privacy-safe upload batch", () => {
    const events = Array.from({ length: MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS + 3 }, (_, index) => ({
      id: `event-${index}`,
      name: "review_rated" as const,
      timestamp: Date.UTC(2026, 4, 27, 12, 0, index),
      data: {
        rating: "good",
        sourceType: "page",
        dueCount: index,
        text: "card text must not upload",
        snippet: "snippet must not upload",
        email: "learner@example.com",
        sourceUrl: "https://example.com/private",
        token: "secret-token",
        reason: "secret-token",
      },
    }))

    const batch = buildMobileRetentionUploadBatchFromEvents(events, { generatedAt: new Date("2026-05-27T12:00:00.000Z") })
    const raw = JSON.stringify(batch)

    expect(batch.schema).toBe(MOBILE_RETENTION_ANALYTICS_UPLOAD_SCHEMA)
    expect(batch.generatedAt).toBe("2026-05-27T12:00:00.000Z")
    expect(batch.events).toHaveLength(MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS)
    expect(batch.events[0]).toMatchObject({ id: `event-${MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS + 2}`, metadata: { rating: "good", sourceType: "page", dueCount: MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS + 2 } })
    expect(raw).not.toContain("card text")
    expect(raw).not.toContain("snippet must not upload")
    expect(raw).not.toContain("learner@example.com")
    expect(raw).not.toContain("https://example.com")
    expect(raw).not.toContain("secret-token")
    expect(batch.events[0].metadata).not.toHaveProperty("text")
    expect(batch.events[0].metadata).not.toHaveProperty("sourceUrl")
    expect(batch.events[0].metadata).not.toHaveProperty("reason")
  })

  it("builds upload batches from sanitized local storage", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    await trackMobileRetentionEvent({
      storage,
      name: "sync_failed",
      data: { status: "offline", reason: "secret-token", email: "learner@example.com" },
      timestamp: Date.UTC(2026, 4, 27, 12),
    })

    const batch = await buildMobileRetentionUploadBatch(storage, { generatedAt: new Date("2026-05-27T12:00:00.000Z") })
    expect(batch.events).toHaveLength(1)
    expect(batch.events[0].metadata).toEqual({ status: "offline" })
  })

  it("tracks uploaded event ids so pending upload batches do not resend acknowledged events", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    await trackMobileRetentionEvent({
      storage,
      name: "app_opened",
      data: { surface: "mobile" },
      timestamp: Date.UTC(2026, 4, 27, 12, 0, 0),
    })
    await trackMobileRetentionEvent({
      storage,
      name: "sync_attempted",
      data: { pendingCount: 1 },
      timestamp: Date.UTC(2026, 4, 27, 12, 1, 0),
    })

    const firstBatch = await buildPendingMobileRetentionUploadBatch(storage, { generatedAt: new Date("2026-05-27T12:00:00.000Z") })
    expect(firstBatch.events).toHaveLength(2)

    await markMobileRetentionEventsUploaded(storage, [firstBatch.events[0]])
    const secondBatch = await buildPendingMobileRetentionUploadBatch(storage, { generatedAt: new Date("2026-05-27T12:05:00.000Z") })
    expect(secondBatch.events.map((event) => event.id)).toEqual([firstBatch.events[1].id])

    await markMobileRetentionEventsUploaded(storage, firstBatch.events)
    expect(await buildPendingMobileRetentionUploadBatch(storage)).toMatchObject({ events: [] })
    expect(await getMobileRetentionUploadedEventIds(storage)).toEqual(new Set(firstBatch.events.map((event) => event.id)))
  })

  it("parses uploaded event id acknowledgements defensively", async () => {
    const storage = new MemoryMobileKeyValueStorage()
    await storage.setItem(MOBILE_RETENTION_ANALYTICS_UPLOADED_EVENT_IDS_STORAGE_KEY, JSON.stringify(["event-1", "", "event-2", 3, "x".repeat(121)]))

    expect(parseStoredMobileRetentionUploadedEventIds(null)).toEqual(new Set())
    expect(parseStoredMobileRetentionUploadedEventIds("not-json")).toEqual(new Set())
    expect(await getMobileRetentionUploadedEventIds(storage)).toEqual(new Set(["event-1", "event-2"]))
  })

  it("sanitizes unsafe metadata values and keys", () => {
    expect(sanitizeMobileRetentionMetadata({
      sourceType: "article",
      sourceUrl: "https://example.com/article",
      weird_key: "ok",
      "bad-key": "no",
      path: "/private/path",
      nested: { count: 1 },
    })).toEqual({ sourceType: "article", weird_key: "ok" })
  })

  it("allowlists metadata by event name", () => {
    expect(sanitizeMobileRetentionEventMetadata("review_rated", {
      rating: "good",
      sourceType: "article",
      dueCount: 3,
      sourceId: "source-private",
      accountId: "acct-1",
      authorization: "Bearer abc",
      credential: "secret",
    })).toEqual({ rating: "good", sourceType: "article", dueCount: 3 })
    expect(sanitizeMobileRetentionEventMetadata("review_skipped", {
      reason: "not_useful",
      sampleDeck: false,
      sourceScoped: true,
      text: "card text",
    })).toEqual({ reason: "not_useful", sampleDeck: false, sourceScoped: true })
  })

  it("aggregates retention dashboard counts", () => {
    const events = parseStoredMobileRetentionEvents(JSON.stringify([
      { id: "1", name: "app_opened", timestamp: Date.UTC(2026, 4, 25, 8), data: {} },
      { id: "2", name: "app_opened", timestamp: Date.UTC(2026, 4, 27, 8), data: {} },
      { id: "3", name: "app_opened", timestamp: Date.UTC(2026, 5, 2, 8), data: {} },
      { id: "3-old-review", name: "review_rated", timestamp: Date.UTC(2026, 4, 20, 8), data: { rating: "again" } },
      { id: "3-old-sync", name: "sync_failed", timestamp: Date.UTC(2026, 4, 20, 9), data: {} },
      { id: "4", name: "review_rated", timestamp: Date.UTC(2026, 5, 2, 9), data: { rating: "good" } },
      { id: "5", name: "review_skipped", timestamp: Date.UTC(2026, 5, 2, 10), data: { rating: "skip" } },
      { id: "6", name: "sync_attempted", timestamp: Date.UTC(2026, 5, 2, 11), data: {} },
      { id: "7", name: "sync_succeeded", timestamp: Date.UTC(2026, 5, 2, 12), data: {} },
      { id: "8", name: "sync_failed", timestamp: Date.UTC(2026, 5, 2, 13), data: {} },
      { id: "9", name: "source_hidden", timestamp: Date.UTC(2026, 5, 2, 14), data: {} },
      { id: "10", name: "source_restored", timestamp: Date.UTC(2026, 5, 2, 15), data: {} },
      { id: "11", name: "source_removed", timestamp: Date.UTC(2026, 5, 2, 16), data: {} },
      { id: "12", name: "reminder_preference_changed", timestamp: Date.UTC(2026, 5, 2, 17), data: { enabled: true } },
      { id: "12-old", name: "reminder_preference_changed", timestamp: Date.UTC(2026, 4, 2, 17), data: { enabled: false } },
      { id: "13", name: "notification_tapped", timestamp: Date.UTC(2026, 5, 2, 18), data: {} },
      { id: "14", name: "sign_in_succeeded", timestamp: Date.UTC(2026, 5, 2, 19), data: {} },
      { id: "15", name: "link_failed", timestamp: Date.UTC(2026, 5, 2, 20), data: {} },
      { id: "16", name: "cloud_learning_delete_requested", timestamp: Date.UTC(2026, 5, 2, 21), data: {} },
      { id: "17", name: "cloud_learning_delete_succeeded", timestamp: Date.UTC(2026, 5, 2, 22), data: {} },
    ]))

    const dashboard = aggregateMobileRetentionDashboard(events)
    expect(dashboard.weeklyAppOpens).toEqual([
      { weekStart: "2026-05-25", count: 2 },
      { weekStart: "2026-06-01", count: 1 },
    ])
    expect(dashboard.reviewActions).toMatchObject({ total: 3, skipped: 1, ratings: { again: 1, good: 1, skip: 1 } })
    expect(dashboard.recent7Days).toEqual({ appOpens: 2, reviewActions: 2, syncSuccesses: 1, syncFailures: 1, notificationTaps: 1 })
    expect(dashboard.reminderEnabled).toBe(true)
    expect(dashboard.sync).toEqual({ attempts: 1, successes: 1, failures: 2 })
    expect(dashboard.sourceActions).toEqual({ hidden: 1, restored: 1, removed: 1 })
    expect(dashboard.auth).toMatchObject({ signInSuccesses: 1, linkFailures: 1 })
    expect(dashboard.cloudLearningDeletion).toMatchObject({ requested: 1, succeeded: 1 })
    expect(dashboard.notificationTaps).toBe(1)
    expect(dashboard.privacyPolicy).toContain("no card text")
  })

  it("derives reminder analytics metadata without personal content", () => {
    expect(buildReminderAnalyticsMetadata({
      reviewReminder: "daily",
      preferredTime: "evening",
      weeklyDigest: false,
      updatedAt: "2026-05-27T12:00:00.000Z",
    })).toEqual({
      reviewReminder: "daily",
      preferredTime: "evening",
      weeklyDigest: false,
      enabled: true,
    })
  })
})
