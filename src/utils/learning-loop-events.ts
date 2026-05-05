import { browser } from "#imports"
import type { TelemetryEvent } from "@/utils/telemetry"

export type LearningLoopEventName =
  | "copy_variant_assigned"
  | "popup_primer_viewed"
  | "popup_primer_cta_clicked"
  | "onboarding_closure_viewed"
  | "onboarding_closure_cta_clicked"
  | "onboarding_completed"
  | "deep_read_opened"
  | "sentence_explained"
  | "sentence_saved"
  | "review_answered"
  | "returned_to_source"
  | "resumed_reading"

export type LearningLoopCopyVariant = "loop_first" | "outcome_first"
export type LearningLoopFunnelVariant = LearningLoopCopyVariant | "unknown"

export type LearningLoopFunnelEventName =
  | "popup_primer_viewed"
  | "popup_primer_cta_clicked"
  | "deep_read_opened"
  | "sentence_explained"
  | "sentence_saved"
  | "review_answered"

export interface LearningLoopFunnelVariantResult {
  variant: LearningLoopFunnelVariant
  label: string
  counts: Record<LearningLoopFunnelEventName, number>
  totalEvents: number
  latestTimestamp: number | null
  ctaRate: number | null
  deepReadRate: number | null
  explainRate: number | null
  saveRate: number | null
}

export interface LearningLoopFunnelAggregation {
  variants: LearningLoopFunnelVariantResult[]
  totals: LearningLoopFunnelVariantResult
}

export type LearningLoopCopyVariantAutoSelectionPhase = "collecting" | "guarded" | "cooldown" | "selected" | "unavailable"

export interface LearningLoopCopyVariantAutoSelectionCandidate {
  variant: LearningLoopCopyVariant
  label: string
  score: number
  views: number
  ready: boolean
  ctaRate: number | null
  deepReadRate: number | null
  explainRate: number | null
  saveRate: number | null
}

export interface LearningLoopCopyVariantAutoSelectionGuardrails {
  minViewsPerVariant: number
  minWinnerScore: number
  hysteresis: number
  cooldownMs: number
}

export interface LearningLoopCopyVariantAutoSelectionStatus {
  phase: LearningLoopCopyVariantAutoSelectionPhase
  currentVariant: LearningLoopCopyVariant
  winnerVariant: LearningLoopCopyVariant | null
  recommendedVariant: LearningLoopCopyVariant | null
  reason: string
  lastEvaluatedAt: number | null
  lastSelectedAt: number | null
  cooldownUntil: number | null
  candidates: LearningLoopCopyVariantAutoSelectionCandidate[]
  guardrails: LearningLoopCopyVariantAutoSelectionGuardrails
}

interface StoredLearningLoopCopyVariantAutoSelectionState {
  version: 1
  lastEvaluatedAt: number
  lastSelectedAt: number | null
  lastSelectedVariant: LearningLoopCopyVariant | null
  lastDecision: string
}

export const LEARNING_LOOP_EVENT_NAMES: LearningLoopEventName[] = [
  "copy_variant_assigned",
  "popup_primer_viewed",
  "popup_primer_cta_clicked",
  "onboarding_closure_viewed",
  "onboarding_closure_cta_clicked",
  "onboarding_completed",
  "deep_read_opened",
  "sentence_explained",
  "sentence_saved",
  "review_answered",
  "returned_to_source",
  "resumed_reading",
]

export const LEARNING_LOOP_COPY_VARIANTS: LearningLoopCopyVariant[] = ["loop_first", "outcome_first"]
export const LEARNING_LOOP_FUNNEL_EVENT_NAMES: LearningLoopFunnelEventName[] = [
  "popup_primer_viewed",
  "popup_primer_cta_clicked",
  "deep_read_opened",
  "sentence_explained",
  "sentence_saved",
  "review_answered",
]
export const DEFAULT_LEARNING_LOOP_COPY_VARIANT: LearningLoopCopyVariant = "loop_first"
export const LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY = "astra.learningLoop.copyVariant.v1"
export const LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY = "astra.learningLoop.copyVariantAutoSelection.v1"
export const LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS: LearningLoopCopyVariantAutoSelectionGuardrails = {
  minViewsPerVariant: 3,
  minWinnerScore: 0.35,
  hysteresis: 0.12,
  cooldownMs: 24 * 60 * 60 * 1000,
}

