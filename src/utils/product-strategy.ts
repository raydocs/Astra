export type AstraPersonaId =
  | "chinese_knowledge_worker"
  | "english_video_learner"
  | "student_exam_learner"
  | "work_communication_user"
  | "ai_power_user"

export type AstraPersonaPriority = "P0" | "P1" | "P2"

export type AstraJtbdScenarioId =
  | "read_article_understand"
  | "read_technical_documentation"
  | "watch_english_video"
  | "explain_word_or_phrase"
  | "write_natural_english"
  | "daily_review"
  | "weekly_learning_recap"

export type AstraDefaultEntryId =
  | "landing_hero"
  | "chrome_store_listing"
  | "onboarding_goal"
  | "sample_lesson"
  | "content_selection_toolbar"
  | "video_transcript_panel"
  | "library_home"
  | "review_queue"
  | "weekly_digest"
  | "paywall"
  | "help_center"

export type AstraLearningAssetKind =
  | "SourceContent"
  | "SavedSnippet"
  | "ReviewCard"
  | "ReviewSession"
  | "VocabularyItem"
  | "Glossary"
  | "VideoNote"
  | "Moment"
  | "CorrectionCard"
  | "Digest"
  | "Stats"
  | "Word"
  | "Page"
  | "Sentence"

export type AstraPaywallTierId = "free" | "trial" | "pro"

export type AstraPaywallTriggerId =
  | "before_first_value"
  | "after_first_understanding"
  | "free_limit_exceeded"
  | "long_video_or_article"
  | "library_sync"
  | "weekly_digest"
  | "learning_export"
  | "priority_support"

export type AstraTrialAhaMomentId =
  | "understand_real_content"
  | "save_for_review"
  | "see_long_term_value"

export type AstraProductStrategyReadinessCode =
  | "beachhead_persona_defined"
  | "persona_copy_unified"
  | "onboarding_questions_scoped"
  | "sample_content_coverage"
  | "growth_channels_persona_aligned"
  | "default_entries_mapped_to_jtbd"
  | "jtbd_success_moments"
  | "jtbd_next_steps"
  | "jtbd_assets_return_to_source"
  | "jtbd_fallbacks"
  | "paywall_non_technical_copy"
  | "paywall_after_first_value"
  | "trial_aha_moments"
  | "cancellation_asset_access"
  | "beta_billing_boundary"

export interface AstraPersonaDefinition {
  id: AstraPersonaId
  priority: AstraPersonaPriority
  label: string
  typicalScenarios: string[]
  painPoints: string[]
  astraPromise: string
  notPrioritized: string[]
}

export interface AstraBeachheadPersonaDefinition {
  id: "beachhead_chinese_real_content_learner"
  summary: string
  mustInclude: string[]
  mustAvoidDefaultingTo: string[]
  defaultProductMindset: string
}

export interface AstraJtbdScenarioDefinition {
  id: AstraJtbdScenarioId
  priority: "P0" | "P1"
  userSays: string
  jobToBeDone: string
  successMoment: string
  nextBestAction: string
  savedAssets: AstraLearningAssetKind[]
  fallbackActions: string[]
  metrics: string[]
}

export interface AstraDefaultEntryJtbdMapping {
  entry: AstraDefaultEntryId
  scenarioIds: AstraJtbdScenarioId[]
  primaryAction: string
  defaultCopyDirection: string
  advancedOnly?: boolean
}

export interface AstraPaywallTierDefinition {
  id: AstraPaywallTierId
  publicLabel: string
  publicPromise: string
  capabilityBoundary: string[]
}

export interface AstraPaywallTriggerDefinition {
  id: AstraPaywallTriggerId
  copyDirection: string
  hardBlock: boolean
  allowedBeforeFirstUnderstanding: boolean
}

export interface AstraTrialAhaMomentDefinition {
  id: AstraTrialAhaMomentId
  goal: string
  productAction: string
  recommendedDay: "day_0" | "day_1" | "day_2_to_3"
}

