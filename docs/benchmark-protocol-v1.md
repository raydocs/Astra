# Astra Benchmark Protocol v1.0.0

_Frozen: 2026-03-27_
_This protocol MUST NOT be modified without incrementing the version number._

## 1. Prompt Set (12 prompts)

| # | ID | Prompt | Family | Difficulty |
|--:|------|--------|--------|-----------|
| 1 | `todo-app` | Build a minimal todo app browser extension with categories, due dates, and a compact popup panel | data-crud | easy |
| 2 | `bookmark-tagger` | Build a browser extension that lets users tag and organize bookmarks with a searchable popup | content-reading | easy |
| 3 | `color-picker` | Build a browser extension with a floating color picker overlay that copies hex/rgb values to clipboard | ui-heavy | easy |
| 4 | `tab-counter` | Build a browser extension that shows open tab count per window with a badge and simple popup breakdown | observability | easy |
| 5 | `article-summarizer` | Build a browser extension that summarizes articles, saves highlights with tags, and shows a reading history dashboard | content-reading | medium |
| 6 | `reading-assistant` | Build a lightweight reading assistant browser extension that shows inline translations, remembers learned vocabulary with spaced repetition, and offers a compact review panel | content-reading | medium |
| 7 | `perf-monitor` | Build a browser extension that monitors page performance, shows a real-time metrics overlay, and logs historical data with charts | observability | medium |
| 8 | `form-filler` | Build a browser extension that saves form field values, auto-fills matching forms on revisit, and manages multiple profiles | data-crud | medium |
| 9 | `page-annotator` | Build a browser extension that lets users draw highlights, add sticky notes, and pin comments directly on any webpage with persistence | ui-heavy | medium |
| 10 | `multi-tab-coordinator` | Build a multi-tab browser extension that coordinates cross-tab state, handles iframe content, manages concurrent API calls with retry logic, and renders results in a floating panel | coordination | hard |
| 11 | `collab-editor` | Build a browser extension for real-time collaborative annotation where multiple users can highlight, comment, and resolve threads on the same page with conflict resolution | coordination | hard |
| 12 | `dashboard-builder` | Build a browser extension that lets users create custom dashboard layouts with draggable widget panels, persistent layouts, and real-time data feeds from multiple page sources | ui-heavy | hard |

Source: `script/bench-opt/proof-suite.ts` — `createDefaultProofSuiteConfig()`

## 2. Tier Definition

- **Easy** (4 prompts): Simple single-feature extensions with clear scope. Expected score range: 77-79.
- **Medium** (5 prompts): Multi-feature extensions with persistence, UI complexity, or data management. Expected score range: 79-82.
- **Hard** (3 prompts): Cross-tab coordination, concurrency, real-time collaboration, or complex layout systems. Expected score range: 78-81.

## 3. Family Taxonomy

| Family | Description | Prompt Count |
|--------|-------------|-------------|
| content-reading | Reading, summarization, annotation, vocabulary, bookmarks | 3 (bookmark-tagger, article-summarizer, reading-assistant) |
| coordination | Multi-tab, concurrency, iframe, state sync, conflict resolution | 2 (multi-tab-coordinator, collab-editor) |
| data-crud | Todo, notes, forms, persistence, profiles | 2 (todo-app, form-filler) |
| observability | Monitoring, metrics, dashboards, charts, tab counting | 2 (tab-counter, perf-monitor) |
| ui-heavy | Design-focused, color tools, annotations, drag-and-drop, custom layouts | 3 (color-picker, page-annotator, dashboard-builder) |

## 4. Scoring Rubric

| Dimension | Weight | Threshold | What it measures |
|-----------|--------|-----------|-----------------|
| `functionality` | 0.30 | 70 | Does the feature work? Build pass, test pass rate, live scenario outcomes, bench score. |
| `productDepth` | 0.25 | 60 | More than a shallow stub? Files changed, lines added, test count, live scenario coverage. |
| `uxDesign` | 0.15 | 50 | Reasonable UX? Average live scenario score, screenshot presence, DOM snapshot presence. |
| `codeQuality` | 0.20 | 65 | Clean, typed, safe code? Build health, test pass rate, build error count. |
| `maintainability` | 0.10 | 50 | Maintainable long-term? Diff size (smaller is better for same functionality), test presence, build health. |

