import type { AstraConfig } from "@/types/config"
import { readConfig } from "./config"
import {
  readLearningProfile,
  type LearningProfile,
} from "./learning-profile"
import {
  buildLearningAssetProjection,
  type LearningAssetProjection,
} from "./learning-assets"
import {
  getVocabularyEntries,
} from "./vocabulary"
import type { VocabularyEntry } from "./vocabulary-core"
import {
  listOwnedReadingItems,
  type OwnedReadingItem,
} from "./owned-reading"
import {
  getReadingHistory,
  type ReadingHistoryEntry,
} from "./reading-history"
import {
  getStudyProgress,
  type StudyProgressStore,
} from "./study-progress"

export type LearningMemorySectionId =
  | "learning_profile"
  | "remembered_terms"
  | "saved_snippets"
  | "source_history"
  | "review_state"
  | "privacy_controls"

export type LearningMemoryControl =
  | "edit_preferences"
  | "disable_personalization"
  | "forget_remembered_terms"
  | "delete_saved_items"
  | "remove_source_history"
  | "export_learning_data"
  | "privacy_mode"

export type LearningMemoryWriteSurface =
  | "user_saved_snippet"
  | "remembered_term"
  | "review_state"
  | "source_history"
  | "study_progress"
  | "topic_signal"
  | "digest_summary"

export type LearningMemoryWriteDecision = "allow" | "reduce" | "suppress"

export type LearningMemoryWriteAuditInitiation = "automatic" | "explicit_user" | "sync_or_import" | "future_guardrail"
export type LearningMemoryPrivacyModeExpectation = "allow" | "reduce" | "suppress"

export interface LearningMemoryWriteAuditRegistryEntry {
  id: string
  modulePath: `src/${string}.ts`
  functionName: string
  surface: LearningMemoryWriteSurface
  initiation: LearningMemoryWriteAuditInitiation
  privacyModeExpectation: LearningMemoryPrivacyModeExpectation
  userInitiated: boolean
  contentBoundary: {
    storesFullPageText: false
    storesFullTranscriptText: false
    storesPromptText: false
    storesModelOutput: false
    storesRawUrlWithQueryOrHash: false
  }
  notes: string
}

function learningMemoryWriteAuditEntry(
  entry: Omit<LearningMemoryWriteAuditRegistryEntry, "contentBoundary">,
): LearningMemoryWriteAuditRegistryEntry {
  return {
    ...entry,
    contentBoundary: {
      storesFullPageText: false,
      storesFullTranscriptText: false,
      storesPromptText: false,
      storesModelOutput: false,
      storesRawUrlWithQueryOrHash: false,
    },
  }
}

