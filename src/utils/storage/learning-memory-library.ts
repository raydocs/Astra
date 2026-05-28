import { readConfig } from "./config"
import { buildLearningAssetProjection, sourceContentFromOwnedReadingItem, sourceContentFromVocabularyEntry, type LearningAssetProjection, type SourceContentType } from "./learning-assets"
import { buildLearningMemoryInventoryFromState, type LearningMemoryInventory } from "./learning-memory"
import { readLearningProfile, type LearningProfile, type LearningProfileRememberedTerm } from "./learning-profile"
import {
  deleteReadingHistoryEntry,
  getReadingHistory,
  sanitizeReadingHistoryUrl,
  type ReadingHistoryEntry,
} from "./reading-history"
import {
  getStudyProgress,
  replaceStudyProgressPages,
  type StudyPageProgress,
  type StudyProgressStore,
} from "./study-progress"
import {
  getVocabularyEntries,
  removeVocabularyEntries,
  type VocabularyEntry,
} from "./vocabulary"
import {
  getOwnedReadingSourceTypeLabel,
  listOwnedReadingItems,
  removeOwnedReadingItem,
  setOwnedReadingUserControl,
  type OwnedReadingItem,
  type OwnedReadingSourceType,
  type OwnedReadingUserControl,
} from "./owned-reading"

export type LearningMemoryLibraryDeleteMode = "source_history_only" | "source_and_saved_cards"

export interface LearningMemoryLibraryRememberedTerm {
  id: string
  sourceTerm: string
  preferredTerm: string
  hostname: string | null
  source: LearningProfileRememberedTerm["source"]
  updatedAt: string
}

export interface LearningMemoryLibraryTimelineEvent {
  id: string
  label: string
  detail: string
  occurredAt: number | null
}

export interface LearningMemoryLibrarySourceActionRef {
  sourceContentId: string | null
  ownedReadingItemId: string | null
  readingHistoryRecordIds: string[]
  studyProgressRecordIds: string[]
  vocabularyEntryIds: string[]
}

export interface LearningMemoryLibrarySourceRow {
  id: string
  title: string
  sourceType: SourceContentType | OwnedReadingSourceType | "unknown"
  sourceTypeLabel: string
  hostname: string | null
  savedCardCount: number
  readingHistoryCount: number
  studyProgressEventCount: number
  sentencesExplained: number
  vocabSaved: number
  vocabReviewed: number
  progressStatus: "new" | "in_progress" | "saved" | "reviewed" | "archived" | "unknown"
  progressPercent: number | null
  syncEnabled: boolean | null
  excludedFromDigest: boolean | null
  privacyModeAtCapture: boolean | null
  lastActivityAt: number | null
  timeline: LearningMemoryLibraryTimelineEvent[]
  /** Internal-only reference for local controls/deletion. Do not render or export. */
  actionRef: LearningMemoryLibrarySourceActionRef
}

export interface LearningMemoryLibraryView {
  schema: "astra-learning-memory-library.v1"
  generatedAt: string
  localOnly: true
  inventory: LearningMemoryInventory
  rememberedTerms: LearningMemoryLibraryRememberedTerm[]
  sourceRows: LearningMemoryLibrarySourceRow[]
  summary: {
    sourceCount: number
    rememberedTermCount: number
    savedCardCount: number
  }
  contentPolicy: {
    localOnly: true
    includesFullPageText: false
    includesFullTranscriptText: false
    includesPromptText: false
    includesModelOutput: false
    includesFullUrlPaths: false
    actionRefsAreInternal: true
    description: string
  }
}

export interface BuildLearningMemoryLibraryInput {
  generatedAt?: Date | string | number
  privacyMode?: boolean
  learningProfile: LearningProfile
  vocabularyEntries?: VocabularyEntry[]
  ownedReadingItems?: OwnedReadingItem[]
  readingHistory?: ReadingHistoryEntry[]
  studyProgress?: StudyProgressStore
  projection?: LearningAssetProjection
}

export interface LearningMemoryLibraryBulkActionResult {
  selectedCount: number
  updatedSourceControlCount: number
  removedSourceHistoryCount: number
  removedSavedCardCount: number
}

