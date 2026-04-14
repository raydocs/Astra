# M1-BF-01 — Popup proof + learning-loop replay (2026-04-14)

_Task: `M1-BF-01` from `docs/investigations/claude-sequential-task-pack-2026-04-14.md`_

## Prerequisites

- **Playwright Chromium** (required for extension-loaded scenarios; avoids `net::ERR_BLOCKED_BY_CLIENT` on `chrome-extension://…` when the driver would otherwise fall back to system Chrome):

  ```bash
  npx playwright install chromium
  ```

- Extension build: `pnpm build` (output `.output/chrome-mv3`)
- Environment: `CI=true` (matches CI live-browser semantics for bench driver)
- Display: `xvfb-run -a` (headless Linux VM)

## Code fixes applied after the initial failed replay

1. **`bench-live/popup-deep-read-proof` provider seeding** — Removed a dummy `apiKey` from the seeded config so translations route to the in-scenario mock relay (real router prefers **direct** when an API key is present).
2. **`bench-live/driver.ts` — `openExtensionActionPopup`** — Avoid `waitForLoadState("domcontentloaded")` on `chrome-extension://` popup pages; it could surface as `page.goto: net::ERR_BLOCKED_BY_CLIENT` in some Chromium builds. Popups opened via `window.open` / CDP now wait on `body` / `document.readyState` instead.
3. **Storage seeding** — Extension HTML seed pages use `waitUntil: "commit"` where applicable to avoid blocked navigations during `chrome.storage.local` injection.

## Fresh green replay summary (2026-04-14)

Fresh commands executed for `M1-BF-01` on this repo snapshot:

| Command | Status | Run ID / artifact path | Notes |
|---------|--------|------------------------|-------|
| `pnpm build` | **pass** | `.output/chrome-mv3/` | Extension build completed successfully before the live replay. |
| `CI=true pnpm bench:live:lane:popup-proof` | **pass** | `live-20260414T095344-ol5adc` → `bench-live-results/live-20260414T095344-ol5adc/` | Canonical popup proof reran green with `result.json` / `result.md` written. |
| `CI=true pnpm bench:live:lane:learning-loop` | **pass** | see per-scenario table below | Full optional learning-loop chain reran green immediately after popup-proof. |

`package.json` runs the `learning-loop` lane as **three separate** `pnpm bench:live` invocations, so each scenario gets its own **Run ID** and artifact directory:

| Scenario | Run ID | Artifacts |
|----------|--------|-----------|
| `bench-live/popup-deep-read-proof` | `live-20260414T095422-yqripy` | `bench-live-results/live-20260414T095422-yqripy/` |
| `bench-live/vocabulary-srs-smoke` | `live-20260414T095427-992iaf` | `bench-live-results/live-20260414T095427-992iaf/` |
| `bench-live/learning-loop-revisit-smoke` | `live-20260414T095429-kahn2o` | `bench-live-results/live-20260414T095429-kahn2o/` |

Structured pointers: each folder’s `result.json` / `result.md`; `bench-live-results/latest.result.json` reflects the **last** scenario in the chain (revisit smoke) only.

Re-run locally after `pnpm build` and `npx playwright install chromium`:

```bash
CI=true xvfb-run -a pnpm bench:live:lane:learning-loop
```

## Environment note on the earlier host-local stall

An earlier host-local attempt on the same date documented a **stalled** `popup-proof` run (`live-20260414T093931-hlpkms`) that created only `article-basic.html` and never wrote `result.json`. The subsequent green reruns above succeeded when the live Playwright GUI execution was allowed outside the sandbox, so treat that stalled attempt as an **environment / sandbox execution artifact**, not the current popup-proof product result.

## Historical baseline (early 2026-04-14 replay, pre-harness)

Before relay-only seeding + popup/storage harness fixes, an in-repo replay documented a **failed** `bench-live/popup-deep-read-proof` run (`run-id` `live-20260414T061146-0odzcd`, `page.waitForFunction` timeout). Treat that row as **superseded** for triaging current code; reproduce on current `main` if investigating regressions.

## Canonical scenario IDs

| Lane | Command | Scenarios |
|------|---------|-----------|
| `popup-proof` | `pnpm bench:live:lane:popup-proof` | `bench-live/popup-deep-read-proof` |
| `learning-loop` | `pnpm bench:live:lane:learning-loop` | `bench-live/popup-deep-read-proof` → `bench-live/vocabulary-srs-smoke` → `bench-live/learning-loop-revisit-smoke` (matches `package.json`) |

## Artifacts

Structured results are written to `bench-live-results/<run-id>/` (gitignored). The fresh green replay artifacts are:

- standalone popup-proof: `bench-live-results/live-20260414T095344-ol5adc/`
- learning-loop popup proof: `bench-live-results/live-20260414T095422-yqripy/`
- learning-loop vocabulary smoke: `bench-live-results/live-20260414T095427-992iaf/`
- learning-loop revisit smoke: `bench-live-results/live-20260414T095429-kahn2o/`

After a local run, link new `run-id`s in Month 1 / Month 2 closeout notes if policy requires a fresh attach.
