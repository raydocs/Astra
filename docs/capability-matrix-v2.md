# Astra Capability Matrix v2

_Proposed protocol foundation for Astra v2 capability conquest._
_Last updated: 2026-05-27_

This matrix turns the v2 conquest plan into a decision-complete tracking sheet. It stays **protocol-first**: a capability is not considered conquered until it is measurable in deterministic bench, live, holdout, and proof lanes.

**Month 6 release note:** this file is a capability-progress view, not a release-claim override. If a row is stronger than the current evidence bundle or support matrix, the release-facing wording must be downgraded to match the proof. For reader/file claims, “Strong” means controlled proof lanes for PDF, EPUB, and `.srt/.vtt` subtitle-file flows; it does not turn parser conveniences such as ASS/Markdown/TXT/HTML, OCR, Docx, comic, or image translation into public support claims.

**Owned reading + subtitle chain (not a separate row here):** As of 2026-05-27 the repo has a unified **owned-reading** storage model and vocabulary Reading queue across article / PDF / EPUB / subtitle-file shapes, with honest limits on universal reopen (`month-3-closeout-inputs-2026-04-14.md`, `owned-reading-schema-v1-2026-04-14.md`). Required live evidence for that line is now `pnpm bench:live:lane:document-proof`, covering `bench-live/document-intake-basic` (PDF + EPUB + VTT intake plus unsupported DOCX boundary), `bench-live/document-intake-local-file-handoff`, `bench-live/pdf-reader-basic`, `bench-live/epub-reader-basic`, and `bench-live/subtitle-file-basic`; `bench-live/learning-loop-revisit-smoke` remains the Reading queue revisit smoke. The subtitle-reader → explain/save → vocab/review path for **files** is written in `subtitle-reader-learning-chain-2026-04-14.md`; **in-page** caption adapters are scoped separately (`video-subtitle-adapter-inventory-2026-04-15.md`, `support-matrix-video-addendum-2026-04-15.md`) and YouTube proof is now guarded by `pnpm bench:live:lane:youtube-proof`.

> 平台支持等级与对外 claim 边界不由本文件定义，统一以 `docs/investigations/support-matrix-2026-q2.md` 为 canonical 来源。

This file tracks the user-facing capability rows defined in `bench-opt/capabilities.ts`. Cross-cutting platform work such as managed-service routing, AI quality-control, and rules-system UX matters a lot, but it is tracked as a supporting execution stream rather than a separate capability row here.

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
| 网页翻译 | **Strong** — deterministic bench + live page translation already exist; article extraction and dynamic content are already in the bench surface inventory, and dedicated churn/layout-noise holdouts are green | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Bilingual / translation-only reading UX, context-aware reading flow, article-mode orientation | Core product surface with polished bilingual readability and dynamic page handling | `coverage`, `ux` | **B** | Article/feed/docs/dynamic page variants all green; dedicated page-translation holdout stress green; proof-suite content-reading prompts show no web-translation regressions |
| PDF 文件翻译 | **Strong** — PDF reader first cut now has deterministic bench, live reader flow, holdout layout-noise coverage, and capability-proof contribution | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Reading-oriented UX patterns are useful, but PDF is not the primary inspected Read Frog differentiator | Explicit product surface for layout-preserving PDF translation | `new-subsystem`, `runtime`, `protocol` | **B** | Bilingual + translation-only rendering stable; PDF extraction/order/alignment deterministic lanes green; PDF live reader lane green; multi-column and delayed-page holdouts green; proof-suite confirms document/PDF contribution |
| 视频双语字幕（YouTube 双语字幕） | **Strong** — the benchmarked YouTube bilingual subtitle path and learning-workspace proof lane are green end-to-end; runtime platform adapters now extend beyond YouTube, but broader platform coverage is not yet a separately conquered claim | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Read Frog explicitly highlights subtitle translation in the player flow | Explicit core video subtitle experience | `runtime`, `coverage`, `ux` | **B** | `bench:live:lane:youtube-proof` covers player button, bilingual subtitles, seek recovery, track switch, transcript panel, transcript search/jump, save sentence Review handoff, and video-note create; broader video platform support remains scoped by the support matrix |
| Epub 电子书双语翻译 | **Strong** — EPUB reader first cut now has deterministic bench, live reader navigation, long-chapter holdout coverage, and capability-proof contribution | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Reading-oriented, bilingual study workflows are directly relevant | Public document/reader translation surface | `new-subsystem`, `runtime`, `protocol` | **C** | Chapter extraction/order deterministic lanes green; live chapter navigation and reading-mode switching green; malformed/long-chapter holdouts green; proof-suite confirms reader-state contribution |
| 图片翻译 (Beta) | **Gap** | `bench=missing`, `live=missing`, `holdout=missing`, `proof=missing` | No primary image-translation reference surfaced in inspected Read Frog materials | Official beta image translation surface | `new-subsystem`, `runtime` | **D** | OCR/overlay beta benchmark lane exists; live static-image fixtures green; noisy-background and mixed-script holdouts meet beta threshold; failure categories are explicit |
| 漫画翻译 (Beta) | **Gap** | `bench=missing`, `live=missing`, `holdout=missing`, `proof=missing` | No primary comic translation reference surfaced in inspected Read Frog materials | Official beta comic translation surface | `new-subsystem`, `runtime`, `ux` | **D** | Panel/balloon fixture lanes exist; live comic page baseline green; overlapping-balloon and stylized-font holdouts reach beta-grade pass; protocol documents beta-only thresholds |
| 隐私模式 (Beta → core policy) | **Partial** — privacy-mode request-context sanitization exists for page translation and subtitle translation, popup study context suppresses richer fields in privacy mode, sensitive-input suppression exists for input translation, and the background transport boundary is authoritative for translation request context. Targeted live/holdout scenario paths exist for page-translation privacy, but current release evidence is not yet system-wide enough to market this as a strong privacy guarantee | `bench=partial`, `live=partial`, `holdout=partial`, `proof=partial` | Context-aware AI reading UX implies strong privacy expectations | Product positioning strongly implies privacy guarantees | `protocol`, `coverage`, `runtime` | **D** (standalone conquest) | Deterministic privacy assertions cover all major request surfaces; fresh live privacy replay artifacts are attached when a release wants to strengthen privacy wording; release docs can state the exact privacy boundary without over-claiming local-only or end-to-end secrecy |
| 鼠标悬停翻译 | **Strong** — deterministic hover support, live hover translation, moving-target holdouts, and proof contribution are green | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Inline / selection-adjacent UX is a strong inspiration source | Explicit hover-translation surface | `coverage`, `ux` | **C** | Live hover lane green; moving-target and overlay-interference holdouts green; no conflicts with selection/input/float-ball flows |
| 字幕文件翻译 | **Strong** — subtitle-file ingest/preview/export now has deterministic, live, holdout, and proof coverage across `.srt/.vtt` flows; ASS/Markdown/TXT/HTML parsing remains opportunistic convenience support | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Adjacent to subtitle concepts, but file ingest/export is a separate workflow | Public document/subtitle-file translation surface | `new-subsystem`, `runtime`, `protocol` | **C** | `.srt/.vtt` parser/serializer deterministic lanes green; upload/preview live flow green; malformed timing and overlapping-cue holdouts green; parse/translate/export failures are operator-visible; public claims name SRT/VTT unless separate proof is added |
| 输入框翻译 | **Strong** — deterministic bench + live input translation are stable, and the field-matrix holdout verifies contenteditable, delayed hydration, repeated edits, password suppression, and cursor preservation | `bench=green`, `live=green`, `holdout=green`, `proof=green` | Inline authoring assist and selection-adjacent UX offer strong interaction inspiration | Explicit input-box translation surface | `coverage`, `ux` | **B** | Textarea/contenteditable/cursor-preservation deterministic lanes green; multi-field live flow green; delayed hydration and repeated-edit holdouts green; reporting distinguishes trigger/translate/writeback failures |