export interface AstraProductStrategyReadinessEvidence {
  beachheadPersonaDefined: boolean
  personaCopyUnifiedAcrossOnboardingLandingStorePaywall: boolean
  onboardingCoreQuestionsAtMostThree: boolean
  sampleContentCoversArticleDocVideo: boolean
  p0GrowthChannelsPersonaAligned: boolean
  defaultEntriesMappedToJtbd: boolean
  everyJtbdHasSuccessMoment: boolean
  everyJtbdHasNextStep: boolean
  p0AssetsCanReturnToSource: boolean
  p0FailuresHaveFallback: boolean
  paywallCopyHasZeroTechnicalTerms: boolean
  noHardPaywallBeforeFirstValue: boolean
  trialAhaMomentsInstrumented: boolean
  cancellationKeepsExistingAssetsAccessible: boolean
  betaBillingBoundaryRespected: boolean
}

export interface AstraProductStrategyFinding {
  code: AstraProductStrategyReadinessCode
  severity: "block"
  message: string
  nextStep: string
}

export interface AstraProductStrategyDecision {
  ready: boolean
  findings: AstraProductStrategyFinding[]
}

export const ASTRA_BEACHHEAD_PERSONA: AstraBeachheadPersonaDefinition = {
  id: "beachhead_chinese_real_content_learner",
  summary:
    "Chinese-native knowledge workers, students, and self-directed learners who encounter English web pages, videos, and documents every day and want understanding plus review without AI setup.",
  mustInclude: [
    "Chinese-native user or Chinese-first explanation context",
    "Reads English web pages, technical docs, news, papers, or watches English tutorials",
    "Wants to understand real content faster",
    "Wants useful expressions saved into reviewable learning assets",
    "Does not want to configure providers, API keys, models, or prompts",
  ],
  mustAvoidDefaultingTo: [
    "all language learners",
    "AI provider console users",
    "complete course or LMS buyers",
    "generic translation-only users",
  ],
  defaultProductMindset: "Astra is the language teacher that appears while the user reads, watches, saves, and reviews real content.",
}

export const ASTRA_PERSONAS: AstraPersonaDefinition[] = [
  {
    id: "chinese_knowledge_worker",
    priority: "P0",
    label: "Chinese knowledge worker",
    typicalScenarios: ["English news", "technical documentation", "blogs", "reports"],
    painPoints: ["slow reading", "unstable terminology", "no learning asset after reading"],
    astraPromise: "Understand real English content faster and save key expressions for review.",
    notPrioritized: ["complex model configuration"],
  },
  {
    id: "english_video_learner",
    priority: "P0",
    label: "English video learner",
    typicalScenarios: ["YouTube tutorials", "open courses", "interviews"],
    painPoints: ["subtitles move too fast", "useful sentences are forgotten"],
    astraPromise: "Understand video moments and save reusable sentences.",
    notPrioritized: ["promising every video platform"],
  },
  {
    id: "student_exam_learner",
    priority: "P1",
    label: "Student or exam learner",
    typicalScenarios: ["papers", "course materials", "exam reading"],
    painPoints: ["hard sentences", "academic vocabulary"],
    astraPromise: "Explain difficult passages and turn vocabulary into review cards.",
    notPrioritized: ["complete exam course"],
  },
  {
    id: "work_communication_user",
    priority: "P1",
    label: "Work communication user",
    typicalScenarios: ["email", "Slack", "Notion", "Docs"],
    painPoints: ["understanding and natural expression"],
    astraPromise: "Improve natural English expression and remember corrected patterns.",
    notPrioritized: ["team collaboration suite"],
  },
  {
    id: "ai_power_user",
    priority: "P2",
    label: "AI power user",
    typicalScenarios: ["custom API", "prompt control", "model control"],
    painPoints: ["cost and routing control"],
    astraPromise: "Advanced mode can preserve control without shaping the default experience.",
    notPrioritized: ["default product surface"],
  },
]

