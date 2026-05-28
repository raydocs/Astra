import type { MobileAstraClient, MobileAstraSession, MobileCloudDataDeleteCollection, MobileCloudDataDeleteJob, MobileDeviceIdentity, MobileSyncCollection, MobileSyncMutationRecord, MobileSyncPullResponse, MobileSyncPushResponse } from "../api/astraClient"
import { buildMobileReviewSnapshotFromCloudVocabulary, type MobileCloudVocabularySnapshotInput, type MobileSyncedReviewScheduleRecord, type MobileSyncedVocabularyEntry } from "../domain/cloudVocabulary"
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
  type OfflineReviewQueueState,
} from "../domain/offlineQueue"
import { EMPTY_MOBILE_REVIEW_SNAPSHOT, createReviewEvent, sampleMobileReviewSnapshot, type MobileDigestSnapshot, type MobileReviewSnapshot, type ReviewRating, type SavedItem, type SourceContentType } from "../domain/review"
import { MOBILE_APP_STATE_STORAGE_KEY, type MobileKeyValueStorage } from "./mobileStorage"

export type MobileSyncStatus = "idle" | "loading" | "ready" | "offline" | "error"
export type MobileReviewReminderCadence = "off" | "daily" | "weekdays"
export type MobileReminderTime = "morning" | "lunch" | "evening"

export const MOBILE_SESSION_TOKEN_STORAGE_KEY = "astra.mobile.session-token.v1"
export const MOBILE_CLOUD_REVIEW_DELETE_COLLECTIONS: MobileCloudDataDeleteCollection[] = ["vocabulary", "review_schedule"]

export interface MobileReminderPreference {
  reviewReminder: MobileReviewReminderCadence
  preferredTime: MobileReminderTime
  weeklyDigest: boolean
  updatedAt: string | null
}

export interface MobilePendingCloudReviewDataDeleteJob {
  jobId: string
  status: Extract<MobileCloudDataDeleteJob["status"], "queued" | "scheduled" | "running">
  requestedAt: string
  scheduledForAt: string
}

export interface MobileCloudReviewDataDeleteJobHistoryEntry {
  jobId: string
  status: MobileCloudDataDeleteJob["status"]
  requestedAt: string
  scheduledForAt: string
  completedAt: string | null
}

export interface MobileAppState {
  version: 1
  session: MobileAstraSession | null
  reviewSnapshot: MobileReviewSnapshot
  sampleDeck: boolean
  hiddenSourceIds: string[]
  privateSourceIds: string[]
  privateSourceItemIds: string[]
  removedSourceIds: string[]
  dismissedReviewCardIds: string[]
  lastRemovedSource: { sourceId: string; title: string; removedAt: string } | null
  offlineQueue: OfflineReviewQueueState
  cloudVocabulary: MobileCloudVocabularySnapshotInput
  weeklyDigest: MobileDigestSnapshot | null
  syncCursors: Partial<Record<MobileSyncCollection, string | null>>
  syncStatus: MobileSyncStatus
  lastSyncedAt: string | null
  reminderPreference: MobileReminderPreference
  pendingCloudReviewDataDeleteJob: MobilePendingCloudReviewDataDeleteJob | null
  cloudReviewDataDeleteJobHistory: MobileCloudReviewDataDeleteJobHistoryEntry[]
  message: string
}

const MOBILE_CLOUD_REVIEW_DELETE_HISTORY_LIMIT = 5

export const DEFAULT_MOBILE_REMINDER_PREFERENCE: MobileReminderPreference = {
  reviewReminder: "off",
  preferredTime: "evening",
  weeklyDigest: true,
  updatedAt: null,
}

export const DEFAULT_MOBILE_APP_STATE: MobileAppState = {
  version: 1,
  session: null,
  reviewSnapshot: sampleMobileReviewSnapshot,
  sampleDeck: true,
  hiddenSourceIds: [],
  privateSourceIds: [],
  privateSourceItemIds: [],
  removedSourceIds: [],
  dismissedReviewCardIds: [],
  lastRemovedSource: null,
  offlineQueue: EMPTY_OFFLINE_REVIEW_QUEUE,
  cloudVocabulary: { entries: [], reviewSchedules: [] },
  weeklyDigest: null,
  syncCursors: { vocabulary: null, review_schedule: null },
  syncStatus: "idle",
  lastSyncedAt: null,
  reminderPreference: DEFAULT_MOBILE_REMINDER_PREFERENCE,
  pendingCloudReviewDataDeleteJob: null,
  cloudReviewDataDeleteJobHistory: [],
  message: "Try a short sample review. Sign in later to sync your saved cards.",
}

function sessionForAppStateStorage(session: MobileAstraSession | null): Omit<MobileAstraSession, "sessionToken"> | null {
  if (!session) return null
  const { sessionToken: _sessionToken, ...persistedSession } = session
  return persistedSession
}

function parseMobileSession(value: unknown): MobileAstraSession | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<MobileAstraSession>
  if (typeof record.relayBaseURL !== "string") return null
  return {
    version: typeof record.version === "number" ? record.version : 1,
    sessionToken: typeof record.sessionToken === "string" ? record.sessionToken : "",
    sessionId: typeof record.sessionId === "string" ? record.sessionId : null,
    deviceId: typeof record.deviceId === "string" ? record.deviceId : null,
    identityMode: record.identityMode === "authenticated" || record.identityMode === "anonymous" ? record.identityMode : "authenticated",
    relayBaseURL: record.relayBaseURL,
    email: typeof record.email === "string" ? record.email : "",
    plan: typeof record.plan === "string" ? record.plan : "free",
    subscriptionStatus: typeof record.subscriptionStatus === "string" ? record.subscriptionStatus : "unknown",
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : "",
  }
}

