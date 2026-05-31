import { buildVideoTimestampUrl } from "./videoTimestamp"

export type SourceContentType = "page" | "video" | "pdf" | "doc" | "book" | "writing" | "saved"
export type SavedItemType = "word" | "phrase" | "sentence" | "correction"
export type ReviewCardType = "word" | "sentence" | "cloze" | "audio" | "correction"
export type ReviewRating = "again" | "good" | "easy" | "skip"
export type ReviewCardState = "new" | "learning" | "familiar" | "mastered" | "suspended"

export interface SourceContent {
  sourceId: string
  type: SourceContentType
  title: string
  origin?: string
  url?: string
  savedAt: string
  hidden?: boolean
  private?: boolean
}

export interface SavedItem {
  itemId: string
  sourceId: string
  itemType: SavedItemType
  text: string
  translation: string
  explanation?: string
  context?: string
  savedAt: string
  videoTimestampMs?: number
  privacyLevel?: "normal" | "private" | "local-only"
}

export interface ReviewCard {
  cardId: string
  itemId: string
  cardType: ReviewCardType
  dueAt: string
  state: ReviewCardState
  priority: number
}

/**
 * Soft estimate of how long today's review takes, in minutes (~30s per card,
 * floored to a friendly 1-minute minimum). Deliberately approximate — surfaced
 * as "about N min", never a hard SLA.
 */
export function estimateReviewMinutes(cardCount: number): number {
  if (cardCount <= 0) return 0
  return Math.max(1, Math.round(cardCount * 0.5))
}

/**
 * The link that returns a learner to where they saved an item: a saved video
 * moment opens the source at its timestamp; everything else opens the bare
 * source URL. Used by both the Today review card and the Library "Open source".
 */
export function buildSavedItemSourceUrl(
  item: Pick<SavedItem, "videoTimestampMs">,
  source: Pick<SourceContent, "type" | "url"> | undefined,
): string | undefined {
  if (!source?.url) return undefined
  if (source.type === "video" && item.videoTimestampMs != null) {
    return buildVideoTimestampUrl(source.url, item.videoTimestampMs)
  }
  return source.url
}

export interface MobileReviewCardViewModel {
  cardId: string
  itemId: string
  sourceId: string
  type: "word" | "sentence"
  front: string
  translation: string
  explanation: string
  context: string
  sourceTitle: string
  sourceType: SourceContentType
  sourceUrl: string | undefined
  dueAt: string
  state: ReviewCardState
}

export interface ReviewEvent {
  eventId: string
  cardId: string
  rating: ReviewRating
  reviewedAt: string
  deviceId: string
  offline: boolean
  appVersion: string
}

export interface DigestSourceBreakdownItem {
  type: SourceContentType
  count: number
}

export interface MobileDigestSnapshot {
  digestId: string
  periodStart: string
  periodEnd: string
  reviewedCount: number
  savedCount: number
  sourceBreakdown: DigestSourceBreakdownItem[]
  highlightedWords: string[]
  highlightedSentences: string[]
  nextReviewCount: number
  generatedAt: string
}

export interface MobileReviewSnapshot {
  sources: SourceContent[]
  savedItems: SavedItem[]
  reviewCards: ReviewCard[]
}

export type MobileReviewShareInput =
  | MobileReviewCardViewModel
  | {
    item: SavedItem
    source?: SourceContent
  }

export const DAILY_REVIEW_LIMIT = 5

export const EMPTY_MOBILE_REVIEW_SNAPSHOT: MobileReviewSnapshot = {
  sources: [],
  savedItems: [],
  reviewCards: [],
}

