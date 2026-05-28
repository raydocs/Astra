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
  vocabReviewed: z.number().int().nonnegative().default(0),
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
const WEEKLY_ROI_DEFAULT_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** First-step events that mean the user studied this page in the reading loop (SRS-only review is excluded). */
const FIRST_STEP_COUNTS_PAGE_STUDIED = new Set<StudyStep>(["read", "guided_read", "explain", "vocab_save"])

export interface WeeklyRoiWindow {
  startAt: number
  endAt: number
  days: number
}

export interface WeeklyRoiWindowOptions {
  now?: number
  days?: number
}

export interface WeeklyStudyProgressRoiOptions extends WeeklyRoiWindowOptions {
  minInputMinutesPerPage?: number
  maxInputMinutesPerPage?: number
}

export interface WeeklyStudyProgressRoiSummary {
  window: WeeklyRoiWindow
  activePageCount: number
  completedLoopCount: number
  inputMinutes: number
  sentencesExplained: number
  vocabSaved: number
  vocabReviewed: number
}

export function deriveWeeklyRoiWindow(options: WeeklyRoiWindowOptions = {}): WeeklyRoiWindow {
  const endAt = options.now ?? Date.now()
  const days = Math.max(1, Math.floor(options.days ?? WEEKLY_ROI_DEFAULT_DAYS))
  return {
    startAt: endAt - (days * DAY_MS),
    endAt,
    days,
  }
}

function isTimestampInWeeklyRoiWindow(value: number | null | undefined, window: WeeklyRoiWindow): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= window.startAt && value <= window.endAt
}

function estimateWeeklyInputMinutes(
  page: StudyPageProgress,
  options: Required<Pick<WeeklyStudyProgressRoiOptions, "minInputMinutesPerPage" | "maxInputMinutesPerPage">>,
): number {
  const rawMinutes = Math.ceil(Math.max(0, page.lastActivityAt - page.startedAt) / 60_000)
  return Math.min(
    options.maxInputMinutesPerPage,
    Math.max(options.minInputMinutesPerPage, rawMinutes),
  )
}

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

function buildReducedStudyProgressUrl(url: string, hostname: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}/`
  } catch {
    return hostname.trim() ? `https://${hostname.trim().toLowerCase()}/` : "astra-private://source/"
  }
}

function reduceStudyEventInput(input: RecordStudyEventInput): RecordStudyEventInput {
  const hostname = input.hostname.trim().toLowerCase()
  return {
    ...input,
    url: buildReducedStudyProgressUrl(input.url, hostname),
    hostname,
    title: "Private page",
  }
}

function buildSuppressedStudyProgress(input: RecordStudyEventInput): StudyPageProgress {
  const reduced = reduceStudyEventInput(input)
  const now = Date.now()
  const increment = input.count ?? 1
  return {
    url: buildStudyProgressRecordId(reduced.url),
    hostname: reduced.hostname,
    title: reduced.title,
    completedSteps: [input.step],
    sentencesExplained: input.step === "explain" ? increment : 0,
    vocabSaved: input.step === "vocab_save" ? increment : 0,
    vocabReviewed: input.step === "vocab_review" ? increment : 0,
    startedAt: now,
    lastActivityAt: now,
  }
}

