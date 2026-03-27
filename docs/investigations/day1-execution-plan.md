# Astra Day 1 Execution Plan

_Last updated: 2026-03-26_

> This document converts the current architecture review + Claude audit results into a concrete first-day execution plan.
> The goal is not to do everything on Day 1.
> The goal is to start the highest-leverage work **without creating merge chaos**.

---

## 0. What changed after Claude’s report

Claude’s report sharpened the campaign in three important ways:

1. **The app-side completion gap is even wider than the harness-side gap.**
   - 36 features enumerated
   - only 2 close to fully validated
   - 24 with near-zero meaningful coverage

2. **The single biggest leverage point is browser-level validation infrastructure.**
   - current bench is mostly JSDOM
   - live coverage is effectively only page-translation
   - 9 out of 10 major surfaces still have zero browser-backed live validation

3. **Release confidence is still blocked by two platform holes:**
   - promotion / rollback are still dry-run only
   - browser-backed live scenarios are not yet first-class in CI

This means Day 1 should **not** start with broad polish or random feature work.
It should start with:

- browser validation infrastructure,
- highest-priority live surfaces,
- safety/telemetry foundation,
- and promotion execution scaffolding.

---

## 1. Day 1 objective

By the end of Day 1, we want these outcomes:

### Minimum Day 1 wins
- ownership boundaries are stable
- first-wave workers are launched cleanly
- browser-validation direction is locked
- safety/telemetry modules are underway
- tool/graph mutation skeleton is underway
- promotion execution model is underway
- the first non-page-translation live scenarios are scoped or implemented
- no one has created merge conflict churn in shared bus files

### Explicit non-goals for Day 1
- not all live scenarios implemented
- not full delivery execution complete
- not final release readiness
- not every roadmap item green

Day 1 is about **setting the rails correctly**.

---

## 2. P0 reality from Claude’s report

These are now the confirmed top blockers:

### Blocker P0-1 — No browser-level CI
Current validation is still largely JSDOM-based.
This means we can improve the harness while still missing real runtime regressions.

### Blocker P0-2 — 9/10 major surfaces have no live coverage
Only page-translation has meaningful Playwright/browser-backed validation.
That is not enough to call the app “complete enough.”

### Blocker P0-3 — Promotion / rollback are still dry-run
Even if optimizer artifacts look strong, delivery is still operationally fake.

---

## 3. Day 1 role assignments

Use this role split exactly unless something is blocked.

---

### Integration Owner — Day 1 role
**Primary goal:** hold the bus together.

#### Must do today
1. Re-state owner-only files
2. Dispatch first-wave tasks
3. Refuse uncontrolled edits to:
   - `bench-opt/runner.ts`
   - `bench-opt/types.ts`
   - `bench/types.ts`
   - `bench-live/index.ts`
   - `bench/entry.ts`
   - `package.json`
4. Prepare first acceptance ladder
5. Review incoming worker contracts before integrating code

#### Should not do today
- broad rewiring before workers return
- speculative cleanup
- feature work that belongs to workers

---

### Claude — Day 1 role
**Primary goal:** turn coverage gaps into concrete implementation guidance.

#### Must do today
1. Finalize live coverage matrix
2. Finalize app completion audit
3. Produce/update release-readiness gate draft
4. Explicitly rank the first 3 non-page-translation live scenarios to build first

#### Deliverables expected by end of Day 1
- `astra-live-coverage-matrix.md`
- `astra-app-completion-audit.md`
- release-readiness draft and/or roadmap reality pass

#### Claude should not do today
- broad shared-bus integration
- silent edits to runner/types files

---

### Worker G1 — Day 1 role
**Primary goal:** promotion execution model + bench-opt workflow skeleton.

#### Must do today
1. upgrade `promote.ts` execution modeling
2. upgrade `publish.ts` execution modeling
3. upgrade `rollback.ts` execution modeling
4. create `.github/workflows/bench-opt.yml`

#### Good Day 1 output
- structured execution-ready publish/rollback artifacts
- workflow skeleton present
- clean integration notes for owner

---

### Worker G2 — Day 1 role
**Primary goal:** create safety / telemetry foundation.

#### Must do today
1. create `bench-opt/guardrails.ts`
2. create `bench-opt/red-flags.ts`
3. create `bench-opt/telemetry.ts`
4. create `bench-opt/logs.ts`
5. create `bench-opt/dashboard.md`

#### Good Day 1 output
- structured safety model exists
- structured telemetry model exists
- owner can wire them without redesign

---

### Worker G3 — Day 1 role
**Primary goal:** create tool / graph mutation skeleton.

#### Must do today
1. create `agent-config/` directory structure
2. create `mutate-tools.ts`
3. create `mutate-graph.ts`
4. if time permits, also create file-based prompt/context mutation skeletons

#### Good Day 1 output
- concrete config shapes exist
- mutation modules exist
- owner can wire them later

---

### Worker G4 — Day 1 role
**Primary goal:** start live implementation wave from highest-value surfaces.

#### Must do today
Pick **one** of these two strategies depending on Claude timing:

##### Strategy A — If Claude’s ranked scenario list is ready early
Implement the top 2 scenarios from Claude’s priority list.

##### Strategy B — If Claude is still drafting
Implement these default first-wave scenarios:
1. `interaction-priority`
2. `input-translation`

Subtitle can be the third target if bandwidth allows.

