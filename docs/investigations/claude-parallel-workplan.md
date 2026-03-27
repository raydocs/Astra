# Claude Task Pack — Astra App Completion Campaign

_Last updated: 2026-03-26_

> This document is written to be sent directly to Claude as a tasking brief.
> It assumes another agent (GPT-5.4 / integration owner) is handling final integration and core bus wiring.

---

## 0. Mission

You are helping complete Astra from a **strong bounded harness** into a **near-complete app + long-running harness platform**.

Your role is **not** to be the primary integrator.
Your role is to be the **coverage / acceptance / audit / docs owner** and, where useful, to implement bounded, non-conflicting work.

You should optimize for:

1. finding what is still missing,
2. making requirements explicit,
3. creating concrete acceptance criteria,
4. reducing integration risk,
5. and only then implementing scoped changes that do not collide with core integration work.

---

## 1. Current repo reality

Astra is **not** just a roadmap anymore.
In the current working tree it already has:

- split-aware bench judge
- experiment/champion/store artifacts
- optional worktree materialization
- structured edit apply
- bounded verification + keep/reject
- bounded planner / generator / evaluator orchestration
- session / checkpoint / compaction / handoff / resume scaffolding
- real browser-backed live evaluation for page-translation
- promotion / publish / rollback planning
- operator-facing status artifacts

However, it is **not yet a full Anthropic-style long-running harness** because it still lacks:

- broader live evaluator coverage across the app
- true autonomous runtime quality in planner/generator/evaluator
- real promotion / PR / publish / rollback execution
- first-class tool / graph mutation targets
- strong safety / anti-overfitting / telemetry layers

Your job is to help close those gaps from the **spec / coverage / audit / release-readiness** side.

---

## 2. Collaboration model

### Integration owner
Another agent is the **single integration owner**.
That agent owns:

- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/types.ts`
- `bench-live/index.ts`
- `bench/entry.ts`
- `package.json`

Do **not** take ownership of those files unless explicitly asked.

### Your role
You own:

- coverage mapping
- acceptance matrix
- edge-case discovery
- release readiness audit
- roadmap/docs synchronization
- scoped implementations that do not require owning core bus files

### Critical rule
If a change requires touching the core integration files above, do **not** implement it directly first.
Instead:

1. specify the desired interface/behavior clearly,
2. identify the exact integration points,
3. hand off the wiring work to the integration owner.

---

## 3. What you should work on

You have **three primary workstreams**.
Do them in order unless blocked.

---

# Workstream A — Live Coverage Matrix and Scenario Plan

## Goal
Produce the authoritative live-evaluation coverage plan for Astra.

The current live harness is real but narrow.
It already includes page-translation and browser smoke paths.
We need a complete view of what still needs live coverage to call the app “done enough.”

## Your outputs
Create a markdown report covering:

1. **all major product surfaces**
2. current deterministic bench coverage
3. current live coverage
4. current CI coverage (if relevant)
5. what is missing
6. the minimum live scenario needed per surface
7. the stronger follow-up live scenario needed per surface
8. required artifacts per scenario
9. pass/fail rubric ideas
10. execution priority

## Surfaces to evaluate
At minimum include:

- `page-translation`
- `interaction-priority`
- `frame-coordination`
- `dynamic-content`
- `article-extraction`
- `hover`
- `selection-explain`
- `input-translation`
- `subtitle`
- `site-automation`

## What to inspect
Start from these areas:

- `docs/bench-harness.md`
- `docs/bench-opt.md`
- `docs/anthropic-style-long-running-harness-roadmap.md`
- `bench/scenarios/`
- `bench/evaluators/`
- `bench-live/scenarios/`
- `bench-live/driver.ts`
- `bench-live/source-runtime.ts`
- `bench-live/index.ts`
- `src/entrypoints/content/`
- `src/utils/dom/`

## Required structure for your report
Use this format:

```md
# Astra Live Coverage Matrix

## Summary
...

## Surface Inventory

### <surface-name>
- Deterministic bench coverage: yes/no
- Live coverage: none / smoke / partial / strong
- CI protection: yes/no/partial
- Current gaps:
  - ...
- Minimal live scenario:
  - user goal
  - trigger
  - expected outcome
  - artifacts
  - pass/fail criteria
- Stronger follow-up scenario:
  - ...
- Priority: P0 / P1 / P2
- Notes:
  - ...
```

## Important constraints
Do not just say “needs more live coverage.”
For each missing scenario, specify:

- what the browser/runtime must do,
- what DOM/state we need to inspect,
- what artifacts must be saved,
- and what exact failure modes the scenario should catch.

## Definition of done for this workstream
Done means:

- every major surface has a coverage classification,
- every missing live scenario has a concrete minimal spec,
- priorities are explicit,
- and another implementation agent could build from your document without guessing.

---

# Workstream B — App Completion Audit

## Goal
Produce a realistic “what still blocks calling the whole app complete?” audit.

We do **not** want a generic audit.
We want a **feature × validation-layer matrix** that distinguishes between:

- feature exists in code,
- feature is bench-covered,
- feature is live-covered,
- feature is CI-protected,
- feature is promotion-safe,
- feature is operator-visible.

## Your outputs
Create a markdown report that answers:

1. Which user-visible features are actually complete?
2. Which are only partially validated?
3. Which are likely fragile or under-tested?
4. Which lack live/runtime verification?
5. Which lack release/promotion safety?
6. What are the top blockers to claiming “app complete”?

## What to inspect
At minimum inspect:

- `src/entrypoints/content/`
- `src/entrypoints/background/`
- `src/entrypoints/subtitle-reader/`
- `src/entrypoints/popup/`
- `src/utils/`
- `bench/scenarios/`
- `bench/evaluators/`
- `bench-live/scenarios/`
- `.github/workflows/ci.yml`
- `docs/bench-harness.md`
- `docs/bench-opt.md`

## Required structure
Use this format:

```md
# Astra App Completion Audit

