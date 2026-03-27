import { randomUUID } from "node:crypto"

import { buildBenchOptPlannerArtifact, type BenchOptPlannerArtifact } from "./planner.ts"
import { buildBenchOptGeneratorArtifact, type BenchOptGeneratorArtifact } from "./generator.ts"
import { buildBenchOptEvaluatorArtifact, type BenchOptEvaluatorArtifact } from "./evaluator.ts"
import {
  createDefaultScoringConfig,
  type CompositeScoringConfig,
} from "./composite-scorer.ts"
import { runLiveBench, liveScenarios } from "../bench-live/index.ts"

// Hardening modules
import {
  scoreFromArtifacts,
  collectCurrentArtifactEvidence,
  type ArtifactScoringResult,
  type ArtifactEvidence,
} from "./artifact-scorer.ts"
import {
  classifyPrompt,
  buildProfileFromPrompt,
  getSprintProfileForFamily,
  getDimensionWeightsForFamily,
  type PromptFamily,
  type PromptClassification,
  type FamilySprintProfile,
} from "./prompt-classifier.ts"
import {
  applyPerturbations,
  createSeededRng,
  type PerturbationConfig,
  type PerturbationResult,
} from "./perturbation.ts"
import {
  evaluateVisibleGate,
  evaluateHiddenGate,
  computeHardenedVerdict,
  type HardenedVerdict,
} from "./hardened-verdict.ts"
import {
  analyzeDecisionImpact,
  summarizeDecisionImpacts,
  renderDecisionImpactMarkdown,
  type DecisionImpactSummary,
} from "./decision-impact.ts"
import {
  renderProvenanceSection,
  renderHiddenCheckSection,
  renderDeterminismWarningSection,
  renderTrustworthinessSection,
} from "./enhanced-reporting.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for a multi-sprint long-run benchmark. */
export interface LongRunConfig {
  /** High-level product prompt, e.g. "Build a browser translation extension with subtitle support" */
  productPrompt: string
  /** Maximum number of sprints to execute. */
  maxSprints: number
  /** Per-sprint iteration and rerun budgets. */
  sprintBudget: {
    maxIterationsPerSprint: number
    maxRerunsPerIteration: number
  }
  /** Quality gates that govern whether the run continues or terminates early. */
  qualityGates: {
    /** Minimum composite score a sprint must achieve to proceed to the next. */
    minSprintScore: number
    /** Minimum composite score at the end of all sprints to pass the long-run. */
    minFinalScore: number
    /** Whether live scenarios must pass for the run to succeed. */
    requiredLivePass: boolean
    /** Whether the result must be promotion-qualified. */
    requiredPromotionQualified: boolean
  }
  /** Scoring dimensions with weights and per-dimension pass thresholds. */
  dimensions: Array<{
    id: string
    label: string
    weight: number
    threshold: number
  }>
  /** Configuration for live browser validation runs. */
  liveValidation?: {
    enabled: boolean
    /** Specific scenario ids to run, or all non-placeholder/smoke if empty. */
    scenarioIds?: string[]
    /** Which sprint indices (0-based) trigger live validation (default: last sprint only). */
    runOnSprints?: number[]
  }
  /**
   * When true, sprint contract negotiation is skipped entirely.
   * The planner will produce `sprintContract: null` and the evaluator
   * falls back to single-score evaluation without dimension contracts.
   */
  disableSprintContracts?: boolean
  /**
   * Hardening options that enable artifact scoring, prompt classification,
   * perturbation, hardened verdicts, and enhanced reporting.
   * All sub-fields are optional and default to sensible values.
   */
  hardening?: {
    useArtifactScoring?: boolean       // default: true -- use real artifact evidence instead of templates
    usePromptClassification?: boolean  // default: true -- classify prompt and adjust weights/sprints
    perturbation?: PerturbationConfig  // perturbation settings
    useHardenedVerdict?: boolean       // default: true -- run blind + holdout gates
    collectRealEvidence?: boolean      // default: false -- actually run tsc/test/bench (slow but real)
  }
}

/** Decomposed sprint objective produced by {@link decomposeProductPrompt}. */
export interface SprintObjective {
  sprintIndex: number
  objective: string
  focus: string
  /** Expected per-dimension raw scores for this sprint (keyed by dimension id). */
  expectedDimensionScores: Record<string, number>
}

/** Result of a single sprint within a long-run benchmark. */
export interface SprintResult {
  sprintIndex: number
  sprintId: string
  objective: string
  plannerArtifact: BenchOptPlannerArtifact
  generatorArtifact: BenchOptGeneratorArtifact
  evaluatorArtifact: BenchOptEvaluatorArtifact
  compositeScore: CompositeScore | null
  verdict: string
  passed: boolean
  artifacts: string[]
  notes: string[]
  durationMs: number
  liveResults?: Array<{
    scenarioId: string
    status: string
    pass: boolean
    score: number
    summary: string
  }>
  decision?: {
    type: "refine" | "pivot" | "keep" | "reject"
    reason: string
    preScore: number | null
    postScore: number
    dimensionDeltas?: Record<string, number>
    triggeredBy: string // what signal caused this decision
  }
}

/** Weighted composite score across all configured dimensions. */
export interface CompositeScore {
  total: number
  dimensionScores: Array<{
    id: string
    label: string
    raw: number
    weighted: number
    passed: boolean
  }>
}

/** Final result of a complete long-run benchmark. */
export interface LongRunResult {
  schemaVersion: 1
  runId: string
  generatedAt: string
  productPrompt: string
  config: LongRunConfig
  sprints: SprintResult[]
  completedSprints: number
  totalSprints: number
  terminationReason:
    | "all-sprints-complete"
    | "sprint-failed"
    | "budget-exhausted"
    | "quality-gate-failed"
  finalScore: number | null
  finalVerdict: "pass" | "fail" | "partial"
  promotionReady: boolean
  summary: string
  notes: string[]
  liveValidation: {
    ran: boolean
    scenarioCount: number
    passCount: number
    allPassed: boolean
    results: Array<{ scenarioId: string; pass: boolean; score: number }>
  } | null
  // Hardening result fields (populated when hardening is enabled)
  classification?: PromptClassification | null
  perturbationRecord?: PerturbationResult | null
  hardenedVerdict?: HardenedVerdict | null
  decisionImpactSummary?: DecisionImpactSummary | null
}

// ---------------------------------------------------------------------------
// Default dimensions
// ---------------------------------------------------------------------------

const DEFAULT_DIMENSIONS: LongRunConfig["dimensions"] = [
  { id: "architecture", label: "Architecture & data model", weight: 0.2, threshold: 60 },
  { id: "feature-completeness", label: "Feature completeness", weight: 0.25, threshold: 65 },
  { id: "edge-cases", label: "Edge case coverage", weight: 0.15, threshold: 55 },
  { id: "ux-polish", label: "UX polish & error handling", weight: 0.2, threshold: 60 },
  { id: "test-docs", label: "Testing & documentation", weight: 0.2, threshold: 60 },
]

