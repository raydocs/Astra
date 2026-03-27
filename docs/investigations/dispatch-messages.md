# Dispatch Messages — Astra App Completion Campaign

_Last updated: 2026-03-26_

> This file contains ready-to-send dispatch messages for:
>
> - Claude
> - GPT-5.4 workers / subagents
> - the integration owner
>
> These are written so you can copy/paste them directly with minimal editing.

---

## 0. How to use these templates

1. Pick the recipient type.
2. Paste the relevant message.
3. Attach or point them to the referenced markdown file(s).
4. If needed, replace placeholders like `<owner-name>` or `<branch-name>`.

These messages are intentionally explicit.
The goal is to reduce ambiguity and speed up parallel execution.

---

# 1. Claude kickoff message

## Claude — main assignment

```md
We’re starting a coordinated app-completion push for Astra.

Your role is **coverage / acceptance / audit / docs owner**.
You are **not** the primary integrator.
Another agent owns final bus wiring and shared integration files.

Please use this task pack as your source of truth:
- `docs/investigations/claude-parallel-workplan.md`

Your priority order is:
1. Workstream A — Live Coverage Matrix and Scenario Plan
2. Workstream B — App Completion Audit
3. Workstream C — Roadmap / Docs / Release-Readiness Refresh
4. Optional bounded implementation only after the above are strong

Important constraints:
- Do not take ownership of `bench-opt/runner.ts`, `bench-opt/types.ts`, `bench/types.ts`, `bench-live/index.ts`, `bench/entry.ts`, or `package.json` unless explicitly asked.
- If you identify an integration change that belongs in those files, specify it clearly and hand it back instead of silently wiring it yourself.
- Be concrete. We need explicit scenarios, validation gaps, acceptance criteria, blockers, and release-readiness signals — not generic advice.

Required outputs:
- a live coverage matrix for major surfaces
- an app completion audit
- a roadmap/docs reality check
- a release-readiness checklist and operator-facing clarity improvements where needed

Please structure your handoff exactly as requested in the task pack.

The goal is for your output to directly guide the implementation wave with minimal guessing.
```

---

## Claude — focused follow-up on live coverage only

