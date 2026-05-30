import { z } from "zod"

import { buildVideoTimestampUrl, formatVideoTimestamp, sanitizeVideoSourceUrl } from "@/utils/video-timestamp-url"
import { OwnedReadingUserControlSchema, type OwnedReadingItem } from "./owned-reading"
import {
  sanitizeVocabularyUrl,
  type VocabularyEntry,
} from "./vocabulary-core"

export const SourceContentTypeSchema = z.enum(["page", "video", "file", "selection", "input", "sample"])
export type SourceContentType = z.infer<typeof SourceContentTypeSchema>

export const LearningAssetProgressSchema = z.object({
  status: z.enum(["new", "in_progress", "saved", "reviewed", "archived"]).default("new"),
  percent: z.number().min(0).max(100).optional(),
  lastPosition: z.object({
    selectorAnchor: z.string().optional(),
    scrollY: z.number().optional(),
    timestampMs: z.number().optional(),
    pageNumber: z.number().optional(),
  }).optional(),
})

export const SourceContentSchema = z.object({
  id: z.string().trim().min(1),
  type: SourceContentTypeSchema,
  title: z.string().trim().min(1),
  canonicalUrl: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  targetLanguage: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative(),
  lastOpenedAt: z.number().int().nonnegative().optional(),
  lastStudiedAt: z.number().int().nonnegative().optional(),
  progress: LearningAssetProgressSchema,
  summary: z.object({
    short: z.string().optional(),
    topics: z.array(z.string()).default([]),
    difficulty: z.enum(["beginner", "intermediate", "advanced", "unknown"]).default("unknown"),
  }).default({ topics: [], difficulty: "unknown" }),
  userControl: z.object({
    syncEnabled: z.boolean().default(false),
    excludedFromDigest: z.boolean().default(false),
    privacyModeAtCapture: z.boolean().default(false),
  }).default({ syncEnabled: false, excludedFromDigest: false, privacyModeAtCapture: false }),
})
export type SourceContent = z.infer<typeof SourceContentSchema>