interface MutableSourceRow {
  sourceContentId: string | null
  title: string
  sourceType: LearningMemoryLibrarySourceRow["sourceType"]
  hostname: string | null
  savedCardIds: Set<string>
  readingHistoryRecordIds: Set<string>
  studyProgressRecordIds: Set<string>
  readingHistoryCount: number
  studyProgressEventCount: number
  sentencesExplained: number
  vocabSaved: number
  vocabReviewed: number
  progressStatus: LearningMemoryLibrarySourceRow["progressStatus"]
  progressPercent: number | null
  syncEnabled: boolean | null
  excludedFromDigest: boolean | null
  privacyModeAtCapture: boolean | null
  lastActivityAt: number | null
  timeline: LearningMemoryLibraryTimelineEvent[]
  ownedReadingItemId: string | null
}

function normalizeGeneratedAt(value: Date | string | number | undefined): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" || typeof value === "number") return new Date(value).toISOString()
  return new Date().toISOString()
}

function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function sourceTypeLabel(sourceType: LearningMemoryLibrarySourceRow["sourceType"]): string {
  switch (sourceType) {
    case "article":
    case "pdf":
    case "epub":
    case "subtitle-file":
      return getOwnedReadingSourceTypeLabel(sourceType)
    case "page":
      return "Page"
    case "video":
      return "Video"
    case "file":
      return "File"
    case "selection":
      return "Selection"
    case "input":
      return "Input"
    case "sample":
      return "Sample"
    case "unknown":
      return "Source"
  }
}

function coerceProgressStatus(value: string | undefined): LearningMemoryLibrarySourceRow["progressStatus"] {
  if (value === "new" || value === "in_progress" || value === "saved" || value === "reviewed" || value === "archived") return value
  return "unknown"
}

function sanitizeRecordId(value: string | null | undefined): string | null {
  const sanitized = sanitizeReadingHistoryUrl(value)
  return sanitized ?? null
}

function safeDisplayTitle(value: string | null | undefined, fallback = "Saved source"): string {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.hostname || fallback
    }
    if (parsed.protocol === "astra-local:") {
      return "Local source"
    }
  } catch {
    // Not URL-like; keep as ordinary page/source title.
  }
  return trimmed
}

function makeEmptySourceRow(params: {
  key: string
  sourceContentId?: string | null
  title?: string | null
  sourceType?: LearningMemoryLibrarySourceRow["sourceType"]
  hostname?: string | null
}): MutableSourceRow {
  return {
    sourceContentId: params.sourceContentId ?? null,
    title: safeDisplayTitle(params.title),
    sourceType: params.sourceType ?? "unknown",
    hostname: params.hostname?.trim().toLowerCase() || null,
    savedCardIds: new Set(),
    readingHistoryRecordIds: new Set(),
    studyProgressRecordIds: new Set(),
    readingHistoryCount: 0,
    studyProgressEventCount: 0,
    sentencesExplained: 0,
    vocabSaved: 0,
    vocabReviewed: 0,
    progressStatus: "unknown",
    progressPercent: null,
    syncEnabled: null,
    excludedFromDigest: null,
    privacyModeAtCapture: null,
    lastActivityAt: null,
    timeline: [],
    ownedReadingItemId: null,
  }
}

function touch(row: MutableSourceRow, timestamp: number | null | undefined): void {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return
  row.lastActivityAt = Math.max(row.lastActivityAt ?? 0, timestamp)
}

function addEvent(row: MutableSourceRow, event: LearningMemoryLibraryTimelineEvent): void {
  row.timeline.push(event)
  touch(row, event.occurredAt)
}

function mergeTitle(row: MutableSourceRow, title: string | null | undefined): void {
  const safeTitle = safeDisplayTitle(title, "")
  if (!safeTitle) return
  if (!row.title || row.title === "Saved source") row.title = safeTitle
}

function mergeHostname(row: MutableSourceRow, hostname: string | null | undefined): void {
  const trimmed = hostname?.trim().toLowerCase()
  if (trimmed && !row.hostname) row.hostname = trimmed
}

function getOrCreate(rows: Map<string, MutableSourceRow>, key: string, params: Parameters<typeof makeEmptySourceRow>[0]): MutableSourceRow {
  const existing = rows.get(key)
  if (existing) return existing
  const row = makeEmptySourceRow(params)
  rows.set(key, row)
  return row
}

