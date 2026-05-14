# AI Context: Generated, Runtime, Cache, and Result Paths

This derived routing summary lists paths that should **not** be handed to AI by default. The canonical repository classification boundary is [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md).

These paths are conceptual `data/`-like context. They are not a physical `data/` directory and this doc does not imply any move.

## Local package/tool caches

```text
node_modules/
.pnpm-store/
.playwright-mcp/
.codex/
.claude/
.git/
.DS_Store
```

## Build outputs and generated framework state

```text
.output/
.wxt/
dist/
coverage/
```

## Bench, optimizer, and run results

```text
data/bench-results/
data/bench-live-results/
data/bench-live-results-test/
data/bench-opt-results/
.bench-opt/
logs/
prompt-exports/
```

`prompt-exports/` contains local generated agent/oracle exports and measurement logs.

## Local runtime state

```text
data/server/
server/data/
```

`data/server/` is the default local relay runtime state; `server/data/` is a legacy local path kept ignored and should not be default AI context.

## Local Cloudflare/tool state

```text
.wrangler/
```

`.wrangler/` is local Wrangler/Cloudflare tool cache/state.

## iOS/Xcode generated output

```text
ios/build/
DerivedData/
```

## Committed release or reference artifacts

These are not disposable, but they are also not default source context:

```text
ios/AstraShell Extension/Resources/
store/screenshots/
astra (ui)/uploads/
docs/design-comparison/*.png
```

`ios/AstraShell Extension/Resources/` is a committed Safari release/reference artifact synced from `.output/safari-mv3`; it is not disposable generated-only output.

Use these only for release verification, generated bundle drift, app-store assets, screenshot review, or visual comparison tasks. See [`reference-index.md`](./reference-index.md) for artifact routing details.

## Measurement

To see current local disk distribution:

```bash
pnpm -s repo:size
```

This is read-only. It does not clean, delete, move, or modify files.
