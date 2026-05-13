import { z } from "zod"

import { ExplainModeSchema, LanguageLevelSchema, type ExplainMode, type LanguageLevel } from "@/types/config"
import { createDefaultSrsFields } from "@/utils/srs/leitner"
import type { ReviewGrade } from "@/utils/srs/leitner"
import { buildSentenceHash } from "@/utils/sentence-anchor"

export const VocabularySourceContextSurfaceSchema = z.enum([
  "popup_deep_read",
  "selection_toolbar",
  "hover_translate",
  "subtitle_reader",
])

const VocabularyOwnedReadingSourceTypeSchema = z.enum(["article", "pdf", "epub", "subtitle-file"])
const VocabularyMatchedGlossaryTermSchema = z.object({
  sourceTerm: z.string().trim().min(1),
  preferredTerm: z.string().trim().min(1),
})

export const VocabularySourceContextSchema = z.object({
  surface: VocabularySourceContextSurfaceSchema,
  pageTitle: z.string().trim().min(1).optional(),
  pageUrl: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  contentSummary: z.string().trim().min(1).optional(),
  articleExcerpt: z.string().trim().min(1).optional(),
  sentenceText: z.string().trim().min(1).optional(),
  sentenceHash: z.string().trim().min(1).optional(),
  sentenceIndex: z.number().int().nonnegative().optional(),
  languageLevel: LanguageLevelSchema.optional(),
  explainMode: ExplainModeSchema.optional(),
  ownedReadingItemId: z.string().trim().min(1).optional(),
  ownedReadingSourceType: VocabularyOwnedReadingSourceTypeSchema.optional(),
  ownedReadingTitle: z.string().trim().min(1).optional(),
  studyProgressRecordId: z.string().trim().min(1).optional(),
  matchedGlossaryTerms: z.array(VocabularyMatchedGlossaryTermSchema).optional(),
})

export const VocabularyEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  translation: z.string().optional(),
  explanation: z.string().optional(),
  context: z.string().optional(),
  sourceContext: VocabularySourceContextSchema.optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  savedAt: z.number(),
  srsBox: z.number().optional(),
  nextReviewAt: z.number().optional(),
  reviewCount: z.number().optional(),
  lastReviewedAt: z.number().nullable().optional(),
  lastReviewGrade: z.enum(["again", "hard", "good", "easy"]).nullable().optional(),
  lastReviewGradeAt: z.number().nullable().optional(),
  note: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  glossaryEnabled: z.boolean().optional(),
  glossaryScope: z.enum(["hostname", "global"]).optional(),
  glossaryTargetText: z.string().optional(),
})

export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>
export type VocabularySourceContext = z.infer<typeof VocabularySourceContextSchema>

export const SyncedVocabularyEntrySchema = VocabularyEntrySchema.omit({
  srsBox: true,
  nextReviewAt: true,
  reviewCount: true,
  lastReviewedAt: true,
  lastReviewGrade: true,
  lastReviewGradeAt: true,
})

export type SyncedVocabularyEntry = z.infer<typeof SyncedVocabularyEntrySchema>

export const VocabularyReviewGradeSchema = z.enum(["again", "hard", "good", "easy"])

export const VocabularyReviewScheduleRecordSchema = z.object({
  vocabularyEntryId: z.string().trim().min(1),
  srsBox: z.number().int().min(1).max(5),
  nextReviewAt: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  lastReviewedAt: z.number().int().nonnegative().nullable().default(null),
  lastReviewGrade: VocabularyReviewGradeSchema.nullable().default(null),
  lastReviewGradeAt: z.number().int().nonnegative().nullable().default(null),
  updatedAt: z.number().int().nonnegative(),
}).strict()

export type VocabularyReviewScheduleRecord = z.infer<typeof VocabularyReviewScheduleRecordSchema>

export interface VocabularyReviewScheduleSyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown
}

export interface VocabularySyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown
}

export function sanitizeVocabularyUrl(url?: string | null): string | undefined {
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

export function normalizeVocabularyStudyUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return ""
  return sanitizeVocabularyUrl(trimmed) ?? trimmed
}