export const LEARNING_MEMORY_WRITE_AUDIT_REGISTRY = [
  learningMemoryWriteAuditEntry({
    id: "reading_history.record_page_translation",
    modulePath: "src/utils/storage/reading-history.ts",
    functionName: "recordPageTranslation",
    surface: "source_history",
    initiation: "automatic",
    privacyModeExpectation: "reduce",
    userInitiated: false,
    notes: "Automatic page-translation source history; Privacy Mode stores only host-bucket continuity metadata.",
  }),
  learningMemoryWriteAuditEntry({
    id: "study_progress.record_study_event",
    modulePath: "src/utils/storage/study-progress.ts",
    functionName: "recordStudyEvent",
    surface: "study_progress",
    initiation: "automatic",
    privacyModeExpectation: "reduce",
    userInitiated: false,
    notes: "Automatic learning-loop progress counters; Privacy Mode stores coarse page/progress metadata only.",
  }),
  learningMemoryWriteAuditEntry({
    id: "owned_reading.upsert_owned_article_from_url",
    modulePath: "src/utils/storage/owned-reading.ts",
    functionName: "upsertOwnedArticleFromUrl",
    surface: "source_history",
    initiation: "automatic",
    privacyModeExpectation: "reduce",
    userInitiated: false,
    notes: "Article capture for Continue Reading; Privacy Mode reduces title/source URL and disables sync/digest for the capture.",
  }),
  learningMemoryWriteAuditEntry({
    id: "owned_reading.sync_recent_reading_history_to_owned_queue",
    modulePath: "src/utils/storage/owned-reading.ts",
    functionName: "syncRecentReadingHistoryToOwnedQueue",
    surface: "source_history",
    initiation: "automatic",
    privacyModeExpectation: "reduce",
    userInitiated: false,
    notes: "Automatic reading-history-to-owned-reading sync; Privacy Mode carries forward reduced source metadata only.",
  }),
  learningMemoryWriteAuditEntry({
    id: "vocabulary.save_vocabulary_entry",
    modulePath: "src/utils/storage/vocabulary.ts",
    functionName: "saveVocabularyEntry",
    surface: "user_saved_snippet",
    initiation: "explicit_user",
    privacyModeExpectation: "allow",
    userInitiated: true,
    notes: "Explicit learner save; Privacy Mode still allows intentional saved cards and review assets.",
  }),
  learningMemoryWriteAuditEntry({
    id: "vocabulary.record_vocabulary_review_schedule",
    modulePath: "src/utils/storage/vocabulary.ts",
    functionName: "recordVocabularyReviewSchedule",
    surface: "review_state",
    initiation: "explicit_user",
    privacyModeExpectation: "allow",
    userInitiated: true,
    notes: "Explicit review outcome/scheduling state; required for lightweight practice.",
  }),
  learningMemoryWriteAuditEntry({
    id: "learning_profile.remember_preferred_term",
    modulePath: "src/utils/storage/learning-profile.ts",
    functionName: "rememberPreferredTerm",
    surface: "remembered_term",
    initiation: "explicit_user",
    privacyModeExpectation: "allow",
    userInitiated: true,
    notes: "User-confirmed terminology preference; suppressed separately when personalization memory is disabled.",
  }),
  learningMemoryWriteAuditEntry({
    id: "future.topic_signal",
    modulePath: "src/utils/storage/learning-memory.ts",
    functionName: "evaluateLearningMemoryWritePolicy",
    surface: "topic_signal",
    initiation: "future_guardrail",
    privacyModeExpectation: "suppress",
    userInitiated: false,
    notes: "Guardrail for any future automatic topic graph write.",
  }),
  learningMemoryWriteAuditEntry({
    id: "future.digest_summary",
    modulePath: "src/utils/storage/learning-memory.ts",
    functionName: "evaluateLearningMemoryWritePolicy",
    surface: "digest_summary",
    initiation: "future_guardrail",
    privacyModeExpectation: "reduce",
    userInitiated: false,
    notes: "Guardrail for future digest memory summaries; Privacy Mode permits only coarse summary metadata.",
  }),
] as const satisfies readonly LearningMemoryWriteAuditRegistryEntry[]

export interface LearningMemorySection {
  id: LearningMemorySectionId
  label: string
  count: number
  description: string
  whyAstraKeepsIt: string
  userControls: LearningMemoryControl[]
  contentPolicy: string
}

export interface LearningMemoryInventorySummary {
  preferenceCount: number
  rememberedTermCount: number
  savedSnippetCount: number
  reviewCardCount: number
  sourceContentCount: number
  ownedReadingCount: number
  readingHistoryCount: number
  studyProgressPageCount: number
}

export interface LearningMemoryInventory {
  schema: "astra-learning-memory-inventory.v1"
  generatedAt: string
  privacyMode: boolean
  personalizationEnabled: boolean
  summary: LearningMemoryInventorySummary
  sections: LearningMemorySection[]
  globalControls: LearningMemoryControl[]
  privacyModeEffect: string
  contentPolicy: {
    includesFullPageText: false
    includesFullTranscriptText: false
    includesPromptText: false
    includesModelOutput: false
    includesFullUrlPaths: false
    description: string
  }
}

export interface BuildLearningMemoryInventoryInput {
  generatedAt?: Date | string | number
  privacyMode?: boolean
  learningProfile: LearningProfile
  vocabularyEntries?: VocabularyEntry[]
  ownedReadingItems?: OwnedReadingItem[]
  readingHistory?: ReadingHistoryEntry[]
  studyProgress?: StudyProgressStore
  projection?: LearningAssetProjection
}

