import { useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry, VocabularyThemePackImportPreview } from "@/utils/storage/vocabulary"
import { buildLearningLoopAccountContinuityPopupSignInUrl, buildLearningLoopAccountContinuityProofMoment, LEARNING_LOOP_COMMERCIAL_SURFACE_COPY, recordLearningLoopEvent, type LearningLoopAccountContinuityAuthState } from "@/utils/learning-loop-events"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import {
  getVocabularyEntries,
  importVocabularyEntriesFromThemePackPayload,
  previewVocabularyEntriesFromThemePackPayload,
  removeVocabularyEntry,
  removeVocabularyEntries,
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
  setOwnedReadingUserControl,
  syncRecentReadingHistoryToOwnedQueue,
  verifyOwnedReadingThemePackPackage,
} from "@/utils/storage/owned-reading"
import { isTtsSupported, speak, stopSpeaking } from "@/utils/tts"
import { readConfig } from "@/utils/storage/config"
import { readAstraSession } from "@/utils/storage/auth"
import { buildLearningAssetProjection, buildLocalWeeklyDigestViewModel, type LocalWeeklyDigestViewModel } from "@/utils/storage/learning-assets"
import { buildLearningDataExport, stringifyLearningDataExport } from "@/utils/storage/learning-data-export"
import {
  buildLearningMemoryLibraryView,
  deleteLearningMemoryLibrarySources,
  setLearningMemoryLibrarySourceControls,
  type LearningMemoryLibraryDeleteMode,
  type LearningMemoryLibrarySourceActionRef,
  type LearningMemoryLibraryView,
} from "@/utils/storage/learning-memory-library"
import { forgetRememberedTerm, setPersonalizationEnabled, updateLearningProfile } from "@/utils/storage/learning-profile"
import { ASTRA_LIBRARY_ASSET_TYPES, type AstraLibraryAssetTypeId } from "@/utils/learning-library-experience"
import { translateTexts } from "@/utils/translate/translate"
import type { ExplainMode } from "@/types/config"
import { openPageInDeepRead, openVocabularyEntryInDeepRead } from "@/utils/deep-read-link"
import { openFocusedReview, openPageReviewLoop } from "@/utils/review-link"
import { buildSentenceShareCard, type AstraGrowthSharePayload } from "@/utils/share/sentence-card"
import ReviewMode from "./ReviewMode"
import { t } from "@/utils/i18n"

type ActiveTab = "list" | "review" | "reading" | "memory"
type ReadingSubTab = "recent" | "saved" | "in_progress"
type SortMode = "time" | "alpha"
type ReadingSortMode = "opened" | "title"
type LibrarySourceFilter = "all" | OwnedReadingItem["sourceType"] | "video" | "sample" | "selection"
type LibraryAssetCoverageStatus = "ready" | "empty" | "deferred"

const USER_SELECTED_SHARE_SENTENCE_MAX_LENGTH = 180

interface LibraryAssetCoverageRow {
  id: AstraLibraryAssetTypeId
  label: string
  count: number
  status: LibraryAssetCoverageStatus
  statusLabel: string
  hint: string
  storageBoundary: string
}

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

function compactShareSentenceText(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function getUserSelectedShareSentence(entry: VocabularyEntry): string | null {
  const sentence = compactShareSentenceText(entry.sourceContext?.sentenceText ?? entry.context)
  if (!sentence || sentence.length > USER_SELECTED_SHARE_SENTENCE_MAX_LENGTH) return null
  return sentence
}

function isLocalOrPrivateShareSource(entry: VocabularyEntry): boolean {
  const sourceUrl = entry.sourceContext?.pageUrl ?? entry.url ?? ""
  return /^(?:astra-local|file|blob|data|chrome-extension):/i.test(sourceUrl)
}

function getUserSelectedSentenceShareInput(entry: VocabularyEntry): { sentence: string; translation: string; sourceTitle?: string } | null {
  if (isLocalOrPrivateShareSource(entry)) return null
  const sentence = getUserSelectedShareSentence(entry)
  const translation = compactShareSentenceText(entry.translation)
  if (!sentence || !translation) return null
  const sourceTitle = compactShareSentenceText(entry.sourceContext?.pageTitle ?? entry.sourceContext?.ownedReadingTitle)
  return {
    sentence,
    translation,
    ...(sourceTitle ? { sourceTitle } : {}),
  }
}

async function shareGrowthPayload(payload: AstraGrowthSharePayload): Promise<"shared" | "copied" | "unavailable"> {
  const shareApi = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
    clipboard?: { writeText?: (value: string) => Promise<void> }
  }
  if (typeof shareApi.share === "function") {
    await shareApi.share(payload)
    return "shared"
  }
  if (typeof shareApi.clipboard?.writeText === "function") {
    await shareApi.clipboard.writeText(`${payload.text}\n${payload.url}`)
    return "copied"
  }
  return "unavailable"
}

function formatShareStatus(result: "shared" | "copied" | "unavailable"): string {
  switch (result) {
    case "shared":
      return "Sentence card opened in your share sheet."
    case "copied":
      return "Sentence card copied to clipboard."
    case "unavailable":
      return "Sentence card ready, but sharing is not available in this browser."
  }
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
  if (tab === "memory") return "memory"
  return "list"
}

