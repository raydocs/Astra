export type AstraFirstSuccessStepId =
  | "install_astra"
  | "choose_target_language"
  | "optional_sign_in_or_membership_start"
  | "first_content_understood"
  | "save_word_or_sentence"
  | "first_review_seen"

export type AstraOnboardingQuestionId = "target_language" | "language_level" | "primary_goal"

export type AstraForbiddenOnboardingQuestionId =
  | "model"
  | "provider"
  | "prompt"
  | "technical_configuration"
  | "advanced_site_rules"
  | "sync_details"

export type AstraFirstSuccessMetricId =
  | "install_to_first_understood_seconds"
  | "first_understanding_success_rate"
  | "first_save_rate"
  | "first_review_reach_rate"
  | "day_after_first_use_return_rate"

export type AstraFirstSuccessReadinessCode =
  | "under_sixty_seconds"
  | "three_question_onboarding"
  | "no_technical_onboarding"
  | "sample_page_entry"
  | "sample_article_understanding"
  | "recommended_sentence_save"
  | "one_card_review"
  | "first_review_card_copy"
  | "activation_events"
  | "no_content_telemetry"
  | "success_rate_target"
  | "first_save_target"
  | "first_review_target"

export type AstraFirstSuccessSmokeFindingCode =
  | "missing_required_event"
  | "missing_first_value_timing"
  | "over_sixty_seconds"
  | "missing_first_save"
  | "missing_first_review"
  | "content_text_field_present"

export type AstraFirstSuccessSmokeEvidenceRowId =
  | "path_completed"
  | "event_sequence_observed"
  | "time_to_first_value_recorded"
  | "content_free_telemetry_checked"
  | "first_save_and_review_observed"

export interface AstraFirstSuccessStepDefinition {
  id: AstraFirstSuccessStepId
  label: string
  required: boolean
  expectedUserOutcome: string
}

export interface AstraSampleLessonStepDefinition {
  order: number
  label: string
  acceptance: string
}

export interface AstraFirstSuccessMetricDefinition {
  id: AstraFirstSuccessMetricId
  label: string
  target: string
  privacyBoundary: string
}

export interface AstraFirstSuccessSmokeEvidenceRow {
  id: AstraFirstSuccessSmokeEvidenceRowId
  label: string
  acceptance: string
  remainingReleaseProof: string
}

export interface AstraFirstSuccessSmokeReport {
  observedEventNames: readonly string[]
  secondsToFirstContentUnderstood: number | null
  telemetryFieldNames: readonly string[]
  savedItemCreated: boolean
  reviewCompleted: boolean
}

export interface AstraFirstSuccessSmokeFinding {
  code: AstraFirstSuccessSmokeFindingCode
  message: string
  nextStep: string
}

export interface AstraFirstSuccessSmokeDecision {
  ready: boolean
  findings: AstraFirstSuccessSmokeFinding[]
}

export interface AstraFirstSuccessReadinessEvidence {
  installToFirstUnderstoodUnder60Seconds: boolean
  onboardingUsesOnlyThreeCoreQuestions: boolean
  onboardingAvoidsTechnicalQuestions: boolean
  samplePageEntryAvailable: boolean
  sampleArticleShowsUnderstandableContent: boolean
  recommendedSentenceCanBeSaved: boolean
  oneCardReviewReachable: boolean
  firstReviewCardCopyShown: boolean
  activationEventsRecorded: boolean
  activationTelemetryAvoidsContent: boolean
  firstUnderstandingSuccessRateTargetMet: boolean
  firstSaveRateTargetMet: boolean
  firstReviewReachTargetMet: boolean
}

