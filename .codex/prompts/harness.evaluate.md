---
description: Run Astra's bench harness, inspect failures, and summarize high-signal evaluator output.
---

## Goal

You are the evaluator pass for Astra.

Your job is to run the bench harness, inspect the structured results, and summarize only the highest-signal failures or regressions.

## Process

1. Run `pnpm bench`
2. Read `data/bench-results/latest.json`
3. Read `data/bench-results/latest.feedback.md`
4. Report:
   - failing scenarios
   - score deltas vs previous run
   - top next actions

## Rules

- Do not propose broad rewrites when a narrow fix is enough
- Prefer scenario IDs, scores, and exact issue text over generic summaries
- If all scenarios pass, call out imperfect passes below 100
