# M1-BF-01 — Popup proof + learning-loop replay (2026-04-14)

_Task: `M1-BF-01` from `docs/investigations/claude-sequential-task-pack-2026-04-14.md`_

## Prerequisites

- **Playwright Chromium** (required for extension-loaded scenarios; avoids `net::ERR_BLOCKED_BY_CLIENT` on `chrome-extension://…` when the driver would otherwise fall back to system Chrome):

  ```bash
  npx playwright install chromium
  ```

## Code fixes applied after the initial failed replay

1. **`bench-live/popup-deep-read-proof` provider seeding** — Removed a dummy `apiKey` from the seeded config so translations route to the in-scenario mock relay (real router prefers **direct** when an API key is present).
2. **`bench-live/driver.ts` — `openExtensionActionPopup`** — Avoid `waitForLoadState("domcontentloaded")` on `chrome-extension://` popup pages; it could surface as `page.goto: net::ERR_BLOCKED_BY_CLIENT` in some Chromium builds. Popups opened via `window.open` / CDP now wait on `body` / `document.readyState` instead.

Re-run locally after `pnpm build` and `npx playwright install chromium`:

```bash
CI=true xvfb-run -a pnpm bench:live:lane:learning-loop
```

## Green replay summary (2026-04-14)

**Lane:** `pnpm bench:live:lane:learning-loop` (`CI=true`, `xvfb-run -a`) — **pass** (first attempt, headless VM).

`package.json` runs the lane as **three separate** `pnpm bench:live` invocations, so each scenario gets its own **Run ID** and artifact directory:

| Scenario | Run ID | Artifacts |
|----------|--------|-----------|
| `bench-live/popup-deep-read-proof` | `live-20260414T082101-tv27s0` | `bench-live-results/live-20260414T082101-tv27s0/` |
| `bench-live/vocabulary-srs-smoke` | `live-20260414T082106-6s38in` | `bench-live-results/live-20260414T082106-6s38in/` |
| `bench-live/learning-loop-revisit-smoke` | `live-20260414T082109-c792v2` | `bench-live-results/live-20260414T082109-c792v2/` |

Structured pointers: each folder’s `result.json` / `result.md`; `bench-live-results/latest.result.json` reflects the **last** scenario in the chain (revisit smoke) only.

## Green `run-id` (optional attach)

After a future re-run, refresh this section with new run ids. Artifacts under `bench-live-results/<run-id>/` remain gitignored; keep ids in docs or RC notes for traceability.

## Canonical scenario IDs

| Lane | Command | Scenarios |
|------|---------|-----------|
| `popup-proof` | `pnpm bench:live:lane:popup-proof` | `bench-live/popup-deep-read-proof` |
| `learning-loop` | `pnpm bench:live:lane:learning-loop` | `bench-live/popup-deep-read-proof` → `bench-live/vocabulary-srs-smoke` → `bench-live/learning-loop-revisit-smoke` (matches `package.json` `bench:live:lane:learning-loop`) |

## Artifacts

Structured results are written to `bench-live-results/<run-id>/` (gitignored). After a local run, link the new `run-id` in Month 1 / Month 2 closeout notes if policy requires a green attach.
