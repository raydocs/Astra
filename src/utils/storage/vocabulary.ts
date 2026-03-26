/**
 * Vocabulary storage for saved words and phrases.
 * Phase 2 learning loop seed — stores entries from SelectionToolbar.
 */

import { browser } from "#imports"
import { z } from "zod"

const VocabularyEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  translation: z.string().optional(),
  explanation: z.string().optional(),
  context: z.string().optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  savedAt: z.number(),
})

export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>

export const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const MAX_ENTRIES = 2000

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

  const newEntry: VocabularyEntry = {
    ...entry,
    id: existing >= 0 ? entries[existing].id : generateId(),
    savedAt: Date.now(),
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
  return readEntries()
}

export async function removeVocabularyEntry(id: string): Promise<void> {
  const entries = await readEntries()
  await writeEntries(entries.filter((e) => e.id !== id))
}

export async function getVocabularyCount(): Promise<number> {
  const entries = await readEntries()
  return entries.length
}