function sourceKeyFromVocabularyEntry(entry: VocabularyEntry): { key: string; sourceContentId: string | null } {
  const linkedItemId = entry.sourceContext?.ownedReadingItemId?.trim()
  if (linkedItemId) return { key: `owned:${linkedItemId}`, sourceContentId: linkedItemId }
  const source = sourceContentFromVocabularyEntry(entry)
  if (source) return { key: `source:${source.id}`, sourceContentId: source.id }
  const hostname = entry.sourceContext?.hostname ?? entry.hostname
  if (hostname) return { key: `host:${hostname.trim().toLowerCase()}`, sourceContentId: null }
  return { key: `vocab:${entry.id}`, sourceContentId: null }
}

function keyForReadingHistory(entry: ReadingHistoryEntry, historyToOwnedKey: Map<string, string>): string {
  const recordId = sanitizeRecordId(entry.id || entry.url) ?? entry.id
  return historyToOwnedKey.get(recordId) ?? `history:${recordId}`
}

function keyForStudyPage(page: StudyPageProgress, studyToOwnedKey: Map<string, string>, historyToOwnedKey: Map<string, string>): string {
  const recordId = sanitizeRecordId(page.url) ?? page.url
  return studyToOwnedKey.get(recordId) ?? historyToOwnedKey.get(recordId) ?? `study:${recordId}`
}

function toPublicRow(row: MutableSourceRow, key: string): LearningMemoryLibrarySourceRow {
  const actionRef: LearningMemoryLibrarySourceActionRef = {
    sourceContentId: row.sourceContentId,
    ownedReadingItemId: row.ownedReadingItemId,
    readingHistoryRecordIds: [...row.readingHistoryRecordIds].sort(),
    studyProgressRecordIds: [...row.studyProgressRecordIds].sort(),
    vocabularyEntryIds: [...row.savedCardIds].sort(),
  }
  const actionKey = [
    actionRef.sourceContentId ?? "",
    actionRef.ownedReadingItemId ?? "",
    ...actionRef.readingHistoryRecordIds,
    ...actionRef.studyProgressRecordIds,
    ...actionRef.vocabularyEntryIds,
    key,
  ].join("|")

  return {
    id: `memsrc_${stableHash(actionKey)}`,
    title: safeDisplayTitle(row.title),
    sourceType: row.sourceType,
    sourceTypeLabel: sourceTypeLabel(row.sourceType),
    hostname: row.hostname,
    savedCardCount: row.savedCardIds.size,
    readingHistoryCount: row.readingHistoryCount,
    studyProgressEventCount: row.studyProgressEventCount,
    sentencesExplained: row.sentencesExplained,
    vocabSaved: row.vocabSaved,
    vocabReviewed: row.vocabReviewed,
    progressStatus: row.progressStatus,
    progressPercent: row.progressPercent,
    syncEnabled: row.syncEnabled,
    excludedFromDigest: row.excludedFromDigest,
    privacyModeAtCapture: row.privacyModeAtCapture,
    lastActivityAt: row.lastActivityAt,
    timeline: row.timeline
      .sort((left, right) => (right.occurredAt ?? 0) - (left.occurredAt ?? 0))
      .slice(0, 6),
    actionRef,
  }
}

function toRememberedTerm(term: LearningProfileRememberedTerm): LearningMemoryLibraryRememberedTerm {
  return {
    id: term.id,
    sourceTerm: term.sourceTerm,
    preferredTerm: term.preferredTerm,
    hostname: term.hostname ?? null,
    source: term.source,
    updatedAt: term.updatedAt,
  }
}

