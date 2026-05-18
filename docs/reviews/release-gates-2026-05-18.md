# Release Gates Run — 2026-05-18

## Verdict

Local release gates are green after CI/docs alignment and live-bench scenario maintenance.

This is a release-candidate signal, not a product/commercial launch approval. Formal launch still depends on store packaging, production secrets, privacy/legal review, and any surface-specific claim review required by `docs/release-readiness-checklist.md`.

## Gate Results

| Gate | Command | Result | Notes |
|---|---|---:|---|
| Install | `pnpm install --frozen-lockfile` | Pass | WXT prepare completed; ignored-build-script warning is non-blocking. |
| Repo knowledge | `pnpm check:repo-knowledge` | Pass | No tracked files under legacy roots. |
| Zod entrypoints | `pnpm check:zod-entrypoints` | Pass | 14 bundles verified after `src/web` path update. |
| Release lint | `pnpm lint:ci` | Pass | Release-scoped lint gate green. |
| Type check | `pnpm type-check` | Pass | Extension + web TypeScript green. |
| Tests | `pnpm test` | Pass | 161 files / 1416 tests. |
| Deterministic bench | `pnpm bench` | Pass | 63 scenarios passed, average score 99. |
| Chrome build | `pnpm build` | Pass | Content-script bundle guardrail passed. |
| Firefox build | `pnpm build:firefox` | Pass | Content-script bundle guardrail passed. |
| Safari build | `pnpm build:safari` | Pass | Safari MV3 output generated. |
| Safari sync verify | `bash ios/scripts/verify-safari-build-sync.sh` | Pass | Passed after `pnpm ios:sync-extension`. |
| Web build | `pnpm build:web` | Pass | Vite chunk-size warning only. |
| Required live lane | `CI=true pnpm bench:live:lane:release-proof` | Pass | Passed after installing Playwright Chromium. |
| Required live lane | `CI=true pnpm bench:live:lane:learning-loop` | Pass | Popup proof, vocabulary smoke, and revisit smoke all passed. |

## Live Evidence

- `release-proof` latest successful local run used Playwright Chromium from `~/Library/Caches/ms-playwright/chromium-1217/...`.
- `learning-loop` successful runs:
  - `bench-live/popup-deep-read-proof` → `data/bench-live-results/live-20260518T162836-oyzkhi/`
  - `bench-live/vocabulary-srs-smoke` → `data/bench-live-results/live-20260518T162845-e13xyj/`
  - `bench-live/learning-loop-revisit-smoke` → `data/bench-live-results/live-20260518T162848-curvv2/`

## Fixes Made During Gate Run

- Promoted `learning-loop` to a blocking CI live lane and exposed it in manual live workflow dispatch.
- Updated release docs so `source-core`, `extension-core`, and `learning-loop` are the required live release lanes.
- Updated stale live scenarios from legacy review controls to current four-grade ReviewMode selectors.
- Updated the Zod entrypoint guardrail for the cleaned `src/web` path.
- Fixed config migration/test expectations around the current Google Translate/free-first provider default.
- Synced committed iOS Safari extension resources with the generated Safari MV3 output.
- Updated `AGENTS.md` to reflect current green release gates and required live lanes.

## Remaining Non-Gate Launch Work

- Confirm production relay secrets and provider keys in the deployment environment.
- Complete store-packaging review for Chrome/Firefox/Safari distribution.
- Re-check legal/privacy copy before public marketing claims are strengthened.
- Keep optional surface-specific evidence reviews scoped by `docs/release-readiness-checklist.md` Gate 4B.