const TELEMETRY_STORAGE_KEY = "astra.telemetry.v1"
const MAX_TELEMETRY_EVENTS = 200

let learningLoopTelemetryWriteQueue: Promise<void> = Promise.resolve()

export const LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY = {
  eyebrow: "Start free -> Build assets -> Keep continuity",
  title: "Astra packages real-page moments into a learning trail",
  description: "Free daily translations start the loop without setup or an API key. Save useful sentences and Astra keeps the source page, explanation, and review timing connected so context compounds instead of becoming throwaway lookup.",
  steps: [
    "Start free: translate selected real-page moments without setup.",
    "Build learning assets: save useful sentences with source context, explanations, and review cards.",
    "Keep continuity: return to the same trail so Review compounds what you chose to learn.",
  ],
  control: "You stay in control: choose which pages to translate, which sentences to save, and when to review.",
  boundary: "Local beta boundary: built for selected real-page learning moments—not unlimited bulk translation, hands-off automation, or a billing commitment in this build.",
  outcome: "Compared with a translator or reader alone, Astra turns useful page moments into reviewable learning outcomes.",
} as const

export const LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY = {
  eyebrow: "First win activation",
  title: "Save one useful sentence from a real page.",
  summary: "Translate a page, open Deep Read, explain one sentence, save it, then Review brings that same page context back when it is time to practice.",
} as const

export const LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY = {
  eyebrow: "Account continuity",
  title: "Keep your learning trail when you switch devices.",
  summary: "Sign in to attach your saved learning cards, reading queue, and study progress to an Astra account so today's page work is ready in your next session.",
  connectedTitle: "Continuity is connected for this account.",
  connectedSummary: "Your saved learning cards, reading queue, and study progress are attached to this Astra account for future sessions.",
  bullets: [
    "Continue from the same source pages and saved card context.",
    "Keep saved cards, reading history, and study progress connected across sessions.",
    "Review stays grounded in what you chose to learn, while SRS schedule timing remains local-only.",
  ],
  proofMoments: {
    popup: "Proof from this popup session is worth keeping.",
    study: "Proof on this page is already forming.",
    vocabularyList: "Proof in your learning desk is worth carrying forward.",
    vocabularyReview: "Proof in Review shows the loop is working.",
    vocabularyReading: "Proof in Reading shows what you can resume later.",
  },
  proofFallback: "Proof appears as soon as you translate, explain, save, review, or queue a reading item.",
  proofCtaHelper: "Same CTA: use the existing popup sign-in panel to keep this proof across sessions.",
  connectedProofHelper: "Connected proof: your Astra account can keep this saved-card learning trail across sessions; no sign-in action is needed here.",
  cta: "Sign in to keep continuity",
  ctaHelper: "Opens the existing Astra sign-in panel—no billing or sync changes happen until you sign in.",
  popupFocusParam: "focus=sign-in",
  popupDeepLinkPath: "/popup.html?focus=sign-in",
  nextAction: "Next action: open the popup sign-in panel when you are ready to attach today’s learning trail to an account.",
  boundary: "No billing change here—sign-in only connects continuity and account status for this build; SRS schedule timing stays local-only.",
} as const

export type LearningLoopAccountContinuityProofSurface =
  | "popup"
  | "study"
  | "vocabulary_list"
  | "vocabulary_review"
  | "vocabulary_reading"

export type LearningLoopAccountContinuityAuthState = "signed_out" | "signed_in"

export interface LearningLoopAccountContinuityProofCounts {
  dueReviewCount?: number | null
  savedSentenceCount?: number | null
  inProgressReadingCount?: number | null
  pagesStudiedToday?: number | null
  sentencesExplainedToday?: number | null
  vocabSavedToday?: number | null
  vocabReviewedToday?: number | null
}

const ACCOUNT_CONTINUITY_PROOF_SURFACE_COPY: Record<LearningLoopAccountContinuityProofSurface, string> = {
  popup: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.popup,
  study: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.study,
  vocabulary_list: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyList,
  vocabulary_review: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyReview,
  vocabulary_reading: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyReading,
}

