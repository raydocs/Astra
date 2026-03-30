# Astra Competitive Gap Backlog — 2026-03-28

_Last updated: 2026-03-30_

This backlog tracks the highest-value **remaining** product gaps versus Immersive Translate after the recent Astra improvements to:

- rich-text placeholder preservation and malformed fallback
- advanced site rules (`selectors`, `excludeSelectors`, `paragraphMinLength`)
- invalid selector validation + runtime ignore behavior
- storage-backed active-session restart
- SPA restart consistency + rapid navigation dedupe

The intent is to keep the next wave focused on **remaining competitive gaps**, not already-closed harness debt.

---

## 0. What is no longer the main gap

These areas were previously meaningful parity gaps, but are no longer the top blockers after the latest work:

- page-translation anti-encoding / rich-text placeholder preservation
- malformed placeholder fallback safety
- site advanced rules runtime support
- invalid selector resilience
- active-session restart correctness after site-rule changes
- SPA navigation restart stability

These should stay maintained, but they are no longer the highest-leverage competitive delta.

---

## 1. Current competitive priority order

### P0 — clear product-surface gaps
1. **Image translation / OCR**
2. **Comic translation**
3. **Broader document translation product surface**

### P1 — strong quality / ecosystem differentiators
4. **Provider breadth and service routing depth**
5. **AI translation quality-control stack**
6. **Video AI subtitle generation + broader platform coverage**

### P2 — productization and operator polish
7. **Rules-system UX depth and discoverability**
8. **Privacy mode promotion from partial → full product gate**

---

# Track P0-A — Image Translation / OCR

## Why this matters
Immersive has a visible image-translation surface. Astra currently has no comparable subsystem in runtime or harness.

## Runtime
- Build image ingest pipeline for static images
- Add OCR extraction layer
- Add translated overlay rendering layer
- Define failure taxonomy:
  - OCR failure
  - detection failure
  - overlay collision
  - mixed-script corruption

## Bench
- Add deterministic image fixtures:
  - clean screenshot
  - noisy background
  - mixed Chinese/English/Japanese text
  - dense UI screenshot
- Add evaluator dimensions:
  - OCR recall
  - overlay placement sanity
  - token leakage / corruption

## Live
- Add source-backed static image translation live scenario
- Persist artifacts:
  - source image
  - OCR boxes
  - translated overlay screenshot

## Holdout
- Low-contrast image
- Stylized font image
- Background-text collision image
- Mixed vertical/horizontal text

## UX
- Add image upload / paste / right-click entry
- Add overlay visibility toggle
- Add source/translation compare mode

## Exit criteria
- deterministic image suite green
- live baseline green
- noisy/stylized holdouts pass beta threshold
- failure reasons become operator-visible

---

# Track P0-B — Comic Translation

## Why this matters
This is a distinct product surface, not just “image translation with more text”. Balloon detection, panel reading order, and stylized text handling make it a separate subsystem.

## Runtime
- Add panel / balloon segmentation abstraction
- Handle overlapping balloons
- Handle stylized text fallback
- Separate dialogue text from decorative on-page text where possible

## Bench
- Create comic page fixtures:
  - clean manga page
  - overlapping balloons
  - stylized fonts
  - SFX-heavy page
- Add evaluator checks for:
  - balloon coverage
  - obvious order corruption
  - overlay readability

## Live
- Add single-page comic live scenario
- Capture before/after screenshots + OCR/balloon debug artifacts

## Holdout
- overlapping balloons
- skewed panels
- handwritten / stylized dialogue
- vertical-layout dialogue blocks

## UX
- Beta badge
- explicit “best effort” messaging
- overlay readability controls

## Exit criteria
- comic-specific deterministic suite exists
- live single-page baseline passes
- overlap / stylized holdouts reach beta-grade stability

---

# Track P0-C — Document Translation Product Surface Expansion

## Why this matters
Astra is already strong in PDF/EPUB/subtitle-file reading flows, but still lacks a broader document-translation product comparable to the competitor’s more complete document stack.

## Runtime
- Expand beyond current PDF/EPUB/subtitle-file readers
- Evaluate additional ingest/export surfaces:
  - Markdown
  - HTML
  - plain text
  - doc-like structured import/export path
- Improve document-level layout preservation contract
- Evaluate OCR-assisted document path for scanned PDFs

## Bench
- Add document fixture families per file type
- Add evaluator checks for:
  - block order
  - formatting preservation class
  - translation-only vs bilingual rendering fidelity

## Live
- File-open live flows per added type
- Artifacts: imported file, rendered output, translated export when supported

## Holdout
- scanned PDF
- multi-column PDF
- table-heavy content
- mixed code + prose Markdown

## UX
- unify document entry model
- explicit supported-format matrix in UI
- export affordances and failure messaging

## Exit criteria
- broader file-type matrix is real, not only planned
- layout-preservation expectations become measurable
- scanned-PDF/OCR decision path is explicit

---

# Track P1-A — Provider Breadth / Routing Depth

## Why this matters
Astra currently exposes only `openai` and `gemini` in config/runtime. That is materially narrower than the competitor’s provider ecosystem.

## Runtime
- Expand provider registry beyond current pair
- Add normalized provider capability metadata:
  - supports chat translation
  - supports rich-text placeholder fidelity
  - supports long-context document work
  - latency / cost classification
- Add routing policy hooks:
  - manual switch
  - per-surface preferred provider
  - explicit fallback chain

## Bench
- Add provider capability proof / conformance checks
- Add graceful fallback evaluator for provider failure / quota / bad output

## Live
- Add provider-switch live scenario on active session
- Add bad-provider → fallback-provider live scenario