export function serializeMobileAppState(state: MobileAppState): string {
  return JSON.stringify({
    ...state,
    session: sessionForAppStateStorage(state.session),
    offlineQueue: serializeOfflineReviewQueue(state.offlineQueue),
  })
}

export function parseMobileAppState(value: string | null | undefined): MobileAppState {
  if (!value) return DEFAULT_MOBILE_APP_STATE
  try {
    const parsed = JSON.parse(value) as Partial<Omit<MobileAppState, "offlineQueue">> & { offlineQueue?: unknown }
    if (parsed.version !== 1) return DEFAULT_MOBILE_APP_STATE
    return {
      ...DEFAULT_MOBILE_APP_STATE,
      ...parsed,
      session: parseMobileSession(parsed.session),
      reviewSnapshot: applyLocalSourcePreferencesToSnapshot(
        parsed.reviewSnapshot ?? DEFAULT_MOBILE_APP_STATE.reviewSnapshot,
        parseMobileSourceIds(parsed.hiddenSourceIds),
        parseMobileSourceIds(parsed.removedSourceIds),
        parseMobileSourceIds(parsed.dismissedReviewCardIds),
        parseMobileSourceIds(parsed.privateSourceIds),
        parseMobileSourceIds(parsed.privateSourceItemIds),
      ),
      sampleDeck: Boolean(parsed.sampleDeck),
      hiddenSourceIds: parseMobileSourceIds(parsed.hiddenSourceIds),
      privateSourceIds: parseMobileSourceIds(parsed.privateSourceIds),
      privateSourceItemIds: parseMobileSourceIds(parsed.privateSourceItemIds),
      removedSourceIds: parseMobileSourceIds(parsed.removedSourceIds),
      dismissedReviewCardIds: parseMobileSourceIds(parsed.dismissedReviewCardIds),
      lastRemovedSource: parseMobileLastRemovedSource(parsed.lastRemovedSource),
      offlineQueue: parseOfflineReviewQueue(typeof parsed.offlineQueue === "string" ? parsed.offlineQueue : null),
      cloudVocabulary: parseMobileCloudVocabulary(parsed.cloudVocabulary),
      weeklyDigest: parseMobileDigestSnapshot(parsed.weeklyDigest),
      syncCursors: parseMobileSyncCursors(parsed.syncCursors),
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      reminderPreference: parseMobileReminderPreference(parsed.reminderPreference),
      pendingCloudReviewDataDeleteJob: parseMobilePendingCloudReviewDataDeleteJob(parsed.pendingCloudReviewDataDeleteJob),
      cloudReviewDataDeleteJobHistory: parseMobileCloudReviewDataDeleteJobHistory(parsed.cloudReviewDataDeleteJobHistory),
      message: typeof parsed.message === "string" ? parsed.message : DEFAULT_MOBILE_APP_STATE.message,
    }
  } catch {
    return DEFAULT_MOBILE_APP_STATE
  }
}

function parseMobileSourceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)))
}

function parseMobileLastRemovedSource(value: unknown): MobileAppState["lastRemovedSource"] {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<NonNullable<MobileAppState["lastRemovedSource"]>>
  if (typeof record.sourceId !== "string" || typeof record.title !== "string" || typeof record.removedAt !== "string") return null
  return { sourceId: record.sourceId, title: record.title, removedAt: record.removedAt }
}

const PRIVATE_SOURCE_TITLE = "Private source"

function resolvePrivateSourceIdsForSnapshot(snapshot: MobileReviewSnapshot, privateSourceIds: string[], privateSourceItemIds: string[]): string[] {
  const privateSources = new Set(privateSourceIds)
  const privateItems = new Set(privateSourceItemIds)
  const itemsBySourceId = new Map<string, SavedItem[]>()
  for (const item of snapshot.savedItems) {
    itemsBySourceId.set(item.sourceId, [...(itemsBySourceId.get(item.sourceId) ?? []), item])
  }
  return snapshot.sources
    .filter((source) => privateSources.has(source.sourceId) || (itemsBySourceId.get(source.sourceId) ?? []).some((item) => privateItems.has(item.itemId)))
    .map((source) => source.sourceId)
}

function applyLocalSourcePreferencesToSnapshot(snapshot: MobileReviewSnapshot, hiddenSourceIds: string[], removedSourceIds: string[], dismissedReviewCardIds: string[] = [], privateSourceIds: string[] = [], privateSourceItemIds: string[] = []): MobileReviewSnapshot {
  const hidden = new Set(hiddenSourceIds)
  const removed = new Set(removedSourceIds)
  const dismissedCards = new Set(dismissedReviewCardIds)
  const privateSources = new Set(privateSourceIds)
  const privateItems = new Set(privateSourceItemIds)
  const sourceIds = new Set(snapshot.sources.filter((source) => !removed.has(source.sourceId)).map((source) => source.sourceId))
  const savedItems = snapshot.savedItems.filter((item) => sourceIds.has(item.sourceId))
  const itemIds = new Set(savedItems.map((item) => item.itemId))
  const itemsBySourceId = new Map<string, SavedItem[]>()
  for (const item of savedItems) {
    itemsBySourceId.set(item.sourceId, [...(itemsBySourceId.get(item.sourceId) ?? []), item])
  }
  return {
    sources: snapshot.sources
      .filter((source) => !removed.has(source.sourceId))
      .map((source) => {
        const { private: _private, ...sourceWithoutPrivate } = source
        const next = { ...sourceWithoutPrivate, hidden: hidden.has(source.sourceId) }
        const sourceIsPrivate = privateSources.has(source.sourceId) || (itemsBySourceId.get(source.sourceId) ?? []).some((item) => privateItems.has(item.itemId))
        if (!sourceIsPrivate) return next
        return {
          sourceId: next.sourceId,
          type: next.type,
          title: PRIVATE_SOURCE_TITLE,
          savedAt: next.savedAt,
          hidden: next.hidden,
          private: true,
        }
      }),
    savedItems,
    reviewCards: snapshot.reviewCards.filter((card) => itemIds.has(card.itemId) && !dismissedCards.has(card.cardId)),
  }
}

