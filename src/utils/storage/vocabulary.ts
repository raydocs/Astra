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
  isVocabularyEntryFromStudyUrl,
  mergeVocabularySourceContext,
  normalizeVocabularySourceContext,
  normalizeVocabularyStudyUrl,
  getVocabularyStudyUrlCandidates,
  sanitizeVocabularyUrl,
  type SyncedVocabularyEntry,
  type VocabularyEntry,
  type VocabularySyncMutationLike,
} from "./vocabulary-core"
import type { OwnedReadingThemePackPackagePayload } from "./owned-reading"

export const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const MAX_ENTRIES = 2000
const WEEKLY_VOCABULARY_ROI_DEFAULT_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export interface WeeklyVocabularyRoiWindow {
  startAt: number
  endAt: number
  days: number
}

export interface WeeklyVocabularyRoiOptions {
  now?: number
  days?: number
  windowStartAt?: number
  windowEndAt?: number
  masteryBox?: number
}

export interface WeeklyVocabularyRoiSummary {
  window: WeeklyVocabularyRoiWindow
  savedCount: number
  reviewedCount: number
  masteredCount: number
  reviewHitCount: number
  reviewAttemptCount: number
  reviewHitRate: number | null
}

export interface VocabularyThemePackImportResult {
  importedCount: number
  skippedCount: number
}

export interface VocabularyThemePackImportPreviewConflict {
  id: string
  text: string
  reason: "id" | "text-url"
}

export interface VocabularyThemePackImportPreview {
  totalCount: number
  importedCount: number
  skippedCount: number
  conflicts: VocabularyThemePackImportPreviewConflict[]
  rollback: {
    removeCount: number
  }
}

function deriveWeeklyVocabularyRoiWindow(options: WeeklyVocabularyRoiOptions = {}): WeeklyVocabularyRoiWindow {
  const endAt = options.windowEndAt ?? options.now ?? Date.now()
  const days = Math.max(1, Math.floor(options.days ?? WEEKLY_VOCABULARY_ROI_DEFAULT_DAYS))
  return {
    startAt: options.windowStartAt ?? (endAt - (days * DAY_MS)),
    endAt,
    days,
  }
}

function isTimestampInWeeklyVocabularyRoiWindow(value: number | null | undefined, window: WeeklyVocabularyRoiWindow): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= window.startAt && value <= window.endAt
}

function isVocabularyEntryMastered(entry: VocabularyEntry, masteryBox: number): boolean {
  return (entry.srsBox ?? 1) >= masteryBox
}

export function deriveWeeklyVocabularyRoi(
  entries: VocabularyEntry[],
  options: WeeklyVocabularyRoiOptions = {},
): WeeklyVocabularyRoiSummary {
  const window = deriveWeeklyVocabularyRoiWindow(options)
  const masteryBox = options.masteryBox ?? 4
  const savedThisWeek = entries.filter((entry) => isTimestampInWeeklyVocabularyRoiWindow(entry.savedAt, window))
  const reviewedThisWeek = entries.filter((entry) => isTimestampInWeeklyVocabularyRoiWindow(entry.lastReviewedAt, window))
  const masteredThisWeek = entries.filter((entry) => {
    if (!isVocabularyEntryMastered(entry, masteryBox)) return false
    return isTimestampInWeeklyVocabularyRoiWindow(entry.savedAt, window)
      || isTimestampInWeeklyVocabularyRoiWindow(entry.lastReviewedAt, window)
  })
  const reviewHitCount = reviewedThisWeek.filter((entry) => (entry.srsBox ?? 1) > 1).length
  const reviewAttemptCount = reviewedThisWeek.length

  return {
    window,
    savedCount: savedThisWeek.length,
    reviewedCount: reviewedThisWeek.length,
    masteredCount: masteredThisWeek.length,
    reviewHitCount,
    reviewAttemptCount,
    reviewHitRate: reviewAttemptCount > 0 ? Math.round((reviewHitCount / reviewAttemptCount) * 100) : null,
  }
}

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

