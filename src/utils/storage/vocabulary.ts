import { browser } from "#imports"
import {
  createDefaultSrsFields,
  getDueCards as getDueCardsFromSrs,
} from "@/utils/srs/leitner"
import {
  SyncedVocabularyEntrySchema,
  VocabularyEntrySchema,
  applyVocabularySyncMutation,
  applyVocabularySyncMutations,
  buildSyncSafeVocabularyEntry,
  ensureSrsFields,
  mergeVocabularySourceContext,
  sanitizeVocabularyUrl,
  type SyncedVocabularyEntry,
  type VocabularyEntry,
  type VocabularySyncMutationLike,
} from "./vocabulary-core"

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

export async function replaceVocabularyEntries(entries: VocabularyEntry[]): Promise<void> {
  await writeEntries(entries.map(ensureSrsFields))
}

export async function saveVocabularyEntry(entry: Omit<VocabularyEntry, "id" | "savedAt">): Promise<VocabularyEntry> {
  const entries = await readEntries()

  const existing = entries.findIndex(
    (e) => e.text === entry.text && e.url === entry.url,
  )

  const now = Date.now()
  const srsDefaults = createDefaultSrsFields(now)
  const existingEntry = existing >= 0 ? entries[existing] : null

  const newEntry: VocabularyEntry = {
    ...entry,
    sourceContext: mergeVocabularySourceContext(existingEntry?.sourceContext, entry.sourceContext),
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

export async function readSyncSafeVocabularyEntries(): Promise<SyncedVocabularyEntry[]> {
  const entries = await getVocabularyEntries()
  return entries.map((entry) => buildSyncSafeVocabularyEntry(entry))
}

export function buildVocabularySyncRecordMap(
  entries: Array<VocabularyEntry | SyncedVocabularyEntry>,
): Record<string, SyncedVocabularyEntry> {
  return Object.fromEntries(
    entries.map((entry) => {
      const synced = buildSyncSafeVocabularyEntry(entry as VocabularyEntry)
      return [synced.id, synced]
    }),
  )
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

// ---------------------------------------------------------------------------
// Glossary helpers — enable vocabulary entries to be used as translation terms
// ---------------------------------------------------------------------------

/** Toggle glossary state for a vocabulary entry. */
export async function setGlossaryState(
  id: string,
  patch: { glossaryEnabled?: boolean; glossaryScope?: "hostname" | "global"; glossaryTargetText?: string },
): Promise<VocabularyEntry | null> {
  return updateVocabularyEntry(id, patch)
}

const MAX_GLOSSARY_ENTRIES = 20
const MAX_GLOSSARY_CHARS = 800

/**
 * Get glossary entries for a specific hostname.
 * Returns hostname-scoped entries first, then global, deduped by normalized source text.
 */
export async function listGlossaryEntriesForHostname(
  hostname: string,
  options: { limit?: number } = {},
): Promise<VocabularyEntry[]> {
  const entries = await getVocabularyEntries()
  const limit = options.limit ?? MAX_GLOSSARY_ENTRIES

  const glossaryEntries = entries
    .filter((e) => e.glossaryEnabled === true && (e.translation || e.glossaryTargetText))

  // Sort: hostname-scoped first, then global; newest first within each scope
  const hostnameEntries = glossaryEntries
    .filter((e) => e.glossaryScope === "hostname" && e.hostname === hostname)
    .sort((a, b) => b.savedAt - a.savedAt)
  const globalEntries = glossaryEntries
    .filter((e) => e.glossaryScope === "global")
    .sort((a, b) => b.savedAt - a.savedAt)

  // Deduplicate by normalized source text (hostname-scoped wins)
  const seen = new Set<string>()
  const result: VocabularyEntry[] = []
  let charCount = 0

  for (const entry of [...hostnameEntries, ...globalEntries]) {
    const normalizedText = entry.text.trim().toLowerCase()
    if (seen.has(normalizedText)) continue
    seen.add(normalizedText)

    const target = entry.glossaryTargetText || entry.translation || ""
    const lineChars = entry.text.length + target.length + 4 // " => " separator
    if (charCount + lineChars > MAX_GLOSSARY_CHARS) break
    if (result.length >= limit) break

    charCount += lineChars
    result.push(entry)
  }

  return result
}

/**
 * Serialize glossary entries into a format suitable for the terminologyGlossary field.
 * Output: "source => target" per line, deterministic.
 */
export function serializeGlossary(entries: VocabularyEntry[]): string {
  return entries
    .map((e) => `${e.text} => ${e.glossaryTargetText || e.translation || ""}`)
    .join("\n")
}

export {
  SyncedVocabularyEntrySchema,
  applyVocabularySyncMutation,
  applyVocabularySyncMutations,
  buildSyncSafeVocabularyEntry,
  ensureSrsFields,
  sanitizeVocabularyUrl,
}
export type {
  SyncedVocabularyEntry,
  VocabularyEntry,
  VocabularySyncMutationLike,
}