export function getVocabularyStudyUrlCandidates(entry: Pick<VocabularyEntry, "sourceContext" | "url">): string[] {
  const candidates = [
    entry.sourceContext?.studyProgressRecordId,
    entry.sourceContext?.pageUrl,
    entry.url,
  ]
    .map((value) => normalizeVocabularyStudyUrl(value))
    .filter(Boolean)

  return Array.from(new Set(candidates))
}

export function isVocabularyEntryFromStudyUrl(
  entry: Pick<VocabularyEntry, "sourceContext" | "url">,
  studyUrl: string,
): boolean {
  const normalizedStudyUrl = normalizeVocabularyStudyUrl(studyUrl)
  if (!normalizedStudyUrl) return false
  return getVocabularyStudyUrlCandidates(entry).includes(normalizedStudyUrl)
}

export function getPageReviewVocabularyEntries(
  entries: VocabularyEntry[],
  studyUrl: string,
  focusedEntryId = "",
): VocabularyEntry[] {
  return entries
    .filter((entry) => isVocabularyEntryFromStudyUrl(entry, studyUrl))
    .sort((a, b) => {
      if (focusedEntryId) {
        if (a.id === focusedEntryId && b.id !== focusedEntryId) return -1
        if (b.id === focusedEntryId && a.id !== focusedEntryId) return 1
      }

      const aSentenceIndex = a.sourceContext?.sentenceIndex
      const bSentenceIndex = b.sourceContext?.sentenceIndex
      if (aSentenceIndex !== undefined && bSentenceIndex !== undefined && aSentenceIndex !== bSentenceIndex) {
        return aSentenceIndex - bSentenceIndex
      }
      if (aSentenceIndex !== undefined) return -1
      if (bSentenceIndex !== undefined) return 1

      return b.savedAt - a.savedAt
    })
}

export function buildSyncSafeVocabularyEntry(
  entry: VocabularyEntry | SyncedVocabularyEntry,
): SyncedVocabularyEntry {
  return SyncedVocabularyEntrySchema.parse({
    ...entry,
    sourceContext: normalizeVocabularySourceContext(entry.sourceContext, {
      url: entry.url,
      hostname: entry.hostname,
    }),
    ...(sanitizeVocabularyUrl(entry.url) ? { url: sanitizeVocabularyUrl(entry.url) } : { url: undefined }),
  })
}

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

export function buildDefaultVocabularyReviewScheduleRecord(
  entry: VocabularyEntry,
): VocabularyReviewScheduleRecord {
  const withSrs = ensureSrsFields(entry)
  const updatedAt = withSrs.lastReviewedAt ?? withSrs.savedAt
  return VocabularyReviewScheduleRecordSchema.parse({
    vocabularyEntryId: withSrs.id,
    srsBox: withSrs.srsBox,
    nextReviewAt: withSrs.nextReviewAt,
    reviewCount: withSrs.reviewCount,
    lastReviewedAt: withSrs.lastReviewedAt ?? null,
    lastReviewGrade: withSrs.lastReviewGrade ?? null,
    lastReviewGradeAt: withSrs.lastReviewGradeAt ?? null,
    updatedAt,
  })
}

export function buildSyncSafeVocabularyReviewScheduleRecord(
  record: VocabularyReviewScheduleRecord,
): VocabularyReviewScheduleRecord {
  return VocabularyReviewScheduleRecordSchema.parse(record)
}

export function mergeVocabularyReviewScheduleRecord(
  existing: VocabularyReviewScheduleRecord | null | undefined,
  incoming: VocabularyReviewScheduleRecord,
): VocabularyReviewScheduleRecord {
  if (!existing) return buildSyncSafeVocabularyReviewScheduleRecord(incoming)
  return buildSyncSafeVocabularyReviewScheduleRecord(
    incoming.updatedAt >= existing.updatedAt ? incoming : existing,
  )
}

export function applyVocabularyReviewScheduleToEntry(
  entry: VocabularyEntry,
  record: VocabularyReviewScheduleRecord | null | undefined,
): VocabularyEntry {
  if (!record || record.vocabularyEntryId !== entry.id) return ensureSrsFields(entry)
  return ensureSrsFields({
    ...entry,
    srsBox: record.srsBox,
    nextReviewAt: record.nextReviewAt,
    reviewCount: record.reviewCount,
    lastReviewedAt: record.lastReviewedAt,
    lastReviewGrade: record.lastReviewGrade,
    lastReviewGradeAt: record.lastReviewGradeAt,
  })
}

