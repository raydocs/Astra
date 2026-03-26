import { browser } from "#imports"
import { z } from "zod"

const ReadingHistoryEntrySchema = z.object({
  id: z.string(),
  url: z.string(),
  hostname: z.string(),
  title: z.string(),
  wordsTranslated: z.number(),
  visitedAt: z.number(),
})

export type ReadingHistoryEntry = z.infer<typeof ReadingHistoryEntrySchema>

export const READING_HISTORY_STORAGE_KEY = "astra.reading_history.v1"
const MAX_ENTRIES = 200

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
}

function parseStoredHistory(raw: unknown): ReadingHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const entries: ReadingHistoryEntry[] = []
  for (const item of raw) {
    const parsed = ReadingHistoryEntrySchema.safeParse(item)
    if (parsed.success) {
      entries.push(parsed.data)
    }
  }
  return entries
}

export async function recordPageTranslation(
  entry: Omit<ReadingHistoryEntry, "id">,
): Promise<void> {
  const stored = await browser.storage.local.get(READING_HISTORY_STORAGE_KEY)
  const history = parseStoredHistory(stored[READING_HISTORY_STORAGE_KEY])

  // Deduplicate by URL — remove existing entry with the same URL
  const filtered = history.filter((e) => e.url !== entry.url)

  const cleanUrl = sanitizeUrl(entry.url)
  const newEntry: ReadingHistoryEntry = {
    id: `${cleanUrl}@${entry.visitedAt}`,
    ...entry,
    url: cleanUrl,
  }

  // Prepend (newest first), then cap at MAX_ENTRIES
  const updated = [newEntry, ...filtered].slice(0, MAX_ENTRIES)

  await browser.storage.local.set({
    [READING_HISTORY_STORAGE_KEY]: updated,
  })
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
