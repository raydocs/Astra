export type AstraLibraryAssetTypeId =
  | "saved_pages"
  | "saved_videos"
  | "saved_files"
  | "saved_sentences"
  | "saved_words"
  | "video_notes"
  | "reading_queue"
  | "review_queue"
  | "personal_glossary"
  | "learning_digest"

export type AstraLibraryOrganizationDimensionId =
  | "source_type"
  | "website"
  | "video_channel"
  | "topic"
  | "difficulty"
  | "recently_learned"
  | "due_for_review"
  | "mastered"
  | "common_terms"

export type AstraLibraryHomeQuestionId = "recently_learned" | "review_today" | "continue_learning"

export type AstraLibraryReadinessCode =
  | "asset_types_covered"
  | "auto_organization_dimensions"
  | "no_folder_management_default"
  | "home_recently_learned"
  | "home_review_today"
  | "home_continue_learning"
  | "return_to_source"
  | "learning_trail_not_database"
  | "privacy_safe_digest"

export interface AstraLibraryAssetTypeDefinition {
  id: AstraLibraryAssetTypeId
  label: string
  userValue: string
  defaultStorageBoundary: string
}

export interface AstraLibraryOrganizationDimensionDefinition {
  id: AstraLibraryOrganizationDimensionId
  label: string
  reason: string
  userManagedByDefault: boolean
}

export interface AstraLibraryHomeQuestionDefinition {
  id: AstraLibraryHomeQuestionId
  userQuestion: string
  recommendedSurface: string
  primaryAction: string
}

export interface AstraLibraryReadinessEvidence {
  assetTypesRepresentMacroSet: boolean
  autoOrganizationCoversRequiredDimensions: boolean
  defaultUxAvoidsFolderManagement: boolean
  homeShowsRecentlyLearned: boolean
  homeShowsReviewToday: boolean
  homeShowsContinueLearning: boolean
  savedItemsCanReturnToSource: boolean
  libraryFeelsLikeLearningTrailNotDatabase: boolean
  digestAndSummariesAvoidFullContentByDefault: boolean
}