export async function recordStudyEvent(input: RecordStudyEventInput): Promise<StudyPageProgress> {
  const { resolveLearningMemoryWritePolicy } = await import("./learning-memory")
  const policy = await resolveLearningMemoryWritePolicy({
    surface: "study_progress",
    hostname: input.hostname,
    url: input.url,
  })
  if (policy.decision === "suppress") return buildSuppressedStudyProgress(input)

  const writableInput = policy.decision === "reduce" ? reduceStudyEventInput(input) : input
  let store = ensureDailyStats(await readStore())
  const cleanUrl = buildStudyProgressRecordId(writableInput.url)
  const now = Date.now()

  let pageIdx = store.pages.findIndex((p) => p.url === cleanUrl)
  let page: StudyPageProgress

  if (pageIdx >= 0) {
    page = { ...store.pages[pageIdx] }
  } else {
    page = {
      url: cleanUrl,
      hostname: writableInput.hostname,
      title: writableInput.title,
      completedSteps: [],
      sentencesExplained: 0,
      vocabSaved: 0,
      vocabReviewed: 0,
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
  page.title = writableInput.title || page.title

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
      page.vocabReviewed += increment
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

export interface StudyLoopPageCounts {
  sentencesExplained: number
  vocabSaved: number
  vocabReviewed: number
}

export interface StudyLoopPageSummary {
  completedSteps: StudyStep[]
  currentCounts: StudyLoopPageCounts
  nextStep: StudyStep | null
  completionPercent: number
}

export type PersonalizedTeachingStrategyId =
  | "start_with_context"
  | "guided_sentence_scan"
  | "explain_before_saving"
  | "save_explained_sentence"
  | "review_saved_context"
  | "loop_complete_reflection"
  | "daily_balance_review"

export type PersonalizedTeachingStrategyTrigger =
  | "page_not_started"
  | "guided_read_next"
  | "explain_next"
  | "explained_more_than_saved"
  | "saved_more_than_reviewed"
  | "page_loop_complete"
  | "daily_activity_no_page"

export interface PersonalizedTeachingStrategy {
  id: PersonalizedTeachingStrategyId
  label: string
  hint: string
  focusStep: StudyStep | null
  trigger: PersonalizedTeachingStrategyTrigger
  progressSignature: string
  evidence: string
}

export type StudyLoopPrimerAction = "translate_page" | "open_deep_read" | "explain_sentence" | "open_review"

export type StudyLoopPrimerRecommendationReason =
  | "next_step_read"
  | "next_step_guided_read"
  | "next_step_explain"
  | "next_step_vocab_save"
  | "next_step_vocab_review"
  | "due_review"
  | "fallback_first_available"
  | "no_actionable_action"

export interface StudyLoopPrimerRecommendationInput {
  nextStep: StudyStep | null | undefined
  dueCount: number
  canTranslatePage: boolean
  canReadArticle: boolean
  canExplainSentence: boolean
  canOpenReview?: boolean
}

export interface StudyLoopPrimerRecommendation {
  recommendedAction: StudyLoopPrimerAction | null
  reason: StudyLoopPrimerRecommendationReason
  actionableActions: StudyLoopPrimerAction[]
  actionableActionCount: number
  nextStep: StudyStep | null
}

const PRIMER_ACTION_BY_NEXT_STEP: Record<StudyStep, StudyLoopPrimerAction> = {
  read: "translate_page",
  guided_read: "open_deep_read",
  explain: "explain_sentence",
  vocab_save: "open_deep_read",
  vocab_review: "open_review",
}

const PRIMER_REASON_BY_NEXT_STEP: Record<StudyStep, StudyLoopPrimerRecommendationReason> = {
  read: "next_step_read",
  guided_read: "next_step_guided_read",
  explain: "next_step_explain",
  vocab_save: "next_step_vocab_save",
  vocab_review: "next_step_vocab_review",
}

export interface StudyLoopViewModel extends StudyLoopPageSummary {
  currentPage: StudyPageProgress | null
  dailyStats: StudyProgressStore["dailyStats"]
  recentPages: StudyPageProgress[]
  personalizedStrategy: PersonalizedTeachingStrategy | null
}

export function deriveStudyLoopPageCounts(page: StudyPageProgress | null | undefined): StudyLoopPageCounts {
  return {
    sentencesExplained: page?.sentencesExplained ?? 0,
    vocabSaved: page?.vocabSaved ?? 0,
    vocabReviewed: page?.vocabReviewed ?? 0,
  }
}

export function deriveStudyLoopPageSummary(
  page: StudyPageProgress | null | undefined,
): StudyLoopPageSummary {
  const completedSteps = orderStudySteps(page?.completedSteps ?? [])
  // Revisit should point forward from the furthest durable step already reached,
  // rather than forcing users to backfill earlier optional/missed steps (for example,
  // pages that skipped guided_read but already reached explain/save).
  const highestCompletedIndex = completedSteps.reduce(
    (maxIndex, step) => Math.max(maxIndex, STUDY_STEPS_ORDER.indexOf(step)),
    -1,
  )
  const nextStep = highestCompletedIndex < 0
    ? STUDY_STEPS_ORDER[0] ?? null
    : (STUDY_STEPS_ORDER[highestCompletedIndex + 1] ?? null)
  const completionPercent = Math.round((completedSteps.length / STUDY_STEPS_ORDER.length) * 100)

  return {
    completedSteps,
    currentCounts: deriveStudyLoopPageCounts(page),
    nextStep,
    completionPercent,
  }
}

function buildStrategyProgressSignature(
  summary: StudyLoopPageSummary,
): string {
  const steps = summary.completedSteps.length > 0 ? summary.completedSteps.join(">") : "none"
  return `${steps}|next:${summary.nextStep ?? "complete"}|e:${summary.currentCounts.sentencesExplained}|s:${summary.currentCounts.vocabSaved}|r:${summary.currentCounts.vocabReviewed}|pct:${summary.completionPercent}`
}

function hasDailyStudyActivity(dailyStats: StudyProgressStore["dailyStats"]): boolean {
  return dailyStats.pagesStudied > 0
    || dailyStats.sentencesExplained > 0
    || dailyStats.vocabSaved > 0
    || dailyStats.vocabReviewed > 0
}

export function derivePersonalizedTeachingStrategy(
  page: StudyPageProgress | null | undefined,
  summary: StudyLoopPageSummary,
  dailyStats: StudyProgressStore["dailyStats"],
): PersonalizedTeachingStrategy | null {
  const progressSignature = buildStrategyProgressSignature(summary)

  if (!page) {
    if (!hasDailyStudyActivity(dailyStats)) return null
    return {
      id: "daily_balance_review",
      label: "Balance today’s practice",
      hint: "You already have study activity today; use the next card or page to keep reading, saving, and review balanced.",
      focusStep: "vocab_review",
      trigger: "daily_activity_no_page",
      progressSignature,
      evidence: `${dailyStats.pagesStudied} pages · ${dailyStats.sentencesExplained} explained · ${dailyStats.vocabSaved} saved · ${dailyStats.vocabReviewed} reviewed today`,
    }
  }

  if (!summary.nextStep) {
    return {
      id: "loop_complete_reflection",
      label: "Close with a quick reflection",
      hint: "This page has completed the full read → explain → save → review loop; revisit the source or start the next page when ready.",
      focusStep: null,
      trigger: "page_loop_complete",
      progressSignature,
      evidence: `${summary.completionPercent}% complete on this page`,
    }
  }

  if (summary.nextStep === "read") {
    return {
      id: "start_with_context",
      label: "Start with page context",
      hint: "Translate or skim the page first so later sentence explanations stay anchored to the article.",
      focusStep: "read",
      trigger: "page_not_started",
      progressSignature,
      evidence: "No durable study steps recorded for this page yet",
    }
  }

  if (summary.nextStep === "guided_read") {
    return {
      id: "guided_sentence_scan",
      label: "Scan before drilling",
      hint: "Open Deep Read and choose one sentence worth explaining instead of jumping straight to review.",
      focusStep: "guided_read",
      trigger: "guided_read_next",
      progressSignature,
      evidence: `${summary.completedSteps.length} of ${STUDY_STEPS_ORDER.length} loop steps complete`,
    }
  }

  if (summary.nextStep === "explain") {
    return {
      id: "explain_before_saving",
      label: "Explain one sentence next",
      hint: "Ask for a sentence-level explanation before saving so the future review card carries meaning, not just a lookup.",
      focusStep: "explain",
      trigger: "explain_next",
      progressSignature,
      evidence: `${summary.currentCounts.sentencesExplained} explained · ${summary.currentCounts.vocabSaved} saved`,
    }
  }

  if (summary.nextStep === "vocab_save") {
    return {
      id: "save_explained_sentence",
      label: "Save the explained sentence",
      hint: "You have explanation momentum on this page; save one useful sentence so review can reinforce it later.",
      focusStep: "vocab_save",
      trigger: summary.currentCounts.sentencesExplained > summary.currentCounts.vocabSaved ? "explained_more_than_saved" : "explain_next",
      progressSignature,
      evidence: `${summary.currentCounts.sentencesExplained} explained · ${summary.currentCounts.vocabSaved} saved`,
    }
  }

  return {
    id: "review_saved_context",
    label: "Review this page’s saved context",
    hint: "Finish the loop by reviewing at least one saved card from this page while the source context is still fresh.",
    focusStep: "vocab_review",
    trigger: "saved_more_than_reviewed",
    progressSignature,
    evidence: `${summary.currentCounts.vocabSaved} saved · ${summary.currentCounts.vocabReviewed} reviewed`,
  }
}

export function deriveStudyLoopPrimerRecommendation(
  input: StudyLoopPrimerRecommendationInput,
): StudyLoopPrimerRecommendation {
  const nextStep = input.nextStep ?? null
  const canOpenReview = input.canOpenReview !== false
  const actionableActions: StudyLoopPrimerAction[] = []

  if (input.canTranslatePage) actionableActions.push("translate_page")
  if (input.canReadArticle) actionableActions.push("open_deep_read")
  if (input.canExplainSentence) actionableActions.push("explain_sentence")
  if (canOpenReview) actionableActions.push("open_review")

  const actionableSet = new Set(actionableActions)
  const nextStepAction = nextStep ? PRIMER_ACTION_BY_NEXT_STEP[nextStep] : null

  if (nextStep && nextStepAction && actionableSet.has(nextStepAction)) {
    return {
      recommendedAction: nextStepAction,
      reason: PRIMER_REASON_BY_NEXT_STEP[nextStep],
      actionableActions,
      actionableActionCount: actionableActions.length,
      nextStep,
    }
  }

  if (input.dueCount > 0 && actionableSet.has("open_review")) {
    return {
      recommendedAction: "open_review",
      reason: "due_review",
      actionableActions,
      actionableActionCount: actionableActions.length,
      nextStep,
    }
  }

  const fallbackAction = actionableActions[0] ?? null

  return {
    recommendedAction: fallbackAction,
    reason: fallbackAction ? "fallback_first_available" : "no_actionable_action",
    actionableActions,
    actionableActionCount: actionableActions.length,
    nextStep,
  }
}

export function deriveStudyLoopViewModel(
  store: StudyProgressStore,
  currentUrl?: string,
): StudyLoopViewModel {
  const currentPage = currentUrl
    ? store.pages.find((p) => p.url === buildStudyProgressRecordId(currentUrl)) ?? null
    : null
  const pageSummary = deriveStudyLoopPageSummary(currentPage)

  return {
    currentPage,
    ...pageSummary,
    dailyStats: store.dailyStats,
    recentPages: store.pages.slice(0, 5),
    personalizedStrategy: derivePersonalizedTeachingStrategy(currentPage, pageSummary, store.dailyStats),
  }
}

export function deriveWeeklyStudyProgressRoi(
  store: Pick<StudyProgressStore, "pages">,
  options: WeeklyStudyProgressRoiOptions = {},
): WeeklyStudyProgressRoiSummary {
  const window = deriveWeeklyRoiWindow(options)
  const inputOptions = {
    minInputMinutesPerPage: options.minInputMinutesPerPage ?? 1,
    maxInputMinutesPerPage: options.maxInputMinutesPerPage ?? 45,
  }
  const activePages = normalizeStudyPages(store.pages)
    .filter((page) => isTimestampInWeeklyRoiWindow(page.lastActivityAt, window))

  return {
    window,
    activePageCount: activePages.length,
    completedLoopCount: activePages.filter((page) => STUDY_STEPS_ORDER.every((step) => page.completedSteps.includes(step))).length,
    inputMinutes: activePages.reduce((total, page) => total + estimateWeeklyInputMinutes(page, inputOptions), 0),
    sentencesExplained: activePages.reduce((total, page) => total + page.sentencesExplained, 0),
    vocabSaved: activePages.reduce((total, page) => total + page.vocabSaved, 0),
    vocabReviewed: activePages.reduce((total, page) => total + page.vocabReviewed, 0),
  }
}

export function buildVocabularyReviewStudyEvent(entry: VocabularyEntry): RecordStudyEventInput | null {
  const linkedStudyUrl = entry.sourceContext?.studyProgressRecordId?.trim()
  const rawUrl = linkedStudyUrl || entry.url?.trim()
  if (!rawUrl) return null

  let sanitizedUrl: string
  if (linkedStudyUrl) {
    sanitizedUrl = buildStudyProgressRecordId(linkedStudyUrl)
  } else {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null
      }
      sanitizedUrl = buildStudyProgressRecordId(rawUrl)
    } catch {
      return null
    }
  }

  let hostname = entry.sourceContext?.hostname?.trim() ?? entry.hostname?.trim() ?? ""
  if (!hostname) {
    try {
      hostname = new URL(sanitizedUrl).hostname
    } catch {
      hostname = ""
    }
  }

  return {
    url: sanitizedUrl,
    hostname,
    title: entry.sourceContext?.pageTitle ?? entry.sourceContext?.ownedReadingTitle ?? entry.hostname ?? entry.text,
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
