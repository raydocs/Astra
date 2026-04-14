# Claude Sequential Task Pack — Next Window

_Last updated: 2026-04-14_
_Primary inputs:_
- `docs/investigations/month-6-closeout-handoff-2026-04-14.md`
- `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`
- `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
- `docs/investigations/month-6-release-claim-audit-2026-04-14.md`
- `plan.md`

> This file is for Claude to execute **one task at a time**.
> It is intentionally narrow. It closes the highest-risk Month 6 carry items without opening a new feature wave.

---

## 1. Current reality

As of **2026-04-14**:

- Month 6 handoff/docs scope is complete, but the overall Month 6 verdict remains **`partial`**.
- Release-facing wording is materially more honest than before.
- The biggest remaining gaps are now concentrated in three places:
  1. privacy authority at the background/router boundary,
  2. glossary contract closure,
  3. transport/fallback disclosure and observability.
- The next window should close those boundary gaps first.
- If a task discovers a blocker, missing policy choice, or a required product decision, Claude must **stop, report, and wait** rather than improvising a broader redesign.

---

## 2. Execution order

Run in this order only:

1. **NW-G-01 — Privacy authority decision / implementation boundary**
2. **NW-G-02 — Glossary contract closure**
3. **NW-G-03 — Fallback disclosure / observability**

Optional follow-up only if justified after the three P0 tasks:

4. **NW-F-04 — Privacy evidence refresh for release wording**

Dependency notes:

- Task 2 should not finalize a request-time glossary contract until Task 1 has clarified the privacy boundary.
- Task 3 should use the boundary and contract established by Tasks 1-2, not invent parallel metadata.
- Do not promote optional live lanes in this pack.

---

## 3. P0 tasks

### Task ID: NW-G-01
Workstream: G
Priority: P0

**Privacy authority decision / implementation boundary**

**Why now**
- The Month 6 inventory says the biggest architecture-level privacy gap is that the background/router is **not** the authoritative guardrail.
- Until this is resolved, privacy language must stay narrower and later routing/glossary work remains structurally soft.

**Scope in/out**
- in:
  - confirm the real privacy boundary for translation requests
  - decide whether background/router becomes authoritative, or caller-owned sanitization remains the explicit policy
  - implement only the minimum boundary enforcement and docs/tests needed for that decision
  - update claim language if the result stays narrower than hoped
- out:
  - a broad privacy-mode expansion
  - new retention/server policy work
  - unrelated translation UX changes

**Likely files/systems**
- `src/entrypoints/background/index.ts`
- `src/utils/providers/router.ts`
- `src/utils/privacy.ts`
- `src/entrypoints/content/page-translate.ts`
- `src/entrypoints/content/subtitle-translate.ts`
- `src/entrypoints/content/translation-context.ts`
- release/docs under `docs/investigations/`, `docs/release-readiness-checklist.md`, and `plan.md` only if status wording must be corrected

**Expected outputs**
- one explicit boundary decision recorded in repo docs
- matching narrow implementation or guardrail cleanup
- tests proving the chosen boundary
- claim wording kept aligned to the actual result

**Validation required**
- unit/integration:
  - privacy sanitization tests
  - background/router request-shape tests
- bench/live:
  - none required unless wording is strengthened beyond the Month 6 boundary
- manual/screenshot:
  - none

**Done when**
- the repo has one documented answer to “who owns privacy sanitization?”
- code and tests match that answer
- docs do not imply a stronger invariant than the code now enforces

**Do not**
- spread privacy responsibility across multiple implicit layers
- claim closure if the task only rephrases docs without matching code/tests
- push through a design guess if a real policy decision is still unresolved

**Stop/report if**
- making background/router authoritative would require a broader migration than this window can absorb
- caller-owned policy cannot be made explicit and enforceable without product/policy sign-off

---

### Task ID: NW-G-02
Workstream: G
Priority: P0

**Glossary contract closure**

**Why now**
- The Month 6 inventory identifies glossary drift as the clearest correctness/claim gap outside privacy.
- The repo has glossary-capable plumbing, but not one canonical request-time contract.

**Scope in/out**
- in:
  - define one glossary source of truth for translation-time use
  - define one serialization format
  - wire one canonical request-time path end to end
  - align cache/test/docs language to that contract
- out:
  - glossary product expansion
  - new glossary UI/editor work
  - broad terminology ranking or suggestion features

**Likely files/systems**
- `src/utils/storage/vocabulary.ts`
- glossary helpers such as `serializeGlossary()` / glossary lookup code
- translation request/context types
- provider prompt builders under `src/utils/providers/*`
- cache key or request-shape logic touched by `terminologyGlossary`
- docs under `docs/investigations/` and release-facing wording if needed

**Expected outputs**
- one documented glossary contract
- one canonical serialization format used in runtime and tests
- one active request-time wiring path
- removal or downgrade of stale wording that implied more than this

**Validation required**
- unit/integration:
  - glossary serialization tests
  - request-shape/provider prompt tests
  - cache-key or invalidation tests if glossary affects caching
- bench/live:
  - none required unless release wording is strengthened
- manual/screenshot:
  - none

**Done when**
- there is one glossary serialization format in code/tests/docs
- one source of truth feeds one request-time path
- no major docs still imply “fully wired glossary” unless it is now true

**Do not**
- keep dual glossary formats alive “for compatibility” unless explicitly documented as temporary
- add glossary UX scope to compensate for contract drift
- leave tests using a different format from runtime

**Stop/report if**
- Task 1 leaves the request boundary unresolved in a way that blocks safe glossary wiring
- multiple plausible glossary authorities remain and choosing one requires product/policy direction

---

### Task ID: NW-G-03
Workstream: G
Priority: P0

**Fallback disclosure / observability**

**Why now**
- The Month 6 inventory says routing behavior is more mature than the disclosure story around it.
- Support/operators still lack one canonical answer to “which transport handled this request?”

**Scope in/out**
- in:
  - make transport/fallback handling visible in one canonical support/operator path
  - tighten routing metadata naming/ownership if needed
  - document what is exposed, where, and with what limits
  - ensure failure/fallback summaries stay consistent with actual router behavior
- out:
  - redesigning routing policy
  - new provider fallback classes beyond small correctness fixes
  - broad user-facing analytics work

**Likely files/systems**
- `src/utils/providers/router.ts`
- `src/entrypoints/background/index.ts`
- local usage / history / diagnostics surfaces that already record routing metadata
- relevant support/runbook docs under `docs/investigations/`
- release docs only if claim wording changes

**Expected outputs**
- one canonical observability path for transport/fallback answers
- clearer routing metadata contract
- docs/runbook update for support/operator use
- tests for direct / relay / fallback reporting

**Validation required**
- unit/integration:
  - router metadata tests
  - background response/recording tests
- bench/live:
  - none required unless the task changes release-facing wording
- manual/screenshot:
  - only if a visible support/debug surface is touched

**Done when**
- someone can answer “direct, relay, or fallback?” from one canonical place without reading raw logs
- docs describe the meaning and limits of that signal honestly
- metadata naming does not drift across router/background/support surfaces

**Do not**
- turn this into a broad telemetry project
- promise user-visible disclosure everywhere if the task only lands operator/support visibility
- change routing semantics unless needed to fix a direct correctness bug discovered in scope

**Stop/report if**
- exposing the right signal requires a product decision between operator-only vs end-user-visible disclosure
- current metadata is too inconsistent to close without reopening Task 1 or Task 2 assumptions

---

## 4. Optional follow-up tasks

### Task ID: NW-F-04
Workstream: F
Priority: P1 (conditional)

**Privacy evidence refresh for release wording**

Run this only if Tasks 1-3 strengthen release-facing privacy/routing/glossary wording, or if an RC needs fresh artifacts.

**Why now**
- The Month 6 handoff explicitly says fresh privacy artifacts are only needed if claims are strengthened.

**Scope in/out**
- in:
  - rerun the existing privacy proof paths
  - attach dated artifact references to the updated wording
  - sync release-facing docs
- out:
  - inventing new privacy scenarios without a claim need
  - promoting optional lanes to required by ceremony alone

**Likely files/systems**
- `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
- `docs/release-readiness-checklist.md`
- release-facing docs touched by Tasks 1-3
- existing privacy live scenarios already named in Month 6 docs

**Expected outputs**
- dated artifact references
- docs synced to the stronger wording

**Validation required**
- bench/live:
  - existing privacy proof commands only

**Done when**
- stronger wording is backed by fresh artifact paths

**Do not**
- run this as routine ceremony if the claims stayed bounded

---

## 5. Reusable Claude prompt wrapper

```text
Please execute task <TASK ID> from `docs/investigations/claude-sequential-task-pack-next-window-2026-04-14.md`.

Rules:
- execute only this task
- do not expand scope
- keep status language honest and evidence-backed
- if you discover a blocker, missing policy decision, or required product choice, stop and report it instead of improvising a broader redesign
- update the docs/tests/artifacts required by the task
- at the end, report:
  1. files changed
  2. commands run
  3. artifacts produced
  4. whether the task is done, partial, or blocked
  5. the next recommended task
```

---

## 6. Start recommendation

This pack is designed to start with:

- **`NW-G-01` — Privacy authority decision / implementation boundary**

Reason:
- it resolves the highest-risk architecture ambiguity first,
- it sets the safe boundary for glossary wiring,
- and it keeps fallback/observability work from building on an unclear contract.