## Cross-Cutting Platform Tracks

These tracks are real product work, but they are not separate capability rows in `bench-opt/capabilities.ts` yet. They support multiple rows at once and should be treated as execution streams that can block or de-risk conquest.

### Managed AI service routing depth

Status on **2026-05-27**: first managed-service hardening slice validated.

What is already true:

- ordinary product copy should present Astra-managed service modes rather than provider/model controls
- service fallback/retry metadata is implemented for operator diagnostics
- service-mode telemetry aggregates latency/failure/fallback by user-facing mode
- deterministic + targeted live evidence cover active-session service/site restart behavior
- fallback / restart / transport behavior are benchmark-visible in scoped slices rather than purely anecdotal

What is still missing:

- broader backend roster behind managed service modes
- per-surface preferred service policy beyond the first scheduler
- broader multi-event operator history / failure history beyond the current popup-local support path

### AI translation quality-control stack

Still open.

Main remaining gaps:

- glossary / terminology contract is now canonical at request-time, but still lacks stronger proof/guarantee language beyond the current runtime/tests
- stronger context shaping controls
- bad-output detection beyond current placeholder protections
- benchmark-visible rejection of obviously bad model output
- broader user-facing disclosure beyond the current popup-local support path when transport falls back from direct to relay

### Rules-system UX / discoverability

Runtime support is materially better than before, but UX remains behind a productized rules system.

Remaining gaps:

- clearer advanced-rules affordances
- rule validation feedback with examples
- diagnostics for matched / excluded / untranslated regions

## Wave Ownership

### Wave A — protocol freeze and decision-complete matrix
- Freeze this matrix.
- Keep `bench-opt/capabilities.ts` and this document aligned.
- Ensure every row has target behavior, harness-lane gap statement, and explicit exit criteria.

### Wave B — highest-leverage conquest
- 网页翻译
- PDF 文件翻译
- YouTube 双语字幕
- 输入框翻译

### Wave C — reading ecosystem
- EPUB 双语翻译
- 字幕文件翻译
- 鼠标悬停翻译

### Wave D — beta surfaces + privacy standalone conquest
- 图片翻译 (Beta)
- 漫画翻译 (Beta)
- 隐私模式 (Beta → core policy)

说明：这里的 Wave D 指的是把 privacy 作为**单独 capability row** 完整征服的时点；privacy gating 本身需要更早并行推进，并且可以阻断 Wave B/C 的扩面 claim。

## Capability-Level Exit Rule

A capability is only marked **conquered** when all four are true:

1. deterministic bench green
2. live standard lane green
3. hidden/holdout lane green
4. proof-suite family/tasks show no regressions caused by the capability

The capability must also be represented in:

- status / reporting / operator output
- benchmark pack protocol
- a visible rubric and a hidden robustness lane

Cross-cutting platform tracks do not need to become separate rows before shipping progress, but if they regress badly enough to invalidate a capability claim, the capability is not credibly conquered either.
