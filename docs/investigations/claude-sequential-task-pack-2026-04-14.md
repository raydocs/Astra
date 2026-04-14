# Claude Sequential Task Pack — Astra Roadmap Execution

_Last updated: 2026-04-14_
_Source of truth: `plan.md` (especially §11, §13L, §14, §16B, §16C)_

> This document is written to be handed to Claude **one task at a time**.
> It converts the roadmap into a sequential execution backlog with explicit scope, validation, and done conditions.
> Use it as the operational layer under `plan.md`, not as a replacement for `plan.md`.

---

## 0. Current reality from `plan.md`

As of `2026-04-14`, Astra is **not “done”**.

The evidence-backed position is:

- Month 1 verdict is `partial` (`69/100`)
- Month 2-6 are still `unverified` at the month-closeout level
- Learning loop is **mostly real**, but not yet fully `gate-ready`
- Owned reading is **partial**: reader surfaces exist, but the unified model/queue/revisit line is not fully landed
- Video/subtitle is **real but narrow**: strongest on YouTube and subtitle-file paths, not broad parity
- Control-plane is **carry-but-acceptable**, but mobile/iOS is still bridge-first / experimental rather than parity

That means Claude should optimize for:

1. closing evidence gaps,
2. tightening the learning loop,
3. landing the owned-reading model,
4. hardening the strongest video/subtitle paths,
5. reducing control-plane claim risk,
6. and only then tightening release/claim discipline.

---

## 1. How to use this file

### Operating rule

- Run **one task at a time**.
- Do **not** start the next task until the previous task meets its `Done when` section.
- If a task discovers a blocker that invalidates later tasks, Claude should:
  1. stop,
  2. summarize the blocker,
  3. propose a plan correction,
  4. wait for confirmation.

### Priority rule

- `P0` tasks are on the critical path.
- `P1` tasks only start after all upstream `P0` tasks for the same phase are complete.
- `P2` tasks are backlog-only unless explicitly promoted.

### Output rule for Claude

For each completed task, Claude should always return:

1. files changed,
2. tests / bench / live commands run,
3. artifacts produced,
4. docs updated,
5. whether the task is fully done or still partial,
6. any carry-over created for the next task.

---

## 2. Recommended execution order

### Phase 1 — Repair Month 1 / make Month 2 start conditions real

1. `M1-BF-01` Fresh popup-proof + learning-loop replay summary
2. `M2-B-01` Popup deep-read v1 state-machine hardening
3. `M2-B-02` Source-context propagation into vocab/review
4. `M2-BH-03` Study-progress UI consistency
5. `M2-B-04` Revisit v1 path + smoke
6. `M2-F-05` Learning-loop evidence registry + Month 2 closeout prep

### Phase 2 — Land owned reading as a real product line

7. `M3-C-01` Owned reading item schema v1
8. `M3-C-02` Saved reading queue v1
9. `M3-BC-03` Reader/progress/revisit mapping
10. `M3-F-04` Reader/revisit proof + docs sync

### Phase 3 — Make video/subtitle credible, not broad-but-soft

11. `M4-D-01` Video/subtitle support inventory + claim boundaries
12. `M4-D-02` YouTube + one secondary adapter hardening
13. `M4-CD-03` Subtitle-reader → learning-loop → revisit chain
14. `M4-F-04` Video/subtitle release-evidence sync

### Phase 4 — Reduce control-plane claim drag

15. `M5-E-01` Account / usage / summary source-of-truth alignment
16. `M5-E-02` Lifecycle runbook + proof
17. `M5-E-03` Mobile web / iOS bridge wording + evidence tightening

### Phase 5 — Freeze, tighten, publish honestly

18. `M6-G-01` Privacy / routing / failure inventory
19. `M6-F-02` Release gate tightening + claims audit
20. `M6-FH-03` Final evidence pack + handoff

---

## 3. Task pack

---

## Task ID: M1-BF-01
Month: Month 1 closeout repair
Workstream: B + F
Priority: P0

Why now:
- `plan.md` now explicitly says Month 1 is `partial` because popup-proof / learning-loop evidence freshness is not attached as a fresh in-repo replay summary.
- Without this, Month 2 can proceed technically, but cannot honestly claim `gate-ready` learning-loop progress.