function hasAstraCertificationParam(): boolean {
  try {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?", 2)[1] ?? "")
      : new URLSearchParams()
    return searchParams.get("astraCert") === "1" || hashParams.get("astraCert") === "1"
  } catch {
    return false
  }
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

const LIBRARY_SOURCE_FILTERS: LibrarySourceFilter[] = [
  "all",
  "article",
  "video",
  "pdf",
  "epub",
  "subtitle-file",
  "sample",
  "selection",
]

function getVocabularySourceFilterKey(entry: VocabularyEntry): LibrarySourceFilter {
  const ownedType = entry.sourceContext?.ownedReadingSourceType
  if (ownedType) return ownedType

  switch (entry.sourceContext?.surface) {
    case "video_transcript":
      return "video"
    case "subtitle_reader":
      return "subtitle-file"
    case "sample_lesson":
      return "sample"
    case "selection_toolbar":
    case "hover_translate":
      return "selection"
    case "popup_deep_read":
    case undefined:
      break
  }

  const url = entry.sourceContext?.pageUrl ?? entry.url ?? ""
  if (/\.pdf(?:[?#]|$)/i.test(url)) return "pdf"
  if (/\.epub(?:[?#]|$)/i.test(url)) return "epub"
  if (/subtitle|\.srt(?:[?#]|$)|\.vtt(?:[?#]|$)/i.test(url)) return "subtitle-file"
  if (/^https?:\/\//i.test(url) || entry.hostname || entry.sourceContext?.hostname) return "article"
  return "selection"
}

function getLibrarySourceFilterLabel(filter: LibrarySourceFilter): string {
  switch (filter) {
    case "all":
      return "All sources"
    case "article":
      return "Articles"
    case "video":
      return "Videos"
    case "pdf":
      return "PDFs"
    case "epub":
      return "EPUBs"
    case "subtitle-file":
      return "Subtitle files"
    case "sample":
      return "Sample lessons"
    case "selection":
      return "Selections"
  }
}

function countVocabularyEntriesBySourceFilter(entries: VocabularyEntry[], filter: LibrarySourceFilter): number {
  return entries.filter((entry) => getVocabularySourceFilterKey(entry) === filter).length
}

function countGlossaryBackedEntries(entries: VocabularyEntry[]): number {
  return entries.filter((entry) => (
    entry.glossaryEnabled
    || Boolean(entry.glossaryTargetText?.trim())
    || (entry.sourceContext?.matchedGlossaryTerms?.length ?? 0) > 0
  )).length
}

function getLibraryAssetCoverageCountLabel(id: AstraLibraryAssetTypeId, count: number, status: LibraryAssetCoverageStatus): string {
  if (status === "deferred") return "Planned"
  if (status === "empty") return "Not yet added"

  switch (id) {
    case "saved_pages":
    case "saved_videos":
    case "saved_files":
    case "reading_queue":
      return `${count} ${count === 1 ? "source" : "sources"}`
    case "saved_sentences":
      return `${count} ${count === 1 ? "sentence" : "sentences"}`
    case "saved_words":
      return `${count} ${count === 1 ? "word" : "words"}`
    case "video_notes":
      return `${count} ${count === 1 ? "note" : "notes"}`
    case "review_queue":
      return `${count} due`
    case "personal_glossary":
      return `${count} ${count === 1 ? "term" : "terms"}`
    case "learning_digest":
      return `${count} ${count === 1 ? "moment" : "moments"}`
  }
}

function buildLibraryAssetCoverageRows(params: {
  entries: VocabularyEntry[]
  readingItems: OwnedReadingItem[]
  dueCount: number
  weeklyDigest: LocalWeeklyDigestViewModel
}): LibraryAssetCoverageRow[] {
  const fileSourceCount = params.readingItems.filter((item) => item.sourceType === "pdf" || item.sourceType === "epub" || item.sourceType === "subtitle-file").length
  const videoEntryCount = countVocabularyEntriesBySourceFilter(params.entries, "video")
  const counts: Record<AstraLibraryAssetTypeId, number> = {
    saved_pages: params.readingItems.filter((item) => item.sourceType === "article").length || countVocabularyEntriesBySourceFilter(params.entries, "article"),
    saved_videos: videoEntryCount,
    saved_files: fileSourceCount || countVocabularyEntriesBySourceFilter(params.entries, "pdf") + countVocabularyEntriesBySourceFilter(params.entries, "epub") + countVocabularyEntriesBySourceFilter(params.entries, "subtitle-file"),
    saved_sentences: params.entries.filter((entry) => Boolean(entry.sourceContext?.sentenceText?.trim() || entry.context?.trim())).length,
    saved_words: params.entries.length,
    video_notes: params.entries.filter((entry) => entry.sourceContext?.surface === "video_transcript" && (entry.note?.trim() || typeof entry.sourceContext.videoTimestampMs === "number")).length,
    reading_queue: params.readingItems.length,
    review_queue: params.dueCount,
    personal_glossary: countGlossaryBackedEntries(params.entries),
    learning_digest: Math.max(params.weeklyDigest.reviewableLearningMoments, params.weeklyDigest.savedSnippetCount),
  }
  const deferredWhenEmpty = new Set<AstraLibraryAssetTypeId>(["saved_videos", "video_notes"])

  return ASTRA_LIBRARY_ASSET_TYPES.map((asset) => {
    const count = counts[asset.id]
    const status: LibraryAssetCoverageStatus = count > 0 ? "ready" : deferredWhenEmpty.has(asset.id) ? "deferred" : "empty"
    return {
      id: asset.id,
      label: asset.label,
      count,
      status,
      statusLabel: getLibraryAssetCoverageCountLabel(asset.id, count, status),
      hint: asset.userValue,
      storageBoundary: asset.defaultStorageBoundary,
    }
  })
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

function getLibraryHomeLatestEntryLabel(entries: Array<{ text: string; translation?: string; savedAt: number }>): string {
  const latestEntry = [...entries].sort((a, b) => b.savedAt - a.savedAt)[0] ?? null
  return latestEntry
    ? `${latestEntry.text}${latestEntry.translation ? ` → ${latestEntry.translation}` : ""}`
    : "Save a sentence from any article or supported video to start your library."
}

function getLibraryHomeSavedLabel(count: number): string {
  return `${count} saved ${count === 1 ? "item" : "items"}`
}

function getLibraryHomeDueLabel(dueCount: number): string {
  return dueCount > 0 ? `${dueCount} due today` : "All caught up"
}

function getLibraryHomeSourceLabel(recentCount: number): string {
  return recentCount > 0
    ? `${recentCount} learning ${recentCount === 1 ? "source" : "sources"}`
    : "No sources yet"
}

function buildPopupSignInDeepLinkUrl(): string {
  return buildLearningLoopAccountContinuityPopupSignInUrl((path) => browser.runtime.getURL(path as "/popup.html"))
}

function getCurrentLocalWeekWindow(now = Date.now()): { weekStartAt: number; weekEndAt: number } {
  const date = new Date(now)
  const day = date.getDay()
  const mondayOffset = (day + 6) % 7
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - mondayOffset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { weekStartAt: start.getTime(), weekEndAt: end.getTime() }
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
  const [certificationMode] = useState(hasAstraCertificationParam)
  const [readingSubTab, setReadingSubTab] = useState<ReadingSubTab>("recent")
  const [readingSortMode, setReadingSortMode] = useState<ReadingSortMode>("opened")
  const [readingItems, setReadingItems] = useState<OwnedReadingItem[]>([])
  const [linkedOwnedReadingItems, setLinkedOwnedReadingItems] = useState<OwnedReadingItem[]>([])
  const [readingLoading, setReadingLoading] = useState(() => getInitialTab() === "reading")
  const [entries, setEntries] = useState<VocabularyEntry[]>([])
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("time")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingReadingDeleteId, setPendingReadingDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountContinuityAuthState, setAccountContinuityAuthState] = useState<LearningLoopAccountContinuityAuthState | "unknown">("unknown")
  const [dueCount, setDueCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [activeSourceFilter, setActiveSourceFilter] = useState<LibrarySourceFilter>("all")
  const [readingArticleSummaries, setReadingArticleSummaries] = useState<Record<string, ReadingArticleSummary>>({})
  const [dailyPagesStudied, setDailyPagesStudied] = useState(0)
  const [dailySentencesExplained, setDailySentencesExplained] = useState(0)
  const [dailyVocabSaved, setDailyVocabSaved] = useState(0)
  const [dailyVocabReviewed, setDailyVocabReviewed] = useState(0)
  const [dailyStatsDate, setDailyStatsDate] = useState("")
  const [dailyStatsInfoOpen, setDailyStatsInfoOpen] = useState(false)
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null)
  const [explainingEntryId, setExplainingEntryId] = useState<string | null>(null)
  const [shareStatusByEntryId, setShareStatusByEntryId] = useState<Record<string, string>>({})
  const [themePackImportStatus, setThemePackImportStatus] = useState<string>("")
  const [pendingThemePackImport, setPendingThemePackImport] = useState<PendingThemePackImport | null>(null)
  const [memoryLibraryView, setMemoryLibraryView] = useState<LearningMemoryLibraryView | null>(null)
  const [selectedMemorySourceIds, setSelectedMemorySourceIds] = useState<string[]>([])
  const [expandedMemorySourceIds, setExpandedMemorySourceIds] = useState<string[]>([])
  const [memoryActionStatus, setMemoryActionStatus] = useState<string>("")
  const [pendingMemoryDeleteMode, setPendingMemoryDeleteMode] = useState<LearningMemoryLibraryDeleteMode | null>(null)
  const [confirmClearRememberedTerms, setConfirmClearRememberedTerms] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const librarySearchInputRef = useRef<HTMLInputElement | null>(null)
  const viewedWeeklyDigestKeysRef = useRef<Set<string>>(new Set())

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

  const loadMemoryLibrary = async () => {
    setLoading(true)
    const [data, due, progress, ownedItems, memoryView] = await Promise.all([
      getVocabularyEntries(),
      getDueVocabularyCount(),
      getStudyProgress(),
      listOwnedReadingItems(),
      buildLearningMemoryLibraryView(),
    ])
    setEntries(data)
    setReadingItems(ownedItems)
    setLinkedOwnedReadingItems(ownedItems)
    setDueCount(due)
    setDailyPagesStudied(progress.dailyStats.pagesStudied)
    setDailySentencesExplained(progress.dailyStats.sentencesExplained)
    setDailyVocabSaved(progress.dailyStats.vocabSaved)
    setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
    setDailyStatsDate(progress.dailyStats.date)
    setMemoryLibraryView(memoryView)
    setSelectedMemorySourceIds((current) => current.filter((id) => memoryView.sourceRows.some((row) => row.id === id)))
    setExpandedMemorySourceIds((current) => current.filter((id) => memoryView.sourceRows.some((row) => row.id === id)))
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
    if (activeTab === "memory") {
      void loadMemoryLibrary()
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
    const handleLibrarySearchShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target instanceof HTMLElement ? event.target : null
      const tagName = target?.tagName.toLowerCase()
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable) return

      event.preventDefault()
      setActiveTab("list")
      window.setTimeout(() => {
        librarySearchInputRef.current?.focus()
        librarySearchInputRef.current?.select()
      }, 0)
    }

    window.addEventListener("keydown", handleLibrarySearchShortcut)
    return () => window.removeEventListener("keydown", handleLibrarySearchShortcut)
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

  const sourceFilterCounts = new Map<LibrarySourceFilter, number>()
  sourceFilterCounts.set("all", entries.length)
  for (const entry of entries) {
    const key = getVocabularySourceFilterKey(entry)
    sourceFilterCounts.set(key, (sourceFilterCounts.get(key) ?? 0) + 1)
  }
  const sourceFilterOptions = LIBRARY_SOURCE_FILTERS
    .map((filter) => ({ filter, label: getLibrarySourceFilterLabel(filter), count: sourceFilterCounts.get(filter) ?? 0 }))
    .filter((option) => option.filter === "all" || option.count > 0 || option.filter === activeSourceFilter)

  const filtered = entries.filter((e) => {
    // Source filter
    if (activeSourceFilter !== "all" && getVocabularySourceFilterKey(e) !== activeSourceFilter) return false
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
  const weeklyDigest = buildLocalWeeklyDigestViewModel(
    buildLearningAssetProjection({
      vocabularyEntries: entries,
      ownedReadingItems: readingItems,
    }),
    getCurrentLocalWeekWindow(),
  )
  const libraryAssetCoverageRows = buildLibraryAssetCoverageRows({ entries, readingItems, dueCount, weeklyDigest })
  const weeklyDigestHasValue = weeklyDigest.savedSnippetCount > 0
    || weeklyDigest.reviewedCardCount > 0
    || weeklyDigest.sourceCount > 0
    || weeklyDigest.commonTopics.length > 0
    || weeklyDigest.repeatedVocabulary.length > 0
    || weeklyDigest.recommendedReviewCount > 0
  const weeklyDigestTelemetryMetadata = useMemo(() => ({
    reminderType: "weekly_digest",
    surface: "vocabulary_library",
    weekStartAt: weeklyDigest.weekStartAt,
    weekEndAt: weeklyDigest.weekEndAt,
    savedSnippetCount: weeklyDigest.savedSnippetCount,
    reviewedCardCount: weeklyDigest.reviewedCardCount,
    sourceCount: weeklyDigest.sourceCount,
    reviewableLearningMoments: weeklyDigest.reviewableLearningMoments,
    commonTopicCount: weeklyDigest.commonTopics.length,
    repeatedVocabularyCount: weeklyDigest.repeatedVocabulary.length,
    recommendedReviewCount: weeklyDigest.recommendedReviewCount,
    continueSourceType: weeklyDigest.recommendedContinueTarget?.type ?? "none",
  }), [
    weeklyDigest.weekStartAt,
    weeklyDigest.weekEndAt,
    weeklyDigest.savedSnippetCount,
    weeklyDigest.reviewedCardCount,
    weeklyDigest.sourceCount,
    weeklyDigest.reviewableLearningMoments,
    weeklyDigest.commonTopics.length,
    weeklyDigest.repeatedVocabulary.length,
    weeklyDigest.recommendedReviewCount,
    weeklyDigest.recommendedContinueTarget?.type,
  ])
  const weeklyDigestViewKey = [
    "weekly_digest",
    weeklyDigest.weekStartAt,
    weeklyDigest.weekEndAt,
  ].join(":")

  useEffect(() => {
    if (activeTab !== "list" || !weeklyDigestHasValue) return
    if (viewedWeeklyDigestKeysRef.current.has(weeklyDigestViewKey)) return
    viewedWeeklyDigestKeysRef.current.add(weeklyDigestViewKey)
    recordLearningLoopEvent("digest_viewed", weeklyDigestTelemetryMetadata)
  }, [activeTab, weeklyDigestHasValue, weeklyDigestTelemetryMetadata, weeklyDigestViewKey])

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

  const handleReadingUserControl = async (item: OwnedReadingItem, patch: Parameters<typeof setOwnedReadingUserControl>[1]) => {
    const currentControls = item.userControl ?? { syncEnabled: true, excludedFromDigest: false, privacyModeAtCapture: false }
    const newlyExcludedFromDigest = patch.excludedFromDigest === true && currentControls.excludedFromDigest !== true

    await setOwnedReadingUserControl(item.id, patch)
    if (newlyExcludedFromDigest) {
      recordLearningLoopEvent("reminder_disabled", {
        reminderType: "weekly_digest",
        controlScope: "source",
        surface: "vocabulary_reading_queue",
        sourceType: item.sourceType,
        status: item.status,
        privacyModeAtCapture: currentControls.privacyModeAtCapture === true,
      })
    }
    void commitLearningContinuitySync("vocabulary-owned-reading-user-control")
    void loadReadingQueue()
  }

  const handleRemoveReading = async (id: string, options: { deleteSavedCards?: boolean } = {}) => {
    const item = readingItems.find((row) => row.id === id)
    const linkedEntries = item ? getVocabularyEntriesForReadingItem(item, entries) : []
    if (options.deleteSavedCards) {
      await removeVocabularyEntries(linkedEntries.map((entry) => entry.id))
    }
    await removeOwnedReadingItem(id)
    setPendingReadingDeleteId(null)
    void commitLearningContinuitySync(options.deleteSavedCards ? "vocabulary-owned-reading-remove-cascade" : "vocabulary-owned-reading-remove")
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

  const getSelectedMemorySourceRefs = (): LearningMemoryLibrarySourceActionRef[] => {
    if (!memoryLibraryView) return []
    const selected = new Set(selectedMemorySourceIds)
    return memoryLibraryView.sourceRows
      .filter((row) => selected.has(row.id))
      .map((row) => row.actionRef)
  }

  const reloadMemoryLibrary = async (status?: string) => {
    await loadMemoryLibrary()
    if (status) setMemoryActionStatus(status)
  }

  const handleMemorySourceControl = async (patch: Parameters<typeof setLearningMemoryLibrarySourceControls>[1], status: string) => {
    const refs = getSelectedMemorySourceRefs()
    if (refs.length === 0) return
    const result = await setLearningMemoryLibrarySourceControls(refs, patch)
    await reloadMemoryLibrary(`${status} Updated ${result.updatedSourceControlCount} local source${result.updatedSourceControlCount === 1 ? "" : "s"}.`)
  }

  const handleMemoryDeleteSources = async (mode: LearningMemoryLibraryDeleteMode) => {
    const refs = getSelectedMemorySourceRefs()
    if (refs.length === 0) return
    const result = await deleteLearningMemoryLibrarySources(refs, mode)
    setPendingMemoryDeleteMode(null)
    setSelectedMemorySourceIds([])
    await reloadMemoryLibrary(
      mode === "source_and_saved_cards"
        ? `Deleted local source history and ${result.removedSavedCardCount} saved card${result.removedSavedCardCount === 1 ? "" : "s"}.`
        : "Removed selected local source history. Saved cards were kept.",
    )
  }

  const handleForgetRememberedTerm = async (termId: string) => {
    await forgetRememberedTerm(termId)
    await reloadMemoryLibrary("Forgot that remembered term on this device.")
  }

  const handleClearRememberedTerms = async () => {
    await updateLearningProfile({ rememberedTerms: [] })
    setConfirmClearRememberedTerms(false)
    await reloadMemoryLibrary("Cleared remembered terms on this device.")
  }

  const handleTurnOffPersonalization = async () => {
    await setPersonalizationEnabled(false)
    await reloadMemoryLibrary("Personalization memory is off on this device.")
  }

  const handleExportLearningData = async () => {
    try {
      const payload = await buildLearningDataExport()
      downloadFile(
        stringifyLearningDataExport(payload),
        `astra-learning-data-${new Date(payload.generatedAt).toISOString().slice(0, 10)}.json`,
        "application/json;charset=utf-8",
      )
      setMemoryActionStatus(`Exported local learning data: ${payload.summary.savedSnippetCount} saved snippet${payload.summary.savedSnippetCount === 1 ? "" : "s"} and ${payload.summary.reviewCardCount} review card${payload.summary.reviewCardCount === 1 ? "" : "s"}.`)
    } catch {
      setMemoryActionStatus("Local learning data export failed.")
    }
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

  const handleShareSentenceCard = async (entry: VocabularyEntry) => {
    const input = getUserSelectedSentenceShareInput(entry)
    if (!input) return

    const card = buildSentenceShareCard({
      ...input,
      contentOrigin: "user_selected",
    })
    recordLearningLoopEvent("share_card_created", {
      ...card.telemetry,
      source: "vocabulary",
      surface: "library",
      contentOrigin: "user_selected",
    })
    const result = await shareGrowthPayload(card.payload)
    setShareStatusByEntryId((current) => ({
      ...current,
      [entry.id]: formatShareStatus(result),
    }))
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
        serviceMode: config.serviceMode,
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
  const normalizedSearch = search.trim().toLowerCase()
  const sentenceSearchResults = normalizedSearch
    ? sorted.filter((entry) => [
      entry.sourceContext?.sentenceText,
      entry.context,
      entry.sourceContext?.articleExcerpt,
      entry.sourceContext?.contentSummary,
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedSearch))).slice(0, 5)
    : []
  const articleSearchResults = normalizedSearch
    ? readingItems.filter((item) => [
      item.title,
      item.sourceUrl,
      item.readingHistoryRecordId,
      item.studyProgressRecordId,
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedSearch))).slice(0, 5)
    : []
  const librarySearchStatus = normalizedSearch
    ? `Search active for “${search.trim()}”: ${sorted.length} saved word${sorted.length === 1 ? "" : "s"}, ${sentenceSearchResults.length} saved sentence match${sentenceSearchResults.length === 1 ? "" : "es"}, ${articleSearchResults.length} source title match${articleSearchResults.length === 1 ? "" : "es"}.`
    : `Showing ${sorted.length} saved item${sorted.length === 1 ? "" : "s"}. Press slash to search saved words, sentences, notes, tags, and source titles.`
  const selectedMemorySourceRows = memoryLibraryView?.sourceRows.filter((row) => selectedMemorySourceIds.includes(row.id)) ?? []
  const selectedMemorySourceCount = selectedMemorySourceRows.length

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
    <div className={`astra-library-shell${activeTab === "review" ? " astra-library-shell--review" : ""}${activeTab === "review" && certificationMode ? " astra-library-shell--review-cert" : ""}`} data-astra-theme="light" data-astra="quiet">
      <div className={`astra-library-grid${activeTab === "review" ? " astra-library-grid--review" : ""}`}>
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
            aria-selected={activeTab === "list" && !activeTagFilter && activeSourceFilter === "all"}
            onClick={() => {
              setActiveTab("list")
              setActiveTagFilter(null)
              setActiveSourceFilter("all")
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

          <div className="astra-eyebrow" style={{ padding: "16px 10px 4px" }}>
            Memory
          </div>
          <button
            type="button"
            className="astra-library-side-link"
            aria-selected={activeTab === "memory"}
            onClick={() => setActiveTab("memory")}
          >
            <span className="astra-library-side-link__icon" aria-hidden>◇</span>
            <span style={{ flex: 1 }}>What Astra remembers</span>
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
              ) : activeTab === "reading" ? (
                t("vocabulary_tabReading")
              ) : (
                "What Astra remembers"
              )}
              <span style={{ display: "none" }}>{t("vocabulary_title")}</span>
            </h1>
            <div className="astra-library-search">
              <span aria-hidden style={{ color: "var(--astra-style-ink-3)", fontSize: 13 }}>⌕</span>
              <input
                ref={librarySearchInputRef}
                type="text"
                placeholder={t("vocabulary_searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={`${t("vocabulary_searchPlaceholder")} Press slash to focus search.`}
                aria-describedby="library-search-status"
                data-testid="library-search-input"
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
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "memory"}
                className="astra-library-tab-pill"
                onClick={() => setActiveTab("memory")}
              >
                What Astra remembers
              </button>
            </div>
            <span style={{ display: "none" }}>
              {formatMessage(t("vocabulary_countBadge"), entries.length, entries.length === 1 ? t("vocabulary_countWordSingular") : t("vocabulary_countWordPlural"))}
            </span>
            <span id="library-search-status" role="status" aria-live="polite" data-testid="library-search-status" style={{ display: "none" }}>
              {librarySearchStatus}
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
          <section
            data-testid="library-home-summary-card"
            aria-label="Library home"
            style={{
              ...learningDeskCardStyle,
              background: "linear-gradient(135deg, var(--astra-style-bg-surface), var(--astra-bg-elevated))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
                  Library home
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.35, fontWeight: 800, color: "var(--astra-text-primary)", marginBottom: 4 }}>
                  Pick up the loop: learn, save, review.
                </div>
                <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
                  Your library now answers what you learned recently, what needs review, and where to continue next.
                </div>
              </div>
              <button type="button" style={{ ...learningDeskActionStyle, alignSelf: "flex-start" }} onClick={() => setActiveTab("reading")}>
                Continue learning
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  Recently learned
                </div>
                <div style={{ fontSize: 20, fontWeight: 850, color: "var(--astra-text-primary)", marginBottom: 4 }}>
                  {getLibraryHomeSavedLabel(entries.length)}
                </div>
                <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
                  {getLibraryHomeLatestEntryLabel(entries)}
                </div>
              </div>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  Review today
                </div>
                <div style={{ fontSize: 20, fontWeight: 850, color: dueCount > 0 ? "var(--astra-warning)" : "var(--astra-text-primary)", marginBottom: 4 }}>
                  {getLibraryHomeDueLabel(dueCount)}
                </div>
                <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("review")}>
                  {dueCount > 0 ? "Review now" : "Open review"}
                </button>
              </div>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  Continue learning
                </div>
                <div style={{ fontSize: 20, fontWeight: 850, color: "var(--astra-text-primary)", marginBottom: 4 }}>
                  {getLibraryHomeSourceLabel(readingCounts.recent)}
                </div>
                <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginBottom: 8 }}>
                  {featuredReadingItem?.title ?? (readingRows[0]?.item.title ?? "Add a reading source to continue learning.")}
                </div>
                <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("reading")}>
                  Open reading queue
                </button>
              </div>
            </div>
          </section>
          <section
            data-testid="library-weekly-digest-card"
            aria-label="Local weekly learning digest"
            style={{ ...learningDeskCardStyle, marginTop: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
                  Weekly digest · local
                </div>
                <div style={{ fontSize: 17, lineHeight: 1.35, fontWeight: 800, color: "var(--astra-text-primary)", marginBottom: 4 }}>
                  {weeklyDigest.headline}
                </div>
                <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
                  {weeklyDigest.detail}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <button
                  type="button"
                  style={{ ...learningDeskActionStyle, alignSelf: "flex-start" }}
                  onClick={() => {
                    recordLearningLoopEvent("digest_opened", weeklyDigestTelemetryMetadata)
                    setActiveTab("review")
                  }}
                >
                  {weeklyDigest.recommendedReviewCount > 0 ? `Review ${weeklyDigest.recommendedReviewCount}` : "Open review"}
                </button>
                {weeklyDigest.recommendedContinueTarget && (
                  <button
                    type="button"
                    style={{ ...learningDeskActionStyle, alignSelf: "flex-start", color: "var(--astra-text-secondary)" }}
                    onClick={() => {
                      recordLearningLoopEvent("continue_clicked", {
                        reminderType: "weekly_digest",
                        surface: "vocabulary_library",
                        sourceType: weeklyDigest.recommendedContinueTarget?.type ?? "unknown",
                      })
                      setActiveTab("reading")
                    }}
                  >
                    Continue source
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--astra-text-muted)", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Saved</div>
                <div style={{ fontSize: 20, fontWeight: 850 }}>{weeklyDigest.savedSnippetCount}</div>
              </div>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--astra-text-muted)", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Reviewed</div>
                <div style={{ fontSize: 20, fontWeight: 850 }}>{weeklyDigest.reviewedCardCount}</div>
              </div>
              <div style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--astra-text-muted)", fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Sources</div>
                <div style={{ fontSize: 20, fontWeight: 850 }}>{weeklyDigest.sourceCount}</div>
              </div>
            </div>
            {weeklyDigest.sourceBreakdown.length > 0 && (
              <div data-testid="library-weekly-digest-sources" style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {weeklyDigest.sourceBreakdown.map((source) => (
                  <div key={source.sourceContentId} style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
                    {source.title} · {source.savedSnippetCount} saved · {source.reviewedCardCount} reviewed
                  </div>
                ))}
              </div>
            )}
            {(weeklyDigest.commonTopics.length > 0 || weeklyDigest.repeatedVocabulary.length > 0 || weeklyDigest.recommendedContinueTarget) && (
              <div data-testid="library-weekly-digest-insights" style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {weeklyDigest.commonTopics.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
                    Common topics: {weeklyDigest.commonTopics.map((topic) => `${topic.label} (${topic.sourceCount})`).join(", ")}
                  </div>
                )}
                {weeklyDigest.repeatedVocabulary.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
                    Repeated vocabulary: {weeklyDigest.repeatedVocabulary.map((item) => `${item.surfaceText} across ${item.sourceCount} sources`).join(", ")}
                  </div>
                )}
                {weeklyDigest.recommendedContinueTarget && (
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
                    Continue: {weeklyDigest.recommendedContinueTarget.title} · {weeklyDigest.recommendedContinueTarget.lastPositionLabel}
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 10 }}>
              Privacy: this digest uses counts, source titles/types, coarse topics, and confirmed saved terms only — not page text, transcripts, or saved snippets.
            </div>
          </section>
          <section
            data-testid="library-asset-coverage-card"
            aria-label="Learning asset coverage"
            style={{ ...learningDeskCardStyle, marginTop: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
                  Learning asset coverage
                </div>
                <div style={{ fontSize: 14, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
                  All macro asset types are visible here, including not-yet-added or planned assets, so the Library feels like a learning trail instead of hidden storage.
                </div>
              </div>
              <button type="button" style={{ ...learningDeskActionStyle, alignSelf: "flex-start" }} onClick={() => setActiveTab("reading")}>
                Manage sources
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
              {libraryAssetCoverageRows.map((row) => (
                <div
                  key={row.id}
                  data-testid={`library-asset-coverage-${row.id}`}
                  data-status={row.status}
                  style={{
                    background: "var(--astra-bg-card)",
                    border: row.status === "ready" ? "1px solid var(--astra-success-border)" : "1px solid var(--astra-border)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    minHeight: 116,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 850, color: "var(--astra-text-primary)" }}>{row.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: row.status === "ready" ? "var(--astra-success)" : "var(--astra-text-muted)", whiteSpace: "nowrap" }}>
                      {row.statusLabel}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginBottom: 8 }}>
                    {row.hint}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.4 }}>
                    {row.storageBoundary}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 10 }}>
              Empty rows do not store content; they only explain what will appear when you save it.
            </div>
          </section>
          <section
            data-testid="library-source-map-card"
            aria-label="Library source organization"
            style={{ ...learningDeskCardStyle, marginTop: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
                  Source map
                </div>
                <div style={{ fontSize: 14, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
                  Astra automatically groups saved learning by source type so every card can stay connected to where it came from.
                </div>
              </div>
              {activeSourceFilter !== "all" && (
                <button type="button" style={sortButtonStyle(false)} onClick={() => setActiveSourceFilter("all")}>
                  Clear source filter
                </button>
              )}
            </div>
            <div role="group" aria-label="Filter saved items by source type" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sourceFilterOptions.map((option) => (
                <button
                  key={option.filter}
                  type="button"
                  data-testid={`library-source-filter-${option.filter}`}
                  aria-pressed={activeSourceFilter === option.filter}
                  aria-label={`${option.label}: ${option.count} saved item${option.count === 1 ? "" : "s"}`}
                  style={{
                    ...sortButtonStyle(activeSourceFilter === option.filter),
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                  onClick={() => {
                    setActiveTab("list")
                    setActiveSourceFilter(option.filter)
                  }}
                >
                  <span>{option.label}</span>
                  <span aria-label={`${option.count} saved item${option.count === 1 ? "" : "s"}`}>{option.count}</span>
                </button>
              ))}
            </div>
            {activeSourceFilter !== "all" && (
              <div data-testid="library-active-source-filter" style={{ fontSize: 12, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 10 }}>
                Showing {sourceFilterCounts.get(activeSourceFilter) ?? 0} saved item{(sourceFilterCounts.get(activeSourceFilter) ?? 0) === 1 ? "" : "s"} from {getLibrarySourceFilterLabel(activeSourceFilter).toLowerCase()}.
              </div>
            )}
          </section>
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
            <div role="group" aria-label="Filter saved items by tag" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {allTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  aria-pressed={activeTagFilter === tag}
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

          {search && (sorted.length > 0 || sentenceSearchResults.length > 0 || articleSearchResults.length > 0) && (
            <section className="astra-library-search-groups" aria-label="Grouped library search results">
              <div className="astra-eyebrow">Search results</div>
              {sorted.length > 0 && (
                <div className="astra-library-search-group">
                  <div className="astra-library-search-group__title">In saved words ({sorted.length})</div>
                  <div className="astra-library-search-group__chips">
                    {sorted.slice(0, 6).map((entry) => (
                      <button
                        type="button"
                        key={`word-result:${entry.id}`}
                        className="astra-library-search-chip"
                        onClick={() => setExpandedId(entry.id)}
                      >
                        <span className="astra-library-search-chip__word">{entry.text}</span>
                        {entry.translation && <span className="astra-library-search-chip__gloss">{entry.translation}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sentenceSearchResults.length > 0 && (
                <div className="astra-library-search-group">
                  <div className="astra-library-search-group__title">In saved sentences ({sentenceSearchResults.length})</div>
                  {sentenceSearchResults.map((entry) => {
                    const sentence = entry.sourceContext?.sentenceText || entry.context || ""
                    return (
                      <button
                        type="button"
                        key={`sentence-result:${entry.id}`}
                        className="astra-library-search-sentence"
                        onClick={() => setExpandedId(entry.id)}
                      >
                        <span>{sentence}</span>
                        <span className="astra-library-search-sentence__meta">{entry.text} · {entry.hostname ?? entry.sourceContext?.hostname ?? "saved"}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {articleSearchResults.length > 0 && (
                <div className="astra-library-search-group">
                  <div className="astra-library-search-group__title">In article titles ({articleSearchResults.length})</div>
                  {articleSearchResults.map((item) => (
                    <button
                      type="button"
                      key={`article-result:${item.id}`}
                      className="astra-library-search-article"
                      onClick={() => void openReadingItem(item)}
                    >
                      <span>{item.title}</span>
                      <span className="astra-library-search-sentence__meta">{getOwnedReadingSourceTypeLabel(item.sourceType)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {sorted.length === 0 && (
            <div style={emptyStyle}>
              {search
                ? t("vocabulary_emptySearch")
                : t("vocabulary_emptyDefault")}
            </div>
          )}

          {sorted.length > 0 && (
            <div role="list" aria-label="Saved vocabulary items" data-testid="library-saved-items-list">
              {sorted.map((entry) => (
            <div key={entry.id} role="listitem" className="astra-library-saved-card" style={cardStyle}>
              {(() => {
                const sourceDisplay = deriveVocabularySourceDisplay(entry)
                const linkedReadingItem = matchOwnedReadingItemForVocabularyEntry(linkedOwnedReadingItems, entry)
                const linkedReadingResumeTarget = linkedReadingItem ? buildOwnedReadingResumeTarget(linkedReadingItem) : null
                const linkedReadingProgress = linkedReadingItem ? describeOwnedReadingProgress(linkedReadingItem) : null
                const isContextExpanded = expandedId === entry.id
                const snippet = sourceDisplay.snippet
                const snippetLong = snippet.length > 200
                const visibleSnippet = snippetLong && !isContextExpanded
                  ? `${snippet.slice(0, 200)}...`
                  : snippet
                const sentenceShareInput = getUserSelectedSentenceShareInput(entry)
                const shareStatus = shareStatusByEntryId[entry.id]

                return (
                  <>
              <button
                type="button"
                data-role="vocabulary-entry-card"
                data-entry-id={entry.id}
                className="astra-library-entry-summary"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                aria-expanded={expandedId === entry.id}
              >
                <span style={wordStyle}>{entry.text}</span>
                {entry.translation && (
                  <span style={translationStyle}>{entry.translation}</span>
                )}
                {sourceDisplay.surfaceLabel && (
                  <span className="astra-eyebrow" style={{ marginBottom: 4 }}>
                    {sourceDisplay.surfaceLabel}
                  </span>
                )}
                {sourceDisplay.sourceLabel && (
                  <span style={{ fontFamily: "Source Serif 4, Georgia, serif", fontStyle: "italic", fontSize: 13, color: "var(--astra-style-ink-2)", marginBottom: 4 }}>
                    {sourceDisplay.sourceLabel}
                  </span>
                )}
                {sourceDisplay.snippet && (
                  <span style={contextStyle}>
                    {visibleSnippet}
                  </span>
                )}
                {snippetLong && (
                  <span
                    className="astra-library-entry-summary__more"
                    aria-hidden="true"
                  >
                    {expandedId === entry.id ? t("vocabulary_contextShowLess") : t("vocabulary_contextShowMore")}
                  </span>
                )}
                {entry.note && expandedId !== entry.id && (
                  <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginBottom: 4 }}>
                    Note: {entry.note.length > 80 ? `${entry.note.slice(0, 80)}...` : entry.note}
                  </span>
                )}
                {(entry.tags ?? []).length > 0 && (
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
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
                  </span>
                )}
              </button>

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
                    {sentenceShareInput && (
                      <button
                        type="button"
                        data-testid={`vocab-share-sentence-card-${entry.id}`}
                        style={learningActionButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleShareSentenceCard(entry)
                        }}
                      >
                        Share sentence card
                      </button>
                    )}
                  </div>
                  {shareStatus && (
                    <div data-testid={`vocab-share-sentence-card-status-${entry.id}`} style={{ fontSize: 12, color: "var(--astra-text-muted)", marginBottom: 10 }}>
                      {shareStatus}
                    </div>
                  )}
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
            </div>
          )}
        </>
      )}

      {activeTab === "memory" && memoryLibraryView && (
        <>
          <section data-testid="memory-local-trust-card" style={{ ...learningDeskCardStyle, marginTop: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
              Local-only memory
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.35, fontWeight: 800, color: "var(--astra-text-primary)", marginBottom: 6 }}>
              What Astra remembers on this device
            </div>
            <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
              This Library view is local-only and user-owned. It shows titles, source types, hostnames, counts, coarse progress, and controls — not full page text, transcripts, prompts, model output, URL query strings, URL hashes, or sensitive URL parameters.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" data-testid="memory-export-learning-data" style={learningDeskActionStyle} onClick={() => void handleExportLearningData()}>
                Export local learning data
              </button>
              <button type="button" data-testid="memory-turn-off-personalization" style={sortButtonStyle(false)} onClick={() => void handleTurnOffPersonalization()}>
                Turn off personalization
              </button>
            </div>
            {memoryActionStatus && (
              <div role="status" data-testid="memory-action-status" style={{ ...metaStyle, marginTop: 10 }}>
                {memoryActionStatus}
              </div>
            )}
          </section>

          <section data-testid="memory-inventory-sections" aria-label="Local memory inventory" style={{ ...learningDeskCardStyle, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 10 }}>
              Memory inventory
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
              {memoryLibraryView.inventory.sections.map((section) => (
                <div key={section.id} data-testid={`memory-inventory-${section.id}`} style={{ background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <strong style={{ fontSize: 13 }}>{section.label}</strong>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-info)" }}>{section.count}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginBottom: 6 }}>
                    {section.description}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.4 }}>
                    {section.contentPolicy}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section data-testid="memory-remembered-terms" aria-label="Remembered terms" style={{ ...learningDeskCardStyle, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
                  Remembered terms
                </div>
                <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
                  Explicit term preferences saved locally for translation consistency.
                </div>
              </div>
              {memoryLibraryView.rememberedTerms.length > 0 && (
                confirmClearRememberedTerms ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <button type="button" data-testid="memory-clear-terms-confirm" style={confirmBtnStyle} onClick={() => void handleClearRememberedTerms()}>
                      Confirm clear terms
                    </button>
                    <button type="button" style={sortButtonStyle(false)} onClick={() => setConfirmClearRememberedTerms(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" data-testid="memory-clear-terms" style={deleteBtnStyle} onClick={() => setConfirmClearRememberedTerms(true)}>
                    Clear terms
                  </button>
                )
              )}
            </div>
            {memoryLibraryView.rememberedTerms.length === 0 ? (
              <div style={metaStyle}>No remembered terms on this device.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {memoryLibraryView.rememberedTerms.map((term) => (
                  <div key={term.id} data-testid={`memory-term-${term.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: "var(--astra-bg-card)", border: "1px solid var(--astra-border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-text-primary)" }}>{term.sourceTerm} → {term.preferredTerm}</div>
                      <div style={metaStyle}>{term.hostname ?? "global"} · {term.source}</div>
                    </div>
                    <button type="button" data-testid={`memory-forget-term-${term.id}`} style={deleteBtnStyle} onClick={() => void handleForgetRememberedTerm(term.id)}>
                      Forget term
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section data-testid="memory-source-timeline" aria-label="Per-source memory timeline" style={{ ...learningDeskCardStyle, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--astra-info)", marginBottom: 6 }}>
                  Per-source timeline
                </div>
                <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.5 }}>
                  Select sources for local-only controls. Timeline events are coarse counts and states only.
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--astra-text-muted)", alignSelf: "center" }}>
                {selectedMemorySourceCount} selected
              </div>
            </div>

            <div data-testid="memory-bulk-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button type="button" data-testid="memory-bulk-exclude-digest" style={sortButtonStyle(false)} disabled={selectedMemorySourceCount === 0} onClick={() => void handleMemorySourceControl({ excludedFromDigest: true }, "Excluded selected from digest.")}>
                Exclude selected from digest
              </button>
              <button type="button" data-testid="memory-bulk-disable-sync" style={sortButtonStyle(false)} disabled={selectedMemorySourceCount === 0} onClick={() => void handleMemorySourceControl({ syncEnabled: false }, "Disabled sync for selected.")}>
                Disable sync for selected
              </button>
              <button type="button" data-testid="memory-bulk-remove-history" style={deleteBtnStyle} disabled={selectedMemorySourceCount === 0} onClick={() => setPendingMemoryDeleteMode("source_history_only")}>
                Remove selected source history
              </button>
              <button type="button" data-testid="memory-bulk-delete-source-cards" style={deleteBtnStyle} disabled={selectedMemorySourceCount === 0} onClick={() => setPendingMemoryDeleteMode("source_and_saved_cards")}>
                Delete selected source + saved cards
              </button>
            </div>

            {pendingMemoryDeleteMode && (
              <div data-testid="memory-delete-confirmation" style={{ marginBottom: 12, padding: "10px 12px", background: "var(--astra-danger-bg)", border: "1px solid var(--astra-danger)", borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: "var(--astra-danger)", fontWeight: 800, marginBottom: 4 }}>
                  Confirm local deletion
                </div>
                <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginBottom: 8 }}>
                  {pendingMemoryDeleteMode === "source_and_saved_cards"
                    ? `This deletes selected local source history plus saved cards linked to ${selectedMemorySourceCount} source${selectedMemorySourceCount === 1 ? "" : "s"}.`
                    : `This removes selected local source history for ${selectedMemorySourceCount} source${selectedMemorySourceCount === 1 ? "" : "s"}; saved cards stay.`}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" data-testid="memory-confirm-delete" style={confirmBtnStyle} onClick={() => void handleMemoryDeleteSources(pendingMemoryDeleteMode)}>
                    Confirm
                  </button>
                  <button type="button" data-testid="memory-cancel-delete" style={sortButtonStyle(false)} onClick={() => setPendingMemoryDeleteMode(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {memoryLibraryView.sourceRows.length === 0 ? (
              <div style={emptyStyle}>No local source memory yet.</div>
            ) : (
              <div role="list" aria-label="Local source memory rows" style={{ display: "grid", gap: 10 }}>
                {memoryLibraryView.sourceRows.map((row) => {
                  const selected = selectedMemorySourceIds.includes(row.id)
                  const expanded = expandedMemorySourceIds.includes(row.id)
                  const controlText = `Sync: ${row.syncEnabled === null ? "not applicable" : row.syncEnabled ? "included" : "disabled"} · Digest: ${row.excludedFromDigest ? "excluded" : "included"}`
                  return (
                    <div key={row.id} role="listitem" data-testid={`memory-source-row-${row.id}`} style={{ background: "var(--astra-bg-card)", border: selected ? "1px solid var(--astra-brand)" : "1px solid var(--astra-border)", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1 }}>
                          <input
                            type="checkbox"
                            data-testid={`memory-select-source-${row.id}`}
                            checked={selected}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked
                              setSelectedMemorySourceIds((current) => checked
                                ? Array.from(new Set([...current, row.id]))
                                : current.filter((id) => id !== row.id))
                            }}
                          />
                          <span>
                            <span style={{ display: "block", fontSize: 14, fontWeight: 850, color: "var(--astra-text-primary)" }}>{row.title}</span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--astra-text-muted)", marginTop: 3 }}>{row.sourceTypeLabel}{row.hostname ? ` · ${row.hostname}` : ""} · {row.progressStatus.replace("_", " ")}</span>
                          </span>
                        </label>
                        <button type="button" data-testid={`memory-toggle-source-${row.id}`} style={sortButtonStyle(expanded)} onClick={() => {
                          setExpandedMemorySourceIds((current) => expanded ? current.filter((id) => id !== row.id) : [...current, row.id])
                        }}>
                          {expanded ? "Hide timeline" : "Show timeline"}
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "var(--astra-text-secondary)" }}>
                        <span>{row.savedCardCount} saved cards</span>
                        <span>{row.readingHistoryCount} history records</span>
                        <span>{row.sentencesExplained} explained</span>
                        <span>{row.vocabSaved} saved</span>
                        <span>{row.vocabReviewed} reviewed</span>
                        <span>{controlText}</span>
                      </div>
                      {expanded && (
                        <div data-testid={`memory-source-events-${row.id}`} style={{ marginTop: 10, padding: "8px 10px", background: "var(--astra-bg-elevated)", border: "1px solid var(--astra-border)", borderRadius: 8 }}>
                          {row.timeline.map((event) => (
                            <div key={event.id} style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>
                              <strong>{event.label}</strong>{event.occurredAt ? ` · ${formatDate(event.occurredAt)}` : ""}<br />
                              <span>{event.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
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
              const sourceControls = item.userControl ?? { syncEnabled: true, excludedFromDigest: false, privacyModeAtCapture: false }
              const linkedEntries = getVocabularyEntriesForReadingItem(item, entries)
              const pendingDelete = pendingReadingDeleteId === item.id

              return (
            <div key={item.id} className="astra-library-reading-row" style={cardStyle} data-testid={`reading-row-${item.id}`}>
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
                <div
                  data-testid={`reading-source-detail-${item.id}`}
                  style={{
                    marginBottom: 8,
                    padding: "8px 10px",
                    background: "var(--astra-bg-primary)",
                    border: "1px solid var(--astra-border)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                    Source detail
                  </div>
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45 }}>
                    Source type: {getOwnedReadingSourceTypeLabel(item.sourceType)} · Saved cards linked to this source: {linkedEntries.length}. Deleting a source can either keep those cards or remove them explicitly.
                  </div>
                  {linkedEntries.length > 0 && (
                    <ul data-testid={`reading-source-derived-cards-${item.id}`} style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 11, color: "var(--astra-text-secondary)" }}>
                      {linkedEntries.slice(0, 3).map((entry) => (
                        <li key={entry.id}>{entry.text}{entry.translation ? ` — ${entry.translation}` : ""}</li>
                      ))}
                      {linkedEntries.length > 3 && <li>+{linkedEntries.length - 3} more saved card(s)</li>}
                    </ul>
                  )}
                </div>
                <div
                  data-testid={`reading-source-controls-${item.id}`}
                  style={{
                    marginBottom: 8,
                    padding: "8px 10px",
                    background: "var(--astra-bg-elevated)",
                    border: "1px solid var(--astra-border)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
                    Source controls
                  </div>
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginBottom: 8 }}>
                    Sync: {sourceControls.syncEnabled ? "included" : "disabled"} · Digest: {sourceControls.excludedFromDigest ? "excluded" : "included"}. Delete source removes this queue row; saved cards stay until deleted from Saved words.
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      data-testid={`reading-toggle-sync-${item.id}`}
                      style={sortButtonStyle(!sourceControls.syncEnabled)}
                      onClick={() => void handleReadingUserControl(item, { syncEnabled: !sourceControls.syncEnabled })}
                    >
                      {sourceControls.syncEnabled ? "Disable sync" : "Enable sync"}
                    </button>
                    <button
                      type="button"
                      data-testid={`reading-toggle-digest-${item.id}`}
                      style={sortButtonStyle(sourceControls.excludedFromDigest)}
                      onClick={() => void handleReadingUserControl(item, { excludedFromDigest: !sourceControls.excludedFromDigest })}
                    >
                      {sourceControls.excludedFromDigest ? "Include in digest" : "Exclude from digest"}
                    </button>
                  </div>
                </div>
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
                  <button type="button" data-testid={`reading-delete-source-${item.id}`} style={deleteBtnStyle} onClick={() => setPendingReadingDeleteId(item.id)}>
                    Delete source
                  </button>
                </div>
                {pendingDelete && (
                  <div
                    data-testid={`reading-delete-source-confirm-${item.id}`}
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "var(--astra-danger-bg)",
                      border: "1px solid var(--astra-danger)",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--astra-danger)", fontWeight: 800, marginBottom: 4 }}>
                      Delete source metadata?
                    </div>
                    <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginBottom: 8 }}>
                      Choose whether to keep {linkedEntries.length} saved card{linkedEntries.length === 1 ? "" : "s"} linked to this source, or delete the source and its saved cards together.
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        data-testid={`reading-confirm-delete-source-only-${item.id}`}
                        style={sortButtonStyle(false)}
                        onClick={() => void handleRemoveReading(item.id)}
                      >
                        Delete source only
                      </button>
                      <button
                        type="button"
                        data-testid={`reading-confirm-delete-source-cascade-${item.id}`}
                        style={confirmBtnStyle}
                        onClick={() => void handleRemoveReading(item.id, { deleteSavedCards: true })}
                      >
                        Delete source + saved cards
                      </button>
                      <button
                        type="button"
                        data-testid={`reading-cancel-delete-source-${item.id}`}
                        style={sortButtonStyle(false)}
                        onClick={() => setPendingReadingDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
