/**
 * Vocabulary storage for saved words and phrases.
 * Phase 2 learning loop seed — stores entries from SelectionToolbar.
 * Includes optional SRS (spaced repetition) fields for flashcard review.
 */

import { browser } from "#imports"
import { z } from "zod"
import { createDefaultSrsFields, getDueCards as getDueCardsFromSrs } from "@/utils/srs/leitner"

const VocabularyEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  translation: z.string().optional(),
  explanation: z.string().optional(),
  context: z.string().optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  savedAt: z.number(),
  // SRS fields (optional for backward compatibility with legacy entries)
  srsBox: z.number().optional(),
  nextReviewAt: z.number().optional(),
  reviewCount: z.number().optional(),
  lastReviewedAt: z.number().nullable().optional(),
})

export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>

export const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const MAX_ENTRIES = 2000

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Backfill SRS fields for legacy entries that lack them. */
export function ensureSrsFields(entry: VocabularyEntry): VocabularyEntry {
  if (entry.srsBox !== undefined && entry.nextReviewAt !== undefined) {
    return entry
  }
  const defaults = createDefaultSrsFields(entry.savedAt)
  return {
    ...entry,
    srsBox: entry.srsBox ?? defaults.srsBox,
    nextReviewAt: entry.nextReviewAt ?? defaults.nextReviewAt,
    reviewCount: entry.reviewCount ?? defaults.reviewCount,
    lastReviewedAt: entry.lastReviewedAt ?? defaults.lastReviewedAt,
  }
}

async function readEntries(): Promise<VocabularyEntry[]> {
  const result = await browser.storage.local.get(VOCABULARY_STORAGE_KEY)
  const raw = result[VOCABULARY_STORAGE_KEY]
  if (!Array.isArray(raw)) return []
  return raw.filter((item) => VocabularyEntrySchema.safeParse(item).success) as VocabularyEntry[]
}

async function writeEntries(entries: VocabularyEntry[]): Promise<void> {
  await browser.storage.local.set({
    [VOCABULARY_STORAGE_KEY]: entries.slice(0, MAX_ENTRIES),
  })
}

export async function saveVocabularyEntry(entry: Omit<VocabularyEntry, "id" | "savedAt">): Promise<VocabularyEntry> {
  const entries = await readEntries()

  const existing = entries.findIndex(
    (e) => e.text === entry.text && e.url === entry.url,
  )

  const now = Date.now()
  const srsDefaults = createDefaultSrsFields(now)

  const newEntry: VocabularyEntry = {
    ...entry,
    id: existing >= 0 ? entries[existing].id : generateId(),
    savedAt: now,
    srsBox: entry.srsBox ?? srsDefaults.srsBox,
    nextReviewAt: entry.nextReviewAt ?? srsDefaults.nextReviewAt,
    reviewCount: entry.reviewCount ?? srsDefaults.reviewCount,
    lastReviewedAt: entry.lastReviewedAt ?? srsDefaults.lastReviewedAt,
  }

  if (existing >= 0) {
    entries[existing] = newEntry
  } else {
    entries.unshift(newEntry)
  }

  await writeEntries(entries)
  return newEntry
}

export async function getVocabularyEntries(): Promise<VocabularyEntry[]> {
  const entries = await readEntries()
  return entries.map(ensureSrsFields)
}

export async function removeVocabularyEntry(id: string): Promise<void> {
  const entries = await readEntries()
  await writeEntries(entries.filter((e) => e.id !== id))
}

export async function getVocabularyCount(): Promise<number> {
  const entries = await readEntries()
  return entries.length
}

/** Update a single vocabulary entry by id with a partial patch. */
export async function updateVocabularyEntry(
  id: string,
  patch: Partial<VocabularyEntry>,
): Promise<VocabularyEntry | null> {
  const entries = await readEntries()
  const index = entries.findIndex((e) => e.id === id)
  if (index < 0) return null

  const updated: VocabularyEntry = { ...entries[index], ...patch, id: entries[index].id }
  entries[index] = updated
  await writeEntries(entries)
  return updated
}

/** Get count of vocabulary entries currently due for SRS review. */
export async function getDueVocabularyCount(now?: number): Promise<number> {
  const entries = await getVocabularyEntries()
  return getDueCardsFromSrs(entries, now).length
}