Scope:
- in:
  - rerun the canonical popup proof and learning-loop live lanes
  - capture a fresh green summary or a precise failure report
  - write the replay summary back into repo docs
  - update Month 1 closeout if the replay changes status
- out:
  - redesigning popup UI
  - adding new learning-loop features
  - promoting optional lanes to required gates

Files / systems likely touched:
- `docs/investigations/month-1-closeout-2026-04-13.md`
- `docs/release-readiness-checklist.md`
- `docs/investigations/workstream-a-live-coverage-matrix.md`
- optionally a new replay note under `docs/investigations/`
- `bench-live/scenarios/popup-deep-read-proof.ts`
- package scripts / live lane docs if naming drift is found

Expected outputs:
- fresh replay note for:
  - `pnpm bench:live:lane:popup-proof`
  - `pnpm bench:live:lane:learning-loop`
- docs update linking fresh run result and artifact path
- closeout note updated from stale/unknown to current reality

Validation required:
- unit/integration:
  - none required unless the replay reveals a fixable regression
- bench/live:
  - `pnpm bench:live:lane:popup-proof`
  - `pnpm bench:live:lane:learning-loop`
- manual/screenshot:
  - artifact path under `bench-live-results/<run-id>/`

Done when:
- repo contains a dated replay summary with artifact paths
- Month 1 closeout no longer says evidence freshness is unknown
- docs and lane names all point to canonical scenario IDs

Do not:
- broaden Month 1 scope
- treat a skipped run as a green replay

---

## Task ID: M2-B-01
Month: Month 2
Workstream: B
Priority: P0

Why now:
- Popup deep-read is the front door of the learning loop.
- Current code is real, but `plan.md` still treats it as a main stability risk and tie-breaker.

Scope:
- in:
  - audit and tighten popup deep-read state transitions
  - reduce duplicated or conflicting states around explain/save/speak/select
  - make fallback behavior clear when study context is thin or empty
- out:
  - adding popup review mode
  - adding auto-extract vocabulary features
  - large visual redesign

Files / systems likely touched:
- `src/entrypoints/popup/App.tsx`
- `src/utils/storage/study-progress.ts`
- popup-related tests
- popup proof/smoke docs if behavior contracts change

Expected outputs:
- popup state machine cleanup
- tests covering the intended transitions
- updated state-mapping doc if needed

Validation required:
- unit/integration:
  - popup component / state tests
- bench/live:
  - `pnpm bench:live -- --scenario bench-live/popup-deep-read-proof`
- manual/screenshot:
  - popup explain/save/speak path screenshots if UI changed materially

Done when:
- explain/save/speak/select states have one coherent model
- empty or partial study-context path has explicit fallback behavior
- popup proof still passes after the cleanup

Do not:
- expand into new surfaces
- quietly change source-context semantics without documenting it

---

## Task ID: M2-B-02
Month: Month 2
Workstream: B
Priority: P0

Why now:
- `plan.md` says Month 2 depends on stable source-context fields before owned reading can be modeled cleanly.
- Popup → vocab → review is currently real, but still needs stronger field consistency.

Scope:
- in:
  - make sure saved items retain stable source metadata
  - render the right source label, snippet, article excerpt, and page identity in vocab/review
  - reconcile any field drift between popup save shape and review display shape
- out:
  - building a new review algorithm
  - adding new export formats

Files / systems likely touched:
- `src/entrypoints/popup/App.tsx`
- `src/entrypoints/vocabulary/VocabularyApp.tsx`
- `src/entrypoints/vocabulary/ReviewMode.tsx`
- `src/utils/storage/vocabulary.ts`
- related tests

Expected outputs:
- stronger source-context persistence contract
- vocab/review UI showing consistent source metadata
- tests for save → recover → review source-context flow

Validation required:
- unit/integration:
  - vocabulary storage + review rendering tests
- bench/live:
  - popup proof or learning-loop lane rerun
- manual/screenshot:
  - one saved popup item visible in vocab and review with source context

Done when:
- popup-saved content can be traced in vocab and review without guessing
- source labels/snippets are consistent across at least popup + vocab + review
- no undocumented schema drift remains

Do not:
- invent a second source-context system
- hide missing fields with UI-only workarounds

---

