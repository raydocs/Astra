# Proof Suite Hardening Plan

Date: March 27, 2026
Purpose: Strengthen Astra's proof suite so the resulting benchmark evidence is harder to question and less dependent on template-shaped scoring.

## Why This Plan Exists

The current proof suite achieved an impressive result:

- 5 prompts
- 3 runs each
- 15/15 pass
- zero score variance
- identical sprint trend across prompts

That stability is useful, but it is also suspiciously regular. The main risk is not that the harness is weak. The risk is that the proof lane is still partially self-fulfilling.

This plan is about making future proof-suite results significantly more trustworthy.

---

## 1. Current Weaknesses to Address

### 1.1 Template-driven dimension scores
The long-run path currently uses pre-shaped sprint dimension profiles and `expectedDimensionScores`, which then feed the evaluator path. This makes results too predictable.

### 1.2 Weak prompt sensitivity
Different prompts currently converge to identical totals and identical sprint trends. That suggests the benchmark lane is not yet sensitive enough to prompt variation.

### 1.3 Blind/holdout infrastructure is present but not yet maximally consequential
Blind evaluator and holdout scenarios exist, but the current proof suite still appears dominated by the long-run template path.

### 1.4 Repeated success is too uniform
Stable success is good; perfectly uniform success is not ideal evidence. Real systems should show at least some controlled variability in outcome distribution.

---

## 2. Hardening Objectives

A hardened proof suite should satisfy these properties:

1. **Scores are primarily artifact-derived.**
2. **Prompts materially affect plans and outcomes.**
3. **Blind/holdout signals can change the verdict.**
4. **Refine/pivot decisions are observable and consequential.**
5. **Repeated success remains strong but no longer looks artificially flat.**

---

## 3. Workstream A — Remove Template-Driven Scoring

### Goal
Replace simulated or seeded dimension scores with scores inferred from observed artifacts.

### Current issue
The long-run lane uses precomputed sprint profiles and expected scores. This makes the evaluator look stronger than the underlying evidence really is.

### Target state
Each dimension score should be computed from one or more of:

- code diff shape
- type-check / test / bench results
- live/browser artifacts
- blind evaluator judgments
- artifact completeness
- rubric satisfaction checks

### Recommended implementation steps

#### A1. Introduce an artifact-derived dimension scorer
Create a scorer that maps real evidence to each dimension:

- functionality <- bench + live + acceptance checks
- productDepth <- feature coverage + artifact completeness + end-to-end flow checks
- uxDesign <- screenshot review + interaction smoothness + error state coverage
- codeQuality <- type-check + test health + structural heuristics + blind code review
- maintainability <- diff size, modularity heuristics, docs/tests presence, API clarity heuristics

#### A2. Keep seeded scores only as fallback or baseline
If seeded scores remain, they should be explicitly marked as fallback and never the primary proof-run signal.

#### A3. Add evidence provenance to each dimension
Every dimension score should include provenance such as:

- `source: blind-evaluator`
- `source: live-bench`
- `source: test-summary`
- `source: static-heuristic`

This makes the benchmark easier to trust.

### Success criteria
- sprint/final scores are no longer computed mainly from template profiles
- evidence strings no longer contain wording like simulated progression when running proof-suite mode
- dimension scorecards identify artifact provenance

---

## 4. Workstream B — Increase Prompt Sensitivity

### Goal
Ensure materially different prompts produce materially different benchmark trajectories.

### Current issue
Different prompts currently yield identical totals and identical sprint trends.

### Target state
Different prompts should influence:

- sprint decomposition
- dimension weights
- required dimensions
- live scenario selection
- quality gates
- likely failure modes

### Recommended implementation steps

#### B1. Prompt classification
Classify each product prompt into one or more benchmark families, such as:

- content/reading workflow
- coordination/concurrency workflow
- data CRUD workflow
- observability/tooling workflow
- UI-heavy workflow

#### B2. Dynamic sprint decomposition
Make planner output vary by prompt family. Example:

- perf-monitor should emphasize observability and reliability earlier
- multi-tab-coordinator should emphasize concurrency/race handling earlier
- todo-app should emphasize persistence and UX simplicity

#### B3. Dynamic dimension weighting
Adjust weights and required dimensions by prompt family. Example:

- multi-tab/coordinator: higher weight on edge cases and correctness under contention
- UI-heavy workflow: higher weight on UX design
- tooling workflow: higher weight on maintainability and code quality

#### B4. Dynamic live scenario selection
The proof suite should not always run the same live set. It should choose scenario bundles that correspond to the prompt family when possible.

### Success criteria
- different prompts generate measurably different sprint plans
- score distributions differ across prompt families
- scenario bundles differ across prompt families
- proof-suite reports show prompt-specific rationale

---

## 5. Workstream C — Make Blind and Holdout Signals Consequential

### Goal
Ensure blind evaluator and holdout scenarios are not decorative.

### Current issue
The infrastructure exists, but the current proof-suite result is still dominated by the template-like benchmark path.

