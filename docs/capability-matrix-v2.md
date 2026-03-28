# Astra Capability Matrix v2

_Proposed protocol foundation for Astra v2 capability conquest._
_Last updated: 2026-03-27_

This matrix turns the v2 conquest plan into a decision-complete tracking sheet. It is intentionally **protocol-first**: every capability must become measurable in deterministic bench, live, holdout, and proof lanes before Astra can claim the capability is conquered.

## Legend

### Astra current implementation status
- **Strong** — production-quality base already exists in-repo
- **Partial** — some runtime or harness support exists, but parity is incomplete
- **Gap** — capability is planned but not yet implemented or not yet represented in the harness

### Harness coverage status
- **green** — lane already exists and is trusted
- **partial** — lane exists but is not yet parity-grade
- **missing** — lane does not exist yet

### Gap classification
- `coverage` — feature exists but is under-tested
- `runtime` — product/runtime work is still missing
- `ux` — product polish or interaction quality gap
- `protocol` — harness/proof/reporting gap
- `new-subsystem` — new reader/ingest/OCR/class-specific subsystem required

## Capability Matrix

| Capability | Astra current implementation status | Current harness coverage (`bench`, `live`, `holdout`, `proof`) | Read Frog reference value | Immersive benchmark value | Gap classification | Conquest wave | Exit criteria |
|---|---|---|---|---|---|---|---|
| 网页翻译 | **Strong** — deterministic bench + live page translation already exist; article extraction and dynamic content are already in the bench surface inventory, and dedicated churn/layout-noise holdouts are now green | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Bilingual / translation-only reading UX, context-aware reading flow, article-mode orientation | Core product surface with polished bilingual readability and dynamic page handling | `coverage`, `ux` | **B** | Article/feed/docs/dynamic page variants all green; dedicated page-translation holdout stress green; proof-suite content-reading prompts show no web-translation regressions |
| PDF 文件翻译 | **Partial** — first-cut PDF runtime now exists with deterministic bench, live reader flow, and holdout layout-noise coverage; proof coverage is still missing | `bench=green`, `live=green`, `holdout=green`, `proof=missing` | Reading-oriented UX patterns are useful, but PDF is not the primary inspected Read Frog differentiator | Explicit product surface for layout-preserving PDF translation | `new-subsystem`, `runtime`, `protocol` | **B** | Bilingual + translation-only rendering stable; PDF extraction/order/alignment deterministic lanes green; PDF live reader lane green; multi-column and delayed-page holdouts green; proof-suite adds document/PDF contribution |
| 视频双语字幕（YouTube 双语字幕） | **Partial** — YouTube-specific bilingual subtitle runtime, deterministic bench, live lane, and holdout race coverage now exist; proof coverage is still partial | `bench=green`, `live=green`, `holdout=green`, `proof=partial` | Read Frog explicitly highlights subtitle translation in the player flow | Explicit core video subtitle experience | `runtime`, `coverage`, `ux` | **B** | Segment update/dedupe deterministic lanes green; YouTube-equivalent live lane green; burst-update / language-switch holdouts green; reporting treats subtitle robustness as its own scorecard line |
| Epub 电子书双语翻译 | **Gap** — current docs call out EPUB as planned; no dedicated reader harness yet | `bench=missing`, `live=missing`, `holdout=missing`, `proof=missing` | Reading-oriented, bilingual study workflows are directly relevant | Public document/reader translation surface | `new-subsystem`, `runtime`, `protocol` | **C** | Chapter extraction/order deterministic lanes green; live chapter navigation and reading-mode switching green; malformed/long-chapter holdouts green |
| 图片翻译 (Beta) | **Gap** | `bench=missing`, `live=missing`, `holdout=missing`, `proof=missing` | No primary image-translation reference surfaced in inspected Read Frog materials | Official beta image translation surface | `new-subsystem`, `runtime` | **D** | OCR/overlay beta benchmark lane exists; live static-image fixtures green; noisy-background and mixed-script holdouts meet beta threshold; failure categories are explicit |
| 漫画翻译 (Beta) | **Gap** | `bench=missing`, `live=missing`, `holdout=missing`, `proof=missing` | No primary comic translation reference surfaced in inspected Read Frog materials | Official beta comic translation surface | `new-subsystem`, `runtime`, `ux` | **D** | Panel/balloon fixture lanes exist; live comic page baseline green; overlapping-balloon and stylized-font holdouts reach beta-grade pass; protocol documents beta-only thresholds |
| 隐私模式 (Beta → core policy) | **Partial** — privacy-mode context sanitization already exists, but it is not yet a system-wide benchmark gate | `bench=partial`, `live=missing`, `holdout=missing`, `proof=partial` | Context-aware AI reading UX implies strong privacy expectations | Product positioning strongly implies privacy guarantees | `protocol`, `coverage`, `runtime` | **D** | Deterministic privacy assertions green across request surfaces; live privacy-mode toggles green; should-not-leak holdouts green; benchmark pack can fail on privacy regressions |
| 鼠标悬停翻译 | **Partial → strong** — deterministic hover support is implemented, and live + moving-target holdout lanes are now green; proof contribution remains the remaining gap | `bench=green`, `live=green`, `holdout=green`, `proof=partial` | Inline / selection-adjacent UX is a strong inspiration source | Explicit hover-translation surface | `coverage`, `ux` | **C** | Live hover lane green; moving-target and overlay-interference holdouts green; no conflicts with selection/input/float-ball flows |
| 字幕文件翻译 | **Partial** — first-cut subtitle-file runtime now exists with deterministic ingest/preview/export, and malformed-timing holdout coverage is green; proof coverage is still missing | `bench=green`, `live=green`, `holdout=green`, `proof=missing` | Adjacent to subtitle concepts, but file ingest/export is a separate workflow | Public document/subtitle-file translation surface | `new-subsystem`, `runtime`, `protocol` | **C** | `.srt/.vtt` parser/serializer deterministic lanes green; upload/preview live flow green; malformed timing and overlapping-cue holdouts green; parse/translate/export failures are operator-visible |
| 输入框翻译 | **Strong** — deterministic bench + live input translation already exist and are stable, and the field-matrix holdout now verifies contenteditable, delayed hydration, repeated edits, password suppression, and cursor preservation | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Inline authoring assist and selection-adjacent UX offer strong interaction inspiration | Explicit input-box translation surface | `coverage`, `ux` | **B** | Textarea/contenteditable/cursor-preservation deterministic lanes green; multi-field live flow green; delayed hydration and repeated-edit holdouts green; reporting distinguishes trigger/translate/writeback failures |

## Wave Ownership

### Wave A — protocol freeze and decision-complete matrix
- Freeze this matrix.
- Add capability registry, capability verdicts, and operator-facing capability status.
- Ensure every row has a target behavior, harness-lane gap statement, and explicit exit criteria.

### Wave B — highest-leverage conquest
- 网页翻译
- PDF 文件翻译
- YouTube 双语字幕
- 输入框翻译

### Wave C — reading ecosystem
- EPUB 双语翻译
- 字幕文件翻译
- 鼠标悬停翻译

### Wave D — beta surfaces and privacy policy
- 图片翻译 (Beta)
- 漫画翻译 (Beta)
- 隐私模式 (Beta → core policy)

## Capability-Level Exit Rule

A capability is only marked **conquered** when all four are true:

1. deterministic bench green
2. live standard lane green
3. hidden/holdout lane green
4. proof-suite family/tasks show no regressions caused by the capability

The capability must also be represented in:
- status/reporting/operator output
- benchmark pack protocol
- a visible rubric and a hidden robustness lane