function formatProofCount(count: number | null | undefined, singular: string, plural = `${singular}s`): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null
  const normalized = Math.floor(count)
  return `${normalized} ${normalized === 1 ? singular : plural}`
}

export function buildLearningLoopAccountContinuityProofMoment(
  surface: LearningLoopAccountContinuityProofSurface,
  counts: LearningLoopAccountContinuityProofCounts = {},
  options: { authState?: LearningLoopAccountContinuityAuthState } = {},
): string {
  const evidence = [
    formatProofCount(counts.dueReviewCount, "due review card"),
    formatProofCount(counts.savedSentenceCount, "saved learning card"),
    formatProofCount(counts.inProgressReadingCount, "reading item in progress", "reading items in progress"),
    formatProofCount(counts.pagesStudiedToday, "page studied today", "pages studied today"),
    formatProofCount(counts.sentencesExplainedToday, "sentence explained today", "sentences explained today"),
    formatProofCount(counts.vocabSavedToday, "card saved today", "cards saved today"),
    formatProofCount(counts.vocabReviewedToday, "card reviewed today", "cards reviewed today"),
  ].filter((entry): entry is string => Boolean(entry)).slice(0, 3)

  const proof = evidence.length > 0
    ? `Proof now: ${evidence.join(" · ")}.`
    : LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofFallback
  const helper = options.authState === "signed_in"
    ? LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.connectedProofHelper
    : LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofCtaHelper

  return `${ACCOUNT_CONTINUITY_PROOF_SURFACE_COPY[surface]} ${proof} ${helper}`
}

export function buildLearningLoopAccountContinuityPopupSignInUrl(
  resolveRuntimeUrl: (path: string) => string,
): string {
  const [path, query = LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.popupFocusParam] = LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.popupDeepLinkPath.split("?")
  return `${resolveRuntimeUrl(path ?? "/popup.html")}?${query}`
}

export const LEARNING_LOOP_COMMERCIAL_SURFACE_COPY = {
  onboardingPackageCard: LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY,
  firstWinActivation: LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY,
  accountContinuity: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY,
  popupPrimer: {
    eyebrow: "Free start · connected practice",
    title: "Translate, Deep Read, save, and review stay in one trail.",
    summary: "Generic translators/readers stop after the answer; Astra keeps the source page and review path attached so useful moments become practice.",
  },
  studyOutcome: "Astra keeps this page's sentences, explanations, and saved review cards connected so today's reading becomes repeat practice.",
} as const

export const LEARNING_LOOP_DIFFERENTIATION_COPY = {
  eyebrow: "Astra vs translator/reader",
  title: "Generic tools stop at output; Astra carries the sentence into practice",
  genericTranslator: "Generic translators answer this page now, then the learning trail disappears.",
  genericReader: "Generic readers make text easier to consume, but rarely create a reviewable memory from it.",
  astra: "Astra links translation, Deep Read, explanation, saved sentence, source context, and spaced review in one loop.",
  reinforcement: "Compared with a translator or reader alone, Astra turns useful page moments into reviewable learning outcomes.",
} as const

export const LEARNING_LOOP_COPY = {
  loop_first: {
    popup: {
      eyebrow: "Reading-to-review workflow",
      title: "Astra turns real pages into saved review—not just translations",
      description: "Unlike a generic translator, Astra keeps the article, explanation, saved sentence, and due review connected so every page can become practice.",
      translateStep: "Translate the current page to create bilingual study context.",
      readStepPrefix: "Open Deep Read and focus on one high-value sentence",
      readStepFallback: " when article text is available",
      explainStep: "Ask why the sentence works, then save it from the sentence card.",
      reviewStep: "Review due cards so saved vocabulary comes back with page context.",
    },
    onboarding: {
      eyebrow: "Not a generic translator",
      title: "Translate → Understand → Save → Review",
      description: "Astra turns browsing into a learning loop: bilingual context, sentence-level explanations, saved vocabulary, and spaced review stay connected.",
      readyNote: "Your first outcome starts from the popup: translate a real page, open Deep Read, save one sentence, then review it with context.",
    },
  },
  outcome_first: {
    popup: {
      eyebrow: "Build a review card fast",
      title: "Leave this page with one saved sentence",
      description: "Astra is built for learners, not one-off lookup: pick a real sentence, understand it, save it, and let Review bring it back later.",
      translateStep: "Translate the page so the sentence keeps bilingual context.",
      readStepPrefix: "Open Deep Read and choose one sentence worth remembering",
      readStepFallback: " once article text is available",
      explainStep: "Get a learner-focused explanation, then save from the sentence card.",
      reviewStep: "Open Review to turn saved sentences into repeat practice.",
    },
    onboarding: {
      eyebrow: "Practice from real pages",
      title: "One useful sentence → one future review",
      description: "After setup, Astra helps you turn a page into a concrete learning outcome: explain one sentence, save it, and revisit it in Review.",
      readyNote: "Aim for one saved sentence today: translate, explain, save, then review when it comes due.",
    },
  },
} as const