export function setMobileSourceHidden(state: MobileAppState, sourceId: string, hidden: boolean): MobileAppState {
  const hiddenSourceIds = hidden
    ? Array.from(new Set([...state.hiddenSourceIds, sourceId]))
    : state.hiddenSourceIds.filter((candidate) => candidate !== sourceId)
  return {
    ...state,
    hiddenSourceIds,
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot({
      ...state.reviewSnapshot,
      sources: state.reviewSnapshot.sources.map((source) => source.sourceId === sourceId ? { ...source, hidden } : source),
    }, hiddenSourceIds, state.removedSourceIds, state.dismissedReviewCardIds, state.privateSourceIds, state.privateSourceItemIds),
    message: hidden
      ? "Source hidden from Today. It remains available in Library."
      : "Source restored to Today when cards are due.",
  }
}

export function setMobileSourcePrivate(state: MobileAppState, sourceId: string, privateTitle: boolean): MobileAppState {
  const baseSnapshot = state.cloudVocabulary.entries.length > 0
    ? buildMobileReviewSnapshotFromCloudVocabulary(state.cloudVocabulary)
    : state.sampleDeck
      ? DEFAULT_MOBILE_APP_STATE.reviewSnapshot
      : state.reviewSnapshot
  const sourceItemIds = new Set(baseSnapshot.savedItems.filter((item) => item.sourceId === sourceId).map((item) => item.itemId))
  const privateSourceIds = privateTitle
    ? Array.from(new Set([...state.privateSourceIds, sourceId]))
    : state.privateSourceIds.filter((candidate) => candidate !== sourceId)
  const privateSourceItemIds = privateTitle
    ? Array.from(new Set([...state.privateSourceItemIds, ...sourceItemIds]))
    : state.privateSourceItemIds.filter((candidate) => !sourceItemIds.has(candidate))
  return {
    ...state,
    privateSourceIds,
    privateSourceItemIds,
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot(baseSnapshot, state.hiddenSourceIds, state.removedSourceIds, state.dismissedReviewCardIds, privateSourceIds, privateSourceItemIds),
    message: privateTitle
      ? "Source title hidden on this phone."
      : "Source title shown on this phone.",
  }
}

export function removeMobileSourceFromDevice(state: MobileAppState, sourceId: string, removedAt = new Date()): MobileAppState {
  const source = state.reviewSnapshot.sources.find((candidate) => candidate.sourceId === sourceId)
  const removedSourceIds = Array.from(new Set([...state.removedSourceIds, sourceId]))
  const hiddenSourceIds = state.hiddenSourceIds.filter((candidate) => candidate !== sourceId)
  const sourceItemIds = new Set(state.reviewSnapshot.savedItems.filter((item) => item.sourceId === sourceId).map((item) => item.itemId))
  const privateSourceIds = state.privateSourceIds.filter((candidate) => candidate !== sourceId)
  const privateSourceItemIds = state.privateSourceItemIds.filter((candidate) => !sourceItemIds.has(candidate))
  return {
    ...state,
    hiddenSourceIds,
    privateSourceIds,
    privateSourceItemIds,
    removedSourceIds,
    lastRemovedSource: { sourceId, title: source?.title ?? "Removed source", removedAt: removedAt.toISOString() },
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot(state.reviewSnapshot, hiddenSourceIds, removedSourceIds, state.dismissedReviewCardIds, privateSourceIds, privateSourceItemIds),
    message: "Source removed from this phone. You can undo it from Library.",
  }
}

export function restoreMobileSourceOnDevice(state: MobileAppState, sourceId: string): MobileAppState {
  const removedSourceIds = state.removedSourceIds.filter((candidate) => candidate !== sourceId)
  const baseSnapshot = state.cloudVocabulary.entries.length > 0
    ? buildMobileReviewSnapshotFromCloudVocabulary(state.cloudVocabulary)
    : DEFAULT_MOBILE_APP_STATE.reviewSnapshot
  return {
    ...state,
    removedSourceIds,
    lastRemovedSource: state.lastRemovedSource?.sourceId === sourceId ? null : state.lastRemovedSource,
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot(baseSnapshot, state.hiddenSourceIds, removedSourceIds, state.dismissedReviewCardIds, state.privateSourceIds, state.privateSourceItemIds),
    message: "Source restored on this phone.",
  }
}

export function markMobileReviewCardNotUseful(state: MobileAppState, cardId: string): MobileAppState {
  const dismissedReviewCardIds = Array.from(new Set([...state.dismissedReviewCardIds, cardId]))
  return {
    ...state,
    dismissedReviewCardIds,
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot(state.reviewSnapshot, state.hiddenSourceIds, state.removedSourceIds, dismissedReviewCardIds, state.privateSourceIds, state.privateSourceItemIds),
    message: "Card removed from Today on this phone.",
  }
}

