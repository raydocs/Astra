/**
 * Study progress store — tracks learning loop state per page.
 * Connects reading → translation → sentence explanation → vocabulary review
 * into a single observable progression.
 */

import { browser } from "#imports"
import { z } from "zod"
import type { VocabularyEntry } from "./vocabulary-core"

export const StudyStepSchema = z.enum([
  "read",           // User started reading / translating the page
  "guided_read",    // User initiated guided article reading
  "explain",        // User explained at least one sentence
  "vocab_save",     // User saved at least one vocabulary entry
  "vocab_review",   // User reviewed vocabulary from this page
])

export type StudyStep = z.infer<typeof StudyStepSchema>

export const STUDY_STEPS_ORDER: StudyStep[] = [
  "read",
  "guided_read",
  "explain",
  "vocab_save",
  "vocab_review",
]

const StudyPageProgressSchema = z.object({
  url: z.string(),
  hostname: z.string(),
  title: z.string(),
  completedSteps: z.array(StudyStepSchema),
  sentencesExplained: z.number().int().nonnegative().default(0),
  vocabSaved: z.number().int().nonnegative().default(0),
  startedAt: z.number(),
  lastActivityAt: z.number(),
})

export type StudyPageProgress = z.infer<typeof StudyPageProgressSchema>
export const SyncedStudyPageProgressSchema = StudyPageProgressSchema
export type SyncedStudyPageProgress = z.infer<typeof SyncedStudyPageProgressSchema>

const StudyProgressStoreSchema = z.object({
  pages: z.array(StudyPageProgressSchema),
  dailyStats: z.object({
    date: z.string(), // YYYY-MM-DD
    pagesStudied: z.number().int().nonnegative(),
    sentencesExplained: z.number().int().nonnegative(),
    vocabSaved: z.number().int().nonnegative(),
    vocabReviewed: z.number().int().nonnegative(),
  }),
})

export type StudyProgressStore = z.infer<typeof StudyProgressStoreSchema>

export interface StudyProgressSyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown | null
}

export const STUDY_PROGRESS_STORAGE_KEY = "astra.study_progress.v1"
const MAX_PAGES = 50

/** First-step events that mean the user studied this page in the reading loop (SRS-only review is excluded). */
const FIRST_STEP_COUNTS_PAGE_STUDIED = new Set<StudyStep>(["read", "guided_read", "explain", "vocab_save"])

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function emptyDailyStats(date = todayKey()) {
  return { date, pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 }
}

/** Canonical ordering of completed steps for UI (Month 2: progress bar / revisit copy). */
export function orderStudySteps(steps: readonly StudyStep[]): StudyStep[] {
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
    .slice(0, MAX_PAGES)
}

function parseStore(raw: unknown): StudyProgressStore {
  const parsed = StudyProgressStoreSchema.safeParse(raw)
  if (parsed.success) {
    return {
      ...parsed.data,
      pages: normalizeStudyPages(parsed.data.pages),
    }
  }
  return { pages: [], dailyStats: emptyDailyStats() }
}

async function readStore(): Promise<StudyProgressStore> {
  const stored = await browser.storage.local.get(STUDY_PROGRESS_STORAGE_KEY)
  return parseStore(stored[STUDY_PROGRESS_STORAGE_KEY])
}

async function writeStore(store: StudyProgressStore): Promise<void> {
  const normalized = StudyProgressStoreSchema.parse({
    ...store,
    pages: normalizeStudyPages(store.pages),
  })
  await browser.storage.local.set({
    [STUDY_PROGRESS_STORAGE_KEY]: normalized,
  })
}

function ensureDailyStats(store: StudyProgressStore): StudyProgressStore {
  const today = todayKey()
  if (store.dailyStats.date === today) return store
  return { ...store, dailyStats: emptyDailyStats(today) }
}

export interface RecordStudyEventInput {
  url: string
  hostname: string
  title: string
  step: StudyStep
  count?: number // for explain/vocab_save/vocab_review increments
}