function normalizeLearningLoopCopyVariant(value: unknown): LearningLoopCopyVariant | null {
  return LEARNING_LOOP_COPY_VARIANTS.includes(value as LearningLoopCopyVariant)
    ? value as LearningLoopCopyVariant
    : null
}

function createEmptyFunnelCounts(): Record<LearningLoopFunnelEventName, number> {
  return Object.fromEntries(LEARNING_LOOP_FUNNEL_EVENT_NAMES.map((event) => [event, 0])) as Record<LearningLoopFunnelEventName, number>
}

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

function createFunnelResult(
  variant: LearningLoopFunnelVariant,
  counts: Record<LearningLoopFunnelEventName, number>,
  latestTimestamp: number | null,
): LearningLoopFunnelVariantResult {
  const views = counts.popup_primer_viewed
  const deepReads = counts.deep_read_opened
  const explained = counts.sentence_explained

  return {
    variant,
    label: variant === "loop_first"
      ? "Loop first"
      : variant === "outcome_first"
        ? "Outcome first"
        : "Unknown variant",
    counts,
    totalEvents: LEARNING_LOOP_FUNNEL_EVENT_NAMES.reduce((total, event) => total + counts[event], 0),
    latestTimestamp,
    ctaRate: safeRate(counts.popup_primer_cta_clicked, views),
    deepReadRate: safeRate(deepReads, views),
    explainRate: safeRate(explained, deepReads),
    saveRate: safeRate(counts.sentence_saved, explained),
  }
}

function isLearningLoopFunnelEventName(value: unknown): value is LearningLoopFunnelEventName {
  return LEARNING_LOOP_FUNNEL_EVENT_NAMES.includes(value as LearningLoopFunnelEventName)
}

function parseStoredAutoSelectionState(raw: unknown): StoredLearningLoopCopyVariantAutoSelectionState | null {
  if (raw == null || typeof raw !== "object") return null
  const value = raw as Partial<StoredLearningLoopCopyVariantAutoSelectionState>
  const lastSelectedVariant = normalizeLearningLoopCopyVariant(value.lastSelectedVariant)
  return {
    version: 1,
    lastEvaluatedAt: typeof value.lastEvaluatedAt === "number" ? value.lastEvaluatedAt : 0,
    lastSelectedAt: typeof value.lastSelectedAt === "number" ? value.lastSelectedAt : null,
    lastSelectedVariant,
    lastDecision: typeof value.lastDecision === "string" ? value.lastDecision : "No previous local auto-selection evaluation.",
  }
}

function scoreLearningLoopCopyVariant(result: LearningLoopFunnelVariantResult): number {
  const ctaRate = result.ctaRate ?? 0
  const deepReadRate = result.deepReadRate ?? 0
  const explainRate = result.explainRate ?? 0
  const saveRate = result.saveRate ?? 0

  return (ctaRate * 0.2) + (deepReadRate * 0.35) + (explainRate * 0.25) + (saveRate * 0.2)
}

function getVariantResult(
  aggregation: LearningLoopFunnelAggregation,
  variant: LearningLoopCopyVariant,
): LearningLoopFunnelVariantResult {
  return aggregation.variants.find((entry) => entry.variant === variant)
    ?? createFunnelResult(variant, createEmptyFunnelCounts(), null)
}

