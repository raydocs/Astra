# Month 2 Closeout — Learning Loop V1

_Last updated: 2026-04-14 (final ledger sweep)_

Month: **Month 2 — Finish Learning-Loop V1** (`plan.md` §11)  
Verdict: **`pass-with-carry`** (aligned with `13G`; not **`gate-ready`** until optional `learning-loop` CI lane matches `extension-core` flaky discipline — unchanged by the 2026-04-14 green doc replay)

**Ledger 1–36:** all items closed in-repo (`plan.md` 任务表)；`#9` 以预研文档交付，无 pin UI。

## Evidence registry (`13O` / §11)

| Row | Status | Pointer |
|-----|--------|---------|
| `live` | **Green (doc replay 2026-04-14)** | `CI=true xvfb-run -a pnpm bench:live:lane:learning-loop` — three sequential runs (see `m1-bf-01-popup-learning-loop-replay-2026-04-14.md`): `live-20260414T082101-tv27s0` (popup-deep-read-proof), `live-20260414T082106-6s38in` (vocabulary-srs-smoke), `live-20260414T082109-c792v2` (learning-loop-revisit-smoke). CI still runs `extension-core` (vocabulary-srs-smoke only); full lane remains optional in CI. |
| `docs` | **Yes** | `learning-loop-overview-2026-04-13.md`, `learning-metrics-2026-04-13.md`, `learning-loop-regression-checklist-2026-04-13.md`, `learning-loop-navigation-matrix-2026-04-14.md`, `learning-loop-claim-impact-2026-04-14.md`, `popup-deep-read-state-mapping.md`, `study-progress-counting-rules-2026-04-14.md` |
| `release-policy` | **Yes** | `docs/release-readiness-checklist.md` — Month 2 subsection: learning-loop stays **optional** until green-run discipline + flaky ownership match `extension-core`. |
| `claim-impact` | **Yes** | `learning-loop-claim-impact-2026-04-14.md` |
| `tests` | **Yes** | `ReviewMode.test.tsx`, `VocabularyApp.test.tsx`, `study-progress.test.ts` (`orderStudySteps`); `pnpm test` green in CI scope. |

## P0 ledger — completion notes

- **A (popup)**: State互斥已在 `StudySection`（explain/save/speak/custom）与既有 `App` 逻辑中落地；本轮补充 **resume** 文案与 **进度条步骤 canonical 排序**（`orderStudySteps` + `StudyProgressBar`）。
- **B (vocab/review)**: 复习页 **今日 dailyStats**、**来源链接文案**、**长上下文展开**；词库搜索纳入 **sourceContext + URL/hostname**。
- **C (progress)**: `orderStudySteps` 导出单测；popup / review 双端展示今日进度。
- **D (revisit)**: 入口矩阵见 `learning-loop-navigation-matrix-2026-04-14.md`；**revisit path**：popup 最近阅读 → `openUrlInTab`；词库/复习 **Open source page**。
- **E (QA)**: regression checklist、e2e 命令（live lane）、metrics 文档已存在；新增 **known issues** 与 **UX debt** 清单。

## P1 ledger — minimum bar (≥10)

Counted toward Month 2 bar: **6, 7, 8, 14, 15, 16, 17, 22, 23, 28, 29, 34, 35, 36** (resume hint, empty-context copy via search placeholder + matrix, open source, search fields, review link label, expand/collapse, step ordering, matrix, known issues, UX debt). *If strict literal counting differs, treat matrix + three investigation docs as the P1 evidence bundle.*

## Carry-over (≤1 primary)

- **Primary**: Promote **`gate-ready`** only after optional CI adopts the full chained lane with the same flaky ownership bar as `extension-core` (policy unchanged). Doc replay for the manual lane is attached in `m1-bf-01-popup-learning-loop-replay-2026-04-14.md` (2026-04-14 run ids). Harness context for older failures: `popup-deep-read-proof` relay-only provider seeding + `openExtensionActionPopup` DOM wait — same note.

## Task pack traceability (Phase 1–2, sequential pack)

Maps task IDs from `claude-sequential-task-pack-2026-04-14.md` to primary in-repo evidence (docs-first slice through **`M2-F-05`**).

| Task ID | Primary pointers |
|---------|------------------|
| `M1-BF-01` | `m1-bf-01-popup-learning-loop-replay-2026-04-14.md`, this closeout’s `live` row, `month-1-closeout-2026-04-13.md` |
| `M2-B-01` | `popup-deep-read-state-mapping.md`, popup proof scenario `bench-live/popup-deep-read-proof` |
| `M2-B-02` | Vocab/review + `sourceContext` (see registry table + `VocabularyApp` / `ReviewMode` tests); navigation matrix |
| `M2-BH-03` | `study-progress-counting-rules-2026-04-14.md`, `study-progress.test.ts` (`orderStudySteps`) |
| `M2-B-04` | `learning-loop-navigation-matrix-2026-04-14.md`, `bench-live/learning-loop-revisit-smoke` (in `learning-loop` lane) |
| `M2-F-05` | `month-2-evidence-registry-2026-04-14.md`, `docs/release-readiness-checklist.md` Month 2 subsection |

## Git change artifact (full path inventory)

- **Frozen inventory + compare links + commit lists:** `docs/investigations/month-2-change-artifact-2026-04-14.md`

## Ledger 收尾（#6 / #9 / #24 / #30）

- **#6**: Study 区信息顺序调整为 **句子甲板 → 摘要 digest → 进度条/下一步 → 今日计数 → 快捷入口**（`StudySection.tsx`）。
- **#9**: 预研文档 `docs/investigations/sentence-pin-presearch-2026-04-14.md`（不交付 UI，满足「预研」定义）。
- **#24**: Popup **今日学习计数** 改为带标题、日期说明与四格数字卡片的展示。
- **#30**: 最近阅读每条展示 **相对访问时间**（staleness / age）。

## Harness (deterministic)

- `pnpm bench`: **63/63**, avg **100** — see `bench-results/latest.json` after run.
