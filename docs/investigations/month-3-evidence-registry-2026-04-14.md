# Month 3 — Reader / owned-reading evidence registry

_Last updated: 2026-04-14 (`M3-F-04` evidence sync)_

This file is the Month 3 evidence index for reader / owned-reading work. It answers four separate questions:

1. **Implemented?** — is the behavior landed in repo?
2. **Proved?** — do we have exact tests / live artifacts?
3. **Gate-ready?** — is it part of a required release gate today?
4. **Still partial / carry?** — what remains intentionally outside the gate?

## Month 3 status layers

| Layer | Status | Meaning |
|------|--------|---------|
| `implemented` | **Yes** | Owned-reading schema v1, queue v1, reader source mapping, and learning-asset backlinks are landed in repo. |
| `proved` | **Yes** | Fresh browser-backed reader/revisit artifacts exist and are linked below. |
| `gate-ready` | **Superseded by current release policy for controlled flows** | This historical 2026-04-14 registry predates the current `document-proof` required lane. As of the current release checklist, controlled PDF / EPUB / SRT/VTT document-file proof is required; universal reopen and broader reader parity remain out of scope. |
| `closeout verdict` | **`pass-with-scoped-claims` under current policy** | Month 3 controlled reader/file proof is release-critical now, but the original carry boundaries still apply to universal reopen and unsupported formats. |

## Fresh live evidence (exact commands + artifacts)

| Proof slice | Command | Latest green artifact(s) | Gate status today |
|---|---|---|---|
| PDF reader fixture proof | `CI=true pnpm bench:live -- --scenario bench-live/pdf-reader-basic` | `live-20260414T113547-e7a9ks` → `bench-live-results/live-20260414T113547-e7a9ks/` | **Optional** proof |
| EPUB reader fixture proof | `CI=true pnpm bench:live -- --scenario bench-live/epub-reader-basic` | `live-20260414T113605-p0m6bj` → `bench-live-results/live-20260414T113605-p0m6bj/` | **Optional** proof |
| Subtitle-file ingest / preview / export proof | `CI=true pnpm bench:live -- --scenario bench-live/subtitle-file-basic` | `live-20260414T113623-809nid` → `bench-live-results/live-20260414T113623-809nid/` | **Optional** proof |
| Reading queue article revisit proof | `CI=true pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke` | `live-20260414T113647-9f8kwi` → `bench-live-results/live-20260414T113647-9f8kwi/` | **Optional** proof |

Artifact structure conventions: `docs/investigations/month-3-bench-artifact-conventions-2026-04-16.md`.

## Implementation / proof map

| Area | Implemented pointers | Proof pointers | Gate-ready today? | Notes |
|------|----------------------|----------------|-------------------|-------|
| Owned-reading schema / identity | `src/utils/storage/owned-reading.ts`, `docs/investigations/owned-reading-schema-v1-2026-04-14.md`, `docs/investigations/owned-reading-item-spec-2026-04-15.md` | `src/utils/storage/owned-reading.test.ts` | **No** | Canonical model for article / PDF / EPUB / subtitle-file. |
| Reading queue surface | `src/entrypoints/vocabulary/VocabularyApp.tsx`, `docs/investigations/saved-reading-queue-spec-2026-04-15.md` | `src/entrypoints/vocabulary/VocabularyApp.test.tsx` | **No** | Queue states and resume guidance are implemented; not a required live lane. |
| Reader ↔ learning-asset backlinks | `src/utils/storage/vocabulary-core.ts`, `src/utils/storage/study-progress.ts`, `src/entrypoints/vocabulary/ReviewMode.tsx` | `src/utils/storage/vocabulary.test.ts`, `src/utils/storage/study-progress.test.ts`, `src/entrypoints/vocabulary/ReviewMode.test.tsx` | **No** | Vocab/review can point back to owned-reading rows and preserve progress identity. |
| PDF reader surface | `docs/investigations/month-3-pdf-reader-closeout-memo-2026-04-16.md` | `bench-live/pdf-reader-basic`, artifact `live-20260414T113547-e7a9ks` | **No** | Proves fixture-backed reader rendering path, not universal PDF reopen parity. |
| EPUB reader surface | `docs/investigations/month-3-epub-reader-closeout-memo-2026-04-16.md` | `bench-live/epub-reader-basic`, artifact `live-20260414T113605-p0m6bj` | **No** | Proves fixture-backed EPUB reader path, including restored reading state. |
| Subtitle-file reader surface | `docs/investigations/subtitle-reader-learning-chain-2026-04-14.md` | `bench-live/subtitle-file-basic`, artifact `live-20260414T113623-809nid` | **No** | Proves ingest / preview / export browser path; not a full queue reopen smoke. |
| Revisit v1 article path | `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md`, `src/entrypoints/vocabulary/VocabularyApp.tsx` | `bench-live/learning-loop-revisit-smoke`, artifact `live-20260414T113647-9f8kwi` | **No** | Canonical browser-backed reopen proof today is still the article Reading-tab path. |
| Month 3 evidence / claim sync | this registry, `docs/investigations/month-3-closeout-inputs-2026-04-14.md`, `docs/investigations/support-matrix-2026-q2.md`, `docs/release-readiness-checklist.md` | linked docs + run ids above plus current `document-proof` lane artifacts | **Yes for controlled PDF / EPUB / SRT/VTT document-proof; no for universal reopen or unsupported formats** | Current release policy promotes controlled document/file proof into Gate 2 while keeping broader reader claims scoped. |

## Honest boundary by source type

| Source type | Implemented | Browser-backed proof depth today | Honest claim |
|---|---|---|---|
| Article | Yes | **Queue reopen smoke** (`learning-loop-revisit-smoke`) | Canonical revisit v1 path is replayable. |
| PDF | Yes | **Reader fixture smoke** (`pdf-reader-basic`) | Reader path is replayable; dedicated queue reopen smoke is still absent. |
| EPUB | Yes | **Reader fixture smoke** (`epub-reader-basic`) | Reader path is replayable; dedicated queue reopen smoke is still absent. |
| Subtitle-file | Yes | **Reader fixture smoke** (`subtitle-file-basic`) | File ingest/preview/export is replayable; dedicated queue reopen smoke is still absent. |

## What remains carry, not feature scope

Primary Month 3 carries:

- **No broad/universal Month 3 reader parity lane** in CI yet; the current required `document-proof` lane covers controlled document/file proof only.
- **Non-article queue reopen** for PDF / EPUB / subtitle-file is implemented and test-covered, but not separately browser-backed end to end as a dedicated smoke.
- **Support language must stay narrow**: queue + schema + supported reader proofs, not universal multi-reader parity.

## Pointers

- Closeout summary: `docs/investigations/month-3-closeout-inputs-2026-04-14.md`
- Support / claim matrix: `docs/investigations/support-matrix-2026-q2.md`
- Live coverage truth source: `docs/investigations/workstream-a-live-coverage-matrix.md`
- Release policy: `docs/release-readiness-checklist.md`
- Artifact conventions: `docs/investigations/month-3-bench-artifact-conventions-2026-04-16.md`
