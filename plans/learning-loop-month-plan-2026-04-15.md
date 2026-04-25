# Learning Loop One-Month Execution Plan

Last updated: 2026-04-15

## Goal

In the next month, move Astra's learning loop from a set of connected surfaces into a resilient, session-like study system:

1. Deep Read can reopen reliably without depending on the current active tab.
2. Vocabulary and Review can return users to the exact study spot more accurately than a raw sentence index.
3. CI and live-proof semantics treat the learning loop as a first-class release concern.
4. The reading experience becomes more immersive and less popup-shaped.
5. We can measure whether product changes improve loop completion.

## Week 1: Resilient Deep Read Session Restore

### Outcome

Deep Read should be able to reopen the latest study session from a local snapshot even if the source tab is not currently active or ready.

### Tasks

1. Add a `deep-read-session` local storage record keyed by normalized page URL.
2. Persist snapshot data when the popup study surface or deep-read surface has a valid `PageStudyContext`.
3. Include enough data to rebuild the Deep Read screen without live tab messaging:
   - page title
   - page URL
   - hostname
   - summary / excerpt
   - sentence deck
   - selected sentence index
   - last updated time
4. Make `DeepReadApp` load query-param target URL, then prefer a matching saved snapshot before retrying active-tab study context.
5. Keep the new snapshot layer read-only from web surfaces; do not introduce cross-surface runtime coupling.

### Verification

1. `pnpm type-check`
2. Add focused storage tests for snapshot save/load behavior.
3. Add a focused Deep Read render test once a test harness exists for the surface, or keep logic covered through storage-level tests in this slice.

## Week 2: Sentence Anchors Instead Of Raw Indexes

### Outcome

Saved vocabulary and review cards should reopen the best matching sentence even if sentence segmentation or page summaries shift.

### Tasks

1. Extend vocabulary source context / deep-read links with a sentence anchor contract:
   - sentence text
   - normalized sentence hash
   - sentence index as fallback
2. Add anchor matching in Deep Read:
   - exact text match first
   - normalized hash match second
   - sentence index fallback last
3. Update save flows from popup deep-read and standalone deep-read to write anchors consistently.
4. Update deep-link reopen flows in Vocabulary and Review to use the stronger contract.

### Verification

1. `pnpm type-check`
2. Extend vocabulary / review tests to verify anchor-aware reopen payloads.
3. Add one regression test around anchor fallback ordering.

## Week 3: Immersive Reader Progression

### Outcome

Deep Read should feel like a reading workspace, not only a sentence deck page.

### Tasks

1. Add a full-text reading mode beside the existing focus-sentence view.
2. Let users select any visible sentence / excerpt block and sync it into the focus card.
3. Surface next-step guidance directly inside Deep Read using existing study-progress state.
4. Add a session-end CTA that returns users to either Review or the owned reading queue.

### Verification

1. `pnpm type-check`
2. Add a focused interaction test where selecting another sentence updates the focus state.
3. Re-run vocabulary / review regression tests to ensure deep-link continuity still works.

## Week 4: Release Gate + Metrics Hardening

### Outcome

The learning loop becomes an observable, CI-owned product capability rather than an optional proof path.

### Tasks

1. Finalize CI/live-lane semantics so `learning-loop` is treated as a first-class gate in docs and workflow summaries.
2. Add a minimal learning funnel event layer:
   - deep-read opened
   - sentence explained
   - sentence saved
   - review answered
   - returned to source / resumed reading
3. Produce one small investigation doc defining how these events should be interpreted and what not to over-claim.
4. Attach current artifact and ownership guidance for the live lane.

### Verification

1. `pnpm type-check`
2. Re-run focused tests for vocabulary / review / popup where events are emitted.
3. If environment allows, run `CI=true pnpm bench:live:lane:learning-loop` and record the artifact set.

## Parallel / Nice-To-Have Work

These can happen opportunistically without blocking the weekly spine:

1. Unify `PageStudyContext` and any future deep-read snapshot types into one shared study-session contract.
2. Add digest / explanation caching keyed by page fingerprint and sentence hash.
3. Group vocabulary cards by source page when users have many saved items from the same article.
4. Add a lightweight “today consistency” metric on top of daily stats.

## Current Step In Progress

Week 1 is now in progress: local Deep Read session snapshot storage and restore.