function parseMobileReminderPreference(value: unknown): MobileReminderPreference {
  if (!value || typeof value !== "object") return DEFAULT_MOBILE_REMINDER_PREFERENCE
  const record = value as Partial<MobileReminderPreference>
  return {
    reviewReminder: record.reviewReminder === "daily" || record.reviewReminder === "weekdays" || record.reviewReminder === "off"
      ? record.reviewReminder
      : DEFAULT_MOBILE_REMINDER_PREFERENCE.reviewReminder,
    preferredTime: record.preferredTime === "morning" || record.preferredTime === "lunch" || record.preferredTime === "evening"
      ? record.preferredTime
      : DEFAULT_MOBILE_REMINDER_PREFERENCE.preferredTime,
    weeklyDigest: typeof record.weeklyDigest === "boolean" ? record.weeklyDigest : DEFAULT_MOBILE_REMINDER_PREFERENCE.weeklyDigest,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  }
}

function isMobileCloudDataDeleteStatus(value: unknown): value is MobileCloudDataDeleteJob["status"] {
  return value === "queued" || value === "scheduled" || value === "running" || value === "completed" || value === "failed" || value === "canceled"
}

function isActiveMobileCloudDataDeleteStatus(value: unknown): value is MobilePendingCloudReviewDataDeleteJob["status"] {
  return value === "queued" || value === "scheduled" || value === "running"
}

function parseMobilePendingCloudReviewDataDeleteJob(value: unknown): MobilePendingCloudReviewDataDeleteJob | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<MobilePendingCloudReviewDataDeleteJob>
  if (typeof record.jobId !== "string" || !isActiveMobileCloudDataDeleteStatus(record.status) || typeof record.requestedAt !== "string" || typeof record.scheduledForAt !== "string") return null
  return {
    jobId: record.jobId,
    status: record.status,
    requestedAt: record.requestedAt,
    scheduledForAt: record.scheduledForAt,
  }
}

function parseMobileCloudReviewDataDeleteJobHistory(value: unknown): MobileCloudReviewDataDeleteJobHistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): MobileCloudReviewDataDeleteJobHistoryEntry | null => {
      if (!item || typeof item !== "object") return null
      const record = item as Partial<MobileCloudReviewDataDeleteJobHistoryEntry>
      if (typeof record.jobId !== "string" || !isMobileCloudDataDeleteStatus(record.status) || typeof record.requestedAt !== "string" || typeof record.scheduledForAt !== "string") return null
      return {
        jobId: record.jobId,
        status: record.status,
        requestedAt: record.requestedAt,
        scheduledForAt: record.scheduledForAt,
        completedAt: typeof record.completedAt === "string" ? record.completedAt : null,
      }
    })
    .filter((entry): entry is MobileCloudReviewDataDeleteJobHistoryEntry => entry !== null)
    .slice(0, MOBILE_CLOUD_REVIEW_DELETE_HISTORY_LIMIT)
}

export function updateMobileReminderPreference(
  state: MobileAppState,
  patch: Partial<Omit<MobileReminderPreference, "updatedAt">>,
  updatedAt = new Date(),
): MobileAppState {
  return {
    ...state,
    reminderPreference: {
      ...state.reminderPreference,
      ...patch,
      updatedAt: updatedAt.toISOString(),
    },
    message: "Reminder preference saved on this phone.",
  }
}

function isSourceContentType(value: unknown): value is SourceContentType {
  return value === "page"
    || value === "video"
    || value === "pdf"
    || value === "doc"
    || value === "book"
    || value === "writing"
    || value === "saved"
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function parseMobileDigestSnapshot(value: unknown): MobileDigestSnapshot | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<MobileDigestSnapshot>
  if (typeof record.digestId !== "string" || typeof record.periodStart !== "string" || typeof record.periodEnd !== "string" || typeof record.generatedAt !== "string") return null
  return {
    digestId: record.digestId,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    reviewedCount: typeof record.reviewedCount === "number" ? record.reviewedCount : 0,
    savedCount: typeof record.savedCount === "number" ? record.savedCount : 0,
    sourceBreakdown: Array.isArray(record.sourceBreakdown)
      ? record.sourceBreakdown.flatMap((item) => (
        isSourceContentType(item.type) && typeof item.count === "number"
          ? [{ type: item.type, count: item.count }]
          : []
      ))
      : [],
    highlightedWords: parseStringList(record.highlightedWords),
    highlightedSentences: parseStringList(record.highlightedSentences),
    nextReviewCount: typeof record.nextReviewCount === "number" ? record.nextReviewCount : 0,
    generatedAt: record.generatedAt,
  }
}

function parseMobileCloudVocabulary(value: unknown): MobileCloudVocabularySnapshotInput {
  if (!value || typeof value !== "object") return { entries: [], reviewSchedules: [] }
  const record = value as Partial<MobileCloudVocabularySnapshotInput>
  return {
    entries: Array.isArray(record.entries) ? record.entries.filter(isMobileSyncedVocabularyEntry) : [],
    reviewSchedules: Array.isArray(record.reviewSchedules) ? record.reviewSchedules.filter(isMobileSyncedReviewScheduleRecord) : [],
  }
}

function parseMobileSyncCursors(value: unknown): Partial<Record<MobileSyncCollection, string | null>> {
  if (!value || typeof value !== "object") return { vocabulary: null, review_schedule: null }
  const record = value as Partial<Record<MobileSyncCollection, unknown>>
  return {
    vocabulary: typeof record.vocabulary === "string" ? record.vocabulary : null,
    review_schedule: typeof record.review_schedule === "string" ? record.review_schedule : null,
  }
}

