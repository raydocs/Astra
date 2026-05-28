import type { MobileKeyValueStorage } from "../state/mobileStorage"
import type { MobileReminderPreference } from "../state/mobileAppState"
import type { ReviewRating } from "./review"

export const MOBILE_RETENTION_ANALYTICS_STORAGE_KEY = "astra.mobile.retention-analytics.v1"
export const MOBILE_RETENTION_ANALYTICS_UPLOADED_EVENT_IDS_STORAGE_KEY = "astra.mobile.retention-analytics-uploaded-event-ids.v1"
export const MOBILE_RETENTION_ANALYTICS_MAX_EVENTS = 200
export const MOBILE_RETENTION_ANALYTICS_MAX_UPLOADED_EVENT_IDS = 500
export const MOBILE_RETENTION_ANALYTICS_UPLOAD_SCHEMA = "astra-mobile-retention-events.v1"
export const MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS = 50

export type MobileRetentionEventName =
  | "app_opened"
  | "app_hydrated"
  | "review_rated"
  | "review_skipped"
  | "sync_attempted"
  | "sync_succeeded"
  | "sync_failed"
  | "reminder_preference_changed"
  | "notification_tapped"
  | "sign_in_succeeded"
  | "sign_in_failed"
  | "link_succeeded"
  | "link_failed"
  | "source_hidden"
  | "source_restored"
  | "source_removed"
  | "cloud_learning_delete_requested"
  | "cloud_learning_delete_succeeded"
  | "cloud_learning_delete_failed"

export interface MobileRetentionEvent {
  id: string
  name: MobileRetentionEventName
  timestamp: number
  data: Record<string, string | number | boolean | null>
}

export interface MobileRetentionUploadEvent {
  id: string
  name: MobileRetentionEventName
  timestamp: number
  metadata: Record<string, string | number | boolean | null>
}

export interface MobileRetentionUploadBatch {
  schema: typeof MOBILE_RETENTION_ANALYTICS_UPLOAD_SCHEMA
  generatedAt: string
  events: MobileRetentionUploadEvent[]
}

export interface MobileRetentionDashboard {
  totalEvents: number
  latestTimestamp: number | null
  recent7Days: {
    appOpens: number
    reviewActions: number
    syncSuccesses: number
    syncFailures: number
    notificationTaps: number
  }
  weeklyAppOpens: Array<{ weekStart: string; count: number }>
  reviewActions: {
    total: number
    ratings: Partial<Record<ReviewRating, number>>
    skipped: number
  }
  reminderEnabled: boolean
  sync: {
    attempts: number
    successes: number
    failures: number
  }
  sourceActions: {
    hidden: number
    restored: number
    removed: number
  }
  auth: {
    signInSuccesses: number
    signInFailures: number
    linkSuccesses: number
    linkFailures: number
  }
  cloudLearningDeletion: {
    requested: number
    succeeded: number
    failed: number
  }
  notificationTaps: number
  privacyPolicy: string
}

const ALLOWED_DATA_KEYS_BY_EVENT: Record<MobileRetentionEventName, Set<string>> = {
  app_opened: new Set(["surface"]),
  app_hydrated: new Set(["signedIn", "sampleDeck", "status"]),
  review_rated: new Set(["rating", "sampleDeck", "sourceScoped", "sourceType", "dueCount"]),
  review_skipped: new Set(["rating", "reason", "sampleDeck", "sourceScoped", "sourceType", "dueCount"]),
  sync_attempted: new Set(["pendingCount"]),
  sync_succeeded: new Set(["status"]),
  sync_failed: new Set(["status", "reason"]),
  reminder_preference_changed: new Set(["reviewReminder", "preferredTime", "weeklyDigest", "enabled"]),
  notification_tapped: new Set(["action"]),
  sign_in_succeeded: new Set(["sampleDeck", "syncStatus"]),
  sign_in_failed: new Set(["reason"]),
  link_succeeded: new Set(["sampleDeck", "syncStatus"]),
  link_failed: new Set(["reason"]),
  source_hidden: new Set(["sampleDeck"]),
  source_restored: new Set(["sampleDeck", "fromRemoved"]),
  source_removed: new Set(["sampleDeck"]),
  cloud_learning_delete_requested: new Set(["signedIn"]),
  cloud_learning_delete_succeeded: new Set(["status"]),
  cloud_learning_delete_failed: new Set(["reason"]),
}

const FORBIDDEN_DATA_KEYS = new Set([
  "text",
  "front",
  "back",
  "snippet",
  "sentence",
  "context",
  "translation",
  "explanation",
  "url",
  "fullUrl",
  "sourceUrl",
  "href",
  "email",
  "password",
  "secret",
  "token",
  "sessionToken",
  "apiKey",
  "key",
])

