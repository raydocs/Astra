/**
 * Prompt Classifier
 *
 * Classifies product prompts into families, then derives:
 * - Sprint-level emphasis profiles (which dimensions matter per sprint)
 * - Adjusted dimension weights for composite scoring
 * - Recommended live scenarios to validate the family
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptFamily =
  | "content-reading" // reading, summarization, annotation
  | "coordination" // multi-tab, concurrency, iframe
  | "data-crud" // todo, notes, persistence
  | "observability" // monitoring, metrics, dashboards
  | "ui-heavy" // design-focused, interaction-heavy

export interface PromptClassification {
  family: PromptFamily
  confidence: number // 0-1
  keywords: string[] // what triggered this classification
  secondaryFamilies: PromptFamily[]
}

export interface FamilySprintProfile {
  family: PromptFamily
  sprintEmphasis: Array<{
    sprintIndex: number
    focus: string
    primaryDimensions: string[] // which dimensions are most important this sprint
  }>
  dimensionWeights: Record<string, number> // adjusted weights for this family
  requiredDimensions: string[] // which must pass
  recommendedLiveScenarios: string[] // which live scenarios are most relevant
}

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const FAMILY_KEYWORDS: Record<PromptFamily, string[]> = {
  "content-reading": [
    "translation",
    "reading",
    "article",
    "highlight",
    "vocabulary",
    "summarize",
    "summarization",
    "annotation",
    "text",
    "paragraph",
    "subtitle",
    "bilingual",
    "spaced repetition",
    "srs",
    "reader",
    "book",
    "page",
    "extract",
    "digest",
  ],
  coordination: [
    "multi-tab",
    "cross-tab",
    "iframe",
    "concurrent",
    "coordinate",
    "coordination",
    "sync",
    "synchronize",
    "parallel",
    "race",
    "retry",
    "multi-window",
    "message passing",
    "broadcast",
    "worker",
    "shared state",
  ],
  "data-crud": [
    "todo",
    "notes",
    "save",
    "persist",
    "crud",
    "database",
    "storage",
    "create",
    "delete",
    "update",
    "list",
    "bookmark",
    "history",
    "record",
    "collection",
    "archive",
    "journal",
  ],
  observability: [
    "monitor",
    "metrics",
    "performance",
    "dashboard",
    "chart",
    "graph",
    "telemetry",
    "logging",
    "analytics",
    "real-time",
    "profiler",
    "trace",
    "latency",
    "throughput",
    "health",
    "status",
  ],
  "ui-heavy": [
    "panel",
    "popup",
    "overlay",
    "design",
    "ui",
    "layout",
    "animation",
    "responsive",
    "drag",
    "drop",
    "resize",
    "theme",
    "sidebar",
    "toolbar",
    "modal",
    "floating",
    "widget",
    "component",
  ],
}

// ---------------------------------------------------------------------------
// Sprint emphasis templates per family
// ---------------------------------------------------------------------------

interface SprintTemplate {
  focus: string
  primaryDimensions: string[]
}

const FAMILY_SPRINT_TEMPLATES: Record<PromptFamily, SprintTemplate[]> = {
  "content-reading": [
    {
      focus: "Data model for content extraction and storage",
      primaryDimensions: ["functionality", "codeQuality"],
    },
    {
      focus: "Reading UX — inline display, bilingual layout",
      primaryDimensions: ["uxDesign", "functionality"],
    },
    {
      focus: "Vocabulary management and spaced repetition",
      primaryDimensions: ["productDepth", "functionality"],
    },
    {
      focus: "Polish — accessibility, edge content types, performance",
      primaryDimensions: ["uxDesign", "maintainability"],
    },
  ],
  coordination: [
    {
      focus: "State synchronization architecture",
      primaryDimensions: ["codeQuality", "functionality"],
    },
    {
      focus: "Concurrency and parallel execution",
      primaryDimensions: ["functionality", "codeQuality"],
    },
    {
      focus: "Error handling and race condition mitigation",
      primaryDimensions: ["codeQuality", "maintainability"],
    },
    {
      focus: "Cross-context resilience and recovery",
      primaryDimensions: ["maintainability", "productDepth"],
    },
  ],
  "data-crud": [
    {
      focus: "Persistence layer and data schema",
      primaryDimensions: ["functionality", "codeQuality"],
    },
    {
      focus: "CRUD user interface and workflows",
      primaryDimensions: ["uxDesign", "functionality"],
    },
    {
      focus: "Validation, conflict resolution, and error states",
      primaryDimensions: ["codeQuality", "maintainability"],
    },
    {
      focus: "Bulk operations, search, and data export",
      primaryDimensions: ["productDepth", "functionality"],
    },
  ],
  observability: [
    {
      focus: "Data collection and instrumentation",
      primaryDimensions: ["functionality", "codeQuality"],
    },
    {
      focus: "Visualization — charts, dashboards, overlays",
      primaryDimensions: ["uxDesign", "productDepth"],
    },
    {
      focus: "Reliability — buffering, sampling, backpressure",
      primaryDimensions: ["codeQuality", "maintainability"],
    },
    {
      focus: "Alerting, thresholds, and historical comparison",
      primaryDimensions: ["productDepth", "functionality"],
    },
  ],
  "ui-heavy": [
    {
      focus: "Layout system and component hierarchy",
      primaryDimensions: ["uxDesign", "codeQuality"],
    },
    {
      focus: "Interaction patterns — drag, resize, hover, focus",
      primaryDimensions: ["uxDesign", "functionality"],
    },
    {
      focus: "Responsive design and cross-browser consistency",
      primaryDimensions: ["uxDesign", "maintainability"],
    },
    {
      focus: "Theming, animation, and accessibility",
      primaryDimensions: ["uxDesign", "productDepth"],
    },
  ],
}

// ---------------------------------------------------------------------------
// Dimension weight profiles per family
// ---------------------------------------------------------------------------

const FAMILY_DIMENSION_WEIGHTS: Record<PromptFamily, Record<string, number>> = {
  coordination: {
    codeQuality: 0.30,
    functionality: 0.30,
    maintainability: 0.15,
    productDepth: 0.15,
    uxDesign: 0.10,
  },
  "ui-heavy": {
    uxDesign: 0.35,
    functionality: 0.25,
    productDepth: 0.20,
    codeQuality: 0.15,
    maintainability: 0.05,
  },
  "data-crud": {
    functionality: 0.35,
    maintainability: 0.20,
    codeQuality: 0.20,
    productDepth: 0.15,
    uxDesign: 0.10,
  },
  "content-reading": {
    productDepth: 0.30,
    functionality: 0.25,
    uxDesign: 0.20,
    codeQuality: 0.15,
    maintainability: 0.10,
  },
  observability: {
    codeQuality: 0.25,
    functionality: 0.25,
    maintainability: 0.20,
    productDepth: 0.20,
    uxDesign: 0.10,
  },
}

// ---------------------------------------------------------------------------
// Required dimensions per family
// ---------------------------------------------------------------------------

const FAMILY_REQUIRED_DIMENSIONS: Record<PromptFamily, string[]> = {
  "content-reading": ["functionality", "productDepth"],
  coordination: ["functionality", "codeQuality"],
  "data-crud": ["functionality", "codeQuality"],
  observability: ["functionality", "codeQuality"],
  "ui-heavy": ["functionality", "uxDesign"],
}

// ---------------------------------------------------------------------------
// Recommended live scenarios per family
// ---------------------------------------------------------------------------

const FAMILY_LIVE_SCENARIOS: Record<PromptFamily, string[]> = {
  "content-reading": [
    "bench-live/page-translation-article-basic-bilingual",
    "bench-live/page-translation-article-basic-source-bilingual",
    "bench-live/page-translation-article-basic-source-translation-only",
    "bench-live/subtitle-basic",
  ],
  coordination: [
    "bench-live/frame-coordination-basic",
    "bench-live/interaction-priority-basic",
    "bench-live/holdout/interaction-stress",
    "bench-live/holdout/translation-race",
  ],
  "data-crud": [
    "bench-live/interaction-priority-basic",
    "bench-live/input-translation-basic",
  ],
  observability: [
    "bench-live/fixture-playwright-smoke",
    "bench-live/interaction-priority-basic",
  ],
  "ui-heavy": [
    "bench-live/interaction-priority-basic",
    "bench-live/input-translation-basic",
    "bench-live/subtitle-basic",
  ],
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a product prompt into a {@link PromptFamily} using keyword matching.
 *
 * The classifier normalises the prompt to lowercase and counts keyword hits
 * per family. The family with the most hits wins; confidence is proportional
 * to the hit count relative to the total keyword set size for that family.
 * Any families with at least one hit (but fewer than the winner) become
 * secondary families.
 */