export function buildTodayReviewQueue(snapshot: MobileReviewSnapshot, now = new Date(), options: { sourceId?: string } = {}): MobileReviewCardViewModel[] {
  const sourceById = new Map(snapshot.sources.filter((source) => !source.hidden).map((source) => [source.sourceId, source]))
  const itemById = new Map(snapshot.savedItems.map((item) => [item.itemId, item]))
  const nowTime = now.getTime()

  return snapshot.reviewCards
    .filter((card) => card.cardType === "word" || card.cardType === "sentence")
    .filter((card) => card.state !== "suspended")
    .filter((card) => new Date(card.dueAt).getTime() <= nowTime)
    .map((card) => {
      const item = itemById.get(card.itemId)
      if (!item) return null
      if (options.sourceId && item.sourceId !== options.sourceId) return null
      const source = sourceById.get(item.sourceId)
      if (!source) return null
      return {
        cardId: card.cardId,
        itemId: item.itemId,
        sourceId: source.sourceId,
        type: item.itemType === "sentence" || item.text.length > 48 ? "sentence" : "word",
        front: item.text,
        translation: item.translation,
        explanation: item.explanation ?? "Review this expression in the context where you saved it.",
        context: item.context ?? "",
        sourceTitle: source.title,
        sourceType: source.type,
        sourceUrl: buildSavedItemSourceUrl(item, source),
        dueAt: card.dueAt,
        state: card.state,
      } satisfies MobileReviewCardViewModel
    })
    .filter((card): card is MobileReviewCardViewModel => card !== null)
    .sort((a, b) => {
      const cardA = snapshot.reviewCards.find((card) => card.cardId === a.cardId)?.priority ?? 0
      const cardB = snapshot.reviewCards.find((card) => card.cardId === b.cardId)?.priority ?? 0
      return cardB - cardA || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    })
    .slice(0, DAILY_REVIEW_LIMIT)
}

function startOfDigestWeek(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = start.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + mondayOffset)
  return start
}

function sourceTypeLabel(type: SourceContentType): SourceContentType {
  return type
}

function compactShareLine(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\s+/g, " ") : null
}

export function buildMobileReviewSpeechText(card: Pick<MobileReviewCardViewModel, "front">): string {
  return compactShareLine(card.front) ?? ""
}

export function buildMobileSavedItemSpeechText(item: Pick<SavedItem, "text">): string {
  return compactShareLine(item.text) ?? ""
}

export function buildMobileReviewShareText(input: MobileReviewShareInput): string {
  const card = "front" in input
    ? {
      expression: input.front,
      translation: input.translation,
      explanation: input.explanation,
      sourceTitle: input.sourceTitle,
      sourceType: input.sourceType,
    }
    : {
      expression: input.item.text,
      translation: input.item.translation,
      explanation: input.item.explanation,
      sourceTitle: input.source?.title ?? "your reading",
      sourceType: input.source?.type ?? "saved",
    }

  const lines = [
    "Astra review card",
    compactShareLine(`Expression: ${card.expression}`),
    compactShareLine(`Meaning: ${card.translation}`),
    compactShareLine(card.explanation ? `Note: ${card.explanation}` : undefined),
    compactShareLine(`Source: ${card.sourceTitle} (${card.sourceType})`),
  ]

  return lines.filter((line): line is string => line !== null).join("\n")
}

