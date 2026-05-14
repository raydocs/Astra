# Astra Plans Index

`docs/plans/` contains implementation plans, future-work checklists, and planning records that are useful as documentation context. Plans may be active, deferred, completed, or historical; read the plan status and date before treating it as current work.

## Planning conventions

Prefer plans that state:

- affected files or roots,
- whether the scope is behavior-preserving or behavior-changing,
- validation commands,
- acceptance criteria or done-when criteria.

When relevant, use sections such as `Implementation Progress`, `Acceptance criteria`, or `Done when` to make status clear.

## Relationship to top-level `plans/`

The top-level [`../../plans/`](../../plans/) directory is legacy/transitional planning history. Do not move it as part of docs-only work. Use it only when a task explicitly references older planning history, such as [`../../plans/learning-loop-month-plan-2026-04-15.md`](../../plans/learning-loop-month-plan-2026-04-15.md).

## Current index

- [`repo-four-bucket-migration-checklist.md`](./repo-four-bucket-migration-checklist.md) — future-only checklist for any later physical migration toward the conceptual `data/script/docs/src` model.
- [`ui-backed-product-gaps-2026-05-13.md`](./ui-backed-product-gaps-2026-05-13.md) — representative UI-backed product-gap plan.

## Done-when convention for future plans

A future plan is ready to implement when it identifies affected roots, states behavior-preservation or behavior-change scope, lists validation commands, and separates documentation-only work from runtime/source/config changes.