## Task ID: M2-BH-03
Month: Month 2
Workstream: B + H
Priority: P0

Why now:
- `plan.md` explicitly says study progress must become user-visible and consistent across surfaces before revisit can stabilize.

Scope:
- in:
  - define the progress counters and completed-step ordering clearly
  - surface progress in popup and at least one downstream surface
  - make next-step hints understandable to a user
- out:
  - daily-stats dashboard expansion
  - advanced SRS redesign

Files / systems likely touched:
- `src/utils/storage/study-progress.ts`
- `src/entrypoints/popup/App.tsx`
- `src/entrypoints/vocabulary/VocabularyApp.tsx`
- `src/entrypoints/vocabulary/ReviewMode.tsx`
- docs describing progress rules

Expected outputs:
- stable progress definitions
- UI surfacing in popup + one downstream surface
- docs for counting rules / ordering

Validation required:
- unit/integration:
  - study-progress logic tests
- bench/live:
  - learning-loop lane if it depends on progress visibility
- manual/screenshot:
  - screenshots showing the same page/item progress from two surfaces

Done when:
- explained / saved / reviewed states have documented counting rules
- popup and one downstream surface do not contradict each other
- revisit can depend on this progress model without ambiguity

Do not:
- add vague “progress-like” UI without defining semantics
- create a per-surface progress dialect

---

## Task ID: M2-B-04
Month: Month 2
Workstream: B
Priority: P0

Why now:
- `plan.md` says Month 2 is not done until there is at least one replayable `page/article -> explain -> save -> review -> revisit` path.
- Revisit is currently weaker than explain/save/review.

Scope:
- in:
  - define the first supported revisit entry path
  - make one revisit path work end to end
  - add smoke/replay coverage for it
- out:
  - a full multi-surface resume center
  - complicated staleness modeling

Files / systems likely touched:
- popup / vocabulary / review / reading-history surfaces
- `src/utils/storage/reading-history.ts`
- `src/utils/storage/study-progress.ts`
- `bench-live` learning-loop scenario(s)
- docs for supported revisit path

Expected outputs:
- one supported revisit flow
- replayable scenario or smoke lane
- docs naming the supported revisit contract and boundaries

Validation required:
- unit/integration:
  - storage lookup / reopen logic tests
- bench/live:
  - `pnpm bench:live:lane:learning-loop`
  - or a dedicated revisit scenario if added
- manual/screenshot:
  - one saved item reopening into the intended context

Done when:
- at least one revisit path is documented, testable, and replayable
- the reopened context preserves enough source/progress information to be useful
- Month 2 can point to a concrete revisit artifact

Do not:
- say “revisit exists” if it is only a loose history entry
- over-design a general revisit system before one good path exists

---

## Task ID: M2-F-05
Month: Month 2
Workstream: F
Priority: P0

Why now:
- Month 2 can only count as complete if the learning loop is not just implemented, but `gate-ready`.

Scope:
- in:
  - create or update the Month 2 evidence registry
  - sync learning-loop docs, metrics, release checklist, and closeout structure
  - make it obvious what is proved vs implemented vs still partial
- out:
  - adding net-new features
  - expanding required lanes beyond what the evidence supports

Files / systems likely touched:
- `docs/release-readiness-checklist.md`
- `docs/investigations/`
- `plan.md` only if a status correction is required
- learning-loop docs/matrix files

Expected outputs:
- Month 2 evidence registry
- Month 2 closeout skeleton or full closeout
- release-policy note for learning-loop required/optional status

Validation required:
- unit/integration:
  - none directly, unless docs reveal missing checks
- bench/live:
  - link the exact command outputs already used by upstream tasks
- manual/screenshot:
  - none beyond linked artifacts

Done when:
- Month 2 has a real evidence registry
- someone reading only docs can see what is implemented, proved, and gate-ready
- no over-claim remains in Month 2 status language

Do not:
- mark Month 2 as pass without attached evidence paths
- let docs lag behind the shipped behavior

---

## Task ID: M3-C-01
Month: Month 3
Workstream: C
Priority: P0

Why now:
- `plan.md` says owned reading cannot be treated as a product line until there is a unified item model.
- This is the main missing abstraction between current reader surfaces and a coherent system.

