---
description: Run a minimal generator-evaluator loop for Astra using the latest bench artifacts.
---

## Goal

Run Astra's minimal evaluation-driven loop:

```text
implement -> pnpm bench -> inspect feedback -> refine -> pnpm bench -> pnpm test
```

## Process

1. Read:
   - `docs/bench-harness.md`
   - `data/bench-results/latest.json` if present
   - `data/bench-results/latest.feedback.md` if present
   - `data/bench-results/latest.handoff.json` if present
   - `data/bench-results/latest.generator.md` if present
   - `data/bench-results/latest.loop.json` if present
   - `data/bench-results/latest.loop.md` if present
   - `data/bench-results/latest.patch-task.md` if present
   - `data/bench-results/latest.patch-context.md` if present
   - `data/bench-results/latest.patch-pass.md` if present
   - `data/bench-results/latest.executor.md` if present
   - `data/bench-results/latest.dispatch.md` if present
2. Fix regressions and failing scenarios before touching imperfect passes
3. Implement the smallest change set that should improve the current highest-priority scenarios selected by the loop runner
4. Use `latest.patch-task.md` as the current focused patch brief
5. Use `latest.patch-context.md` as the first code context bundle before widening scope
6. Use `latest.patch-pass.md` as the most compact execution brief
7. Read `latest.executor.md` and respect its gate: if it says blocked, do not auto-edit blindly
8. If the gate is ready and credentials are configured, run `pnpm bench:dispatch`
9. Run `pnpm bench`
10. Run `pnpm bench:loop`
11. If failures or regressions remain, use `latest.loop.json`, `latest.loop.md`, `latest.patch-task.md`, `latest.patch-context.md`, `latest.patch-pass.md`, `latest.executor.md`, and `latest.dispatch.md` as the handoff for the next pass
12. When bench is clean enough, run `pnpm test`

## Stop Conditions

- stop when all bench scenarios pass and `pnpm test` passes
- or stop when the next change would require a wider architectural decision

## Rules

- Treat bench artifacts as the evaluator truth
- Treat `latest.handoff.json` as the priority order and `latest.feedback.md` as the detailed explanation
- Treat `latest.loop.json` / `latest.loop.md` as the current single-round execution plan
- Treat `latest.patch-task.md` as the focused code-change brief for the current pass
- Treat `latest.patch-context.md` as the first-pass code context bundle
- Treat `latest.patch-pass.md` as the compact executor brief
- Treat `latest.executor.md` as the final go/no-go gate for automatic patch attempts
- Treat `latest.dispatch.md` as the external model output, not as source of truth by itself
- Do not add new surfaces to the harness while fixing an existing failing run unless explicitly requested
- Keep changes tightly scoped to the scored behavior