export const ASTRA_JTBD_SCENARIOS: AstraJtbdScenarioDefinition[] = [
  {
    id: "read_article_understand",
    priority: "P0",
    userSays: "I want to quickly understand this English article.",
    jobToBeDone: "Turn the current web page into understandable learning content without leaving the page.",
    successMoment: "The first screen or selected passage becomes readable and useful.",
    nextBestAction: "Save a sentence or continue with Deep Read.",
    savedAssets: ["Page", "Sentence", "Word", "SourceContent", "SavedSnippet", "ReviewCard"],
    fallbackActions: ["translate selected passage", "open reader", "retry later"],
    metrics: ["first_content_understood", "first_save_after_understanding", "return_to_source"],
  },
  {
    id: "read_technical_documentation",
    priority: "P0",
    userSays: "Do not mistranslate the technical terms.",
    jobToBeDone: "Understand technical concepts while keeping terminology stable.",
    successMoment: "A technical term receives a stable explanation in context.",
    nextBestAction: "Add the term to the personal glossary.",
    savedAssets: ["Glossary", "SavedSnippet", "ReviewCard"],
    fallbackActions: ["use simplified explanation", "save term for later review"],
    metrics: ["term_explained", "glossary_term_saved", "technical_content_returned"],
  },
  {
    id: "watch_english_video",
    priority: "P0",
    userSays: "I want to understand while watching.",
    jobToBeDone: "Turn video language input into understandable and saveable learning moments.",
    successMoment: "The current subtitle or video sentence becomes understandable.",
    nextBestAction: "Save the sentence or generate a note.",
    savedAssets: ["VideoNote", "Moment", "Word", "SavedSnippet", "ReviewCard"],
    fallbackActions: ["show no-subtitle explanation", "manually select a segment"],
    metrics: ["video_moment_understood", "video_sentence_saved", "video_note_created"],
  },
  {
    id: "explain_word_or_phrase",
    priority: "P0",
    userSays: "What does this word mean here?",
    jobToBeDone: "Explain a word or phrase based on the surrounding context.",
    successMoment: "The explanation matches the current sentence.",
    nextBestAction: "Save it as a review card.",
    savedAssets: ["VocabularyItem", "ReviewCard"],
    fallbackActions: ["show a brief translation"],
    metrics: ["contextual_phrase_explained", "vocabulary_saved"],
  },
  {
    id: "write_natural_english",
    priority: "P1",
    userSays: "I want to express this naturally in English.",
    jobToBeDone: "Turn Chinese or Chinese-influenced English into a usable natural English expression.",
    successMoment: "The input box receives a usable expression.",
    nextBestAction: "Save the correction as a learning card.",
    savedAssets: ["CorrectionCard", "ReviewCard"],
    fallbackActions: ["copy suggestion to clipboard"],
    metrics: ["writing_suggestion_used", "correction_card_saved"],
  },
  {
    id: "daily_review",
    priority: "P0",
    userSays: "What should I study today?",
    jobToBeDone: "Complete a low-friction review session.",
    successMoment: "Three to five cards are reviewed.",
    nextBestAction: "Return to the original source or continue a source.",
    savedAssets: ["ReviewSession"],
    fallbackActions: ["reduce today's goal"],
    metrics: ["review_opened", "review_card_answered", "review_session_completed"],
  },
  {
    id: "weekly_learning_recap",
    priority: "P1",
    userSays: "What did I learn this week?",
    jobToBeDone: "See long-term value from saved and reviewed learning assets.",
    successMoment: "The weekly digest clearly summarizes progress.",
    nextBestAction: "Continue an unfinished source.",
    savedAssets: ["Digest", "Stats"],
    fallbackActions: ["show local data only"],
    metrics: ["digest_opened", "continue_clicked", "weekly_reviewable_learning_moment"],
  },
]