export function applyVocabularyReviewScheduleRecordsToEntries(
  entries: VocabularyEntry[],
  records: VocabularyReviewScheduleRecord[],
): VocabularyEntry[] {
  const scheduleByEntryId = new Map(records.map((record) => [record.vocabularyEntryId, record]))
  return entries.map((entry) => applyVocabularyReviewScheduleToEntry(entry, scheduleByEntryId.get(entry.id)))
}

export function buildVocabularyReviewScheduleSyncRecordMap(
  records: VocabularyReviewScheduleRecord[],
): Record<string, VocabularyReviewScheduleRecord> {
  return Object.fromEntries(
    records.map((record) => {
      const synced = buildSyncSafeVocabularyReviewScheduleRecord(record)
      return [synced.vocabularyEntryId, synced]
    }),
  )
}

export function applyVocabularyReviewScheduleSyncMutation(
  records: VocabularyReviewScheduleRecord[],
  mutation: VocabularyReviewScheduleSyncMutationLike,
): VocabularyReviewScheduleRecord[] {
  if (mutation.operation === "delete") {
    return records.filter((record) => record.vocabularyEntryId !== mutation.recordId)
  }

  const incoming = VocabularyReviewScheduleRecordSchema.parse(mutation.payload)
  if (incoming.vocabularyEntryId !== mutation.recordId) {
    throw new Error("Vocabulary review schedule sync recordId must match payload.vocabularyEntryId")
  }

  const existingIndex = records.findIndex((record) => record.vocabularyEntryId === incoming.vocabularyEntryId)
  if (existingIndex < 0) {
    return [incoming, ...records]
  }

  const nextRecords = [...records]
  nextRecords[existingIndex] = mergeVocabularyReviewScheduleRecord(records[existingIndex], incoming)
  return nextRecords
}

export function applyVocabularyReviewScheduleSyncMutations(
  records: VocabularyReviewScheduleRecord[],
  mutations: VocabularyReviewScheduleSyncMutationLike[],
): VocabularyReviewScheduleRecord[] {
  return mutations.reduce(
    (currentRecords, mutation) => applyVocabularyReviewScheduleSyncMutation(currentRecords, mutation),
    records.map(buildSyncSafeVocabularyReviewScheduleRecord),
  )
}

export function buildReviewedVocabularyReviewScheduleRecord(params: {
  vocabularyEntryId: string
  srsBox: number
  nextReviewAt: number
  reviewCount: number
  lastReviewedAt: number | null
  grade: ReviewGrade
  updatedAt?: number
}): VocabularyReviewScheduleRecord {
  const updatedAt = params.updatedAt ?? params.lastReviewedAt ?? Date.now()
  return VocabularyReviewScheduleRecordSchema.parse({
    vocabularyEntryId: params.vocabularyEntryId,
    srsBox: params.srsBox,
    nextReviewAt: params.nextReviewAt,
    reviewCount: params.reviewCount,
    lastReviewedAt: params.lastReviewedAt,
    lastReviewGrade: params.grade,
    lastReviewGradeAt: params.lastReviewedAt ?? updatedAt,
    updatedAt,
  })
}

function stripUndefinedFields<T extends Record<string, unknown>>(value?: T | null): Partial<T> {
  if (!value) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as Partial<T>
}