#### Good Day 1 output
- at least 1–2 new non-page-translation live scenario files
- each has artifacts + pass/fail semantics
- owner-only registration/wiring left untouched

---

## 4. Highest-leverage technical priority for Day 1

Claude identified the likely highest-leverage infrastructure point as a reusable browser helper analogous to:

- `withExtensionBrowserPage()`

That means we should explicitly treat **browser-backed scenario infrastructure** as a first-class Day 1 concern.

### Implication
If G4 discovers that multiple scenarios need a shared browser helper for extension/runtime setup, it is acceptable to add a **small, reusable helper** under `bench-live/` **as long as it does not force central bus rewiring on Day 1**.

### Good examples
- helper for launching browser with stable setup
- helper for loading fixture + extension-like environment
- helper for common artifact capture

### Bad examples
- rewriting all of `bench-live/index.ts`
- creating a giant framework abstraction that blocks scenario delivery

Rule of thumb:
**small reusable helper good, architecture rewrite bad.**

---

## 5. Day 1 task order

Use this exact order if dispatching today.

### Step 1 — Dispatch owner
Owner receives:
- `integration-owner-playbook.md`
- `master-backlog.md`
- `day1-execution-plan.md`

### Step 2 — Dispatch Claude
Claude receives:
- `claude-parallel-workplan.md`
- `day1-execution-plan.md`

### Step 3 — Dispatch G2 and G3 first
Reason:
- additive
- low conflict
- do not depend on live rankings

### Step 4 — Dispatch G1
Reason:
- also additive, but semantics more likely to matter to owner wiring

### Step 5 — Dispatch G4
Reason:
- should ideally use Claude’s live prioritization if available
- but can start with interaction-priority + input-translation if not

---

## 6. Day 1 acceptance ladder

The integration owner should not wait until all tasks finish to think about validation.
Prepare this ladder immediately.

### Baseline commands
```bash
pnpm type-check
pnpm test
pnpm bench
```

### Live visibility
```bash
pnpm bench:live -- --list
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
```

### Optimizer baseline
```bash
pnpm bench:opt
pnpm bench:opt:status
```

### Later in Day 1 or at first integration window
Add any newly implemented live scenarios explicitly:

```bash
pnpm bench:live -- --scenario <new-scenario-id>
```

Do **not** attempt full delivery validation until G1 artifacts are reviewed.

---

## 7. Day 1 integration policy

### What the owner may integrate today
Good Day 1 integrations:
- new standalone safety files
- new standalone telemetry files
- new mutation modules
- new config directories
- new live scenario files
- workflow file

### What the owner should delay until worker outputs are stable
- broad `runner.ts` rewiring
- `types.ts` schema expansion touching every consumer
- central status artifact redesign
- changing publish/promote semantics mid-flight

### Recommended Day 1 integration window
Only do **one** real integration window near the end of the day.

Reason:
- lets workers finish bounded slices
- minimizes thrash
- gives owner one clean reconciliation pass

---

## 8. What to do if things go off track

### If Claude is late
Do not block engineering completely.
Let G4 start with:
- `interaction-priority`
- `input-translation`

These are safe first bets given current gap severity.

### If G4 starts over-abstracting
Redirect immediately:
- ship one stable scenario first
- extract helpers second

### If G1 starts needing runner wiring
Stop and split the task:
- G1 finishes execution model and workflow artifacts
- owner handles runner integration later

### If G2/G3 want to rewrite shared schema globally
Stop and narrow scope:
- create bounded modules and config shapes first
- owner reconciles schema centrally later

---

## 9. Day 1 expected outputs by person

### Owner
- ownership boundaries reaffirmed
- first acceptance ladder written down
- first integration window scheduled

### Claude
- live coverage ranking
- app completion matrix
- release-readiness or roadmap reality draft

### G1
- upgraded promotion/publish/rollback execution-ready artifacts
- `bench-opt.yml` workflow

### G2
- safety + telemetry modules created

### G3
- `agent-config/` + tool/graph mutation skeleton created

### G4
- at least 1–2 new live scenarios or strong scenario implementation skeletons

---

## 10. Day 1 success criteria

Day 1 is successful if:

- everyone stayed inside file ownership boundaries,
- the browser-validation direction is clearer than it was yesterday,
- safety/telemetry now exist as modules rather than ideas,
- tool/graph mutation now exist as real targets rather than future notes,
- promotion execution has moved closer to operational reality,
- and the owner can begin Wave 1 integration without redesigning everyone’s work.

Day 1 is **not** successful if:

- multiple people touched `runner.ts` independently,
- workers produced broad rewrites instead of bounded slices,
- live work produced screenshots without pass/fail meaning,
- or docs stayed stale while code moved.

---

## 11. Recommended end-of-day status format

The owner should publish this by the end of Day 1:

```md
# Astra Day 1 Status

## Completed today
- ...

## In progress
- ...

## Not started
- ...

## Acceptance results
- `pnpm type-check`: pass/fail
- `pnpm test`: pass/fail
- `pnpm bench`: pass/fail
- `pnpm bench:live -- --list`: pass/fail
- `pnpm bench:opt`: pass/fail

## Risks
- ...

## Day 2 plan
- ...
```

---

## 12. Final note

Day 1 is about creating a **clean convergence path**.
If we do Day 1 well, Day 2 and Day 3 become integration and closure work instead of chaos control.

The highest-value move today is not heroics.
It is disciplined parallelism.