export const ASTRA_DEFAULT_ENTRY_JTBD_MAPPINGS: AstraDefaultEntryJtbdMapping[] = [
  {
    entry: "landing_hero",
    scenarioIds: ["read_article_understand", "watch_english_video", "daily_review"],
    primaryAction: "install_or_try_sample",
    defaultCopyDirection: "Real English content becomes understandable, saveable, and reviewable without AI setup.",
  },
  {
    entry: "chrome_store_listing",
    scenarioIds: ["read_article_understand", "watch_english_video", "explain_word_or_phrase"],
    primaryAction: "install_extension",
    defaultCopyDirection: "Show page/video understanding, saving, Review, and zero setup in that order.",
  },
  {
    entry: "onboarding_goal",
    scenarioIds: ["read_article_understand", "watch_english_video", "daily_review"],
    primaryAction: "choose_learning_goal",
    defaultCopyDirection: "Ask at most three core questions before the sample or first real-content success.",
  },
  {
    entry: "sample_lesson",
    scenarioIds: ["read_article_understand", "explain_word_or_phrase", "daily_review"],
    primaryAction: "complete_first_success_loop",
    defaultCopyDirection: "Understand a realistic sample, save one expression, and finish one review card.",
  },
  {
    entry: "content_selection_toolbar",
    scenarioIds: ["read_article_understand", "explain_word_or_phrase", "write_natural_english"],
    primaryAction: "understand_or_save_selection",
    defaultCopyDirection: "Offer one primary next step for the selected text before advanced options.",
  },
  {
    entry: "video_transcript_panel",
    scenarioIds: ["watch_english_video"],
    primaryAction: "understand_current_video_moment",
    defaultCopyDirection: "Keep subtitle understanding and saveable moments ahead of platform-specific controls.",
  },
  {
    entry: "library_home",
    scenarioIds: ["daily_review", "weekly_learning_recap", "read_article_understand"],
    primaryAction: "continue_learning_from_assets",
    defaultCopyDirection: "Show review due, recent learning, and continue-source paths before raw asset management.",
  },
  {
    entry: "review_queue",
    scenarioIds: ["daily_review"],
    primaryAction: "complete_daily_review",
    defaultCopyDirection: "A short session should feel finishable and point back to source context.",
  },
  {
    entry: "weekly_digest",
    scenarioIds: ["weekly_learning_recap", "daily_review"],
    primaryAction: "see_progress_and_continue",
    defaultCopyDirection: "Use aggregate learning value and continue-source prompts, not raw content telemetry.",
  },
  {
    entry: "paywall",
    scenarioIds: ["read_article_understand", "watch_english_video", "weekly_learning_recap"],
    primaryAction: "understand_pro_value",
    defaultCopyDirection: "Sell peace of mind, stability, learning assets, sync, digest, and support without technical terms.",
  },
  {
    entry: "help_center",
    scenarioIds: ["read_article_understand", "watch_english_video", "daily_review"],
    primaryAction: "resolve_learning_flow_question",
    defaultCopyDirection: "Use examples from real reading, video, saving, and review flows.",
  },
]

export const ASTRA_PAYWALL_TIERS: AstraPaywallTierDefinition[] = [
  {
    id: "free",
    publicLabel: "Free",
    publicPromise: "Complete first success and a lightweight learning loop.",
    capabilityBoundary: [
      "sample page",
      "light daily web understanding",
      "limited selection explanations",
      "small saved-word/sentence set",
      "local basic Review and Library",
      "local simple weekly digest",
      "documentation support",
    ],
  },
  {
    id: "trial",
    publicLabel: "Trial",
    publicPromise: "Experience Pro value through three aha moments before deciding.",
    capabilityBoundary: [
      "higher usage",
      "longer content",
      "video and file learning trial",
      "complete Review and Library experience",
      "sync preview when available",
      "basic support",
    ],
  },
  {
    id: "pro",
    publicLabel: "Pro",
    publicPromise: "Astra handles the AI so the user can focus on reading and learning.",
    capabilityBoundary: [
      "managed AI experience",
      "higher fair-use limits",
      "long content and video/file learning",
      "deeper explanations",
      "Review and Library sync",
      "complete digest",
      "priority support",
    ],
  },
]

