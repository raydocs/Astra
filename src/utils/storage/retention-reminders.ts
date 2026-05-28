import { browser } from "#imports"

export const RETENTION_REMINDER_POLICY_STORAGE_KEY = "astra.retention_reminder_policy.v1"

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_VISIBLE_ITEMS = 3

export type RetentionReminderId = "today_review" | "continue_reading" | "weekly_digest"

export interface RetentionReminderPolicy {
  enabled: boolean
  pausedUntil: number | null
  maxVisibleItems: number
  updatedAt: number
}

export interface RetentionReminderSignals {
  dueReviewCount: number
  continueReadingCount: number
  weeklyDigestReady: boolean
  now?: number
}

export interface RetentionReminderItem {
  id: RetentionReminderId
  label: string
  detail: string
  count: number
}

export interface RetentionReminderStatus {
  enabled: boolean
  paused: boolean
  pausedUntil: number | null
  summary: string
  items: RetentionReminderItem[]
  suppressedReason: "disabled" | "paused" | null
}

export const DEFAULT_RETENTION_REMINDER_POLICY: RetentionReminderPolicy = {
  enabled: true,
  pausedUntil: null,
  maxVisibleItems: DEFAULT_MAX_VISIBLE_ITEMS,
  updatedAt: 0,
}

function normalizePolicy(raw: unknown, now = Date.now()): RetentionReminderPolicy {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RETENTION_REMINDER_POLICY }
  const candidate = raw as Partial<RetentionReminderPolicy>
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
    pausedUntil: typeof candidate.pausedUntil === "number" && Number.isFinite(candidate.pausedUntil)
      ? candidate.pausedUntil
      : null,
    maxVisibleItems: typeof candidate.maxVisibleItems === "number" && Number.isFinite(candidate.maxVisibleItems)
      ? Math.max(1, Math.min(DEFAULT_MAX_VISIBLE_ITEMS, Math.floor(candidate.maxVisibleItems)))
      : DEFAULT_MAX_VISIBLE_ITEMS,
    updatedAt: typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : now,
  }
}

export async function readRetentionReminderPolicy(): Promise<RetentionReminderPolicy> {
  const stored = await browser.storage.local.get(RETENTION_REMINDER_POLICY_STORAGE_KEY)
  return normalizePolicy(stored[RETENTION_REMINDER_POLICY_STORAGE_KEY])
}

export async function saveRetentionReminderPolicy(
  patch: Partial<Omit<RetentionReminderPolicy, "updatedAt">>,
  options: { now?: number } = {},
): Promise<RetentionReminderPolicy> {
  const now = options.now ?? Date.now()
  const current = await readRetentionReminderPolicy()
  const next = normalizePolicy({
    ...current,
    ...patch,
    updatedAt: now,
  }, now)
  await browser.storage.local.set({ [RETENTION_REMINDER_POLICY_STORAGE_KEY]: next })
  return next
}

export async function disableRetentionReminders(options: { now?: number } = {}): Promise<RetentionReminderPolicy> {
  return saveRetentionReminderPolicy({ enabled: false, pausedUntil: null }, options)
}

export async function enableRetentionReminders(options: { now?: number } = {}): Promise<RetentionReminderPolicy> {
  return saveRetentionReminderPolicy({ enabled: true, pausedUntil: null }, options)
}

export async function pauseRetentionRemindersForDays(days: number, options: { now?: number } = {}): Promise<RetentionReminderPolicy> {
  const now = options.now ?? Date.now()
  const safeDays = Math.max(1, Math.floor(days))
  return saveRetentionReminderPolicy({ enabled: true, pausedUntil: now + safeDays * DAY_MS }, { now })
}

export function deriveRetentionReminderStatus(
  policy: RetentionReminderPolicy,
  signals: RetentionReminderSignals,
): RetentionReminderStatus {
  const now = signals.now ?? Date.now()
  const normalized = normalizePolicy(policy, now)
  const paused = normalized.enabled && normalized.pausedUntil !== null && normalized.pausedUntil > now

  if (!normalized.enabled || paused) {
    return {
      enabled: normalized.enabled,
      paused,
      pausedUntil: normalized.pausedUntil,
      summary: normalized.enabled ? "Reminders are paused." : "Reminders are off.",
      items: [],
      suppressedReason: normalized.enabled ? "paused" : "disabled",
    }
  }

  const items: RetentionReminderItem[] = []
  if (signals.dueReviewCount > 0) {
    items.push({
      id: "today_review",
      label: "Today Review",
      detail: `${signals.dueReviewCount} saved item${signals.dueReviewCount === 1 ? "" : "s"} ready when you are.`,
      count: signals.dueReviewCount,
    })
  }
  if (signals.continueReadingCount > 0) {
    items.push({
      id: "continue_reading",
      label: "Continue Reading",
      detail: `${signals.continueReadingCount} reading item${signals.continueReadingCount === 1 ? "" : "s"} waiting in your library.`,
      count: signals.continueReadingCount,
    })
  }
  if (signals.weeklyDigestReady) {
    items.push({
      id: "weekly_digest",
      label: "Weekly Digest",
      detail: "A local activity summary is ready to review.",
      count: 1,
    })
  }

  const cappedItems = items.slice(0, normalized.maxVisibleItems)
  return {
    enabled: true,
    paused: false,
    pausedUntil: normalized.pausedUntil,
    summary: cappedItems.length > 0
      ? `${cappedItems.length} calm reminder${cappedItems.length === 1 ? "" : "s"} ready.`
      : "Nothing needs attention right now.",
    items: cappedItems,
    suppressedReason: null,
  }
}
