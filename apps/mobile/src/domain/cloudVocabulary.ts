import type { MobileReviewSnapshot, ReviewCard, SavedItem, SourceContent, SourceContentType } from "./review"

export interface MobileSyncedVocabularyEntry {
  id: string
  text: string
  translation?: string
  explanation?: string
  context?: string
  url?: string
  hostname?: string
  savedAt: number
  sourceContext?: {
    surface?: string
    pageTitle?: string
    pageUrl?: string
    hostname?: string
    sentenceText?: string
    ownedReadingSourceType?: "article" | "pdf" | "epub" | "subtitle-file"
    ownedReadingTitle?: string
    videoTimestampMs?: number
  }
}

export interface MobileSyncedReviewScheduleRecord {
  vocabularyEntryId: string
  nextReviewAt: number
  srsBox: number
  reviewCount: number
  lastReviewedAt: number | null
}

export interface MobileCloudVocabularySnapshotInput {
  entries: MobileSyncedVocabularyEntry[]
  reviewSchedules?: MobileSyncedReviewScheduleRecord[]
}

function sourceTypeForEntry(entry: MobileSyncedVocabularyEntry): SourceContentType {
  if (entry.sourceContext?.surface === "subtitle_reader" || entry.sourceContext?.surface === "video_transcript") return "video"
  if (entry.sourceContext?.ownedReadingSourceType === "pdf") return "pdf"
  if (entry.sourceContext?.ownedReadingSourceType === "epub") return "book"
  if (entry.sourceContext?.ownedReadingSourceType === "subtitle-file") return "doc"
  if (entry.sourceContext?.pageUrl || entry.url || entry.hostname || entry.sourceContext?.hostname) return "page"
  return "saved"
}

function sourceTitleForEntry(entry: MobileSyncedVocabularyEntry): string {
  return entry.sourceContext?.ownedReadingTitle
    ?? entry.sourceContext?.pageTitle
    ?? entry.sourceContext?.hostname
    ?? entry.hostname
    ?? "your reading"
}

function sourceOriginForEntry(entry: MobileSyncedVocabularyEntry): string | undefined {
  return entry.sourceContext?.hostname ?? entry.hostname
}

function sourceUrlForEntry(entry: MobileSyncedVocabularyEntry): string | undefined {
  return entry.sourceContext?.pageUrl ?? entry.url
}

function sourceIdForEntry(entry: MobileSyncedVocabularyEntry): string {
  const raw = [sourceTypeForEntry(entry), sourceTitleForEntry(entry), sourceOriginForEntry(entry) ?? "", sourceUrlForEntry(entry) ?? ""].join(":")
  return `source_${raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "saved"}`
}

function stateFromSchedule(schedule: MobileSyncedReviewScheduleRecord | undefined): ReviewCard["state"] {
  if (!schedule || schedule.reviewCount === 0) return "new"
  if (schedule.srsBox >= 5) return "mastered"
  if (schedule.srsBox >= 3) return "familiar"
  return "learning"
}

export function buildMobileReviewSnapshotFromCloudVocabulary(input: MobileCloudVocabularySnapshotInput): MobileReviewSnapshot {
  const schedules = new Map(input.reviewSchedules?.map((schedule) => [schedule.vocabularyEntryId, schedule]) ?? [])
  const sources = new Map<string, SourceContent>()
  const savedItems: SavedItem[] = []
  const reviewCards: ReviewCard[] = []

  for (const entry of input.entries) {
    const sourceId = sourceIdForEntry(entry)
    if (!sources.has(sourceId)) {
      sources.set(sourceId, {
        sourceId,
        type: sourceTypeForEntry(entry),
        title: sourceTitleForEntry(entry),
        origin: sourceOriginForEntry(entry),
        url: sourceUrlForEntry(entry),
        savedAt: new Date(entry.savedAt).toISOString(),
      })
    }

    const itemType: SavedItem["itemType"] = entry.text.includes(" ") || entry.text.length > 48 ? "sentence" : "word"
    savedItems.push({
      itemId: entry.id,
      sourceId,
      itemType,
      text: entry.text,
      translation: entry.translation?.trim() || "Saved for review.",
      explanation: entry.explanation?.trim(),
      context: entry.sourceContext?.sentenceText ?? entry.context,
      savedAt: new Date(entry.savedAt).toISOString(),
      videoTimestampMs: entry.sourceContext?.videoTimestampMs,
      privacyLevel: "normal",
    })

    const schedule = schedules.get(entry.id)
    reviewCards.push({
      cardId: `card_${entry.id}`,
      itemId: entry.id,
      cardType: itemType === "sentence" ? "sentence" : "word",
      dueAt: new Date(schedule?.nextReviewAt ?? entry.savedAt).toISOString(),
      state: stateFromSchedule(schedule),
      priority: schedule ? Math.max(1, 6 - schedule.srsBox) : 10,
    })
  }

  return {
    sources: Array.from(sources.values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    savedItems: savedItems.sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    reviewCards: reviewCards.sort((a, b) => b.priority - a.priority),
  }
}