function isMobileSyncedVocabularyEntry(value: unknown): value is MobileSyncedVocabularyEntry {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<MobileSyncedVocabularyEntry>
  return typeof record.id === "string" && typeof record.text === "string" && typeof record.savedAt === "number"
}

function isMobileSyncedReviewScheduleRecord(value: unknown): value is MobileSyncedReviewScheduleRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<MobileSyncedReviewScheduleRecord>
  return typeof record.vocabularyEntryId === "string" && typeof record.nextReviewAt === "number"
}

export async function loadMobileAppState(storage: MobileKeyValueStorage, secureStorage: MobileKeyValueStorage = storage): Promise<MobileAppState> {
  const state = parseMobileAppState(await storage.getItem(MOBILE_APP_STATE_STORAGE_KEY))
  if (!state.session) return state
  const sessionToken = await secureStorage.getItem(MOBILE_SESSION_TOKEN_STORAGE_KEY) ?? state.session.sessionToken
  if (!sessionToken) {
    return {
      ...state,
      session: null,
      syncStatus: "offline",
      message: "Sign in to bring your saved cards to this phone.",
    }
  }
  return { ...state, session: { ...state.session, sessionToken } }
}

export async function saveMobileAppState(storage: MobileKeyValueStorage, state: MobileAppState, secureStorage: MobileKeyValueStorage = storage): Promise<void> {
  if (state.session?.sessionToken) {
    await secureStorage.setItem(MOBILE_SESSION_TOKEN_STORAGE_KEY, state.session.sessionToken)
  } else {
    await secureStorage.removeItem(MOBILE_SESSION_TOKEN_STORAGE_KEY)
  }
  await storage.setItem(MOBILE_APP_STATE_STORAGE_KEY, serializeMobileAppState(state))
}

export async function clearMobileAppState(storage: MobileKeyValueStorage, secureStorage: MobileKeyValueStorage = storage): Promise<void> {
  await Promise.all([
    storage.removeItem(MOBILE_APP_STATE_STORAGE_KEY),
    secureStorage.removeItem(MOBILE_SESSION_TOKEN_STORAGE_KEY),
  ])
}

function isAcceptedCloudReviewDataDeleteJob(job: MobileCloudDataDeleteJob): boolean {
  const collections = new Set(job.scope.collections)
  const statusAccepted = job.status === "queued" || job.status === "scheduled" || job.status === "running" || job.status === "completed"
  return statusAccepted && collections.has("vocabulary") && collections.has("review_schedule")
}

function pendingCloudReviewDataDeleteJobFromJob(job: MobileCloudDataDeleteJob): MobilePendingCloudReviewDataDeleteJob | null {
  return isActiveMobileCloudDataDeleteStatus(job.status)
    ? { jobId: job.jobId, status: job.status, requestedAt: job.requestedAt, scheduledForAt: job.scheduledForAt }
    : null
}

function cloudReviewDataDeleteJobHistoryEntryFromJob(job: MobileCloudDataDeleteJob): MobileCloudReviewDataDeleteJobHistoryEntry {
  return {
    jobId: job.jobId,
    status: job.status,
    requestedAt: job.requestedAt,
    scheduledForAt: job.scheduledForAt,
    completedAt: job.completedAt,
  }
}

function upsertCloudReviewDataDeleteJobHistory(
  history: MobileCloudReviewDataDeleteJobHistoryEntry[],
  job: MobileCloudDataDeleteJob,
): MobileCloudReviewDataDeleteJobHistoryEntry[] {
  const next = [
    cloudReviewDataDeleteJobHistoryEntryFromJob(job),
    ...history.filter((entry) => entry.jobId !== job.jobId),
  ]
  return next.slice(0, MOBILE_CLOUD_REVIEW_DELETE_HISTORY_LIMIT)
}

function clearLocalMobileReviewDataAfterCloudDelete(state: MobileAppState): MobileAppState {
  return {
    ...state,
    reviewSnapshot: DEFAULT_MOBILE_APP_STATE.reviewSnapshot,
    sampleDeck: true,
    hiddenSourceIds: [],
    privateSourceIds: [],
    privateSourceItemIds: [],
    removedSourceIds: [],
    lastRemovedSource: null,
    offlineQueue: EMPTY_OFFLINE_REVIEW_QUEUE,
    cloudVocabulary: { entries: [], reviewSchedules: [] },
    weeklyDigest: null,
    syncCursors: { vocabulary: null, review_schedule: null },
    syncStatus: "ready",
    lastSyncedAt: null,
  }
}

export function applyMobileCloudDataDeleteJob(state: MobileAppState, job: MobileCloudDataDeleteJob): MobileAppState {
  if (!isAcceptedCloudReviewDataDeleteJob(job)) {
    throw new Error("Astra cloud learning data delete job was not accepted.")
  }
  const pendingJob = pendingCloudReviewDataDeleteJobFromJob(job)
  const cleared = clearLocalMobileReviewDataAfterCloudDelete(state)
  return {
    ...cleared,
    pendingCloudReviewDataDeleteJob: pendingJob,
    cloudReviewDataDeleteJobHistory: upsertCloudReviewDataDeleteJobHistory(state.cloudReviewDataDeleteJobHistory, job),
    message: pendingJob
      ? `Saved learning data deletion requested. Reference ${job.jobId}.`
      : `Saved learning data deletion completed. Reference ${job.jobId}.`,
  }
}

