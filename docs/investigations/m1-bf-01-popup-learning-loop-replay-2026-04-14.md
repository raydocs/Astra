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

## Green replay summary (2026-04-14)

**Lane:** `pnpm bench:live:lane:learning-loop` (`CI=true`, `xvfb-run -a`, Playwright Chromium installed) — **pass** (representative headless run).

`package.json` runs the lane as **three separate** `pnpm bench:live` invocations, so each scenario gets its own **Run ID** and artifact directory:

| Scenario | Run ID | Artifacts |
|----------|--------|-----------|
| `bench-live/popup-deep-read-proof` | `live-20260414T082101-tv27s0` | `bench-live-results/live-20260414T082101-tv27s0/` |
| `bench-live/vocabulary-srs-smoke` | `live-20260414T082106-6s38in` | `bench-live-results/live-20260414T082106-6s38in/` |
| `bench-live/learning-loop-revisit-smoke` | `live-20260414T082109-c792v2` | `bench-live-results/live-20260414T082109-c792v2/` |

Structured pointers: each folder’s `result.json` / `result.md`; `bench-live-results/latest.result.json` reflects the **last** scenario in the chain (revisit smoke) only.

Re-run locally after `pnpm build` and `npx playwright install chromium`:

```bash
CI=true xvfb-run -a pnpm bench:live:lane:learning-loop
```

## Historical baseline (early 2026-04-14 replay, pre-harness)

Before relay-only seeding + popup/storage harness fixes, an in-repo replay documented a **failed** `bench-live/popup-deep-read-proof` run (`run-id` `live-20260414T061146-0odzcd`, `page.waitForFunction` timeout). Treat that row as **superseded** for triaging current code; reproduce on current `main` if investigating regressions.

## Canonical scenario IDs

| Lane | Command | Scenarios |
|------|---------|-----------|
| `popup-proof` | `pnpm bench:live:lane:popup-proof` | `bench-live/popup-deep-read-proof` |
| `learning-loop` | `pnpm bench:live:lane:learning-loop` | `bench-live/popup-deep-read-proof` → `bench-live/vocabulary-srs-smoke` → `bench-live/learning-loop-revisit-smoke` (matches `package.json`) |

## Artifacts

Structured results are written to `bench-live-results/<run-id>/` (gitignored). After a local run, link new `run-id`s in Month 1 / Month 2 closeout notes if policy requires a fresh attach.