export function buildLearningMemoryLibraryViewFromState(input: BuildLearningMemoryLibraryInput): LearningMemoryLibraryView {
  const generatedAt = normalizeGeneratedAt(input.generatedAt)
  const vocabularyEntries = input.vocabularyEntries ?? []
  const ownedReadingItems = input.ownedReadingItems ?? []
  const readingHistory = input.readingHistory ?? []
  const studyProgress = input.studyProgress ?? { pages: [], dailyStats: { date: "", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 } }
  const projection = input.projection ?? buildLearningAssetProjection({
    vocabularyEntries,
    ownedReadingItems,
    targetLanguage: input.learningProfile.targetLang,
  })
  const inventory = buildLearningMemoryInventoryFromState({
    generatedAt,
    privacyMode: input.privacyMode,
    learningProfile: input.learningProfile,
    vocabularyEntries,
    ownedReadingItems,
    readingHistory,
    studyProgress,
    projection,
  })

  const rows = new Map<string, MutableSourceRow>()
  const historyToOwnedKey = new Map<string, string>()
  const studyToOwnedKey = new Map<string, string>()

  for (const item of ownedReadingItems) {
    const source = sourceContentFromOwnedReadingItem(item, input.learningProfile.targetLang)
    const key = `owned:${item.id}`
    const row = getOrCreate(rows, key, {
      key,
      sourceContentId: source.id,
      title: item.title,
      sourceType: item.sourceType,
      hostname: source.hostname ?? null,
    })
    row.ownedReadingItemId = item.id
    row.sourceContentId = source.id
    row.sourceType = item.sourceType
    row.progressStatus = coerceProgressStatus(item.status)
    row.progressPercent = typeof item.progress?.fraction === "number" ? Math.round(item.progress.fraction * 100) : row.progressPercent
    const controls = item.userControl ?? { syncEnabled: true, excludedFromDigest: false, privacyModeAtCapture: false }
    row.syncEnabled = controls.syncEnabled
    row.excludedFromDigest = controls.excludedFromDigest
    row.privacyModeAtCapture = controls.privacyModeAtCapture
    touch(row, item.updatedAt ?? item.openedAt)
    addEvent(row, {
      id: `owned:${item.id}:opened`,
      label: "Source saved locally",
      detail: `${getOwnedReadingSourceTypeLabel(item.sourceType)} · ${item.status.replace("_", " ")}`,
      occurredAt: item.openedAt,
    })
    const historyId = sanitizeRecordId(item.readingHistoryRecordId ?? item.sourceUrl)
    if (historyId) {
      historyToOwnedKey.set(historyId, key)
      row.readingHistoryRecordIds.add(historyId)
    }
    const studyId = sanitizeRecordId(item.studyProgressRecordId ?? item.sourceUrl)
    if (studyId) {
      studyToOwnedKey.set(studyId, key)
      row.studyProgressRecordIds.add(studyId)
    }
  }

  for (const entry of readingHistory) {
    const recordId = sanitizeRecordId(entry.id || entry.url) ?? entry.id
    const key = keyForReadingHistory(entry, historyToOwnedKey)
    const row = getOrCreate(rows, key, {
      key,
      sourceContentId: null,
      title: entry.title,
      sourceType: "page",
      hostname: entry.hostname,
    })
    mergeTitle(row, entry.title)
    mergeHostname(row, entry.hostname)
    if (row.sourceType === "unknown") row.sourceType = "page"
    row.readingHistoryRecordIds.add(recordId)
    row.readingHistoryCount += 1
    addEvent(row, {
      id: `history:${stableHash(recordId)}`,
      label: "Page translation activity",
      detail: `${entry.wordsTranslated} word${entry.wordsTranslated === 1 ? "" : "s"} translated`,
      occurredAt: entry.visitedAt,
    })
  }

  for (const page of studyProgress.pages) {
    const recordId = sanitizeRecordId(page.url) ?? page.url
    const key = keyForStudyPage(page, studyToOwnedKey, historyToOwnedKey)
    const row = getOrCreate(rows, key, {
      key,
      sourceContentId: null,
      title: page.title,
      sourceType: "page",
      hostname: page.hostname,
    })
    mergeTitle(row, page.title)
    mergeHostname(row, page.hostname)
    row.studyProgressRecordIds.add(recordId)
    row.studyProgressEventCount += page.completedSteps.length
    row.sentencesExplained += page.sentencesExplained
    row.vocabSaved += page.vocabSaved
    row.vocabReviewed += page.vocabReviewed
    if (row.progressStatus === "unknown") row.progressStatus = page.completedSteps.includes("vocab_review") ? "reviewed" : "in_progress"
    addEvent(row, {
      id: `study:${stableHash(recordId)}`,
      label: "Study loop progress",
      detail: `${page.completedSteps.length} step${page.completedSteps.length === 1 ? "" : "s"} · ${page.sentencesExplained} explained · ${page.vocabSaved} saved · ${page.vocabReviewed} reviewed`,
      occurredAt: page.lastActivityAt,
    })
  }

  for (const entry of vocabularyEntries) {
    const { key, sourceContentId } = sourceKeyFromVocabularyEntry(entry)
    const source = sourceContentFromVocabularyEntry(entry, input.learningProfile.targetLang)
    const row = getOrCreate(rows, key, {
      key,
      sourceContentId,
      title: entry.sourceContext?.ownedReadingTitle ?? entry.sourceContext?.pageTitle ?? source?.title ?? entry.hostname,
      sourceType: entry.sourceContext?.ownedReadingSourceType ?? source?.type ?? "unknown",
      hostname: entry.sourceContext?.hostname ?? entry.hostname ?? source?.hostname,
    })
    if (sourceContentId && !row.sourceContentId) row.sourceContentId = sourceContentId
    mergeTitle(row, entry.sourceContext?.ownedReadingTitle ?? entry.sourceContext?.pageTitle ?? source?.title)
    mergeHostname(row, entry.sourceContext?.hostname ?? entry.hostname ?? source?.hostname)
    if (row.sourceType === "unknown" && source?.type) row.sourceType = source.type
    row.savedCardIds.add(entry.id)
    if (row.progressStatus === "unknown") row.progressStatus = (entry.reviewCount ?? 0) > 0 ? "reviewed" : "saved"
    addEvent(row, {
      id: `vocab:${entry.id}`,
      label: "Saved review card",
      detail: "A user-saved vocabulary card is linked to this source.",
      occurredAt: entry.savedAt,
    })
  }

  for (const source of projection.sourceContents) {
    const key = rows.has(`source:${source.id}`) ? `source:${source.id}` : `projection:${source.id}`
    const row = getOrCreate(rows, key, {
      key,
      sourceContentId: source.id,
      title: source.title,
      sourceType: source.type,
      hostname: source.hostname ?? null,
    })
    row.sourceContentId = row.sourceContentId ?? source.id
    mergeTitle(row, source.title)
    mergeHostname(row, source.hostname)
    if (row.sourceType === "unknown") row.sourceType = source.type
    if (row.progressStatus === "unknown") row.progressStatus = source.progress.status
    row.progressPercent = row.progressPercent ?? source.progress.percent ?? null
    row.syncEnabled = row.syncEnabled ?? source.userControl.syncEnabled
    row.excludedFromDigest = row.excludedFromDigest ?? source.userControl.excludedFromDigest
    row.privacyModeAtCapture = row.privacyModeAtCapture ?? source.userControl.privacyModeAtCapture
    touch(row, source.lastStudiedAt ?? source.lastOpenedAt ?? source.createdAt)
  }

  const sourceRows = [...rows.entries()]
    .map(([key, row]) => toPublicRow(row, key))
    .filter((row) => row.savedCardCount > 0 || row.readingHistoryCount > 0 || row.studyProgressEventCount > 0 || row.actionRef.ownedReadingItemId)
    .sort((left, right) => (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0) || left.title.localeCompare(right.title))

  const rememberedTerms = input.learningProfile.rememberedTerms
    .map(toRememberedTerm)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return {
    schema: "astra-learning-memory-library.v1",
    generatedAt,
    localOnly: true,
    inventory,
    rememberedTerms,
    sourceRows,
    summary: {
      sourceCount: sourceRows.length,
      rememberedTermCount: rememberedTerms.length,
      savedCardCount: vocabularyEntries.length,
    },
    contentPolicy: {
      localOnly: true,
      includesFullPageText: false,
      includesFullTranscriptText: false,
      includesPromptText: false,
      includesModelOutput: false,
      includesFullUrlPaths: false,
      actionRefsAreInternal: true,
      description: "This local Library view shows titles, source types, hostnames, counts, coarse progress, and local controls only. It does not render full page text, transcripts, prompts, model output, URL query strings, URL hashes, or sensitive URL parameters. Internal action refs are for local deletion/control helpers only and must not be displayed or exported.",
    },
  }
}

