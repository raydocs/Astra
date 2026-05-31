# Parallel Agent Integration Runbook

Use this when multiple agents work on Astra at the same time. The goal is to keep Claude/UltraCode implementation work, review docs, and release assets from overwriting each other.

## Branch model

Use separate branches by work type:

| Work type | Branch example | Merge target |
|---|---|---|
| Main product implementation | `astra-product-completeness-main-path` | `main` |
| Product guardrails/docs | `astra-product-quality-guardrails` | `main` |
| Backlog/strategy docs | `astra-parallel-product-backlog` | `main` |
| Web deploy polish | `astra-web-landing-polish` | `main` |

If the active working tree has another agent’s uncommitted changes, create a separate worktree:

```bash
mkdir -p .worktrees
git worktree add -b astra-my-parallel-task .worktrees/astra-my-parallel-task origin/main
```

## Do not touch rules

When another agent is running product implementation, avoid:

- `src/entrypoints/**`
- `src/utils/**` learning loop internals
- `apps/mobile/**`
- generated Safari resources
- files the other branch already changed

Prefer:

- `docs/product/**`
- `docs/runbooks/**`
- `docs/agent-prompts/**`
- `.github/**` templates
- focused maintenance scripts with changed-file behavior

## Before committing

Run:

```bash
git status --short --branch
git diff --check
```

If public copy or docs changed:

```bash
pnpm check:product-copy
pnpm check:repo-knowledge
```

If package/scripts changed:

```bash
pnpm exec tsc --noEmit --pretty false
```

## PR body expectations

Every parallel-agent PR should state:

- which branch/workstream it is independent from;
- which files it intentionally avoided;
- whether it touches runtime code;
- which checks ran;
- merge-order notes.

## Merge-order guidance

- Pure docs/QA PRs can merge before or after implementation PRs.
- Guardrail scripts should merge before large product PRs if they help review.
- If two PRs add docs under the same folder, resolve by keeping both documents unless they duplicate the same purpose.
- Never resolve conflicts by deleting another agent’s implementation without explicit owner approval.

## Recovery from accidental branch mix

If a commit lands on the wrong branch but only contains independent docs:

```bash
git switch target-branch
git cherry-pick <commit>
```

Then decide whether to revert/drop it from the original branch only after confirming no other agent depends on it.