export async function recordStudyEvent(input: RecordStudyEventInput): Promise<StudyPageProgress> {
  let store = ensureDailyStats(await readStore())
  const cleanUrl = buildStudyProgressRecordId(input.url)
  const now = Date.now()

  let pageIdx = store.pages.findIndex((p) => p.url === cleanUrl)
  let page: StudyPageProgress

  if (pageIdx >= 0) {
    page = { ...store.pages[pageIdx] }
  } else {
    page = {
      url: cleanUrl,
      hostname: input.hostname,
      title: input.title,
      completedSteps: [],
      sentencesExplained: 0,
      vocabSaved: 0,
      startedAt: now,
      lastActivityAt: now,
    }
    pageIdx = 0
  }

  // Mark step completed
  if (!page.completedSteps.includes(input.step)) {
    page.completedSteps = [...page.completedSteps, input.step]
  }
  page.lastActivityAt = now
  page.title = input.title || page.title

  // Update counters
  const increment = input.count ?? 1
  switch (input.step) {
    case "read":
    case "guided_read":
      // Just mark the step
      break
    case "explain":
      page.sentencesExplained += increment
      store.dailyStats.sentencesExplained += increment
      break
    case "vocab_save":
      page.vocabSaved += increment
      store.dailyStats.vocabSaved += increment
      break
    case "vocab_review":
      store.dailyStats.vocabReviewed += increment
      break
  }

  // Count new page studied (vocab_review alone should not inflate "pages studied" in daily stats)
  if (page.completedSteps.length === 1 && FIRST_STEP_COUNTS_PAGE_STUDIED.has(input.step)) {
    store.dailyStats.pagesStudied += 1
  }

  // Update pages list — move this page to front
  const otherPages = store.pages.filter((p) => p.url !== cleanUrl)
  store = {
    ...store,
    pages: [page, ...otherPages].slice(0, MAX_PAGES),
  }

  await writeStore(store)
  return page
}

export async function getStudyProgress(): Promise<StudyProgressStore> {
  return ensureDailyStats(await readStore())
}

export async function getPageStudyProgress(url: string): Promise<StudyPageProgress | null> {
  const store = await readStore()
  return store.pages.find((p) => p.url === buildStudyProgressRecordId(url)) ?? null
}

export interface StudyLoopViewModel {
  currentPage: StudyPageProgress | null
  nextStep: StudyStep | null
  completionPercent: number
  dailyStats: StudyProgressStore["dailyStats"]
  recentPages: StudyPageProgress[]
}

export function deriveStudyLoopViewModel(
  store: StudyProgressStore,
  currentUrl?: string,
): StudyLoopViewModel {
  const currentPage = currentUrl
    ? store.pages.find((p) => p.url === buildStudyProgressRecordId(currentUrl)) ?? null
    : null

  const completedSteps = currentPage?.completedSteps ?? []
  const nextStep = STUDY_STEPS_ORDER.find((s) => !completedSteps.includes(s)) ?? null
  const completionPercent = Math.round((completedSteps.length / STUDY_STEPS_ORDER.length) * 100)

  return {
    currentPage,
    nextStep,
    completionPercent,
    dailyStats: store.dailyStats,
    recentPages: store.pages.slice(0, 5),
  }
}

export function buildVocabularyReviewStudyEvent(entry: VocabularyEntry): RecordStudyEventInput | null {
  const rawUrl = entry.url?.trim()
  if (!rawUrl) return null
  const sanitizedUrl = buildStudyProgressRecordId(rawUrl)

  let hostname = entry.hostname?.trim() ?? ""
  if (!hostname) {
    try {
      hostname = new URL(rawUrl).hostname
    } catch {
      hostname = ""
    }
  }

  return {
    url: sanitizedUrl,
    hostname,
    title: entry.sourceContext?.pageTitle ?? entry.hostname ?? entry.text,
    step: "vocab_review",
  }
}

export async function clearStudyProgress(): Promise<void> {
  await writeStore({ pages: [], dailyStats: emptyDailyStats() })
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

export async function readSyncSafeStudyProgressPages(): Promise<SyncedStudyPageProgress[]> {
  const store = await readStore()
  return store.pages.map((page) => buildSyncSafeStudyPageProgress(page))
}

export async function replaceStudyProgressPages(
  pages: Array<StudyPageProgress | SyncedStudyPageProgress>,
): Promise<void> {
  const currentStore = await readStore()
  await writeStore({
    pages: normalizeStudyPages(pages),
    dailyStats: currentStore.dailyStats,
  })
}
