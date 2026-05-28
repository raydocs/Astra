export type AstraMacroBoundaryId =
  | "not_competitor_feature_parity"
  | "not_dom_translation_strategy"
  | "not_youtube_button_engineering"
  | "not_transcript_panel_breakdown"
  | "not_floatball_v2_engineering"
  | "not_service_mode_router_cache"
  | "not_live_bench_scenario_list"
  | "not_provider_api_model_ui_cleanup"

export type AstraProductQuestionId =
  | "why_new_users_stay"
  | "why_users_pay"
  | "why_users_return"
  | "learning_asset_moat"
  | "ordinary_user_trust"
  | "metrics_driven_product"
  | "long_term_platform_shape"

export type AstraProductLayerId = "capture_layer" | "understanding_layer" | "learning_memory"

export type AstraProductModelReadinessCode =
  | "macro_boundary_respected"
  | "not_translation_plugin_positioning"
  | "managed_ai_learning_assistant_promise"
  | "no_setup_default"
  | "learning_asset_moat_defined"
  | "capture_layer_defined"
  | "understanding_layer_defined"
  | "learning_memory_defined"
  | "layer_handoff_defined"
  | "slogan_aligned"
  | "decision_questions_covered"
  | "payment_value_not_per_translation"

export interface AstraProductLayerDefinition {
  id: AstraProductLayerId
  label: string
  goal: string
  capabilities: string[]
  principles: string[]
}

export interface AstraCoreProductPromise {
  currentRisk: string
  desiredMentalModel: string
  longTermGoal: string
  userPaysFor: string[]
  moatAssets: string[]
}

export interface AstraProductModelReadinessEvidence {
  macroBoundaryRespected: boolean
  defaultCopyAvoidsTranslationPluginPositioning: boolean
  managedAiLearningAssistantPromisePresent: boolean
  noSetupDefaultPath: boolean
  learningAssetMoatDefined: boolean
  captureLayerDefined: boolean
  understandingLayerDefined: boolean
  learningMemoryDefined: boolean
  layerHandoffDefined: boolean
  sloganAlignedToLearningMemory: boolean
  decisionQuestionsCovered: boolean
  paymentValueNotPerTranslation: boolean
}