### Target state
Final proof-suite verdicts should materially depend on:

- blind evaluator assessment
- hidden holdout live scenarios
- hidden perturbation checks

### Recommended implementation steps

#### C1. Split final verdict into visible and hidden gates
Require two successful lanes:

- visible benchmark lane
- hidden holdout lane

#### C2. Weight blind evaluator into final composite
The blind evaluator should either:

- produce one or more dimensions directly, or
- act as a veto / downgrade gate when evidence is weak

#### C3. Add hidden artifact review inputs
The blind evaluator should receive only observable artifacts, not planner/generator self-descriptions, when operating in proof mode.

### Success criteria
- holdout failures can downgrade or fail the proof suite
- blind evaluator can materially reduce final score or verdict
- proof report clearly distinguishes visible vs hidden checks

---

## 6. Workstream D — Strengthen Refine vs Pivot Evidence

### Goal
Show that the system not only logs refine/pivot decisions, but uses them in a meaningful way.

### Current issue
Decision logging exists, but the benchmark story is not yet centered on the impact of these decisions.

### Target state
For each refine/pivot decision, the report should show:

- why the decision happened
- what evidence triggered it
- what changed afterwards
- whether the decision improved results

### Recommended implementation steps

#### D1. Add decision-impact summaries
For each sprint, compute:

- score delta
- dimension deltas
- live delta if applicable
- whether the decision improved or worsened the run

#### D2. Add a pivot efficacy section to the report
Summarize:

- total refine decisions
- total pivot decisions
- average improvement after refine
- average improvement after pivot

#### D3. Add negative examples
When refine/pivot does not help, preserve that evidence. A trustworthy proof suite should not hide failed strategy choices.

### Success criteria
- refine/pivot behavior is visible in benchmark reports
- decision-impact statistics appear in proof-suite summaries
- operators can explain why the system changed direction

---

## 7. Workstream E — Introduce Controlled Perturbation

### Goal
Avoid suspiciously perfect determinism while preserving repeatability.

### Current issue
Zero variance across 15/15 runs looks too clean.

### Target state
The suite should show small, explainable variation without becoming flaky.

### Recommended perturbations

#### E1. Prompt phrasing variants
Use semantically equivalent prompt variants for the same benchmark target.

#### E2. Scenario-order perturbation
Vary the ordering of live scenarios and some evaluation substeps.

#### E3. DOM/runtime perturbation
Apply light perturbations such as:

- delayed async content
- reordered non-semantic nodes
- small interaction timing shifts
- modest viewport changes

#### E4. Threshold perturbation
Use small bounded changes to thresholds or required-dimension emphasis in non-primary runs.

### Guardrail
Perturbation should not make the suite flaky. The goal is realistic variance, not chaos.

### Success criteria
- proof-suite stddev is low but non-zero
- score variance is explainable
- repeated success remains strong

---

## 8. Workstream F — Reporting and Trustworthiness

### Goal
Make the suite easy to trust by a skeptical operator.

### Recommended report additions

#### F1. Provenance per dimension
For each dimension score, report where the evidence came from.

#### F2. Prompt-sensitivity section
Report how and why this prompt's decomposition differs from others.

#### F3. Hidden-check summary
Report whether holdout/blind checks affected the result.

#### F4. Determinism warning
If all runs produce identical outputs, the report should flag that as a trustworthiness warning rather than silently treating it as ideal.

### Success criteria
- a skeptical reviewer can explain why the run passed
- a skeptical reviewer can also see what would have caused it to fail
- suspiciously uniform results are surfaced, not hidden

---

## 9. Recommended Implementation Order

### Phase 1
1. Remove seeded dimension scores as the primary scoring path
2. Add evidence provenance
3. Add determinism warning to reports

### Phase 2
4. Add prompt-family-sensitive sprint decomposition and weighting
5. Make holdout and blind signals affect final verdict

### Phase 3
6. Add controlled perturbation
7. Add refine/pivot impact summaries
8. Re-run the proof suite across the full prompt matrix

---

## 10. New Pass Criteria for the Hardened Proof Suite

The hardened suite should only be considered fully persuasive if:

- scores are primarily artifact-derived
- prompt families produce different plans and score profiles
- blind/holdout checks can materially affect final verdicts
- repeated success remains strong across multiple runs
- score variance is low but not suspiciously zero
- the final report explains evidence provenance and strategy decisions clearly

---

## 11. Final Recommendation

Do not treat the current proof-suite STABLE-PASS result as final parity proof.

Treat it as:

- strong confirmation that Astra's harness is real and stable, and
- clear evidence that the next bottleneck is benchmark trustworthiness, not missing infrastructure.

The shortest path to a much stronger claim is:

1. remove template-driven scoring,
2. make prompts materially affect the run,
3. make blind/holdout checks consequential,
4. re-run the full suite.

If the hardened proof suite still passes after that, Astra's Anthropic-style parity claim becomes much harder to dispute.
