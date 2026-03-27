# Integration Owner Playbook — Astra App Completion Campaign

_Last updated: 2026-03-26_

> This document is for the single integration owner coordinating Claude + GPT workers.
> It is designed for a repo state where multiple parallel contributors are producing bounded slices.

---

## 0. Your role

You are the **single integration owner**.
That means you are responsible not just for code quality, but for whether the whole campaign converges cleanly.

You own:

- final task sequencing
- file ownership boundaries
- conflict prevention
- schema consistency
- shared bus wiring
- full-chain validation
- final go / no-go judgment

You are **not** primarily a worker for every subtask.
Your biggest job is keeping the system coherent while others move in parallel.

---

## 1. Core ownership

These files belong to you unless explicitly delegated for a tightly-scoped edit:

- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/types.ts`
- `bench-live/index.ts`
- `bench/entry.ts`
- `package.json`
- any other file that becomes the central wiring layer between multiple new slices

Treat them as the **merge choke points**.

If multiple contributors touch them independently, the campaign slows down sharply.

---

## 2. Your operating principles

### Principle 1 — Parallelize modules, centralize wiring
Let workers create or improve isolated files.
You own the cross-cutting connections.

### Principle 2 — Prefer interface stability over local elegance
When several workers are moving, the most valuable thing is a stable handoff contract.
Do not casually redesign shared schemas mid-flight.

### Principle 3 — Integrate once per cycle, not constantly
Avoid interrupt-driven integration.
Use deliberate integration windows.

### Principle 4 — Acceptance criteria beat intuition
A task is not “done” because it looks plausible.
It is done when the intended command / artifact / status transition works.

### Principle 5 — Protect morale and momentum
When a worker hands back something imperfect but structurally useful, absorb the integration burden yourself when reasonable.
Don’t bounce everything back unless the contract is unusable.

---

## 3. Campaign structure

There are three major collaborator streams:

### Stream A — Claude
Claude should focus on:

- live coverage matrix
- app completion audit
- roadmap/docs refresh
- release readiness
- edge-case discovery
- acceptance criteria

### Stream B — GPT workers
GPT workers should focus on:

- promotion execution
- safety/telemetry
- tool/graph mutation
- live scenario implementations

### Stream C — You
You focus on:

- coordinating the backlog
- resolving ownership conflicts
- integrating into runner/types/status/config
- validating the end-to-end platform

---

## 4. Daily operating loop

Use this loop every work cycle.

---

### Step 1 — Re-state file ownership
At the start of each cycle, confirm:

- which files are owner-only,
- which workers are allowed to write where,
- and which tasks must stay disjoint.

If boundaries are fuzzy, clarify them before work continues.

---

### Step 2 — Review inbound specs before inbound code
Before integrating worker code, read:

- Claude’s latest coverage / acceptance documents
- each worker’s handoff notes

This prevents you from wiring something that technically works but misses the actual objective.

---

### Step 3 — Integrate additive slices first
Suggested integration order:

1. new standalone modules
2. new config directories / schemas
3. new scenario files
4. new workflow files
5. shared schema updates
6. runner wiring
7. status/reporting wiring

This order minimizes conflict and clarifies what the shared bus must consume.

---

### Step 4 — Run acceptance checks after each integration batch
Do not wait until the very end.
After each meaningful integration wave, run the smallest sufficient acceptance set.

---

### Step 5 — Publish a state summary
At the end of each cycle, write a short summary:

- integrated today
- still blocked
- top risks
- next integration batch

This keeps parallel contributors aligned.

---

## 5. Recommended integration sequence for Astra

Follow this order unless there is a strong reason not to.

---

### Wave 1 — Safety / telemetry foundation
Integrate first:

- `bench-opt/guardrails.ts`
- `bench-opt/red-flags.ts`
- `bench-opt/telemetry.ts`
- `bench-opt/logs.ts`

Why first:
- low conflict
- mostly additive
- gives later promotion/status work a better target model

Likely owner touchpoints:
- `bench-opt/types.ts`
- `bench-opt/runner.ts`
- `bench-opt/status.ts`

---

### Wave 2 — Tool / graph mutation skeleton
Integrate next:

- `agent-config/`
- mutate-prompts/context/tools/graph
- config shape resolution

Why second:
- additive
- less likely to break current core path
- sets up the next generation of optimizer work

Likely owner touchpoints:
- `bench-opt/types.ts`
- `bench/optimizer-config.ts`
- `bench-opt/runner.ts`

---

### Wave 3 — Promotion / delivery execution
Integrate after safety exists.

Why:
- promotion semantics should ideally consume safety/guardrail concepts,
- and status artifacts should already have room for richer gate state.

Likely owner touchpoints:
- `bench-opt/runner.ts`
- `bench-opt/status.ts`
- `package.json`

---

### Wave 4 — Live scenario expansion
Integrate after Claude’s live coverage matrix is available.

Why:
- otherwise implementation may go wide in the wrong places,
- scenario priority should be evidence-driven.

Likely owner touchpoints:
- `bench-live/scenarios/index.ts`
- `bench-live/index.ts`
- `bench-opt/runner.ts`
- `bench-opt/status.ts`

---

## 6. Acceptance commands you should own

You should be the one who runs the full or near-full verification stack.

Use this command ladder.

### Core baseline
```bash
pnpm type-check
pnpm test
pnpm bench
```

### Live layer
```bash
pnpm bench:live -- --list
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
```

As new scenarios are integrated, add their explicit scenario ids here.

### Optimizer baseline
```bash
pnpm bench:opt
pnpm bench:opt:status
```

### Execution / verification path
```bash
pnpm bench:opt -- --verify --materialize
pnpm bench:opt -- --verify --materialize --apply-edits
```

### Live-aware optimizer path
```bash
pnpm bench:opt -- --live
pnpm bench:opt -- --live --promotion-plan
```

### Orchestration / session path
```bash
pnpm bench:opt -- --orchestrate --session
pnpm bench:opt:resume-latest
pnpm bench:opt:autoloop
```

### Promotion path
Once execution exists, add real promotion tests or drills for:

- branch creation
- PR creation
- rollback preparation/execution

---

## 7. What to validate after each wave

---

### After Wave 1 (Safety / telemetry)
Validate:

- structured safety outputs exist
- status artifact can represent them
- promotion can eventually consume them

Questions to answer:
- Can we tell why a candidate is unsafe?
- Can we tell why it is blocked?
- Can operator artifacts explain that clearly?

---

### After Wave 2 (Tool / graph mutation)
Validate:

- config directories exist
- mutation modules are structurally sound
- resolved config can eventually represent these new targets

Questions:
- Is there a clear candidate shape?
- Is lineage still possible?
- Can runtime eventually distinguish tool vs graph policy?

---

### After Wave 3 (Promotion execution)
Validate:

- promotion state is more than prose
- publish/rollback represent executable steps
- workflow file exists and makes sense

Questions:
- Does promotion still block for the right reasons?
- Is “qualified” distinct from “promoted”?
- Can rollback be reasoned about operationally?

---

### After Wave 4 (Live expansion)
Validate:

- new scenarios are stable
- artifacts are useful
- failure modes are meaningful
- runner/status can consume results

Questions:
- Do we now cover the highest-risk user paths?
- Are we catching real regressions rather than merely generating screenshots?

---

## 8. Required state reporting format

At the end of each integration cycle, publish a short state report using this structure:

```md
# Astra Integration Status — <date/time>

