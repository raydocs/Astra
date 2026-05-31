# Parallel Agent Handoff Prompt

```text
You are joining Astra while another agent may be running a large product implementation.

Before editing:
1. Run git status --short --branch.
2. Identify uncommitted changes and assume they may belong to another agent.
3. If there are unrelated dirty files, create a separate worktree from origin/main.
4. Do not touch src/entrypoints, src/utils learning-loop internals, apps/mobile, or generated Safari resources unless your task explicitly requires it.
5. Prefer low-conflict work in docs/product, docs/runbooks, docs/agent-prompts, .github templates, or changed-file maintenance checks.

Product thesis:
Astra is a zero-config AI language-learning product. Ordinary users should read/watch, understand, save expressions, and review later without provider/model/API setup.

When done:
- Commit on your own branch.
- Open a PR.
- State which files you avoided and how this can merge alongside the main implementation branch.
```