export interface AstraFirstSuccessFinding {
  code: AstraFirstSuccessReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraFirstSuccessDecision {
  ready: boolean
  blockers: AstraFirstSuccessFinding[]
  warnings: AstraFirstSuccessFinding[]
  findings: AstraFirstSuccessFinding[]
}

export const ASTRA_FIRST_SUCCESS_STEPS: AstraFirstSuccessStepDefinition[] = [
  {
    id: "install_astra",
    label: "Install Astra",
    required: true,
    expectedUserOutcome: "The user has a clear next step after installation.",
  },
  {
    id: "choose_target_language",
    label: "Choose target language",
    required: true,
    expectedUserOutcome: "The user can personalize the learning direction without technical setup.",
  },
  {
    id: "optional_sign_in_or_membership_start",
    label: "Sign in or start membership when appropriate",
    required: false,
    expectedUserOutcome: "Account continuity is available without blocking first understanding unnecessarily.",
  },
  {
    id: "first_content_understood",
    label: "Complete first understanding",
    required: true,
    expectedUserOutcome: "The user sees that they can understand real or sample foreign-language content.",
  },
  {
    id: "save_word_or_sentence",
    label: "Save one word or sentence",
    required: true,
    expectedUserOutcome: "The first understood moment becomes a learning asset.",
  },
  {
    id: "first_review_seen",
    label: "See first Review",
    required: true,
    expectedUserOutcome: "The user sees that saved content can return as review.",
  },
]

export const ASTRA_FIRST_SUCCESS_ONBOARDING_QUESTIONS: Record<AstraOnboardingQuestionId, string> = {
  target_language: "What language do you want Astra to help with?",
  language_level: "What is your approximate level?",
  primary_goal: "What do you mainly want to use Astra for?",
}

export const ASTRA_FIRST_SUCCESS_FORBIDDEN_ONBOARDING_QUESTIONS: Record<AstraForbiddenOnboardingQuestionId, string> = {
  model: "Do not ask users to choose a model in first-run onboarding.",
  provider: "Do not ask users to choose a provider in first-run onboarding.",
  prompt: "Do not ask users to configure prompts in first-run onboarding.",
  technical_configuration: "Do not require technical configuration before first success.",
  advanced_site_rules: "Do not expose advanced site rules before first success.",
  sync_details: "Do not ask detailed sync questions before first success.",
}

export const ASTRA_SAMPLE_LESSON_STEPS: AstraSampleLessonStepDefinition[] = [
  { order: 1, label: "Try Astra on a sample page", acceptance: "Onboarding or welcome UI exposes the sample-page entry." },
  { order: 2, label: "Open a short article", acceptance: "The sample opens a short, realistic reading surface." },
  { order: 3, label: "Astra shows understandable content", acceptance: "The sample demonstrates first content understood without requiring another website." },
  { order: 4, label: "Highlight a recommended sentence", acceptance: "A recommended sentence is visible and framed as worth saving." },
  { order: 5, label: "Save the sentence", acceptance: "The sentence can become a real saved learning item." },
  { order: 6, label: "Enter one-card Review", acceptance: "The saved item appears in a one-card Review flow." },
  { order: 7, label: "Show first review card copy", acceptance: "The user sees `You just created your first review card`." },
]

export const ASTRA_FIRST_SUCCESS_METRICS: AstraFirstSuccessMetricDefinition[] = [
  {
    id: "install_to_first_understood_seconds",
    label: "Install to first understandable content",
    target: "< 60 seconds",
    privacyBoundary: "Duration and source type only; no page text or selected text.",
  },
  {
    id: "first_understanding_success_rate",
    label: "First understanding success rate",
    target: "> 95%",
    privacyBoundary: "Success/failure and coarse source type only.",
  },
  {
    id: "first_save_rate",
    label: "First saved word/sentence rate",
    target: "> 25%",
    privacyBoundary: "Save event metadata only; no saved snippet text.",
  },
  {
    id: "first_review_reach_rate",
    label: "First Review reach rate",
    target: "> 15%",
    privacyBoundary: "Review reach/completion metadata only; no card text.",
  },
  {
    id: "day_after_first_use_return_rate",
    label: "Day-after-first-use return",
    target: "Optimize by cohort after launch",
    privacyBoundary: "Aggregate cohort retention only.",
  },
]

export const ASTRA_FIRST_SUCCESS_EVENT_NAMES = [
  "onboarding_completed",
  "first_content_understood",
  "saved_snippet_created",
  "review_session_completed",
] as const

export const ASTRA_FIRST_SUCCESS_SMOKE_EVIDENCE_ROWS: AstraFirstSuccessSmokeEvidenceRow[] = [
  {
    id: "path_completed",
    label: "First-success path completed",
    acceptance: "The smoke report identifies the onboarding/sample path and records that it reached first understanding, save, and one-card Review.",
    remainingReleaseProof: "Attach a dated smoke report with owner, environment, build/commit, and artifact links before using it as RC evidence.",
  },
  {
    id: "event_sequence_observed",
    label: "Activation event sequence observed",
    acceptance: "The report includes onboarding_completed, first_content_understood, saved_snippet_created, and review_session_completed.",
    remainingReleaseProof: "Use target-release telemetry or browser artifact output rather than inferred implementation evidence.",
  },
  {
    id: "time_to_first_value_recorded",
    label: "Time to first understandable content recorded",
    acceptance: "The report records seconds to first_content_understood and flags values above 60 seconds.",
    remainingReleaseProof: "A single smoke run can prove path timing only for that environment; cohort target claims still require aggregate exports.",
  },
  {
    id: "content_free_telemetry_checked",
    label: "Telemetry fields checked for content exclusion",
    acceptance: "The report lists telemetry field names and excludes raw text, selected text, saved snippet text, transcript text, prompts, and model output.",
    remainingReleaseProof: "Attach the actual field inventory or exported event sample before stronger privacy/metric claims.",
  },
  {
    id: "first_save_and_review_observed",
    label: "First save and Review observed",
    acceptance: "The report confirms a saved learning item was created and the first Review completed.",
    remainingReleaseProof: "Attach screenshots/browser artifacts or telemetry export proving save/review for the target build.",
  },
]

const ASTRA_FIRST_SUCCESS_FORBIDDEN_TELEMETRY_FIELDS = [
  "text",
  "pageText",
  "selectedText",
  "savedText",
  "snippet",
  "cardText",
  "transcript",
  "prompt",
  "modelOutput",
] as const

const READINESS_CHECKS: Array<{
  code: AstraFirstSuccessReadinessCode
  evidenceKey: keyof AstraFirstSuccessReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "under_sixty_seconds",
    evidenceKey: "installToFirstUnderstoodUnder60Seconds",
    severity: "block",
    message: "First understandable content is not proven reachable within 60 seconds.",
    nextStep: "Keep onboarding short and provide sample/current-page routes that reach first understanding quickly.",
  },
  {
    code: "three_question_onboarding",
    evidenceKey: "onboardingUsesOnlyThreeCoreQuestions",
    severity: "block",
    message: "First-run onboarding asks more than the three core activation questions.",
    nextStep: "Ask only target language, approximate level, and primary goal before first success.",
  },
  {
    code: "no_technical_onboarding",
    evidenceKey: "onboardingAvoidsTechnicalQuestions",
    severity: "block",
    message: "First-run onboarding exposes technical setup questions.",
    nextStep: "Remove model/provider/prompt/advanced site rules/sync detail questions from first-run onboarding.",
  },
  {
    code: "sample_page_entry",
    evidenceKey: "samplePageEntryAvailable",
    severity: "block",
    message: "Try Astra on a sample page is not available.",
    nextStep: "Expose the sample-page CTA from onboarding or first-run welcome UI.",
  },
  {
    code: "sample_article_understanding",
    evidenceKey: "sampleArticleShowsUnderstandableContent",
    severity: "block",
    message: "Sample lesson does not prove first content understood.",
    nextStep: "Show a short article or sample content with an understandable result and event evidence.",
  },
  {
    code: "recommended_sentence_save",
    evidenceKey: "recommendedSentenceCanBeSaved",
    severity: "block",
    message: "Sample lesson does not let users save a recommended word or sentence.",
    nextStep: "Add a recommended sentence save action that creates a real learning item.",
  },
  {
    code: "one_card_review",
    evidenceKey: "oneCardReviewReachable",
    severity: "block",
    message: "The first saved item does not lead to a one-card Review.",
    nextStep: "Route the first saved sample item into a one-card Review flow.",
  },
  {
    code: "first_review_card_copy",
    evidenceKey: "firstReviewCardCopyShown",
    severity: "warn",
    message: "First review-card achievement copy is missing.",
    nextStep: "Show `You just created your first review card` or equivalent first-win copy.",
  },
  {
    code: "activation_events",
    evidenceKey: "activationEventsRecorded",
    severity: "block",
    message: "Activation events are not recorded across the first-success funnel.",
    nextStep: "Record onboarding_completed, first_content_understood, saved_snippet_created, and review_session_completed.",
  },
  {
    code: "no_content_telemetry",
    evidenceKey: "activationTelemetryAvoidsContent",
    severity: "block",
    message: "Activation telemetry may include content text.",
    nextStep: "Keep activation telemetry to metadata such as source type, duration, success, and counts.",
  },
  {
    code: "success_rate_target",
    evidenceKey: "firstUnderstandingSuccessRateTargetMet",
    severity: "warn",
    message: "First understanding success-rate target is not evidenced.",
    nextStep: "Track and review whether first understanding success exceeds 95%.",
  },
  {
    code: "first_save_target",
    evidenceKey: "firstSaveRateTargetMet",
    severity: "warn",
    message: "First saved word/sentence rate target is not evidenced.",
    nextStep: "Track and improve whether first save rate exceeds 25%.",
  },
  {
    code: "first_review_target",
    evidenceKey: "firstReviewReachTargetMet",
    severity: "warn",
    message: "First Review reach-rate target is not evidenced.",
    nextStep: "Track and improve whether first Review reach rate exceeds 15%.",
  },
]

