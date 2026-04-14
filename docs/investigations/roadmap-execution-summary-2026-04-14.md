# Roadmap execution summary — Month 1 to Month 6 + next-window P0

_Last updated: 2026-04-14_

## Scope

This summary captures the roadmap execution work landed across:

- Month 1 evidence refresh
- Month 2 learning-loop hardening
- Month 3 owned-reading foundation
- Month 4 video/subtitle support hardening
- Month 5 control-plane wording and lifecycle tightening
- Month 6 release-claim / evidence / handoff tightening
- next-window P0 closure for:
  - privacy authority
  - glossary contract
  - routing observability

It is not a new product narrative. It is a release/PR-ready change summary.

## What changed

### 1. Learning loop became more concrete

- popup deep-read state handling was tightened
- popup save → vocab → review → revisit continuity was strengthened
- study-progress semantics became more explicit
- a replayable revisit path was documented and exercised

Key areas:
- `src/entrypoints/popup/*`
- `src/entrypoints/vocabulary/*`
- `src/utils/storage/study-progress*`
- `src/utils/storage/vocabulary*`
- `bench-live/scenarios/learning-loop-revisit-smoke.ts`

### 2. Owned reading became a real system boundary

- owned-reading item schema was defined
- queue/reopen continuity was improved
- reader/progress/review linkage was made more explicit

Key areas:
- `src/utils/storage/owned-reading*`
- `src/entrypoints/subtitle-reader/*`
- Month 3 evidence docs under `docs/investigations/`

### 3. Video/subtitle claims were narrowed and hardened

- YouTube and Bilibili adapter work was tightened
- subtitle-reader learning-chain continuity was added
- support matrix wording now distinguishes supported / best-effort / experimental / code-only more explicitly

Key areas:
- `src/entrypoints/content/video-platforms/*`
- `bench-live/scenarios/bilibili-subtitle-basic.ts`
- `bench-live/scenarios/subtitle-learning-chain-smoke.ts`
- Month 4 docs under `docs/investigations/`

### 4. Control-plane wording and lifecycle surfaces were aligned

- account/usage source-of-truth wording was aligned across surfaces
- lifecycle runbook/proof docs were tightened
- mobile web / iOS bridge wording was narrowed to match evidence

Key areas:
- `src/utils/astra/account-surface.ts`
- `src/entrypoints/options/*`
- `web/src/app*`
- Month 5 docs under `docs/investigations/`

### 5. Release/evidence discipline was tightened

- release checklist gained clearer blocking semantics
- support/capability/README wording was downgraded to match proof depth
- Month 6 now has an explicit inventory, claim audit, evidence pack, and closeout handoff
- `plan.md` now records the evidence-backed overall status rather than an optimistic completion posture

Key docs:
- `docs/release-readiness-checklist.md`
- `docs/capability-matrix-v2.md`
- `docs/investigations/support-matrix-2026-q2.md`
- `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
- `docs/investigations/month-6-release-claim-audit-2026-04-14.md`
- `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`
- `docs/investigations/month-6-closeout-handoff-2026-04-14.md`
- `plan.md`

### 6. Next-window P0 gaps were actually closed

#### Privacy authority
- background now authoritatively sanitizes translation request context when `privacyMode=true`
- provider/cache transport no longer relies on caller discipline alone

#### Glossary contract
- one source of truth: glossary-enabled vocabulary entries
- one serialization format: `source => target`
- one background-owned request-time injection path

#### Routing observability
- one canonical route classifier: `direct`, `relay`, `fallback`
- one canonical support/operator path: popup `Usage & routing` → `Last`

Key docs:
- `docs/investigations/privacy-authority-decision-2026-04-14.md`
- `docs/investigations/glossary-contract-2026-04-14.md`
- `docs/investigations/translation-routing-observability-2026-04-14.md`
- `docs/investigations/claude-sequential-task-pack-next-window-2026-04-14.md`

## Validation already run during execution

Representative verification already completed during the execution flow included:

- targeted Vitest runs for privacy/background/glossary/routing changes
- targeted Vitest runs for popup, vocabulary, owned-reading, subtitle-reader, and account surface changes
- multiple browser-backed bench/live scenario reruns for popup proof, learning-loop, reader/revisit, YouTube/Bilibili, and subtitle learning-chain paths

## Honest status after this change set

- several subsystems are now better specified, better proved, and better bounded
- the release/evidence/docs layer is materially tighter than before
- the roadmap/window is still **not** an overall pass
- the remaining large claims stay bounded where evidence is still partial

## Suggested commit grouping

1. product/runtime catch-up work across learning, readers, video, and control-plane
2. release/docs/plan/evidence alignment
3. next-window boundary closures for privacy, glossary, and routing observability

## Explicitly not covered by this summary

- unrelated server/video-note work currently present in the working tree
- any broader feature expansion beyond the scoped roadmap / next-window P0 tasks
