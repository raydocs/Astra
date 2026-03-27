# GPT-5.4 Subagents Task Pack — Astra App Completion Campaign

_Last updated: 2026-03-26_

> This document is written to be sent directly to GPT-5.4 subagents / worker agents.
> It assumes there is a separate **integration owner** who controls final wiring, conflict resolution, and acceptance.

---

## 0. Mission

You are part of the implementation wave that pushes Astra from a strong bounded harness into a near-complete app + long-running harness platform.

Your job is **not** to own everything.
Your job is to complete a **bounded, clearly-scoped engineering slice** with minimal ambiguity and minimal merge conflict risk.

You should optimize for:

1. finishing a concrete implementation slice,
2. keeping file ownership clean,
3. making your output easy to integrate,
4. preserving testability and artifact quality,
5. and avoiding accidental rewrites of shared bus files.

---

## 1. Global rules for all subagents

### Rule 1 — Respect file ownership
The integration owner exclusively owns these files unless your task explicitly says otherwise:

- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/types.ts`
- `bench-live/index.ts`
- `bench/entry.ts`
- `package.json`

Do **not** edit those files opportunistically.
If you discover they must change, document the exact integration change needed and hand it back.

### Rule 2 — Stay within your write set
Do not expand your task into adjacent systems just because you can.
Implement your slice cleanly and stop.

### Rule 3 — Always return integration notes
At the end of your task, include:

- files changed
- files you intentionally did **not** change
- exact integration points the owner must wire up
- acceptance commands
- any risks / follow-up items

### Rule 4 — Prefer additive over destructive changes
If possible:

- create new files,
- add isolated helpers,
- add isolated scenario modules,
- add isolated configs,

instead of rewriting central shared files.

### Rule 5 — Make artifacts first-class
If your feature affects execution, verification, live evaluation, promotion, or status, preserve structured artifact output.
Do not hide important state in prose only.

---

## 2. Work allocation

There are **4 worker tracks**.
Each should be assigned to a different subagent or worker thread.

---

# Worker G1 — Promotion / Delivery Execution

## Goal
Convert promotion/publish/rollback from dry-run planning into executable delivery machinery.

## Current state
Astra already has:

- `bench-opt/promote.ts`
- `bench-opt/publish.ts`
- `bench-opt/rollback.ts`

These currently produce:

- promotion decisions,
- publish plans,
- rollback plans,

but are still planning-oriented / dry-run.

## Your mission
Implement the execution-side primitives needed so the integration owner can wire real delivery behavior.

## Primary files you may edit
- `bench-opt/promote.ts`
- `bench-opt/publish.ts`
- `bench-opt/rollback.ts`
- `.github/workflows/bench-opt.yml` (new)
- helper files you add under `bench-opt/` or `.github/workflows/`

## Files you must not edit without explicit approval
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `package.json`

## Desired end state
The code should support, at minimum, a real path for:

1. deriving branch execution details,
2. preparing commit execution details,
3. preparing PR creation details,
4. representing required checks / gate wait states,
5. representing rollback execution details,
6. and doing so in a way that the integration owner can wire into the runner.

## Suggested implementation slices

### G1-A — Promotion execution model
Add structured execution metadata for:

- branch creation action
- commit action
- PR action
- required checks wait state
- publish action

This can remain “execution-capable” rather than immediately auto-executing.
The important thing is that the artifact model is no longer only prose.

### G1-B — Workflow skeleton
Create `.github/workflows/bench-opt.yml` with a sensible skeleton for:

- install
- type-check
- test
- bench
- optional bench-opt verification hooks
- surfaced outputs useful to promotion gates

### G1-C — Rollback execution model
Add structured rollback execution artifacts for:

- revert branch / commit plan
- PR close/update plan
- canary disable plan
- recovery summary plan

Again: execution-ready modeling is good enough if true runtime wiring belongs to the integration owner.

## Acceptance criteria
Your work is successful if:

- publish/rollback are no longer only vague dry-run prose,
- there is a real workflow file for bench-opt,
- execution details are represented structurally,
- integration owner can wire them in without redesigning your work.

## Required handoff format

```md
# Worker G1 Handoff