export const SavedSnippetSchema = z.object({
  id: z.string().trim().min(1),
  sourceContentId: z.string().trim().min(1).nullable(),
  text: z.string(),
  translation: z.string().optional(),
  explanation: z.string().optional(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  anchor: z.object({
    selectorAnchor: z.string().optional(),
    textQuote: z.string().optional(),
    timestampMs: z.number().optional(),
    pageNumber: z.number().optional(),
  }).default({}),
  createdAt: z.number().int().nonnegative(),
  createdBy: z.enum(["user", "system_suggested"]).default("user"),
  tags: z.array(z.string()).default([]),
  importance: z.enum(["low", "normal", "high"]).default("normal"),
  reviewCardIds: z.array(z.string()).default([]),
})
export type SavedSnippet = z.infer<typeof SavedSnippetSchema>

export const VocabularyItemExampleSchema = z.object({
  snippetId: z.string().trim().min(1).nullable(),
  sentence: z.string(),
  translation: z.string().optional(),
})

export const VocabularyItemSchema = z.object({
  id: z.string().trim().min(1),
  surfaceText: z.string().trim().min(1),
  normalizedText: z.string().trim().min(1).optional(),
  lemma: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1),
  targetLanguage: z.string().trim().min(1),
  translation: z.string().optional(),
  explanation: z.string().optional(),
  partOfSpeech: z.string().trim().min(1).optional(),
  examples: z.array(VocabularyItemExampleSchema).default([]),
  sourceSnippetIds: z.array(z.string().trim().min(1)).default([]),
  masteryState: z.enum(["new", "learning", "familiar", "mastered", "suspended"]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>

export const ReviewCardSchema = z.object({
  id: z.string().trim().min(1),
  cardType: z.enum(["word", "sentence", "cloze", "video_moment", "correction"]),
  front: z.string(),
  back: z.string(),
  hint: z.string().optional(),
  linkedSnippetId: z.string().trim().min(1).nullable(),
  linkedVocabularyId: z.string().trim().min(1).nullable(),
  linkedSourceContentId: z.string().trim().min(1).nullable(),
  dueAt: z.number().int().nonnegative(),
  intervalDays: z.number().min(0),
  ease: z.number().min(0),
  state: z.enum(["new", "learning", "familiar", "mastered", "suspended"]),
  lastReviewedAt: z.number().int().nonnegative().nullable().optional(),
  reviewCount: z.number().int().nonnegative(),
  lapseCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  generatedBy: z.enum(["user_save", "ai_suggestion", "import"]).default("user_save"),
})
export type ReviewCard = z.infer<typeof ReviewCardSchema>

export const ReviewSessionSchema = z.object({
  id: z.string().trim().min(1),
  startedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable().optional(),
  cardIds: z.array(z.string()),
  results: z.array(z.object({
    cardId: z.string(),
    feedback: z.enum(["again", "good", "easy"]),
    answeredAt: z.number().int().nonnegative(),
  })),
  sourceBreakdown: z.object({
    page: z.number().int().nonnegative().default(0),
    video: z.number().int().nonnegative().default(0),
    file: z.number().int().nonnegative().default(0),
    input: z.number().int().nonnegative().default(0),
  }).default({ page: 0, video: 0, file: 0, input: 0 }),
})
export type ReviewSession = z.infer<typeof ReviewSessionSchema>

export interface LearningAssetProjection {
  sourceContents: SourceContent[]
  savedSnippets: SavedSnippet[]
  vocabularyItems: VocabularyItem[]
  reviewCards: ReviewCard[]
}

export interface WeeklyReviewableLearningMomentsOptions {
  weekStartAt: number
  weekEndAt: number
  excludeSampleSources?: boolean
}

export interface WeeklyReviewableLearningMomentsSummary {
  weekStartAt: number
  weekEndAt: number
  savedSnippetCount: number
  reviewedCardCount: number
  returnToSourceCount: number
  masteredCardCount: number
  reviewableLearningMoments: number
  weightedReviewableLearningMoments: number
}

export interface LocalWeeklyDigestSourceBreakdown {
  sourceContentId: string
  title: string
  type: SourceContentType
  savedSnippetCount: number
  reviewedCardCount: number
}

export interface LocalWeeklyDigestTopic {
  label: string
  sourceCount: number
}

export interface LocalWeeklyDigestRepeatedVocabulary {
  surfaceText: string
  sourceCount: number
  reviewCount: number
}

export interface LocalWeeklyDigestContinueTarget {
  sourceContentId: string
  title: string
  type: SourceContentType
  lastPositionLabel: string
}

export interface LocalWeeklyDigestViewModel extends WeeklyReviewableLearningMomentsSummary {
  headline: string
  detail: string
  sourceCount: number
  sourceBreakdown: LocalWeeklyDigestSourceBreakdown[]
  commonTopics: LocalWeeklyDigestTopic[]
  repeatedVocabulary: LocalWeeklyDigestRepeatedVocabulary[]
  recommendedReviewCount: number
  recommendedContinueTarget: LocalWeeklyDigestContinueTarget | null
}

function mapOwnedReadingSourceType(sourceType: OwnedReadingItem["sourceType"]): SourceContentType {
  switch (sourceType) {
    case "article":
      return "page"
    case "pdf":
    case "epub":
    case "subtitle-file":
      return "file"
  }
}

function sourceIdFromVocabularyEntry(entry: VocabularyEntry): string | null {
  const ownedReadingId = entry.sourceContext?.ownedReadingItemId?.trim()
  if (ownedReadingId) return ownedReadingId

  const sourceUrl = sanitizeVocabularyUrl(entry.sourceContext?.pageUrl ?? entry.url)
  if (sourceUrl) return `src_${encodeURIComponent(sourceUrl)}`

  const hostname = entry.sourceContext?.hostname ?? entry.hostname
  return hostname ? `src_host_${hostname}` : null
}

function cardStateFromVocabularyEntry(entry: VocabularyEntry): ReviewCard["state"] {
  if ((entry.srsBox ?? 1) >= 5) return "mastered"
  if ((entry.srsBox ?? 1) >= 3) return "familiar"
  if ((entry.reviewCount ?? 0) > 0) return "learning"
  return "new"
}

function cardTypeFromVocabularyEntry(entry: VocabularyEntry): ReviewCard["cardType"] {
  const sourceContext = entry.sourceContext
  // A "video moment" is anything that returns the learner to a point in a video:
  // subtitle files, YouTube transcript saves, the subtitle reader, or any save
  // carrying a replay timestamp. (Previously only subtitle-file qualified, so
  // every YouTube transcript save was mislabeled word/sentence.)
  if (
    sourceContext?.ownedReadingSourceType === "subtitle-file"
    || sourceContext?.surface === "video_transcript"
    || sourceContext?.surface === "subtitle_reader"
    || typeof sourceContext?.videoTimestampMs === "number"
  ) {
    return "video_moment"
  }
  const tokenCount = entry.text.trim().split(/\s+/).filter(Boolean).length
  return tokenCount > 4 ? "sentence" : "word"
}

export function sourceContentFromOwnedReadingItem(item: OwnedReadingItem, targetLanguage = "zh-CN"): SourceContent {
  return SourceContentSchema.parse({
    id: item.id,
    type: mapOwnedReadingSourceType(item.sourceType),
    title: item.title,
    canonicalUrl: item.sourceUrl ?? undefined,
    targetLanguage,
    createdAt: item.openedAt,
    lastOpenedAt: item.openedAt,
    lastStudiedAt: item.updatedAt ?? item.openedAt,
    progress: {
      status: item.status === "archived" ? "archived" : item.status,
      percent: typeof item.progress?.fraction === "number" ? Math.round(item.progress.fraction * 100) : undefined,
      lastPosition: item.progress?.sentenceIndex !== undefined
        ? { selectorAnchor: `sentence:${item.progress.sentenceIndex}` }
        : undefined,
    },
    userControl: OwnedReadingUserControlSchema.parse(item.userControl),
  })
}

export function sourceContentFromVocabularyEntry(entry: VocabularyEntry, targetLanguage = "zh-CN"): SourceContent | null {
  const id = sourceIdFromVocabularyEntry(entry)
  if (!id) return null

  const sourceContext = entry.sourceContext
  const isVideoSource = sourceContext?.surface === "subtitle_reader" || sourceContext?.surface === "video_transcript"
  return SourceContentSchema.parse({
    id,
    type: isVideoSource ? "video" : "page",
    title: sourceContext?.ownedReadingTitle ?? sourceContext?.pageTitle ?? entry.hostname ?? "Saved source",
    // Video sources keep their replay identity (YouTube ?v=); page sources strip
    // the whole query for privacy.
    canonicalUrl: isVideoSource
      ? sanitizeVideoSourceUrl(sourceContext?.pageUrl ?? entry.url)
      : sanitizeVocabularyUrl(sourceContext?.pageUrl ?? entry.url),
    hostname: sourceContext?.hostname ?? entry.hostname,
    targetLanguage,
    createdAt: entry.savedAt,
    lastStudiedAt: entry.lastReviewedAt ?? entry.savedAt,
    progress: {
      status: (entry.reviewCount ?? 0) > 0 ? "reviewed" : "saved",
      lastPosition: sourceContext?.sentenceIndex !== undefined || typeof sourceContext?.videoTimestampMs === "number"
        ? {
            ...(sourceContext?.sentenceIndex !== undefined ? { selectorAnchor: `sentence:${sourceContext.sentenceIndex}` } : {}),
            ...(typeof sourceContext?.videoTimestampMs === "number" ? { timestampMs: sourceContext.videoTimestampMs } : {}),
          }
        : undefined,
    },
    summary: {
      short: sourceContext?.contentSummary,
      topics: [],
      difficulty: sourceContext?.languageLevel ?? "unknown",
    },
  })
}

export function savedSnippetFromVocabularyEntry(entry: VocabularyEntry): SavedSnippet {
  const reviewCardId = `card_${entry.id}`
  return SavedSnippetSchema.parse({
    id: `snippet_${entry.id}`,
    sourceContentId: sourceIdFromVocabularyEntry(entry),
    text: entry.sourceContext?.sentenceText ?? entry.text,
    translation: entry.translation,
    explanation: entry.explanation,
    contextBefore: entry.sourceContext?.articleExcerpt ?? entry.context,
    createdAt: entry.savedAt,
    tags: entry.tags ?? [],
    reviewCardIds: [reviewCardId],
    anchor: {
      textQuote: entry.sourceContext?.sentenceText ?? entry.text,
      timestampMs: entry.sourceContext?.videoTimestampMs,
    },
  })
}

export function vocabularyItemFromVocabularyEntry(entry: VocabularyEntry, targetLanguage = "zh-CN"): VocabularyItem {
  const exampleSentence = entry.sourceContext?.sentenceText ?? entry.context
  return VocabularyItemSchema.parse({
    id: entry.id,
    surfaceText: entry.text,
    normalizedText: entry.text.trim().toLocaleLowerCase(),
    language: "unknown",
    targetLanguage,
    translation: entry.translation,
    explanation: entry.explanation,
    examples: exampleSentence
      ? [{ snippetId: `snippet_${entry.id}`, sentence: exampleSentence, translation: entry.translation }]
      : [],
    sourceSnippetIds: [`snippet_${entry.id}`],
    masteryState: cardStateFromVocabularyEntry(entry),
    createdAt: entry.savedAt,
    updatedAt: entry.lastReviewedAt ?? entry.lastReviewGradeAt ?? entry.savedAt,
  })
}

export function reviewCardFromVocabularyEntry(entry: VocabularyEntry): ReviewCard {
  const dueAt = entry.nextReviewAt ?? entry.savedAt
  return ReviewCardSchema.parse({
    id: `card_${entry.id}`,
    cardType: cardTypeFromVocabularyEntry(entry),
    front: entry.text,
    back: entry.translation ?? entry.explanation ?? entry.context ?? "",
    hint: entry.context ?? entry.sourceContext?.sentenceText,
    linkedSnippetId: `snippet_${entry.id}`,
    linkedVocabularyId: entry.id,
    linkedSourceContentId: sourceIdFromVocabularyEntry(entry),
    dueAt,
    intervalDays: Math.max(0, Math.round((dueAt - entry.savedAt) / (24 * 60 * 60 * 1000))),
    ease: entry.srsBox ?? 1,
    state: cardStateFromVocabularyEntry(entry),
    lastReviewedAt: entry.lastReviewedAt ?? null,
    reviewCount: entry.reviewCount ?? 0,
    lapseCount: entry.lastReviewGrade === "again" ? 1 : 0,
    createdAt: entry.savedAt,
  })
}

export function buildLearningAssetProjection(params: {
  vocabularyEntries?: VocabularyEntry[]
  ownedReadingItems?: OwnedReadingItem[]
  targetLanguage?: string
}): LearningAssetProjection {
  const targetLanguage = params.targetLanguage ?? "zh-CN"
  const sourceById = new Map<string, SourceContent>()

  for (const item of params.ownedReadingItems ?? []) {
    const source = sourceContentFromOwnedReadingItem(item, targetLanguage)
    sourceById.set(source.id, source)
  }

  const savedSnippets = (params.vocabularyEntries ?? []).map(savedSnippetFromVocabularyEntry)
  const vocabularyItems = (params.vocabularyEntries ?? []).map((entry) => vocabularyItemFromVocabularyEntry(entry, targetLanguage))
  const reviewCards = (params.vocabularyEntries ?? []).map(reviewCardFromVocabularyEntry)

  for (const entry of params.vocabularyEntries ?? []) {
    const source = sourceContentFromVocabularyEntry(entry, targetLanguage)
    if (source && !sourceById.has(source.id)) {
      sourceById.set(source.id, source)
    }
  }

  return {
    sourceContents: [...sourceById.values()],
    savedSnippets,
    vocabularyItems,
    reviewCards,
  }
}

/**
 * A VideoMomentCard is a DERIVED VIEW over the projection — not a 5th persisted
 * entity. It joins each video_moment ReviewCard with its snippet (for the replay
 * timestamp) and SourceContent (for the video title + URL), so the UI can show
 * "return to this moment" without re-reading raw entries.
 */
export interface VideoMomentCard {
  reviewCardId: string
  sourceContentId: string | null
  videoTitle: string
  timestampMs: number | null
  formattedTimestamp: string | null
  replayUrl: string | null
  front: string
  back: string
  dueAt: number
  state: ReviewCard["state"]
}

export function deriveVideoMomentCards(
  projection: Pick<LearningAssetProjection, "reviewCards" | "savedSnippets" | "sourceContents">,
): VideoMomentCard[] {
  const snippetById = new Map(projection.savedSnippets.map((snippet) => [snippet.id, snippet]))
  const sourceById = new Map(projection.sourceContents.map((source) => [source.id, source]))

  return projection.reviewCards
    .filter((card) => card.cardType === "video_moment")
    .map((card) => {
      const snippet = card.linkedSnippetId ? snippetById.get(card.linkedSnippetId) : undefined
      const source = card.linkedSourceContentId ? sourceById.get(card.linkedSourceContentId) : undefined
      const timestampMs = snippet?.anchor.timestampMs ?? source?.progress.lastPosition?.timestampMs ?? null
      const baseUrl = source?.canonicalUrl ?? null
      const replayUrl = baseUrl !== null && typeof timestampMs === "number"
        ? buildVideoTimestampUrl(baseUrl, timestampMs)
        : baseUrl
      return {
        reviewCardId: card.id,
        sourceContentId: card.linkedSourceContentId,
        videoTitle: source?.title ?? "Video",
        timestampMs: typeof timestampMs === "number" ? timestampMs : null,
        formattedTimestamp: typeof timestampMs === "number" ? formatVideoTimestamp(timestampMs) : null,
        replayUrl,
        front: card.front,
        back: card.back,
        dueAt: card.dueAt,
        state: card.state,
      }
    })
}

export function deriveWeeklyReviewableLearningMoments(
  projection: Pick<LearningAssetProjection, "sourceContents" | "savedSnippets" | "reviewCards">,
  options: WeeklyReviewableLearningMomentsOptions,
): WeeklyReviewableLearningMomentsSummary {
  const sourceById = new Map(projection.sourceContents.map((source) => [source.id, source]))
  const reviewCardById = new Map(projection.reviewCards.map((card) => [card.id, card]))
  const isInWindow = (value: number | null | undefined) => (
    typeof value === "number" && value >= options.weekStartAt && value <= options.weekEndAt
  )

  const savedSnippets = projection.savedSnippets.filter((snippet) => {
    if (!isInWindow(snippet.createdAt)) return false
    const source = snippet.sourceContentId ? sourceById.get(snippet.sourceContentId) : null
    if (source?.userControl.excludedFromDigest) return false
    if (options.excludeSampleSources && source?.type === "sample") return false
    const hasReviewCard = snippet.reviewCardIds.some((id) => reviewCardById.has(id))
    return hasReviewCard || Boolean(source)
  })

  const reviewedCards = projection.reviewCards.filter((card) => isInWindow(card.lastReviewedAt))
  const masteredCards = reviewedCards.filter((card) => card.state === "mastered")
  const returnToSourceCount = reviewedCards.filter((card) => Boolean(card.linkedSourceContentId)).length
  const weighted = savedSnippets.length
    + (reviewedCards.length * 1.5)
    + (returnToSourceCount * 1.2)
    + (masteredCards.length * 2)

  return {
    weekStartAt: options.weekStartAt,
    weekEndAt: options.weekEndAt,
    savedSnippetCount: savedSnippets.length,
    reviewedCardCount: reviewedCards.length,
    returnToSourceCount,
    masteredCardCount: masteredCards.length,
    reviewableLearningMoments: savedSnippets.length,
    weightedReviewableLearningMoments: Number(weighted.toFixed(2)),
  }
}

function isDigestEligibleSource(source: SourceContent | undefined, options: WeeklyReviewableLearningMomentsOptions): source is SourceContent {
  if (!source) return false
  if (source.userControl.excludedFromDigest) return false
  if (options.excludeSampleSources && source.type === "sample") return false
  return true
}

function formatDigestContinuePosition(source: SourceContent): string {
  const position = source.progress.lastPosition
  if (typeof position?.timestampMs === "number") {
    const totalSeconds = Math.max(0, Math.floor(position.timestampMs / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
  if (typeof position?.pageNumber === "number") return `page ${position.pageNumber}`
  const sentenceMatch = position?.selectorAnchor?.match(/^sentence:(\d+)$/)
  if (sentenceMatch) return `sentence ${Number(sentenceMatch[1]) + 1}`
  if (typeof source.progress.percent === "number") return `${source.progress.percent}%`
  return "recent position"
}

export function buildLocalWeeklyDigestViewModel(
  projection: Pick<LearningAssetProjection, "sourceContents" | "savedSnippets" | "vocabularyItems" | "reviewCards">,
  options: WeeklyReviewableLearningMomentsOptions,
): LocalWeeklyDigestViewModel {
  const summary = deriveWeeklyReviewableLearningMoments(projection, options)
  const sourceById = new Map(projection.sourceContents.map((source) => [source.id, source]))
  const sourceCounts = new Map<string, { savedSnippetCount: number; reviewedCardCount: number }>()
  const isInWindow = (value: number | null | undefined) => (
    typeof value === "number" && value >= options.weekStartAt && value <= options.weekEndAt
  )

  for (const snippet of projection.savedSnippets) {
    if (!snippet.sourceContentId || !isInWindow(snippet.createdAt)) continue
    const source = sourceById.get(snippet.sourceContentId)
    if (!isDigestEligibleSource(source, options)) continue
    const counts = sourceCounts.get(snippet.sourceContentId) ?? { savedSnippetCount: 0, reviewedCardCount: 0 }
    counts.savedSnippetCount += 1
    sourceCounts.set(snippet.sourceContentId, counts)
  }

  for (const card of projection.reviewCards) {
    if (!card.linkedSourceContentId || !isInWindow(card.lastReviewedAt)) continue
    const source = sourceById.get(card.linkedSourceContentId)
    if (!isDigestEligibleSource(source, options)) continue
    const counts = sourceCounts.get(card.linkedSourceContentId) ?? { savedSnippetCount: 0, reviewedCardCount: 0 }
    counts.reviewedCardCount += 1
    sourceCounts.set(card.linkedSourceContentId, counts)
  }

  const sourceBreakdown = [...sourceCounts.entries()]
    .map(([sourceContentId, counts]) => {
      const source = sourceById.get(sourceContentId)
      return {
        sourceContentId,
        title: source?.title ?? "Saved source",
        type: source?.type ?? "page",
        ...counts,
      }
    })
    .sort((a, b) => (b.savedSnippetCount + b.reviewedCardCount) - (a.savedSnippetCount + a.reviewedCardCount))
    .slice(0, 3)

  const topicSourceIds = new Map<string, Set<string>>()
  for (const source of sourceById.values()) {
    if (!isDigestEligibleSource(source, options)) continue
    if (!sourceCounts.has(source.id) && !isInWindow(source.lastStudiedAt ?? source.lastOpenedAt ?? source.createdAt)) continue
    for (const topic of source.summary.topics) {
      const label = topic.trim()
      if (!label) continue
      const ids = topicSourceIds.get(label) ?? new Set<string>()
      ids.add(source.id)
      topicSourceIds.set(label, ids)
    }
  }
  const commonTopics = [...topicSourceIds.entries()]
    .map(([label, sourceIds]) => ({ label, sourceCount: sourceIds.size }))
    .sort((a, b) => b.sourceCount - a.sourceCount || a.label.localeCompare(b.label))
    .slice(0, 3)

  const snippetById = new Map(projection.savedSnippets.map((snippet) => [snippet.id, snippet]))
  const reviewCountByVocabularyId = new Map<string, number>()
  for (const card of projection.reviewCards) {
    if (!card.linkedVocabularyId || !isInWindow(card.lastReviewedAt)) continue
    reviewCountByVocabularyId.set(card.linkedVocabularyId, (reviewCountByVocabularyId.get(card.linkedVocabularyId) ?? 0) + 1)
  }
  const vocabularyGroups = new Map<string, { surfaceText: string; sourceIds: Set<string>; reviewCount: number }>()
  for (const item of projection.vocabularyItems) {
    if (!isInWindow(item.updatedAt)) continue
    const normalized = (item.normalizedText ?? item.surfaceText).trim().toLocaleLowerCase()
    if (!normalized) continue
    const group = vocabularyGroups.get(normalized) ?? { surfaceText: item.surfaceText, sourceIds: new Set<string>(), reviewCount: 0 }
    for (const snippetId of item.sourceSnippetIds) {
      const sourceId = snippetById.get(snippetId)?.sourceContentId
      if (!sourceId) continue
      const source = sourceById.get(sourceId)
      if (isDigestEligibleSource(source, options)) group.sourceIds.add(sourceId)
    }
    group.reviewCount += reviewCountByVocabularyId.get(item.id) ?? 0
    vocabularyGroups.set(normalized, group)
  }
  const repeatedVocabulary = [...vocabularyGroups.values()]
    .filter((group) => group.sourceIds.size > 1)
    .map((group) => ({
      surfaceText: group.surfaceText,
      sourceCount: group.sourceIds.size,
      reviewCount: group.reviewCount,
    }))
    .sort((a, b) => b.sourceCount - a.sourceCount || b.reviewCount - a.reviewCount || a.surfaceText.localeCompare(b.surfaceText))
    .slice(0, 3)

  const recommendedContinueSource = [...sourceById.values()]
    .filter((source) => isDigestEligibleSource(source, options))
    .filter((source) => source.progress.status === "in_progress" || source.progress.status === "saved" || source.progress.status === "reviewed")
    .sort((a, b) => (b.lastStudiedAt ?? b.lastOpenedAt ?? b.createdAt) - (a.lastStudiedAt ?? a.lastOpenedAt ?? a.createdAt))[0]
  const recommendedContinueTarget = recommendedContinueSource
    ? {
        sourceContentId: recommendedContinueSource.id,
        title: recommendedContinueSource.title,
        type: recommendedContinueSource.type,
        lastPositionLabel: formatDigestContinuePosition(recommendedContinueSource),
      }
    : null
  const recommendedReviewCount = projection.reviewCards.filter((card) => (
    card.state !== "mastered"
    && card.state !== "suspended"
    && typeof card.dueAt === "number"
    && card.dueAt <= options.weekEndAt
  )).length

  const sourceCount = sourceCounts.size
  const headline = summary.savedSnippetCount > 0
    ? `You saved ${summary.savedSnippetCount} reviewable moment${summary.savedSnippetCount === 1 ? "" : "s"} this week.`
    : summary.reviewedCardCount > 0
      ? `You reviewed ${summary.reviewedCardCount} card${summary.reviewedCardCount === 1 ? "" : "s"} this week.`
      : "Your weekly learning digest is ready when you save or review."
  const detail = sourceCount > 0
    ? `${sourceCount} source${sourceCount === 1 ? "" : "s"} contributed to this local digest. ${summary.reviewedCardCount} review${summary.reviewedCardCount === 1 ? "" : "s"} completed.`
    : "No page text or transcript content is stored in this digest summary."

  return {
    ...summary,
    headline,
    detail,
    sourceCount,
    sourceBreakdown,
    commonTopics,
    repeatedVocabulary,
    recommendedReviewCount,
    recommendedContinueTarget,
  }
}