export function applyMobileCloudDataDeleteStatus(state: MobileAppState, job: MobileCloudDataDeleteJob): MobileAppState {
  const collections = new Set(job.scope.collections)
  if (!collections.has("vocabulary") || !collections.has("review_schedule")) {
    throw new Error("Astra cloud learning data delete job scope changed.")
  }
  const pendingJob = pendingCloudReviewDataDeleteJobFromJob(job)
  if (pendingJob) {
    return {
      ...state,
      pendingCloudReviewDataDeleteJob: pendingJob,
      cloudReviewDataDeleteJobHistory: upsertCloudReviewDataDeleteJobHistory(state.cloudReviewDataDeleteJobHistory, job),
      syncStatus: "ready",
      message: `Saved learning data deletion is ${job.status}. Reference ${job.jobId}.`,
    }
  }
  if (job.status === "completed") {
    const cleared = clearLocalMobileReviewDataAfterCloudDelete(state)
    return {
      ...cleared,
      pendingCloudReviewDataDeleteJob: null,
      cloudReviewDataDeleteJobHistory: upsertCloudReviewDataDeleteJobHistory(state.cloudReviewDataDeleteJobHistory, job),
      message: `Saved learning data deletion completed. Reference ${job.jobId}.`,
    }
  }
  return {
    ...state,
    pendingCloudReviewDataDeleteJob: null,
    cloudReviewDataDeleteJobHistory: upsertCloudReviewDataDeleteJobHistory(state.cloudReviewDataDeleteJobHistory, job),
    syncStatus: "error",
    message: `Saved learning data deletion did not finish. Reference ${job.jobId}.`,
  }
}

export async function requestMobileCloudReviewDataDelete(params: {
  state: MobileAppState
  client: MobileAstraClient
  device: MobileDeviceIdentity
  storage: MobileKeyValueStorage
  secureStorage?: MobileKeyValueStorage
  idempotencyKey: string
}): Promise<MobileAppState> {
  if (!params.state.session) {
    return {
      ...params.state,
      message: "Sign in before deleting saved learning data.",
    }
  }

  const job = await params.client.requestCloudDataDelete({
    session: params.state.session,
    device: params.device,
    collections: MOBILE_CLOUD_REVIEW_DELETE_COLLECTIONS,
    idempotencyKey: params.idempotencyKey,
  })
  const next = applyMobileCloudDataDeleteJob(params.state, job)
  await saveMobileAppState(params.storage, next, params.secureStorage)
  return next
}

export async function refreshMobileCloudReviewDataDeleteJob(params: {
  state: MobileAppState
  client: MobileAstraClient
  device: MobileDeviceIdentity
}): Promise<MobileAppState> {
  if (!params.state.session || !params.state.pendingCloudReviewDataDeleteJob) return params.state
  try {
    const job = await params.client.fetchCloudDataDeleteJob({
      session: params.state.session,
      device: params.device,
      jobId: params.state.pendingCloudReviewDataDeleteJob.jobId,
    })
    return applyMobileCloudDataDeleteStatus(params.state, job)
  } catch {
    return {
      ...params.state,
      syncStatus: "offline",
      message: "Saved learning data deletion is pending. Astra will check again later.",
    }
  }
}

export function applyCloudVocabularyToMobileState(
  state: MobileAppState,
  input: MobileCloudVocabularySnapshotInput,
  syncedAt = new Date(),
): MobileAppState {
  const baseSnapshot = buildMobileReviewSnapshotFromCloudVocabulary(input)
  const privateSourceIds = resolvePrivateSourceIdsForSnapshot(baseSnapshot, state.privateSourceIds, state.privateSourceItemIds)
  return {
    ...state,
    cloudVocabulary: input,
    privateSourceIds,
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot(baseSnapshot, state.hiddenSourceIds, state.removedSourceIds, state.dismissedReviewCardIds, privateSourceIds, state.privateSourceItemIds),
    sampleDeck: false,
    syncStatus: "ready",
    lastSyncedAt: syncedAt.toISOString(),
    message: "Your saved cards are ready for review.",
  }
}