export function buildWeeklyDigestSnapshot(
  snapshot: MobileReviewSnapshot,
  reviewEvents: ReviewEvent[] = [],
  now = new Date(),
): MobileDigestSnapshot {
  const periodStart = startOfDigestWeek(now)
  const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  const periodStartTime = periodStart.getTime()
  const periodEndTime = periodEnd.getTime()
  const sourceById = new Map(snapshot.sources.filter((source) => !source.hidden).map((source) => [source.sourceId, source]))
  const savedThisWeek = snapshot.savedItems.filter((item) => {
    const savedAt = new Date(item.savedAt).getTime()
    return Number.isFinite(savedAt) && savedAt >= periodStartTime && savedAt < periodEndTime
  })
  const reviewedThisWeek = reviewEvents.filter((event) => {
    const reviewedAt = new Date(event.reviewedAt).getTime()
    return Number.isFinite(reviewedAt) && reviewedAt >= periodStartTime && reviewedAt < periodEndTime
  })
  const sourceBreakdownMap = new Map<SourceContentType, number>()
  for (const item of savedThisWeek) {
    const source = sourceById.get(item.sourceId)
    if (!source) continue
    const sourceType = sourceTypeLabel(source.type)
    sourceBreakdownMap.set(sourceType, (sourceBreakdownMap.get(sourceType) ?? 0) + 1)
  }

  const nowTime = now.getTime()
  const nextReviewUntil = new Date(now)
  nextReviewUntil.setDate(now.getDate() + 7)
  const nextReviewCount = snapshot.reviewCards.filter((card) => {
    if (card.state === "suspended" || card.state === "mastered") return false
    const dueAt = new Date(card.dueAt).getTime()
    return Number.isFinite(dueAt) && dueAt > nowTime && dueAt <= nextReviewUntil.getTime()
  }).length

  return {
    digestId: `digest_${periodStart.toISOString().slice(0, 10)}`,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    reviewedCount: reviewedThisWeek.length,
    savedCount: savedThisWeek.length,
    sourceBreakdown: Array.from(sourceBreakdownMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    highlightedWords: savedThisWeek
      .filter((item) => item.itemType !== "sentence")
      .slice(0, 3)
      .map((item) => item.text),
    highlightedSentences: savedThisWeek
      .filter((item) => item.itemType === "sentence")
      .slice(0, 2)
      .map((item) => item.text),
    nextReviewCount,
    generatedAt: now.toISOString(),
  }
}

export function createReviewEvent(params: {
  cardId: string
  rating: ReviewRating
  deviceId: string
  appVersion: string
  offline: boolean
  reviewedAt?: Date
}): ReviewEvent {
  const reviewedAt = params.reviewedAt ?? new Date()
  return {
    eventId: `review_${reviewedAt.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    cardId: params.cardId,
    rating: params.rating,
    reviewedAt: reviewedAt.toISOString(),
    deviceId: params.deviceId,
    offline: params.offline,
    appVersion: params.appVersion,
  }
}

export const sampleMobileReviewSnapshot: MobileReviewSnapshot = {
  sources: [
    {
      sourceId: "source-distributed-systems",
      type: "page",
      title: "The Future of Distributed Systems",
      origin: "example.com",
      savedAt: "2026-05-27T09:00:00.000Z",
    },
    {
      sourceId: "source-design-notes",
      type: "doc",
      title: "Designing Data-Intensive Applications notes",
      origin: "Astra sample",
      savedAt: "2026-05-27T09:05:00.000Z",
    },
  ],
  savedItems: [
    {
      itemId: "item-resilient",
      sourceId: "source-distributed-systems",
      itemType: "word",
      text: "resilient",
      translation: "能恢复的；有韧性的",
      explanation: "Here it describes a system that keeps working after failures.",
      context: "The system remained resilient after multiple node failures.",
      savedAt: "2026-05-27T09:10:00.000Z",
    },
    {
      itemId: "item-moving-target",
      sourceId: "source-design-notes",
      itemType: "sentence",
      text: "The catch is that consistency becomes a moving target.",
      translation: "问题在于，一致性会变成一个不断变化的目标。",
      explanation: "“The catch is…” introduces the hidden problem; “a moving target” means the goal keeps changing.",
      context: "The catch is that consistency becomes a moving target.",
      savedAt: "2026-05-27T09:15:00.000Z",
    },
  ],
  reviewCards: [
    {
      cardId: "card-resilient",
      itemId: "item-resilient",
      cardType: "word",
      dueAt: "2026-05-27T00:00:00.000Z",
      state: "new",
      priority: 10,
    },
    {
      cardId: "card-moving-target",
      itemId: "item-moving-target",
      cardType: "sentence",
      dueAt: "2026-05-27T00:00:00.000Z",
      state: "new",
      priority: 9,
    },
  ],
}