Scope:
- in:
  - define owned reading item schema v1
  - define identity / dedupe / metadata / progress fields
  - map article / pdf / epub / subtitle-file into the model
- out:
  - implementing full queue UI in the same task
  - adding new reader types

Files / systems likely touched:
- reader/storage/model files under `src/utils/storage/*` and reader entrypoints
- docs for schema + migration rules
- tests for identity stability

Expected outputs:
- schema + mapping doc
- implementation of the base item model
- tests for item identity / metadata persistence

Validation required:
- unit/integration:
  - schema / identity / mapping tests
- bench/live:
  - none required if this task is model-only, but downstream tasks must use it
- manual/screenshot:
  - none required unless a visible UI path is added

Done when:
- article/pdf/epub/subtitle-file can all map into one documented item model
- identity and progress semantics are explicit
- downstream queue/revisit work can build on the model without inventing new fields

Do not:
- let each reader keep its own hidden identity rules
- mix schema design with broad UI redesign

---

## Task ID: M3-C-02
Month: Month 3
Workstream: C
Priority: P0

Why now:
- The model becomes real only when users can see and reopen saved reading assets through one queue.

Scope:
- in:
  - implement minimum saved-reading queue
  - support recent / saved / in-progress classification
  - allow resume from queue into supported source types
- out:
  - advanced sorting/filtering beyond basics
  - visual redesign of all reader surfaces

Files / systems likely touched:
- queue UI surface(s)
- storage for owned reading items
- article/pdf/epub/subtitle open/resume handlers
- docs for queue semantics

Expected outputs:
- queue UI or equivalent entry surface
- queue storage behavior
- docs on supported source types and statuses

Validation required:
- unit/integration:
  - queue storage / reopen logic tests
- bench/live:
  - at minimum one reopen path should be bench/live-compatible downstream
- manual/screenshot:
  - screenshots of recent / saved / in-progress states

Done when:
- one queue can reopen at least two source types
- queue states are documented and observable
- users no longer need to know reader-specific internals to resume

Do not:
- build queue UI before the item model is explicit
- hide unsupported source types under generic labels

---

## Task ID: M3-BC-03
Month: Month 3
Workstream: B + C
Priority: P0

Why now:
- Queue alone is not enough; owned reading must preserve learning assets and progress semantics.

Scope:
- in:
  - connect owned reading items to study progress and learning assets
  - define how review/vocab can point back to owned reading sources
  - make article + at least two reader surfaces reopen with retained metadata/progress
- out:
  - new review algorithms
  - all-source universal back-linking in one pass

Files / systems likely touched:
- owned reading model + queue files
- `src/utils/storage/study-progress.ts`
- vocabulary/review source linkage code
- reader entrypoints

Expected outputs:
- progress + source mapping implementation
- at least one back-link or reopen-from-source flow
- docs for mapping rules

Validation required:
- unit/integration:
  - source-linking / progress mapping tests
- bench/live:
  - reader/revisit scenarios downstream
- manual/screenshot:
  - proof that metadata/progress survives reopen for multiple source types

Done when:
- owned reading items preserve source identity, title/source metadata, and progress
- at least two source types can be reopened with recognizable continuity
- review/vocab no longer feel disconnected from owned reading assets

Do not:
- ship queue without continuity semantics
- make source-linking implicit or undocumented

---

## Task ID: M3-F-04
Month: Month 3
Workstream: F
Priority: P0

Why now:
- Month 3 cannot pass on code alone; the reader/revisit line needs real proof and honest docs.

Scope:
- in:
  - add or tighten reader/revisit smoke/live coverage
  - update support/claim docs for reader surfaces
  - write Month 3 closeout / evidence registry inputs
- out:
  - broad new reader feature work

Files / systems likely touched:
- `bench-live/scenarios/*reader*`
- reader-related docs/matrix files
- release checklist / support matrix

Expected outputs:
- reader/revisit artifacts
- doc sync for reader support claims
- Month 3 evidence registry or closeout inputs

Validation required:
- unit/integration:
  - none unless proof work uncovers missing guards
- bench/live:
  - PDF / EPUB / revisit commands defined by current repo lanes
- manual/screenshot:
  - linked artifacts

Done when:
- Month 3 can point to at least 3 replayable reader/revisit artifacts
- docs no longer imply a stronger owned-reading product line than evidence supports

