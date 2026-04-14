# Month 3 — Bench-live artifact conventions (2026-04-16)

**Ledger:** plan.md Month 3 rows **28–33** (revisit + evidence): bind **scenario IDs** to on-disk layout and CI uploads.

## Scenario registry (source of truth)

- **Registry:** `bench-live/scenarios/index.ts` exports `liveScenarios` and each scenario module exports a definition whose **`id`** is the stable scenario identifier (e.g. `bench-live/pdf-reader-basic`, `bench-live/epub-reader-basic`).
- **CLI / lane:** `pnpm bench:live -- --scenario=<id>` (see `package.json` scripts). Lanes compose multiple scenario ids in the bench-live runner.

## Local artifact root and run directory

- **Root:** `bench-live-results/` (see `DEFAULT_LIVE_ARTIFACT_ROOT` in `bench-live/driver.ts`; directory is gitignored).
- **Per run:** `bench-live-results/<run-id>/`
  - **Persistence:** `bench-live/results.ts` writes `result.json` and `result.md` under that directory and mirrors “latest” copies at `bench-live-results/latest.result.json` / `latest.result.md`.
- **`<run-id>`:** Allocated by the live bench harness for each invocation (timestamp-based string). **Closeout / RC notes should paste the actual `run-id` from a green run** next to the scenario ids that passed.

## Relating scenarios to files under `<run-id>/`

- Each scenario may emit additional files in the same `<run-id>/` folder (e.g. `pdf-reader-basic.snapshot.html`, `pdf-reader-basic.png` from `bench-live/scenarios/pdf-reader-basic.ts`). Those names are **scenario implementation details**, not a second registry; always cite the **`bench-live/...` scenario `id`** plus the run directory in prose.

## CI artifact naming (GitHub Actions)

- **Workflow:** `.github/workflows/bench-live.yml` uploads the entire `bench-live-results/` tree as a workflow artifact named **`live-bench-results`** (fixed name; the **logical** identity for humans is still **`bench-live-results/<run-id>/`** inside that zip).
- **Optional bench-opt workflow:** `.github/workflows/bench-opt.yml` uses `bench-live-results-${{ github.run_id }}` for the **upload-artifact** name — that name is the **GitHub artifact** label, not the on-disk `<run-id>`. After download, inspect `bench-live-results/<run-id>/` inside the archive for the harness run id.

## Practical binding for Month 3 acceptance

When marking reader/revisit evidence complete, record:

1. **Scenario id(s)** from the registry (`bench-live/...`).
2. **Run id** (folder name under `bench-live-results/`) from the same green execution.
3. **CI or local** (and workflow run URL if CI).

This keeps ledger language (“bind run id”) aligned with how the code actually writes artifacts.
