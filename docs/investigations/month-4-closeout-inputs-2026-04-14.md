# Month 4 — Video / subtitle closeout inputs

_Last updated: 2026-04-14 (`M4-F-04` evidence / claim sync)_

This file is the closeout-ready Month 4 summary for video / subtitle work. It should be read together with `docs/investigations/month-4-evidence-registry-2026-04-14.md`, which is the exact command + artifact ledger.

## Month 4 status layers

| Layer | Status | Meaning |
|------|--------|---------|
| `implemented` | **Yes** | Inventory/claim boundaries, YouTube+Bilibili hardening, and subtitle-file learning-chain continuity are landed. |
| `proved` | **Yes** | Fresh browser-backed artifacts exist for YouTube, Bilibili, subtitle-file, and subtitle-learning-chain continuity. |
| `gate-ready` | **Superseded by current release policy for YouTube** | This historical closeout predates the current `youtube-proof` and `youtube-holdout` required lanes. YouTube proof is now required; Bilibili, generic video, production-watch-page breadth, and non-YouTube adapters remain scoped. |
| `closeout verdict` | **`pass-with-scoped-claims` under current policy** | Month 4 YouTube proof is release-critical now, but proof breadth and release policy stay intentionally narrow. |

## Fresh replayable artifacts (minimum set satisfied)

Scenario IDs below match `id` fields registered in `bench-live/scenarios/index.ts` (`liveScenarios`). Invocation shape is always `CI=true pnpm bench:live -- --scenario <id>`.

| Proof slice | Scenario / command | Fresh green artifact |
|---|---|---|
| YouTube in-page adapter smoke | `bench-live/youtube-subtitle-basic` | `live-20260414T115407-2i2tzo` → `bench-live-results/live-20260414T115407-2i2tzo/` |
| Bilibili in-page adapter smoke | `bench-live/bilibili-subtitle-basic` | `live-20260414T115722-y40ya0` → `bench-live-results/live-20260414T115722-y40ya0/` |
| Subtitle-file ingest / preview / export | `bench-live/subtitle-file-basic` | `live-20260414T121705-ndf283` → `bench-live-results/live-20260414T121705-ndf283/` |
| Subtitle-file learning-loop / revisit continuity | `bench-live/subtitle-learning-chain-smoke` | `live-20260414T121845-xe3mlf` → `bench-live-results/live-20260414T121845-xe3mlf/` |

These four artifacts satisfy the Month 4 requirement that the repo can point to replayable video/subtitle evidence without collapsing distinct surface classes into one vague claim.

## Product continuity proved vs only implemented

### Browser-backed and replayable now

- **YouTube** fixture-backed in-page subtitle smoke
- **Bilibili** fixture-backed in-page subtitle smoke
- **Subtitle-file** ingest / preview / export
- **Subtitle-file learning chain** into vocabulary / review / revisit

### Implemented and documented, but not promoted into a required release lane

- YouTube and Bilibili production watch-page regressions remain **manual** (`month-4-video-production-regression-playbook-2026-04-17.md`)
- Subtitle-file remains a **controlled local-file reader handoff**, not a universal media resume system
- Other repo adapters remain **code-only** and out of supported claims

## Claim boundary

Safe Month 4 statement:

> Astra has a supported best-effort YouTube subtitle path, a narrower best-effort Bilibili adapter, and a separate controlled SRT/VTT subtitle-file reader path with replayable learning-loop continuity. Other in-repo video adapters remain code-only and should not be claimed as supported.

Do not say:

- “Astra supports video broadly.”
- “All major video platforms are supported.”
- “Subtitle-file proof means in-page video parity.”
- “Bilibili, generic video, or all in-repo adapters are required release gates / supported with YouTube-level confidence.”

## Recommended closeout language

- Month 4 video / subtitle work is **implemented**.
- Month 4 video / subtitle work is **proved enough for sequencing**.
- Month 4 YouTube proof/holdout work is **gate-ready under current release policy**.
- Closeout should remain **`pass-with-scoped-claims`** until / unless broader adapter lanes exist and production-watch-page validation is stronger than fixture-only proof.

## Pointers

- Exact artifact ledger: `docs/investigations/month-4-evidence-registry-2026-04-14.md`
- Claim sync note: `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md`
- Adapter replay note: `docs/investigations/month-4-video-smoke-replay-2026-04-16.md`
- Manual production regression playbook: `docs/investigations/month-4-video-production-regression-playbook-2026-04-17.md`
- Support / claim matrix: `docs/investigations/support-matrix-2026-q2.md`
- Video claim addendum: `docs/investigations/support-matrix-video-addendum-2026-04-15.md`
- Release policy: `docs/release-readiness-checklist.md`