export function evaluateAstraFirstSuccessSmokeReport(report: AstraFirstSuccessSmokeReport): AstraFirstSuccessSmokeDecision {
  const findings: AstraFirstSuccessSmokeFinding[] = []
  const observedEvents = new Set(report.observedEventNames)
  for (const eventName of ASTRA_FIRST_SUCCESS_EVENT_NAMES) {
    if (!observedEvents.has(eventName)) {
      findings.push({
        code: "missing_required_event",
        message: `Activation smoke report is missing ${eventName}.`,
        nextStep: "Run the onboarding/sample first-success path and attach the observed activation event sequence.",
      })
    }
  }

  if (report.secondsToFirstContentUnderstood == null) {
    findings.push({
      code: "missing_first_value_timing",
      message: "Activation smoke report does not record seconds to first understandable content.",
      nextStep: "Record elapsed seconds from first-run/sample start to first_content_understood.",
    })
  } else if (report.secondsToFirstContentUnderstood > 60) {
    findings.push({
      code: "over_sixty_seconds",
      message: "Activation smoke report exceeds the <60 second first-understanding target.",
      nextStep: "Shorten the default path or keep the report as downgrade evidence only.",
    })
  }

  if (!report.savedItemCreated) {
    findings.push({
      code: "missing_first_save",
      message: "Activation smoke report does not confirm the first saved learning item.",
      nextStep: "Attach save-action telemetry or browser evidence for the recommended sentence save.",
    })
  }

  if (!report.reviewCompleted) {
    findings.push({
      code: "missing_first_review",
      message: "Activation smoke report does not confirm first Review completion.",
      nextStep: "Attach one-card Review telemetry or browser evidence for the target build.",
    })
  }

  const telemetryFields = new Set(report.telemetryFieldNames.map((field) => field.toLowerCase()))
  for (const field of ASTRA_FIRST_SUCCESS_FORBIDDEN_TELEMETRY_FIELDS) {
    if (telemetryFields.has(field.toLowerCase())) {
      findings.push({
        code: "content_text_field_present",
        message: `Activation smoke report includes content-like telemetry field ${field}.`,
        nextStep: "Remove raw text/content fields from activation telemetry and attach metadata-only evidence.",
      })
    }
  }

  return { ready: findings.length === 0, findings }
}

export function evaluateAstraFirstSuccessReadiness(
  evidence: AstraFirstSuccessReadinessEvidence,
): { ready: boolean; blockers: AstraFirstSuccessFinding[]; warnings: AstraFirstSuccessFinding[]; findings: AstraFirstSuccessFinding[] } {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraFirstSuccessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