function normalizeSourceText(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeMatchedGlossaryTerms(
  terms?: VocabularySourceContext["matchedGlossaryTerms"] | null,
): VocabularySourceContext["matchedGlossaryTerms"] | undefined {
  const normalized = (terms ?? []).flatMap((term) => {
    const sourceTerm = normalizeSourceText(term.sourceTerm)
    const preferredTerm = normalizeSourceText(term.preferredTerm)
    return sourceTerm && preferredTerm ? [{ sourceTerm, preferredTerm }] : []
  })

  return normalized.length > 0 ? normalized : undefined
}

export function formatGlossaryEvidenceLabel(
  terms?: VocabularySourceContext["matchedGlossaryTerms"] | null,
): string {
  const normalized = normalizeMatchedGlossaryTerms(terms)
  if (!normalized?.length) return ""

  return `Glossary applied: ${normalized.map((term) => `${term.sourceTerm} → ${term.preferredTerm}`).join(", ")}`
}

export function normalizeVocabularySourceContext(
  sourceContext?: VocabularySourceContext,
  fallback?: { url?: string | null; hostname?: string | null },
): VocabularySourceContext | undefined {
  if (!sourceContext) return undefined

  return VocabularySourceContextSchema.parse({
    ...stripUndefinedFields(sourceContext),
    pageTitle: normalizeSourceText(sourceContext.pageTitle),
    pageUrl: sanitizeVocabularyUrl(sourceContext.pageUrl ?? fallback?.url),
    hostname: normalizeSourceText(sourceContext.hostname ?? fallback?.hostname),
    contentSummary: normalizeSourceText(sourceContext.contentSummary),
    articleExcerpt: normalizeSourceText(sourceContext.articleExcerpt),
    sentenceText: normalizeSourceText(sourceContext.sentenceText),
    sentenceHash: buildSentenceHash(sourceContext.sentenceText) ?? normalizeSourceText(sourceContext.sentenceHash),
    ownedReadingItemId: normalizeSourceText(sourceContext.ownedReadingItemId),
    ownedReadingTitle: normalizeSourceText(sourceContext.ownedReadingTitle),
    studyProgressRecordId: sanitizeVocabularyUrl(sourceContext.studyProgressRecordId),
    matchedGlossaryTerms: normalizeMatchedGlossaryTerms(sourceContext.matchedGlossaryTerms),
  })
}

export function mergeVocabularySourceContext(
  existing?: VocabularySourceContext,
  incoming?: VocabularySourceContext,
  fallback?: { url?: string | null; hostname?: string | null },
): VocabularySourceContext | undefined {
  if (!existing && !incoming) return undefined

  return normalizeVocabularySourceContext(VocabularySourceContextSchema.parse({
    ...stripUndefinedFields(existing),
    ...stripUndefinedFields(incoming),
  }), fallback)
}

export function getVocabularySourceSurfaceLabel(
  surface?: VocabularySourceContext["surface"],
): string | null {
  switch (surface) {
    case undefined:
      return null
    case "popup_deep_read":
      return "Popup deep-read"
    case "selection_toolbar":
      return "Selection toolbar"
    case "hover_translate":
      return "Hover translate"
    case "subtitle_reader":
      return "Subtitle reader"
    default:
      return null
  }
}

function toTitleLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
}

export function formatExplainProfileLabel(profile?: {
  languageLevel?: LanguageLevel | null
  explainMode?: ExplainMode | null
}): string {
  const explainMode = profile?.explainMode
  const languageLevel = profile?.languageLevel
  if (!explainMode && !languageLevel) return ""

  return `Explain profile: ${[
    explainMode ? toTitleLabel(explainMode) : null,
    languageLevel ? toTitleLabel(languageLevel) : null,
  ].filter(Boolean).join(" · ")}`
}

export function deriveVocabularySourceDisplay(entry: Pick<VocabularyEntry, "context" | "url" | "hostname" | "sourceContext">) {
  const sourceContext = normalizeVocabularySourceContext(entry.sourceContext, {
    url: entry.url,
    hostname: entry.hostname,
  })
  const sourceLabel = sourceContext?.pageTitle
    ?? sourceContext?.hostname
    ?? sourceContext?.pageUrl
    ?? normalizeSourceText(entry.hostname)
    ?? sanitizeVocabularyUrl(entry.url)
    ?? ""
  const snippet = sourceContext?.sentenceText
    ?? sourceContext?.articleExcerpt
    ?? sourceContext?.contentSummary
    ?? normalizeSourceText(entry.context)
    ?? ""
  const articleExcerpt = sourceContext?.articleExcerpt && sourceContext.articleExcerpt !== sourceContext.sentenceText
    ? sourceContext.articleExcerpt
    : ""
  const contentSummary = !articleExcerpt
    ? (sourceContext?.contentSummary ?? "")
    : (sourceContext?.contentSummary && sourceContext.contentSummary !== snippet ? sourceContext.contentSummary : "")

  return {
    sourceContext,
    surfaceLabel: getVocabularySourceSurfaceLabel(sourceContext?.surface),
    sourceLabel,
    snippet,
    articleExcerpt,
    contentSummary,
    explainProfileLabel: formatExplainProfileLabel(sourceContext),
    glossaryEvidenceLabel: formatGlossaryEvidenceLabel(sourceContext?.matchedGlossaryTerms),
    pageUrl: sourceContext?.pageUrl ?? sanitizeVocabularyUrl(entry.url) ?? "",
    hostname: sourceContext?.hostname ?? normalizeSourceText(entry.hostname) ?? "",
    ownedReadingItemId: sourceContext?.ownedReadingItemId ?? "",
    ownedReadingSourceType: sourceContext?.ownedReadingSourceType,
    ownedReadingTitle: sourceContext?.ownedReadingTitle ?? "",
    studyProgressRecordId: sourceContext?.studyProgressRecordId ?? "",
  }
}