export interface LearningMemoryWritePolicyInput {
  surface: LearningMemoryWriteSurface
  privacyMode: boolean
  personalizationEnabled: boolean
  userInitiated?: boolean
  hostnameExcluded?: boolean
}

export interface ResolveLearningMemoryWritePolicyInput {
  surface: LearningMemoryWriteSurface
  userInitiated?: boolean
  hostname?: string | null
  url?: string | null
  config?: Pick<AstraConfig, "privacyMode">
  learningProfile?: Pick<LearningProfile, "personalizationEnabled" | "excludedHostnames">
}

export interface LearningMemoryWritePolicyResult {
  decision: LearningMemoryWriteDecision
  reason: string
  allowedFields: string[]
  userFacingCopy: string
}

function normalizeGeneratedAt(value: Date | string | number | undefined): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" || typeof value === "number") return new Date(value).toISOString()
  return new Date().toISOString()
}

function countEnabledProfilePreferences(profile: LearningProfile): number {
  return [
    profile.targetLang,
    profile.languageLevel,
    profile.explainMode,
    profile.primaryGoal,
    profile.dailyGoalMinutes,
  ].filter((value) => value !== undefined && value !== null && value !== "").length
}

function buildSections(params: {
  profile: LearningProfile
  summary: LearningMemoryInventorySummary
}): LearningMemorySection[] {
  const { profile, summary } = params
  return [
    {
      id: "learning_profile",
      label: "Learning profile",
      count: summary.preferenceCount,
      description: "Language, level, explanation style, learning goal, daily target, and personalization setting.",
      whyAstraKeepsIt: "So Astra can explain content at the right level without asking every time.",
      userControls: ["edit_preferences", "disable_personalization", "export_learning_data"],
      contentPolicy: "Preferences only; no page text, prompt text, or model output.",
    },
    {
      id: "remembered_terms",
      label: "Remembered terms",
      count: summary.rememberedTermCount,
      description: "Terms you saved or corrected for future translation consistency.",
      whyAstraKeepsIt: "So repeated terms can stay consistent while you learn.",
      userControls: ["forget_remembered_terms", "disable_personalization", "export_learning_data"],
      contentPolicy: "User-visible term pairs only; no hidden topic profile.",
    },
    {
      id: "saved_snippets",
      label: "Saved words and sentences",
      count: summary.savedSnippetCount,
      description: "Items you intentionally saved for review, plus the review cards created from them.",
      whyAstraKeepsIt: "So your real-content saves become reviewable learning assets.",
      userControls: ["delete_saved_items", "export_learning_data"],
      contentPolicy: "Saved snippets are user-initiated learning data; full pages and full transcripts are not included by default.",
    },
    {
      id: "source_history",
      label: "Source history",
      count: summary.sourceContentCount + summary.ownedReadingCount + summary.readingHistoryCount,
      description: "Source titles, source types, hostnames, and progress metadata that help you continue reading or watching.",
      whyAstraKeepsIt: "So Astra can offer Continue Reading/Watching and source return without storing full content.",
      userControls: ["remove_source_history", "privacy_mode", "export_learning_data"],
      contentPolicy: "Source metadata only; avoid sensitive URL parameters and full URL paths in telemetry.",
    },
    {
      id: "review_state",
      label: "Review state",
      count: summary.reviewCardCount + summary.studyProgressPageCount,
      description: "Due cards, review progress, and coarse study-loop counters.",
      whyAstraKeepsIt: "So review stays lightweight and can resume from your learning progress.",
      userControls: ["delete_saved_items", "export_learning_data"],
      contentPolicy: "Counts, card state, and progress metadata; no model output or prompt text.",
    },
    {
      id: "privacy_controls",
      label: "Privacy controls",
      count: profile.excludedHostnames.length + (profile.personalizationEnabled ? 0 : 1),
      description: "Personalization off switch, excluded sites, Privacy Mode, export, and deletion paths.",
      whyAstraKeepsIt: "So memory remains visible, reversible, and bounded by your choices.",
      userControls: ["disable_personalization", "privacy_mode", "export_learning_data"],
      contentPolicy: "Control settings only; not used for advertising profiles.",
    },
  ]
}