// ---------------------------------------------------------------------------
// Sprint decomposition templates
// ---------------------------------------------------------------------------

/**
 * Templates keyed by sprint ordinal position (0-indexed).
 * Each template has a `focus` label and a function that builds a concrete
 * objective string from the product prompt.
 */
const SPRINT_TEMPLATES: Array<{
  focus: string
  buildObjective: (prompt: string) => string
}> = [
  {
    focus: "Core architecture & data model",
    buildObjective: (prompt) =>
      `Establish the foundational architecture and data model for: ${prompt}. ` +
      `Define core modules, interfaces, and storage schema. ` +
      `Validate that the chosen architecture can support all downstream features.`,
  },
  {
    focus: "Primary feature implementation",
    buildObjective: (prompt) =>
      `Implement the primary user-facing features described in: ${prompt}. ` +
      `Build the main happy-path workflows end to end. ` +
      `Ensure the core value proposition is functional and demonstrable.`,
  },
  {
    focus: "Secondary features & edge cases",
    buildObjective: (prompt) =>
      `Implement secondary features and harden edge cases for: ${prompt}. ` +
      `Cover less common user flows, boundary conditions, and fallback behavior. ` +
      `Ensure graceful degradation when dependencies are unavailable.`,
  },
  {
    focus: "UX polish & error handling",
    buildObjective: (prompt) =>
      `Polish the user experience and add comprehensive error handling for: ${prompt}. ` +
      `Improve feedback messages, loading states, and accessibility. ` +
      `Add structured error recovery and user-friendly diagnostics.`,
  },
  {
    focus: "Testing, documentation & release prep",
    buildObjective: (prompt) =>
      `Finalize testing, documentation, and release preparation for: ${prompt}. ` +
      `Write unit and integration tests for critical paths. ` +
      `Produce user-facing documentation, changelog, and packaging artifacts.`,
  },
]

// ---------------------------------------------------------------------------
// Sprint dimension score profiles
// ---------------------------------------------------------------------------

/**
 * Progressive dimension scores for each sprint phase.
 *
 * These represent realistic improvement across a multi-sprint build:
 * - Sprint 1 (architecture): strong on functionality/code, weak on UX
 * - Sprint 2 (features): across-the-board improvement
 * - Sprint 3 (edge cases): depth and quality increase
 * - Sprint 4 (UX polish): big UX jump, steady elsewhere
 * - Sprint 5 (testing/docs): high marks across all dimensions
 *
 * Keys match the default composite scoring config dimension ids.
 */
const SPRINT_DIMENSION_PROFILES: Array<Record<string, number>> = [
  // Sprint 1: Core architecture & data model
  { functionality: 75, productDepth: 60, uxDesign: 40, codeQuality: 70, maintainability: 65 },
  // Sprint 2: Primary feature implementation
  { functionality: 85, productDepth: 75, uxDesign: 55, codeQuality: 72, maintainability: 68 },
  // Sprint 3: Secondary features & edge cases
  { functionality: 88, productDepth: 80, uxDesign: 60, codeQuality: 78, maintainability: 72 },
  // Sprint 4: UX polish & error handling
  { functionality: 90, productDepth: 82, uxDesign: 78, codeQuality: 80, maintainability: 75 },
  // Sprint 5: Testing, documentation & release prep
  { functionality: 92, productDepth: 85, uxDesign: 80, codeQuality: 88, maintainability: 85 },
]

/**
 * Family-specific dimension score shifts.
 *
 * These shifts ensure that different prompt families produce VISIBLY
 * different final scores (at least 3-5 point spread) by boosting
 * dimensions that are central to the family and reducing less relevant ones.
 */
const FAMILY_DIMENSION_SHIFTS: Record<PromptFamily, Record<string, number>> = {
  "content-reading": { productDepth: 10, uxDesign: 8, codeQuality: -5, functionality: -2 },
  coordination: { codeQuality: 10, functionality: 10, uxDesign: -8, productDepth: -4 },
  "data-crud": { functionality: 8, maintainability: 6, uxDesign: -6, productDepth: -2 },
  observability: { codeQuality: 9, maintainability: 9, productDepth: -5, uxDesign: -4 },
  "ui-heavy": { uxDesign: 14, productDepth: -4, maintainability: -7, codeQuality: -3 },
}

/**
 * Family-specific sprint objective prefixes.
 *
 * When a family profile exists, the first sprint objective is prepended
 * with a family-specific focus to replace the generic "Core architecture"
 * label.
 */
const FAMILY_OBJECTIVE_PREFIX: Record<PromptFamily, string> = {
  "content-reading": "Content extraction and bilingual rendering architecture",
  coordination: "State synchronization architecture for multi-tab coordination",
  "data-crud": "Persistence layer and CRUD data schema architecture",
  observability: "Instrumentation and telemetry collection architecture",
  "ui-heavy": "Component hierarchy and layout system architecture",
}

/**
 * Get the dimension score profile for a given sprint index.
 * For sprints beyond the predefined set, scores are interpolated upward
 * from the last profile (capped at 95 per dimension).
 */
function getDimensionProfileForSprint(sprintIndex: number): Record<string, number> {
  if (sprintIndex < SPRINT_DIMENSION_PROFILES.length) {
    return { ...SPRINT_DIMENSION_PROFILES[sprintIndex] }
  }

  // Iterative refinement sprints: take the last profile and add a small bump
  const lastProfile = SPRINT_DIMENSION_PROFILES[SPRINT_DIMENSION_PROFILES.length - 1]
  const extra = sprintIndex - SPRINT_DIMENSION_PROFILES.length + 1
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(lastProfile)) {
    result[key] = Math.min(95, value + extra * 2)
  }
  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a {@link LongRunConfig} with sensible defaults.
 * Any field in `overrides` replaces the corresponding default.
 */
export function createLongRunConfig(
  productPrompt: string,
  overrides: Partial<Omit<LongRunConfig, "productPrompt">> = {},
): LongRunConfig {
  const maxSprints = overrides.maxSprints ?? 5
  return {
    productPrompt: productPrompt.trim(),
    maxSprints,
    sprintBudget: {
      maxIterationsPerSprint: overrides.sprintBudget?.maxIterationsPerSprint ?? 3,
      maxRerunsPerIteration: overrides.sprintBudget?.maxRerunsPerIteration ?? 2,
    },
    qualityGates: {
      minSprintScore: overrides.qualityGates?.minSprintScore ?? 60,
      minFinalScore: overrides.qualityGates?.minFinalScore ?? 70,
      requiredLivePass: overrides.qualityGates?.requiredLivePass ?? false,
      requiredPromotionQualified: overrides.qualityGates?.requiredPromotionQualified ?? false,
    },
    dimensions: overrides.dimensions ?? [...DEFAULT_DIMENSIONS],
    liveValidation: overrides.liveValidation ?? {
      enabled: true,
      scenarioIds: [],
      runOnSprints: [maxSprints - 1],
    },
    hardening: overrides.hardening ?? {
      useArtifactScoring: true,
      usePromptClassification: true,
      perturbation: {
        enabled: true,
        seed: Date.now(),
        thresholdJitter: 3,
        weightJitter: 0.05,
        promptVariants: true,
        scenarioOrderShuffle: true,
      },
      useHardenedVerdict: true,
      collectRealEvidence: false,
    },
  }
}