export async function buildLearningMemoryLibraryView(options: { generatedAt?: Date | string | number } = {}): Promise<LearningMemoryLibraryView> {
  const [config, learningProfile, vocabularyEntries, ownedReadingItems, readingHistory, studyProgress] = await Promise.all([
    readConfig(),
    readLearningProfile(),
    getVocabularyEntries(),
    listOwnedReadingItems(),
    getReadingHistory(),
    getStudyProgress(),
  ])

  return buildLearningMemoryLibraryViewFromState({
    generatedAt: options.generatedAt,
    privacyMode: config.privacyMode,
    learningProfile,
    vocabularyEntries,
    ownedReadingItems,
    readingHistory,
    studyProgress,
  })
}

function uniqueActionRefs(refs: readonly LearningMemoryLibrarySourceActionRef[]): LearningMemoryLibrarySourceActionRef[] {
  const byKey = new Map<string, LearningMemoryLibrarySourceActionRef>()
  for (const ref of refs) {
    const normalized: LearningMemoryLibrarySourceActionRef = {
      sourceContentId: ref.sourceContentId,
      ownedReadingItemId: ref.ownedReadingItemId,
      readingHistoryRecordIds: Array.from(new Set(ref.readingHistoryRecordIds.map((id) => sanitizeRecordId(id) ?? id))).sort(),
      studyProgressRecordIds: Array.from(new Set(ref.studyProgressRecordIds.map((id) => sanitizeRecordId(id) ?? id))).sort(),
      vocabularyEntryIds: Array.from(new Set(ref.vocabularyEntryIds)).sort(),
    }
    const key = JSON.stringify(normalized)
    byKey.set(key, normalized)
  }
  return [...byKey.values()]
}

