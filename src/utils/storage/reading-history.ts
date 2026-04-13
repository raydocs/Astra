import { browser } from "#imports"
import { z } from "zod"

export const ReadingHistoryEntrySchema = z.object({
  id: z.string(),
  url: z.string(),
  hostname: z.string(),
  title: z.string(),
  wordsTranslated: z.number(),
  visitedAt: z.number(),
})

export type ReadingHistoryEntry = z.infer<typeof ReadingHistoryEntrySchema>
export const SyncedReadingHistoryEntrySchema = ReadingHistoryEntrySchema
export type SyncedReadingHistoryEntry = z.infer<typeof SyncedReadingHistoryEntrySchema>

export interface ReadingHistorySyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown
}

export const READING_HISTORY_STORAGE_KEY = "astra.reading_history.v1"
export const MAX_READING_HISTORY_ENTRIES = 200

export function sanitizeReadingHistoryUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  if (!trimmed) return undefined

  try {
    const parsed = new URL(trimmed)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return trimmed
  }
}

export function buildReadingHistoryRecordId(url: string): string {
  const sanitizedUrl = sanitizeReadingHistoryUrl(url)
  if (!sanitizedUrl) {
    throw new Error("Reading history URL is required.")
  }
  return sanitizedUrl
}

function normalizeReadingHistoryEntry(entry: ReadingHistoryEntry): ReadingHistoryEntry {
  const recordId = buildReadingHistoryRecordId(entry.url)
  return ReadingHistoryEntrySchema.parse({
    ...entry,
    id: recordId,
    url: recordId,
  })
}

function normalizeReadingHistoryEntries(entries: ReadingHistoryEntry[]): ReadingHistoryEntry[] {
  const byRecordId = new Map<string, ReadingHistoryEntry>()

  for (const entry of entries) {
    const normalized = normalizeReadingHistoryEntry(entry)
    const existing = byRecordId.get(normalized.id)
    if (!existing || normalized.visitedAt >= existing.visitedAt) {
      byRecordId.set(normalized.id, normalized)
    }
  }

  return [...byRecordId.values()]
    .sort((left, right) => right.visitedAt - left.visitedAt)
    .slice(0, MAX_READING_HISTORY_ENTRIES)
}

function parseStoredHistory(raw: unknown): ReadingHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: ReadingHistoryEntry[] = []
  for (const item of raw) {
    const parsed = ReadingHistoryEntrySchema.safeParse(item)
    if (parsed.success) {
      entries.push(normalizeReadingHistoryEntry(parsed.data))
    }
  }
  return normalizeReadingHistoryEntries(entries)
}

async function writeReadingHistory(entries: ReadingHistoryEntry[]): Promise<void> {
  await browser.storage.local.set({
    [READING_HISTORY_STORAGE_KEY]: normalizeReadingHistoryEntries(entries),
  })
}

export async function recordPageTranslation(
  entry: Omit<ReadingHistoryEntry, "id">,
): Promise<void> {
  const history = await getReadingHistory()
  const newEntry = normalizeReadingHistoryEntry({
    id: buildReadingHistoryRecordId(entry.url),
    ...entry,
  })

  await writeReadingHistory([
    newEntry,
    ...history.filter((existingEntry) => existingEntry.id !== newEntry.id),
  ])
}

export function buildReadingHistorySyncRecordMap(
  entries: ReadingHistoryEntry[],
): Record<string, SyncedReadingHistoryEntry> {
  return Object.fromEntries(
    normalizeReadingHistoryEntries(entries).map((entry) => [entry.id, entry]),
  )
}

export function applyReadingHistorySyncMutation(
  entries: ReadingHistoryEntry[],
  mutation: ReadingHistorySyncMutationLike,
): ReadingHistoryEntry[] {
  const currentEntries = normalizeReadingHistoryEntries(entries)

  if (mutation.operation === "delete") {
    return currentEntries.filter((entry) => entry.id !== mutation.recordId)
  }

  const syncedEntry = normalizeReadingHistoryEntry(
    SyncedReadingHistoryEntrySchema.parse(mutation.payload),
  )
  if (syncedEntry.id !== mutation.recordId) {
    throw new Error("Reading history sync recordId must match the sanitized URL.")
  }

  const existing = currentEntries.find((entry) => entry.id === mutation.recordId) ?? null
  const nextEntry = !existing || syncedEntry.visitedAt >= existing.visitedAt
    ? syncedEntry
    : existing

  return normalizeReadingHistoryEntries([
    nextEntry,
    ...currentEntries.filter((entry) => entry.id !== mutation.recordId),
  ])
}

export function applyReadingHistorySyncMutations(
  entries: ReadingHistoryEntry[],
  mutations: ReadingHistorySyncMutationLike[],
): ReadingHistoryEntry[] {
  return mutations.reduce(
    (currentEntries, mutation) => applyReadingHistorySyncMutation(currentEntries, mutation),
    normalizeReadingHistoryEntries(entries),
  )
}

export async function replaceReadingHistory(entries: ReadingHistoryEntry[]): Promise<void> {
  await writeReadingHistory(entries)
}

export async function deleteReadingHistoryEntry(url: string): Promise<void> {
  const recordId = buildReadingHistoryRecordId(url)
  const history = await getReadingHistory()
  await writeReadingHistory(history.filter((entry) => entry.id !== recordId))
}

export async function getReadingHistoryEntry(url: string): Promise<ReadingHistoryEntry | null> {
  const recordId = buildReadingHistoryRecordId(url)
  const history = await getReadingHistory()
  return history.find((entry) => entry.id === recordId) ?? null
}

export async function readSyncSafeReadingHistory(): Promise<SyncedReadingHistoryEntry[]> {
  return getReadingHistory()
}

export async function getReadingHistory(): Promise<ReadingHistoryEntry[]> {
  const stored = await browser.storage.local.get(READING_HISTORY_STORAGE_KEY)
  return parseStoredHistory(stored[READING_HISTORY_STORAGE_KEY])
}

export async function clearReadingHistory(): Promise<void> {
  await browser.storage.local.set({
    [READING_HISTORY_STORAGE_KEY]: [],
  })
}