## Summary
...

## Files changed
- ...

## Integration points for owner
- `bench-opt/runner.ts`: ...
- `bench-opt/status.ts`: ...

## Acceptance commands
- ...

## Risks / follow-ups
- ...
```

---

# Worker G2 — Safety / Anti-overfitting / Telemetry

## Goal
Add the missing safety and observability layer that prevents the optimizer from “winning” in unsafe or misleading ways.

## Current state
Split discipline exists, keep/reject exists, and status artifacts exist.
But the repo is still missing dedicated guardrails / red-flags / telemetry modules.

## Your mission
Implement the first real version of:

- `guardrails.ts`
- `red-flags.ts`
- `telemetry.ts`
- `logs.ts`
- `dashboard.md`

## Primary files you may edit
- `bench-opt/guardrails.ts` (new)
- `bench-opt/red-flags.ts` (new)
- `bench-opt/telemetry.ts` (new)
- `bench-opt/logs.ts` (new)
- `bench-opt/dashboard.md` (new)
- isolated helper files under `bench-opt/`

## Files you must not edit without approval
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench-opt/status.ts` (you may recommend changes, but let owner wire them unless trivial)

## Desired safety signals
At minimum, model these concepts:

### Guardrails
- train improves but validation/holdout do not
- cost rises without score gain
- unstable or oscillating outcomes across iterations
- scope creep beyond expected write scope
- live pass but deterministic bench regression

### Red flags
- promotion should be blocked
- candidate should be demoted
- candidate should be annotated with warning state

### Telemetry
- per iteration cost
- latency
- split scores
- live summary
- keep/reject decision
- promotion state
- regression streak / plateau streak if possible

## Important design principle
Do **not** tightly couple everything to the current runner implementation.
Build reusable structured logic that the integration owner can call from the runner/status layer.

## Acceptance criteria
Your work is successful if:

- the repo gains dedicated structured safety modules,
- the concepts above are represented concretely,
- an integration owner could wire them into promotion/status without redesign,
- and the resulting model is more than free-form strings.

## Required handoff format

```md
# Worker G2 Handoff

## Summary
...

## Files changed
- ...

## Proposed integration points for owner
- `bench-opt/runner.ts`: ...
- `bench-opt/status.ts`: ...

## Acceptance notes
- ...

## Risks / follow-ups
- ...
```

---

# Worker G3 — Tool / Graph Mutation Targets

## Goal
Upgrade Astra from a prompt/context optimizer into a broader system optimizer that can also mutate tool policies and graph policies.

## Current state
The repo already has prompt/context candidates, but it does not yet have:

- `agent-config/` candidate directories,
- first-class tool policy candidates,
- first-class graph policy candidates,
- mutate-tools,
- mutate-graph.

## Your mission
Implement the candidate/config skeleton and mutation scaffolding for:

- prompts
- context policies
- tool policies
- graphs

## Primary files you may edit
- `agent-config/prompts/` (new)
- `agent-config/context-policies/` (new)
- `agent-config/tool-policies/` (new)
- `agent-config/graphs/` (new)
- `bench-opt/mutate-prompts.ts` (new)
- `bench-opt/mutate-context.ts` (new)
- `bench-opt/mutate-tools.ts` (new)
- `bench-opt/mutate-graph.ts` (new)
- helper files under `bench-opt/`