function createStoredAutoSelectionState(
  status: LearningLoopCopyVariantAutoSelectionStatus,
  selectedVariant: LearningLoopCopyVariant | null,
  selectedAt: number | null,
): StoredLearningLoopCopyVariantAutoSelectionState {
  return {
    version: 1,
    lastEvaluatedAt: status.lastEvaluatedAt ?? Date.now(),
    lastSelectedAt: selectedAt,
    lastSelectedVariant: selectedVariant,
    lastDecision: status.reason,
  }
}

export function aggregateLearningLoopFunnel(events: TelemetryEvent[]): LearningLoopFunnelAggregation {
  const countsByVariant = new Map<LearningLoopFunnelVariant, Record<LearningLoopFunnelEventName, number>>()
  const latestByVariant = new Map<LearningLoopFunnelVariant, number>()
  const totalCounts = createEmptyFunnelCounts()
  let totalLatest: number | null = null

  const ensureVariant = (variant: LearningLoopFunnelVariant) => {
    const existing = countsByVariant.get(variant)
    if (existing) return existing
    const next = createEmptyFunnelCounts()
    countsByVariant.set(variant, next)
    return next
  }

  for (const variant of LEARNING_LOOP_COPY_VARIANTS) {
    ensureVariant(variant)
  }

  for (const event of events) {
    if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") continue
    if (!isLearningLoopFunnelEventName(event.data.event)) continue

    const variant = normalizeLearningLoopCopyVariant(event.data.variant) ?? "unknown"
    const counts = ensureVariant(variant)
    counts[event.data.event] += 1
    totalCounts[event.data.event] += 1

    const currentLatest = latestByVariant.get(variant)
    if (currentLatest === undefined || event.timestamp > currentLatest) {
      latestByVariant.set(variant, event.timestamp)
    }
    if (totalLatest === null || event.timestamp > totalLatest) {
      totalLatest = event.timestamp
    }
  }

  const variants = Array.from(countsByVariant.entries())
    .filter(([variant, counts]) => variant !== "unknown" || LEARNING_LOOP_FUNNEL_EVENT_NAMES.some((event) => counts[event] > 0))
    .map(([variant, counts]) => createFunnelResult(variant, counts, latestByVariant.get(variant) ?? null))
    .sort((a, b) => {
      const order = ["loop_first", "outcome_first", "unknown"]
      return order.indexOf(a.variant) - order.indexOf(b.variant)
    })

  return {
    variants,
    totals: createFunnelResult("unknown", totalCounts, totalLatest),
  }
}