Do not:
- write broad support claims without artifacts
- call Month 3 done if queue/model exist but proof does not

---

## Task ID: M4-D-01
Month: Month 4
Workstream: D
Priority: P0

Why now:
- `plan.md` says Astra must not chase breadth before support boundaries are explicit.
- Video/subtitle currently has real code, but proof and claim breadth are uneven.

Scope:
- in:
  - inventory all adapters
  - label supported / best-effort / code-only
  - define major failure modes per adapter
  - update claim-boundary docs
- out:
  - implementing new adapters
  - broad platform expansion

Files / systems likely touched:
- `src/entrypoints/content/video-platforms/*`
- support matrix / docs / release checklist
- possibly adapter notes under `docs/investigations/`

Expected outputs:
- authoritative adapter inventory
- failure-mode matrix
- claim-boundary updates

Validation required:
- unit/integration:
  - none required unless inventory reveals broken classification logic
- bench/live:
  - link current adapter proof state
- manual/screenshot:
  - none required beyond proof references

Done when:
- every adapter has a support label and proof level
- support matrix language is tighter than current wishful breadth
- later hardening tasks know which adapters actually matter

Do not:
- classify an adapter as supported on code presence alone
- let “best-effort” collapse into “supported” wording

---

## Task ID: M4-D-02
Month: Month 4
Workstream: D
Priority: P0

Why now:
- The plan explicitly says Month 4 should harden YouTube + one secondary adapter, not spread effort thin.

Scope:
- in:
  - stabilize YouTube smoke and one chosen secondary adapter
  - cover the main failure classes that actually matter
  - reduce DOM-drift / subtitle-unavailable fragility where possible
- out:
  - third-adapter expansion
  - new platform scouting

Files / systems likely touched:
- `src/entrypoints/content/video-platforms/youtube.ts`
- one chosen secondary adapter file
- corresponding tests / smoke scenarios
- adapter notes docs

Expected outputs:
- hardened YouTube path
- one hardened secondary adapter path
- clearer adapter-specific failure notes

Validation required:
- unit/integration:
  - adapter-specific tests if feasible
- bench/live:
  - YouTube smoke
  - one secondary adapter smoke
- manual/screenshot:
  - linked artifacts for both adapters

Done when:
- two adapters have replayable, trustworthy smoke coverage
- common failure modes are either handled or explicitly documented
- Month 4 does not depend on vague “video generally works” language

Do not:
- add a third adapter to pad breadth
- confuse subtitle-file proof with live site adapter proof

---

## Task ID: M4-CD-03
Month: Month 4
Workstream: C + D
Priority: P0

Why now:
- File subtitles are one of Astra’s stronger ways to turn video learning into a controlled product path.
- This is the bridge between video/subtitle and the main learning loop.

Scope:
- in:
  - connect subtitle-reader import/explain/save/review/revisit path cleanly
  - align subtitle source-context with vocab/review semantics
  - ensure subtitle items fit the owned-reading model
- out:
  - advanced media-specific progress UX
  - broad video UI redesign

Files / systems likely touched:
- `src/entrypoints/subtitle-reader/*`
- vocabulary/review source-context code
- owned reading item / queue code
- subtitle smoke/live scenarios

Expected outputs:
- subtitle-reader learning-chain support
- revisit path from subtitle content
- docs for subtitle-file supported chain

Validation required:
- unit/integration:
  - subtitle source-context / save / reopen tests
- bench/live:
  - subtitle-file basic scenario + any revisit scenario added
- manual/screenshot:
  - artifact showing subtitle item entering learning assets

Done when:
- subtitle file can enter explain/save/review/revisit in one coherent chain
- review/vocab can tell the user the item came from subtitle-reader
- subtitle-file no longer feels like a sidecar surface

Do not:
- treat subtitle-reader as unrelated to the owned-reading model
- land UI-only polish without end-to-end learning continuity

---

## Task ID: M4-F-04
Month: Month 4
Workstream: F
Priority: P0

Why now:
- After Month 4 hardening, docs and release policy must stop making generic video claims.

Scope:
- in:
  - update support matrix and release checklist for video/subtitle
  - make supported / best-effort / experimental boundary explicit
  - prepare Month 4 evidence registry / closeout inputs
