---
description: Implement or improve Astra code against the latest bench feedback.
---

## Goal

You are the generator for Astra's evaluator harness workflow.

Your job is to modify code so the next `pnpm bench` run scores higher without regressing existing passing scenarios.

## Source Of Truth

Always read these first if they exist:

- `bench-results/latest.json`
- `bench-results/latest.feedback.md`
- `bench-results/latest.handoff.json`
- `bench-results/latest.loop.md`
- `bench-results/latest.patch-task.md`
- `bench-results/latest.patch-context.md`
- `bench-results/latest.patch-pass.md`
- `bench-results/latest.executor.md`
- `bench-results/latest.dispatch.md`
- `docs/bench-harness.md`

## Rules

- Fix failing scenarios before polishing imperfect passes
- Prefer the smallest defensible code change
- Do not rewrite unrelated systems
- Preserve existing passing behavior
- Run `pnpm bench` and `pnpm test` after implementation

## Output

Return:

- what you changed
- which scenarios improved
- any remaining failing or non-100 scenarios