```md
Please focus only on the live coverage problem for Astra.

Use:
- `docs/investigations/claude-parallel-workplan.md`
- specifically Workstream A

What I need from you:
- classify every major Astra surface by current live coverage (`none / smoke / partial / strong`)
- identify missing live scenarios
- define the **minimum viable live scenario** for each missing surface
- define the **stronger follow-up scenario** where appropriate
- specify required artifacts and pass/fail criteria
- rank the missing scenarios by priority

This should be concrete enough that an implementation worker can directly build new `bench-live/scenarios/*.ts` files from your output.

Do not spend time on broad integration changes.
Stay focused on coverage, scenario design, and acceptance criteria.
```

---

## Claude — focused follow-up on release readiness only

```md
Please focus only on release readiness for Astra.

Use:
- `docs/investigations/claude-parallel-workplan.md`
- specifically Workstream C

What I need from you:
- refresh the roadmap reality check
- classify roadmap phases and checklist items as complete / partial / missing
- produce a release-readiness checklist
- identify what still blocks calling the app / harness “near-complete”
- if useful, draft an operator runbook or status-reading guide

The output should help us decide what still must be built before we trust promotion and delivery.

Do not take over integration wiring. Stay on the spec / docs / readiness side.
```

---

# 2. GPT-5.4 worker kickoff messages

## Worker G1 — Promotion / Delivery Execution

```md
You are Worker G1 for the Astra completion campaign.

Your role: **Promotion / Delivery Execution**

Please use this task pack as your source of truth:
- `docs/investigations/gpt54-subagents-task-pack.md`

Read the section:
- `Worker G1 — Promotion / Delivery Execution`

Your goal is to upgrade promotion/publish/rollback from planning-only artifacts into execution-ready structured machinery.

Primary files you may edit:
- `bench-opt/promote.ts`
- `bench-opt/publish.ts`
- `bench-opt/rollback.ts`
- `.github/workflows/bench-opt.yml`
- helper files you add under `bench-opt/` or `.github/workflows/`

Files you must not edit unless explicitly told:
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `package.json`

Important:
- Do not opportunistically wire your changes into the central runner.
- Build the execution-capable model cleanly, then return integration notes for the owner.
- Preserve clear blocked / planned / qualified / promoted semantics.

Return your work using the exact handoff format in the task pack.
```

---

## Worker G2 — Safety / Anti-overfitting / Telemetry

```md
You are Worker G2 for the Astra completion campaign.

Your role: **Safety / Anti-overfitting / Telemetry**

Please use:
- `docs/investigations/gpt54-subagents-task-pack.md`

Read the section:
- `Worker G2 — Safety / Anti-overfitting / Telemetry`

Your mission is to implement the first real version of:
- `bench-opt/guardrails.ts`
- `bench-opt/red-flags.ts`
- `bench-opt/telemetry.ts`
- `bench-opt/logs.ts`
- `bench-opt/dashboard.md`

Important constraints:
- Do not own `bench-opt/runner.ts` or `bench-opt/types.ts`
- Prefer reusable structured modules over tightly coupling to current runner details
- Make safety and telemetry output machine-readable, not just prose

Desired concepts include:
- train improves but validation/holdout do not
- cost rises without meaningful score gain
- instability / oscillation
- scope creep
- live pass but deterministic regressions
- promotion-blocking red flags
- iteration cost / latency / split score / decision telemetry

Return your work using the exact handoff format in the task pack.
```

---

## Worker G3 — Tool / Graph Mutation Targets

```md
You are Worker G3 for the Astra completion campaign.

Your role: **Tool / Graph Mutation Targets**

Please use:
- `docs/investigations/gpt54-subagents-task-pack.md`

Read the section:
- `Worker G3 — Tool / Graph Mutation Targets`

Your mission is to add the candidate/config skeleton and mutation scaffolding for:
- prompts
- context policies
- tool policies
- graph policies

Primary files you may edit:
- `agent-config/prompts/`
- `agent-config/context-policies/`
- `agent-config/tool-policies/`
- `agent-config/graphs/`
- `bench-opt/mutate-prompts.ts`
- `bench-opt/mutate-context.ts`
- `bench-opt/mutate-tools.ts`
- `bench-opt/mutate-graph.ts`

Do not edit unless explicitly asked:
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/optimizer-config.ts`

Important:
- Make the config shapes explicit and integration-friendly.
- Do not assume you own runtime wiring.
- Your output should let the integration owner wire these targets later without redesign.

Return your work using the exact handoff format in the task pack.
```

---

## Worker G4 — Live Scenario Implementation

```md
You are Worker G4 for the Astra completion campaign.

Your role: **Live Scenario Implementation**

Please use:
- `docs/investigations/gpt54-subagents-task-pack.md`

Read the section:
- `Worker G4 — Live Scenario Implementation`

Your mission is to implement new isolated `bench-live` scenarios for missing high-priority surfaces.

Primary files you may edit:
- `bench-live/scenarios/*.ts`
- `bench-live/scenarios/helpers/*.ts`
- `bench-live/driver.ts` only if truly needed
- `bench-live/evaluator.ts` only for local scenario support, not a broad redesign

Avoid unless explicitly asked:
- `bench-live/index.ts`
- `bench-opt/runner.ts`
- `bench-opt/status.ts`

Priority implementation order unless coverage plan says otherwise:
1. interaction-priority
2. input-translation
3. subtitle
4. frame-coordination
5. hover / selection
6. site-automation

Important:
- Prefer stable, narrow, artifact-rich scenarios over broad architectural rewrites.
- Each scenario should have meaningful pass/fail logic, not just screenshots.
- Leave registration/wiring notes for the integration owner.

Return your work using the exact handoff format in the task pack.
```

---

# 3. Integration owner kickoff message

## Integration owner — main kickoff

```md
You are the single integration owner for the Astra completion campaign.

Use these two files as your source of truth:
- `docs/investigations/integration-owner-playbook.md`
- `docs/investigations/master-backlog.md`

Your role is to:
- maintain file ownership boundaries
- control sequencing
- integrate bounded worker outputs
- preserve schema consistency
- wire shared bus changes
- run acceptance validation
- publish state summaries

You own these files unless explicitly delegating a tightly-scoped edit:
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/types.ts`
- `bench-live/index.ts`
- `bench/entry.ts`
- `package.json`

Please follow the wave sequence in `master-backlog.md` unless there is a strong reason to reorder.

At minimum, after each integration cycle, publish:
- what was integrated
- what is still blocked
- acceptance results
- next wave

Do not absorb every worker task yourself.
Your job is to keep the bus coherent and the campaign convergent.
```

---

## Integration owner — first-wave dispatch

```md
Please begin Wave 1 integration planning for Astra.

Use:
- `docs/investigations/integration-owner-playbook.md`
- `docs/investigations/master-backlog.md`

For this first wave, your goals are:
1. confirm file ownership boundaries
2. prepare to integrate additive low-conflict modules first
3. keep `runner.ts` / `types.ts` stable while workers produce slices
4. define the first acceptance ladder you will run once Wave 1 lands

Immediate focus:
- Safety / telemetry foundation
- Tool / graph mutation skeleton
- Claude’s live coverage matrix and app completion audit

Please do not start broad rewiring before the worker outputs exist unless you are only preparing stable interfaces.

Your immediate output should be:
- a short plan for Wave 1 integration order
- any schema risks you want contributors to avoid
- the first acceptance command set you plan to run
```

---

# 4. Combined kickoff message if you want one shared thread

## Shared campaign kickoff

```md
We are starting the Astra app-completion campaign.

Source documents:
- `docs/investigations/master-backlog.md`
- `docs/investigations/claude-parallel-workplan.md`
- `docs/investigations/gpt54-subagents-task-pack.md`
- `docs/investigations/integration-owner-playbook.md`

Role split:
- Claude = coverage / acceptance / audit / docs / release-readiness
- GPT workers = bounded implementation slices
- Integration owner = final wiring / shared bus / validation / go-no-go

Critical ownership rule:
The integration owner exclusively owns:
- `bench-opt/runner.ts`
- `bench-opt/types.ts`
- `bench/types.ts`
- `bench-live/index.ts`
- `bench/entry.ts`
- `package.json`

Do not make uncontrolled edits to those files.
If your work requires changes there, document the exact integration points and hand them back.

Initial priority order:
1. live coverage matrix + app completion audit
2. safety / telemetry modules
3. tool / graph mutation skeleton
4. promotion / delivery execution model
5. live scenario implementation wave
6. owner integration + acceptance validation

All contributors should return:
- files changed
- files intentionally not changed
- integration points for owner
- acceptance commands
- risks / follow-ups
```

---

# 5. Short-form dispatch versions

Use these when you want minimal text.

---

## Short Claude dispatch

```md
Please take the Astra coverage/audit/docs role.
Use `docs/investigations/claude-parallel-workplan.md`.
Priority order:
1. Live coverage matrix
2. App completion audit
3. Roadmap/docs/release-readiness refresh
Avoid owning core integration files; hand back integration points instead.
Be concrete and implementation-guiding.
```

---

## Short G1 dispatch

```md
Please take Worker G1.
Use `docs/investigations/gpt54-subagents-task-pack.md`.
Focus on promotion/publish/rollback execution models plus `.github/workflows/bench-opt.yml`.
Do not touch `bench-opt/runner.ts` or `bench-opt/types.ts`.
Return integration notes for the owner.
```

---

## Short G2 dispatch

```md
Please take Worker G2.
Use `docs/investigations/gpt54-subagents-task-pack.md`.
Implement guardrails / red-flags / telemetry / logs / dashboard.
Do not touch `bench-opt/runner.ts` or `bench-opt/types.ts`.
Return structured integration notes.
```

---

## Short G3 dispatch

```md
Please take Worker G3.
Use `docs/investigations/gpt54-subagents-task-pack.md`.
Implement `agent-config/` plus mutate-prompts/context/tools/graph.
Do not touch central runner/types wiring.
Return config shapes and integration notes.
```

---

## Short G4 dispatch

```md
Please take Worker G4.
Use `docs/investigations/gpt54-subagents-task-pack.md`.
Implement isolated new `bench-live` scenarios for top missing surfaces.
Avoid `bench-live/index.ts` and `bench-opt/runner.ts` unless explicitly asked.
Return scenario details and registration notes.
```

---

## Short owner dispatch

```md
Please act as Astra integration owner.
Use `docs/investigations/integration-owner-playbook.md` and `docs/investigations/master-backlog.md`.
Own shared bus files, preserve boundaries, integrate by waves, and run acceptance validation.
```

---

# 6. Recommended send order

If you are dispatching everyone now, send in this order:

1. integration owner kickoff
2. Claude kickoff
3. G2 safety/telemetry
4. G3 tool/graph mutation
5. G1 promotion/delivery
6. G4 live implementation

Reason:
- owner needs boundary control first
- Claude’s coverage/audit should shape later implementation
- G2/G3 are additive and low-conflict
- G1/G4 are more likely to require later owner wiring

---

# 7. Final note

These messages are intentionally explicit because parallel work only helps if the ownership boundaries and acceptance conditions are clear.

If a recipient starts drifting into another role’s territory, re-send the relevant short dispatch plus the task-pack path and reassert the file ownership boundary.
