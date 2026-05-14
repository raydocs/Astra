# Astra Proof Benchmark Pack v1.0.0 — Official Guide

## What This Pack Contains

- 12 benchmark prompts across 3 difficulty tiers (4 easy, 5 medium, 3 hard)
- 5 prompt families (content-reading, coordination, data-crud, observability, ui-heavy)
- Fixed 5-dimension scoring rubric (functionality, productDepth, uxDesign, codeQuality, maintainability)
- Visible + hidden gate evaluation with blind evaluator and holdout scenarios
- 5-level verdict taxonomy (pass, pass-with-warnings, visible-pass-hidden-fail, partial, fail)

## How to Run

### Prerequisites

- Node.js 22+, pnpm 10+
- Chrome/Chromium (for live scenarios)
- `pnpm install`

### Run the full suite

```bash
npx tsx script/bench-opt/proof-suite-entry.ts --runs 3 --sprints 5
```

This executes all 12 prompts, 3 runs each, 5 sprints per run. Results are written to `data/bench-opt-results/proof-suite/`. A quick mode with 2 runs per prompt is also supported:

```bash
npx tsx script/bench-opt/proof-suite-entry.ts --runs 2 --sprints 5
```

### Run a single proof benchmark

```bash
npx tsx script/bench-opt/long-run-entry.ts --prompt "Build a minimal todo app browser extension with categories, due dates, and a compact popup panel" --sprints 5
```

Results are written to `data/bench-opt-results/long-run/`.

### Export the benchmark pack spec

```bash
npx tsx script/bench-opt/external-benchmark-pack-entry.ts --export data/bench-opt-results/benchmark-pack/
```

This produces `benchmark-pack.json` (the frozen pack config) and `benchmark-pack-spec.md` (the rendered specification).

### Validate results against the pack

```bash
npx tsx script/bench-opt/external-benchmark-pack-entry.ts --validate data/bench-opt-results/proof-suite/latest.proof-suite.json
```

## How to Interpret Results

### Score (0-100)

- Weighted average of 5 dimensions (see Dimensions table below)
- 78-82 typical range for current harness
- Different prompts produce different scores (stddev ~1.3 across 24 runs in latest suite)
- Easy prompts average ~78, medium ~80, hard ~79.5

### Verdict Taxonomy

| Verdict | Meaning |
|---------|---------|
| `pass` | Visible + hidden gates both pass |
| `pass-with-warnings` | Visible passes, blind evaluator has minor concerns |
| `visible-pass-hidden-fail` | Visible passes but holdout or blind failed |
| `partial` | Mixed results |
| `fail` | Visible gate failed |

### Visible vs Hidden

- **Visible lane**: Standard bench + live scenarios + composite scoring. The composite score must meet the `totalPassThreshold` (65) and required dimensions (functionality, codeQuality) must individually pass their thresholds.
- **Hidden lane**: Blind evaluator (artifact-only scoring) + holdout scenarios (harder edge cases). The blind evaluator re-scores using only observable evidence (build result, test results, live scenario outcomes, screenshots, DOM snapshots, code diff). Holdout scenarios run against conditions not seen during normal evaluation.
- Hidden gate can downgrade or veto a visible pass.

### Dimensions

| Dimension | Weight | Threshold | What it measures |
|-----------|--------|-----------|-----------------|
| functionality | 0.30 | 70 | Does the feature work? Build pass, test pass rate, live scenarios. |
| productDepth | 0.25 | 60 | More than a shallow stub? Files changed, test count, scenario coverage. |
| uxDesign | 0.15 | 50 | Reasonable UX? Live scenario scores, screenshot/DOM snapshot presence. |
| codeQuality | 0.20 | 65 | Clean, typed, safe code? Build health, test pass rate, error count. |
| maintainability | 0.10 | 50 | Maintainable long-term? Diff size (smaller is better), test presence. |

Weights sum to 1.0. The weighted total is:

```
weightedTotal = sum(dimension_score * dimension_weight) / sum(dimension_weight)
```

### Warnings to Watch For

- **Determinism warning**: All scores identical across runs — may indicate template scoring rather than genuine evaluation. Triggered when score stddev < 0.5.
- **Low prompt sensitivity**: Cross-prompt stddev < 3 points suggests insufficient differentiation between prompts.
- **Blind divergence > 15**: Significant gap between self-eval and blind eval. The blind evaluator uses a per-dimension suspicion threshold of 15 points. Divergence 0-8 = pass, 8-15 = warn, >15 = fail.