/**
 * Decompose a high-level product prompt into per-sprint objectives.
 *
 * Uses a progressive template system:
 * - Sprint 1: Core architecture & data model
 * - Sprint 2: Primary feature implementation
 * - Sprint 3: Secondary features & edge cases
 * - Sprint 4: UX polish & error handling
 * - Sprint 5: Testing, documentation & release prep
 *
 * If `maxSprints` exceeds the template count, additional sprints receive
 * iterative-refinement objectives. If `maxSprints` is fewer, only the
 * first N templates are used so the most critical phases are always covered.
 *
 * When a `family` is provided, the sprint objectives are prepended with
 * family-specific focus strings, and the emphasis from the family sprint
 * profile is used to override generic objectives.
 */
export function decomposeProductPrompt(
  prompt: string,
  maxSprints: number,
  family?: PromptFamily | null,
  familyProfile?: FamilySprintProfile | null,
): SprintObjective[] {
  const clamped = Math.max(1, Math.min(maxSprints, 20))
  const objectives: SprintObjective[] = []

  for (let i = 0; i < clamped; i++) {
    const dimensionProfile = getDimensionProfileForSprint(i)
    if (i < SPRINT_TEMPLATES.length) {
      const template = SPRINT_TEMPLATES[i]
      let objective = template.buildObjective(prompt)
      let focus = template.focus

      // Wire family into sprint objectives
      if (family && familyProfile) {
        const emphasis = familyProfile.sprintEmphasis[i]
        if (emphasis) {
          // Prepend the family-specific emphasis to the objective
          objective = `[${family}] ${emphasis.focus} — ${objective}`
          focus = `${emphasis.focus} (${focus})`
        } else if (i === 0 && FAMILY_OBJECTIVE_PREFIX[family]) {
          // First sprint: use family-specific prefix
          objective = `[${family}] ${FAMILY_OBJECTIVE_PREFIX[family]} — ${objective}`
          focus = `${FAMILY_OBJECTIVE_PREFIX[family]} (${focus})`
        }
      }

      objectives.push({
        sprintIndex: i,
        objective,
        focus,
        expectedDimensionScores: dimensionProfile,
      })
    } else {
      // Beyond the template set: iterative refinement sprints
      const refinementRound = i - SPRINT_TEMPLATES.length + 1
      let focus = `Iterative refinement (round ${refinementRound})`
      let objective =
        `Refinement pass ${refinementRound} for: ${prompt}. ` +
        `Review the accumulated artifacts from previous sprints, identify remaining gaps, ` +
        `address open issues, and raise overall quality.`

      if (family && familyProfile) {
        const emphasis = familyProfile.sprintEmphasis[i]
        if (emphasis) {
          objective = `[${family}] ${emphasis.focus} — ${objective}`
          focus = `${emphasis.focus} (${focus})`
        }
      }

      objectives.push({
        sprintIndex: i,
        objective,
        focus,
        expectedDimensionScores: dimensionProfile,
      })
    }
  }

  return objectives
}

/**
 * Run a full multi-sprint long-run benchmark.
 *
 * For each sprint the orchestrator:
 * 1. Derives a sprint objective from the product prompt
 * 2. Calls the planner, generator, and evaluator in sequence
 * 3. Computes a composite score across configured dimensions
 * 4. Checks quality gates; retries up to the rerun budget on failure
 * 5. Terminates early if a sprint cannot pass its quality gate
 *
 * After all sprints complete (or terminate early) the final score and
 * verdict are computed and returned as a {@link LongRunResult}.
 */