export function buildLearningMemoryInventoryFromState(
  input: BuildLearningMemoryInventoryInput,
): LearningMemoryInventory {
  const vocabularyEntries = input.vocabularyEntries ?? []
  const ownedReadingItems = input.ownedReadingItems ?? []
  const readingHistory = input.readingHistory ?? []
  const studyProgress = input.studyProgress ?? { pages: [], dailyStats: { date: "", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 } }
  const projection = input.projection ?? buildLearningAssetProjection({
    vocabularyEntries,
    ownedReadingItems,
    targetLanguage: input.learningProfile.targetLang,
  })

  const summary: LearningMemoryInventorySummary = {
    preferenceCount: countEnabledProfilePreferences(input.learningProfile),
    rememberedTermCount: input.learningProfile.rememberedTerms.length,
    savedSnippetCount: projection.savedSnippets.length,
    reviewCardCount: projection.reviewCards.length,
    sourceContentCount: projection.sourceContents.length,
    ownedReadingCount: ownedReadingItems.length,
    readingHistoryCount: readingHistory.length,
    studyProgressPageCount: studyProgress.pages.length,
  }

  return {
    schema: "astra-learning-memory-inventory.v1",
    generatedAt: normalizeGeneratedAt(input.generatedAt),
    privacyMode: input.privacyMode ?? false,
    personalizationEnabled: input.learningProfile.personalizationEnabled,
    summary,
    sections: buildSections({ profile: input.learningProfile, summary }),
    globalControls: [
      "edit_preferences",
      "disable_personalization",
      "forget_remembered_terms",
      "delete_saved_items",
      "remove_source_history",
      "export_learning_data",
      "privacy_mode",
    ],
    privacyModeEffect: input.privacyMode
      ? "Privacy Mode is on: Astra should suppress automatic topic/source enrichment and keep memory updates to user-initiated saves, review state, and coarse progress metadata."
      : "Privacy Mode is off: Astra may use lightweight learning metadata for continuity, while still avoiding full page text, transcripts, prompts, model output, and sensitive URL details by default.",
    contentPolicy: {
      includesFullPageText: false,
      includesFullTranscriptText: false,
      includesPromptText: false,
      includesModelOutput: false,
      includesFullUrlPaths: false,
      description: "This inventory summarizes what Astra remembers using counts, categories, source metadata, and user-visible controls. It is not a content export and does not include full third-party pages, transcripts, prompts, model output, or full URL paths.",
    },
  }
}

function normalizeLearningMemoryPolicyHostname(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase()
  if (!trimmed) return null
  try {
    return new URL(trimmed).hostname.toLowerCase() || null
  } catch {
    return trimmed
  }
}

function isLearningMemoryHostnameExcluded(
  hostname: string | null,
  excludedHostnames: readonly string[],
): boolean {
  if (!hostname) return false
  return excludedHostnames.some((value) => {
    const excluded = normalizeLearningMemoryPolicyHostname(value)
    return Boolean(excluded && (hostname === excluded || hostname.endsWith(`.${excluded}`)))
  })
}

export async function resolveLearningMemoryWritePolicy(
  input: ResolveLearningMemoryWritePolicyInput,
): Promise<LearningMemoryWritePolicyResult> {
  const [config, learningProfile] = await Promise.all([
    input.config ? Promise.resolve(input.config) : readConfig(),
    input.learningProfile ? Promise.resolve(input.learningProfile) : readLearningProfile(),
  ])
  const hostname = normalizeLearningMemoryPolicyHostname(input.hostname)
    ?? normalizeLearningMemoryPolicyHostname(input.url)

  return evaluateLearningMemoryWritePolicy({
    surface: input.surface,
    privacyMode: config.privacyMode,
    personalizationEnabled: learningProfile.personalizationEnabled,
    userInitiated: input.userInitiated,
    hostnameExcluded: isLearningMemoryHostnameExcluded(hostname, learningProfile.excludedHostnames),
  })
}