## Holdout
- 429 / quota rejection
- malformed structured output
- provider timeout
- provider returns untranslated source

## UX
- provider matrix in options
- explicit capability badges
- operator-visible failure / fallback history

## Exit criteria
- provider count is meaningfully broader
- fallback chain is real and benchmarked
- routing rules become user-visible and operator-visible

---

# Track P1-B — AI Translation Quality-Control Stack

## Why this matters
Placeholder safety is now much better, but Astra still lacks a richer user-facing translation quality system around context, terminology, and output validation.

## Runtime
- Add terminology / glossary contract
- Add per-request context shaping options:
  - title context
  - summary context
  - domain / style hints
- Add output sanity gates:
  - unchanged-source detection
  - suspicious-length-ratio detection
  - malformed-structure detection beyond current placeholder path

## Bench
- Add deterministic scenarios for:
  - glossary enforcement
  - length-ratio anomaly detection
  - untranslated-source rejection
  - title/summary-context quality-sensitive prompts

## Live
- Add glossary live scenario
- Add bad-output detection live scenario

## Holdout
- model echoes source text
- model drops half the paragraph
- model duplicates content
- model breaks structured placeholder contract in non-rich-text prompts

## UX
- glossary editor
- quality policy toggles
- visible failure reason and retry/fallback affordances

## Exit criteria
- Astra can prove not just “it translated” but “it rejected obviously bad AI output”
- terminology and context controls become first-class surfaces

---

# Track P1-C — Video AI Subtitles + Broader Platform Coverage

## Why this matters
Astra has a solid subtitle base, but current in-repo platform coverage is still limited and does not yet represent a broader AI-subtitle product layer.

## Runtime
- Expand beyond current platform set
- Explore AI subtitle generation / regeneration path when native subtitles are absent or weak
- Add stronger subtitle prefetch / batch flow where possible

## Bench
- Add platform-agnostic subtitle-generation scenarios
- Add latency and de-duplication score lines distinct from page translation

## Live
- Add one non-YouTube platform live lane from the broader coverage target list
- Add AI-subtitle fallback live lane for weak-caption pages

## Holdout
- subtitle source race
- missing subtitle track
- partial / delayed subtitle payload
- repeated segment churn

## UX
- clear distinction between native caption translation and AI-generated captions
- generation-status UI
- source/subtitle confidence messaging

## Exit criteria
- video is no longer “works on a few platforms”; it becomes a real product surface
- AI subtitle fallback path is benchmarked and user-visible

---

# Track P2-A — Rules-System UX / Discoverability

## Why this matters
Astra runtime support is now much stronger, but the overall rules-system experience is still behind a mature productized rules ecosystem.

## Runtime
- keep current runtime behavior stable
- add clearer telemetry on rule application and rejection

## Bench
- add scenarios that verify user-visible rule feedback rather than only runtime effects

## Live
- rule-edit → visible outcome scenarios across more entrypoints

## Holdout
- conflicting include/exclude rules
- no-match selectors
- rapidly edited rules

## UX
- clearer advanced-rules affordance
- rule validation feedback with examples
- site-level diagnostics: what matched, what was excluded, why nothing translated

## Exit criteria
- rules stop being “expert-only hidden knobs” and become understandable tools

---

# Track P2-B — Privacy Mode: Partial → Full Gate

## Why this matters
Privacy behavior is materially improved, but still treated as partial in the capability matrix.

## Runtime
- audit all translation request surfaces
- ensure privacy mode is enforced consistently across future new surfaces

## Bench
- add privacy assertions as mandatory gates, not optional spot checks

## Live
- add privacy-toggle scenarios across each major surface family

## Holdout
- should-not-leak regressions for every new subsystem

## UX
- make privacy mode consequences explicit in UI
- show when a request was sanitized

## Exit criteria
- privacy becomes a release-blocking product property, not a partially-covered promise

---

## 2. Recommended execution order

Note: the priority buckets above describe **what remains strategically important**. The near-term execution order below describes **what should run first**. Privacy remains a later standalone conquest track, but its governance gate should start earlier and can block expansion claims.

### Near-term execution order
1. **P1-A Provider breadth / routing depth**
2. **P1-B AI translation quality-control stack**
3. **P2-B Privacy full gate + P2-A rules-system UX**
4. **P1-C Video AI subtitles + broader coverage**
5. **P0-C Document surface expansion**
6. **P0-A Image translation / OCR**
7. **P0-B Comic translation**

### Why this order
- Provider and quality-control work improve the current core product fastest.
- Privacy full gate should not wait until the end of the roadmap; it needs to run in parallel with provider/quality work and can block expansion claims.
- Rules UX is grouped with privacy here because both affect whether Astra behaves like a mature product instead of a stack of expert toggles.
- Video expansion reuses existing subtitle foundations.
- Document/image/comic expansion are bigger subsystem bets and should start after the main translation core and governance gates are harder to break.

---

## 3. Explicit non-goals for this wave

Do **not** re-open already-closed work unless there is a regression:

- rich-text placeholder preservation
- malformed placeholder fallback
- site-rule restart correctness
- invalid selector handling
- rapid SPA restart dedupe

If those regress, fix them as regressions, not as new epics.

---

## 4. Source anchors

### In-repo anchors
- `docs/capability-matrix-v2.md`
- `src/types/config.ts`
- `src/utils/providers/router.ts`
- `src/entrypoints/content/video-platforms/index.ts`

### Competitor reference anchors
- Immersive FAQ
- Immersive advanced customization docs
- Immersive prompt configuration docs
- Immersive services docs
- Immersive image-translation docs

Use those materials as competitive reference, but keep Astra planning grounded in measurable exit criteria.