**Weights must sum to 1.0.**

```
weightedTotal = sum(dimension_score * dimension_weight) / sum(dimension_weight)
```

- **Total pass threshold**: 65
- **Required dimensions**: `functionality`, `codeQuality` (must individually meet their thresholds)

Source: `script/bench-opt/composite-scorer.ts` — `createDefaultScoringConfig()`

## 5. Verdict Taxonomy

| Verdict | Definition |
|---------|-----------|
| `pass` | Visible gate passes AND hidden gate passes (blind evaluator pass + holdout scenarios pass). Both evaluation lanes confirm the result. |
| `pass-with-warnings` | Visible gate passes. Blind evaluator has minor concerns (1-2 suspicious dimensions, divergence 8-15). No holdout failures. |
| `visible-pass-hidden-fail` | Visible gate passes (composite score >= 65, required dimensions pass) but the hidden gate failed: either blind evaluator detected >= 3 suspicious dimensions or composite divergence > 15, or holdout scenario pass rate < 50%. |
| `partial` | Visible gate marginal, hidden gate mixed. The run did not cleanly pass either lane. |
| `fail` | Visible gate failed: composite score below 65 or required dimensions did not meet their individual thresholds. Hidden gate result is irrelevant when visible fails. |

Source: `script/bench-opt/hardened-verdict.ts` — `HardenedCombinedVerdict` type and `computeHardenedVerdict()`

## 6. Gate Structure

### Visible gate

The visible gate evaluates the composite score from the 5-dimension rubric:

1. Compute weighted total across all 5 dimensions
2. Check `compositeScore >= totalPassThreshold` (65)
3. Check that required dimensions (`functionality`, `codeQuality`) individually pass their thresholds (70 and 65 respectively)
4. If both checks pass, visible gate = **pass**

Source: `script/bench-opt/hardened-verdict.ts` — `evaluateVisibleGate()`

### Hidden gate

The hidden gate has two independent checks:

**Blind evaluator** (`script/bench-opt/blind-evaluator.ts`):
- Re-scores the run using ONLY observable evidence: build result, test results, live scenario outcomes, screenshots, DOM snapshots, code diff summary, bench score
- No planner or generator self-descriptions are used
- Per-dimension divergence from self-evaluation is computed
- Per-dimension suspicion threshold: 15 points
- Verdict derivation:
  - `pass`: 0 suspicious dimensions
  - `warn`: 1-2 suspicious dimensions
  - `fail`: >= 3 suspicious dimensions OR composite delta > 15

**Holdout scenarios** (`script/bench-live/scenarios/holdout/index.ts`):
- `interaction-stress`: 12+ interactive elements, nested forms, iframe interaction, DOM mutation pressure, overlay counting
- `translation-race`: Async content via setTimeout DOM insertion, early translation trigger, race condition detection, late content verification
- Verdict derivation:
  - `pass`: pass rate >= 80%
  - `warn`: pass rate 50-79%
  - `fail`: pass rate < 50%

### Combined verdict rules

| Visible Gate | Blind Verdict | Holdout Verdict | Combined Verdict |
|-------------|---------------|-----------------|-----------------|
| fail | any | any | `fail` |
| pass | pass | pass | `pass` |
| pass | warn | pass | `pass-with-warnings` |
| pass | pass | warn | `pass-with-warnings` |
| pass | warn | warn | `pass-with-warnings` |
| pass | fail | any | `visible-pass-hidden-fail` |
| pass | any | fail | `visible-pass-hidden-fail` |

**Trustworthiness score**: `100 - (divergence * 2) - (holdout_failures * 15)`, clamped to [0, 100]. Deterministic warning applies an additional -20 penalty.

Source: `script/bench-opt/hardened-verdict.ts` — `computeHardenedVerdict()`

