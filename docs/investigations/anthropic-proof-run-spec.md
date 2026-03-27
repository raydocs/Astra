# Anthropic-Style Proof Run Spec

Date: March 26, 2026
Purpose: Define the shortest credible benchmark that would let Astra make a much stronger parity claim against Anthropic's long-running harness article.

## Goal

Prove that Astra is not only a strong harness for improving an existing application, but can also execute an **Anthropic-style end-to-end long-running benchmark** with:

- a short product prompt
- planner-driven expansion into sprint objectives
- sprint-contract negotiation
- generator execution across multiple sprints
- composite evaluator scoring
- live/browser-backed verification where relevant
- release-style artifacts and final verdicting

This spec is intentionally designed as a **proof benchmark**, not as a production release workflow.

---

## 1. Success Claim This Benchmark Should Support

If this run succeeds, Astra should be able to credibly say:

> Given a short product prompt, Astra can decompose the work into multiple autonomous sprints, negotiate done conditions, execute changes, evaluate each sprint across multiple dimensions, validate relevant behaviors in a real runtime, and produce a final benchmark verdict with release-style artifacts.

That is the missing proof point between current Astra and a stronger Anthropic-style parity claim.

---

## 2. Proof Run Requirements

The run must satisfy all of the following.

### 2.1 Input must be a short product prompt
The benchmark should start from a product brief of roughly 1-4 sentences.

Examples:

- "Build a small browser extension that summarizes the current article and lets users save highlights with tags."
- "Build a lightweight reading assistant that shows translations, remembers learned terms, and offers a compact review panel."

The prompt must be short enough that the harness has to perform real planning work.

### 2.2 Planner must expand the prompt into sprint-scoped objectives
The planner must produce more than a single todo list. It must produce:

- objective expansion
- sprint decomposition
- bounded scope per sprint
- evaluation rubric inputs
- sprint contract proposal

### 2.3 Sprint contract negotiation must occur per sprint
For each sprint, there must be an explicit artifact or log showing:

- proposed dimensions
- thresholds
- required dimensions
- generator acknowledgement or counterproposal
- final negotiated contract

### 2.4 Generator must execute multiple real sprints
Minimum bar:

- 3 sprints

Stronger benchmark:

- 4-5 sprints

Each sprint should result in:

- code changes or explicit generated artifacts
- evaluator review
- sprint-level verdict
- carry-forward state for the next sprint

### 2.5 Evaluator must score more than correctness
The evaluator must use composite scoring dimensions, at minimum:

- functionality
- product depth
- UX/design quality
- code quality
- maintainability

Each dimension must have:

- score
- threshold
- pass/fail
- evidence
- critique

### 2.6 Real runtime validation must be included where relevant
The proof run should include live/browser-backed validation for user-facing flows where possible.

Minimum acceptable:

- at least one live/browser-backed validation per benchmark run

Preferred:

- at least one per relevant sprint or final integrated pass

### 2.7 Final artifacts must resemble a real harness output
The proof run must produce:

- planner artifacts
- generator artifacts
- evaluator artifacts
- sprint contracts / negotiation records
- composite scorecards
- long-run report
- status summary
- promotion-style gate reasoning
- rollback-style readiness or non-applicability reasoning

---

## 3. Suggested Benchmark Shape

## 3.1 Recommended benchmark target
Use a **small but real app-shaped task**, not a trivial toy and not a huge product.

Recommended properties:

- enough UI to exercise product depth and UX
- enough logic to exercise code quality and maintainability
- enough workflow complexity to require multiple sprints
- small enough to finish in one proof-run campaign

### Good target categories
- mini browser extension
- compact single-page web app
- focused internal tool UI
- reading / summarization / annotation micro-app

### Avoid for the first proof run
- giant full-stack systems
- infra-heavy apps
- tasks that depend mostly on external services
- benchmarks with no visible UI or user flow

---

## 4. Minimum Sprint Plan

### Sprint 1 — Architecture and product skeleton
Expected outcomes:

- app structure exists
- core modules and interfaces defined
- primary user flow outlined
- sprint contract created and negotiated
- composite evaluation performed

### Sprint 2 — Main happy-path implementation
Expected outcomes:

- primary feature works end to end
- evaluator verifies functionality and product depth
- first live/browser-backed check executed if relevant

### Sprint 3 — Edge cases and user-facing polish
Expected outcomes:

- important edge cases handled
- error states and loading states improved
- evaluator scores UX/design and maintainability more meaningfully

### Optional Sprint 4 — Testing/docs/release prep
Expected outcomes:

- tests strengthened
- docs or benchmark notes improved
- final integrated live validation
- final long-run report produced

---

## 5. Pass Criteria

The proof run should only be considered a real parity signal if all of the following are true.

### 5.1 Structural pass criteria
- at least 3 sprints completed
- sprint contracts recorded for each sprint
- composite evaluator used in each sprint
- final long-run report generated

### 5.2 Quality pass criteria
- final weighted score meets threshold
- required dimensions pass in final sprint
- no critical guardrail failures
- live/browser validation passes where expected

### 5.3 Credibility pass criteria
- run starts from a short prompt
- sprint objectives are meaningfully richer than the original prompt
- output is app-shaped, not a stub
- result is understandable by an operator reading the artifacts

### 5.4 Failure criteria
The benchmark should be marked **not sufficient for parity proof** if any of these occur:

- no real sprint negotiation occurs
- composite evaluator is bypassed
- live validation is absent where the product requires it
- the run depends on hand-authored sprint objectives rather than planner expansion from the prompt
- the final output is mostly placeholder code or thin scaffolding

---

## 6. Recommended Artifacts

The proof run should write or preserve these artifacts.

### Per sprint
- planner artifact
- generator artifact
- evaluator artifact
- sprint contract
- negotiation record
- composite score card
- notes / handoff / status excerpt

### Whole run
- long-run benchmark config
- long-run benchmark result JSON
- markdown report
- live validation artifacts
- final summary with pass/fail reasoning

---

## 7. Suggested Commands / Entry Points

These may evolve, but the proof run should converge toward a stable command path.

### Minimum target
A command or script that clearly means:

- run a long-run benchmark from a short prompt
- emit sprint and final artifacts
- optionally execute live verification

Example target shape:

```bash
pnpm bench:opt -- --long-run --prompt "Build a lightweight reading assistant with article summary, saved highlights, and tagged notes"
```

If the current implementation requires a different path, the proof-run wrapper should normalize that and make it easy to repeat.

---

## 8. Evaluation Rubric for the Proof Run Itself

The proof run should be reviewed along these axes.

### A. Planning quality
- Did the planner materially enrich the original prompt?
- Did the sprint decomposition feel sensible and progressive?

### B. Negotiation quality
- Were sprint contracts real and consequential?
- Did generator acknowledgement/counterproposal affect the final contract?

### C. Execution quality
- Did each sprint produce meaningful incremental progress?
- Did later sprints build on earlier ones coherently?

### D. Evaluator quality
- Were multi-dimension scores justified with evidence?
- Did failures and critiques make sense?

### E. Runtime validation quality
- Did live/browser checks meaningfully validate user-facing behavior?
- Were failures diagnosable from artifacts?

### F. Operator trustworthiness
- Could an operator understand why the run passed or failed?
- Were status, scorecards, and artifacts coherent?

---

## 9. What Would Count as a Strong Result

A strong proof-run result would look like this:

- 4 sprints complete
- final verdict: pass
- composite score above threshold
- required dimensions pass
- at least one real live/browser validation passes
- artifacts clearly show planner expansion, negotiation, execution, and evaluation
- operator can explain the result from the output alone

That would materially strengthen any claim that Astra has reached Anthropic-style parity beyond just harness architecture.

---

## 10. What Would Count as "Not There Yet"

Even if the run technically completes, the proof is still weak if:

- sprint objectives are mostly hard-coded templates with little prompt expansion value
- composite scores are simulated without meaningful evaluator evidence
- live validation is absent or superficial
- the result is mostly scaffolding rather than a usable app flow
- the report is too opaque for operator trust

---

## 11. Recommendation

Treat this proof run as the **next decisive benchmark** for Astra.

Current Astra already demonstrates strong harness maturity. The shortest path from "very strong harness" to "credible Anthropic-style parity claim" is not more infrastructure work — it is a benchmark that proves all the major pieces work together under an open-ended, from-prompt, multi-sprint workload.

## Final Recommendation

Run one deliberately designed proof benchmark before claiming full parity.

If it passes, Astra can move from:

- "near Anthropic parity at the harness level"

to:

- "credible Anthropic-style end-to-end parity claim, backed by an actual proof run"
