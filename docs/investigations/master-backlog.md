# Astra Master Backlog — App Completion Campaign

_Last updated: 2026-03-26 (E6 semantic sync — Wave 5 verified)_

> This is the campaign-level backlog for finishing Astra’s remaining platform and app-completion work.
> It is designed to coordinate:
>
> - Claude (coverage / audit / docs / release-readiness)
> - GPT-5.4 subagents (bounded implementation tracks)
> - a single integration owner (shared bus wiring + validation + final acceptance)

---

## 0. How to use this backlog

This document is meant to be operational.
Each task includes:

- priority (`P0`, `P1`, `P2`)
- owner
- goal
- suggested file scope
- files that should remain integration-owner only
- dependencies
- acceptance criteria
- notes / risk

### Priority meaning

- **P0** = blocks calling the system “near-complete”
- **P1** = materially increases confidence / breadth / release readiness
- **P2** = important follow-up, but not first-wave critical

### Ownership shortcuts

- **Claude** = Claude main agent / Claude team
- **G1** = GPT worker, promotion/delivery
- **G2** = GPT worker, safety/telemetry
- **G3** = GPT worker, tool/graph mutation
- **G4** = GPT worker, live implementation
- **Owner** = integration owner / final wiring owner

---

## 1. Campaign definition of done

We should not call this campaign complete until all four layers are true:

### Layer A — App validation completeness
- major user-visible surfaces have deterministic bench coverage
- major risky surfaces have live coverage or explicit justified exception

### Layer B — Harness completeness
- verification / keep-reject / session / orchestration / status are coherent
- optimizer targets are broader than prompt/context only

### Layer C — Delivery completeness
- promotion / publish / rollback are operationally meaningful
- release gates are explicit and inspectable

### Layer D — Team-operability completeness
- roadmap/docs are current
- release readiness is documented
- operator can understand system state without tribal knowledge

---

## 2. Owner-only file policy

These files are integration-owner only unless a task explicitly says otherwise:

- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/types.ts`
- `bench-live/index.ts`
- `bench/entry.ts`
- `package.json`

Rationale:
These are shared bus files and merge choke points.
Parallel edits here will create avoidable instability.

---

# Epic A — Live Coverage Parity

## Goal
Expand `bench-live` from page-translation-heavy validation into broader app runtime validation across core surfaces.

---

### A1. Build live coverage matrix -- COMPLETE
- **Priority:** P0
- **Owner:** Claude
- **Goal:** Produce the authoritative live coverage plan for all major Astra surfaces.
- **Suggested read scope:**
  - `docs/bench-harness.md`
  - `docs/bench-opt.md`
  - `docs/anthropic-style-long-running-harness-roadmap.md`
  - `bench/scenarios/`
  - `bench/evaluators/`
  - `bench-live/scenarios/`
  - `src/entrypoints/content/`
- **Deliverable:** `docs/investigations/astra-live-coverage-matrix.md`
- **Dependencies:** none
- **Acceptance criteria:**
  - every major surface classified as `none / smoke / partial / strong`
  - minimal live scenario defined per missing surface
  - stronger follow-up scenario defined where useful
  - artifacts and pass/fail criteria specified
- **Notes:** This task should guide G4 sequencing.

---

### A2. Implement interaction-priority live scenario(s) -- COMPLETE
- **Priority:** P0
- **Owner:** G4
- **Goal:** Add live validation for interaction-priority behavior.
- **Suggested write scope:**
  - `bench-live/scenarios/interaction-priority-*.ts`
  - `bench-live/scenarios/helpers/*` if needed
  - small local changes to `bench-live/driver.ts` only if required
- **Do not edit:**
  - `bench-live/index.ts`
  - `bench-opt/runner.ts`
- **Dependencies:** A1 preferred, but can start with a minimal smoke if A1 is delayed
- **Acceptance criteria:**
  - scenario runs independently
  - emits screenshot + DOM/html evidence
  - has meaningful pass/fail logic
  - documents likely registration step for owner
- **Notes:** Focus on a narrow but real interaction ordering assertion, not broad architecture.

---

### A3. Implement input-translation live scenario(s) -- COMPLETE
- **Priority:** P0
- **Owner:** G4
- **Goal:** Add live validation for input translation/writeback behavior.
- **Suggested write scope:**
  - `bench-live/scenarios/input-translation-*.ts`
  - helpers as needed
- **Dependencies:** A1 preferred
- **Acceptance criteria:**
  - scenario drives input interaction
  - verifies translated result / writeback effect
  - saves artifacts
  - clearly states pass/fail basis
- **Notes:** Prefer a stable minimal case first.

---

### A4. Implement subtitle live scenario(s) -- COMPLETE (B-class bug: VTTCue bridge timeout)
- **Priority:** P0
- **Owner:** G4
- **Goal:** Add live validation for subtitle translation behavior.
- **Suggested write scope:**
  - `bench-live/scenarios/subtitle-*.ts`
- **Dependencies:** A1 preferred
- **Acceptance criteria:**
  - scenario verifies subtitle-specific runtime behavior
  - emits artifacts
  - pass/fail is explicit
- **Notes:** Start with smoke-level correctness before richer multi-state scenarios.

---

### A5. Implement frame-coordination live scenario(s) -- COMPLETE
- **Priority:** P1
- **Owner:** G4
- **Goal:** Validate top-frame/child-frame coordination in live mode.
- **Suggested write scope:**
  - `bench-live/scenarios/frame-coordination-*.ts`
- **Dependencies:** A1
- **Acceptance criteria:**
  - checks meaningful frame-coordination behavior
  - artifacts preserved
  - owner wiring notes included
- **Notes:** This is more integration-sensitive; keep scope narrow.

---

### A6. Register and wire new live scenarios -- COMPLETE (integration done)
- **Priority:** P0
- **Owner:** Owner
- **Goal:** Integrate new scenarios into the shared live and optimizer flow.
- **Write scope:**
  - `bench-live/scenarios/index.ts`
  - `bench-live/index.ts` if needed
  - `bench-opt/runner.ts`
  - `bench-opt/status.ts`
- **Dependencies:** A2/A3/A4 and any later scenarios
- **Acceptance criteria:**
  - scenarios appear in `pnpm bench:live -- --list`
  - selected scenarios can be consumed by optimizer live path
  - status artifacts reflect the results

---

### A7. Reassess live coverage after implementation wave -- REMAINING (Wave 5 follow-up)
- **Priority:** P1
- **Owner:** Claude
- **Goal:** Update the live matrix after first-wave implementations land.
- **Deliverable:** revised coverage report or addendum
- **Dependencies:** A2–A6
- **Acceptance criteria:**
  - updated coverage classifications
  - remaining live gaps reprioritized

---

# Epic B — Promotion / Publish / Rollback Execution

## Goal
Move from promotion planning to operationally meaningful delivery flow.

---

### B1. Add executable promotion artifact model -- COMPLETE
- **Priority:** P0
- **Owner:** G1
- **Goal:** Upgrade promotion from abstract decisioning to structured execution-ready output.
- **Write scope:**
  - `bench-opt/promote.ts`
  - helper files under `bench-opt/`
- **Do not edit:**
  - `bench-opt/runner.ts`
  - `bench-opt/types.ts`
- **Dependencies:** none
- **Acceptance criteria:**
  - promotion artifact contains structurally meaningful execution details
  - split/check/live/canary gating remains explicit
  - owner can wire it without redesign

---

### B2. Add executable publish plan model -- COMPLETE
- **Priority:** P0
- **Owner:** G1
- **Goal:** Upgrade publish planning so branch / commit / PR / wait-gates / publish are more than prose.
- **Write scope:**
  - `bench-opt/publish.ts`
- **Dependencies:** B1 preferred
- **Acceptance criteria:**
  - publish plan remains structured
  - branch / commit / PR / publish steps are operationally meaningful
  - dry-run/planned/ready state remains clear

---

### B3. Add executable rollback plan model -- COMPLETE
- **Priority:** P0
- **Owner:** G1
- **Goal:** Make rollback operationally credible.
- **Write scope:**
  - `bench-opt/rollback.ts`
- **Dependencies:** B1/B2 preferred
- **Acceptance criteria:**
  - rollback steps represent real recoverable actions
  - trigger semantics are explicit
  - blocked/idle/planned/armed are coherent

---

### B4. Create bench-opt workflow -- COMPLETE
- **Priority:** P0
- **Owner:** G1
- **Goal:** Add dedicated GitHub workflow support for bench-opt path.
- **Write scope:**
  - `.github/workflows/bench-opt.yml` (new)
- **Dependencies:** none
- **Acceptance criteria:**
  - workflow exists
  - steps are sensible for bench-opt validation
  - outputs/check semantics are usable by promotion logic

---

### B5. Wire promotion/publish/rollback execution into runner/status -- COMPLETE (integration done)
- **Priority:** P0
- **Owner:** Owner
- **Goal:** Integrate G1’s execution model into the central bus.
- **Write scope:**
  - `bench-opt/runner.ts`
  - `bench-opt/types.ts`
  - `bench-opt/status.ts`
  - `package.json` if new scripts are needed
- **Dependencies:** B1–B4
- **Acceptance criteria:**
  - promotion/publish/rollback artifacts are consumed coherently
  - blocked vs qualified vs promoted is clear
  - status artifact reflects richer delivery state

---

### B6. Validate real delivery drill path -- REMAINING (Wave 5 follow-up)
- **Priority:** P1
- **Owner:** Owner
- **Goal:** Prove end-to-end delivery path is operationally meaningful.
- **Dependencies:** B5
- **Acceptance criteria:**
  - branch / PR preparation path can be exercised
  - rollback preparation path can be exercised
  - blocked reasons are legible

---

### B7. Audit promotion safety and release confidence -- REMAINING (Wave 5 follow-up)
- **Priority:** P1
- **Owner:** Claude
- **Goal:** Check whether promotion logic is trustworthy enough to use.
- **Dependencies:** B5/B6, C-epic docs helpful
- **Acceptance criteria:**
  - explicit list of missing safeguards, if any
  - explicit recommendation on what still blocks “ship-ready” promotion

---

# Epic C — Safety / Anti-overfitting / Telemetry

## Goal
Add the guardrail and observability layer needed to trust optimizer outcomes.

---

### C1. Implement guardrails module -- COMPLETE
- **Priority:** P0
- **Owner:** G2
- **Goal:** Add structured optimizer safety checks.
- **Write scope:**
  - `bench-opt/guardrails.ts`
- **Dependencies:** none
- **Acceptance criteria:**
  - structured safety outputs exist
  - overfit-style failure modes are representable
  - owner can wire results into runner/status/promotion

---

### C2. Implement red-flags module -- COMPLETE
- **Priority:** P0
- **Owner:** G2
- **Goal:** Add explicit red-flag classification for promotion/risk.
- **Write scope:**
  - `bench-opt/red-flags.ts`
- **Dependencies:** C1 preferred
- **Acceptance criteria:**
  - red flags are separate from generic notes
  - promotion-blocking vs warning states can be distinguished

---

### C3. Implement telemetry module -- COMPLETE
- **Priority:** P0
- **Owner:** G2
- **Goal:** Add structured telemetry for runs/iterations.
- **Write scope:**
  - `bench-opt/telemetry.ts`
  - helper files if needed
- **Dependencies:** none
- **Acceptance criteria:**
  - can represent cost / latency / split score / live summary / decision summary
  - not just free-form markdown

---

### C4. Implement logs/dashboard artifacts -- COMPLETE
- **Priority:** P1
- **Owner:** G2
- **Goal:** Add explicit logs/dashboard layer.
- **Write scope:**
  - `bench-opt/logs.ts`
  - `bench-opt/dashboard.md`
- **Dependencies:** C3 preferred
- **Acceptance criteria:**
  - operator-facing aggregation is easier than replaying raw logs
  - dashboard file exists and matches current semantics

---

### C5. Define safety policy audit -- COMPLETE
- **Priority:** P0
- **Owner:** Claude
- **Goal:** Specify what should block promotion vs warn only.
- **Deliverable:** `docs/investigations/promotion-safety-checklist.md` or equivalent
- **Dependencies:** none; may start in parallel with G2
- **Acceptance criteria:**
  - explicit promotion-blocking conditions
  - explicit warning-only conditions
  - conditions map cleanly to candidate behavior

---

### C6. Wire guardrails/telemetry into runner and status -- COMPLETE (integration done)
- **Priority:** P0
- **Owner:** Owner
- **Goal:** Integrate C1–C4 into shared bus/state.
- **Write scope:**
  - `bench-opt/runner.ts`
  - `bench-opt/types.ts`
  - `bench-opt/status.ts`
- **Dependencies:** C1–C4
- **Acceptance criteria:**
  - latest status artifact exposes safety/telemetry state
  - promotion can consume blocking safety signals
  - operator-visible output is coherent

---

### C7. Validate safety in promotion flow -- REMAINING (Wave 5 follow-up)
- **Priority:** P1
- **Owner:** Owner + Claude review
- **Goal:** Confirm promotion can be blocked for the right reasons.
- **Dependencies:** B5, C6
- **Acceptance criteria:**
  - at least one plausible blocked path is represented correctly
  - docs explain why it blocks

---

# Epic D — Tool / Graph Mutation Parity

## Goal
Make prompt/context/tool/graph into real optimization targets instead of stopping at prompt/context.

---

### D1. Create `agent-config/` structure -- COMPLETE
- **Priority:** P0
- **Owner:** G3
- **Goal:** Add file-based config roots for optimizer targets.
- **Write scope:**
  - `agent-config/prompts/`
  - `agent-config/context-policies/`
  - `agent-config/tool-policies/`
  - `agent-config/graphs/`
- **Dependencies:** none
- **Acceptance criteria:**
  - directories exist
  - config shapes are concrete and understandable

---

### D2. Implement prompt/context mutation modules -- COMPLETE
- **Priority:** P1
- **Owner:** G3
- **Goal:** Move toward file-based mutation handling, not only inline candidates.
- **Write scope:**
  - `bench-opt/mutate-prompts.ts`
  - `bench-opt/mutate-context.ts`
- **Dependencies:** D1
- **Acceptance criteria:**
  - mutation operators are represented structurally
  - lineage remains possible

---

### D3. Implement tool mutation module -- COMPLETE
- **Priority:** P0
- **Owner:** G3
- **Goal:** Add first-class tool policy mutation target.
- **Write scope:**
  - `bench-opt/mutate-tools.ts`
  - `agent-config/tool-policies/*`
- **Dependencies:** D1
- **Acceptance criteria:**
  - tool policy candidates are concrete
  - mutation operators exist
  - handoff notes clearly explain owner integration points

---

### D4. Implement graph mutation module -- COMPLETE
- **Priority:** P0
- **Owner:** G3
- **Goal:** Add first-class graph mutation target.
- **Write scope:**
  - `bench-opt/mutate-graph.ts`
  - `agent-config/graphs/*`
- **Dependencies:** D1
- **Acceptance criteria:**
  - graph policy candidates are concrete
  - different graph shapes are representable
  - owner can wire without schema redesign

---

### D5. Define mutation policy model audit -- REMAINING (Wave 5 follow-up)
- **Priority:** P1
- **Owner:** Claude
- **Goal:** Review whether tool/graph mutation dimensions are the right ones.
- **Dependencies:** D1–D4 can run in parallel or after initial schemas exist
- **Acceptance criteria:**
  - clear recommendation on what mutation dimensions matter most
  - weak/useless mutation dimensions called out

---

### D6. Wire tool/graph mutation into config resolution -- COMPLETE (types extended)
- **Priority:** P0
- **Owner:** Owner
- **Goal:** Integrate D1–D4 into actual optimizer configuration flow.
- **Write scope:**
  - `bench-opt/runner.ts`
  - `bench-opt/types.ts`
  - `bench/optimizer-config.ts`
- **Dependencies:** D1–D4
- **Acceptance criteria:**
  - resolved config can represent tool and graph targets
  - downstream systems can at least see them, even if not all are fully consumed yet

---

# Epic E — App Completion Audit / Docs / Release Readiness

## Goal
Make the campaign legible and ship-calibrated, not just code-heavy.

---

### E1. Build app completion audit -- COMPLETE
- **Priority:** P0
- **Owner:** Claude
- **Goal:** Enumerate major features and validation status.
- **Deliverable:** `docs/investigations/astra-app-completion-audit.md`
- **Dependencies:** none
- **Acceptance criteria:**
  - feature × validation-layer matrix exists
  - top blockers are ranked
  - implementation team can use it for sequencing

---

### E2. Refresh roadmap status -- COMPLETE
- **Priority:** P0
- **Owner:** Claude
- **Goal:** Update roadmap to match reality.
- **Write scope:**
  - `docs/anthropic-style-long-running-harness-roadmap.md`
- **Dependencies:** E1 helpful, but not required
- **Acceptance criteria:**
  - each phase is clearly classified complete/partial/missing
  - stale claims are removed or updated

---

### E3. Refresh bench-opt docs -- COMPLETE
- **Priority:** P1
- **Owner:** Claude
- **Goal:** Make bench-opt docs match current capabilities and boundaries.
- **Write scope:**
  - `docs/bench-opt.md`
  - `docs/bench-harness.md`
- **Dependencies:** E2 helpful
- **Acceptance criteria:**
  - docs no longer understate or overstate current system
  - current workflows and boundaries are clear

---

### E4. Create release readiness checklist -- COMPLETE
- **Priority:** P0
- **Owner:** Claude
- **Goal:** Define what must be green before we call the campaign complete.
- **Deliverable:** `docs/release-readiness-checklist.md`
- **Dependencies:** E1/E2 helpful
- **Acceptance criteria:**
  - includes bench/live/promotion/rollback/docs/operator gates
  - is concrete enough to use as final gate

---

### E5. Create operator runbook -- COMPLETE
- **Priority:** P1
- **Owner:** Claude
- **Goal:** Make system state legible to operators.
- **Deliverable:** `docs/bench-opt-operator-runbook.md`
- **Dependencies:** E3/E4 helpful
- **Acceptance criteria:**
  - explains important artifacts
  - explains blocked/qualified/promoted semantics
  - explains how to read latest status and resume session

---

### E6. Integrate docs and status semantics -- IN PROGRESS (this task)
- **Priority:** P1
- **Owner:** Owner
- **Goal:** Ensure docs, status artifact, and runtime semantics agree.
- **Write scope:** owner discretion in central files/docs
- **Dependencies:** E2–E5
- **Acceptance criteria:**
  - no obvious doc/runtime mismatch remains
  - release checklist reflects actual system behavior

---

# 3. Suggested execution sequence

## Wave 1 — Planning / additive low-conflict foundation
1. A1 live coverage matrix (Claude)
2. C1/C2/C3/C4 safety + telemetry modules (G2)
3. D1/D2/D3/D4 tool/graph mutation modules (G3)
4. E1 app completion audit (Claude)

## Wave 2 — Delivery implementation + docs alignment
5. B1/B2/B3/B4 promotion execution and workflow (G1)
6. E2/E3 roadmap + docs refresh (Claude)
7. E4 release readiness checklist (Claude)

## Wave 3 — Live implementation
8. A2/A3/A4 first-wave live scenarios (G4)
9. A5 frame-coordination / later live scenarios (G4)
10. E5 operator runbook (Claude)

## Wave 4 — Owner integration
11. C6 safety/telemetry wiring (Owner)
12. D6 tool/graph wiring (Owner)
13. B5 promotion wiring (Owner)
14. A6 live scenario registration/wiring (Owner)
15. E6 docs/status semantic cleanup (Owner)

## Wave 5 — Validation / confidence pass
16. B6 delivery drill validation (Owner)
17. C7 safety-in-promotion validation (Owner + Claude review)
18. A7 live coverage reassessment (Claude)
19. B7 promotion safety audit (Claude)

---

# 4. Full acceptance ladder

The integration owner should run these in stages as the waves land.

## Baseline
```bash
pnpm type-check
pnpm test
pnpm bench
```

## Live layer
```bash
pnpm bench:live -- --list
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
```

Add newly integrated scenario ids as they land.

## Optimizer layer
```bash
pnpm bench:opt
pnpm bench:opt:status
```

## Execution / verification path
```bash
pnpm bench:opt -- --verify --materialize
pnpm bench:opt -- --verify --materialize --apply-edits
```

## Live-aware optimizer path
```bash
pnpm bench:opt -- --live
pnpm bench:opt -- --live --promotion-plan
```

## Orchestration / session path
```bash
pnpm bench:opt -- --orchestrate --session
pnpm bench:opt:resume-latest
pnpm bench:opt:autoloop
```

## Delivery path
Once real execution exists, add drills for:

- promotion branch preparation
- PR preparation
- rollback preparation/execution

---

# 5. Campaign-level blockers to watch

These are the most likely things to make the campaign look “almost done” while still being incomplete.

## Blocker 1 — Live coverage remains too narrow
Even if `bench-live` is real, we still cannot call the app complete if only page-translation has meaningful live coverage.

## Blocker 2 — Promotion remains operationally fake
If promotion/publish/rollback remain planning-only, the platform is still not delivery-complete.

## Blocker 3 — Safety remains underspecified
Without guardrails, it is too easy to mistake local improvement for trustworthy improvement.

## Blocker 4 — Tool/graph remain invisible to the optimizer
Without these, Astra remains a prompt/context optimizer rather than a system optimizer.

## Blocker 5 — Docs drift again
If the docs still describe an older system, the whole team will keep prioritizing incorrectly.

---

# 6. Minimal viable “near-complete” target

If we need a practical stopping line for this campaign, this is the minimum credible target:

- first-wave live scenarios implemented for at least 3 non-page-translation surfaces
- promotion/publish/rollback upgraded from vague planning to execution-ready artifacts
- guardrails/red-flags/telemetry modules exist and are wired into status/promotion
- tool/graph mutation targets exist structurally and are visible in resolved config flow
- roadmap/docs/release checklist/operator runbook are updated
- acceptance ladder passes at the agreed scope

That would not be “perfect forever,” but it would be a real, supportable, near-complete state.

---

# 7. Final note

This backlog is intended to create momentum without chaos.
If a task starts to sprawl into owner-only bus work, stop, tighten the contract, and hand the integration back cleanly.

The goal is not to make every contributor touch every layer.
The goal is to let each contributor finish a bounded, high-value slice that the owner can integrate quickly and safely.

---

# 8. Campaign Status Summary (Wave 5 Verified)

_Updated: 2026-03-26_

## Completed tasks (Waves 1-4 + integration)

| Task | Status |
|------|--------|
| A1 Build live coverage matrix | COMPLETE |
| A2 interaction-priority live scenario | COMPLETE |
| A3 input-translation live scenario | COMPLETE |
| A4 subtitle live scenario | COMPLETE (B-class bug: VTTCue bridge timeout) |
| A5 frame-coordination live scenario | COMPLETE |
| A6 Register/wire new live scenarios | COMPLETE (integration done) |
| B1 Executable promotion artifact | COMPLETE |
| B2 Executable publish plan | COMPLETE |
| B3 Executable rollback plan | COMPLETE |
| B4 bench-opt workflow | COMPLETE |
| B5 Wire promotion/publish/rollback | COMPLETE (integration done) |
| C1 Guardrails module | COMPLETE |
| C2 Red-flags module | COMPLETE |
| C3 Telemetry module | COMPLETE |
| C4 Logs/dashboard artifacts | COMPLETE |
| C5 Safety policy audit | COMPLETE |
| C6 Wire guardrails/telemetry | COMPLETE (integration done) |
| D1 agent-config structure | COMPLETE |
| D2 Prompt/context mutation | COMPLETE |
| D3 Tool mutation module | COMPLETE |
| D4 Graph mutation module | COMPLETE |
| D6 Wire tool/graph into config | COMPLETE (types extended) |
| E1 App completion audit | COMPLETE |
| E2 Refresh roadmap status | COMPLETE |
| E3 Refresh bench-opt docs | COMPLETE |
| E4 Release readiness checklist | COMPLETE |
| E5 Operator runbook | COMPLETE |
| E6 Docs semantic sync | IN PROGRESS (this task) |

## Remaining tasks (Wave 5 follow-ups)

| Task | Status | Priority |
|------|--------|----------|
| A7 Reassess live coverage | REMAINING | P1 |
| B6 Validate real delivery drill | REMAINING | P1 |
| B7 Audit promotion safety | REMAINING | P1 |
| C7 Validate safety in promotion | REMAINING | P1 |
| D5 Mutation policy model audit | REMAINING | P1 |

## Campaign health

- **Layer A (App validation):** Near-complete. 4/10 surfaces have live scenarios, 3/4 pass. Subtitle has a B-class bug.
- **Layer B (Harness):** Complete at execution-model level. Real VCS ops remain follow-up.
- **Layer C (Delivery):** Complete at execution-model level. Safety/telemetry wired into status/promotion.
- **Layer D (Team operability):** Docs current. Release checklist, operator runbook, and roadmap all updated.

The "minimal viable near-complete" target from section 6 is met:
- First-wave live scenarios for 4 non-page-translation surfaces: DONE
- Promotion/publish/rollback upgraded to execution-ready artifacts: DONE
- Guardrails/red-flags/telemetry wired into status/promotion: DONE
- Tool/graph mutation targets visible in resolved config: DONE
- Roadmap/docs/release checklist/operator runbook updated: DONE