function mergeSyncCursors(
  current: Partial<Record<MobileSyncCollection, string | null>>,
  next: Partial<Record<MobileSyncCollection, string | null>> | undefined,
): Partial<Record<MobileSyncCollection, string | null>> {
  return {
    ...current,
    ...(Object.prototype.hasOwnProperty.call(next ?? {}, "vocabulary") ? { vocabulary: next?.vocabulary ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(next ?? {}, "review_schedule") ? { review_schedule: next?.review_schedule ?? null } : {}),
  }
}

function numberFromPayload(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function stringFromPayload(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function vocabularyEntryFromDelta(delta: MobileSyncMutationRecord): MobileSyncedVocabularyEntry | null {
  if (delta.operation === "delete") return null
  const payload = delta.payload
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  const text = stringFromPayload(record.text)
  if (!text) return null
  const savedAtFallback = Date.parse(delta.clientUpdatedAt || delta.serverUpdatedAt || "") || Date.now()
  const sourceContext = typeof record.sourceContext === "object" && record.sourceContext !== null
    ? record.sourceContext as MobileSyncedVocabularyEntry["sourceContext"]
    : undefined
  return {
    id: stringFromPayload(record.id) ?? delta.recordId,
    text,
    translation: stringFromPayload(record.translation),
    explanation: stringFromPayload(record.explanation),
    context: stringFromPayload(record.context),
    url: stringFromPayload(record.url),
    hostname: stringFromPayload(record.hostname),
    savedAt: numberFromPayload(record.savedAt, savedAtFallback),
    sourceContext,
  }
}

function reviewScheduleFromDelta(delta: MobileSyncMutationRecord): MobileSyncedReviewScheduleRecord | null {
  if (delta.operation === "delete") return null
  const payload = delta.payload
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  const vocabularyEntryId = stringFromPayload(record.vocabularyEntryId) ?? delta.recordId
  const reviewedAt = typeof record.lastReviewedAt === "number" ? record.lastReviewedAt : null
  return {
    vocabularyEntryId,
    nextReviewAt: numberFromPayload(record.nextReviewAt, Date.parse(delta.clientUpdatedAt || delta.serverUpdatedAt || "") || Date.now()),
    srsBox: numberFromPayload(record.srsBox, 1),
    reviewCount: numberFromPayload(record.reviewCount, 0),
    lastReviewedAt: reviewedAt,
  }
}

export function buildMobileReviewPullCursors(state: MobileAppState): Partial<Record<MobileSyncCollection, string | null>> {
  return {
    vocabulary: state.syncCursors.vocabulary ?? null,
    review_schedule: state.syncCursors.review_schedule ?? null,
  }
}

export function applyMobileSyncPullResult(state: MobileAppState, response: MobileSyncPullResponse, syncedAt = new Date()): MobileAppState {
  const entriesById = new Map(state.cloudVocabulary.entries.map((entry) => [entry.id, entry]))
  const schedulesById = new Map(state.cloudVocabulary.reviewSchedules?.map((schedule) => [schedule.vocabularyEntryId, schedule]) ?? [])

  for (const delta of response.deltas.vocabulary ?? []) {
    if (delta.operation === "delete") {
      entriesById.delete(delta.recordId)
      continue
    }
    const entry = vocabularyEntryFromDelta(delta)
    if (entry) entriesById.set(entry.id, entry)
  }

  for (const delta of response.deltas.review_schedule ?? []) {
    if (delta.operation === "delete") {
      schedulesById.delete(delta.recordId)
      continue
    }
    const schedule = reviewScheduleFromDelta(delta)
    if (schedule) schedulesById.set(schedule.vocabularyEntryId, schedule)
  }

  const cloudVocabulary = {
    entries: Array.from(entriesById.values()),
    reviewSchedules: Array.from(schedulesById.values()),
  }
  const baseSnapshot = buildMobileReviewSnapshotFromCloudVocabulary(cloudVocabulary)
  const privateSourceIds = resolvePrivateSourceIdsForSnapshot(baseSnapshot, state.privateSourceIds, state.privateSourceItemIds)

  return {
    ...state,
    cloudVocabulary,
    syncCursors: mergeSyncCursors(state.syncCursors, response.nextCursors),
    privateSourceIds,
    reviewSnapshot: applyLocalSourcePreferencesToSnapshot(baseSnapshot, state.hiddenSourceIds, state.removedSourceIds, state.dismissedReviewCardIds, privateSourceIds, state.privateSourceItemIds),
    weeklyDigest: null,
    sampleDeck: false,
    syncStatus: "ready",
    lastSyncedAt: syncedAt.toISOString(),
    message: cloudVocabulary.entries.length > 0 ? "Your saved cards are ready for review." : "Signed in. Save words on web to review them here.",
  }
}

export async function refreshMobileReviewData(params: {
  state: MobileAppState
  client: MobileAstraClient
  device: MobileDeviceIdentity
  syncedAt?: Date
}): Promise<MobileAppState> {
  let state = params.state
  if (!state.session) {
    return {
      ...state,
      syncStatus: "offline",
      message: "Sign in to bring your saved cards to this phone.",
    }
  }
  if (state.pendingCloudReviewDataDeleteJob) {
    const deleteStatusState = await refreshMobileCloudReviewDataDeleteJob({ ...params, state })
    if (deleteStatusState.pendingCloudReviewDataDeleteJob) {
      return {
        ...deleteStatusState,
        syncStatus: deleteStatusState.syncStatus === "offline" ? "offline" : "ready",
        message: deleteStatusState.message || "Saved learning data deletion is pending. Sample cards stay available meanwhile.",
      }
    }
    if (deleteStatusState.syncStatus === "error") return deleteStatusState
    state = deleteStatusState
  }
  if (!state.session) return state
  try {
    const response = await params.client.pullSyncDeltas({
      session: state.session,
      device: params.device,
      cursors: buildMobileReviewPullCursors(state),
    })
    let next = applyMobileSyncPullResult(state, response, params.syncedAt)
    if (typeof params.client.fetchWeeklyDigest === "function") {
      try {
        next = {
          ...next,
          weeklyDigest: await params.client.fetchWeeklyDigest({
            session: state.session,
            device: params.device,
            now: params.syncedAt,
          }),
        }
      } catch {
        // Keep locally computed digest available when archive fetch is unavailable.
      }
    }
    return next
  } catch {
    return {
      ...state,
      syncStatus: "offline",
      message: "Saved cards will refresh when Astra can connect.",
    }
  }
}

export async function applySignedInMobileSession(params: {
  state: MobileAppState
  storage: MobileKeyValueStorage
  secureStorage?: MobileKeyValueStorage
  session: MobileAstraSession
}): Promise<MobileAppState> {
  const next: MobileAppState = {
    ...params.state,
    session: params.session,
    reviewSnapshot: EMPTY_MOBILE_REVIEW_SNAPSHOT,
    sampleDeck: false,
    offlineQueue: EMPTY_OFFLINE_REVIEW_QUEUE,
    cloudVocabulary: { entries: [], reviewSchedules: [] },
    weeklyDigest: null,
    syncCursors: { vocabulary: null, review_schedule: null },
    syncStatus: "ready",
    message: "Signed in. Astra will bring in your saved cards.",
  }
  await saveMobileAppState(params.storage, next, params.secureStorage)
  return next
}

export async function signInMobileAppState(params: {
  state: MobileAppState
  client: MobileAstraClient
  storage: MobileKeyValueStorage
  secureStorage?: MobileKeyValueStorage
  device: MobileDeviceIdentity
  email: string
  password: string
  idempotencyKey: string
}): Promise<MobileAppState> {
  const session = await params.client.signIn({
    email: params.email,
    password: params.password,
    device: params.device,
    idempotencyKey: params.idempotencyKey,
  })
  return applySignedInMobileSession({
    state: params.state,
    storage: params.storage,
    secureStorage: params.secureStorage,
    session,
  })
}

export function recordMobileReviewRating(params: {
  state: MobileAppState
  cardId: string
  rating: ReviewRating
  device: MobileDeviceIdentity
  now?: Date
}): MobileAppState {
  if (params.state.sampleDeck) {
    return {
      ...params.state,
      message: "Sample review saved on this device only.",
    }
  }
  const card = params.state.reviewSnapshot.reviewCards.find((reviewCard) => reviewCard.cardId === params.cardId)
  const event = createReviewEvent({
    cardId: params.cardId,
    rating: params.rating,
    deviceId: params.device.deviceId,
    appVersion: params.device.appVersion,
    offline: true,
    reviewedAt: params.now,
  })
  return {
    ...params.state,
    offlineQueue: enqueueReviewEvent(params.state.offlineQueue, event, params.now, card),
    message: "Review saved on this device. It will sync later.",
  }
}

export function buildPendingMobileReviewMutations(state: MobileAppState, device: MobileDeviceIdentity) {
  const cardById = new Map(state.reviewSnapshot.reviewCards.map((card) => [card.cardId, card]))
  return getFlushableReviewOperations(state.offlineQueue)
    .map((operation) => {
      const card = cardById.get(operation.event.cardId) ?? operation.card
      if (!card) return null
      return {
        operation,
        mutation: buildLegacyReviewScheduleMutation({
          operation,
          card,
          deviceId: device.deviceId,
        }),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export function markMobileReviewMutationsSyncing(state: MobileAppState, operationIds: string[]): MobileAppState {
  return {
    ...state,
    offlineQueue: markOperationsSyncing(state.offlineQueue, operationIds),
    syncStatus: "loading",
  }
}

export function applyMobileReviewPushResult(state: MobileAppState, response: MobileSyncPushResponse, syncedAt = new Date()): MobileAppState {
  let queue = state.offlineQueue
  const acknowledgedOperationIds = new Set<string>()
  for (const accepted of response.accepted) {
    acknowledgedOperationIds.add(accepted.clientMutationId)
    queue = markOperationSynced(queue, accepted.clientMutationId)
  }
  for (const rejected of response.rejected) {
    acknowledgedOperationIds.add(rejected.clientMutationId)
    queue = markOperationRejected(queue, rejected.clientMutationId, rejected.message)
  }
  for (const operation of queue.operations) {
    if (operation.status === "syncing" && !acknowledgedOperationIds.has(operation.operationId)) {
      queue = markOperationRejected(queue, operation.operationId, "Sync response did not confirm this review action.")
    }
  }
  const hasErrors = queue.operations.some((operation) => operation.status === "rejected")
  return {
    ...state,
    offlineQueue: compactSyncedReviewOperations(queue),
    syncCursors: mergeSyncCursors(state.syncCursors, response.nextCursors),
    syncStatus: hasErrors ? "error" : "ready",
    lastSyncedAt: response.accepted.length > 0 ? syncedAt.toISOString() : state.lastSyncedAt,
    message: hasErrors ? "Some review actions need another sync attempt." : "Review progress synced.",
  }
}

export async function syncPendingMobileReviewEvents(params: {
  state: MobileAppState
  client: MobileAstraClient
  device: MobileDeviceIdentity
  syncedAt?: Date
}): Promise<MobileAppState> {
  if (!params.state.session) {
    return {
      ...params.state,
      syncStatus: "offline",
      message: "Sign in to sync review progress across devices.",
    }
  }

  const flushableOperations = getFlushableReviewOperations(params.state.offlineQueue)
  const pending = buildPendingMobileReviewMutations(params.state, params.device)
  if (pending.length === 0) {
    if (flushableOperations.length > 0) {
      let queue = params.state.offlineQueue
      for (const operation of flushableOperations) {
        queue = markOperationRejected(queue, operation.operationId, "Review card details are no longer available on this device.")
      }
      return {
        ...params.state,
        offlineQueue: queue,
        syncStatus: "error",
        message: "Some review actions need another sync attempt.",
      }
    }
    return {
      ...params.state,
      syncStatus: "ready",
      message: "Review progress is up to date.",
    }
  }

  const syncing = markMobileReviewMutationsSyncing(params.state, pending.map((item) => item.operation.operationId))
  try {
    const response = await params.client.pushSyncMutations({
      session: params.state.session,
      device: params.device,
      mutations: pending.map((item) => item.mutation),
    })
    return applyMobileReviewPushResult(syncing, response, params.syncedAt)
  } catch {
    let retryableQueue = syncing.offlineQueue
    for (const item of pending) {
      retryableQueue = markOperationRejected(retryableQueue, item.operation.operationId, "Could not sync. Will retry when you try again.")
    }
    return {
      ...syncing,
      offlineQueue: retryableQueue,
      syncStatus: "offline",
      message: "Review progress is saved on this device and will sync later.",
    }
  }
}
