# Month 6 — Final closeout + next-window handoff

_Task **`M6-FH-03`**_

**Task status:** complete for the Month 6 handoff/docs scope. Month 6 itself remains `partial`.

> **Update (next window, 2026-04-14):** the deferred privacy-authority item from this handoff is now resolved narrowly in `docs/investigations/privacy-authority-decision-2026-04-14.md`, the deferred glossary contract item is now resolved narrowly in `docs/investigations/glossary-contract-2026-04-14.md`, and the deferred fallback disclosure / observability item now has a canonical popup-backed local support/operator path in `docs/investigations/translation-routing-observability-2026-04-14.md`. This handoff still represents the Month 6 closeout snapshot.

## Verdict

**Month 6 verdict: `partial`**

Reason:

- the inventory, claim audit, blocking release checklist, and final evidence pack are now in place
- but Month 6 intentionally stopped at **honest boundary-setting**, not a new privacy/routing/glossary implementation wave
- the strongest remaining gaps are documented, not closed

## Accomplished in Month 6

1. **Privacy / routing / failure inventory exists and is concrete**
   - `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
   - names actual guardrails, weak surfaces, fallback classes, failure categories, glossary drift, and proof pointers

2. **Release-facing claim audit exists and is concrete**
   - `docs/investigations/month-6-release-claim-audit-2026-04-14.md`
   - resolves relay-only / local-only / fully-wired-glossary wording drift

3. **Release checklist is now a clearer blocking document**
   - `docs/release-readiness-checklist.md`
   - Gate 4 core vs conditional review split is explicit
   - Month 6 privacy/routing/glossary policy is explicit

4. **Capability / support / README wording is aligned to evidence depth**
   - `docs/capability-matrix-v2.md`
   - `docs/investigations/support-matrix-2026-q2.md`
   - `README.md`

5. **The final evidence pack and roadmap correction now exist**
   - `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`
   - `plan.md`

## Deferred

These were intentionally left for the next window rather than hidden under stronger language:

1. **Authoritative privacy guardrail at the background/router boundary**
2. **Canonical glossary / terminology request-time wiring**
3. **User/operator-visible transport and fallback disclosure improvements**
4. **Promotion of any remaining optional live slices into required lanes beyond the current `learning-loop`, `document-proof`, `youtube-proof`, and `youtube-holdout` set**
5. **Any stronger privacy live-evidence bundle beyond the already-documented proof paths**

## Unproven / must stay bounded

1. **Local-only translation**
2. **End-to-end secrecy across all surfaces**
3. **Release-grade glossary enforcement**
4. **Broad in-page video parity**
5. **Mobile web or iOS parity with desktop**
6. **Unscoped learning / reader / video optional lanes as required release gates beyond the current scoped required lanes**

## Blocked / release constraints

These are not implementation blockers for the handoff. They are **release-claim blockers**:

1. If an RC strengthens privacy/routing/glossary wording, it must attach fresh privacy artifacts or downgrade the wording.
2. If an RC touches reader/video/control-plane/mobile claim families, the matching Gate 4B evidence review becomes blocking.
3. If required lanes fail, no Month 6 documentation override is allowed to turn that into a pass.

## Required evidence already in place

- Release checklist: `docs/release-readiness-checklist.md`
- Capability matrix: `docs/capability-matrix-v2.md`
- Support matrix: `docs/investigations/support-matrix-2026-q2.md`
- Month 6 inventory: `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
- Month 6 claim audit: `docs/investigations/month-6-release-claim-audit-2026-04-14.md`
- Final evidence pack index: `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`
- Roadmap status correction: `plan.md`

## Next-window candidates (priority order)

1. **Privacy authority decision**
   - Either re-sanitize at background/router as the system invariant,
   - or explicitly freeze caller-owned sanitization as policy and keep claims permanently narrower.

2. **Glossary contract closure**
   - one serialization format
   - one request-time wiring path
   - one documented source of truth

3. **Fallback disclosure / observability**
   - make it easier for support/operators to answer which transport handled a request

4. **Privacy proof promotion only if the claim needs it**
   - use the existing privacy live scenarios to attach dated RC artifacts
   - do not run this as ceremony unless the RC strengthens the claim

5. **Optional-lane promotion discipline**
   - only after CI ownership, failure ownership, and flaky tracking are in place

## Start state for the next planning cycle

A new planning cycle should assume:

- the repo has materially better evidence and claim discipline than at the start of the window
- several subsystems are implemented and replayable in scoped slices
- the overall release posture is still **not** “everything is proved equally”
- the biggest remaining work is now concentrated in a smaller set of explicit boundary gaps, not broad unknowns
