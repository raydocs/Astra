export type AstraPlatformSurfaceId =
  | "chrome_chromium_extension"
  | "web_companion"
  | "safari_ios_shell"
  | "mobile_companion"
  | "email_digest"
  | "api_integrations"

export type AstraPlatformLaunchStatus = "core_now" | "companion_now" | "experimental" | "future" | "deferred"

export type AstraRoadmapPhaseId = "M1" | "M2" | "M3" | "M4" | "M5"

export type AstraPlatformReadinessCode =
  | "extension_core_first"
  | "web_companion_assets_review"
  | "safari_ios_experimental_boundary"
  | "no_full_platform_claim_before_core_proof"
  | "long_term_surface_roles"
  | "sync_value_beyond_config"
  | "cross_device_continuity_plan"
  | "roadmap_phase_order"
  | "phase_exit_criteria"
  | "m1_first_success_trust"
  | "m2_learning_loop"
  | "m3_learning_library"
  | "m4_personalization"
  | "m5_digest_retention"

export interface AstraPlatformSurfaceDefinition {
  id: AstraPlatformSurfaceId
  label: string
  launchStatus: AstraPlatformLaunchStatus
  productRole: string
  publicClaimBoundary: string
}

export interface AstraMultiDeviceValueDefinition {
  id: string
  userStory: string
  requiredAssetContinuity: string[]
  notJustConfigSync: boolean
}

export interface AstraRoadmapPhaseDefinition {
  id: AstraRoadmapPhaseId
  label: string
  goal: string
  includes: string[]
  exitEvidence: string[]
}

export interface AstraPlatformRoadmapReadinessEvidence {
  chromeExtensionCoreStable: boolean
  webCompanionLearningAssetsAndReviewReady: boolean
  safariIosShellClearlyExperimental: boolean
  noFullPlatformMarketingBeforeCoreProof: boolean
  longTermSurfaceRolesDefined: boolean
  syncValueBeyondSettingsSyncDefined: boolean
  crossDeviceLearningContinuityPlanned: boolean
  roadmapPhasesOrdered: boolean
  phaseExitCriteriaDefined: boolean
  m1FirstSuccessTrustEvidence: boolean
  m2LearningLoopEvidence: boolean
  m3LearningLibraryEvidence: boolean
  m4PersonalizationEvidence: boolean
  m5DigestRetentionEvidence: boolean
}