export interface AstraProductModelFinding {
  code: AstraProductModelReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraProductModelDecision {
  ready: boolean
  blockers: AstraProductModelFinding[]
  warnings: AstraProductModelFinding[]
  findings: AstraProductModelFinding[]
}

export const ASTRA_MACRO_PLAN_BOUNDARIES: Record<AstraMacroBoundaryId, string> = {
  not_competitor_feature_parity: "Do not repeat Read Frog / Immersive Translate feature-by-feature parity work.",
  not_dom_translation_strategy: "Do not redefine page-translation DOM strategy here.",
  not_youtube_button_engineering: "Do not decompose YouTube player-button engineering here.",
  not_transcript_panel_breakdown: "Do not repeat Transcript Panel engineering breakdowns here.",
  not_floatball_v2_engineering: "Do not repeat FloatBall V2 implementation details here.",
  not_service_mode_router_cache: "Do not redefine serviceMode schema, router, or cache keys here.",
  not_live_bench_scenario_list: "Do not turn this macro plan into a bench-live scenario catalog.",
  not_provider_api_model_ui_cleanup: "Do not use the default product model to expose provider/API/model cleanup as user-facing value.",
}

export const ASTRA_PRODUCT_QUESTIONS: Record<AstraProductQuestionId, string> = {
  why_new_users_stay: "Why does a new user stay after first success?",
  why_users_pay: "Why would a user pay for Astra?",
  why_users_return: "Why does a user keep returning?",
  learning_asset_moat: "How does Astra build a learning-asset moat?",
  ordinary_user_trust: "How does an ordinary user build trust?",
  metrics_driven_product: "How should product decisions be driven by metrics?",
  long_term_platform_shape: "What is Astra's long-term platform shape?",
}

export const ASTRA_CORE_PRODUCT_PROMISE: AstraCoreProductPromise = {
  currentRisk: "If Astra only emphasizes page translation, subtitles, and AI explanation, users understand it as a more complex translation plugin.",
  desiredMentalModel:
    "A managed AI language-learning assistant: users read pages, watch videos, and open files while Astra automatically helps them understand, save what matters, and review later.",
  longTermGoal: "Turn the foreign-language content users read, watch, and save every day into personal language ability.",
  userPaysFor: [
    "no setup",
    "stable availability",
    "better translation and explanation quality",
    "content that compounds into learning assets",
    "knowing what to review today",
    "visible long-term learning progress",
  ],
  moatAssets: [
    "saved words and sentences",
    "reviewed content",
    "video learning notes",
    "reading history and learning assets",
    "user preferences and terminology understanding",
    "daily habit of returning to learn",
  ],
}

export const ASTRA_PRODUCT_SLOGANS = {
  english: [
    "Read anything. Learn what matters.",
    "Just read. Astra handles the AI.",
    "Turn everyday reading into language memory.",
    "Your browser language teacher — no setup required.",
    "Understand now. Remember later.",
  ],
  chinese: [
    "打开就能读，读过就能学。",
    "不用配置 API，Astra 自动帮你理解和复习。",
    "把网页和视频变成你的语言课。",
    "你只管阅读，Astra 帮你沉淀。",
  ],
} as const

export const ASTRA_PRODUCT_LAYERS: AstraProductLayerDefinition[] = [
  {
    id: "capture_layer",
    label: "Capture Layer",
    goal: "Astra appears lightly wherever the user encounters foreign-language content.",
    capabilities: ["web pages", "videos", "files", "selected text", "input boxes", "reading queue"],
    principles: [
      "do not interrupt",
      "do not dominate the page",
      "do not require setup first",
      "do not require users to understand the content source",
      "automatically judge whether the current content can become learning material",
    ],
  },
  {
    id: "understanding_layer",
    label: "Understanding Layer",
    goal: "Transform content into material the user can understand.",
    capabilities: ["translation", "explanation", "summary", "grammar", "hard-sentence breakdown", "keywords", "term consistency", "learning suggestions"],
    principles: ["serve comprehension before controls", "keep technical routing invisible", "prepare useful next steps for saving or review"],
  },
  {
    id: "learning_memory",
    label: "Learning Memory",
    goal: "Turn understanding into remembering.",
    capabilities: ["saved words", "saved sentences", "review cards", "review plan", "learning library", "weekly digest", "personal glossary", "return to original page or video moment"],
    principles: ["preserve learning assets", "make progress visible", "keep memory reversible and trustworthy", "return users to source context"],
  },
]

const READINESS_CHECKS: Array<{
  code: AstraProductModelReadinessCode
  evidenceKey: keyof AstraProductModelReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "macro_boundary_respected",
    evidenceKey: "macroBoundaryRespected",
    severity: "block",
    message: "The macro product plan is being used to repeat competitive engineering remediation work.",
    nextStep: "Keep DOM translation, YouTube button, FloatBall, serviceMode, proof, and provider cleanup details in their engineering plans.",
  },
  {
    code: "not_translation_plugin_positioning",
    evidenceKey: "defaultCopyAvoidsTranslationPluginPositioning",
    severity: "block",
    message: "Default positioning still reads like a generic or complex translation plugin.",
    nextStep: "Reframe default copy around managed AI language learning, saved assets, and review.",
  },
  {
    code: "managed_ai_learning_assistant_promise",
    evidenceKey: "managedAiLearningAssistantPromisePresent",
    severity: "block",
    message: "The managed AI language-learning assistant promise is missing.",
    nextStep: "State that Astra helps users understand, save what matters, and review later without setup.",
  },
  {
    code: "no_setup_default",
    evidenceKey: "noSetupDefaultPath",
    severity: "block",
    message: "The default path still requires setup or AI-provider understanding.",
    nextStep: "Move provider/API/model/prompt controls out of onboarding, landing, first success, and default paywall copy.",
  },
  {
    code: "learning_asset_moat_defined",
    evidenceKey: "learningAssetMoatDefined",
    severity: "block",
    message: "The learning-asset moat is not defined.",
    nextStep: "Define saved words/sentences, review history, video notes, reading assets, preferences, terminology, and return habit as the moat.",
  },
  {
    code: "capture_layer_defined",
    evidenceKey: "captureLayerDefined",
    severity: "block",
    message: "Capture Layer responsibilities are not explicit.",
    nextStep: "Define where Astra appears and how it stays lightweight before understanding starts.",
  },
  {
    code: "understanding_layer_defined",
    evidenceKey: "understandingLayerDefined",
    severity: "block",
    message: "Understanding Layer responsibilities are not explicit.",
    nextStep: "Define translation, explanation, summary, grammar, hard-sentence breakdown, keywords, terminology, and learning suggestions.",
  },
  {
    code: "learning_memory_defined",
    evidenceKey: "learningMemoryDefined",
    severity: "block",
    message: "Learning Memory responsibilities are not explicit.",
    nextStep: "Define saved terms/sentences, review cards, review plan, library, digest, glossary, and source return.",
  },
  {
    code: "layer_handoff_defined",
    evidenceKey: "layerHandoffDefined",
    severity: "warn",
    message: "Capture → Understanding → Learning Memory handoff is not evidenced.",
    nextStep: "Show that real content can become understanding, then saved/reviewable assets with return-to-source context.",
  },
  {
    code: "slogan_aligned",
    evidenceKey: "sloganAlignedToLearningMemory",
    severity: "warn",
    message: "Slogans do not consistently express learning memory rather than translation only.",
    nextStep: "Use Read anything. Learn what matters; Just read. Astra handles the AI; or Understand now. Remember later.",
  },
  {
    code: "decision_questions_covered",
    evidenceKey: "decisionQuestionsCovered",
    severity: "warn",
    message: "The seven macro product questions are not covered by product/release evidence.",
    nextStep: "Attach evidence for activation, payment value, retention, asset moat, trust, metrics, and platform shape.",
  },
  {
    code: "payment_value_not_per_translation",
    evidenceKey: "paymentValueNotPerTranslation",
    severity: "block",
    message: "Payment value is framed as paying per translation instead of managed learning value.",
    nextStep: "Frame paid value as no setup, reliability, quality, assets, review guidance, and visible long-term progress.",
  },
]

export function getAstraProductLayer(id: AstraProductLayerId): AstraProductLayerDefinition | undefined {
  return ASTRA_PRODUCT_LAYERS.find((layer) => layer.id === id)
}

export function evaluateAstraProductModelReadiness(
  evidence: AstraProductModelReadinessEvidence,
): AstraProductModelDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraProductModelFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))

  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    findings,
  }
}