## Summary
...

## Validation Matrix

| Feature | Code Exists | Bench | Live | CI | Promotion-safe | Operator-visible | Status |
|---|---|---|---|---|---|---|---|

## Major Findings
- ...

## Top Blockers
1. ...
2. ...
3. ...

## Recommended Next Actions
- ...
```

If you prefer, you may also produce the matrix as bullet lists instead of a table, but the structure must be equally explicit.

## Important distinction
We care about **completion**, not just implementation.
A feature that exists in code but lacks live/runtime validation should **not** be marked complete.

## Definition of done for this workstream
Done means:

- the app’s major user-facing capabilities are enumerated,
- each has a validation status,
- top blockers are ranked,
- and the report can guide engineering sequencing.

---

# Workstream C — Roadmap / Docs / Release-Readiness Refresh

## Goal
Update the docs so they reflect the actual codebase and remaining gaps.

The current roadmap is directionally useful but stale.
Your job is to make it trustworthy again.

## Your outputs
Produce:

1. an updated roadmap status pass,
2. a release-readiness checklist,
3. a concise operator runbook or status-reading guide if missing.

## Priority doc targets
At minimum inspect and update recommendations for:

- `docs/anthropic-style-long-running-harness-roadmap.md`
- `docs/bench-opt.md`
- `docs/bench-harness.md`

If you are asked to implement docs changes directly, those are safe files for you to edit.

## Specific tasks

### C1. Roadmap reality check
For each roadmap phase, classify:

- complete
- partial
- missing

And explain why in terms of actual code/artifacts.

### C2. Checklist reality check
For the practical DoD checklist, classify:

- complete
- partial
- missing

### C3. Release readiness checklist
Create a new document if needed, e.g.:

- `docs/release-readiness-checklist.md`

It should include gates like:

- deterministic bench health
- live scenario health
- keep/reject safety
- promotion gate readiness
- rollback readiness
- docs sync
- operator status clarity

### C4. Operator runbook
Create a short document if missing, e.g.:

- `docs/bench-opt-operator-runbook.md`

It should explain:

- what artifacts exist,
- which ones matter,
- how to interpret blocked/qualified/promoted,
- how to resume latest session,
- and how to understand live/verification/promotion status.

## Definition of done for this workstream
Done means:

- roadmap is no longer misleading,
- release-readiness is explicit,
- and a teammate can understand system state without tribal knowledge.

---

## 4. Secondary implementation work you may do

You may also implement **scoped non-core changes** if they do not require ownership of integration bus files.

Examples of safe implementation work:

- adding new markdown docs
- adding new live scenario spec docs
- adding new coverage/audit docs
- adding isolated scenario files under `bench-live/scenarios/` if the interface is already established
- adding isolated rubric/helper files if they do not require broad runner rewiring

Examples of work to avoid unless explicitly requested:

- broad `runner.ts` changes
- changing global optimizer schemas without alignment
- changing central types used across many subsystems
- silently redefining promotion semantics

---

## 5. What “good” looks like

A strong contribution from you should do at least one of these:

1. **eliminate ambiguity** for another implementation agent,
2. **identify a missing user-critical scenario**,
3. **turn vague concerns into explicit acceptance criteria**,
4. **surface hidden blockers** before implementation goes down the wrong path,
5. **make release/readiness state legible**.

Weak output would be:

- generic advice,
- repeating the roadmap,
- high-level summaries without concrete scenarios,
- “needs more testing” without saying what to test.

---

## 6. Required handoff format

For each workstream, hand back your work in this structure:

```md
# <Workstream Name>

## Summary
...

## Findings
- ...

## Evidence
- file/path
- file/path

## Decisions / Recommendations
1. ...
2. ...

## Ready-for-implementation tasks
- [ ] task name
  - files likely involved
  - expected output
  - acceptance criteria

## Risks / Open Questions
- ...
```

If you implement any files, also include:

```md
## Files changed
- path/to/file
- path/to/file
```

---

## 7. Suggested execution order

Please do your work in this order:

1. **Workstream A — Live Coverage Matrix**
2. **Workstream B — App Completion Audit**
3. **Workstream C — Roadmap / Docs / Release Readiness**
4. Optional scoped implementation only after the above are strong

Reason: the coverage/audit work should shape what the implementation agents build next.

---

## 8. Key non-goals

Do **not** spend time on these unless explicitly asked:

- polishing prompt wording in a vacuum
- speculative refactors in core runtime
- re-implementing central integration logic someone else owns
- broad style cleanup
- chasing “100% parity” language without concrete validation impact

---

## 9. Success criteria for your entire assignment

Your assignment is successful if, after your work:

- we know exactly which app surfaces still lack live/runtime validation,
- we know exactly which features are not truly complete,
- we know exactly which roadmap phases/checklist items are still partial vs complete,
- and the implementation team can execute the next engineering wave with minimal guessing.

---

## 10. Optional extra credit

If you finish early and want to help more, the most valuable extra contribution would be:

### Option 1 — Draft exact live scenario specs for implementation
For the top 3 missing surfaces, draft scenario specs that an implementation worker can directly turn into `bench-live/scenarios/*.ts` files.

### Option 2 — Draft a promotion safety checklist
Write the exact conditions under which promotion should be blocked even if a candidate looks good locally.

### Option 3 — Draft an operator-facing status legend
Explain every important field in `latest.status.json` in plain English.

---

## 11. Final note

Be concrete, skeptical, and helpful.
We do not need another inspirational roadmap.
We need documents and audits that make the next implementation wave safer, faster, and more complete.
