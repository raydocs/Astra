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
  normalizeVocabularySourceContext,
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
    sourceContext: mergeVocabularySourceContext(existingEntry?.sourceContext, entry.sourceContext, {
      url: entry.url,
      hostname: entry.hostname,
    }),
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
      const synced = buildSyncSafeVocabularyEntry(entry)
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

export async function hasVocabularyEntryByText(text: string): Promise<boolean> {
  const normalizedText = text.trim().toLowerCase()
  if (!normalizedText) return false

  const entries = await readEntries()
  return entries.some((entry) => entry.text.trim().toLowerCase() === normalizedText)
}

/** Update a single vocabulary entry by id with a partial patch. */
export async function updateVocabularyEntry(
  id: string,
  patch: Partial<VocabularyEntry>,
): Promise<VocabularyEntry | null> {
  const entries = await readEntries()
  const index = entries.findIndex((e) => e.id === id)
  if (index < 0) return null

  const updated: VocabularyEntry = {
    ...entries[index],
    ...patch,
    sourceContext: patch.sourceContext
      ? mergeVocabularySourceContext(entries[index].sourceContext, patch.sourceContext, {
          url: patch.url ?? entries[index].url,
          hostname: patch.hostname ?? entries[index].hostname,
        })
      : normalizeVocabularySourceContext(entries[index].sourceContext, {
          url: patch.url ?? entries[index].url,
          hostname: patch.hostname ?? entries[index].hostname,
        }),
    id: entries[index].id,
  }
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
const GLOSSARY_LINE_SEPARATOR = " => "

function normalizeGlossaryValue(value?: string | null): string {
  return value?.trim() ?? ""
}

function escapeGlossaryValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/=>/g, "\\=>")
}

function resolveGlossaryTarget(entry: VocabularyEntry): string {
  return normalizeGlossaryValue(entry.glossaryTargetText || entry.translation || "")
}

/**
 * Get glossary entries for request-time translation use.
 * Returns hostname-scoped entries first when hostname is available, then global,
 * deduped by normalized source text.
 */
export async function listGlossaryEntriesForHostname(
  hostname?: string | null,
  options: { limit?: number } = {},
): Promise<VocabularyEntry[]> {
  const entries = await getVocabularyEntries()
  const limit = options.limit ?? MAX_GLOSSARY_ENTRIES
  const normalizedHostname = hostname?.trim()

  const glossaryEntries = entries
    .filter((e) => e.glossaryEnabled === true && resolveGlossaryTarget(e))

  // Sort: hostname-scoped first when hostname is known, then global; newest first within each scope
  const hostnameEntries = normalizedHostname
    ? glossaryEntries
      .filter((e) => e.glossaryScope === "hostname" && e.hostname === normalizedHostname)
      .sort((a, b) => b.savedAt - a.savedAt)
    : []
  const globalEntries = glossaryEntries
    .filter((e) => e.glossaryScope === "global")
    .sort((a, b) => b.savedAt - a.savedAt)

  // Deduplicate by normalized source text (hostname-scoped wins)
  const seen = new Set<string>()
  const result: VocabularyEntry[] = []
  let charCount = 0

  for (const entry of [...hostnameEntries, ...globalEntries]) {
    const source = normalizeGlossaryValue(entry.text)
    const normalizedText = source.toLowerCase()
    if (!source || !resolveGlossaryTarget(entry) || seen.has(normalizedText)) continue
    seen.add(normalizedText)

    const target = resolveGlossaryTarget(entry)
    const lineChars = source.length + target.length + GLOSSARY_LINE_SEPARATOR.length
    if (charCount + lineChars > MAX_GLOSSARY_CHARS) break
    if (result.length >= limit) break

    charCount += lineChars
    result.push(entry)
  }

  return result
}

/**
 * Serialize glossary entries into the canonical terminologyGlossary format.
 * Output: "source => target" per line, deterministic, with embedded newlines and
 * separator-like content escaped so each glossary entry remains one physical line.
 */
export function serializeGlossary(entries: VocabularyEntry[]): string {
  return entries
    .map((entry) => {
      const source = escapeGlossaryValue(normalizeGlossaryValue(entry.text))
      const target = escapeGlossaryValue(resolveGlossaryTarget(entry))
      return source && target ? `${source}${GLOSSARY_LINE_SEPARATOR}${target}` : ""
    })
    .filter(Boolean)
    .join("\n")
}

/**
 * Build the canonical request-time glossary string from vocabulary-backed glossary entries.
 */
export async function buildTerminologyGlossary(
  hostname?: string | null,
  options: { limit?: number } = {},
): Promise<string | undefined> {
  const entries = await listGlossaryEntriesForHostname(hostname, options)
  const glossary = serializeGlossary(entries)
  return glossary || undefined
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