## Files you must not edit without approval
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/optimizer-config.ts`

## Design expectations
Your output should make it easy for the integration owner to later wire these into runner/config resolution.
That means:

- file-based config shapes should be explicit,
- mutation operators should be represented structurally,
- tool policy and graph policy should be distinguishable from prompt/context,
- and candidate lineage should remain possible.

## Suggested schema targets

### Tool policy ideas
- read-before-edit
- verify-after-write
- shell usage mode
- expand-scope rule
- re-read-on-failure rule

### Graph policy ideas
- planner-only
- planner+generator
- planner+generator+evaluator
- reviewer/verifier/promoter optional nodes
- compaction strategy
- reset / handoff strategy

## Acceptance criteria
Your work is successful if:

- the repo gains a clear `agent-config/` structure,
- mutate-tools and mutate-graph exist,
- config shapes are concrete enough for downstream consumption,
- and the integration owner can wire them into runtime later without rethinking the schema.

## Required handoff format

```md
# Worker G3 Handoff

## Summary
...

## Files changed
- ...

## Config shapes introduced
- ...

## Integration points for owner
- `bench-opt/runner.ts`: ...
- `bench/optimizer-config.ts`: ...

## Risks / follow-ups
- ...
```

---

# Worker G4 — Live Scenario Implementation

## Goal
Implement missing `bench-live` scenarios based on the coverage plan, without taking over the live integration bus.

## Current state
Astra already has:

- real Playwright/browser support
- source-backed page-translation scenarios
- fixture smoke
- result persistence

What it still lacks is broader live coverage across core app surfaces.

## Your mission
Implement new scenario files for the top missing live surfaces.
Focus on isolated scenarios, not broad architectural rewrites.

## Primary files you may edit
- `bench-live/scenarios/*.ts`
- `bench-live/scenarios/helpers/*.ts`
- `bench-live/driver.ts` (only if truly needed)
- `bench-live/evaluator.ts` (only for local scenario support, not broad redesign)

## Files you should avoid unless necessary
- `bench-live/index.ts`
- `bench-opt/runner.ts`
- `bench-opt/status.ts`

## Priority implementation order
Unless the coverage plan says otherwise, prioritize:

1. `interaction-priority`
2. `input-translation`
3. `subtitle`
4. `frame-coordination`
5. `hover / selection`
6. `site-automation`

## Scenario quality bar
For each new scenario, aim for:

- real trigger or interaction
- real pass/fail logic
- saved artifacts
  - screenshot
  - HTML snapshot or DOM evidence
  - structured result data
- minimal but credible rubric

## Important constraints
Do not try to solve all live runtime architecture in one task.
A scenario that is isolated, stable, and artifact-rich is better than a giant, fragile abstraction pass.

## Acceptance criteria
A scenario is successful if:

- it can run independently,
- it emits useful artifacts,
- it has meaningful pass/fail behavior,
- and the integration owner can register/wire it without rewriting your file.

## Required handoff format

```md
# Worker G4 Handoff

## Summary
...

## Files changed
- ...

## Scenarios added
- id: ...
  - purpose: ...
  - artifacts: ...
  - pass/fail basis: ...

## Integration points for owner
- `bench-live/scenarios/index.ts`: ...
- `bench-opt/runner.ts`: ...

## Acceptance commands
- ...

## Risks / follow-ups
- ...
```

---

## 3. Recommended order of operations

If all workers run in parallel, use this order conceptually:

1. **G2 Safety / telemetry**
2. **G3 Tool / graph mutation skeleton**
3. **G1 Promotion / delivery execution**
4. **G4 Live scenario implementation**

Reason:

- G2 and G3 are mostly additive and low-conflict.
- G1 is more likely to affect semantics that the integration owner needs to wire carefully.
- G4 should ideally consume the coverage plan and avoid duplicating design work.

---

## 4. Non-goals for subagents

Do **not** spend time on:

- broad refactors of the central runner
- changing every artifact schema in the repo
- polishing docs instead of building your slice
- speculative architecture rewrites
- performance work unless required for your bounded task

---

## 5. Final success condition

This task pack is successful if, after the workers finish:

- the repo has real new implementation slices in the missing areas,
- the integration owner can wire them together without major redesign,
- merge conflicts are minimal,
- and Astra moves materially closer to:
  - broader live validation,
  - executable promotion flow,
  - safer optimizer behavior,
  - and richer mutation targets.