- out:
  - new feature work

Files / systems likely touched:
- `docs/investigations/support-matrix-2026-q2.md`
- `docs/release-readiness-checklist.md`
- Month 4 evidence notes under `docs/investigations/`

Expected outputs:
- docs sync for video/subtitle claim boundaries
- evidence links for the two hardened adapters + subtitle path
- closeout-ready note

Validation required:
- unit/integration:
  - none directly
- bench/live:
  - link the adapter and subtitle artifacts
- manual/screenshot:
  - none beyond artifact links

Done when:
- there is no generic “supports video” wording without classification
- release-facing docs match actual proof depth
- Month 4 can be judged honestly

Do not:
- strengthen claims beyond the hardened adapters and subtitle-file path
- leave docs in a broader state than the code/proof warrants

---

## Task ID: M5-E-01
Month: Month 5
Workstream: E
Priority: P0

Why now:
- The plan says control-plane success is not “more backend,” but “less product drag.”
- Account / usage / summary wording still needs source-of-truth alignment across surfaces.

Scope:
- in:
  - align wording and state meaning across extension, web cloud, and any mobile-web surface
  - define source-of-truth for account/usage/plan labels
  - remove contradictory copy
- out:
  - new billing/account feature expansion

Files / systems likely touched:
- `src/entrypoints/popup/App.tsx`
- `src/entrypoints/options/OptionsApp.tsx`
- `web/*`
- control-plane docs and wording notes

Expected outputs:
- aligned wording/source note
- UI copy fixes across relevant surfaces
- docs describing the source-of-truth contract

Validation required:
- unit/integration:
  - tests if state formatting logic changes materially
- bench/live:
  - account/web proof commands if present in repo
- manual/screenshot:
  - screenshots of aligned wording across surfaces

Done when:
- a user does not get conflicting account/usage/plan messages across surfaces
- docs say where each visible value comes from
- control-plane no longer looks more mature in one surface than another by wording accident

Do not:
- expand account features under the banner of “alignment”
- leave source-of-truth implicit

---

## Task ID: M5-E-02
Month: Month 5
Workstream: E
Priority: P0

Why now:
- Lifecycle reliability is one of the main remaining control-plane credibility gaps.

Scope:
- in:
  - harden export/delete/repair/revoke user-facing states and runbook
  - add or confirm proof for at least two high-risk lifecycle flows
  - document operator guidance for failure handling
- out:
  - new lifecycle authorities or migrations

Files / systems likely touched:
- control-plane client + worker files
- lifecycle docs / runbook
- any lifecycle smoke scenarios

Expected outputs:
- lifecycle runbook
- clearer state/error UI
- proof for at least two lifecycle flows

Validation required:
- unit/integration:
  - lifecycle state / error tests where practical
- bench/live:
  - lifecycle proof commands if available
- manual/screenshot:
  - evidence of destructive/non-destructive flows

Done when:
- lifecycle failure paths are explainable
- at least two high-risk flows have replayable proof
- the runbook lets an operator explain current status without tribal knowledge

Do not:
- treat a happy-path clickthrough as sufficient proof
- leave destructive operations undocumented

---

## Task ID: M5-E-03
Month: Month 5
Workstream: E
Priority: P0

Why now:
- `plan.md` explicitly says mobile/iOS should stay honest and narrow.
- Current risk is over-claim, not absence of all implementation.

Scope:
- in:
  - verify mobile web and iOS bridge wording against actual supported behavior
  - tighten support matrix / docs / checklists
  - add evidence pointers for what is actually supported
- out:
  - native-mobile parity work
  - expansion of mobile claims

Files / systems likely touched:
- mobile/iOS docs
- support matrix
- release checklist
- iOS README / bridge notes if wording drift exists

Expected outputs:
- narrowed and honest mobile/iOS wording
- evidence pointers for bridge-first behavior
- claim-risk reduction

Validation required:
- unit/integration:
  - none directly unless wording depends on behavior changes
- bench/live:
  - mobile-web/iOS bridge checks if current repo supports them
- manual/screenshot:
  - screenshots / logs if behavior proof is captured

Done when:
- docs do not imply parity where only bridge-first behavior exists
- mobile/web/cloud claim boundaries are readable and consistent
- Month 5 can say “carry-but-acceptable” with evidence, not optimism

