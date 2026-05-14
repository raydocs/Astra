# AI Context: Planning Index

This is a derived routing summary for planning-oriented context. The canonical repository classification boundary is [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md).

Use the smallest planning context that answers the task. Add source bundles from [`source-code.md`](./source-code.md) only when implementation details are needed.

## Planning routes

| Need | Start with | Notes |
|---|---|---|
| Implementation plans or future-work checklists | [`../plans/`](../plans/) and [`../plans/README.md`](../plans/README.md) | Prefer dated plans with explicit done-when or acceptance criteria. |
| Research, support matrices, classification, gap analysis | [`../investigations/`](../investigations/) | Use the classification boundary for read-priority decisions. |
| Critiques, reviews, certification notes | [`../reviews/`](../reviews/) | Pair with source only when verifying a current claim. |
| Product/API/architecture contracts | [`../specs/`](../specs/), [`../adr/`](../adr/) | Use when behavior or architecture decisions are in scope. |
| Older planning history | [`../plans/history/`](../plans/history/) | Historical; read only when explicitly referenced or clearly relevant. |

## Four-bucket planning lens

The `data/script/docs/src` model is conceptual, not physical:

- `docs/` planning context lives under `docs/`, including historical plans in `docs/plans/history/`.
- `src/` context comes from source-bearing roots only when an implementation task needs it.
- `script/` context comes from automation, CI, bench, deploy, or verification roots.
- `data/` context is generated evidence, local runtime state, screenshots, or reference artifacts and is not default planning context.

Do not include generated result directories unless the task asks about run evidence, screenshots, release verification, or artifact analysis.
