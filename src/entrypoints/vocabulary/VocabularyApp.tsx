import { useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry, VocabularyThemePackImportPreview } from "@/utils/storage/vocabulary"
import { buildLearningLoopAccountContinuityPopupSignInUrl, buildLearningLoopAccountContinuityProofMoment, LEARNING_LOOP_COMMERCIAL_SURFACE_COPY, recordLearningLoopEvent, type LearningLoopAccountContinuityAuthState } from "@/utils/learning-loop-events"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import {
  getVocabularyEntries,
  importVocabularyEntriesFromThemePackPayload,
  previewVocabularyEntriesFromThemePackPayload,
  removeVocabularyEntry,
  getDueVocabularyCount,
  updateVocabularyEntry,
} from "@/utils/storage/vocabulary"
import { deriveVocabularySourceDisplay, getPageReviewVocabularyEntries, normalizeVocabularyStudyUrl } from "@/utils/storage/vocabulary-core"
import { getReadingHistoryEntry } from "@/utils/storage/reading-history"
import {
  deriveStudyLoopPageSummary,
  getPageStudyProgress,
  getStudyProgress,
  type StudyLoopPageCounts,
  type StudyLoopPageSummary,
  type StudyPageProgress,
  type StudyStep,
} from "@/utils/storage/study-progress"
import type {
  OwnedReadingItem,
  OwnedReadingQueueView,
  OwnedReadingStatus,
  OwnedReadingThemePackPackageImportPreview,
  OwnedReadingThemePackPackagePayload,
} from "@/utils/storage/owned-reading"
import {
  buildOwnedReadingResumeTarget,
  buildSignedOwnedReadingThemePackPackage,
  buildOwnedReadingThemePacks,
  countOwnedReadingItemsByView,
  deriveOwnedReadingArticleUrl,
  describeOwnedReadingProgress,
  describeOwnedReadingResumeBehavior,
  filterOwnedReadingItemsByView,
  getOwnedReadingSourceTypeLabel,
  importOwnedReadingThemePackPackagePayload,
  previewOwnedReadingThemePackPackagePayload,
  listOwnedReadingItems,
  markOwnedReadingOpened,
  parseSignedOwnedReadingThemePackPackage,
  matchOwnedReadingItemForVocabularyEntry,
  removeOwnedReadingItem,
  setOwnedReadingStatus,
  syncRecentReadingHistoryToOwnedQueue,
  verifyOwnedReadingThemePackPackage,
} from "@/utils/storage/owned-reading"
import { isTtsSupported, speak, stopSpeaking } from "@/utils/tts"
import { readConfig } from "@/utils/storage/config"
import { readAstraSession } from "@/utils/storage/auth"
import { translateTexts } from "@/utils/translate/translate"
import type { ExplainMode } from "@/types/config"
import { openPageInDeepRead, openVocabularyEntryInDeepRead } from "@/utils/deep-read-link"
import { openFocusedReview, openPageReviewLoop } from "@/utils/review-link"
import ReviewMode from "./ReviewMode"
import { t } from "@/utils/i18n"

type ActiveTab = "list" | "review" | "reading"
type ReadingSubTab = "recent" | "saved" | "in_progress"
type SortMode = "time" | "alpha"
type ReadingSortMode = "opened" | "title"

function buildExplainModeSystemPrompt(explainMode: ExplainMode): string | undefined {
  switch (explainMode) {
    case "beginner":
      return "Explain the sentence like a patient beginner tutor. Prefer plain words, shorter sentences, and concrete meaning over abstract analysis."
    case "exam":
      return "Explain the sentence like an exam-prep coach. Focus on grammar structure, collocations, likely learner mistakes, and why the phrasing matters."
    case "deep":
      return "Explain the sentence like a deep reading coach. Focus on nuance, tone, intention, and how the wording works in context."
  }
}