Do not:
- broaden the claim surface
- use TODO plans as current support evidence

---

## Task ID: M6-G-01
Month: Month 6
Workstream: G
Priority: P0

Why now:
- The final window should start from an inventory, not scattered fixes.

Scope:
- in:
  - inventory privacy assertions, routing/fallback classes, failure categories, glossary drift
  - identify highest-risk gaps
  - document which surfaces are protected vs weak
- out:
  - broad new product work
  - deep implementation wave unless the inventory reveals a critical missing guardrail

Files / systems likely touched:
- `src/utils/providers/*`
- `src/utils/translate/*`
- `src/entrypoints/background/index.ts`
- docs under `docs/investigations/`

Expected outputs:
- privacy / routing / failure inventory
- prioritized gap list
- Month 6 quality map

Validation required:
- unit/integration:
  - none required unless inventory turns into a targeted fix
- bench/live:
  - link any existing relevant proof
- manual/screenshot:
  - none required

Done when:
- the team can state which guardrails exist and which do not
- Month 6 quality work has a concrete map
- no one needs to rely on memory to describe the biggest risk gaps

Do not:
- confuse inventory with closure
- claim guardrails exist where only informal code patterns exist

---

## Task ID: M6-F-02
Month: Month 6
Workstream: F
Priority: P0

Why now:
- The plan’s final win condition is honest release discipline, not more features.

Scope:
- in:
  - tighten release checklist into a blocking structure
  - audit support matrix / capability matrix / README / release notes against actual proof
  - downgrade or remove claims that cannot be supported
- out:
  - new feature work
  - speculative claim expansion

Files / systems likely touched:
- `docs/release-readiness-checklist.md`
- `docs/capability-matrix-v2.md`
- `docs/investigations/support-matrix-2026-q2.md`
- README / release notes files if present

Expected outputs:
- claim audit
- tightened release checklist
- downgraded or removed unsupported claims

Validation required:
- unit/integration:
  - none directly
- bench/live:
  - every required claim should point to a proof path or be downgraded
- manual/screenshot:
  - none beyond artifact linking

Done when:
- required claims have proof references
- unproven claims are no longer left at full strength
- release judgment is based on evidence, not confidence

Do not:
- keep strong claims for morale reasons
- leave required/optional semantics vague

---

## Task ID: M6-FH-03
Month: Month 6
Workstream: F + H
Priority: P0

Why now:
- The roadmap only becomes reusable if the final evidence pack and handoff exist.

Scope:
- in:
  - assemble final evidence pack
  - update roadmap/support/release/capability documents
  - write final closeout + next-window handoff
- out:
  - opening a new product narrative

Files / systems likely touched:
- `plan.md`
- `docs/release-readiness-checklist.md`
- `docs/capability-matrix-v2.md`
- support matrix docs
- final closeout / handoff note under `docs/investigations/`

Expected outputs:
- final evidence pack
- final closeout memo
- next-window candidate list

Validation required:
- unit/integration:
  - none directly
- bench/live:
  - summarize final required-lane status
- manual/screenshot:
  - none beyond linked artifacts

Done when:
- someone new can understand accomplished / deferred / unproven / blocked from docs alone
- the next planning cycle can start from evidence rather than memory
- roadmap status is honest and current

Do not:
- call the window finished without an evidence pack
- leave next-window inputs as vague brainstorm notes

---

## 4. Suggested prompt wrapper for Claude

Use this template when sending one task at a time:

```text
Please execute task <TASK ID> from `docs/investigations/claude-sequential-task-pack-2026-04-14.md`.

Rules:
- follow the task strictly
- do not expand scope
- if blocked, stop and report the blocker instead of improvising a larger redesign
- always update docs/tests/artifacts required by the task
- at the end, report:
  1. files changed
  2. commands run
  3. artifacts produced
  4. whether the task is done or partial
  5. what the next recommended task is
```

---

## 5. First task to run now

If starting immediately, begin with:

- **`M1-BF-01` — Fresh popup-proof + learning-loop replay summary**

Reason:
- it resolves the current evidence-freshness gap,
- it keeps Month 2 honest,
- and it prevents later learning-loop work from being built on a stale status claim.
