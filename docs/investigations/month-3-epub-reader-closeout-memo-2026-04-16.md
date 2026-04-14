# Month 3 — EPUB reader pack closeout memo (2026-04-16)

**Ledger:** plan.md Month 3 rows **21–27** (EPUB pack).

## Scope (what “done” means here)

- **Owned queue:** EPUB rows are written as `OwnedReadingItem` with `sourceType: "epub"` when the EPUB reader completes import / chapter navigation paths that enqueue (per Month 3 queue spec).
- **Revisit:** Vocabulary **Reading** **Open** targets `epub-reader.html` with the same `reopenHint` contract as other local-first readers where needed.
- **Proof:** Primary automated proof remains **`bench-live/epub-reader-basic`** (`epubReaderBasicScenario` in `bench-live/scenarios/index.ts`). It validates the first-cut fixture through the harness + Playwright snapshot capture.

## Boundaries / non-goals

- DRM, malformed EPUBs, and publisher-specific layout quirks are out of scope for this closeout; inventory-style failure classes belong in a later wave unless a new scenario is added.
- Like PDF, the live scenario proves the **reader rendering path** tied to the fixture; queue timing with very large books is not asserted here.