export async function setLearningMemoryLibrarySourceControls(
  refs: readonly LearningMemoryLibrarySourceActionRef[],
  patch: Partial<OwnedReadingUserControl>,
): Promise<LearningMemoryLibraryBulkActionResult> {
  const normalizedRefs = uniqueActionRefs(refs)
  const ownedReadingIds = Array.from(new Set(normalizedRefs.flatMap((ref) => ref.ownedReadingItemId ? [ref.ownedReadingItemId] : [])))
  await Promise.all(ownedReadingIds.map((id) => setOwnedReadingUserControl(id, patch)))
  return {
    selectedCount: normalizedRefs.length,
    updatedSourceControlCount: ownedReadingIds.length,
    removedSourceHistoryCount: 0,
    removedSavedCardCount: 0,
  }
}

export async function deleteLearningMemoryLibrarySources(
  refs: readonly LearningMemoryLibrarySourceActionRef[],
  mode: LearningMemoryLibraryDeleteMode,
): Promise<LearningMemoryLibraryBulkActionResult> {
  const normalizedRefs = uniqueActionRefs(refs)
  const ownedReadingIds = Array.from(new Set(normalizedRefs.flatMap((ref) => ref.ownedReadingItemId ? [ref.ownedReadingItemId] : [])))
  const readingHistoryRecordIds = Array.from(new Set(normalizedRefs.flatMap((ref) => ref.readingHistoryRecordIds)))
  const studyProgressRecordIds = new Set(normalizedRefs.flatMap((ref) => ref.studyProgressRecordIds))
  const vocabularyEntryIds = Array.from(new Set(normalizedRefs.flatMap((ref) => ref.vocabularyEntryIds)))

  await Promise.all([
    ...ownedReadingIds.map((id) => removeOwnedReadingItem(id)),
    ...readingHistoryRecordIds.map((id) => deleteReadingHistoryEntry(id)),
  ])

  if (studyProgressRecordIds.size > 0) {
    const store = await getStudyProgress()
    await replaceStudyProgressPages(store.pages.filter((page) => {
      const recordId = sanitizeRecordId(page.url) ?? page.url
      return !studyProgressRecordIds.has(recordId)
    }))
  }

  if (mode === "source_and_saved_cards" && vocabularyEntryIds.length > 0) {
    await removeVocabularyEntries(vocabularyEntryIds)
  }

  return {
    selectedCount: normalizedRefs.length,
    updatedSourceControlCount: 0,
    removedSourceHistoryCount: ownedReadingIds.length + readingHistoryRecordIds.length + studyProgressRecordIds.size,
    removedSavedCardCount: mode === "source_and_saved_cards" ? vocabularyEntryIds.length : 0,
  }
}