export function classifyPrompt(prompt: string): PromptClassification {
  const lower = prompt.toLowerCase()

  const familyHits: Array<{
    family: PromptFamily
    hits: string[]
    score: number
  }> = []

  for (const [family, keywords] of Object.entries(FAMILY_KEYWORDS) as Array<
    [PromptFamily, string[]]
  >) {
    const hits: string[] = []
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        hits.push(kw)
      }
    }
    if (hits.length > 0) {
      // Score = hits / total keywords for this family, capped at 1
      const score = Math.min(1, hits.length / Math.max(1, keywords.length * 0.4))
      familyHits.push({ family, hits, score })
    }
  }

  // Sort by hit count descending, then by score descending as tiebreaker
  familyHits.sort((a, b) => b.hits.length - a.hits.length || b.score - a.score)

  if (familyHits.length === 0) {
    // No keywords matched — fall back to data-crud as the most generic family
    return {
      family: "data-crud",
      confidence: 0.1,
      keywords: [],
      secondaryFamilies: [],
    }
  }

  const primary = familyHits[0]
  const secondaryFamilies = familyHits
    .slice(1)
    .map((h) => h.family)

  return {
    family: primary.family,
    confidence: Math.round(primary.score * 100) / 100,
    keywords: primary.hits,
    secondaryFamilies,
  }
}

