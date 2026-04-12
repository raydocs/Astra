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
  payload?: unknown | null
}

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
