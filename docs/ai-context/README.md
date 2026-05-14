# AI Context Directory

This directory is an AI-facing context index for Astra. It does **not** duplicate, move, or redefine the real project structure. Use it to decide which source, UI, planning, reference, generated, runtime, and cache paths to hand to an AI agent.

These short AI-context docs are derived routing summaries. If a summary disagrees with the canonical policy, treat [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md) as the source of truth.

## Conceptual four-bucket model

The `data/script/docs/src` model is conceptual first, with owned source/config/tooling now physically consolidated where practical:

- `src/` — product/runtime source roots.
- `script/` — automation, CI, harness, deploy, build, and verification tooling.
- `docs/` — plans, specs, reviews, investigations, ADRs, analysis, and documentation.
- `data/` — generated outputs, local runtime state, caches, result artifacts, and committed reference artifacts.

## Files

- [`source-code.md`](./source-code.md) — source-code paths grouped by product/task area.
- [`source-ui.md`](./source-ui.md) — runtime UI paths and design-reference routing.
- [`planning-index.md`](./planning-index.md) — planning/spec/review/investigation routing.
- [`reference-index.md`](./reference-index.md) — committed reference artifacts, screenshots, generated outputs, and local state routing.
- [`generated-runtime-cache.md`](./generated-runtime-cache.md) — runtime packages, caches, build outputs, result folders, and reference artifacts that AI should not read by default.

## Rule of thumb

1. Start with `AGENTS.md`, the docs index [`docs/README.md`](../README.md), and this directory.
2. Pick the smallest relevant source/UI/planning set for the task.
3. Avoid generated/runtime/cache/reference paths unless the task specifically asks about build outputs, artifacts, screenshots, release verification, or measurements.

For the canonical classification policy, see [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md).