export const ASTRA_PAYWALL_TRIGGERS: AstraPaywallTriggerDefinition[] = [
  {
    id: "before_first_value",
    copyDirection: "Do not hard sell; explain the learning value only.",
    hardBlock: false,
    allowedBeforeFirstUnderstanding: true,
  },
  {
    id: "after_first_understanding",
    copyDirection: "Save and review more real content with Pro.",
    hardBlock: false,
    allowedBeforeFirstUnderstanding: false,
  },
  {
    id: "free_limit_exceeded",
    copyDirection: "Continue learning with Pro.",
    hardBlock: true,
    allowedBeforeFirstUnderstanding: false,
  },
  {
    id: "long_video_or_article",
    copyDirection: "Longer videos and deeper reading are included with Pro.",
    hardBlock: true,
    allowedBeforeFirstUnderstanding: false,
  },
  {
    id: "library_sync",
    copyDirection: "Keep your learning across devices.",
    hardBlock: true,
    allowedBeforeFirstUnderstanding: false,
  },
  {
    id: "weekly_digest",
    copyDirection: "Your weekly learning summary is included with Pro.",
    hardBlock: false,
    allowedBeforeFirstUnderstanding: false,
  },
  {
    id: "learning_export",
    copyDirection: "Export is included with Pro while existing saved items remain accessible.",
    hardBlock: true,
    allowedBeforeFirstUnderstanding: false,
  },
  {
    id: "priority_support",
    copyDirection: "Priority support is included with Pro.",
    hardBlock: true,
    allowedBeforeFirstUnderstanding: false,
  },
]

export const ASTRA_TRIAL_AHA_MOMENTS: AstraTrialAhaMomentDefinition[] = [
  {
    id: "understand_real_content",
    goal: "User understands a real web page, document, or video moment.",
    productAction: "Guide to a sample or current-page understanding action.",
    recommendedDay: "day_0",
  },
  {
    id: "save_for_review",
    goal: "User saves a sentence, word, or correction as a reviewable asset.",
    productAction: "Show the Review card immediately after saving.",
    recommendedDay: "day_0",
  },
  {
    id: "see_long_term_value",
    goal: "User sees Library, Digest, or continue-source value.",
    productAction: "Prompt Library/Digest on trial day 2 or 3.",
    recommendedDay: "day_2_to_3",
  },
]

export const ASTRA_PAYWALL_TECHNICAL_TERMS = [
  "token",
  "tokens",
  "provider",
  "providers",
  "model",
  "models",
  "batch",
  "route",
  "routing",
  "cache",
  "relay",
  "api key",
  "api-key",
  "openai",
  "gemini",
  "openrouter",
] as const