## Integrated this cycle
- ...

## Still blocked
- ...

## Newly introduced risks
- ...

## Acceptance results
- `pnpm type-check`: pass/fail
- `pnpm test`: pass/fail
- `pnpm bench`: pass/fail
- `pnpm bench:opt`: pass/fail
- ...

## Next wave
- ...
```

This is useful both for humans and for handing the campaign back off later.

---

## 9. How to use Claude effectively

Claude is most valuable when you use it for:

- coverage mapping
- finding blind spots
- writing explicit acceptance criteria
- spotting “looks done but isn’t done” failures
- syncing docs to reality

Do **not** waste Claude on work that is mainly:

- shared bus refactoring
- low-level glue code
- repeated mechanical edits across central files

Use Claude’s outputs to shape implementation priorities, not as an afterthought.

---

## 10. How to use GPT workers effectively

GPT workers are best for:

- bounded implementation slices
- new isolated files
- structured artifact logic
- workflow scaffolding
- concrete scenario additions

Do not let them all touch the same central wiring files.
Their best value comes from **parallel additive work**.

---

## 11. Common failure modes to prevent

### Failure mode A — Two workers both “just make a small change” to `runner.ts`
Prevention:
- owner-only policy
- workers must hand off integration notes instead

### Failure mode B — Docs and implementation drift again
Prevention:
- integrate Claude’s docs refresh as a formal wave
- require updated status docs before calling the campaign done

### Failure mode C — New scenarios exist but do not affect release confidence
Prevention:
- insist every scenario has pass/fail semantics, not just artifacts
- link scenarios back to concrete user flows

### Failure mode D — Promotion gains machinery but not trustworthiness
Prevention:
- integrate safety/guardrails before trusting promotion execution
- make blocked reasons explicit and inspectable

### Failure mode E — We confuse “working in local tree” with “ready to ship”
Prevention:
- always separate:
  - exists in working tree
  - integrated into shared bus
  - passes acceptance commands
  - safe for release

---

## 12. Final campaign-level definition of done

Do not call the campaign complete until all four layers are true.

### Layer A — App validation completeness
- major surfaces are covered by deterministic bench
- major risky surfaces have live coverage or justified exceptions

### Layer B — Harness completeness
- verification, keep/reject, session, orchestration, status are coherent
- mutation targets are broader than prompt/context only

### Layer C — Delivery completeness
- promotion/publish/rollback are operationally meaningful
- release gates are explicit

### Layer D — Team-operability completeness
- roadmap/docs are current
- release readiness is documented
- operator can understand system state without tribal knowledge

---

## 13. Your checklist before declaring victory

Use this checklist personally:

- [ ] All worker handoffs reviewed
- [ ] Claude coverage/audit docs reviewed
- [ ] No uncontrolled edits in owner-only files
- [ ] Shared schema changes reconciled
- [ ] Full acceptance ladder run
- [ ] Status/docs updated
- [ ] Remaining gaps written down explicitly
- [ ] Release confidence justified, not assumed

---

## 14. Final note

Your biggest job is not just to integrate code.
It is to keep the whole effort legible, safe, and convergent.

If a worker produces something 80% right but structurally compatible, you should often absorb the last 20% yourself.
If a worker produces something elegant that destabilizes shared wiring, reject it kindly and preserve the campaign.

Protect momentum, protect clarity, and keep the bus coherent.