// ---------------------------------------------------------------------------
// Sprint profile
// ---------------------------------------------------------------------------

/**
 * Build a {@link FamilySprintProfile} for the given family and total sprint
 * count.
 *
 * If `totalSprints` exceeds the template count for the family, additional
 * sprints receive a generic "iterative refinement" emphasis. If fewer, only
 * the first N templates are used.
 */
export function getSprintProfileForFamily(
  family: PromptFamily,
  totalSprints: number,
): FamilySprintProfile {
  const templates = FAMILY_SPRINT_TEMPLATES[family]
  const clamped = Math.max(1, Math.min(totalSprints, 20))

  const sprintEmphasis: FamilySprintProfile["sprintEmphasis"] = []

  for (let i = 0; i < clamped; i++) {
    if (i < templates.length) {
      sprintEmphasis.push({
        sprintIndex: i,
        focus: templates[i].focus,
        primaryDimensions: [...templates[i].primaryDimensions],
      })
    } else {
      // Beyond template count: generic refinement sprint
      const refinementRound = i - templates.length + 1
      sprintEmphasis.push({
        sprintIndex: i,
        focus: `Iterative refinement (round ${refinementRound}) — raise weakest dimensions`,
        primaryDimensions: ["functionality", "maintainability"],
      })
    }
  }

  return {
    family,
    sprintEmphasis,
    dimensionWeights: { ...FAMILY_DIMENSION_WEIGHTS[family] },
    requiredDimensions: [...FAMILY_REQUIRED_DIMENSIONS[family]],
    recommendedLiveScenarios: [...FAMILY_LIVE_SCENARIOS[family]],
  }
}

// ---------------------------------------------------------------------------
// Dimension weights
// ---------------------------------------------------------------------------

/**
 * Return the adjusted dimension weights for the given prompt family.
 *
 * Weights always sum to 1.0.
 */
export function getDimensionWeightsForFamily(
  family: PromptFamily,
): Record<string, number> {
  return { ...FAMILY_DIMENSION_WEIGHTS[family] }
}

// ---------------------------------------------------------------------------
// Recommended live scenarios
// ---------------------------------------------------------------------------

/**
 * Return the recommended live scenario IDs for the given prompt family.
 */
export function getRecommendedLiveScenarios(
  family: PromptFamily,
): string[] {
  return [...FAMILY_LIVE_SCENARIOS[family]]
}

// ---------------------------------------------------------------------------
// Convenience: full profile from raw prompt
// ---------------------------------------------------------------------------

/**
 * Classify a prompt and build a complete sprint profile in one call.
 *
 * This is the primary entry point for callers that want classification +
 * sprint emphasis + dimension weights + recommended scenarios all at once.
 */
export function buildProfileFromPrompt(
  prompt: string,
  totalSprints: number,
): {
  classification: PromptClassification
  profile: FamilySprintProfile
} {
  const classification = classifyPrompt(prompt)
  const profile = getSprintProfileForFamily(classification.family, totalSprints)
  return { classification, profile }
}
