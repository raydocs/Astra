# AI Context: Reference and Artifact Index

This is a derived routing summary for reference artifacts, generated outputs, local runtime state, and caches. The canonical repository classification boundary is [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md).

These paths are conceptual `data/`-like context. They are not a physical `data/` directory and should not be default AI context.

## Committed reference artifacts

Read only for visual review, release verification, screenshot comparison, or asset review:

```text
ios/AstraShell Extension/Resources/
store/screenshots/
astra (ui)/uploads/
docs/design-comparison/*.png
```

`ios/AstraShell Extension/Resources/` is a committed Safari release/reference artifact synced from `.output/safari-mv3`; it is not disposable even though it is generated from build output.

## Generated/runtime outputs

Read only for artifact analysis, release verification, benchmark evidence, screenshots, or debugging a specific run:

```text
.output/
.wxt/
dist/
data/bench-results/
data/bench-live-results/
data/bench-live-results-test/
data/bench-opt-results/
coverage/
logs/
prompt-exports/
```

`prompt-exports/` contains local agent/oracle exports and measurement logs.

## Local runtime/tool state and caches

Default-exclude from broad exploration:

```text
data/server/
server/data/
.wrangler/
.playwright-mcp/
.codex/
.claude/
node_modules/
.pnpm-store/
.git/
.DS_Store
```

`data/server/` is local relay runtime state; `server/data/` is a legacy ignored local path. `.wrangler/` is local Cloudflare/Wrangler tool cache/state.
