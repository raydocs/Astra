# M1-BF-01 — Popup proof + learning-loop replay (2026-04-14)

_Task: `M1-BF-01` from `docs/investigations/claude-sequential-task-pack-2026-04-14.md`_

## Code fixes applied after the initial failed replay

1. **`bench-live/popup-deep-read-proof` provider seeding** — Removed a dummy `apiKey` from the seeded config so translations route to the in-scenario mock relay (real router prefers **direct** when an API key is present).
2. **`bench-live/driver.ts` — `openExtensionActionPopup`** — Avoid `waitForLoadState("domcontentloaded")` on `chrome-extension://` popup pages; it could surface as `page.goto: net::ERR_BLOCKED_BY_CLIENT` in some Chromium builds. Popups opened via `window.open` / CDP now wait on `body` / `document.readyState` instead.

Re-run locally after `pnpm build` and `npx playwright install chromium`:

```bash
CI=true xvfb-run -a pnpm bench:live:lane:learning-loop
```

## Canonical scenario IDs

| Lane | Command | Scenarios |
|------|---------|-----------|
| `popup-proof` | `pnpm bench:live:lane:popup-proof` | `bench-live/popup-deep-read-proof` |
| `learning-loop` | `pnpm bench:live:lane:learning-loop` | `bench-live/popup-deep-read-proof` then `bench-live/vocabulary-srs-smoke` |

## Artifacts

Structured results are written to `bench-live-results/<run-id>/` (gitignored). After a local run, link the new `run-id` in Month 1 / Month 2 closeout notes if policy requires a green attach.