const READINESS_CHECKS: Array<{
  code: AstraProductStrategyReadinessCode
  evidenceKey: keyof AstraProductStrategyReadinessEvidence
  message: string
  nextStep: string
}> = [
  {
    code: "beachhead_persona_defined",
    evidenceKey: "beachheadPersonaDefined",
    message: "The first-stage beachhead persona is not explicitly defined.",
    nextStep: "Anchor default copy to Chinese-native real-content learners who want zero AI setup.",
  },
  {
    code: "persona_copy_unified",
    evidenceKey: "personaCopyUnifiedAcrossOnboardingLandingStorePaywall",
    message: "Onboarding, landing, store, and paywall copy are not aligned to the P0 persona.",
    nextStep: "Use the same real-content learning promise across public and first-run surfaces.",
  },
  {
    code: "onboarding_questions_scoped",
    evidenceKey: "onboardingCoreQuestionsAtMostThree",
    message: "Onboarding asks too many default questions before first success.",
    nextStep: "Keep first-run onboarding to three or fewer core questions before the sample/current-page success path.",
  },
  {
    code: "sample_content_coverage",
    evidenceKey: "sampleContentCoversArticleDocVideo",
    message: "Sample content does not cover article, technical documentation, and video-summary use cases.",
    nextStep: "Provide representative sample content for the P0 persona across those content types.",
  },
  {
    code: "growth_channels_persona_aligned",
    evidenceKey: "p0GrowthChannelsPersonaAligned",
    message: "P0 growth channels do not share the same beachhead-persona promise.",
    nextStep: "Align landing, store listing, demos, and share-card copy around real-content learning.",
  },
  {
    code: "default_entries_mapped_to_jtbd",
    evidenceKey: "defaultEntriesMappedToJtbd",
    message: "Some default product entries are not mapped to a JTBD scenario.",
    nextStep: "Map each default entry to a scenario or move it to Advanced/Settings/backlog.",
  },
  {
    code: "jtbd_success_moments",
    evidenceKey: "everyJtbdHasSuccessMoment",
    message: "Some JTBD scenarios lack a clear success moment.",
    nextStep: "Define what the user sees or accomplishes when the job is complete.",
  },
  {
    code: "jtbd_next_steps",
    evidenceKey: "everyJtbdHasNextStep",
    message: "Some JTBD scenarios do not guide the user to the next learning step.",
    nextStep: "Add save, review, continue-source, or digest next-best actions.",
  },
  {
    code: "jtbd_assets_return_to_source",
    evidenceKey: "p0AssetsCanReturnToSource",
    message: "P0 learning assets are not proven to return to their source context.",
    nextStep: "Verify source IDs, source titles, video moments, or page references are preserved for P0 assets.",
  },
  {
    code: "jtbd_fallbacks",
    evidenceKey: "p0FailuresHaveFallback",
    message: "P0 scenario failures do not all have fallback actions.",
    nextStep: "Add selected-text fallback, simplified explanation, retry, local-only, or goal-reduction fallback paths.",
  },
  {
    code: "paywall_non_technical_copy",
    evidenceKey: "paywallCopyHasZeroTechnicalTerms",
    message: "Paywall copy still contains technical infrastructure terms.",
    nextStep: "Rewrite value copy around peace of mind, stability, learning assets, sync, digest, and support.",
  },
  {
    code: "paywall_after_first_value",
    evidenceKey: "noHardPaywallBeforeFirstValue",
    message: "A hard paywall can appear before the user has understood product value.",
    nextStep: "Move hard blocks after first understanding or make pre-value prompts soft educational copy.",
  },
  {
    code: "trial_aha_moments",
    evidenceKey: "trialAhaMomentsInstrumented",
    message: "Trial does not guide users through the three required aha moments.",
    nextStep: "Instrument understand-real-content, save-for-review, and see-long-term-value moments.",
  },
  {
    code: "cancellation_asset_access",
    evidenceKey: "cancellationKeepsExistingAssetsAccessible",
    message: "Cancellation/data-access promise is not explicit.",
    nextStep: "State and implement that existing saved items remain viewable/exportable after cancellation.",
  },
  {
    code: "beta_billing_boundary",
    evidenceKey: "betaBillingBoundaryRespected",
    message: "Beta billing boundaries are not respected.",
    nextStep: "Keep checkout, pricing claims, and billing portal hidden until billing/legal readiness is signed off.",
  },
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function findPaywallTechnicalTerms(copy: string): string[] {
  const normalized = copy.toLowerCase()
  return ASTRA_PAYWALL_TECHNICAL_TERMS.filter((term) => {
    const escaped = escapeRegExp(term)
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(normalized)
  })
}

export function getJtbdForDefaultEntry(entry: AstraDefaultEntryId): AstraDefaultEntryJtbdMapping | undefined {
  return ASTRA_DEFAULT_ENTRY_JTBD_MAPPINGS.find((mapping) => mapping.entry === entry)
}

export function evaluateAstraProductStrategyReadiness(
  evidence: AstraProductStrategyReadinessEvidence,
): AstraProductStrategyDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraProductStrategyFinding>((check) => ({
      code: check.code,
      severity: "block",
      message: check.message,
      nextStep: check.nextStep,
    }))

  return {
    ready: findings.length === 0,
    findings,
  }
}