function formatMessage(template: string, ...values: Array<string | number>): string {
  return values.reduce<string>(
    (message, value, index) => message.replace(`$${index + 1}`, String(value)),
    template,
  )
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateISO(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function escapeCSV(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportCSV(entries: VocabularyEntry[]): void {
  const header = "text,translation,context,url,savedAt"
  const rows = entries.map((e) =>
    [
      escapeCSV(e.text),
      escapeCSV(e.translation ?? ""),
      escapeCSV(e.context ?? ""),
      escapeCSV(e.url ?? ""),
      escapeCSV(formatDateISO(e.savedAt)),
    ].join(","),
  )
  const csv = [header, ...rows].join("\n")
  downloadFile(csv, "astra-vocabulary.csv", "text/csv;charset=utf-8")
}

function exportAnkiTSV(entries: VocabularyEntry[]): void {
  const rows = entries.map((e) => {
    const front = e.text
    const backParts = [e.translation ?? ""]
    if (e.context) {
      backParts.push(e.context)
    }
    const back = backParts.join("\\n")
    return `${front}\t${back}`
  })
  const tsv = rows.join("\n")
  downloadFile(tsv, "astra-vocabulary-anki.tsv", "text/tab-separated-values;charset=utf-8")
}

async function exportReadingThemePacksJSON(items: readonly OwnedReadingItem[], entries: readonly VocabularyEntry[]): Promise<void> {
  const payload = await buildSignedOwnedReadingThemePackPackage(items, entries)
  const json = JSON.stringify(payload, null, 2)
  downloadFile(json, `astra-reading-theme-pack-package-${formatDateISO(Date.now())}.json`, "application/json;charset=utf-8")
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function readLocalTextFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the selected file."))
    reader.readAsText(file)
  })
}

function getInitialTab(): ActiveTab {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab")
  if (tab === "review") return "review"
  if (tab === "reading") return "reading"
  return "list"
}

interface ReadingArticleSummary {
  pageUrl: string
  hostname: string
  wordsTranslated: number | null
  progress: StudyLoopPageSummary
}

interface ReadingPageReviewTarget {
  itemId: string
  studyUrl: string
  entryId?: string
  count: number
}

interface ReadingQueueReviewTarget {
  itemId: string
  mode: "page" | "focused"
  count: number
  entryId?: string
  studyUrl?: string
}

interface ReadingQueueRowModel {
  item: OwnedReadingItem
  formatBadgeLabel: string
  statusLabel: string
  openedLabel: string
  savedVocabularyCount: number
  savedVocabularyLabel: string
  resumeTarget: ReturnType<typeof buildOwnedReadingResumeTarget>
  resumeBehaviorLabel: string
  progressLabel: string | null
  articleSummary?: ReadingArticleSummary
  reviewTarget: ReadingQueueReviewTarget | null
  deepReadNextStepTarget: ReadingDeepReadNextStepTarget | null
}

interface ReadingDeepReadNextStepTarget {
  itemId: string
  pageUrl: string
  nextStep: Extract<StudyStep, "guided_read" | "explain" | "vocab_save">
}

interface PendingThemePackImport {
  generatedAt: string
  payload: OwnedReadingThemePackPackagePayload
  readingPreview: OwnedReadingThemePackPackageImportPreview
  vocabularyPreview: VocabularyThemePackImportPreview
}

function getReadingStepLabel(step: StudyStep): string {
  const labels: Record<StudyStep, string> = {
    read: "Read",
    guided_read: "Guided read",
    explain: "Explain",
    vocab_save: "Save words",
    vocab_review: "Review",
  }
  return labels[step]
}

function formatReadingStepTrail(steps: StudyStep[]): string {
  return steps.length > 0
    ? steps.map((step) => getReadingStepLabel(step)).join(" → ")
    : "No recorded steps yet"
}

function formatReadingCounts(counts: StudyLoopPageCounts): string {
  return `${counts.sentencesExplained} explained · ${counts.vocabSaved} saved · ${counts.vocabReviewed} reviewed`
}

function getReadingNextStepHint(step: StudyStep | null): string {
  switch (step) {
    case "read":
      return "Open the page and start reading or translating it again."
    case "guided_read":
      return "Run guided read once to rebuild sentence-level study context."
    case "explain":
      return "Explain a sentence from this page before saving more words."
    case "vocab_save":
      return "Save at least one useful word from this page."
    case "vocab_review":
      return "Review the saved card from this page to close the loop."
    default:
      return "Loop complete — reopen the page when you want more context."
  }
}

function formatWordsTranslated(wordsTranslated: number | null): string | null {
  if (wordsTranslated === null || wordsTranslated < 0) return null
  return `${wordsTranslated} ${wordsTranslated === 1 ? "word" : "words"} translated`
}

function formatSavedVocabularyCount(count: number): string {
  return count === 1 ? "Saved vocabulary: 1 card" : `Saved vocabulary: ${count} cards`
}

function getReadingFormatBadgeLabel(sourceType: OwnedReadingItem["sourceType"]): string {
  switch (sourceType) {
    case "article":
      return "Article"
    case "pdf":
      return "PDF"
    case "epub":
      return "EPUB"
    case "subtitle-file":
      return "Subtitle"
  }
}

function sortVocabularyEntriesForDocumentReview(entries: VocabularyEntry[]): VocabularyEntry[] {
  return [...entries].sort((a, b) => {
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

function getVocabularyEntriesForReadingItem(item: OwnedReadingItem, entries: VocabularyEntry[]): VocabularyEntry[] {
  return sortVocabularyEntriesForDocumentReview(
    entries.filter((entry) => matchOwnedReadingItemForVocabularyEntry([item], entry)?.id === item.id),
  )
}

function uniqueStudyUrlCandidates(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    const normalized = normalizeVocabularyStudyUrl(trimmed)
    if (!trimmed || !normalized || seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(trimmed)
  }
  return urls
}

function buildReadingPageReviewTarget(
  item: OwnedReadingItem,
  articleSummary: ReadingArticleSummary | undefined,
  entries: VocabularyEntry[],
): ReadingPageReviewTarget | null {
  if (item.sourceType !== "article" || articleSummary?.progress.nextStep !== "vocab_review") return null

  const studyUrls = uniqueStudyUrlCandidates([
    item.studyProgressRecordId,
    deriveOwnedReadingArticleUrl(item),
    articleSummary.pageUrl,
  ])

  for (const studyUrl of studyUrls) {
    const pageEntries = getPageReviewVocabularyEntries(entries, studyUrl)
    if (pageEntries.length > 0) {
      return {
        itemId: item.id,
        studyUrl,
        entryId: pageEntries[0]?.id,
        count: pageEntries.length,
      }
    }
  }

  return null
}

function buildReadingReviewTarget(
  item: OwnedReadingItem,
  articleSummary: ReadingArticleSummary | undefined,
  entries: VocabularyEntry[],
): ReadingQueueReviewTarget | null {
  const savedEntries = getVocabularyEntriesForReadingItem(item, entries)
  if (savedEntries.length === 0) return null

  const articlePageTarget = buildReadingPageReviewTarget(item, articleSummary, entries)
  if (articlePageTarget) {
    return { ...articlePageTarget, mode: "page" }
  }

  const linkedEntryIds = new Set(savedEntries.map((entry) => entry.id))
  const studyUrls = uniqueStudyUrlCandidates([
    item.studyProgressRecordId,
    item.localUri,
    item.sourceUrl,
    item.sourceType === "article" ? deriveOwnedReadingArticleUrl(item) : null,
    ...savedEntries.flatMap((entry) => [
      entry.sourceContext?.studyProgressRecordId,
      entry.sourceContext?.pageUrl,
      entry.url,
    ]),
  ])

  for (const studyUrl of studyUrls) {
    const pageEntries = getPageReviewVocabularyEntries(entries, studyUrl)
      .filter((entry) => linkedEntryIds.has(entry.id))
    if (pageEntries.length > 0) {
      return {
        itemId: item.id,
        mode: "page",
        studyUrl,
        entryId: pageEntries[0]?.id,
        count: pageEntries.length,
      }
    }
  }

  return {
    itemId: item.id,
    mode: "focused",
    entryId: savedEntries[0]?.id,
    count: savedEntries.length,
  }
}

function isDeepReadNextStep(step: StudyStep | null | undefined): step is ReadingDeepReadNextStepTarget["nextStep"] {
  return step === "guided_read" || step === "explain" || step === "vocab_save"
}

function buildReadingDeepReadNextStepTarget(
  item: OwnedReadingItem,
  articleSummary: ReadingArticleSummary | undefined,
): ReadingDeepReadNextStepTarget | null {
  if (item.sourceType !== "article" || !isDeepReadNextStep(articleSummary?.progress.nextStep)) return null

  const pageUrl = uniqueStudyUrlCandidates([
    articleSummary?.pageUrl,
    deriveOwnedReadingArticleUrl(item),
    item.studyProgressRecordId,
  ]).find((candidate) => /^https?:\/\//i.test(candidate))

  return pageUrl
    ? {
        itemId: item.id,
        pageUrl,
        nextStep: articleSummary.progress.nextStep,
      }
    : null
}

function buildReadingQueueRow(
  item: OwnedReadingItem,
  articleSummary: ReadingArticleSummary | undefined,
  entries: VocabularyEntry[],
): ReadingQueueRowModel {
  const savedVocabularyCount = getVocabularyEntriesForReadingItem(item, entries).length
  return {
    item,
    formatBadgeLabel: getReadingFormatBadgeLabel(item.sourceType),
    statusLabel: item.status.replace("_", " "),
    openedLabel: formatDate(item.openedAt),
    savedVocabularyCount,
    savedVocabularyLabel: formatSavedVocabularyCount(savedVocabularyCount),
    resumeTarget: buildOwnedReadingResumeTarget(item),
    resumeBehaviorLabel: describeOwnedReadingResumeBehavior(item),
    progressLabel: describeOwnedReadingProgress(item),
    articleSummary,
    reviewTarget: buildReadingReviewTarget(item, articleSummary, entries),
    deepReadNextStepTarget: buildReadingDeepReadNextStepTarget(item, articleSummary),
  }
}

function findStudyProgressPageForReadingItem(
  item: OwnedReadingItem,
  pages: StudyPageProgress[],
  pageUrl: string | null,
): StudyPageProgress | null {
  const candidates = new Set(uniqueStudyUrlCandidates([
    item.studyProgressRecordId,
    pageUrl,
  ]).map((value) => normalizeVocabularyStudyUrl(value)))

  if (candidates.size === 0) return null
  return pages.find((page) => candidates.has(normalizeVocabularyStudyUrl(page.url))) ?? null
}

function getReadingViewLabel(view: OwnedReadingQueueView): string {
  switch (view) {
    case "recent":
      return "Recent"
    case "saved":
      return "Saved"
    case "in_progress":
      return "In progress"
  }
}

function getReadingViewHint(view: OwnedReadingQueueView): string {
  switch (view) {
    case "recent":
      return "Recent shows active queue items ordered by last opened. Archived rows stay hidden here."
    case "saved":
      return "Saved keeps items you want easy access to later."
    case "in_progress":
      return "In progress highlights items you are still actively working through."
  }
}

function getLearningDeskHeadline(params: {
  dueCount: number
  inProgressCount: number
  savedCount: number
}): string {
  if (params.dueCount > 0) {
    return `You have ${params.dueCount} card${params.dueCount === 1 ? "" : "s"} ready to review.`
  }
  if (params.inProgressCount > 0) {
    return `You have ${params.inProgressCount} reading item${params.inProgressCount === 1 ? "" : "s"} in progress.`
  }
  if (params.savedCount > 0) {
    return `Your study queue is clear. Keep reading and save your next useful phrase.`
  }
  return "Start by saving vocabulary from any page, article, or reader surface."
}

function getLearningDeskHint(params: {
  dueCount: number
  inProgressCount: number
}): string {
  if (params.dueCount > 0) {
    return "Review first to keep the loop moving, then come back to your reading queue."
  }
  if (params.inProgressCount > 0) {
    return "Resume an active reading item and explain or save one more sentence."
  }
  return "Use Astra while reading and this space will turn into your daily study desk."
}

function buildPopupSignInDeepLinkUrl(): string {
  return buildLearningLoopAccountContinuityPopupSignInUrl((path) => browser.runtime.getURL(path as "/popup.html"))
}

function formatLocalDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function VocabularyApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab)
  const [readingSubTab, setReadingSubTab] = useState<ReadingSubTab>("recent")
  const [readingSortMode, setReadingSortMode] = useState<ReadingSortMode>("opened")
  const [readingItems, setReadingItems] = useState<OwnedReadingItem[]>([])
  const [linkedOwnedReadingItems, setLinkedOwnedReadingItems] = useState<OwnedReadingItem[]>([])
  const [readingLoading, setReadingLoading] = useState(() => getInitialTab() === "reading")
  const [entries, setEntries] = useState<VocabularyEntry[]>([])
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("time")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dueCount, setDueCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [readingArticleSummaries, setReadingArticleSummaries] = useState<Record<string, ReadingArticleSummary>>({})
  const [dailyPagesStudied, setDailyPagesStudied] = useState(0)
  const [dailySentencesExplained, setDailySentencesExplained] = useState(0)
  const [dailyVocabSaved, setDailyVocabSaved] = useState(0)
  const [dailyVocabReviewed, setDailyVocabReviewed] = useState(0)
  const [dailyStatsDate, setDailyStatsDate] = useState("")
  const [dailyStatsInfoOpen, setDailyStatsInfoOpen] = useState(false)
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null)
  const [explainingEntryId, setExplainingEntryId] = useState<string | null>(null)
  const [expandedContextEntryIds, setExpandedContextEntryIds] = useState<Set<string>>(() => new Set())
  const [accountContinuityAuthState, setAccountContinuityAuthState] = useState<LearningLoopAccountContinuityAuthState | "unknown">("unknown")
  const [themePackImportStatus, setThemePackImportStatus] = useState<string>("")
  const [pendingThemePackImport, setPendingThemePackImport] = useState<PendingThemePackImport | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const refreshAccountContinuityAuthState = async () => {
    try {
      const session = await readAstraSession()
      setAccountContinuityAuthState(session?.identityMode === "authenticated" ? "signed_in" : "signed_out")
    } catch {
      setAccountContinuityAuthState("signed_out")
    }
  }

  const loadEntries = async () => {
    const [data, due, progress, ownedItems] = await Promise.all([
      getVocabularyEntries(),
      getDueVocabularyCount(),
      getStudyProgress(),
      listOwnedReadingItems(),
    ])
    setEntries(data)
    setReadingItems(ownedItems)
    setLinkedOwnedReadingItems(ownedItems)
    const articleSummaryEntries = ownedItems.map((row) => {
      if (row.sourceType !== "article") return null
      const pageUrl = deriveOwnedReadingArticleUrl(row)
      const progressKey = row.studyProgressRecordId?.trim() || pageUrl
      const page = findStudyProgressPageForReadingItem(row, progress.pages, pageUrl)

      return [row.id, {
        pageUrl: pageUrl ?? progressKey ?? "",
        hostname: page?.hostname ?? "",
        wordsTranslated: null,
        progress: deriveStudyLoopPageSummary(page),
      }] as [string, ReadingArticleSummary]
    })
    setReadingArticleSummaries(Object.fromEntries(
      articleSummaryEntries.filter((entry): entry is [string, ReadingArticleSummary] => entry !== null),
    ))
    setDueCount(due)
    setDailyPagesStudied(progress.dailyStats.pagesStudied)
    setDailySentencesExplained(progress.dailyStats.sentencesExplained)
    setDailyVocabSaved(progress.dailyStats.vocabSaved)
    setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
    setDailyStatsDate(progress.dailyStats.date)
    setLoading(false)
  }

  const loadReadingQueue = async () => {
    setReadingLoading(true)
    await syncRecentReadingHistoryToOwnedQueue()
    void commitLearningContinuitySync("vocabulary-owned-reading-merge")
    const [items, data] = await Promise.all([
      listOwnedReadingItems(),
      getVocabularyEntries(),
    ])
    setEntries(data)
    setReadingItems(items)
    setLinkedOwnedReadingItems(items)

    const articleSummaryEntries = await Promise.all(items.map(async (row) => {
      if (row.sourceType !== "article") return null
      const pageUrl = deriveOwnedReadingArticleUrl(row)
      const progressKey = row.studyProgressRecordId?.trim() || pageUrl
      const [historyEntry, page] = await Promise.all([
        pageUrl ? getReadingHistoryEntry(pageUrl) : Promise.resolve(null),
        progressKey ? getPageStudyProgress(progressKey) : Promise.resolve(null),
      ])

      return [row.id, {
        pageUrl: pageUrl ?? progressKey ?? "",
        hostname: historyEntry?.hostname ?? page?.hostname ?? "",
        wordsTranslated: historyEntry?.wordsTranslated ?? null,
        progress: deriveStudyLoopPageSummary(page),
      }] as [string, ReadingArticleSummary]
    }))

    setReadingArticleSummaries(Object.fromEntries(
      articleSummaryEntries.filter((entry): entry is [string, ReadingArticleSummary] => entry !== null),
    ))
    setReadingLoading(false)
    setLoading(false)
  }

  useEffect(() => {
    if (activeTab === "reading") {
      void loadReadingQueue()
      return
    }
    void loadEntries()
  }, [activeTab])

  useEffect(() => {
    void refreshAccountContinuityAuthState()
    const refreshOnFocus = () => {
      void refreshAccountContinuityAuthState()
    }
    window.addEventListener("focus", refreshOnFocus)
    return () => window.removeEventListener("focus", refreshOnFocus)
  }, [])

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  const handleDelete = async (id: string) => {
    await removeVocabularyEntry(id)
    setConfirmDeleteId(null)
    await loadEntries()
  }

  const handleNoteChange = async (id: string, note: string) => {
    await updateVocabularyEntry(id, { note: note || undefined })
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note: note || undefined } : e))
  }

  const handleTagsChange = async (id: string, tagsStr: string) => {
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    await updateVocabularyEntry(id, { tags: tags.length > 0 ? tags : undefined })
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, tags: tags.length > 0 ? tags : undefined } : e))
  }

  // Collect all unique tags across entries for the filter chips
  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags ?? [])),
  ).sort()

  const filtered = entries.filter((e) => {
    // Tag filter
    if (activeTagFilter && !(e.tags ?? []).includes(activeTagFilter)) return false
    // Text search
    if (!search) return true
    const q = search.toLowerCase()
    const sc = e.sourceContext
    const sourceBlob = [
      sc?.pageTitle,
      sc?.sentenceText,
      sc?.articleExcerpt,
      sc?.contentSummary,
      e.url,
      e.hostname,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return (
      e.text.toLowerCase().includes(q)
      || (e.translation?.toLowerCase().includes(q) ?? false)
      || (e.context?.toLowerCase().includes(q) ?? false)
      || (e.explanation?.toLowerCase().includes(q) ?? false)
      || (e.note?.toLowerCase().includes(q) ?? false)
      || (e.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      || sourceBlob.includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "alpha") {
      return a.text.localeCompare(b.text)
    }
    return b.savedAt - a.savedAt
  })

  const readingCounts: Record<ReadingSubTab, number> = {
    recent: countOwnedReadingItemsByView(readingItems, "recent"),
    saved: countOwnedReadingItemsByView(readingItems, "saved"),
    in_progress: countOwnedReadingItemsByView(readingItems, "in_progress"),
  }

  const featuredReadingItem = [...filterOwnedReadingItemsByView(readingItems, "in_progress")]
    .sort((a, b) => b.openedAt - a.openedAt)[0] ?? [...filterOwnedReadingItemsByView(readingItems, "recent")]
      .sort((a, b) => b.openedAt - a.openedAt)[0] ?? null

  const readingFiltered = [...filterOwnedReadingItemsByView(readingItems, readingSubTab)]
    .sort((a, b) => {
      if (readingSortMode === "title") {
        return a.title.localeCompare(b.title)
      }
      return b.openedAt - a.openedAt
    })

  const readingRows = readingItems.map((item) => buildReadingQueueRow(item, readingArticleSummaries[item.id], entries))
  const readingRowsByItemId = new Map(readingRows.map((row) => [row.item.id, row]))
  const readingThemePacks = buildOwnedReadingThemePacks(readingItems)
  const readingPageReviewTargets = readingRows
    .map((row) => row.reviewTarget?.mode === "page" && row.reviewTarget.studyUrl ? row.reviewTarget : null)
    .filter((target): target is ReadingQueueReviewTarget & { mode: "page"; studyUrl: string } => target !== null)
  const learningDeskPageReviewTarget = [...readingPageReviewTargets]
    .sort((a, b) => {
      const aItem = readingItems.find((item) => item.id === a.itemId)
      const bItem = readingItems.find((item) => item.id === b.itemId)
      return (bItem?.openedAt ?? 0) - (aItem?.openedAt ?? 0)
    })[0] ?? null
  const readingDeepReadNextStepTargets = readingRows
    .map((row) => row.deepReadNextStepTarget)
    .filter((target): target is ReadingDeepReadNextStepTarget => target !== null)
  const learningDeskDeepReadNextStepTarget = [...readingDeepReadNextStepTargets]
    .sort((a, b) => {
      const aItem = readingItems.find((item) => item.id === a.itemId)
      const bItem = readingItems.find((item) => item.id === b.itemId)
      return (bItem?.openedAt ?? 0) - (aItem?.openedAt ?? 0)
    })[0] ?? null

  const hasDailyProgress =
    dailyPagesStudied > 0
    || dailySentencesExplained > 0
    || dailyVocabSaved > 0
    || dailyVocabReviewed > 0
  const dailyStatsLabel = dailyStatsDate ? formatLocalDayLabel(dailyStatsDate) : ""

  const learningDeskHeadline = getLearningDeskHeadline({
    dueCount,
    inProgressCount: readingCounts.in_progress,
    savedCount: entries.length,
  })
  const learningDeskHint = getLearningDeskHint({
    dueCount,
    inProgressCount: readingCounts.in_progress,
  })

  const openAccountContinuitySignIn = () => {
    void browser.tabs.create({ url: buildPopupSignInDeepLinkUrl() })
  }

  const openReadingReview = async (target: ReadingQueueReviewTarget) => {
    if (target.mode === "page" && target.studyUrl) {
      await openPageReviewLoop(target.studyUrl, target.entryId)
      return
    }
    if (target.entryId) {
      await openFocusedReview(target.entryId)
    }
  }

  const openReadingPageReview = async (target: ReadingQueueReviewTarget) => {
    await openReadingReview(target)
  }

  const openReadingDeepReadNextStep = async (target: ReadingDeepReadNextStepTarget) => {
    const item = readingItems.find((row) => row.id === target.itemId)
    if (item) {
      await markOwnedReadingOpened(item.id)
      void commitLearningContinuitySync("vocabulary-owned-reading-opened")
      recordLearningLoopEvent("resumed_reading", {
        ownedReadingItemId: item.id,
        pageUrl: target.pageUrl,
        sourceType: item.sourceType,
        source: "vocabulary",
      })
    }
    await openPageInDeepRead(target.pageUrl)
    void loadReadingQueue()
  }

  const openReadingItem = async (item: OwnedReadingItem) => {
    const target = buildOwnedReadingResumeTarget(item)
    if (!target) return

    await markOwnedReadingOpened(item.id)
    void commitLearningContinuitySync("vocabulary-owned-reading-opened")
    recordLearningLoopEvent("resumed_reading", {
      ownedReadingItemId: item.id,
      pageUrl: target.url,
      sourceType: item.sourceType,
      source: "vocabulary",
    })
    void browser.tabs.create({ url: target.url })
    void loadReadingQueue()
  }

  const handleReadingStatus = async (id: string, status: OwnedReadingStatus) => {
    await setOwnedReadingStatus(id, status)
    void commitLearningContinuitySync("vocabulary-owned-reading-status")
    void loadReadingQueue()
  }

  const handleRemoveReading = async (id: string) => {
    await removeOwnedReadingItem(id)
    void commitLearningContinuitySync("vocabulary-owned-reading-remove")
    void loadReadingQueue()
  }

  const handleExportReadingThemePacks = async () => {
    await exportReadingThemePacksJSON(readingItems, entries)
  }

  const handleImportReadingThemePack = () => {
    importInputRef.current?.click()
  }

  const handleImportReadingThemePackFile = async (file: File | null | undefined) => {
    if (!file) return
    setPendingThemePackImport(null)
    setThemePackImportStatus("Verifying theme-pack package signature…")
    try {
      const text = await readLocalTextFile(file)
      const signedPackage = parseSignedOwnedReadingThemePackPackage(text)
      const payload = await verifyOwnedReadingThemePackPackage(signedPackage)
      const [readingPreview, vocabularyPreview] = await Promise.all([
        previewOwnedReadingThemePackPackagePayload(payload),
        previewVocabularyEntriesFromThemePackPayload(payload),
      ])
      setPendingThemePackImport({
        generatedAt: signedPackage.generatedAt,
        payload,
        readingPreview,
        vocabularyPreview,
      })
      setThemePackImportStatus(
        `Signature verified. Preview ready: ${readingPreview.importedCount} reading item(s) and ${vocabularyPreview.importedCount} vocabulary entr${vocabularyPreview.importedCount === 1 ? "y" : "ies"} can be applied.`,
      )
    } catch (error) {
      setThemePackImportStatus(error instanceof Error ? error.message : "Theme-pack package import failed.")
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = ""
      }
    }
  }

  const handleApplyReadingThemePackImport = async () => {
    if (!pendingThemePackImport) return
    setThemePackImportStatus("Applying verified theme-pack package…")
    try {
      const [readingResult, vocabularyResult] = await Promise.all([
        importOwnedReadingThemePackPackagePayload(pendingThemePackImport.payload),
        importVocabularyEntriesFromThemePackPayload(pendingThemePackImport.payload),
      ])
      setPendingThemePackImport(null)
      setThemePackImportStatus(
        `Signature verified. Imported ${readingResult.importedCount} reading item(s) and ${vocabularyResult.importedCount} vocabulary entr${vocabularyResult.importedCount === 1 ? "y" : "ies"}.`,
      )
      void commitLearningContinuitySync("vocabulary-theme-pack-import")
      await loadReadingQueue()
    } catch (error) {
      setThemePackImportStatus(error instanceof Error ? error.message : "Theme-pack package import failed.")
    }
  }

  const handleCancelReadingThemePackImport = () => {
    setPendingThemePackImport(null)
    setThemePackImportStatus("Theme-pack package import canceled before local changes were applied.")
  }

  const handleSpeakEntry = async (entry: VocabularyEntry) => {
    if (speakingEntryId === entry.id) {
      stopSpeaking()
      setSpeakingEntryId(null)
      return
    }

    const config = await readConfig()
    const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
    if (!enabled) return

    const sourceSentence = entry.sourceContext?.sentenceText?.trim()
    const text = sourceSentence || entry.text.trim()
    if (!text) return

    stopSpeaking()
    const started = speak(text, {
      engine: config.tts.engine,
      voiceName: config.tts.voiceName,
      rate: config.tts.rate,
      pitch: config.tts.pitch,
      lang: config.targetLang,
      onEnd: () => setSpeakingEntryId(null),
      onError: () => setSpeakingEntryId(null),
    })

    setSpeakingEntryId(started ? entry.id : null)
  }

  const handleExplainEntry = async (entry: VocabularyEntry) => {
    const text = entry.sourceContext?.sentenceText?.trim() || entry.context?.trim() || entry.text.trim()
    if (!text || explainingEntryId) return

    const config = await readConfig()
    setExplainingEntryId(entry.id)
    try {
      const result = await translateTexts({
        texts: [text],
        targetLang: config.targetLang,
        context: {
          pageTitle: entry.sourceContext?.pageTitle,
          pageUrl: entry.sourceContext?.pageUrl ?? entry.url,
          hostname: entry.sourceContext?.hostname ?? entry.hostname,
          contentSummary: entry.sourceContext?.contentSummary,
          selectionContext: text,
        },
        task: "explain",
        customSystemPrompt: buildExplainModeSystemPrompt(config.explainMode),
      })

      if (!result.ok) return

      const explanation = result.translations[0]?.trim()
      if (!explanation) return

      await updateVocabularyEntry(entry.id, { explanation })
      setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, explanation } : item))
    } finally {
      setExplainingEntryId(null)
    }
  }

  const toggleExpandedContext = (entryId: string) => {
    setExpandedContextEntryIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  const containerStyle: React.CSSProperties = {
    margin: "0",
    padding: "0",
    fontFamily: "var(--astra-font)",
    color: "var(--astra-text-primary)",
    lineHeight: 1.5,
  }

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  }

  const countBadgeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--astra-brand)",
    background: "var(--astra-brand-muted)",
    borderRadius: 999,
    padding: "2px 10px",
  }

  const searchInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontFamily: "Source Serif 4, Georgia, serif",
    fontStyle: "italic",
    fontSize: 14,
    color: "var(--astra-style-ink-1)",
    background: "var(--astra-style-bg-surface)",
    border: "1px solid var(--astra-style-line-1)",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
  }

  const toolbarStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  }

  const sortButtonStyle = (active: boolean): React.CSSProperties => ({
    border: "1px solid",
    borderColor: active ? "var(--astra-brand)" : "var(--astra-border)",
    background: active ? "var(--astra-brand-muted)" : "var(--astra-bg-card)",
    color: active ? "var(--astra-brand)" : "var(--astra-text-muted)",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  })

  const exportButtonStyle: React.CSSProperties = {
    border: "1px solid var(--astra-border)",
    background: "var(--astra-bg-card)",
    color: "var(--astra-text-secondary)",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  }

  const learningActionButtonStyle: React.CSSProperties = {
    border: "1px solid var(--astra-info-border)",
    background: "var(--astra-info-bg)",
    color: "var(--astra-info)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }

  const cardStyle: React.CSSProperties = {
    borderBottom: "1px solid var(--astra-style-line-1)",
    padding: "16px 0",
    marginBottom: 0,
    background: "transparent",
  }

  const wordStyle: React.CSSProperties = {
    fontFamily: "Source Serif 4, Georgia, serif",
    fontSize: 22,
    fontWeight: 400,
    letterSpacing: "-0.012em",
    color: "var(--astra-style-ink-1)",
    marginBottom: 2,
  }

  const translationStyle: React.CSSProperties = {
    fontFamily: "Source Serif 4, Georgia, serif",
    fontStyle: "italic",
    fontSize: 14,
    color: "var(--astra-style-ink-2)",
    marginBottom: 6,
  }

  const contextStyle: React.CSSProperties = {
    fontFamily: "Source Serif 4, Georgia, serif",
    fontSize: 14,
    color: "var(--astra-style-ink-2)",
    fontStyle: "normal",
    marginBottom: 6,
    lineHeight: 1.5,
  }

  const metaRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  }

  const metaStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--astra-text-hint)",
  }

  const deleteBtnStyle: React.CSSProperties = {
    border: "none",
    background: "var(--astra-danger-bg)",
    color: "var(--astra-danger)",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }

  const confirmBtnStyle: React.CSSProperties = {
    border: "none",
    background: "var(--astra-danger)",
    color: "var(--astra-text-on-brand)",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }

  const emptyStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "48px 20px",
    color: "var(--astra-text-hint)",
    fontSize: 15,
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    borderBottom: active ? "2px solid var(--astra-brand)" : "2px solid var(--astra-clear)",
    background: "var(--astra-clear)",
    color: active ? "var(--astra-brand)" : "var(--astra-text-muted)",
    cursor: "pointer",
  })

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid var(--astra-border)",
    marginBottom: 20,
  }

  const learningDeskCardStyle: React.CSSProperties = {
    marginBottom: 18,
    padding: "18px 22px",
    background: "var(--astra-style-bg-surface)",
    border: "1px solid var(--astra-style-line-1)",
    borderRadius: 12,
    boxShadow: "var(--astra-style-shadow-sm)",
  }

  const learningDeskActionStyle: React.CSSProperties = {
    border: "1px solid var(--astra-info-border)",
    background: "var(--astra-bg-card)",
    color: "var(--astra-info)",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }

  const accountContinuityAuthHydrated = accountContinuityAuthState !== "unknown"
  const showListLoading = activeTab !== "reading" && (loading || !accountContinuityAuthHydrated)
  const showReadingLoading = activeTab === "reading" && (readingLoading || !accountContinuityAuthHydrated)
  const accountContinuityCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.accountContinuity
  const resolvedAccountContinuityAuthState: LearningLoopAccountContinuityAuthState = accountContinuityAuthState === "signed_in" ? "signed_in" : "signed_out"
  const isAccountContinuitySignedIn = accountContinuityAuthState === "signed_in"
  const vocabularyContinuityProofCounts = {
    dueReviewCount: dueCount,
    savedSentenceCount: entries.length,
    inProgressReadingCount: readingCounts.in_progress,
    pagesStudiedToday: dailyPagesStudied,
    sentencesExplainedToday: dailySentencesExplained,
    vocabSavedToday: dailyVocabSaved,
    vocabReviewedToday: dailyVocabReviewed,
  }
  const vocabularyListProofMoment = buildLearningLoopAccountContinuityProofMoment("vocabulary_list", vocabularyContinuityProofCounts, { authState: resolvedAccountContinuityAuthState })
  const vocabularyReviewProofMoment = buildLearningLoopAccountContinuityProofMoment("vocabulary_review", vocabularyContinuityProofCounts, { authState: resolvedAccountContinuityAuthState })
  const vocabularyReadingProofMoment = buildLearningLoopAccountContinuityProofMoment("vocabulary_reading", vocabularyContinuityProofCounts, { authState: resolvedAccountContinuityAuthState })
  const renderAccountContinuityProofCard = (testId: string, proofMoment: string) => (
    <div
      data-testid={testId}
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        background: "var(--astra-bg-elevated)",
        border: "1px solid var(--astra-border-strong)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {accountContinuityCopy.eyebrow}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
        {isAccountContinuitySignedIn ? accountContinuityCopy.connectedTitle : accountContinuityCopy.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginTop: 4, fontWeight: 700 }}>
        {proofMoment}
      </div>
      {isAccountContinuitySignedIn && (
        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 6 }}>
          {accountContinuityCopy.boundary}
        </div>
      )}
      {accountContinuityAuthHydrated && !isAccountContinuitySignedIn && (
        <>
          <button
            type="button"
            data-testid={`${testId}-sign-in-cta`}
            style={{ ...learningDeskActionStyle, width: "100%", marginTop: 8 }}
            onClick={openAccountContinuitySignIn}
          >
            {accountContinuityCopy.cta}
          </button>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 6 }}>
            {accountContinuityCopy.ctaHelper}
          </div>
        </>
      )}
    </div>
  )
  const recentReadingForRail = [...readingItems]
    .filter((item) => item.openedAt > 0 && item.status !== "archived")
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, 6)
  const sourceGroups = (() => {
    const counts = new Map<string, number>()
    for (const entry of entries) {
      const host = (entry.hostname ?? entry.sourceContext?.hostname ?? "").trim()
      if (!host) continue
      counts.set(host, (counts.get(host) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  })()

  if (showListLoading || showReadingLoading) {
    return (
      <div className="astra-library-shell" data-astra-theme="light" data-astra="quiet">
        <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--astra-style-ink-3)", fontStyle: "italic", fontFamily: "Source Serif 4, Georgia, serif" }}>
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="astra-library-shell" data-astra-theme="light" data-astra="quiet">
      <div className="astra-library-grid">
        {/* ========== SIDEBAR ========== */}
        <aside className="astra-library-sidebar" aria-label="Library navigation">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 14px" }}>
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "1.6px solid var(--astra-style-ink-1)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--astra-style-ink-1)" }} />
            </span>
            <span
              className="astra-serif"
              style={{
                fontSize: 18,
                letterSpacing: "-0.01em",
                fontWeight: 500,
                color: "var(--astra-style-ink-1)",
              }}
            >
              Astra
            </span>
          </div>

          <div className="astra-eyebrow" style={{ padding: "8px 10px 4px" }}>
            Words
          </div>
          <button
            type="button"
            className="astra-library-side-link"
            aria-selected={activeTab === "list" && !activeTagFilter}
            onClick={() => {
              setActiveTab("list")
              setActiveTagFilter(null)
            }}
          >
            <span className="astra-library-side-link__icon" aria-hidden>◫</span>
            <span style={{ flex: 1 }}>All saved</span>
            <span className="astra-library-side-link__count">{entries.length}</span>
          </button>
          <button
            type="button"
            className="astra-library-side-link"
            aria-selected={activeTab === "review"}
            onClick={() => setActiveTab("review")}
          >
            <span className="astra-library-side-link__icon" aria-hidden>◷</span>
            <span style={{ flex: 1 }}>Due today</span>
            <span className="astra-library-side-link__count">{dueCount}</span>
          </button>

          {allTags.length > 0 && (
            <>
              <div className="astra-eyebrow" style={{ padding: "16px 10px 4px" }}>
                By tag
              </div>
              {allTags.slice(0, 8).map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className="astra-library-side-link"
                  aria-selected={activeTagFilter === tag}
                  onClick={() => {
                    setActiveTab("list")
                    setActiveTagFilter(activeTagFilter === tag ? null : tag)
                  }}
                >
                  <span className="astra-library-side-link__icon" aria-hidden>#</span>
                  <span style={{ flex: 1 }}>{tag}</span>
                </button>
              ))}
            </>
          )}

          {sourceGroups.length > 0 && (
            <>
              <div className="astra-eyebrow" style={{ padding: "16px 10px 4px" }}>
                By source
              </div>
              {sourceGroups.map(([host, count]) => (
                <button
                  type="button"
                  key={host}
                  className="astra-library-side-link"
                  aria-selected={search === host}
                  onClick={() => {
                    setActiveTab("list")
                    setSearch(search === host ? "" : host)
                  }}
                >
                  <span className="astra-library-side-link__icon" aria-hidden>◯</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {host}
                  </span>
                  <span className="astra-library-side-link__count">{count}</span>
                </button>
              ))}
            </>
          )}

          <div className="astra-eyebrow" style={{ padding: "16px 10px 4px" }}>
            Pages
          </div>
          <button
            type="button"
            className="astra-library-side-link"
            aria-selected={activeTab === "reading"}
            onClick={() => setActiveTab("reading")}
          >
            <span className="astra-library-side-link__icon" aria-hidden>❑</span>
            <span style={{ flex: 1 }}>Reading queue</span>
            <span className="astra-library-side-link__count">{readingCounts.recent}</span>
          </button>
        </aside>

        {/* ========== MAIN COLUMN ========== */}
        <section className="astra-library-main">
          <header className="astra-library-main__header">
            <h1 className="astra-library-title">
              {activeTab === "list" ? (
                <>
                  All saved
                  <span className="astra-library-title__count"> · {entries.length}</span>
                </>
              ) : activeTab === "review" ? (
                t("vocabulary_tabReview")
              ) : (
                t("vocabulary_tabReading")
              )}
              <span style={{ display: "none" }}>{t("vocabulary_title")}</span>
            </h1>
            <div className="astra-library-search">
              <span aria-hidden style={{ color: "var(--astra-style-ink-3)", fontSize: 13 }}>⌕</span>
              <input
                type="text"
                placeholder={t("vocabulary_searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t("vocabulary_searchPlaceholder")}
              />
            </div>
            <div role="tablist" style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "list"}
                className="astra-library-tab-pill"
                onClick={() => setActiveTab("list")}
              >
                {t("vocabulary_tabList")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "review"}
                className="astra-library-tab-pill"
                onClick={() => setActiveTab("review")}
              >
                {dueCount > 0 ? t("vocabulary_tabReviewWithCount", String(dueCount)) : t("vocabulary_tabReview")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "reading"}
                className="astra-library-tab-pill"
                onClick={() => setActiveTab("reading")}
              >
                {t("vocabulary_tabReading")}
              </button>
            </div>
            <span style={{ display: "none" }}>
              {formatMessage(t("vocabulary_countBadge"), entries.length, entries.length === 1 ? t("vocabulary_countWordSingular") : t("vocabulary_countWordPlural"))}
            </span>
          </header>

          <div className="astra-library-main__body">

        {activeTab === "review" && (
          <>
            {accountContinuityAuthHydrated && renderAccountContinuityProofCard("vocabulary-review-continuity-proof", vocabularyReviewProofMoment)}
            <ReviewMode />
          </>
        )}

      {activeTab === "list" && (
        <>
          <div style={learningDeskCardStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
              {t("vocabulary_learningDeskTitle")}
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.35, fontWeight: 700, color: "var(--astra-text-primary)", marginBottom: 6 }}>
              {learningDeskHeadline}
            </div>
            <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", marginBottom: 12 }}>
              {learningDeskHint}
            </div>
            <div
              data-testid="vocabulary-continuity-nudge"
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: "var(--astra-bg-elevated)",
                border: "1px solid var(--astra-border-strong)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {accountContinuityCopy.eyebrow}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
                {isAccountContinuitySignedIn ? accountContinuityCopy.connectedTitle : accountContinuityCopy.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginTop: 4 }}>
                {isAccountContinuitySignedIn ? accountContinuityCopy.connectedSummary : accountContinuityCopy.bullets[0]}
              </div>
              <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 6 }}>
                {isAccountContinuitySignedIn ? accountContinuityCopy.bullets[2] : accountContinuityCopy.bullets[1]}
              </div>
              <div data-testid="vocabulary-account-continuity-proof-moment" style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginTop: 6, fontWeight: 700 }}>
                {vocabularyListProofMoment}
              </div>
              {isAccountContinuitySignedIn && (
                <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 6 }}>
                  {accountContinuityCopy.boundary}
                </div>
              )}
              {!isAccountContinuitySignedIn && (
                <>
                  <button
                    type="button"
                    data-testid="vocabulary-account-continuity-sign-in-cta"
                    style={{ ...learningDeskActionStyle, width: "100%", marginTop: 8 }}
                    onClick={openAccountContinuitySignIn}
                  >
                    {accountContinuityCopy.cta}
                  </button>
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 6 }}>
                    {accountContinuityCopy.ctaHelper}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 10, padding: "10px 12px", minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-muted)", marginBottom: 4 }}>{t("vocabulary_statDueReview")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: dueCount > 0 ? "var(--astra-warning)" : "var(--astra-text-primary)" }}>{dueCount}</div>
              </div>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 10, padding: "10px 12px", minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-muted)", marginBottom: 4 }}>{t("vocabulary_statInProgress")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--astra-text-primary)" }}>{readingCounts.in_progress}</div>
              </div>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 10, padding: "10px 12px", minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-muted)", marginBottom: 4 }}>{t("vocabulary_statSavedWords")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--astra-text-primary)" }}>{entries.length}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("review")}>
                {dueCount > 0 ? t("vocabulary_actionStartReviewWithCount", String(dueCount)) : t("vocabulary_actionOpenReview")}
              </button>
              <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("reading")}>
                {t("vocabulary_actionOpenReadingQueue")}
              </button>
              <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("list")}>
                {t("vocabulary_actionBrowseSaved")}
              </button>
            </div>
            {learningDeskPageReviewTarget && (
              <div data-testid="learning-desk-page-review-cta" style={{ marginTop: 12, padding: "10px 12px", background: "var(--astra-success-bg)", border: "1px solid var(--astra-success-border)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-success)", marginBottom: 4 }}>
                  {t("popup_studyPageSavedReviewTitle")}
                </div>
                <div style={{ fontSize: 12, color: "var(--astra-success)", lineHeight: 1.45, marginBottom: 8 }}>
                  {t("popup_studyPageSavedReviewHint", String(learningDeskPageReviewTarget.count))}
                </div>
                <button
                  type="button"
                  style={learningDeskActionStyle}
                  onClick={() => void openReadingPageReview(learningDeskPageReviewTarget)}
                >
                  {t("popup_studyPageSavedReviewAction")}
                </button>
              </div>
            )}
            {learningDeskDeepReadNextStepTarget && (
              <div data-testid="learning-desk-deep-read-next-step-cta" style={{ marginTop: 12, padding: "10px 12px", background: "var(--astra-info-bg)", border: "1px solid var(--astra-info-border)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-info)", marginBottom: 4 }}>
                  Continue next step in Deep Read
                </div>
                <div style={{ fontSize: 12, color: "var(--astra-info)", lineHeight: 1.45, marginBottom: 8 }}>
                  Next: {getReadingStepLabel(learningDeskDeepReadNextStepTarget.nextStep)}
                </div>
                <button
                  type="button"
                  style={learningDeskActionStyle}
                  onClick={() => void openReadingDeepReadNextStep(learningDeskDeepReadNextStepTarget)}
                >
                  Continue next step in Deep Read
                </button>
              </div>
            )}
            {featuredReadingItem && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-muted)", marginBottom: 4 }}>{t("vocabulary_continueReadingTitle")}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--astra-text-primary)", marginBottom: 4 }}>
                  {featuredReadingItem.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginBottom: 8 }}>
                  {describeOwnedReadingResumeBehavior(featuredReadingItem)}
                </div>
                <button
                  type="button"
                  style={learningDeskActionStyle}
                  onClick={() => void openReadingItem(featuredReadingItem)}
                >
                  {t("vocabulary_actionResumeReading")}
                </button>
              </div>
            )}
          </div>

          {hasDailyProgress && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                background: "var(--astra-bg-elevated)",
                border: "1px solid var(--astra-border)",
                borderRadius: 10,
              }}
              aria-label={t("review_todayProgressAria")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-text-secondary)" }}>
                  {t("popup_studyTodayStatsTitle")}
                </div>
                <button
                  type="button"
                  onClick={() => setDailyStatsInfoOpen((current) => !current)}
                  aria-expanded={dailyStatsInfoOpen}
                  className="astra-cursor-pointer"
                  style={{
                    border: "1px solid var(--astra-border-strong)",
                    background: "var(--astra-bg-card)",
                    color: "var(--astra-text-secondary)",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {t("popup_studyTodayStatsInfoAction")}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginBottom: 8 }}>
                {t("popup_studyTodayStatsHint", dailyStatsLabel || dailyStatsDate)}
              </div>
              {dailyStatsInfoOpen && (
                <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.6, marginBottom: 8 }}>
                  {t("popup_studyTodayStatsResetBoundary")}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", fontSize: 12, color: "var(--astra-text-muted)" }}>
                <span>{t("popup_studyStatPages", dailyPagesStudied.toString())}</span>
                <span>{t("popup_studyStatExplained", dailySentencesExplained.toString())}</span>
                <span>{t("popup_studyStatSaved", dailyVocabSaved.toString())}</span>
                <span>{t("popup_studyStatReviewed", dailyVocabReviewed.toString())}</span>
              </div>
            </div>
          )}
          <div style={toolbarStyle}>
            <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginRight: 4 }}>{t("vocabulary_sortLabel")}</span>
            <button
              type="button"
              style={sortButtonStyle(sortMode === "time")}
              onClick={() => setSortMode("time")}
            >
              {t("vocabulary_sortNewest")}
            </button>
            <button
              type="button"
              style={sortButtonStyle(sortMode === "alpha")}
              onClick={() => setSortMode("alpha")}
            >
              {t("vocabulary_sortAlpha")}
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              style={exportButtonStyle}
              onClick={() => exportCSV(sorted)}
              disabled={sorted.length === 0}
            >
              {t("vocabulary_exportCsv")}
            </button>
            <button
              type="button"
              style={exportButtonStyle}
              onClick={() => exportAnkiTSV(sorted)}
              disabled={sorted.length === 0}
            >
              {t("vocabulary_exportAnkiTsv")}
            </button>
          </div>

          {allTags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {allTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className="astra-cursor-pointer"
                  style={{
                    border: "1px solid",
                    borderColor: activeTagFilter === tag ? "var(--astra-brand)" : "var(--astra-border)",
                    background: activeTagFilter === tag ? "var(--astra-brand-muted)" : "var(--astra-bg-card)",
                    color: activeTagFilter === tag ? "var(--astra-brand)" : "var(--astra-text-muted)",
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {sorted.length === 0 && (
            <div style={emptyStyle}>
              {search
                ? t("vocabulary_emptySearch")
                : t("vocabulary_emptyDefault")}
            </div>
          )}

          {sorted.map((entry) => (
            <div key={entry.id} style={cardStyle}>
              {(() => {
                const sourceDisplay = deriveVocabularySourceDisplay(entry)
                const linkedReadingItem = matchOwnedReadingItemForVocabularyEntry(linkedOwnedReadingItems, entry)
                const linkedReadingResumeTarget = linkedReadingItem ? buildOwnedReadingResumeTarget(linkedReadingItem) : null
                const linkedReadingProgress = linkedReadingItem ? describeOwnedReadingProgress(linkedReadingItem) : null
                const isContextExpanded = expandedContextEntryIds.has(entry.id)
                const snippet = sourceDisplay.snippet
                const snippetLong = snippet.length > 200
                const visibleSnippet = snippetLong && !isContextExpanded
                  ? `${snippet.slice(0, 200)}...`
                  : snippet

                return (
                  <>
              <div
                data-role="vocabulary-entry-card"
                data-entry-id={entry.id}
                className="astra-cursor-pointer"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div style={wordStyle}>{entry.text}</div>
                {entry.translation && (
                  <div style={translationStyle}>{entry.translation}</div>
                )}
                {sourceDisplay.surfaceLabel && (
                  <div className="astra-eyebrow" style={{ marginBottom: 4 }}>
                    {sourceDisplay.surfaceLabel}
                  </div>
                )}
                {sourceDisplay.sourceLabel && (
                  <div style={{ fontFamily: "Source Serif 4, Georgia, serif", fontStyle: "italic", fontSize: 13, color: "var(--astra-style-ink-2)", marginBottom: 4 }}>
                    {sourceDisplay.sourceLabel}
                  </div>
                )}
                {sourceDisplay.snippet && (
                  <div style={contextStyle}>
                    {visibleSnippet}
                  </div>
                )}
                {snippetLong && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleExpandedContext(entry.id)
                    }}
                    className="astra-cursor-pointer"
                    style={{
                      border: "none",
                      background: "none",
                      color: "var(--astra-info)",
                      borderRadius: 0,
                      padding: 0,
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {isContextExpanded ? t("vocabulary_contextShowLess") : t("vocabulary_contextShowMore")}
                  </button>
                )}
                {entry.note && expandedId !== entry.id && (
                  <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginBottom: 4 }}>
                    Note: {entry.note.length > 80 ? `${entry.note.slice(0, 80)}...` : entry.note}
                  </div>
                )}
                {(entry.tags ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {entry.tags!.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          background: "var(--astra-brand-muted)",
                          color: "var(--astra-brand)",
                          borderRadius: 999,
                          padding: "1px 8px",
                          fontWeight: 500,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {expandedId === entry.id && (
                <div style={{ marginTop: 8, borderTop: "1px solid var(--astra-border)", paddingTop: 8 }}>
                  {(sourceDisplay.sourceContext?.pageTitle || sourceDisplay.sourceContext?.sentenceText || sourceDisplay.articleExcerpt || sourceDisplay.contentSummary || sourceDisplay.pageUrl || sourceDisplay.hostname) && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 10px",
                        background: "var(--astra-bg-elevated)",
                        border: "1px solid var(--astra-border)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-text-secondary)", marginBottom: 6 }}>
                        {t("vocabulary_sourceContextTitle")}
                      </div>
                      {sourceDisplay.sourceContext?.pageTitle && (
                        <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", fontWeight: 600, marginBottom: 4 }}>
                          {sourceDisplay.sourceContext.pageTitle}
                        </div>
                      )}
                      {sourceDisplay.hostname && (
                        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 4 }}>
                          {t("vocabulary_sourceHostLabel")} {sourceDisplay.hostname}
                        </div>
                      )}
                      {sourceDisplay.pageUrl && (
                        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 4, wordBreak: "break-all" }}>
                          {/^https?:\/\//i.test(sourceDisplay.pageUrl) ? t("vocabulary_sourceUrlLabel") : t("vocabulary_sourceFileLabel")} {sourceDisplay.pageUrl}
                        </div>
                      )}
                      {sourceDisplay.sourceContext?.sentenceText && (
                        <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>
                          {t("vocabulary_sourceSentenceLabel")} {sourceDisplay.sourceContext.sentenceText}
                        </div>
                      )}
                      {sourceDisplay.articleExcerpt && (
                        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 4 }}>
                          {t("vocabulary_sourceExcerptLabel")} {sourceDisplay.articleExcerpt}
                        </div>
                      )}
                      {sourceDisplay.contentSummary && (
                        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {t("vocabulary_sourceSummaryLabel")} {sourceDisplay.contentSummary}
                        </div>
                      )}
                    </div>
                  )}
                  {linkedReadingItem && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 10px",
                        background: "var(--astra-brand-muted)",
                        border: "1px solid var(--astra-brand-border)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                        {t("vocabulary_readingAssetTitle")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", fontWeight: 600, marginBottom: 4 }}>
                        {linkedReadingItem.title} · {getOwnedReadingSourceTypeLabel(linkedReadingItem.sourceType)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: linkedReadingProgress ? 4 : 8 }}>
                        {describeOwnedReadingResumeBehavior(linkedReadingItem)}
                      </div>
                      {linkedReadingProgress && (
                        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 8 }}>
                          {linkedReadingProgress}
                        </div>
                      )}
                      {linkedReadingResumeTarget && (
                        <button
                          type="button"
                          style={sortButtonStyle(false)}
                          onClick={(e) => {
                            e.stopPropagation()
                            void openReadingItem(linkedReadingItem)
                          }}
                        >
                          {t("vocabulary_actionResumeReadingAsset")}
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {entry.sourceContext?.surface === "popup_deep_read" && (
                      <button
                        type="button"
                        data-testid={`vocab-open-deep-read-${entry.id}`}
                        style={learningActionButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation()
                          void openVocabularyEntryInDeepRead(entry)
                        }}
                      >
                        {t("vocabulary_actionOpenDeepRead")}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid={`vocab-explain-entry-${entry.id}`}
                      style={learningActionButtonStyle}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleExplainEntry(entry)
                      }}
                    >
                      {explainingEntryId === entry.id ? t("actionExplaining") : t("actionExplain")}
                    </button>
                    <button
                      type="button"
                      data-testid={`vocab-speak-entry-${entry.id}`}
                      style={learningActionButtonStyle}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleSpeakEntry(entry)
                      }}
                    >
                      {speakingEntryId === entry.id
                        ? t("vocabulary_actionStopListening")
                        : (entry.sourceContext?.sentenceText ? t("vocabulary_actionListenSentence") : t("vocabulary_actionListenWord"))}
                    </button>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label htmlFor={`vocabulary-entry-${entry.id}-note`} style={{ fontSize: 12, fontWeight: 600, color: "var(--astra-text-secondary)", display: "block", marginBottom: 4 }}>
                      {t("vocabulary_noteLabel")}
                    </label>
                    <textarea
                      id={`vocabulary-entry-${entry.id}-note`}
                      style={{
                        width: "100%",
                        minHeight: 60,
                        padding: "6px 10px",
                        fontSize: 13,
                        color: "var(--astra-text-primary)",
                        background: "var(--astra-bg-input)",
                        border: "1px solid var(--astra-border)",
                        borderRadius: 6,
                        resize: "vertical",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      placeholder={t("vocabulary_notePlaceholder")}
                      defaultValue={entry.note ?? ""}
                      maxLength={1000}
                      onBlur={(e) => void handleNoteChange(entry.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`vocabulary-entry-${entry.id}-tags`} style={{ fontSize: 12, fontWeight: 600, color: "var(--astra-text-secondary)", display: "block", marginBottom: 4 }}>
                      {t("vocabulary_tagsLabel")}
                    </label>
                    <input
                      id={`vocabulary-entry-${entry.id}-tags`}
                      type="text"
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: 13,
                        color: "var(--astra-text-primary)",
                        background: "var(--astra-bg-input)",
                        border: "1px solid var(--astra-border)",
                        borderRadius: 6,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      placeholder={t("vocabulary_tagsPlaceholder")}
                      defaultValue={(entry.tags ?? []).join(", ")}
                      onBlur={(e) => void handleTagsChange(entry.id, e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={metaRowStyle}>
                <div style={metaStyle}>
                  {(() => {
                    const sourcePageUrl = /^https?:\/\//i.test(sourceDisplay.pageUrl) ? sourceDisplay.pageUrl.trim() : ""
                    return (
                      <>
                        {entry.hostname && (
                          <span>{entry.hostname} &middot; </span>
                        )}
                        {sourcePageUrl && (
                          <a
                            href={sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--astra-text-hint)", textDecoration: "underline" }}
                          >
                            source
                          </a>
                        )}
                        {sourcePageUrl && (
                          <>
                            {" · "}
                            <button
                              type="button"
                              data-testid={`vocab-open-source-${entry.id}`}
                              className="astra-cursor-pointer"
                              style={{
                                border: "none",
                                background: "none",
                                padding: 0,
                                color: "var(--astra-brand)",
                                textDecoration: "underline",
                                fontSize: "inherit",
                                fontFamily: "inherit",
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                recordLearningLoopEvent("returned_to_source", {
                                  pageUrl: sourcePageUrl,
                                  source: "vocabulary",
                                })
                                void browser.tabs.create({ url: sourcePageUrl })
                              }}
                            >
                              {t("review_openSourcePage")}
                            </button>
                          </>
                        )}
                        {(entry.hostname || sourcePageUrl) && <span> &middot; </span>}
                        <span>{formatDate(entry.savedAt)}</span>
                      </>
                    )
                  })()}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {confirmDeleteId === entry.id ? (
                    <>
                      <button
                        type="button"
                        style={confirmBtnStyle}
                        onClick={() => void handleDelete(entry.id)}
                      >
                        {t("vocabulary_deleteConfirm")}
                      </button>
                      <button
                        type="button"
                        style={{ ...deleteBtnStyle, color: "var(--astra-text-muted)", background: "var(--astra-bg-hover)" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        {t("vocabulary_deleteCancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      style={deleteBtnStyle}
                      onClick={() => setConfirmDeleteId(entry.id)}
                    >
                      {t("vocabulary_deleteAction")}
                    </button>
                  )}
                </div>
              </div>
                  </>
                )
              })()}
            </div>
          ))}
        </>
      )}

      {activeTab === "reading" && (
        <>
          <p style={{ fontSize: 13, color: "var(--astra-text-muted)", marginTop: 0, marginBottom: 8 }}>
            {t("vocabulary_readingIntro")}
          </p>
          <p style={{ fontSize: 12, color: "var(--astra-text-hint)", marginTop: 0, marginBottom: 16 }}>
            {getReadingViewHint(readingSubTab)}
          </p>
          {accountContinuityAuthHydrated && renderAccountContinuityProofCard("vocabulary-reading-continuity-proof", vocabularyReadingProofMoment)}
          <div style={{ ...toolbarStyle, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginRight: 4 }}>{t("vocabulary_viewLabel")}</span>
            <button
              type="button"
              data-testid="reading-view-recent"
              style={sortButtonStyle(readingSubTab === "recent")}
              onClick={() => setReadingSubTab("recent")}
            >
              {getReadingViewLabel("recent")} ({readingCounts.recent})
            </button>
            <button
              type="button"
              data-testid="reading-view-saved"
              style={sortButtonStyle(readingSubTab === "saved")}
              onClick={() => setReadingSubTab("saved")}
            >
              {getReadingViewLabel("saved")} ({readingCounts.saved})
            </button>
            <button
              type="button"
              data-testid="reading-view-in-progress"
              style={sortButtonStyle(readingSubTab === "in_progress")}
              onClick={() => setReadingSubTab("in_progress")}
            >
              {getReadingViewLabel("in_progress")} ({readingCounts.in_progress})
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginRight: 4 }}>{t("vocabulary_sortLabel")}</span>
            <button
              type="button"
              data-testid="reading-sort-opened"
              style={sortButtonStyle(readingSortMode === "opened")}
              onClick={() => setReadingSortMode("opened")}
            >
              {t("vocabulary_readingSortOpened")}
            </button>
            <button
              type="button"
              data-testid="reading-sort-title"
              style={sortButtonStyle(readingSortMode === "title")}
              onClick={() => setReadingSortMode("title")}
            >
              {t("vocabulary_readingSortTitle")}
            </button>
            <button
              type="button"
              data-testid="reading-theme-pack-export"
              style={exportButtonStyle}
              onClick={handleExportReadingThemePacks}
              disabled={readingThemePacks.length === 0}
            >
              Export signed theme pack ({readingThemePacks.length})
            </button>
            <button
              type="button"
              data-testid="reading-theme-pack-import"
              style={exportButtonStyle}
              onClick={handleImportReadingThemePack}
            >
              Import signed theme pack
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              data-testid="reading-theme-pack-import-input"
              style={{ display: "none" }}
              onChange={(event) => {
                void handleImportReadingThemePackFile(event.currentTarget.files?.[0])
              }}
            />
          </div>
          {themePackImportStatus && (
            <div data-testid="reading-theme-pack-import-status" style={{ ...metaStyle, marginBottom: 12 }}>
              {themePackImportStatus}
            </div>
          )}
          {pendingThemePackImport && (
            <div
              data-testid="reading-theme-pack-import-preview"
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: "var(--astra-bg-elevated)",
                border: "1px solid var(--astra-border-strong)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                Review signed package import
              </div>
              <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 8 }}>
                Package generated: {pendingThemePackImport.generatedAt}
              </div>
              <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                Reading preview: add {pendingThemePackImport.readingPreview.newCount}, update {pendingThemePackImport.readingPreview.updatedCount}, skip {pendingThemePackImport.readingPreview.skippedCount}.
              </div>
              <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                Vocabulary preview: add {pendingThemePackImport.vocabularyPreview.importedCount}, skip {pendingThemePackImport.vocabularyPreview.skippedCount}.
              </div>
              {(pendingThemePackImport.readingPreview.conflicts.length > 0 || pendingThemePackImport.vocabularyPreview.conflicts.length > 0) && (
                <div data-testid="reading-theme-pack-import-conflicts" style={{ fontSize: 11, color: "var(--astra-warning)", marginBottom: 6 }}>
                  Local conflicts: {pendingThemePackImport.readingPreview.conflicts.slice(0, 3).map((conflict) => `${conflict.action} ${conflict.title}`).join("; ")}
                  {pendingThemePackImport.readingPreview.conflicts.length > 0 && pendingThemePackImport.vocabularyPreview.conflicts.length > 0 ? "; " : ""}
                  {pendingThemePackImport.vocabularyPreview.conflicts.slice(0, 3).map((conflict) => `skip vocabulary ${conflict.text}`).join("; ")}
                </div>
              )}
              <div data-testid="reading-theme-pack-import-rollback-preview" style={{ fontSize: 11, color: "var(--astra-text-secondary)", marginBottom: 8 }}>
                Rollback preview: remove {pendingThemePackImport.readingPreview.rollback.removeCount} new reading item(s), restore {pendingThemePackImport.readingPreview.rollback.restoreCount} updated reading item(s), and remove {pendingThemePackImport.vocabularyPreview.rollback.removeCount} new vocabulary entr{pendingThemePackImport.vocabularyPreview.rollback.removeCount === 1 ? "y" : "ies"}.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  data-testid="reading-theme-pack-import-apply"
                  style={learningActionButtonStyle}
                  onClick={() => void handleApplyReadingThemePackImport()}
                >
                  Apply import
                </button>
                <button
                  type="button"
                  data-testid="reading-theme-pack-import-cancel"
                  style={sortButtonStyle(false)}
                  onClick={handleCancelReadingThemePackImport}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {readingFiltered.length === 0 ? (
            <div style={emptyStyle}>
              {readingSubTab === "recent"
                ? t("vocabulary_readingEmptyRecent")
                : readingSubTab === "saved"
                  ? t("vocabulary_readingEmptySaved")
                  : t("vocabulary_readingEmptyInProgress")}
            </div>
          ) : (
            readingFiltered.map((item) => {
              const row = readingRowsByItemId.get(item.id) ?? buildReadingQueueRow(item, readingArticleSummaries[item.id], entries)
              const articleSummary = row.articleSummary
              const translatedLabel = formatWordsTranslated(articleSummary?.wordsTranslated ?? null)
              const resumeTarget = row.resumeTarget
              const progressLabel = row.progressLabel
              const reviewTarget = row.reviewTarget
              const deepReadNextStepTarget = row.deepReadNextStepTarget

              return (
            <div key={item.id} style={cardStyle} data-testid={`reading-row-${item.id}`}>
                <div style={{ ...wordStyle, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{item.title}</span>
                  <span
                    data-testid={`reading-format-badge-${item.id}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--astra-brand-active)",
                      background: "var(--astra-brand-muted)",
                      border: "1px solid var(--astra-brand-border)",
                      borderRadius: 999,
                      padding: "1px 8px",
                      textTransform: "uppercase",
                    }}
                  >
                    {row.formatBadgeLabel}
                  </span>
                </div>
                <div style={{ ...metaStyle, marginBottom: 8 }}>
                  <span style={{ textTransform: "capitalize" }}>{row.statusLabel}</span>
                  {" · "}
                  <span>{row.openedLabel}</span>
                  {" · "}
                  <span>{getOwnedReadingSourceTypeLabel(item.sourceType)}</span>
                </div>
                <div
                  data-testid={`reading-saved-count-${item.id}`}
                  style={{ fontSize: 11, color: row.savedVocabularyCount > 0 ? "var(--astra-success)" : "var(--astra-text-muted)", marginBottom: 4, fontWeight: 700 }}
                >
                  {row.savedVocabularyLabel}
                </div>
                <div style={{ fontSize: 11, color: !resumeTarget ? "var(--astra-danger)" : resumeTarget.requiresFileSelection ? "var(--astra-warning)" : "var(--astra-info)", marginBottom: progressLabel ? 4 : 8, fontWeight: 600 }}>
                  Resume: {row.resumeBehaviorLabel}
                </div>
                {progressLabel && (
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 8 }}>
                    {progressLabel}
                  </div>
                )}
                {articleSummary && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: "8px 10px",
                      background: "var(--astra-bg-elevated)",
                      border: "1px solid var(--astra-border)",
                      borderRadius: 8,
                    }}
                  >
                    {articleSummary.hostname && (
                      <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", fontWeight: 600, marginBottom: 4 }}>
                        Host: {articleSummary.hostname}
                      </div>
                    )}
                    {articleSummary.pageUrl && (
                      <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 4, wordBreak: "break-all" }}>
                        Page: {articleSummary.pageUrl}
                      </div>
                    )}
                    {translatedLabel && (
                      <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 4 }}>
                        Translated: {translatedLabel}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                      Study loop: {formatReadingStepTrail(articleSummary.progress.completedSteps)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 4 }}>
                      Counts: {formatReadingCounts(articleSummary.progress.currentCounts)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--astra-info)", fontWeight: 600 }}>
                      Next: {getReadingNextStepHint(articleSummary.progress.nextStep)}
                    </div>
                  </div>
                )}
                <div style={{ ...metaRowStyle, marginTop: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button
                      type="button"
                      data-testid={`reading-resume-${item.id}`}
                      style={sortButtonStyle(false)}
                      onClick={() => void openReadingItem(item)}
                      disabled={!resumeTarget}
                    >
                      Resume
                    </button>
                    {reviewTarget && (
                      <button
                        type="button"
                        data-testid={reviewTarget.mode === "page" ? `reading-page-review-${item.id}` : `reading-focused-review-${item.id}`}
                        style={sortButtonStyle(false)}
                        onClick={() => void openReadingReview(reviewTarget)}
                      >
                        {t("popup_studyPageSavedReviewAction")}
                      </button>
                    )}
                    {deepReadNextStepTarget && (
                      <button
                        type="button"
                        data-testid={`reading-deep-read-next-step-${item.id}`}
                        style={sortButtonStyle(false)}
                        onClick={() => void openReadingDeepReadNextStep(deepReadNextStepTarget)}
                      >
                        Continue next step in Deep Read
                      </button>
                    )}
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void handleReadingStatus(item.id, "in_progress")}
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void handleReadingStatus(item.id, "saved")}
                    >
                      Saved
                    </button>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void handleReadingStatus(item.id, "archived")}
                    >
                      Archive
                    </button>
                  </div>
                  <button type="button" style={deleteBtnStyle} onClick={() => void handleRemoveReading(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            )})
          )}
        </>
      )}
          </div>
        </section>

        {/* ========== RIGHT RAIL ========== */}
        <aside className="astra-library-rail" aria-label="Reading history">
          <div className="astra-eyebrow" style={{ marginBottom: 12 }}>
            This month
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span className="astra-library-rail__bignum">
              {recentReadingForRail.length}
            </span>
            <span className="astra-library-rail__bignum-label">
              recent reads
            </span>
          </div>
          <div className="astra-library-rail__sub">
            {entries.length} saved · {dueCount} due
          </div>

          {recentReadingForRail.length > 0 && activeTab !== "reading" && (
            <>
              <div className="astra-eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>
                Recent reading
              </div>
              {recentReadingForRail.map((item) => {
                const dateLabel = item.openedAt
                  ? new Date(item.openedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "—"
                const linkedCount = entries.filter((entry) => matchOwnedReadingItemForVocabularyEntry([item], entry)?.id === item.id).length
                return (
                  <div key={item.id} className="astra-library-rail__article">
                    <div className="astra-library-rail__date">{dateLabel}</div>
                    <div>
                      <button
                        type="button"
                        className="astra-library-rail__article-title"
                        onClick={() => void openReadingItem(item)}
                        style={{
                          background: "transparent",
                          border: 0,
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        {item.title}
                      </button>
                      <div className="astra-library-rail__article-meta">
                        <span className="astra-eyebrow">
                          {(item.sourceUrl ? new URL(item.sourceUrl, "https://x").hostname.replace(/^www\./, "") : getReadingFormatBadgeLabel(item.sourceType))}
                        </span>
                        {linkedCount > 0 && (
                          <span className="astra-library-rail__article-words">+{linkedCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {learningDeskPageReviewTarget && (
            <div
              data-testid="learning-desk-page-review-rail-cta"
              style={{
                marginTop: 22,
                padding: "12px 14px",
                background: "var(--astra-style-success-bg)",
                border: "1px solid var(--astra-style-success-border)",
                borderRadius: 10,
              }}
            >
              <div className="astra-eyebrow" style={{ marginBottom: 4, color: "var(--astra-style-ok)" }}>
                Page review ready
              </div>
              <div style={{ fontSize: 12, color: "var(--astra-style-ok)", lineHeight: 1.45, marginBottom: 8, fontFamily: "Source Serif 4, Georgia, serif", fontStyle: "italic" }}>
                {t("popup_studyPageSavedReviewHint", String(learningDeskPageReviewTarget.count))}
              </div>
              <button
                type="button"
                style={learningDeskActionStyle}
                onClick={() => void openReadingPageReview(learningDeskPageReviewTarget)}
              >
                {t("popup_studyPageSavedReviewAction")}
              </button>
            </div>
          )}

          {accountContinuityAuthHydrated && !isAccountContinuitySignedIn && (
            <div
              data-testid="vocabulary-rail-continuity-card"
              style={{
                marginTop: 22,
                padding: "14px 16px",
                background: "var(--astra-style-bg-elevated)",
                border: "1px solid var(--astra-style-line-1)",
                borderRadius: 10,
              }}
            >
              <div className="astra-eyebrow" style={{ marginBottom: 4 }}>
                {accountContinuityCopy.eyebrow}
              </div>
              <div
                className="astra-serif"
                style={{ fontSize: 15, color: "var(--astra-style-ink-1)", lineHeight: 1.35, marginBottom: 6, letterSpacing: "-0.01em" }}
              >
                {accountContinuityCopy.title}
              </div>
              <div
                style={{
                  fontFamily: "Source Serif 4, Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 12,
                  color: "var(--astra-style-ink-2)",
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                {accountContinuityCopy.bullets[0]}
              </div>
              <button
                type="button"
                style={{ ...learningDeskActionStyle, width: "100%" }}
                onClick={openAccountContinuitySignIn}
              >
                {accountContinuityCopy.cta}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
