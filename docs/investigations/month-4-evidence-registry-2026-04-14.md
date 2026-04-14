# Month 4 — Video / subtitle evidence registry

_Last updated: 2026-04-14 (`M4-F-04` evidence / claim sync)_

This file is the Month 4 evidence index for video / subtitle work. It answers four separate questions:

1. **Implemented?** — is the behavior landed in repo?
2. **Proved?** — do we have exact tests / live artifacts?
3. **Gate-ready?** — is it part of a required release gate today?
4. **Still partial / carry?** — what remains intentionally outside the gate?

## Month 4 status layers

| Layer | Status | Meaning |
|------|--------|---------|
| `implemented` | **Yes** | Month 4 inventory/claim boundaries, YouTube hardening, Bilibili hardening, and subtitle-reader learning-chain continuity are landed in repo/docs. |
| `proved` | **Yes** | Fresh browser-backed artifacts exist for YouTube, Bilibili, subtitle-file, and the subtitle learning chain. |
| `gate-ready` | **No** | Video/subtitle proofs remain optional scenario evidence, not required Gate 2 CI lanes. |
| `closeout verdict` | **`pass-with-carry`** | Month 4 is real and replayable, but release policy and production-site breadth still stay explicitly narrow. |

## Fresh live evidence (exact commands + artifacts)

| Proof slice | Command | Latest green artifact(s) | Gate status today |
|---|---|---|---|
| YouTube adapter smoke | `CI=true pnpm bench:live -- --scenario bench-live/youtube-subtitle-basic` | `live-20260414T115407-2i2tzo` → `bench-live-results/live-20260414T115407-2i2tzo/` | **Optional** proof |
| Bilibili adapter smoke | `CI=true pnpm bench:live -- --scenario bench-live/bilibili-subtitle-basic` | `live-20260414T115722-y40ya0` → `bench-live-results/live-20260414T115722-y40ya0/` | **Optional** proof |
| Subtitle-file ingest / preview / export | `CI=true pnpm bench:live -- --scenario bench-live/subtitle-file-basic` | `live-20260414T121705-ndf283` → `bench-live-results/live-20260414T121705-ndf283/` | **Optional** proof |
| Subtitle reader → vocab / review / revisit chain | `CI=true pnpm bench:live -- --scenario bench-live/subtitle-learning-chain-smoke` | `live-20260414T121845-xe3mlf` → `bench-live-results/live-20260414T121845-xe3mlf/` | **Optional** proof |

## Implementation / proof map

| Area | Implemented pointers | Proof pointers | Gate-ready today? | Notes |
|------|----------------------|----------------|-------------------|-------|
| Video adapter inventory / claim boundaries | `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`, `docs/investigations/support-matrix-video-addendum-2026-04-15.md` | linked Month 4 docs + artifacts below | **No** | Canonical classification now distinguishes supported / best-effort / experimental / code-only. |
| YouTube in-page subtitle path | `src/entrypoints/content/video-platforms/youtube.ts` | `src/entrypoints/content/video-platforms/video-platforms.test.ts`, `bench-live/youtube-subtitle-basic`, artifact `live-20260414T115407-2i2tzo` | **No** | Supported best-effort primary video path only; fixture-backed, not universal production-watch-page proof. |
| Bilibili in-page subtitle path | `src/entrypoints/content/video-platforms/bilibili.ts` | `video-platforms.test.ts`, `bench-live/bilibili-subtitle-basic`, artifact `live-20260414T115722-y40ya0` | **No** | Best-effort secondary adapter only; stronger than code-only, weaker than YouTube. |
| Subtitle-file reader surface | `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx`, `docs/investigations/subtitle-reader-learning-chain-2026-04-14.md` | `bench-live/subtitle-file-basic`, artifact `live-20260414T121705-ndf283` | **No** | Separate controlled reader path, not evidence of in-page adapter breadth. |
| Subtitle-file learning chain | `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx`, `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/ReviewMode.tsx`, `bench-live/scenarios/subtitle-learning-chain-smoke.ts` | `SubtitleReaderApp.test.tsx`, vocabulary/review tests, `bench-live/subtitle-learning-chain-smoke`, artifact `live-20260414T121845-xe3mlf` | **No** | Browser-backed proof now exists for explain/save/review/revisit continuity on the controlled file path. |
| Month 4 release / claim sync | this registry, `docs/investigations/month-4-closeout-inputs-2026-04-14.md`, `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md`, `docs/release-readiness-checklist.md`, `docs/investigations/support-matrix-2026-q2.md` | linked docs + run ids above | **No** | This work makes Month 4 status readable from docs alone; it does not promote a new required lane. |

## Honest claim boundary by surface class

| Surface class | Status | Honest claim |
|---|---|---|
| YouTube in-page subtitles | **Supported** (best-effort within supported tier) | Primary Month 4 in-page video path with fixture-backed smoke + unit coverage. |
| Bilibili in-page subtitles | **Best-effort** | Secondary adapter with replayable fixture smoke, but not parity with YouTube or broad production-site guarantees. |
| Subtitle-file reader / learning chain | **Experimental controlled surface** | Replayable controlled file-reader path with learning-loop continuity; separate from in-page video support. |
| Netflix / Prime Video / Disney+ / Udemy / Coursera adapters | **Code-only** | Do not claim external support. |

## What remains carry, not new feature scope

Primary Month 4 carries:

- **No required Month 4 video/subtitle live lane** in CI yet.
- **Production watch-page regression remains manual** (`month-4-video-production-regression-playbook-2026-04-17.md`) and is not replaced by fixture smokes.
- **Subtitle-file scope stays separate** from in-page video claims.
- **Support language must stay narrow**: no generic “supports video” statement without classification.

## Pointers

- Closeout summary: `docs/investigations/month-4-closeout-inputs-2026-04-14.md`
- Claim sync note: `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md`
- Adapter inventory: `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`
- Claim addendum: `docs/investigations/support-matrix-video-addendum-2026-04-15.md`
- Subtitle-file continuity contract: `docs/investigations/subtitle-reader-learning-chain-2026-04-14.md`
- Release policy: `docs/release-readiness-checklist.md`