export interface AstraLibraryReadinessFinding {
  code: AstraLibraryReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraLibraryReadinessDecision {
  ready: boolean
  blockers: AstraLibraryReadinessFinding[]
  warnings: AstraLibraryReadinessFinding[]
  findings: AstraLibraryReadinessFinding[]
}

export const ASTRA_LIBRARY_ASSET_TYPES: AstraLibraryAssetTypeDefinition[] = [
  { id: "saved_pages", label: "Saved Pages", userValue: "Return to pages that produced learning moments.", defaultStorageBoundary: "Source metadata and user-saved snippets; not full page bodies by default." },
  { id: "saved_videos", label: "Saved Videos", userValue: "Keep video learning moments and timestamps discoverable.", defaultStorageBoundary: "Video/source metadata and user-saved notes; not full transcripts by default." },
  { id: "saved_files", label: "Saved Files", userValue: "Continue learning from PDFs, EPUBs, or subtitle files when enabled.", defaultStorageBoundary: "File/source metadata and explicit user saves; not full third-party files by default." },
  { id: "saved_sentences", label: "Saved Sentences", userValue: "Make useful real-content sentences reviewable.", defaultStorageBoundary: "User-initiated snippet/card content." },
  { id: "saved_words", label: "Saved Words", userValue: "Preserve vocabulary discovered in real content.", defaultStorageBoundary: "User-saved vocabulary and review metadata." },
  { id: "video_notes", label: "Video Notes", userValue: "Connect explanations and notes back to video moments.", defaultStorageBoundary: "User-created notes plus coarse source/timestamp metadata." },
  { id: "reading_queue", label: "Reading Queue", userValue: "Show what can be continued next.", defaultStorageBoundary: "Queue/source metadata and progress; not full content snapshots by default." },
  { id: "review_queue", label: "Review Queue", userValue: "Show what should be reviewed today.", defaultStorageBoundary: "Card due state and source linkage." },
  { id: "personal_glossary", label: "Personal Glossary", userValue: "Keep remembered terms understandable and reversible.", defaultStorageBoundary: "Confirmed terms/preferences; no automatic hidden writes for sensitive contexts." },
  { id: "learning_digest", label: "Learning Digest", userValue: "Summarize progress and next steps from the learning trail.", defaultStorageBoundary: "Counts, source titles/types, and review state; no page text or transcripts by default." },
]

export const ASTRA_LIBRARY_ORGANIZATION_DIMENSIONS: AstraLibraryOrganizationDimensionDefinition[] = [
  { id: "source_type", label: "Source type", reason: "Group pages, videos, files, selections, and samples without manual folders.", userManagedByDefault: false },
  { id: "website", label: "Website", reason: "Help users find learning by origin while keeping URL paths out of telemetry.", userManagedByDefault: false },
  { id: "video_channel", label: "Video channel", reason: "Make recurring video sources discoverable.", userManagedByDefault: false },
  { id: "topic", label: "Topic", reason: "Surface themes from saved learning moments.", userManagedByDefault: false },
  { id: "difficulty", label: "Difficulty", reason: "Help learners choose material appropriate to their level.", userManagedByDefault: false },
  { id: "recently_learned", label: "Recently learned", reason: "Answer what the learner just saved or reviewed.", userManagedByDefault: false },
  { id: "due_for_review", label: "Due for review", reason: "Turn the Library into a review entry point instead of an archive.", userManagedByDefault: false },
  { id: "mastered", label: "Mastered", reason: "Show progress without making users maintain folders.", userManagedByDefault: false },
  { id: "common_terms", label: "Common terms", reason: "Make repeated vocabulary visible as a personal glossary signal.", userManagedByDefault: false },
]

export const ASTRA_LIBRARY_HOME_QUESTIONS: AstraLibraryHomeQuestionDefinition[] = [
  {
    id: "recently_learned",
    userQuestion: "What did I recently learn?",
    recommendedSurface: "Recent saved words, sentences, sources, and reviewed cards.",
    primaryAction: "Open recent item",
  },
  {
    id: "review_today",
    userQuestion: "What should I review today?",
    recommendedSurface: "A lightweight due-card card with count, time estimate, and source mix.",
    primaryAction: "Start review",
  },
  {
    id: "continue_learning",
    userQuestion: "What can I continue reading or watching?",
    recommendedSurface: "Reading queue and source cards sorted by last studied position.",
    primaryAction: "Continue source",
  },
]

export const ASTRA_LIBRARY_DEFAULT_COPY = [
  "Your learning trail",
  "Recently learned",
  "Review today",
  "Continue learning",
  "Saved from this source",
] as const

const READINESS_CHECKS: Array<{
  code: AstraLibraryReadinessCode
  evidenceKey: keyof AstraLibraryReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "asset_types_covered", evidenceKey: "assetTypesRepresentMacroSet", severity: "block", message: "The Library asset model does not cover the macro asset set.", nextStep: "Represent saved pages/videos/files/sentences/words, video notes, queues, glossary, and digest." },
  { code: "auto_organization_dimensions", evidenceKey: "autoOrganizationCoversRequiredDimensions", severity: "block", message: "The Library relies on incomplete organization dimensions.", nextStep: "Auto-organize by source type, site/channel, topic, difficulty, recency, due state, mastery, and common terms." },
  { code: "no_folder_management_default", evidenceKey: "defaultUxAvoidsFolderManagement", severity: "block", message: "The default Library UX behaves like manual folder management.", nextStep: "Keep folders/bulk management out of the default path; prefer automatic source and learning-state groups." },
  { code: "home_recently_learned", evidenceKey: "homeShowsRecentlyLearned", severity: "block", message: "The Library home does not answer what the learner recently learned.", nextStep: "Show recent saved/reviewed moments with source context." },
  { code: "home_review_today", evidenceKey: "homeShowsReviewToday", severity: "block", message: "The Library home does not answer what should be reviewed today.", nextStep: "Show due review count/time estimate and a Start review action." },
  { code: "home_continue_learning", evidenceKey: "homeShowsContinueLearning", severity: "block", message: "The Library home does not answer what can be continued.", nextStep: "Show reading/video/file queue cards with Continue source actions." },
  { code: "return_to_source", evidenceKey: "savedItemsCanReturnToSource", severity: "block", message: "Saved Library items cannot reliably return to their source context.", nextStep: "Preserve source IDs, titles, host/channel, URLs where user-visible, and timestamps/positions when available." },
  { code: "learning_trail_not_database", evidenceKey: "libraryFeelsLikeLearningTrailNotDatabase", severity: "warn", message: "The Library risks feeling like a complex database.", nextStep: "Use learning-trail copy, one primary action per section, and hide low-frequency management controls." },
  { code: "privacy_safe_digest", evidenceKey: "digestAndSummariesAvoidFullContentByDefault", severity: "block", message: "Library summaries or digest may include full third-party content by default.", nextStep: "Use counts, source titles/types, review state, and user-saved snippets only where explicitly displayed." },
]

export function evaluateAstraLibraryReadiness(evidence: AstraLibraryReadinessEvidence): AstraLibraryReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraLibraryReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
