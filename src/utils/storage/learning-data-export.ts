import { z } from "zod"

import {
  buildLearningAssetProjection,
  deriveWeeklyReviewableLearningMoments,
  type WeeklyReviewableLearningMomentsSummary,
} from "./learning-assets"
import {
  getVocabularyEntries,
} from "./vocabulary"
import {
  listOwnedReadingItems,
} from "./owned-reading"
import {
  getReadingHistory,
} from "./reading-history"
import {
  deriveWeeklyRoiWindow,
  getStudyProgress,
} from "./study-progress"

export const LearningDataExportSchema = z.object({
  schema: z.literal("astra-learning-data-export.v1"),
  generatedAt: z.string(),
  contentPolicy: z.object({
    userInitiatedExport: z.literal(true),
    includesSavedSnippets: z.boolean(),
    includesFullPageText: z.literal(false),
    includesFullTranscriptText: z.literal(false),
    copyrightBoundary: z.string(),
  }),
  summary: z.object({
    sourceContentCount: z.number().int().nonnegative(),
    savedSnippetCount: z.number().int().nonnegative(),
    reviewCardCount: z.number().int().nonnegative(),
    ownedReadingCount: z.number().int().nonnegative(),
    readingHistoryCount: z.number().int().nonnegative(),
    studyProgressPageCount: z.number().int().nonnegative(),
    weeklyReviewableLearningMoments: z.custom<WeeklyReviewableLearningMomentsSummary>(),
  }),
  learningAssets: z.object({
    sourceContents: z.array(z.unknown()),
    savedSnippets: z.array(z.unknown()),
    reviewCards: z.array(z.unknown()),
  }),
  rawCollections: z.object({
    vocabularyEntries: z.array(z.unknown()),
    ownedReadingItems: z.array(z.unknown()),
    readingHistory: z.array(z.unknown()),
    studyProgress: z.unknown(),
  }),
})

export type LearningDataExport = z.infer<typeof LearningDataExportSchema>

export interface BuildLearningDataExportOptions {
  generatedAt?: Date | string | number
  targetLanguage?: string
}

function normalizeGeneratedAt(value: Date | string | number | undefined): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" || typeof value === "number") return new Date(value).toISOString()
  return new Date().toISOString()
}

export async function buildLearningDataExport(options: BuildLearningDataExportOptions = {}): Promise<LearningDataExport> {
  const [vocabularyEntries, ownedReadingItems, readingHistory, studyProgress] = await Promise.all([
    getVocabularyEntries(),
    listOwnedReadingItems(),
    getReadingHistory(),
    getStudyProgress(),
  ])
  const generatedAt = normalizeGeneratedAt(options.generatedAt)
  const projection = buildLearningAssetProjection({
    vocabularyEntries,
    ownedReadingItems,
    targetLanguage: options.targetLanguage,
  })
  const window = deriveWeeklyRoiWindow({ now: new Date(generatedAt).getTime(), days: 7 })
  const wrlm = deriveWeeklyReviewableLearningMoments(projection, {
    weekStartAt: window.startAt,
    weekEndAt: window.endAt,
    excludeSampleSources: true,
  })

  return LearningDataExportSchema.parse({
    schema: "astra-learning-data-export.v1",
    generatedAt,
    contentPolicy: {
      userInitiatedExport: true,
      includesSavedSnippets: vocabularyEntries.length > 0,
      includesFullPageText: false,
      includesFullTranscriptText: false,
      copyrightBoundary: "This export contains user-saved learning snippets, metadata, review cards, and local progress. It does not intentionally export full third-party webpages or full transcripts.",
    },
    summary: {
      sourceContentCount: projection.sourceContents.length,
      savedSnippetCount: projection.savedSnippets.length,
      reviewCardCount: projection.reviewCards.length,
      ownedReadingCount: ownedReadingItems.length,
      readingHistoryCount: readingHistory.length,
      studyProgressPageCount: studyProgress.pages.length,
      weeklyReviewableLearningMoments: wrlm,
    },
    learningAssets: projection,
    rawCollections: {
      vocabularyEntries,
      ownedReadingItems,
      readingHistory,
      studyProgress,
    },
  })
}

export function stringifyLearningDataExport(payload: LearningDataExport): string {
  return JSON.stringify(payload, null, 2)
}