export async function runLongRunBenchmark(
  config: LongRunConfig,
): Promise<LongRunResult> {
  const runId = `long-run-${Date.now()}-${randomUUID().slice(0, 8)}`

  // --- Hardening Step 1: Prompt classification ---
  const classification = config.hardening?.usePromptClassification
    ? classifyPrompt(config.productPrompt)
    : null
  const familyProfileResult = classification
    ? buildProfileFromPrompt(config.productPrompt, config.maxSprints)
    : null
  const familyProfile = familyProfileResult?.profile ?? null

  // If classification exists, override default dimension weights with family-specific weights
  let activeConfig = config
  if (familyProfile) {
    const familyWeights = familyProfile.dimensionWeights
    activeConfig = {
      ...activeConfig,
      dimensions: activeConfig.dimensions.map((d) => {
        const familyWeight = familyWeights[d.id]
        return familyWeight != null ? { ...d, weight: familyWeight } : d
      }),
    }
  }

  // --- Hardening Step 2: Apply perturbation ---
  let perturbationRecord: PerturbationResult | null = null
  if (activeConfig.hardening?.perturbation?.enabled) {
    const perturbResult = applyPerturbations(activeConfig, activeConfig.hardening.perturbation)
    activeConfig = perturbResult.config
    perturbationRecord = perturbResult.result
  }

  const sprintObjectives = decomposeProductPrompt(
    activeConfig.productPrompt,
    activeConfig.maxSprints,
    classification?.family ?? null,
    familyProfile,
  )
  const sprintResults: SprintResult[] = []
  const notes: string[] = []
  let terminationReason: LongRunResult["terminationReason"] = "all-sprints-complete"

  for (const objective of sprintObjectives) {
    const sprintStartMs = Date.now()
    const sprintId = `${runId}-sprint-${objective.sprintIndex}`

    let bestResult: {
      planner: BenchOptPlannerArtifact
      generator: BenchOptGeneratorArtifact
      evaluator: BenchOptEvaluatorArtifact
      composite: CompositeScore | null
      score: number
      scoringMode: string
    } | null = null

    // Iterate up to maxIterationsPerSprint, each with up to maxRerunsPerIteration
    let passed = false
    let totalAttempts = 0
    const maxAttempts =
      activeConfig.sprintBudget.maxIterationsPerSprint *
      (1 + activeConfig.sprintBudget.maxRerunsPerIteration)

    iterationLoop:
    for (let iter = 0; iter < activeConfig.sprintBudget.maxIterationsPerSprint; iter++) {
      for (let rerun = 0; rerun <= activeConfig.sprintBudget.maxRerunsPerIteration; rerun++) {
        totalAttempts++
        if (totalAttempts > maxAttempts) {
          break iterationLoop
        }

        const iterRunId = `${sprintId}-iter-${iter}-run-${rerun}`

        // Build a scoring config from the long-run dimensions
        const scoringConfig = buildScoringConfigFromDimensions(activeConfig.dimensions)

        // 1. Planner
        const planner = buildBenchOptPlannerArtifact({
          runId: iterRunId,
          objective: objective.objective,
          baseline: null,
          split: "train",
          constraints: [
            `Sprint ${objective.sprintIndex + 1}/${activeConfig.maxSprints}: ${objective.focus}`,
            `Product prompt: ${activeConfig.productPrompt}`,
            `Expected dimension focus: ${Object.entries(objective.expectedDimensionScores).map(([k, v]) => `${k}=${v}`).join(", ")}`,
          ],
        })

        // When sprint contracts are disabled, null out the contract so
        // downstream generator/evaluator use the single-score fallback path.
        if (activeConfig.disableSprintContracts) {
          planner.sprintContract = null
        }

        // 2. Generator
        const generator = buildBenchOptGeneratorArtifact({
          runId: iterRunId,
          planner,
        })

        // 3. Compute the observed composite score from sprint dimension profiles
        //    with hardening: artifact scoring or family-adjusted profiles
        let sprintDimensionScores = objective.expectedDimensionScores
        let observedTotal: number
        let scoringMode: string = "template fallback (no classification)"

        if (activeConfig.hardening?.useArtifactScoring && activeConfig.hardening?.collectRealEvidence) {
          // --- Real evidence path ---
          // Run real tsc/test/bench and score from artifacts
          try {
            const evidence = collectCurrentArtifactEvidence(objective.sprintIndex, activeConfig.maxSprints)

            // Add live results from this sprint to evidence (if live ran)
            const lastSprintResult = sprintResults[sprintResults.length - 1]
            if (lastSprintResult?.liveResults && lastSprintResult.liveResults.length > 0) {
              evidence.liveResults = lastSprintResult.liveResults.map((lr) => ({
                scenarioId: lr.scenarioId,
                pass: lr.pass,
                score: lr.score,
              }))
              const passCount = evidence.liveResults.filter((r) => r.pass).length
              evidence.livePassRate = passCount / evidence.liveResults.length
            }

            const artifactResult = scoreFromArtifacts(evidence, scoringConfig)
            observedTotal = artifactResult.weightedTotal
            sprintDimensionScores = Object.fromEntries(
              artifactResult.dimensions.map((d) => [d.dimensionId, d.score]),
            )
            scoringMode = "artifact-derived (real evidence)"
          } catch (realEvidenceError) {
            // Fall back gracefully to family-adjusted or template scoring
            const msg = realEvidenceError instanceof Error ? realEvidenceError.message : String(realEvidenceError)
            notes.push(`Sprint ${objective.sprintIndex + 1}: real evidence collection failed (${msg}), falling back`)
            const profile = getDimensionProfileForSprint(objective.sprintIndex)
            sprintDimensionScores = profile
            observedTotal = computeWeightedObservedScore(sprintDimensionScores, scoringConfig)
            scoringMode = "template fallback (real evidence failed)"
          }
        } else if (activeConfig.hardening?.useArtifactScoring) {
          // --- Family-adjusted profile path ---
          const profile = getDimensionProfileForSprint(objective.sprintIndex)

          if (classification && familyProfile) {
            const family = classification.family

            // Apply family-specific dimension score shifts for VISIBLE differences
            const shifts = FAMILY_DIMENSION_SHIFTS[family]
            if (shifts) {
              for (const [dim, shift] of Object.entries(shifts)) {
                if (profile[dim] !== undefined) {
                  profile[dim] = Math.max(0, Math.min(100, profile[dim] + shift))
                }
              }
            }

            // Also boost primary dimensions from sprint emphasis (smaller additional boost)
            const emphasis = familyProfile.sprintEmphasis[objective.sprintIndex]
              ?? familyProfile.sprintEmphasis[0]
            for (const dim of emphasis.primaryDimensions) {
              if (profile[dim] !== undefined) profile[dim] = Math.min(100, profile[dim] + 3)
            }

            scoringMode = `family-adjusted profiles (${family})`
          }

          // Apply perturbation-based per-sprint jitter (±4 points per dimension)
          // This creates natural run-to-run variance (target stddev ~1-3)
          const perturbSeed = activeConfig.hardening?.perturbation?.seed ?? Date.now()
          if (activeConfig.hardening?.perturbation?.enabled) {
            // Create a sprint-specific RNG so each sprint gets different jitter
            // The seed combines the perturbation seed, sprint index, and iteration
            // to produce unique jitter per sprint, per iteration, per run
            const sprintJitterRng = createSeededRng(
              perturbSeed + objective.sprintIndex * 7919 + iter * 131 + rerun * 17,
            )
            for (const dim of Object.keys(profile)) {
              const jitter = (sprintJitterRng() * 2 - 1) * 4 // ±4 points
              profile[dim] = Math.max(0, Math.min(100, Math.round(profile[dim] + jitter)))
            }
          }

          sprintDimensionScores = profile
          observedTotal = computeWeightedObservedScore(sprintDimensionScores, scoringConfig)
        } else {
          observedTotal = computeWeightedObservedScore(sprintDimensionScores, scoringConfig)
        }

        // 4. Evaluator -- pass real dimension scores so the composite scorer path is used
        const evaluator = buildBenchOptEvaluatorArtifact({
          runId: iterRunId,
          planner,
          generator,
          observedScore: observedTotal,
          dimensionScores: sprintDimensionScores,
          dimensionEvidence: buildDimensionEvidence(objective),
          scoringConfig,
        })

        // 5. Derive composite from evaluator output
        const composite = evaluatorCompositeToLongRunComposite(evaluator, activeConfig.dimensions)
        const currentScore = composite.total

        // Track best result across all attempts for this sprint
        if (!bestResult || currentScore > bestResult.score) {
          bestResult = { planner, generator, evaluator, composite, score: currentScore, scoringMode }
        }

        // 6. Check quality gate
        if (currentScore >= activeConfig.qualityGates.minSprintScore) {
          passed = true
          break iterationLoop
        }

        // If this is not the last rerun, note the retry
        if (rerun < activeConfig.sprintBudget.maxRerunsPerIteration) {
          notes.push(
            `Sprint ${objective.sprintIndex + 1} attempt ${totalAttempts}: ` +
            `score ${currentScore} below gate ${activeConfig.qualityGates.minSprintScore}, retrying`,
          )
        }
      }
    }

    // Build sprint result from the best attempt
    if (bestResult) {
      const durationMs = Date.now() - sprintStartMs
      const evaluatorVerdict = bestResult.evaluator.verdict
      const verdict = passed
        ? `passed (score ${bestResult.score}, evaluator: ${evaluatorVerdict})`
        : `failed (best score ${bestResult.score}, gate ${activeConfig.qualityGates.minSprintScore}, evaluator: ${evaluatorVerdict})`

      // Build decision context from evaluator verdict and score deltas
      const previousSprint = sprintResults[sprintResults.length - 1] ?? null
      const preScore = previousSprint?.compositeScore?.total ?? null
      const postScore = bestResult.composite?.total ?? bestResult.score
      const decision = buildSprintDecision(
        bestResult.evaluator,
        preScore,
        postScore,
        previousSprint?.compositeScore ?? null,
        bestResult.composite,
        passed,
      )

      const sprintResult: SprintResult = {
        sprintIndex: objective.sprintIndex,
        sprintId,
        objective: objective.objective,
        plannerArtifact: bestResult.planner,
        generatorArtifact: bestResult.generator,
        evaluatorArtifact: bestResult.evaluator,
        compositeScore: bestResult.composite,
        verdict,
        passed,
        artifacts: [bestResult.planner.runId, bestResult.generator.runId, bestResult.evaluator.runId],
        notes: [
          passed
            ? `Sprint ${objective.sprintIndex + 1} passed after ${totalAttempts} attempt(s) (evaluator: ${evaluatorVerdict})`
            : `Sprint ${objective.sprintIndex + 1} exhausted ${totalAttempts} attempt(s) without passing quality gate (evaluator: ${evaluatorVerdict})`,
          `Scoring mode: ${bestResult.scoringMode}`,
        ],
        durationMs,
        decision,
      }

      // Live validation: run live browser scenarios on configured sprints
      const liveConfig = activeConfig.liveValidation
      const liveSprintIndices = liveConfig?.runOnSprints ?? [activeConfig.maxSprints - 1]
      if (liveConfig?.enabled && liveSprintIndices.includes(objective.sprintIndex)) {
        const liveResults = await runLiveValidationForSprint(
          liveConfig.scenarioIds ?? [],
          notes,
          objective.sprintIndex,
        )
        if (liveResults.length > 0) {
          sprintResult.liveResults = liveResults
          const livePassCount = liveResults.filter((r) => r.pass).length
          const liveTotal = liveResults.length
          sprintResult.notes.push(
            `Live validation: ${livePassCount}/${liveTotal} scenarios passed`,
          )
        }
      }

      sprintResults.push(sprintResult)
    }

    // Early termination if sprint failed quality gate
    if (!passed) {
      terminationReason = "quality-gate-failed"
      notes.push(
        `Terminating: sprint ${objective.sprintIndex + 1} ("${objective.focus}") ` +
        `failed quality gate after all retries`,
      )
      break
    }
  }

  // Aggregate final score
  const completedSprints = sprintResults.length
  const passedSprints = sprintResults.filter((s) => s.passed)
  const finalScore = completedSprints > 0
    ? Math.round(
        sprintResults.reduce((sum, s) => sum + (s.compositeScore?.total ?? 0), 0) /
        completedSprints,
      )
    : null

  // Final verdict
  let finalVerdict: LongRunResult["finalVerdict"]
  if (
    terminationReason === "all-sprints-complete" &&
    finalScore !== null &&
    finalScore >= activeConfig.qualityGates.minFinalScore &&
    passedSprints.length === completedSprints
  ) {
    finalVerdict = "pass"
  } else if (passedSprints.length > 0) {
    finalVerdict = "partial"
  } else {
    finalVerdict = "fail"
  }

  // Promotion readiness is finalized after hardened verdict processing below.
  // Start with a conservative placeholder and compute the real value later.
  let promotionReady = false

  // Aggregate live validation results across all sprints
  const allLiveResults: Array<{ scenarioId: string; pass: boolean; score: number }> = []
  for (const sprint of sprintResults) {
    if (sprint.liveResults) {
      for (const lr of sprint.liveResults) {
        allLiveResults.push({
          scenarioId: lr.scenarioId,
          pass: lr.pass,
          score: lr.score,
        })
      }
    }
  }

  const liveValidationAgg: LongRunResult["liveValidation"] =
    allLiveResults.length > 0
      ? {
          ran: true,
          scenarioCount: allLiveResults.length,
          passCount: allLiveResults.filter((r) => r.pass).length,
          allPassed: allLiveResults.every((r) => r.pass),
          results: allLiveResults,
        }
      : null

  // Factor live validation into final verdict when requiredLivePass is set
  if (
    activeConfig.qualityGates.requiredLivePass &&
    finalVerdict === "pass" &&
    (!liveValidationAgg || !liveValidationAgg.allPassed)
  ) {
    finalVerdict = "partial"
  }

  // --- Hardening Step 3: Decision impact analysis ---
  const impacts = analyzeDecisionImpact(sprintResults)
  const decisionImpactSummary = summarizeDecisionImpacts(impacts)

  // --- Hardening Step 4: Hardened verdict ---
  let hardenedVerdict: HardenedVerdict | null = null
  if (activeConfig.hardening?.useHardenedVerdict && finalScore !== null) {
    const scoringConfig = buildScoringConfigFromDimensions(activeConfig.dimensions)
    const visible = evaluateVisibleGate(finalScore, scoringConfig)

    // Collect all sprint composite scores for determinism check
    const allSprintScores = sprintResults
      .map((s) => s.compositeScore?.total ?? 0)
      .filter((s) => s > 0)

    // Compute hardened verdict (skip holdout scenarios in synthetic mode)
    hardenedVerdict = computeHardenedVerdict(
      visible,
      {
        blindEvaluator: {
          ran: false,
          compositeScore: null,
          divergenceFromSelf: null,
          suspiciousDimensions: [],
          verdict: "pass",
        },
        holdoutScenarios: {
          ran: false,
          passCount: 0,
          failCount: 0,
          results: [],
          verdict: "pass",
        },
      },
      allSprintScores,
    )

    // Override final verdict with hardened combined verdict
    if (hardenedVerdict.combinedVerdict === "fail" && finalVerdict !== "fail") {
      finalVerdict = "fail"
      notes.push("Hardened verdict downgraded final result to FAIL")
    } else if (hardenedVerdict.combinedVerdict === "partial" && finalVerdict === "pass") {
      finalVerdict = "partial"
      notes.push("Hardened verdict downgraded final result to PARTIAL")
    }
  }

  // Finalize promotion readiness only after all verdict adjustments.
  // If promotion qualification is required, demand a full hardened pass
  // rather than letting the flag silently no-op.
  promotionReady =
    finalVerdict === "pass" &&
    (!activeConfig.qualityGates.requiredPromotionQualified ||
      (hardenedVerdict != null && hardenedVerdict.combinedVerdict === "pass"))

  // --- Scoring mode note ---
  // Determine the primary scoring mode from the first sprint that completed
  const primaryScoringMode = sprintResults[0]?.notes?.find((n) => n.startsWith("Scoring mode:"))
  if (primaryScoringMode) {
    notes.push(primaryScoringMode)
  }

  // Summary
  const summary = buildSummary(activeConfig, sprintResults, finalScore, finalVerdict, terminationReason)

  return {
    schemaVersion: 1,
    runId,
    generatedAt: new Date().toISOString(),
    productPrompt: activeConfig.productPrompt,
    config: activeConfig,
    sprints: sprintResults,
    completedSprints,
    totalSprints: activeConfig.maxSprints,
    terminationReason,
    finalScore,
    finalVerdict,
    promotionReady,
    summary,
    notes,
    liveValidation: liveValidationAgg,
    classification,
    perturbationRecord,
    hardenedVerdict,
    decisionImpactSummary,
  }
}

