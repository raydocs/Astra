# Month 3 — Reader / owned-reading closeout inputs

_Last updated: 2026-04-14 (`M3-F-04` proof + docs sync)_

This file is the closeout-ready Month 3 summary for reader / owned-reading work. It should be read together with `docs/investigations/month-3-evidence-registry-2026-04-14.md`, which is the exact command + artifact ledger.

## Month 3 status layers

| Layer | Status | Meaning |
|------|--------|---------|
| `implemented` | **Yes** | Owned-reading schema v1, queue v1, source/backlink mapping, and reader entry contracts are landed in repo. |
| `proved` | **Yes** | Fresh browser-backed artifacts exist for PDF, EPUB, subtitle-file, and article revisit. |
| `gate-ready` | **No** | These reader / revisit scenarios are still optional proofs, not required Gate 2 live lanes in CI. |
| `closeout verdict` | **`pass-with-carry`** | Month 3 is real and replayable, but still carries required-lane / proof-depth gaps. |

## Fresh replayable artifacts (minimum set satisfied)

Scenario IDs below match `id` fields registered in `bench-live/scenarios/index.ts` (`liveScenarios`). Invocation shape is always `CI=true pnpm bench:live -- --scenario <id>`.

| Proof slice | Scenario / command | Fresh green artifact |
|---|---|---|
| PDF reader fixture proof | `bench-live/pdf-reader-basic` | `live-20260414T113547-e7a9ks` → `bench-live-results/live-20260414T113547-e7a9ks/` |
| EPUB reader fixture proof | `bench-live/epub-reader-basic` | `live-20260414T113605-p0m6bj` → `bench-live-results/live-20260414T113605-p0m6bj/` |
| Subtitle-file ingest / preview / export proof | `bench-live/subtitle-file-basic` | `live-20260414T113623-809nid` → `bench-live-results/live-20260414T113623-809nid/` |
| Reading queue article revisit proof | `bench-live/learning-loop-revisit-smoke` | `live-20260414T113647-9f8kwi` → `bench-live-results/live-20260414T113647-9f8kwi/` |

These four artifacts satisfy the Month 3 requirement that the repo can point to at least three replayable reader/revisit proofs.

## Product continuity proved vs only implemented

### Browser-backed and replayable now

- **PDF reader fixture path** — `bench-live/pdf-reader-basic`
- **EPUB reader fixture path** — `bench-live/epub-reader-basic`
- **Subtitle-file ingest / preview / export path** — `bench-live/subtitle-file-basic`
- **Article revisit from the Reading queue** — `bench-live/learning-loop-revisit-smoke`

### Implemented and test-covered, but not separately browser-backed as a queue reopen proof

- **Remote PDF queue reopen** via `pdf-reader.html?url=...`
- **EPUB queue reopen** via `epub-reader.html` + `reopenHint`
- **Subtitle-file queue reopen** via `subtitle-reader.html` + `reopenHint`

This is the main claim boundary for Month 3: the queue/reopen contracts are real, but not every source type has its own dedicated browser-backed queue reopen smoke yet.

## Claim boundary

Safe Month 3 statement:

> Astra has a real owned-reading model and Reading queue for article, PDF, EPUB, and subtitle-file items. Fresh browser-backed proof exists for PDF reader, EPUB reader, subtitle-file ingest/preview/export, and article revisit from the queue. Full multi-reader parity and universal end-to-end reopen proof remain out of scope.

Do not say:

- “All reader surfaces have equal live proof depth.”
- “Every queue reopen path is browser-backed end to end.”
- “Month 3 reader proofs are required release gates.”

## Recommended closeout language

- Month 3 reader / owned-reading work is **implemented**.
- Month 3 reader / owned-reading work is **proved enough for sequencing**.
- Month 3 reader / owned-reading work is **not gate-ready as required release policy**.
- Closeout should remain **`pass-with-carry`** until / unless reader proofs are promoted into a required CI-owned lane and broader queue reopen paths get dedicated browser-backed smokes.

## Pointers

- Exact artifact ledger: `docs/investigations/month-3-evidence-registry-2026-04-14.md`
- PDF pack boundary: `docs/investigations/month-3-pdf-reader-closeout-memo-2026-04-16.md`
- EPUB pack boundary: `docs/investigations/month-3-epub-reader-closeout-memo-2026-04-16.md`
- Queue contract: `docs/investigations/saved-reading-queue-spec-2026-04-15.md`
- Schema / identity rules: `docs/investigations/owned-reading-schema-v1-2026-04-14.md`
- Support / claim matrix: `docs/investigations/support-matrix-2026-q2.md`
- Release policy: `docs/release-readiness-checklist.md`