export function applySyncedVocabularyMutation(
  entries: SyncedVocabularyEntry[],
  mutation: VocabularySyncMutationLike,
): SyncedVocabularyEntry[] {
  if (mutation.operation === "delete") {
    return entries.filter((entry) => entry.id !== mutation.recordId)
  }

  const syncedEntry = SyncedVocabularyEntrySchema.parse(mutation.payload)
  if (syncedEntry.id !== mutation.recordId) {
    throw new Error("Vocabulary sync recordId must match payload.id")
  }

  const existingIndex = entries.findIndex((entry) => entry.id === syncedEntry.id)
  const existing = existingIndex >= 0 ? entries[existingIndex] : null
  const mergedEntry = SyncedVocabularyEntrySchema.parse({
    ...syncedEntry,
    sourceContext: mergeVocabularySourceContext(existing?.sourceContext, syncedEntry.sourceContext, {
      url: syncedEntry.url,
      hostname: syncedEntry.hostname,
    }),
  })
  const nextEntries = [...entries]
  if (existingIndex >= 0) {
    nextEntries[existingIndex] = mergedEntry
  } else {
    nextEntries.unshift(mergedEntry)
  }

  return nextEntries
}

export function applySyncedVocabularyMutations(
  entries: SyncedVocabularyEntry[],
  mutations: VocabularySyncMutationLike[],
): SyncedVocabularyEntry[] {
  return mutations.reduce(
    (currentEntries, mutation) => applySyncedVocabularyMutation(currentEntries, mutation),
    entries.map((entry) => buildSyncSafeVocabularyEntry(entry)),
  )
}

export function applyVocabularySyncMutation(
  entries: VocabularyEntry[],
  mutation: VocabularySyncMutationLike,
): VocabularyEntry[] {
  if (mutation.operation === "delete") {
    return entries.filter((entry) => entry.id !== mutation.recordId)
  }

  const syncedEntry = SyncedVocabularyEntrySchema.parse(mutation.payload)
  if (syncedEntry.id !== mutation.recordId) {
    throw new Error("Vocabulary sync recordId must match payload.id")
  }

  const existingIndex = entries.findIndex((entry) => entry.id === syncedEntry.id)
  const existing = existingIndex >= 0 ? ensureSrsFields(entries[existingIndex]) : null
  const mergedEntry = ensureSrsFields({
    ...syncedEntry,
    sourceContext: mergeVocabularySourceContext(existing?.sourceContext, syncedEntry.sourceContext, {
      url: syncedEntry.url,
      hostname: syncedEntry.hostname,
    }),
    ...(existing
      ? {
          srsBox: existing.srsBox,
          nextReviewAt: existing.nextReviewAt,
          reviewCount: existing.reviewCount,
          lastReviewedAt: existing.lastReviewedAt,
        }
      : {}),
  })

  const nextEntries = [...entries]
  if (existingIndex >= 0) {
    nextEntries[existingIndex] = mergedEntry
  } else {
    nextEntries.unshift(mergedEntry)
  }

  return nextEntries
}

export function applyVocabularySyncMutations(
  entries: VocabularyEntry[],
  mutations: VocabularySyncMutationLike[],
): VocabularyEntry[] {
  return mutations.reduce(
    (currentEntries, mutation) => applyVocabularySyncMutation(currentEntries, mutation),
    entries.map(ensureSrsFields),
  )
}