export function evaluateLearningMemoryWritePolicy(
  input: LearningMemoryWritePolicyInput,
): LearningMemoryWritePolicyResult {
  if (!input.personalizationEnabled && (input.surface === "remembered_term" || input.surface === "topic_signal")) {
    return {
      decision: "suppress",
      reason: "Personalization memory is disabled.",
      allowedFields: [],
      userFacingCopy: "Astra will stop using this preference.",
    }
  }

  if (input.hostnameExcluded && input.surface !== "user_saved_snippet" && input.surface !== "review_state") {
    return {
      decision: "suppress",
      reason: "This site is excluded from personalization memory.",
      allowedFields: [],
      userFacingCopy: "Astra will not learn preferences from this site.",
    }
  }

  if (input.surface === "remembered_term" && !input.userInitiated) {
    return {
      decision: "suppress",
      reason: "Remembered terms require explicit user confirmation.",
      allowedFields: [],
      userFacingCopy: "Astra will not save glossary or preference changes unless you confirm them.",
    }
  }

  if (input.privacyMode) {
    if (input.surface === "topic_signal" || (!input.userInitiated && input.surface === "remembered_term")) {
      return {
        decision: "suppress",
        reason: "Privacy Mode blocks automatic personalization memory.",
        allowedFields: [],
        userFacingCopy: "Privacy Mode reduces what Astra can remember automatically.",
      }
    }

    if (input.surface === "source_history" || input.surface === "study_progress" || input.surface === "digest_summary") {
      return {
        decision: "reduce",
        reason: "Privacy Mode keeps only coarse continuity metadata.",
        allowedFields: ["sourceType", "hostname", "status", "count", "timestampBucket"],
        userFacingCopy: "Privacy Mode keeps this memory lightweight.",
      }
    }
  }

  switch (input.surface) {
    case "user_saved_snippet":
      return {
        decision: "allow",
        reason: "The learner intentionally saved this item.",
        allowedFields: ["savedText", "translation", "explanation", "sourceRef", "reviewState"],
        userFacingCopy: "Saved for your next review.",
      }
    case "remembered_term":
      return {
        decision: "allow",
        reason: "The learner created or corrected a remembered term.",
        allowedFields: ["sourceTerm", "preferredTerm", "hostname", "createdAt", "updatedAt"],
        userFacingCopy: "Astra remembered this term for future reading.",
      }
    case "review_state":
      return {
        decision: "allow",
        reason: "Review state is required to schedule lightweight practice.",
        allowedFields: ["cardId", "dueAt", "intervalDays", "ease", "reviewCount", "lastReviewedAt"],
        userFacingCopy: "This word is ready for review.",
      }
    case "source_history":
    case "study_progress":
    case "digest_summary":
      return {
        decision: "allow",
        reason: "Continuity metadata helps the learner resume and see progress.",
        allowedFields: ["sourceType", "title", "hostname", "progress", "counts", "lastActivityAt"],
        userFacingCopy: "Continue where you left off.",
      }
    case "topic_signal":
      return {
        decision: "reduce",
        reason: "Topic memory must stay coarse, visible, and deleteable.",
        allowedFields: ["topicLabel", "confidenceBucket", "sourceCount"],
        userFacingCopy: "You can delete this learning preference anytime.",
      }
  }
}

export async function buildLearningMemoryInventory(options: {
  generatedAt?: Date | string | number
  config?: Pick<AstraConfig, "privacyMode">
  learningProfile?: LearningProfile
} = {}): Promise<LearningMemoryInventory> {
  const [config, learningProfile, vocabularyEntries, ownedReadingItems, readingHistory, studyProgress] = await Promise.all([
    options.config ? Promise.resolve(options.config) : readConfig(),
    options.learningProfile ? Promise.resolve(options.learningProfile) : readLearningProfile(),
    getVocabularyEntries(),
    listOwnedReadingItems(),
    getReadingHistory(),
    getStudyProgress(),
  ])

  return buildLearningMemoryInventoryFromState({
    generatedAt: options.generatedAt,
    privacyMode: config.privacyMode,
    learningProfile,
    vocabularyEntries,
    ownedReadingItems,
    readingHistory,
    studyProgress,
  })
}