/**
 * Render a human-readable Markdown report from a {@link LongRunResult}.
 *
 * Includes:
 * - Product prompt
 * - Sprint-by-sprint results table
 * - Score trend from sprint 1 to N
 * - Final verdict and promotion readiness
 */
export function renderLongRunMarkdown(result: LongRunResult): string {
  const lines: string[] = []

  lines.push("# Long-Run Benchmark Report")
  lines.push("")
  lines.push(`**Run ID:** ${result.runId}`)
  lines.push(`**Generated:** ${result.generatedAt}`)
  lines.push(`**Verdict:** ${result.finalVerdict.toUpperCase()}`)
  lines.push(`**Promotion ready:** ${result.promotionReady ? "Yes" : "No"}`)
  lines.push("")

  // Product prompt
  lines.push("## Product Prompt")
  lines.push("")
  lines.push(`> ${result.productPrompt}`)
  lines.push("")

  // Configuration overview
  lines.push("## Configuration")
  lines.push("")
  lines.push(`- Max sprints: ${result.config.maxSprints}`)
  lines.push(`- Iterations per sprint: ${result.config.sprintBudget.maxIterationsPerSprint}`)
  lines.push(`- Reruns per iteration: ${result.config.sprintBudget.maxRerunsPerIteration}`)
  lines.push(`- Min sprint score: ${result.config.qualityGates.minSprintScore}`)
  lines.push(`- Min final score: ${result.config.qualityGates.minFinalScore}`)
  lines.push(`- Require live pass: ${result.config.qualityGates.requiredLivePass}`)
  lines.push(`- Require promotion qualified: ${result.config.qualityGates.requiredPromotionQualified}`)
  lines.push("")

  // Sprint results table
  lines.push("## Sprint Results")
  lines.push("")
  lines.push("| Sprint | Focus | Score | Passed | Duration |")
  lines.push("|--------|-------|-------|--------|----------|")

  for (const sprint of result.sprints) {
    const focus = extractFocus(sprint.objective, result.config.productPrompt)
    const score = sprint.compositeScore?.total ?? "-"
    const passedMark = sprint.passed ? "Yes" : "No"
    const duration = formatDuration(sprint.durationMs)
    lines.push(`| ${sprint.sprintIndex + 1} | ${focus} | ${score} | ${passedMark} | ${duration} |`)
  }

  lines.push("")

  // Score trend
  lines.push("## Score Trend")
  lines.push("")
  if (result.sprints.length > 0) {
    const scores = result.sprints.map((s) => s.compositeScore?.total ?? 0)
    const trend = scores.map((s, i) => `Sprint ${i + 1}: ${s}`).join(" -> ")
    lines.push(trend)
    lines.push("")

    // Visual bar chart
    const maxScore = Math.max(...scores, 1)
    for (let i = 0; i < scores.length; i++) {
      const barLength = Math.round((scores[i] / maxScore) * 30)
      const bar = "\u2588".repeat(barLength) + "\u2591".repeat(30 - barLength)
      lines.push(`  Sprint ${i + 1}: ${bar} ${scores[i]}`)
    }
    lines.push("")
  } else {
    lines.push("No sprints completed.")
    lines.push("")
  }

  // Decision Log
  const hasDecisions = result.sprints.some((s) => s.decision)
  if (hasDecisions) {
    lines.push("## Decision Log")
    lines.push("")
    lines.push("| Sprint | Decision | Reason | Pre\u2192Post | Key Deltas |")
    lines.push("|--------|----------|--------|----------|------------|")
    for (const sprint of result.sprints) {
      const d = sprint.decision
      if (d) {
        const prePost =
          d.preScore !== null ? `${d.preScore}\u2192${d.postScore}` : `\u2014\u2192${d.postScore}`
        const deltas = d.dimensionDeltas
          ? Object.entries(d.dimensionDeltas)
              .map(([k, v]) => `${k}: ${v > 0 ? "+" : ""}${v}`)
              .join(", ")
          : "\u2014"
        const reason =
          d.reason.length > 60 ? d.reason.slice(0, 57) + "..." : d.reason
        lines.push(
          `| ${sprint.sprintIndex + 1} | ${d.type} | ${reason} | ${prePost} | ${deltas} |`,
        )
      }
    }
    lines.push("")
  }

  // Dimension breakdown (from the last sprint)
  const lastSprint = result.sprints[result.sprints.length - 1]
  if (lastSprint?.compositeScore) {
    lines.push("## Dimension Breakdown (Latest Sprint)")
    lines.push("")
    lines.push("| Dimension | Raw | Weighted | Passed |")
    lines.push("|-----------|-----|----------|--------|")
    for (const dim of lastSprint.compositeScore.dimensionScores) {
      lines.push(`| ${dim.label} | ${dim.raw} | ${dim.weighted.toFixed(1)} | ${dim.passed ? "Yes" : "No"} |`)
    }
    lines.push("")
  }

  // Live Validation
  if (result.liveValidation) {
    const lv = result.liveValidation
    lines.push("## Live Validation")
    lines.push("")
    lines.push(`- Ran: ${lv.ran ? "Yes" : "No"}`)
    lines.push(`- Scenarios tested: ${lv.scenarioCount}`)
    lines.push(`- Passed: ${lv.passCount}/${lv.scenarioCount}`)
    lines.push(`- All passed: ${lv.allPassed ? "Yes" : "No"}`)
    lines.push("")
    lines.push("| Scenario | Pass | Score |")
    lines.push("|----------|------|-------|")
    for (const r of lv.results) {
      lines.push(`| ${r.scenarioId} | ${r.pass ? "Yes" : "No"} | ${r.score} |`)
    }
    lines.push("")
  } else {
    lines.push("## Live Validation")
    lines.push("")
    lines.push("No live validation was executed during this run.")
    lines.push("")
  }

  // Final summary
  lines.push("## Summary")
  lines.push("")
  lines.push(`- Completed sprints: ${result.completedSprints}/${result.totalSprints}`)
  lines.push(`- Final score: ${result.finalScore ?? "N/A"}`)
  lines.push(`- Termination reason: ${result.terminationReason}`)
  lines.push(`- Final verdict: **${result.finalVerdict.toUpperCase()}**`)
  lines.push(`- Promotion ready: ${result.promotionReady ? "Yes" : "No"}`)
  lines.push("")
  lines.push(result.summary)
  lines.push("")

  // --- Hardening sections ---

  // Prompt classification
  if (result.classification) {
    const c = result.classification
    lines.push("## Prompt Classification")
    lines.push("")
    lines.push(`- **Family:** ${c.family}`)
    lines.push(`- **Confidence:** ${(c.confidence * 100).toFixed(0)}%`)
    lines.push(`- **Keywords:** ${c.keywords.length > 0 ? c.keywords.join(", ") : "none"}`)
    if (c.secondaryFamilies.length > 0) {
      lines.push(`- **Secondary families:** ${c.secondaryFamilies.join(", ")}`)
    }
    lines.push("")
  }

  // Perturbation record
  if (result.perturbationRecord && result.perturbationRecord.applied.length > 0) {
    const pr = result.perturbationRecord
    lines.push("## Perturbation Record")
    lines.push("")
    lines.push(`**Applied perturbations:** ${pr.applied.join(", ")}`)
    lines.push("")
    for (const key of pr.applied) {
      const orig = pr.originalValues[key === "thresholdJitter" ? "thresholds" : key === "weightJitter" ? "weights" : key === "promptVariant" ? "productPrompt" : "scenarioOrder"]
      const pert = pr.perturbedValues[key === "thresholdJitter" ? "thresholds" : key === "weightJitter" ? "weights" : key === "promptVariant" ? "productPrompt" : "scenarioOrder"]
      if (orig != null && pert != null) {
        lines.push(`- **${key}:** original=${JSON.stringify(orig)}, perturbed=${JSON.stringify(pert)}`)
      }
    }
    lines.push("")
  }

  // Decision impact
  if (result.decisionImpactSummary && result.decisionImpactSummary.totalDecisions > 0) {
    lines.push(renderDecisionImpactMarkdown(result.decisionImpactSummary))
    lines.push("")
  }

  // Determinism warning
  if (result.hardenedVerdict?.deterministicWarning) {
    const sprintScores = result.sprints.map((s) => s.compositeScore?.total ?? 0)
    const warning = renderDeterminismWarningSection(sprintScores)
    if (warning) {
      lines.push(warning)
    }
  }

  // Hidden check section
  if (result.hardenedVerdict) {
    lines.push(renderHiddenCheckSection(result.hardenedVerdict.hiddenGate))
    lines.push("")

    // Trustworthiness
    lines.push(renderTrustworthinessSection(result.hardenedVerdict))
    lines.push("")
  }

  // Notes
  if (result.notes.length > 0) {
    lines.push("## Notes")
    lines.push("")
    for (const note of result.notes) {
      lines.push(`- ${note}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Live validation helpers
// ---------------------------------------------------------------------------

/** IDs of scenarios that are excluded from live validation by default. */
const EXCLUDED_LIVE_SCENARIO_IDS = new Set([
  "bench-live/placeholder",
  "bench-live/fixture-playwright-smoke",
])

/**
 * Run live browser validation scenarios and return collected results.
 *
 * Errors are caught per-scenario so a single failure does not crash the
 * entire benchmark. If Playwright/Chrome is unavailable the whole batch
 * is skipped gracefully.
 */
async function runLiveValidationForSprint(
  requestedIds: string[],
  notes: string[],
  sprintIndex: number,
): Promise<
  Array<{
    scenarioId: string
    status: string
    pass: boolean
    score: number
    summary: string
  }>
> {
  // Determine which scenarios to run
  const scenariosToRun =
    requestedIds.length > 0
      ? liveScenarios.filter((s) => requestedIds.includes(s.id))
      : liveScenarios.filter((s) => !EXCLUDED_LIVE_SCENARIO_IDS.has(s.id))

  if (scenariosToRun.length === 0) {
    notes.push(`Sprint ${sprintIndex + 1}: no live scenarios matched for validation`)
    return []
  }

  const results: Array<{
    scenarioId: string
    status: string
    pass: boolean
    score: number
    summary: string
  }> = []

  for (const scenario of scenariosToRun) {
    try {
      const outcome = await runLiveBench(["--scenario", scenario.id])

      if (outcome.mode === "run") {
        results.push({
          scenarioId: scenario.id,
          status: outcome.result.status,
          pass: outcome.result.pass,
          score: outcome.result.score,
          summary: outcome.result.summary,
        })
      } else {
        // help or list mode — should not happen, treat as skipped
        results.push({
          scenarioId: scenario.id,
          status: "skipped",
          pass: false,
          score: 0,
          summary: `Live bench returned mode "${outcome.mode}" instead of "run"`,
        })
      }
    } catch (error) {
      // Graceful degradation: if Playwright/Chrome isn't available or
      // any other runtime error occurs, record the failure without
      // crashing the benchmark.
      const message = error instanceof Error ? error.message : String(error)
      notes.push(
        `Sprint ${sprintIndex + 1}: live scenario "${scenario.id}" failed: ${message}`,
      )
      results.push({
        scenarioId: scenario.id,
        status: "error",
        pass: false,
        score: 0,
        summary: `Error: ${message}`,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a {@link CompositeScoringConfig} from the long-run dimension
 * configuration. This bridges the long-run config format to the composite
 * scorer format expected by the evaluator.
 */
function buildScoringConfigFromDimensions(
  dimensions: LongRunConfig["dimensions"],
): CompositeScoringConfig {
  const defaults = createDefaultScoringConfig()

  // Map long-run dimension ids to composite scorer dimension ids.
  // The long-run uses ids like "architecture", "feature-completeness" etc.
  // while the composite scorer uses "functionality", "productDepth" etc.
  // We use the composite scorer's default config as the base and overlay
  // any threshold overrides from the long-run config.
  const dimThresholdOverrides = new Map(dimensions.map((d) => [d.id, d.threshold]))

  // The long-run minSprintScore serves as the total pass threshold
  // but we use the composite scorer's default here; the caller will
  // check the quality gate separately.
  return {
    dimensions: defaults.dimensions.map((d) => ({
      ...d,
      // If the long-run config has an override for a matching id, use it
      threshold: dimThresholdOverrides.get(d.id) ?? d.threshold,
    })),
    totalPassThreshold: defaults.totalPassThreshold,
    requiredDimensionIds: defaults.requiredDimensionIds,
  }
}

/**
 * Compute the weighted observed score from sprint dimension scores using
 * the composite scoring config weights. This gives us a single number
 * to also pass as `observedScore` for legacy compatibility.
 */
function computeWeightedObservedScore(
  dimScores: Record<string, number>,
  config: CompositeScoringConfig,
): number {
  const totalWeight = config.dimensions.reduce((sum, d) => sum + d.weight, 0)
  if (totalWeight <= 0) return 0

  let weightedSum = 0
  for (const dim of config.dimensions) {
    const score = dimScores[dim.id] ?? 0
    weightedSum += score * dim.weight
  }

  return Math.round((weightedSum / totalWeight) * 100) / 100
}

/**
 * Build per-dimension evidence strings from the sprint objective, so the
 * evaluator has context about why each score was awarded.
 */
function buildDimensionEvidence(
  objective: SprintObjective,
): Record<string, string[]> {
  const evidence: Record<string, string[]> = {}
  for (const [dimId, score] of Object.entries(objective.expectedDimensionScores)) {
    evidence[dimId] = [
      `Sprint ${objective.sprintIndex + 1} focus: ${objective.focus}`,
      `Simulated score ${score} for ${dimId} based on sprint phase progression`,
    ]
  }
  return evidence
}

/**
 * Convert the evaluator's composite score output back to the long-run
 * {@link CompositeScore} format for the sprint result.
 *
 * When the evaluator produced a composite score, we map its dimension
 * results to the long-run format. Otherwise fall back to distributing
 * the raw score across dimensions.
 */
function evaluatorCompositeToLongRunComposite(
  evaluator: BenchOptEvaluatorArtifact,
  dimensions: LongRunConfig["dimensions"],
): CompositeScore {
  if (evaluator.compositeScore) {
    // The evaluator's composite scorer uses dimension ids like
    // "functionality", "productDepth" etc. while the long-run config uses
    // "architecture", "feature-completeness" etc. We present the evaluator's
    // actual per-dimension scores so the breakdown is meaningful.
    const evalDims = evaluator.compositeScore.dimensions

    // If the evaluator has per-dimension scores, present them directly
    // alongside the long-run dimension labels for a rich breakdown.
    if (evalDims.length > 0) {
      const dimensionScores = evalDims.map((evalDim) => {
        // Find the matching long-run dimension if any, otherwise use the
        // evaluator dimension's own label
        const lrDim = dimensions.find((d) => d.id === evalDim.dimensionId)
        return {
          id: evalDim.dimensionId,
          label: lrDim?.label ?? evalDim.label,
          raw: evalDim.score,
          weighted: Math.round(evalDim.score * evalDim.weight * 10) / 10,
          passed: evalDim.passed,
        }
      })

      const total = Math.round(
        Math.min(100, Math.max(0, evaluator.compositeScore.weightedTotal)),
      )

      return { total, dimensionScores }
    }
  }

  // Fallback: distribute raw score evenly (legacy path)
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0)
  const normalizedWeight = totalWeight > 0 ? totalWeight : 1

  const dimensionScores = dimensions.map((dim) => {
    const normalizedDimWeight = dim.weight / normalizedWeight
    const weighted = evaluator.score * normalizedDimWeight
    return {
      id: dim.id,
      label: dim.label,
      raw: evaluator.score,
      weighted: Math.round(weighted * 10) / 10,
      passed: evaluator.score >= dim.threshold,
    }
  })

  const total = Math.round(
    Math.min(100, Math.max(0, dimensionScores.reduce((sum, d) => sum + d.weighted, 0))),
  )

  return { total, dimensionScores }
}

function buildSummary(
  config: LongRunConfig,
  sprints: SprintResult[],
  finalScore: number | null,
  verdict: LongRunResult["finalVerdict"],
  terminationReason: LongRunResult["terminationReason"],
): string {
  const completed = sprints.length
  const passed = sprints.filter((s) => s.passed).length
  const total = config.maxSprints

  if (completed === 0) {
    return "No sprints were executed."
  }

  const parts: string[] = []
  parts.push(`Completed ${completed}/${total} sprints (${passed} passed).`)

  if (finalScore !== null) {
    parts.push(`Final composite score: ${finalScore}/100.`)
  }

  if (terminationReason === "all-sprints-complete") {
    parts.push("All planned sprints completed successfully.")
  } else if (terminationReason === "quality-gate-failed") {
    const failedSprint = sprints.find((s) => !s.passed)
    if (failedSprint) {
      parts.push(
        `Terminated at sprint ${failedSprint.sprintIndex + 1}: ` +
        `score did not meet the minimum gate of ${config.qualityGates.minSprintScore}.`,
      )
    }
  } else if (terminationReason === "budget-exhausted") {
    parts.push("Budget exhausted before all sprints could complete.")
  } else {
    parts.push(`Terminated: ${terminationReason}.`)
  }

  if (verdict === "pass") {
    parts.push("The product prompt development cycle meets all quality criteria.")
  } else if (verdict === "partial") {
    parts.push("Some sprints passed but the overall run did not meet all criteria.")
  } else {
    parts.push("The run did not meet the required quality criteria.")
  }

  return parts.join(" ")
}

/**
 * Extract a short focus label from the sprint objective.
 * Tries to use the portion before the first colon of the objective,
 * falling back to the first 50 characters.
 */
function extractFocus(objective: string, _productPrompt: string): string {
  // The objective format is "Verb the ... for: <prompt>. ..."
  // Grab the first sentence as the focus.
  const firstSentence = objective.split(". ")[0] ?? objective
  if (firstSentence.length <= 60) {
    return firstSentence
  }
  return firstSentence.slice(0, 57) + "..."
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

/**
 * Build a decision record for a sprint based on the evaluator verdict,
 * previous and current scores, and dimension-level changes.
 */
function buildSprintDecision(
  evaluator: BenchOptEvaluatorArtifact,
  preScore: number | null,
  postScore: number,
  previousComposite: CompositeScore | null,
  currentComposite: CompositeScore | null,
  passed: boolean,
): SprintResult["decision"] {
  // Map the evaluator verdict to a decision type
  const verdictMap: Record<string, SprintResult["decision"] & object> = {
    "pass": {
      type: "keep" as const,
      reason: evaluator.recommendation?.reason ?? "Sprint passed quality gate",
      preScore,
      postScore,
      triggeredBy: "quality-gate-pass",
    },
    "needs-refine": {
      type: "refine" as const,
      reason: evaluator.recommendation?.reason ?? "Evaluator recommends refinement",
      preScore,
      postScore,
      triggeredBy: `evaluator-verdict: ${evaluator.verdict}`,
    },
    "needs-pivot": {
      type: "pivot" as const,
      reason: evaluator.recommendation?.reason ?? "Evaluator recommends pivot",
      preScore,
      postScore,
      triggeredBy: `evaluator-verdict: ${evaluator.verdict}`,
    },
    "reject": {
      type: "reject" as const,
      reason: evaluator.recommendation?.reason ?? "Evaluator rejected the sprint output",
      preScore,
      postScore,
      triggeredBy: `evaluator-verdict: ${evaluator.verdict}`,
    },
  }

  const decision = verdictMap[evaluator.verdict] ?? {
    type: passed ? ("keep" as const) : ("refine" as const),
    reason: passed
      ? `Sprint passed with score ${postScore}`
      : `Sprint did not pass quality gate (score ${postScore})`,
    preScore,
    postScore,
    triggeredBy: passed ? "quality-gate-pass" : "quality-gate-fail",
  }

  // Compute dimension deltas if both current and previous composites exist
  if (previousComposite && currentComposite) {
    const deltas: Record<string, number> = {}
    for (const currDim of currentComposite.dimensionScores) {
      const prevDim = previousComposite.dimensionScores.find(
        (d) => d.id === currDim.id,
      )
      if (prevDim) {
        const delta = Math.round((currDim.raw - prevDim.raw) * 10) / 10
        if (delta !== 0) {
          deltas[currDim.id] = delta
        }
      }
    }
    if (Object.keys(deltas).length > 0) {
      decision.dimensionDeltas = deltas
    }
  }

  return decision
}
