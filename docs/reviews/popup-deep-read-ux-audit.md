# Popup → Deep-Read UX Audit: Single Highest-Leverage Change

**Date:** 2026-04-24  
**Scope:** `src/entrypoints/popup/App.tsx`, `src/entrypoints/popup/components/StudySection.tsx`, `src/entrypoints/deep-read/DeepReadApp.tsx`  
**Baseline Score:** 4.5/10 · Read Frog Reference: 7.5/10

---

## 1. The One Change: Collapse diagnostic noise and promote the study/deep-read CTA to second position in the popup

**What to do:**

In `App.tsx` (the popup render, starting ~L1553), restructure the vertical layout order from:

```
Current:
  [1] Header
  [2] Translate This Page button
  [3] Video note creation section          ← noise
  [4] Status/Quota/iOS bridge diagnostics  ← 40+ lines of debug output
  [5] Translation status card
  [6] Language/mode controls
  [7] StudySection (deep-read CTA buried)  ← primary workflow, buried
  [8] UsageInsightsCard                    ← noise
  [9] SiteSettingsSection
  [10] Auth section
  [11] Footer
```

To:

```
Proposed:
  [1] Header
  [2] Translate This Page button
  [3] One-line status bar (●  Connected · Pro)
  [4] Translation status card (only when active)
  [5] Language/mode controls
  [6] StudySection (deep-read CTA now in second screen)
  [7] <details> "More" — collapsed by default:
        - Video note creation
        - UsageInsightsCard
        - Status/Quota full diagnostics + iOS bridge
        - SiteSettingsSection
  [8] Auth section
  [9] Footer
```

Concretely this means:

1. **Wrap the video-note block** (~L1602–1646), the **full status/quota block** (~L1648–1792), the **UsageInsightsCard**, and **SiteSettingsSection** inside a single `<details><summary>More tools & diagnostics</summary>...</details>`.
2. **Extract a one-line status indicator** from the existing status block — the colored dot + `sessionStatusLabel · planLabel` — and render it *above* the `<details>`, immediately after the translate button. This is already computed (~L1329–1340) but currently rendered inside the heavy diagnostics block.
3. **Keep TranslationStatusCard and SimpleControls** in their current position (they're small and action-relevant).
4. **No logic changes.** All state, handlers, and props stay identical. This is a pure layout reorder + `<details>` wrapper.

---

## 2. Why This Moves the Score

The rubric has five dimensions scored 0–2. Current estimated breakdown:

| Dimension | Current | After | Δ |
|---|---:|---:|---:|
| First-touch clarity | 0.5 | 1.5 | +1.0 |
| Action hierarchy | 0.5 | 1.5 | +1.0 |
| On-page → control-center continuity | 1.0 | 1.0 | 0 |
| Deep reading workspace quality | 1.5 | 1.5 | 0 |
| Visual system coherence | 1.0 | 1.0 | 0 |
| **Total** | **4.5** | **6.5** | **+2.0** |

**Why first-touch clarity jumps:** Right now, a new user opens the popup and after tapping "Translate This Page," their eye lands on video-note creation and then 40+ lines of device diagnostics (iOS bridge status, bootstrap events, continuity sync cursors, device labels). None of this helps them learn what to do next. After the change, the second thing they see is the study hub with the "Deep Read" button and study-loop progress — the core learning flow.

**Why action hierarchy jumps:** The popup currently has ~8 call-to-action buttons visible before the user reaches StudySection: Translate, Create Video Note, Open Last Video Note, Open in Astra App, Replay Last Handoff, plus language/mode selectors. These all compete at equal visual weight. After collapsing, only Translate + Language Controls remain above the fold. The "Deep Read" CTA in StudySection becomes the obvious second action.

**Why this beats other candidate changes:**
- *Restyling DeepReadApp*: It already scores ~1.5/2 on workspace quality — diminishing returns.
- *Adding shared design tokens*: Important eventually but doesn't change the user's ability to find the workflow.
- *Redesigning StudySection internals*: The component is well-structured; it just needs to be visible.
- *Adding on-page affordances*: Would require content-script changes outside the stated scope.

Read Frog's competitive advantage is a **clean, focused product shell** — separate, purpose-built surfaces for host, side, and selection, with minimal noise in each. Astra's popup is the opposite: every feature crammed into one scrollable column. This change directly addresses that gap with the lowest risk.

---

## 3. Risks and Correctness Concerns

| Risk | Severity | Mitigation |
|---|---|---|
| **Users who rely on diagnostics** can't find them | Low | The `<details>` element is still in the popup, just collapsed. Power users click once to expand. |
| **Video note CTA discovery drops** | Low | Video notes are a secondary feature; users who need it will find it in "More." Consider adding a small "🎬" icon to the status bar if video tab is detected. |
| **iOS bridge bootstrap breaks** if DOM order changes | None | The handlers are event-based (`browser.runtime.sendMessage`), not DOM-dependent. Reordering JSX doesn't affect functionality. |
| **Existing tests break** | Low | The test suite uses `data-testid` attributes that are all inside StudySection and TranslationStatusCard — neither moves internally. Any tests asserting sequential DOM position of status elements may need updating. |
| **Popup height overflow** | None | We're *removing* visible content from above the fold, not adding. The popup gets shorter above the fold. |
| **Config persistence race** | None | No config or state logic changes. Pure JSX reorder + one `<details>` wrapper. |

---

## 4. Verification Steps

1. **Manual smoke test (popup):**
   - Open popup on a translatable page → confirm "Translate This Page" is visible at top, one-line status bar shows below it, StudySection is visible without scrolling past diagnostics.
   - Click `<details>` "More tools & diagnostics" → confirm video notes, full status block, usage insights, and site settings all appear.
   - Translate a page → confirm TranslationStatusCard still appears between status bar and controls.
   - Sign in/out → confirm auth section and status bar update correctly.

2. **Manual smoke test (deep-read):**
   - Click "Deep Read" in StudySection → confirm deep-read.html opens with correct study context (no regression from layout change).
   - Verify sentence deck, explain, save, and auto-play all function normally.

3. **Automated tests:**
   - Run existing popup test suite (`npm test` / `vitest`). Focus on:
     - `data-testid="study-sentence-*"` assertions (should pass unchanged)
     - Any snapshot tests on popup render (will need snapshot update)

4. **Visual check:**
   - Open popup at 280px and 400px width → confirm no horizontal overflow.
   - Confirm the `<details>` element respects the popup's existing font/spacing (uses `system-ui` family already set on the container).

---

## 5. Expected Score Delta

**+2.0 points** (from 4.5 → 6.5), driven entirely by first-touch clarity and action hierarchy.

This closes ~2/3 of the gap to Read Frog's 7.5 baseline. The remaining 1.0-point gap would require deeper work: shared design tokens for visual coherence (+0.5) and on-page → popup continuity improvements (+0.5) — both are good candidates for the next iteration but are higher-effort and higher-risk than this layout change.