function buildVocabularyImportKey(entry: Pick<VocabularyEntry, "text" | "url">): string {
  return `${entry.text.trim().toLowerCase()}\u0000${normalizeVocabularyStudyUrl(entry.url)}`
}

function extractVocabularyEntriesFromThemePackPayload(
  payload: OwnedReadingThemePackPackagePayload,
): VocabularyEntry[] {
  const ownedReadingAssetIds = new Set(
    payload.ownedReading.themePacks.flatMap((pack) => pack.assets.map((asset) => asset.id)),
  )
  return payload.vocabularyEntries
    .map((entry) => ensureSrsFields(VocabularyEntrySchema.parse(entry)))
    .filter((entry) => {
      const linkedItemId = entry.sourceContext?.ownedReadingItemId?.trim()
      return Boolean(linkedItemId && ownedReadingAssetIds.has(linkedItemId))
    })
}

function buildVocabularyThemePackImportPreview(
  entries: readonly VocabularyEntry[],
  incomingEntries: readonly VocabularyEntry[],
): VocabularyThemePackImportPreview {
  const existingIds = new Set(entries.map((entry) => entry.id))
  const existingKeys = new Set(entries.map((entry) => buildVocabularyImportKey(entry)))
  const conflicts: VocabularyThemePackImportPreviewConflict[] = []
  let importedCount = 0
  let skippedCount = 0

  for (const incoming of incomingEntries) {
    const key = buildVocabularyImportKey(incoming)
    if (existingIds.has(incoming.id)) {
      skippedCount += 1
      conflicts.push({ id: incoming.id, text: incoming.text, reason: "id" })
      continue
    }
    if (existingKeys.has(key)) {
      skippedCount += 1
      conflicts.push({ id: incoming.id, text: incoming.text, reason: "text-url" })
      continue
    }
    importedCount += 1
    existingIds.add(incoming.id)
    existingKeys.add(key)
  }

  return {
    totalCount: incomingEntries.length,
    importedCount,
    skippedCount,
    conflicts,
    rollback: {
      removeCount: importedCount,
    },
  }
}

export async function previewVocabularyEntriesFromThemePackPayload(
  payload: OwnedReadingThemePackPackagePayload,
): Promise<VocabularyThemePackImportPreview> {
  const incomingEntries = extractVocabularyEntriesFromThemePackPayload(payload)
  const entries = await readEntries()
  return buildVocabularyThemePackImportPreview(entries, incomingEntries)
}

export async function importVocabularyEntriesFromThemePackPayload(
  payload: OwnedReadingThemePackPackagePayload,
): Promise<VocabularyThemePackImportResult> {
  const incomingEntries = extractVocabularyEntriesFromThemePackPayload(payload)

  const entries = await readEntries()
  const existingIds = new Set(entries.map((entry) => entry.id))
  const existingKeys = new Set(entries.map((entry) => buildVocabularyImportKey(entry)))
  const additions: VocabularyEntry[] = []
  let skippedCount = 0

  for (const incoming of incomingEntries) {
    const key = buildVocabularyImportKey(incoming)
    if (existingIds.has(incoming.id) || existingKeys.has(key)) {
      skippedCount += 1
      continue
    }
    additions.push(incoming)
    existingIds.add(incoming.id)
    existingKeys.add(key)
  }

  if (additions.length > 0) {
    await writeEntries([...additions, ...entries])
  }

  return {
    importedCount: additions.length,
    skippedCount,
  }
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
  getVocabularyStudyUrlCandidates,
  isVocabularyEntryFromStudyUrl,
  normalizeVocabularyStudyUrl,
  sanitizeVocabularyUrl,
}
export type {
  SyncedVocabularyEntry,
  VocabularyEntry,
  VocabularySyncMutationLike,
}
