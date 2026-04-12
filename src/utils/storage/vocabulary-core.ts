import { z } from "zod"

import { createDefaultSrsFields } from "@/utils/srs/leitner"

export const VocabularyEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  translation: z.string().optional(),
  explanation: z.string().optional(),
  context: z.string().optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  savedAt: z.number(),
  srsBox: z.number().optional(),
  nextReviewAt: z.number().optional(),
  reviewCount: z.number().optional(),
  lastReviewedAt: z.number().nullable().optional(),
  note: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  glossaryEnabled: z.boolean().optional(),
  glossaryScope: z.enum(["hostname", "global"]).optional(),
  glossaryTargetText: z.string().optional(),
})

export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>

export const SyncedVocabularyEntrySchema = VocabularyEntrySchema.omit({
  srsBox: true,
  nextReviewAt: true,
  reviewCount: true,
  lastReviewedAt: true,
})

export type SyncedVocabularyEntry = z.infer<typeof SyncedVocabularyEntrySchema>

export interface VocabularySyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown | null
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

export function buildSyncSafeVocabularyEntry(
  entry: VocabularyEntry | SyncedVocabularyEntry,
): SyncedVocabularyEntry {
  return SyncedVocabularyEntrySchema.parse({
    ...entry,
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
  const nextEntries = [...entries]
  if (existingIndex >= 0) {
    nextEntries[existingIndex] = syncedEntry
  } else {
    nextEntries.unshift(syncedEntry)
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
  const existing = existingIndex >= 0 ? ensureSrsFields(entries[existingIndex]!) : null
  const mergedEntry = ensureSrsFields({
    ...syncedEntry,
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