## 7. Holdout Policy

- Holdout scenarios are NOT visible during development or tuning. They are not registered in `script/bench-live/scenarios/index.ts`.
- They run only during proof evaluation via explicit import from `script/bench-live/scenarios/holdout/index.ts`.
- Current holdout set:
  - `interaction-stress` — stress test for interaction priority under heavy DOM conditions
  - `translation-race` — race condition test for async content translation
- Holdout set may be expanded but never reduced within a protocol version.
- If holdout scenarios cannot run (no browser available), the hidden gate records "not executed" and the holdout condition fails when `holdoutRequired: true`.

## 8. Run Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Sprints per run | 5 | `ProofSuiteConfig.sprintsPerRun` |
| Runs per prompt | 3 (standard) or 2 (quick) | `ProofSuiteConfig.runsPerPrompt` |
| Perturbation | enabled | `PerturbationConfig.enabled` |
| Perturbation seed | `Date.now() + runIndex * 1000 + promptIndex * 10000` | Seeded PRNG for reproducibility |
| Threshold jitter | +/-3 | `PerturbationConfig.thresholdJitter` |
| Weight jitter | +/-0.05 | `PerturbationConfig.weightJitter` |
| Prompt variants | enabled | `PerturbationConfig.promptVariants` |
| Scenario order shuffle | enabled | `PerturbationConfig.scenarioOrderShuffle` |
| Live validation | enabled on last sprint | `LongRunConfig.hardening` |
| Artifact scoring | enabled | `hardening.useArtifactScoring` |
| Prompt classification | enabled | `hardening.usePromptClassification` |
| Hardened verdict | enabled | `hardening.useHardenedVerdict` |

Source: `script/bench-opt/proof-suite.ts` — `runProofSuite()`, perturbation config block

## 9. Pass Conditions for the Suite

All of the following conditions must be met for the benchmark suite to pass:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| Success rate | >= 80% | Majority of individual runs must pass |
| Score stddev | <= 5.0 | Scores must be stable across prompts and runs |
| Average score | >= 70 | Minimum quality bar |
| Holdout pass rate | >= 90% | Edge case robustness |
| No determinism warning | score stddev >= 0.5 | Scores must not be suspiciously uniform |

Suite-level verdict:
- `stable-pass`: success rate >= 80%
- `unstable`: success rate 50-79%
- `fail`: success rate < 50%

Source: `script/bench-opt/external-benchmark-pack.ts` — `BenchmarkPackConfig.passConditions`, `script/bench-opt/proof-suite.ts` — `ProofSuiteResult.verdict`

## 10. Score Interpretation Guide

| Range | Interpretation |
|-------|---------------|
| 82+ | Exceptional. Rare for any single prompt. |
| 79-82 | Strong performance. Typical for medium and hard prompts. |
| 77-79 | Solid baseline. Typical for easy prompts. |
| 70-77 | Acceptable but below typical. Check dimension breakdown for weak areas. |
| 65-70 | Marginal pass. Likely failing one or more non-required dimensions. |
| < 65 | Below pass threshold. Visible gate fails. |

Sprint progression baseline (from v1.0.0 suite run):
- Sprint 1: ~66 (initial generation)
- Sprint 2: ~76 (first iteration)
- Sprint 3: ~81 (refinement)
- Sprint 4: ~85 (polishing)
- Sprint 5: ~89 (final)

## 11. Report Schema

The `ProofSuiteResult` JSON (`latest.proof-suite.json`) contains the following top-level fields:

```
{
  "schemaVersion": 1,
  "suiteId": "proof-suite-<timestamp>-<uuid>",
  "generatedAt": "<ISO 8601>",
  "config": {
    "prompts": [{ "id", "prompt", "category", "difficulty" }],
    "runsPerPrompt": number,
    "sprintsPerRun": number
  },
  "runs": [{
    "promptId": string,
    "runIndex": number,
    "result": {                          // LongRunResult
      "schemaVersion": 1,
      "runId": string,
      "generatedAt": string,
      "productPrompt": string,
      "config": { ... },                 // LongRunConfig
      "sprints": [{ ... }],              // per-sprint data
      "finalScore": number,
      "verdict": string,
      "notes": string[]
    },
    "durationMs": number,
    "hiddenGateResult": {                // HardenedVerdict | null
      "visibleGate": { "passed", "compositeScore", "dimensionsPassed", "dimensionsFailed", "notes" },
      "hiddenGate": {
        "blindEvaluator": { "ran", "compositeScore", "divergenceFromSelf", "suspiciousDimensions", "verdict" },
        "holdoutScenarios": { "ran", "passCount", "failCount", "results": [{ "scenarioId", "pass", "score" }], "verdict" }
      },
      "combinedVerdict": string,
      "verdictExplanation": string,
      "verdictReason": string,
      "deterministicWarning": boolean,
      "trustworthinessScore": number
    }
  }],
  "statistics": {
    "totalRuns": number,
    "passCount": number,
    "failCount": number,
    "partialCount": number,
    "successRate": number,               // 0-1
    "averageFinalScore": number,
    "scoreStdDev": number,
    "averageSprintScores": number[],     // avg score per sprint position
    "livePassRate": number,
    "promotionReadyRate": number,
    "perPrompt": [{ "promptId", "category", "runs", "passCount", "successRate", "avgScore", "scoreRange" }],
    "perDifficulty": [{ "difficulty", "runs", "passCount", "successRate", "avgScore" }],
    "promptFamilies": Record<string, number>,
    "deterministicWarning": boolean,
    "avgTrustworthiness": number,
    "hiddenGateRuns": number,
    "hiddenGateDowngrades": number,
    "holdoutPassCount": number,
    "holdoutFailCount": number,
    "avgBlindDivergence": number
  },
  "verdict": "stable-pass" | "unstable" | "fail",
  "notes": string[]
}
```

Source: `script/bench-opt/proof-suite.ts` — `ProofSuiteResult` interface

## 12. Artifact Layout

| Directory | Contents |
|-----------|----------|
| `data/bench-opt-results/proof-suite/` | Suite-level results: `latest.proof-suite.json`, `latest.proof-suite.md`, timestamped archives (`proof-suite-<timestamp>.json`, `proof-suite-<timestamp>.md`) |
| `data/bench-opt-results/long-run/` | Per-run detailed results from individual long-run benchmarks |
| `data/bench-opt-results/benchmark-pack/` | Frozen pack specification: `benchmark-pack.json`, `benchmark-pack-spec.md` |
| `data/bench-live-results/` | Live scenario artifacts: screenshots, DOM snapshots, scenario execution logs |

## 13. Reproducibility Requirements

1. **Node.js 22+** — required for modern ES module and TypeScript support
2. **pnpm 10+** — package manager
3. **Chrome/Chromium** — required for live scenarios (install via `npx playwright install chromium`)
4. **`pnpm install --frozen-lockfile`** before running — ensures exact dependency versions
5. **Results may vary slightly due to perturbation** — this is by design. Perturbation uses a seeded PRNG so the same seed produces the same jitter, but different runs use different seeds based on timestamp + run/prompt index.
6. **Environment variables** — copy `.env.example` to `.env` and configure API keys if needed

Full setup sequence:

```bash
git clone <repository-url> && cd Astra
pnpm install --frozen-lockfile
npx playwright install chromium
cp .env.example .env  # configure API keys if needed
npx tsx script/bench-opt/proof-suite-entry.ts --runs 3 --sprints 5
```

Validate results:

```bash
npx tsx script/bench-opt/external-benchmark-pack-entry.ts --validate data/bench-opt-results/proof-suite/latest.proof-suite.json
```

## 14. Version History

| Version | Date | Description |
|---------|------|-------------|
| v1.0.0 | 2026-03-27 | Initial frozen protocol. 12 prompts, 5 families, 3 tiers. 5-dimension scoring rubric. Visible + hidden gate system with blind evaluator and 2 holdout scenarios (interaction-stress, translation-race). |
