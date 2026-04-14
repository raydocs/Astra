import { z } from "zod"

export const StudyStepSchema = z.enum([
  "read",
  "guided_read",
  "explain",
  "vocab_save",
  "vocab_review",
])

export type StudyStep = z.infer<typeof StudyStepSchema>

export const STUDY_STEPS_ORDER: StudyStep[] = [
  "read",
  "guided_read",
  "explain",
  "vocab_save",
  "vocab_review",
]

export const StudyPageProgressSchema = z.object({
  url: z.string(),
  hostname: z.string(),
  title: z.string(),
  completedSteps: z.array(StudyStepSchema),
  sentencesExplained: z.number().int().nonnegative().default(0),
  vocabSaved: z.number().int().nonnegative().default(0),
  vocabReviewed: z.number().int().nonnegative().default(0),
  startedAt: z.number(),
  lastActivityAt: z.number(),
})

export type StudyPageProgress = z.infer<typeof StudyPageProgressSchema>
export const SyncedStudyPageProgressSchema = StudyPageProgressSchema
export type SyncedStudyPageProgress = z.infer<typeof SyncedStudyPageProgressSchema>

export interface StudyProgressSyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown | null
}

function orderStudySteps(steps: readonly StudyStep[]): StudyStep[] {
  const present = new Set(steps)
  return STUDY_STEPS_ORDER.filter((step) => present.has(step))
}

export function buildStudyProgressRecordId(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error("Study progress URL is required.")
  }

  try {
    const parsed = new URL(trimmed)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return trimmed
  }
}

export function buildSyncSafeStudyPageProgress(
  page: StudyPageProgress | SyncedStudyPageProgress,
): SyncedStudyPageProgress {
  const recordId = buildStudyProgressRecordId(page.url)
  return SyncedStudyPageProgressSchema.parse({
    ...page,
    url: recordId,
    hostname: page.hostname.trim(),
    title: page.title,
    completedSteps: orderStudySteps(page.completedSteps),
  })
}

function mergeStudyPageProgress(
  existing: SyncedStudyPageProgress,
  incoming: SyncedStudyPageProgress,
): SyncedStudyPageProgress {
  const incomingTitle = incoming.title.trim()
  const existingTitle = existing.title.trim()
  const useIncomingTitle = (incoming.lastActivityAt > existing.lastActivityAt && incomingTitle.length > 0)
    || (incoming.lastActivityAt === existing.lastActivityAt && existingTitle.length === 0 && incomingTitle.length > 0)

  return buildSyncSafeStudyPageProgress({
    ...existing,
    url: existing.url,
    hostname: incoming.hostname.trim() || existing.hostname,
    title: useIncomingTitle ? incoming.title : existing.title,
    completedSteps: [
      ...existing.completedSteps,
      ...incoming.completedSteps,
    ],
    sentencesExplained: Math.max(existing.sentencesExplained, incoming.sentencesExplained),
    vocabSaved: Math.max(existing.vocabSaved, incoming.vocabSaved),
    vocabReviewed: Math.max(existing.vocabReviewed, incoming.vocabReviewed),
    startedAt: Math.min(existing.startedAt, incoming.startedAt),
    lastActivityAt: Math.max(existing.lastActivityAt, incoming.lastActivityAt),
  })
}

function normalizeStudyPages(
  pages: Array<StudyPageProgress | SyncedStudyPageProgress>,
): StudyPageProgress[] {
  const byRecordId = new Map<string, SyncedStudyPageProgress>()

  for (const page of pages) {
    const normalized = buildSyncSafeStudyPageProgress(page)
    const existing = byRecordId.get(normalized.url)
    byRecordId.set(
      normalized.url,
      existing ? mergeStudyPageProgress(existing, normalized) : normalized,
    )
  }

  return [...byRecordId.values()]
    .sort((left, right) => {
      if (right.lastActivityAt !== left.lastActivityAt) return right.lastActivityAt - left.lastActivityAt
      if (right.startedAt !== left.startedAt) return right.startedAt - left.startedAt
      return left.url.localeCompare(right.url)
    })
}

export function buildStudyProgressSyncRecordMap(
  pages: Array<StudyPageProgress | SyncedStudyPageProgress>,
): Record<string, SyncedStudyPageProgress> {
  return Object.fromEntries(
    normalizeStudyPages(pages).map((page) => [page.url, buildSyncSafeStudyPageProgress(page)]),
  )
}

export function applyStudyProgressSyncMutation(
  pages: StudyPageProgress[],
  mutation: StudyProgressSyncMutationLike,
): StudyPageProgress[] {
  const currentPages = normalizeStudyPages(pages)

  if (mutation.operation === "delete") {
    return currentPages.filter((page) => page.url !== mutation.recordId)
  }

  const incoming = buildSyncSafeStudyPageProgress(
    SyncedStudyPageProgressSchema.parse(mutation.payload),
  )

  if (incoming.url !== mutation.recordId) {
    throw new Error("Study progress sync recordId must match the sanitized URL.")
  }

  const existing = currentPages.find((page) => page.url === mutation.recordId) ?? null
  const nextPage = existing
    ? mergeStudyPageProgress(buildSyncSafeStudyPageProgress(existing), incoming)
    : incoming

  return normalizeStudyPages([
    nextPage,
    ...currentPages.filter((page) => page.url !== mutation.recordId),
  ])
}

export function applyStudyProgressSyncMutations(
  pages: StudyPageProgress[],
  mutations: StudyProgressSyncMutationLike[],
): StudyPageProgress[] {
  return mutations.reduce(
    (currentPages, mutation) => applyStudyProgressSyncMutation(currentPages, mutation),
    normalizeStudyPages(pages),
  )
}
