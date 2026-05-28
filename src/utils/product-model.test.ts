import { describe, expect, it } from "vitest"

import {
  ASTRA_CORE_PRODUCT_PROMISE,
  ASTRA_MACRO_PLAN_BOUNDARIES,
  ASTRA_PRODUCT_LAYERS,
  ASTRA_PRODUCT_QUESTIONS,
  ASTRA_PRODUCT_SLOGANS,
  evaluateAstraProductModelReadiness,
  getAstraProductLayer,
  type AstraProductModelReadinessEvidence,
} from "./product-model"

const readyEvidence: AstraProductModelReadinessEvidence = {
  macroBoundaryRespected: true,
  defaultCopyAvoidsTranslationPluginPositioning: true,
  managedAiLearningAssistantPromisePresent: true,
  noSetupDefaultPath: true,
  learningAssetMoatDefined: true,
  captureLayerDefined: true,
  understandingLayerDefined: true,
  learningMemoryDefined: true,
  layerHandoffDefined: true,
  sloganAlignedToLearningMemory: true,
  decisionQuestionsCovered: true,
  paymentValueNotPerTranslation: true,
}

describe("Astra core product model contract", () => {
  it("keeps the macro plan boundary above competitive engineering remediation", () => {
    expect(Object.keys(ASTRA_MACRO_PLAN_BOUNDARIES)).toEqual([
      "not_competitor_feature_parity",
      "not_dom_translation_strategy",
      "not_youtube_button_engineering",
      "not_transcript_panel_breakdown",
      "not_floatball_v2_engineering",
      "not_service_mode_router_cache",
      "not_live_bench_scenario_list",
      "not_provider_api_model_ui_cleanup",
    ])
    expect(ASTRA_MACRO_PLAN_BOUNDARIES.not_provider_api_model_ui_cleanup).toContain("user-facing value")
  })

  it("defines the seven macro product questions", () => {
    expect(Object.keys(ASTRA_PRODUCT_QUESTIONS)).toEqual([
      "why_new_users_stay",
      "why_users_pay",
      "why_users_return",
      "learning_asset_moat",
      "ordinary_user_trust",
      "metrics_driven_product",
      "long_term_platform_shape",
    ])
  })

  it("frames Astra as a managed AI language-learning assistant rather than a translation plugin", () => {
    expect(ASTRA_CORE_PRODUCT_PROMISE.currentRisk).toContain("translation plugin")
    expect(ASTRA_CORE_PRODUCT_PROMISE.desiredMentalModel).toContain("managed AI language-learning assistant")
    expect(ASTRA_CORE_PRODUCT_PROMISE.longTermGoal).toContain("personal language ability")
    expect(ASTRA_CORE_PRODUCT_PROMISE.userPaysFor).toEqual(expect.arrayContaining([
      "no setup",
      "content that compounds into learning assets",
      "knowing what to review today",
      "visible long-term learning progress",
    ]))
    expect(ASTRA_CORE_PRODUCT_PROMISE.moatAssets).toEqual(expect.arrayContaining([
      "saved words and sentences",
      "reviewed content",
      "video learning notes",
      "daily habit of returning to learn",
    ]))
  })

  it("records the slogan directions in English and Chinese", () => {
    expect(ASTRA_PRODUCT_SLOGANS.english).toEqual([
      "Read anything. Learn what matters.",
      "Just read. Astra handles the AI.",
      "Turn everyday reading into language memory.",
      "Your browser language teacher — no setup required.",
      "Understand now. Remember later.",
    ])
    expect(ASTRA_PRODUCT_SLOGANS.chinese).toEqual([
      "打开就能读，读过就能学。",
      "不用配置 API，Astra 自动帮你理解和复习。",
      "把网页和视频变成你的语言课。",
      "你只管阅读，Astra 帮你沉淀。",
    ])
  })

  it("defines Capture, Understanding, and Learning Memory layers", () => {
    expect(ASTRA_PRODUCT_LAYERS.map((layer) => layer.id)).toEqual([
      "capture_layer",
      "understanding_layer",
      "learning_memory",
    ])
    expect(getAstraProductLayer("capture_layer")?.capabilities).toEqual(expect.arrayContaining([
      "web pages",
      "videos",
      "files",
      "selected text",
      "input boxes",
      "reading queue",
    ]))
    expect(getAstraProductLayer("understanding_layer")?.capabilities).toEqual(expect.arrayContaining([
      "translation",
      "explanation",
      "summary",
      "term consistency",
      "learning suggestions",
    ]))
    expect(getAstraProductLayer("learning_memory")?.capabilities).toEqual(expect.arrayContaining([
      "saved words",
      "saved sentences",
      "review cards",
      "weekly digest",
      "return to original page or video moment",
    ]))
  })

  it("passes readiness when boundary, mental model, layers, slogans, and payment value are evidenced", () => {
    const decision = evaluateAstraProductModelReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when the product still behaves like a setup-heavy translation plugin", () => {
    const decision = evaluateAstraProductModelReadiness({
      ...readyEvidence,
      macroBoundaryRespected: false,
      defaultCopyAvoidsTranslationPluginPositioning: false,
      managedAiLearningAssistantPromisePresent: false,
      noSetupDefaultPath: false,
      learningAssetMoatDefined: false,
      captureLayerDefined: false,
      understandingLayerDefined: false,
      learningMemoryDefined: false,
      paymentValueNotPerTranslation: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "macro_boundary_respected",
      "not_translation_plugin_positioning",
      "managed_ai_learning_assistant_promise",
      "no_setup_default",
      "learning_asset_moat_defined",
      "capture_layer_defined",
      "understanding_layer_defined",
      "learning_memory_defined",
      "payment_value_not_per_translation",
    ])
  })

  it("keeps layer handoff, slogan alignment, and decision-question coverage as warnings", () => {
    const decision = evaluateAstraProductModelReadiness({
      ...readyEvidence,
      layerHandoffDefined: false,
      sloganAlignedToLearningMemory: false,
      decisionQuestionsCovered: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "layer_handoff_defined",
      "slogan_aligned",
      "decision_questions_covered",
    ])
  })
})