export function deriveLearningLoopCopyVariantAutoSelectionStatus(
  aggregation: LearningLoopFunnelAggregation,
  currentVariant: LearningLoopCopyVariant,
  storedState: StoredLearningLoopCopyVariantAutoSelectionState | null = null,
  now: number = Date.now(),
): LearningLoopCopyVariantAutoSelectionStatus {
  const guardrails = LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS
  const candidates = LEARNING_LOOP_COPY_VARIANTS.map((variant) => {
    const result = getVariantResult(aggregation, variant)
    return {
      variant,
      label: result.label,
      score: scoreLearningLoopCopyVariant(result),
      views: result.counts.popup_primer_viewed,
      ready: result.counts.popup_primer_viewed >= guardrails.minViewsPerVariant,
      ctaRate: result.ctaRate,
      deepReadRate: result.deepReadRate,
      explainRate: result.explainRate,
      saveRate: result.saveRate,
    }
  })

  const lastSelectedAt = storedState?.lastSelectedAt ?? null
  const cooldownUntil = lastSelectedAt == null ? null : lastSelectedAt + guardrails.cooldownMs
  const readyCandidates = candidates.filter((candidate) => candidate.ready)
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.variant === currentVariant) return -1
    if (b.variant === currentVariant) return 1
    return LEARNING_LOOP_COPY_VARIANTS.indexOf(a.variant) - LEARNING_LOOP_COPY_VARIANTS.indexOf(b.variant)
  })
  const winner = sortedCandidates[0] ?? null
  const current = candidates.find((candidate) => candidate.variant === currentVariant) ?? null

  if (readyCandidates.length < LEARNING_LOOP_COPY_VARIANTS.length) {
    const missing = candidates
      .filter((candidate) => !candidate.ready)
      .map((candidate) => `${candidate.label} ${candidate.views}/${guardrails.minViewsPerVariant} views`)
      .join("; ")
    return {
      phase: "collecting",
      currentVariant,
      winnerVariant: null,
      recommendedVariant: null,
      reason: `Collecting local samples before auto-selection: ${missing || "waiting for variant views"}.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  if (!winner || !current || winner.score < guardrails.minWinnerScore) {
    return {
      phase: "guarded",
      currentVariant,
      winnerVariant: winner?.variant ?? null,
      recommendedVariant: null,
      reason: `No auto-selection yet: winning score must reach ${Math.round(guardrails.minWinnerScore * 100)}%.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  if (winner.variant === currentVariant) {
    return {
      phase: "selected",
      currentVariant,
      winnerVariant: winner.variant,
      recommendedVariant: null,
      reason: `${winner.label} remains the local winner.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  if (cooldownUntil != null && now < cooldownUntil) {
    return {
      phase: "cooldown",
      currentVariant,
      winnerVariant: winner.variant,
      recommendedVariant: null,
      reason: `Auto-selection cooldown is active until ${new Date(cooldownUntil).toISOString()}.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  const lift = winner.score - current.score
  if (lift < guardrails.hysteresis) {
    return {
      phase: "guarded",
      currentVariant,
      winnerVariant: winner.variant,
      recommendedVariant: null,
      reason: `No switch yet: ${winner.label} leads by ${Math.round(lift * 100)}pp, below the ${Math.round(guardrails.hysteresis * 100)}pp hysteresis guardrail.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  return {
    phase: "selected",
    currentVariant,
    winnerVariant: winner.variant,
    recommendedVariant: winner.variant,
    reason: `${winner.label} is the local winner by ${Math.round(lift * 100)}pp and passes guardrails.`,
    lastEvaluatedAt: now,
    lastSelectedAt,
    cooldownUntil,
    candidates,
    guardrails,
  }
}

async function readLearningLoopCopyVariantAutoSelectionInputs(events?: TelemetryEvent[]): Promise<{
  currentVariant: LearningLoopCopyVariant
  storedState: StoredLearningLoopCopyVariantAutoSelectionState | null
  events: TelemetryEvent[]
}> {
  const keys = events
    ? [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY, LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]
    : [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY, LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY, TELEMETRY_STORAGE_KEY]
  const stored = await browser.storage.local.get(keys)
  const currentVariant = normalizeLearningLoopCopyVariant(stored[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]) ?? DEFAULT_LEARNING_LOOP_COPY_VARIANT
  return {
    currentVariant,
    storedState: parseStoredAutoSelectionState(stored[LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]),
    events: events ?? parseStoredTelemetryEvents(stored[TELEMETRY_STORAGE_KEY]),
  }
}

export async function getLearningLoopCopyVariantAutoSelectionStatus(events?: TelemetryEvent[]): Promise<LearningLoopCopyVariantAutoSelectionStatus> {
  try {
    const inputs = await readLearningLoopCopyVariantAutoSelectionInputs(events)
    return deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel(inputs.events),
      inputs.currentVariant,
      inputs.storedState,
    )
  } catch {
    return {
      phase: "unavailable",
      currentVariant: DEFAULT_LEARNING_LOOP_COPY_VARIANT,
      winnerVariant: null,
      recommendedVariant: null,
      reason: "Learning-loop auto-selection status is unavailable.",
      lastEvaluatedAt: null,
      lastSelectedAt: null,
      cooldownUntil: null,
      candidates: [],
      guardrails: LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS,
    }
  }
}

export async function getLearningLoopCopyVariant(): Promise<LearningLoopCopyVariant> {
  try {
    const now = Date.now()
    const stored = await browser.storage.local.get([
      LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY,
      LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY,
      TELEMETRY_STORAGE_KEY,
    ])
    const existing = normalizeLearningLoopCopyVariant(stored[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY])
    let currentVariant = existing ?? DEFAULT_LEARNING_LOOP_COPY_VARIANT
    const storedState = parseStoredAutoSelectionState(stored[LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY])
    const status = deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel(parseStoredTelemetryEvents(stored[TELEMETRY_STORAGE_KEY])),
      currentVariant,
      storedState,
      now,
    )
    const nextVariant = status.recommendedVariant ?? currentVariant
    const selectedAt = status.recommendedVariant ? now : (storedState?.lastSelectedAt ?? null)
    const selectedVariant = status.recommendedVariant ?? storedState?.lastSelectedVariant ?? (existing ? currentVariant : null)

    await browser.storage.local.set({
      [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]: nextVariant,
      [LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]: createStoredAutoSelectionState(status, selectedVariant, selectedAt),
    })

    if (!existing) {
      recordLearningLoopEvent("copy_variant_assigned", {
        variant: DEFAULT_LEARNING_LOOP_COPY_VARIANT,
        assignment: "default_local",
      })
    }

    if (status.recommendedVariant && status.recommendedVariant !== currentVariant) {
      currentVariant = status.recommendedVariant
      const winner = status.candidates.find((candidate) => candidate.variant === status.recommendedVariant)
      const previous = status.candidates.find((candidate) => candidate.variant !== status.recommendedVariant)
      recordLearningLoopEvent("copy_variant_assigned", {
        variant: status.recommendedVariant,
        previousVariant: existing ?? DEFAULT_LEARNING_LOOP_COPY_VARIANT,
        assignment: "auto_winner",
        score: winner?.score,
        previousScore: previous?.score,
        minViewsPerVariant: status.guardrails.minViewsPerVariant,
        hysteresis: status.guardrails.hysteresis,
        cooldownMs: status.guardrails.cooldownMs,
      })
    }

    return currentVariant
  } catch {
    return DEFAULT_LEARNING_LOOP_COPY_VARIANT
  }
}

export async function setLearningLoopCopyVariant(variant: LearningLoopCopyVariant): Promise<void> {
  const now = Date.now()
  await browser.storage.local.set({
    [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]: variant,
    [LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]: {
      version: 1,
      lastEvaluatedAt: now,
      lastSelectedAt: now,
      lastSelectedVariant: variant,
      lastDecision: "Manual local switch; auto-selection cooldown is active.",
    } satisfies StoredLearningLoopCopyVariantAutoSelectionState,
  })
  recordLearningLoopEvent("copy_variant_assigned", {
    variant,
    assignment: "local_switch",
  })
}

function createLearningLoopTelemetryId(timestamp: number): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`
}

function parseStoredTelemetryEvents(raw: unknown): TelemetryEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (event): event is TelemetryEvent =>
      event != null
      && typeof event === "object"
      && typeof (event as TelemetryEvent).id === "string"
      && typeof (event as TelemetryEvent).type === "string"
      && typeof (event as TelemetryEvent).timestamp === "number"
      && typeof (event as TelemetryEvent).data === "object",
  )
}

function enqueueLearningLoopTelemetryEvent(event: TelemetryEvent): void {
  learningLoopTelemetryWriteQueue = learningLoopTelemetryWriteQueue
    .catch(() => {
      // Keep later learning-loop telemetry writes from being blocked by an earlier storage failure.
    })
    .then(async () => {
      const stored = await browser.storage.local.get(TELEMETRY_STORAGE_KEY)
      const existing = parseStoredTelemetryEvents(stored[TELEMETRY_STORAGE_KEY])
      const updated = [event, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_TELEMETRY_EVENTS)
      await browser.storage.local.set({ [TELEMETRY_STORAGE_KEY]: updated })
    })

  void learningLoopTelemetryWriteQueue.catch(() => {
    // Fire-and-forget — never surface telemetry storage errors.
  })
}

export function recordLearningLoopEvent(
  event: LearningLoopEventName,
  data: Record<string, unknown> = {},
): void {
  const now = Date.now()
  enqueueLearningLoopTelemetryEvent({
    id: createLearningLoopTelemetryId(now),
    timestamp: now,
    type: "feature_usage",
    data: {
      feature: "learning_loop",
      event,
      ...data,
    },
  })
}
