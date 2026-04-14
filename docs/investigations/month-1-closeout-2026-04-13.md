# Month 1 Closeout — Prove The Current Extension Core

_Last updated: 2026-04-14 (replay note + bench harness fixes)_

Month: Month 1 — Prove The Current Extension Core  
Verdict: `partial`  
Score: `69 / 100`

## What changed

- Month 1 release-proof docs now reflect the canonical popup proof naming: `bench-live/popup-deep-read-proof`.
- Hover and selection-explain policy is now explicit for Month 1: credible browser-backed proof exists, but both remain **optional** rather than required release gates.
- Popup deep-read proof is now written back as credible Month 1 evidence via `bench-live/popup-deep-read-proof`, `pnpm bench:live:lane:popup-proof`, and `pnpm bench:live:lane:learning-loop`.
- Release-facing lane conventions, live coverage matrix, and release checklist are now aligned with current package/registry reality.

## Required evidence

- smoke/live/proof artifacts:
  - canonical popup proof scenario: `bench-live/popup-deep-read-proof`
  - optional popup proof lane: `pnpm bench:live:lane:popup-proof`
  - optional learning-loop lane: `pnpm bench:live:lane:learning-loop` (chains `popup-proof` → `bench-live/vocabulary-srs-smoke` → `bench-live/learning-loop-revisit-smoke` per `package.json`)
  - artifact output path when run: `bench-live-results/<run-id>/`
  - fresh replay summary attached in-repo: **yes** — `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md` (includes harness fixes: relay-only seeding + safer extension popup wait; **re-run** locally for a green `run-id` when needed)
- updated docs:
  - `docs/release-readiness-checklist.md`
  - `docs/investigations/workstream-a-live-coverage-matrix.md`
  - `docs/investigations/workstream-f-live-lane-conventions.md`
  - `docs/investigations/popup-deep-read-state-mapping.md`
  - `docs/investigations/month-1-closeout-2026-04-13.md`
- release checklist sync: yes

## P0 completion

- planned: 4 close-out items
  1. popup deep-read proof canonicalized and written back
  2. hover / selection required-vs-optional policy decided
  3. Month 1 gate total acceptance written
  4. release-facing docs synced
- done: 4
- missed: none in the Month 1 close-out slice

## P1 completion

- planned: 0 additional P1 items in this close-out slice
- done: 0
- deferred:
  - broader Month 2 learning-loop evidence/metrics work
  - any promotion of optional lanes into required gates

## Accomplished

- Article extraction, hover, and selection-explain all have browser-backed proof surfaces in repo.
- Popup deep-read now has a clear canonical proof surface and is documented as credible Month 1 evidence.
- Month 1 release-proof docs now distinguish required gates from optional-but-credible proof more honestly.

## Incomplete

- Month 1 does **not** promote hover/selection to required gates.
- Month 1 does **not** promote popup proof / learning-loop to required release-proof gates.
- A dated replay **procedure + harness notes** for `popup-proof` / `learning-loop` is now attached (`docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md`), but this close-out still does **not** attach a fresh **green** `run-id` by itself — rerun locally after the 2026-04-14 bench fixes to capture one.
- The conservative `partial` verdict remains until an optional **green** replay is recorded alongside Month 2 promotion criteria.

## Carry-over

- item: optional `learning-loop` green replay + gate-ready promotion criteria (full lane = `popup-deep-read-proof` + `vocabulary-srs-smoke` + `learning-loop-revisit-smoke`)
  - owner: Workstream B / Workstream F close-out
  - why it carried: replay documentation and bench harness fixes landed, but **`gate-ready`** still needs a fresh green `run-id` plus flaky ownership parity with `extension-core`
  - whether it blocks next month: it does **not** block Month 2 work entirely, but it **does** block any claim that learning-loop is `gate-ready` or ready to become a required release gate
  - latest allowed close date: Month 2 Week 1

## Claim changes

- strengthened:
  - Astra can now honestly claim browser-backed optional popup deep-read proof exists in repo.
  - Astra can now honestly claim hover and selection-explain have browser-backed optional proof with an explicit Month 1 policy decision.
- unchanged:
  - Required release-proof gates remain `source-core` and `extension-core` only.
  - Platform support claims stay unchanged; no `support-matrix-2026-q2.md` change is required from this close-out.
- downgraded:
  - none

## Risk notes

- Optional lanes are now better documented, but they still do not have required CI semantics or promotion criteria attached.
- Learning-loop proof is credible but still thinner than the translation core and still depends on fresh rerun discipline in Month 2.
- Over-claim risk remains if optional proof is described externally as required or fully gate-ready.

## Decision for next month

- partial freeze
- specifically: rerun `popup-proof` / `learning-loop`, attach a fresh summary, then continue Month 2 learning-loop expansion without re-opening Month 1 gate policy