### Holdout Scenarios

- **`interaction-stress`**: 12+ interactive elements (buttons, nested forms), iframe interaction, DOM mutation under pressure, overlay element counting. Tests interaction priority under heavier conditions than the basic scenario.
- **`translation-race`**: Async content arriving via setTimeout-based DOM insertion. Translation triggered before all content loads. Verifies graceful handling of partial content, no race condition errors, and late-arriving content eventually translated.
- These are NOT in normal test runs — they only run during proof/hidden evaluation.
- Holdout scenarios are imported from `script/bench-live/scenarios/holdout/index.ts` and are intentionally NOT registered in the main scenario index.

## Difficulty Tiers

| Tier | Prompts | Count | Expected Score Range |
|------|---------|-------|---------------------|
| Easy | todo-app, bookmark-tagger, color-picker, tab-counter | 4 | 77-79 |
| Medium | article-summarizer, reading-assistant, perf-monitor, form-filler, page-annotator | 5 | 79-82 |
| Hard | multi-tab-coordinator, collab-editor, dashboard-builder | 3 | 78-81 |

## Suite Pass Conditions

All of the following must be met for the suite to receive a `stable-pass` verdict:

1. **Success rate >= 80%** of individual runs must pass
2. **Score stddev <= 5.0** across all runs
3. **Average score >= 70**
4. **Holdout pass rate >= 90%**
5. **No determinism warning** (or documented explanation)

Suite verdict mapping:
- `stable-pass`: >= 80% success rate
- `unstable`: 50-79% success rate
- `fail`: < 50% success rate

## Artifacts Produced

| Path | Description |
|------|-------------|
| `data/bench-opt-results/proof-suite/latest.proof-suite.json` | Full suite results (latest run) |
| `data/bench-opt-results/proof-suite/latest.proof-suite.md` | Markdown report (latest run) |
| `data/bench-opt-results/proof-suite/proof-suite-<timestamp>.json` | Timestamped archive |
| `data/bench-opt-results/proof-suite/proof-suite-<timestamp>.md` | Timestamped markdown archive |
| `data/bench-opt-results/long-run/` | Per-run detail from individual long-run benchmarks |
| `data/bench-opt-results/benchmark-pack/benchmark-pack.json` | Frozen benchmark pack config |
| `data/bench-opt-results/benchmark-pack/benchmark-pack-spec.md` | Rendered pack specification |
| `data/bench-live-results/` | Live scenario artifacts (screenshots, DOM snapshots) |

## Key Source Files

| File | Purpose |
|------|---------|
| `script/bench-opt/proof-suite.ts` | Suite config (12 prompts), runner, statistics |
| `script/bench-opt/proof-suite-entry.ts` | CLI entry point for suite execution |
| `script/bench-opt/long-run.ts` | Single long-run benchmark logic |
| `script/bench-opt/long-run-entry.ts` | CLI entry point for single runs |
| `script/bench-opt/composite-scorer.ts` | 5-dimension weighted scoring |
| `script/bench-opt/hardened-verdict.ts` | Visible + hidden gate verdict system |
| `script/bench-opt/blind-evaluator.ts` | Artifact-only blind scoring |
| `script/bench-opt/perturbation.ts` | Seeded PRNG perturbation for hardening |
| `script/bench-opt/external-benchmark-pack.ts` | Pack creation, validation, spec rendering |
| `script/bench-opt/external-benchmark-pack-entry.ts` | CLI entry point for pack export/validate |
| `script/bench-live/scenarios/holdout/index.ts` | Holdout scenario registry |
| `script/bench-live/scenarios/holdout/interaction-stress.ts` | Interaction stress holdout |
| `script/bench-live/scenarios/holdout/translation-race.ts` | Translation race holdout |

## Latest Results Summary (v1.0.0 baseline)

From `data/bench-opt-results/proof-suite/latest.proof-suite.json`:

- **Suite verdict**: `stable-pass`
- **Total runs**: 24 (12 prompts x 2 runs)
- **Success rate**: 100%
- **Average score**: 79.3
- **Score stddev**: 1.29
- **Holdout pass rate**: 100% (48/48)
- **Average blind divergence**: 8.34
- **Deterministic warning**: No
- **Average trustworthiness**: 100
- **Sprint progression**: 66.4 -> 76.0 -> 80.6 -> 84.6 -> 89.0