function createMobileRetentionEventId(timestamp: number): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`
}

function isMobileRetentionEventName(value: unknown): value is MobileRetentionEventName {
  return typeof value === "string" && [
    "app_opened",
    "app_hydrated",
    "review_rated",
    "review_skipped",
    "sync_attempted",
    "sync_succeeded",
    "sync_failed",
    "reminder_preference_changed",
    "notification_tapped",
    "sign_in_succeeded",
    "sign_in_failed",
    "link_succeeded",
    "link_failed",
    "source_hidden",
    "source_restored",
    "source_removed",
    "cloud_learning_delete_requested",
    "cloud_learning_delete_succeeded",
    "cloud_learning_delete_failed",
  ].includes(value)
}

function isForbiddenMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return FORBIDDEN_DATA_KEYS.has(key)
    || normalized.includes("text")
    || normalized.includes("snippet")
    || normalized.includes("sentence")
    || normalized.includes("context")
    || normalized.includes("translation")
    || normalized.includes("explanation")
    || normalized.includes("url")
    || normalized.includes("href")
    || normalized.includes("email")
    || normalized.includes("password")
    || normalized.includes("secret")
    || normalized.includes("token")
    || normalized.includes("apikey")
}

function isSafeMetadataValue(value: unknown): value is string | number | boolean | null {
  if (value == null) return true
  if (typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "string") return false
  if (value.length > 80) return false
  const normalized = value.toLowerCase()
  if (normalized.includes("secret") || normalized.includes("token")) return false
  if (value.includes("://") || value.includes("/") || value.includes("@")) return false
  return true
}

export function sanitizeMobileRetentionMetadata(data: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isForbiddenMetadataKey(key)) continue
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) continue
    if (!isSafeMetadataValue(value)) continue
    safe[key] = typeof value === "string" ? value.slice(0, 80) : value
  }
  return safe
}

export function sanitizeMobileRetentionEventMetadata(
  name: MobileRetentionEventName,
  data: Record<string, unknown> = {},
): Record<string, string | number | boolean | null> {
  const allowedKeys = ALLOWED_DATA_KEYS_BY_EVENT[name]
  const sanitized = sanitizeMobileRetentionMetadata(data)
  return Object.fromEntries(Object.entries(sanitized).filter(([key]) => allowedKeys.has(key)))
}

export function parseStoredMobileRetentionEvents(raw: string | null | undefined): MobileRetentionEvent[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((event): event is MobileRetentionEvent => {
      if (!event || typeof event !== "object") return false
      const candidate = event as Partial<MobileRetentionEvent>
      return typeof candidate.id === "string"
        && isMobileRetentionEventName(candidate.name)
        && typeof candidate.timestamp === "number"
        && Number.isFinite(candidate.timestamp)
        && candidate.data != null
        && typeof candidate.data === "object"
    }).map((event) => ({
      id: event.id,
      name: event.name,
      timestamp: event.timestamp,
      data: sanitizeMobileRetentionEventMetadata(event.name, event.data),
    }))
  } catch {
    return []
  }
}

export function serializeMobileRetentionEvents(events: MobileRetentionEvent[]): string {
  return JSON.stringify(events
    .map((event) => ({ ...event, data: sanitizeMobileRetentionEventMetadata(event.name, event.data) }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MOBILE_RETENTION_ANALYTICS_MAX_EVENTS))
}

export function parseStoredMobileRetentionUploadedEventIds(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120))
  } catch {
    return new Set()
  }
}

function serializeMobileRetentionUploadedEventIds(ids: string[]): string {
  return JSON.stringify(ids
    .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120)
    .slice(0, MOBILE_RETENTION_ANALYTICS_MAX_UPLOADED_EVENT_IDS))
}

export async function getMobileRetentionUploadedEventIds(storage: MobileKeyValueStorage): Promise<Set<string>> {
  return parseStoredMobileRetentionUploadedEventIds(await storage.getItem(MOBILE_RETENTION_ANALYTICS_UPLOADED_EVENT_IDS_STORAGE_KEY))
}

export async function markMobileRetentionEventsUploaded(
  storage: MobileKeyValueStorage,
  events: Array<Pick<MobileRetentionUploadEvent, "id">>,
): Promise<void> {
  if (events.length === 0) return
  const existing = Array.from(await getMobileRetentionUploadedEventIds(storage))
  const next: string[] = []
  const seen = new Set<string>()
  for (const id of [...events.map((event) => event.id), ...existing]) {
    if (seen.has(id) || id.length === 0 || id.length > 120) continue
    seen.add(id)
    next.push(id)
    if (next.length >= MOBILE_RETENTION_ANALYTICS_MAX_UPLOADED_EVENT_IDS) break
  }
  await storage.setItem(MOBILE_RETENTION_ANALYTICS_UPLOADED_EVENT_IDS_STORAGE_KEY, serializeMobileRetentionUploadedEventIds(next))
}

export async function getRecentMobileRetentionEvents(storage: MobileKeyValueStorage, limit = 50): Promise<MobileRetentionEvent[]> {
  const events = parseStoredMobileRetentionEvents(await storage.getItem(MOBILE_RETENTION_ANALYTICS_STORAGE_KEY))
  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.max(0, limit))
}

export function buildMobileRetentionUploadBatchFromEvents(
  events: MobileRetentionEvent[],
  options: { limit?: number; generatedAt?: Date; excludeEventIds?: ReadonlySet<string> } = {},
): MobileRetentionUploadBatch {
  const limit = Math.max(0, Math.min(options.limit ?? MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS, MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS))
  return {
    schema: MOBILE_RETENTION_ANALYTICS_UPLOAD_SCHEMA,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    events: events
      .filter((event) => !options.excludeEventIds?.has(event.id))
      .map((event) => ({
        id: event.id,
        name: event.name,
        timestamp: event.timestamp,
        metadata: sanitizeMobileRetentionEventMetadata(event.name, event.data),
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit),
  }
}

export async function buildMobileRetentionUploadBatch(
  storage: MobileKeyValueStorage,
  options: { limit?: number; generatedAt?: Date; excludeEventIds?: ReadonlySet<string> } = {},
): Promise<MobileRetentionUploadBatch> {
  return buildMobileRetentionUploadBatchFromEvents(
    await getRecentMobileRetentionEvents(storage, options.limit ?? MOBILE_RETENTION_ANALYTICS_MAX_UPLOAD_EVENTS),
    options,
  )
}

export async function buildPendingMobileRetentionUploadBatch(
  storage: MobileKeyValueStorage,
  options: { limit?: number; generatedAt?: Date } = {},
): Promise<MobileRetentionUploadBatch> {
  return buildMobileRetentionUploadBatch(storage, {
    ...options,
    excludeEventIds: await getMobileRetentionUploadedEventIds(storage),
  })
}

let mobileRetentionAnalyticsWriteQueue: Promise<void> = Promise.resolve()

async function appendMobileRetentionEvent(params: {
  storage: MobileKeyValueStorage
  event: MobileRetentionEvent
}): Promise<void> {
  const existing = parseStoredMobileRetentionEvents(await params.storage.getItem(MOBILE_RETENTION_ANALYTICS_STORAGE_KEY))
  await params.storage.setItem(MOBILE_RETENTION_ANALYTICS_STORAGE_KEY, serializeMobileRetentionEvents([params.event, ...existing]))
}

export async function trackMobileRetentionEvent(params: {
  storage: MobileKeyValueStorage
  name: MobileRetentionEventName
  data?: Record<string, unknown>
  timestamp?: number
}): Promise<void> {
  const timestamp = params.timestamp ?? Date.now()
  const event: MobileRetentionEvent = {
    id: createMobileRetentionEventId(timestamp),
    name: params.name,
    timestamp,
    data: sanitizeMobileRetentionEventMetadata(params.name, params.data),
  }
  mobileRetentionAnalyticsWriteQueue = mobileRetentionAnalyticsWriteQueue
    .catch(() => {
      // Keep later analytics writes from being blocked by an earlier local storage failure.
    })
    .then(() => appendMobileRetentionEvent({ storage: params.storage, event }))
  return mobileRetentionAnalyticsWriteQueue
}

export function fireAndForgetMobileRetentionEvent(params: {
  storage: MobileKeyValueStorage
  name: MobileRetentionEventName
  data?: Record<string, unknown>
  timestamp?: number
}): void {
  void trackMobileRetentionEvent(params).catch(() => {
    // Analytics are local diagnostics only; never block product flows.
  })
}

function weekStartUtc(timestamp: number): string {
  const date = new Date(timestamp)
  const day = date.getUTCDay()
  const diff = (day + 6) % 7
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - diff)
  return start.toISOString().slice(0, 10)
}

function createEmptyRatingCounts(): Partial<Record<ReviewRating, number>> {
  return { again: 0, good: 0, easy: 0, skip: 0 }
}

export function aggregateMobileRetentionDashboard(events: MobileRetentionEvent[]): MobileRetentionDashboard {
  const latestTimestamp = events.reduce<number | null>((latest, event) => latest == null || event.timestamp > latest ? event.timestamp : latest, null)
  const recent7DaysCutoff = latestTimestamp == null ? null : latestTimestamp - 7 * 24 * 60 * 60 * 1000
  const weeklyOpens = new Map<string, number>()
  const ratings = createEmptyRatingCounts()
  const recent7Days = {
    appOpens: 0,
    reviewActions: 0,
    syncSuccesses: 0,
    syncFailures: 0,
    notificationTaps: 0,
  }
  let reminderEnabled = false
  let reminderPreferenceTimestamp: number | null = null
  let attempts = 0
  let successes = 0
  let failures = 0
  let sourceHidden = 0
  let sourceRestored = 0
  let sourceRemoved = 0
  let signInSuccesses = 0
  let signInFailures = 0
  let linkSuccesses = 0
  let linkFailures = 0
  let deleteRequested = 0
  let deleteSucceeded = 0
  let deleteFailed = 0
  let notificationTaps = 0

  for (const event of events) {
    const isRecent7Days = recent7DaysCutoff != null && event.timestamp >= recent7DaysCutoff
    if (isRecent7Days && event.name === "app_opened") recent7Days.appOpens += 1
    if (isRecent7Days && (event.name === "review_rated" || event.name === "review_skipped")) recent7Days.reviewActions += 1
    if (isRecent7Days && event.name === "sync_succeeded") recent7Days.syncSuccesses += 1
    if (isRecent7Days && event.name === "sync_failed") recent7Days.syncFailures += 1
    if (isRecent7Days && event.name === "notification_tapped") recent7Days.notificationTaps += 1

    if (event.name === "app_opened") {
      const week = weekStartUtc(event.timestamp)
      weeklyOpens.set(week, (weeklyOpens.get(week) ?? 0) + 1)
    }
    if (event.name === "review_rated" || event.name === "review_skipped") {
      const rating = event.name === "review_skipped" ? "skip" : event.data.rating
      if (rating === "again" || rating === "good" || rating === "easy" || rating === "skip") {
        ratings[rating] = (ratings[rating] ?? 0) + 1
      }
    }
    if (event.name === "reminder_preference_changed" && (reminderPreferenceTimestamp == null || event.timestamp > reminderPreferenceTimestamp)) {
      reminderPreferenceTimestamp = event.timestamp
      reminderEnabled = event.data.enabled === true
    }
    if (event.name === "sync_attempted") attempts += 1
    if (event.name === "sync_succeeded") successes += 1
    if (event.name === "sync_failed") failures += 1
    if (event.name === "source_hidden") sourceHidden += 1
    if (event.name === "source_restored") sourceRestored += 1
    if (event.name === "source_removed") sourceRemoved += 1
    if (event.name === "sign_in_succeeded") signInSuccesses += 1
    if (event.name === "sign_in_failed") signInFailures += 1
    if (event.name === "link_succeeded") linkSuccesses += 1
    if (event.name === "link_failed") linkFailures += 1
    if (event.name === "cloud_learning_delete_requested") deleteRequested += 1
    if (event.name === "cloud_learning_delete_succeeded") deleteSucceeded += 1
    if (event.name === "cloud_learning_delete_failed") deleteFailed += 1
    if (event.name === "notification_tapped") notificationTaps += 1
  }

  const skipped = ratings.skip ?? 0
  return {
    totalEvents: events.length,
    latestTimestamp,
    recent7Days,
    weeklyAppOpens: Array.from(weeklyOpens.entries())
      .map(([weekStart, count]) => ({ weekStart, count }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    reviewActions: {
      total: (ratings.again ?? 0) + (ratings.good ?? 0) + (ratings.easy ?? 0) + skipped,
      ratings,
      skipped,
    },
    reminderEnabled,
    sync: { attempts, successes, failures },
    sourceActions: { hidden: sourceHidden, restored: sourceRestored, removed: sourceRemoved },
    auth: { signInSuccesses, signInFailures, linkSuccesses, linkFailures },
    cloudLearningDeletion: { requested: deleteRequested, succeeded: deleteSucceeded, failed: deleteFailed },
    notificationTaps,
    privacyPolicy: "Mobile retention analytics use event names, timestamps, counts, and coarse action metadata only. Signed-in diagnostics may sync to Astra; no card text, snippets, email addresses, secrets, or full URLs are stored.",
  }
}

export function buildReminderAnalyticsMetadata(preference: MobileReminderPreference): Record<string, string | boolean> {
  return {
    reviewReminder: preference.reviewReminder,
    preferredTime: preference.preferredTime,
    weeklyDigest: preference.weeklyDigest,
    enabled: preference.reviewReminder !== "off" || preference.weeklyDigest,
  }
}