export interface AstraPlatformRoadmapFinding {
  code: AstraPlatformReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraPlatformRoadmapDecision {
  ready: boolean
  blockers: AstraPlatformRoadmapFinding[]
  warnings: AstraPlatformRoadmapFinding[]
  findings: AstraPlatformRoadmapFinding[]
}

export const ASTRA_PLATFORM_SURFACES: AstraPlatformSurfaceDefinition[] = [
  {
    id: "chrome_chromium_extension",
    label: "Chrome/Chromium extension",
    launchStatus: "core_now",
    productRole: "Real-time understanding layer on the page, video, and selected text.",
    publicClaimBoundary: "Core launch target; claims still depend on release-gate, store, and live-browser evidence.",
  },
  {
    id: "web_companion",
    label: "Web companion",
    launchStatus: "companion_now",
    productRole: "Learning asset library, account continuity, review, digest, and operator/support companion surfaces.",
    publicClaimBoundary: "Companion to the extension, not a replacement for every extension learning surface.",
  },
  {
    id: "safari_ios_shell",
    label: "Safari/iOS shell",
    launchStatus: "experimental",
    productRole: "Packaging and validation path for later Safari/iOS learning continuity experiments.",
    publicClaimBoundary: "Experimental only; do not claim Chrome parity, full mobile support, or production iOS runtime proof.",
  },
  {
    id: "mobile_companion",
    label: "Mobile companion",
    launchStatus: "future",
    productRole: "Review, reading continuation, and lightweight learning reminders away from the desktop browser.",
    publicClaimBoundary: "Future product direction until native/PWA/mobile evidence, privacy review, and store claims exist.",
  },
  {
    id: "email_digest",
    label: "Email digest",
    launchStatus: "future",
    productRole: "Weekly learning summary and return path into Library/Review/source continuation.",
    publicClaimBoundary: "Future delivery channel; current local digest does not imply email/push infrastructure.",
  },
  {
    id: "api_integrations",
    label: "API / integrations",
    launchStatus: "deferred",
    productRole: "Later export, classroom, or partner workflows after the core learning loop is proven.",
    publicClaimBoundary: "Deferred; do not market API, LMS, classroom, or integration platform support by default.",
  },
]

export const ASTRA_MULTI_DEVICE_VALUE: AstraMultiDeviceValueDefinition[] = [
  {
    id: "desktop_save_mobile_review",
    userStory: "Save on desktop, review on mobile.",
    requiredAssetContinuity: ["saved snippet identity", "review card schedule", "source title/context"],
    notJustConfigSync: true,
  },
  {
    id: "web_organize_browser_continue",
    userStory: "Organize in the web app, then return to the original browser source.",
    requiredAssetContinuity: ["source id", "source type", "continue-learning link or source reference", "review state"],
    notJustConfigSync: true,
  },
  {
    id: "weekly_summary_return_path",
    userStory: "Receive a weekly summary and continue learning from it.",
    requiredAssetContinuity: ["weekly aggregate", "top source reference", "review due count", "continue action"],
    notJustConfigSync: true,
  },
]

export const ASTRA_ROADMAP_PHASES: AstraRoadmapPhaseDefinition[] = [
  {
    id: "M1",
    label: "First Success + Trust",
    goal: "New users quickly succeed and trust Astra.",
    includes: [
      "demo/sample path",
      "minimal onboarding",
      "first save guidance",
      "error copy and recovery action",
      "privacy/trust card",
      "support entry",
      "activation metrics",
    ],
    exitEvidence: ["sample lesson first loop", "metadata-only support/report", "trust/privacy copy", "activation metric coverage"],
  },
  {
    id: "M2",
    label: "Learning Loop Productization",
    goal: "Saving and reviewing feel rewarding.",
    includes: [
      "upgraded save feedback",
      "light daily goal",
      "Review context",
      "first review flow",
      "saved item source card",
      "review completion state",
    ],
    exitEvidence: ["daily-goal Review sizing", "review context labels", "saved-to-review handoff", "review completion state"],
  },
  {
    id: "M3",
    label: "Learning Library",
    goal: "Users start accumulating learning assets.",
    includes: [
      "Saved content home",
      "Reading queue",
      "saved pages/videos/files",
      "source filters",
      "continue learning",
      "search saved items",
    ],
    exitEvidence: ["Library home summary", "source filters", "source controls", "search/focus/accessibility coverage"],
  },
  {
    id: "M4",
    label: "Personalization",
    goal: "Astra understands the learner more over time.",
    includes: [
      "lightweight profile",
      "automatic topic/source organization",
      "personal glossary",
      "preference controls",
      "adaptive review suggestions",
    ],
    exitEvidence: ["learning profile", "memory inventory", "write policy", "user-reversible controls"],
  },
  {
    id: "M5",
    label: "Digest + Retention",
    goal: "Astra establishes long-term retention.",
    includes: [
      "weekly digest",
      "streaks/soft progress",
      "recommendations",
      "renewal value surfaces",
      "member learning summary",
    ],
    exitEvidence: ["local weekly digest", "retention touchpoint policy", "stage OKR metrics", "non-spam guardrails"],
  },
]

const READINESS_CHECKS: Array<{
  code: AstraPlatformReadinessCode
  evidenceKey: keyof AstraPlatformRoadmapReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "extension_core_first",
    evidenceKey: "chromeExtensionCoreStable",
    severity: "block",
    message: "The Chrome/Chromium extension core is not proven as the first platform surface.",
    nextStep: "Keep extension first-success, content overlay, Review, Library, privacy, and support flows ahead of new platform claims.",
  },
  {
    code: "web_companion_assets_review",
    evidenceKey: "webCompanionLearningAssetsAndReviewReady",
    severity: "block",
    message: "The web companion is not clearly scoped around learning assets and review.",
    nextStep: "Keep web positioning focused on Library, Review, account continuity, digest, and support companion surfaces.",
  },
  {
    code: "safari_ios_experimental_boundary",
    evidenceKey: "safariIosShellClearlyExperimental",
    severity: "block",
    message: "Safari/iOS shell claims exceed experimental evidence.",
    nextStep: "Label Safari/iOS shell as experimental unless runtime parity and store evidence exist.",
  },
  {
    code: "no_full_platform_claim_before_core_proof",
    evidenceKey: "noFullPlatformMarketingBeforeCoreProof",
    severity: "block",
    message: "Product copy risks marketing Astra as a full multi-platform product before the core loop is proven.",
    nextStep: "Avoid full-end/mobile/API/classroom claims until extension/web core evidence is stable.",
  },
  {
    code: "long_term_surface_roles",
    evidenceKey: "longTermSurfaceRolesDefined",
    severity: "warn",
    message: "Long-term platform surfaces do not have explicit roles and boundaries.",
    nextStep: "Document Browser Extension, Web App, Mobile, Email Digest, and API/Integrations roles before planning dependent work.",
  },
  {
    code: "sync_value_beyond_config",
    evidenceKey: "syncValueBeyondSettingsSyncDefined",
    severity: "block",
    message: "Multi-device sync is framed as settings/config sync rather than learning continuity.",
    nextStep: "Define save-on-desktop, review-on-mobile, organize-on-web, return-to-source, and weekly-summary continuity.",
  },
  {
    code: "cross_device_continuity_plan",
    evidenceKey: "crossDeviceLearningContinuityPlanned",
    severity: "warn",
    message: "Cross-device learning continuity lacks an asset continuity plan.",
    nextStep: "Track source IDs, review schedules, source titles/types, continue links, and digest return paths.",
  },
  {
    code: "roadmap_phase_order",
    evidenceKey: "roadmapPhasesOrdered",
    severity: "block",
    message: "Roadmap phase order is not preserved.",
    nextStep: "Keep M1 First Success + Trust before M2 Loop, M3 Library, M4 Personalization, and M5 Retention expansion.",
  },
  {
    code: "phase_exit_criteria",
    evidenceKey: "phaseExitCriteriaDefined",
    severity: "warn",
    message: "Roadmap phases lack exit-evidence criteria.",
    nextStep: "Attach evidence to every phase before claiming it is done.",
  },
  {
    code: "m1_first_success_trust",
    evidenceKey: "m1FirstSuccessTrustEvidence",
    severity: "block",
    message: "M1 First Success + Trust evidence is incomplete.",
    nextStep: "Verify demo/sample, onboarding, first save, error recovery, trust/privacy, support entry, and activation metrics.",
  },
  {
    code: "m2_learning_loop",
    evidenceKey: "m2LearningLoopEvidence",
    severity: "warn",
    message: "M2 Learning Loop productization evidence is incomplete.",
    nextStep: "Verify save feedback, daily goal, review context, first review, source card, and completion state.",
  },
  {
    code: "m3_learning_library",
    evidenceKey: "m3LearningLibraryEvidence",
    severity: "warn",
    message: "M3 Learning Library evidence is incomplete.",
    nextStep: "Verify Library home, reading queue, source filters, continue learning, and search saved items.",
  },
  {
    code: "m4_personalization",
    evidenceKey: "m4PersonalizationEvidence",
    severity: "warn",
    message: "M4 Personalization evidence is incomplete.",
    nextStep: "Verify lightweight profile, organization/memory boundaries, glossary, preference controls, and adaptive review plans.",
  },
  {
    code: "m5_digest_retention",
    evidenceKey: "m5DigestRetentionEvidence",
    severity: "warn",
    message: "M5 Digest + Retention evidence is incomplete.",
    nextStep: "Verify digest, soft progress, recommendations, renewal value surfaces, and member summary guardrails.",
  },
]

export function getPlatformSurface(id: AstraPlatformSurfaceId): AstraPlatformSurfaceDefinition | undefined {
  return ASTRA_PLATFORM_SURFACES.find((surface) => surface.id === id)
}

export function getRoadmapPhase(id: AstraRoadmapPhaseId): AstraRoadmapPhaseDefinition | undefined {
  return ASTRA_ROADMAP_PHASES.find((phase) => phase.id === id)
}

export function evaluateAstraPlatformRoadmapReadiness(
  evidence: AstraPlatformRoadmapReadinessEvidence,
): AstraPlatformRoadmapDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraPlatformRoadmapFinding>((check) => ({
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
