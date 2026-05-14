# AI-Readable Classification Boundary

Last updated: 2026-05-14

## Purpose

This document is Astra's canonical read-priority map for AI/code-agent repo exploration. It classifies directories and important top-level files into source-priority/default-read, task-specific source, reference artifacts, generated/runtime output, and local tool caches.

This is a **classification and read-priority plan only**. It is not permission to delete, move, ignore, or stop committing release artifacts. In particular, committed release verification assets such as `ios/AstraShell Extension/Resources` remain important even when they are not default AI read context.

## Conceptual four-bucket model

Astra can be explained through four conceptual buckets. These buckets describe repository knowledge while the physical layout keeps convention-bound roots where needed.

| Conceptual bucket | Meaning | Current examples |
|---|---|---|
| `src/` | Product/runtime source and source-bearing assets. | `src/`, `src/web/src/`, `src/web/public/`, `public/`, `src/server/`, task-specific `src/platform/*/src/`. |
| `script/` | Automation, CI, build, deployment, benchmark harness, verification tooling, and optimizer config. | `.github/`, `script/maintenance/`, `ios/scripts/`, `script/bench/`, `script/bench-live/`, `script/bench-opt/`, `script/bench-opt/config/`. |
| `docs/` | Documentation, plans, specs, ADRs, investigations, reviews, and analysis. | `docs/`, including `docs/plans/history/`. |
| `data/` | Generated outputs, local runtime state, caches, result artifacts, and committed reference artifacts. | `.output/`, `.wxt/`, `dist/`, `data/server/`, legacy `server/data/`, bench result folders, `store/screenshots/`, `ios/AstraShell Extension/Resources/`. |

Read-priority categories below decide whether to inspect a path for a task. The four buckets explain what kind of repository knowledge a path represents.

## Derived routing summaries

Short AI-context summaries derive from this canonical boundary:

- [`../ai-context/source-code.md`](../ai-context/source-code.md)
- [`../ai-context/source-ui.md`](../ai-context/source-ui.md)
- [`../ai-context/planning-index.md`](../ai-context/planning-index.md)
- [`../ai-context/reference-index.md`](../ai-context/reference-index.md)
- [`../ai-context/generated-runtime-cache.md`](../ai-context/generated-runtime-cache.md)

If a derived summary disagrees with this document, use this document as the source of truth.

## Category definitions

| Category | Meaning | Default agent behavior |
|---|---|---|
| `source-priority/default-read` | Primary product source, core manifests, or high-signal repo control files. | Safe to inspect during broad product or architecture work. |
| `task-specific-source` | Real source/config/docs, but only relevant for a matching task area. | Read when the task mentions that subsystem, tooling, docs, CI, tests, benches, or platform. |
| `reference-artifact` | Committed evidence, release copies, screenshots, designs, or other artifacts used for review/verification. | Do not read by default; inspect only when the task asks for release verification, design comparison, screenshots, or asset review. |
| `generated-runtime` | Build output, bench output, coverage, logs, runtime state, or generated local data. | Default-exclude from broad exploration. Regenerate or measure when needed. |
| `local-tool-cache` | Dependency stores, VCS metadata, browser/agent/tool caches, and local machine state. | Default-exclude from broad exploration. |

## Top-level classification

| Path | Category | Notes |
|---|---|---|
| `AGENTS.md` | `source-priority/default-read` | Agent-facing project overview and caveats. |
| `README.md` | `source-priority/default-read` | Product overview and setup. |
| `package.json` | `source-priority/default-read` | Scripts, package manager, and validation commands. |
| `pnpm-lock.yaml` | `task-specific-source` | Dependency lockfile; inspect for dependency/version, install, or vulnerability tasks. |
| `tsconfig.json` | `source-priority/default-read` | TypeScript project configuration. |
| `wxt.config.ts` | `source-priority/default-read` | Extension build configuration. |
| `vitest.config.ts` | `source-priority/default-read` | Test configuration. |
| `eslint.config.mjs` | `source-priority/default-read` | Lint configuration. |
| `.gitignore` | `source-priority/default-read` | Existing generated/runtime boundary signal. |
| `src/` | `source-priority/default-read` | WXT browser extension source. |
| `src/server/` | `source-priority/default-read` | Astra relay server source. |
| `src/web/` | `source-priority/default-read` | React/Vite web companion source. |
| `public/` | `source-priority/default-read` | Public extension assets/locales. |
| `src/platform/` | `task-specific-source` | Source-bearing platform subtree; read nested runtime source paths only when platform work is relevant. |
| `.github/` | `task-specific-source` | CI/workflow source; read for automation and validation tasks. |
| `.specify/` | `task-specific-source` | Specification memory/templates/scripts. |
| `astra (ui)/` | `task-specific-source` | UI/design working area; `uploads/` is a reference-artifact exception. |
| `script/bench/` | `task-specific-source` | Benchmark harness source. |
| `script/bench-live/` | `task-specific-source` | Live browser benchmark scenario source. |
| `script/bench-opt/` | `task-specific-source` | Optimization harness/candidate source and canonical `config/` directory. |
| `docs/` | `task-specific-source` | Project documentation; `docs/design-comparison/` is a reference-artifact exception. |
| `ios/` | `task-specific-source` | Safari/iOS shell source; see nested exceptions below. |
| `plan.md` | `task-specific-source` | Local/planning note; read only when task references planning history. |
| `script/maintenance/` | `task-specific-source` | Build, verification, repo-knowledge guardrail, and support tooling. |
| `store/` | `task-specific-source` | Store-preparation area; `store/screenshots/` is a reference-artifact exception. |
| `test/` | `task-specific-source` | Unit/integration test helpers, mocks, and fixtures. |
| `.astra-open-extension-preview.cjs` | `task-specific-source` | Local preview helper; read only for preview tooling tasks. |
| `.DS_Store` | `local-tool-cache` | macOS Finder metadata. |
| `.bench-opt/` | `generated-runtime` | Local bench optimizer runtime state/cache. |
| `.claude/` | `local-tool-cache` | Local agent/tool state. |
| `.codex/` | `local-tool-cache` | Local Codex/tool state. |
| `.git/` | `local-tool-cache` | VCS metadata; use git tooling instead of broad reads. |
| `.output/` | `generated-runtime` | WXT build output. |
| `.playwright-mcp/` | `local-tool-cache` | Local browser automation/tool cache. |
| `.pnpm-store/` | `local-tool-cache` | Local pnpm package store. |
| `.wrangler/` | `local-tool-cache` | Local Wrangler/Cloudflare cache/state. |
| `.wxt/` | `generated-runtime` | WXT generated state. |
| `data/bench-live-results/` | `generated-runtime` | Live benchmark output. |
| `data/bench-live-results-test/` | `generated-runtime` | Test/live benchmark output. |
| `data/bench-opt-results/` | `generated-runtime` | Optimizer output. |
| `data/bench-results/` | `generated-runtime` | Benchmark output/history. |
| `coverage/` | `generated-runtime` | Test coverage output. |
| `dist/` | `generated-runtime` | Build/deploy output. |
| `logs/` | `generated-runtime` | Runtime/test/bench logs. |
| `node_modules/` | `local-tool-cache` | Installed dependencies. |
| `prompt-exports/` | `generated-runtime` | Local generated agent/oracle exports and measurement logs; read only for prompt/export evidence tasks. |

## Important nested exceptions

| Path | Category | Notes |
|---|---|---|
| `src/platform/cloudflare/src/` | `task-specific-source` | Cloudflare runtime source; read for platform, deploy, Worker, cloud/proxy parity, or platform validation work. |
| `src/platform/relay-lite/src/` | `task-specific-source` | Relay-lite runtime source; read for relay-lite, Cloudflare, deploy, or platform validation work. |
| `src/platform/cloudflare/tests/` | `task-specific-source` | Platform validation source. |
| `src/platform/cloudflare/sql/` | `task-specific-source` | Platform schema/migration source. |
| `ios/AstraShell/` | `task-specific-source` | iOS/Safari shell app source and assets. |
| `ios/AstraShell.xcodeproj/` | `task-specific-source` | Xcode project metadata. |
| `ios/scripts/` | `task-specific-source` | Safari build sync/verification scripts. |
| `ios/AstraShell Extension/Resources/` | `reference-artifact` | Committed generated Safari MV3 bundle copy, synced from `.output/safari-mv3` for release verification. Not default source context and not disposable. |
| `ios/build/` | `generated-runtime` | Xcode/iOS build output. |
| `docs/design-comparison/` | `reference-artifact` | Design evidence/screenshots/images; read only for design comparison tasks. |
| `store/screenshots/` | `reference-artifact` | Store listing screenshots/assets. |
| `astra (ui)/uploads/` | `reference-artifact` | Uploaded design/reference assets; not product runtime source. |
| `.output/safari-mv3/` | `generated-runtime` | Generated Safari extension build copied into the iOS resources artifact. |

## Give-to-AI quick sets

Use these sets when you want to hand a focused context bundle to an AI agent.

### UI work: safe files/directories to give AI

Give these for extension UI, web UI, design-token, popup/options/onboarding/reader, or visual polish tasks:

| Path | Read priority | Why |
|---|---|---|
| `src/entrypoints/popup/` | Default for extension popup UI | Popup app, cards, controls, popup design primitives, and popup styles. |
| `src/entrypoints/options/` | Default for settings/options UI | Options page UI and settings flows. |
| `src/entrypoints/content/components/` | Default for in-page UI | Float ball, hover translation, input translation, selection toolbar, identity strip. |
| `src/entrypoints/onboarding/` | Default for onboarding UI | Extension onboarding screen. |
| `src/entrypoints/deep-read/` | Task-specific UI | Deep Read page/app. |
| `src/entrypoints/document-intake/` | Task-specific UI | Document intake UI. |
| `src/entrypoints/pdf-reader/` | Task-specific UI | PDF reader UI and PDF translation helpers. |
| `src/entrypoints/epub-reader/` | Task-specific UI | EPUB reader UI. |
| `src/entrypoints/image-translate/` | Task-specific UI | Image translation UI and handoff. |
| `src/entrypoints/subtitle-reader/` | Task-specific UI | Subtitle reader UI and parser. |
| `src/entrypoints/vocabulary/` | Task-specific UI | Vocabulary and review UI. |
| `src/components/` | Default shared UI | Shared React components such as error boundary and toast. |
| `src/utils/ui/` | Default shared UI utilities | Shared UI helpers. |
| `src/assets/astra-style1-tokens.css` | Default design tokens | Shared design tokens; web app imports this. |
| `src/assets/astra-extension.css` | Default extension styling | Extension CSS. |
| `src/web/src/` | Default for web companion UI | React/Vite web app: `app.tsx`, `main.tsx`, `styles.css`, and web libraries. |
| `src/web/public/` | Task-specific UI assets | Web app icons, manifest, service worker. |
| `astra (ui)/components/` | Design-reference only | JSX design frames for popup/settings/onboarding/deep-read/etc.; read for visual redesign tasks, not runtime behavior. |
| `astra (ui)/styles/tokens.css` | Design-reference only | Design-canvas token reference. |
| `docs/design-comparison/README.md` | Design-reference only | Explains design comparison assets; avoid bulk-reading images unless asked. |

Do **not** give AI these by default for UI work: `astra (ui)/uploads/`, `docs/design-comparison/*.png`, `store/screenshots/`, `.output/`, `ios/AstraShell Extension/Resources/`, `dist/`, or generated benchmark result directories. Use them only when the task is screenshot/design comparison or release artifact verification.

### Source-code work: safe files/directories to give AI

Give these based on the product area named by the task:

| Task area | Give AI these paths first | Add only if needed |
|---|---|---|
| Browser extension core | `src/`, `wxt.config.ts`, `public/`, `package.json`, `tsconfig.json` | Relevant tests in `test/` or `src/**/*.test.*`; live scenarios in `script/bench-live/` for browser regressions. |
| Extension background/auth/storage/translation | `src/entrypoints/background/`, `src/utils/`, `src/types/`, `src/server/` if relay behavior is involved | `test/`, `script/bench/`, `script/bench-live/` depending on failing surface. |
| In-page translation/content scripts | `src/entrypoints/content/`, `src/utils/dom/`, `src/utils/translate/`, `src/utils/storage/`, `src/types/` | `script/bench-live/scenarios/page-translation-*` for live browser proof. |
| Relay server/API | `src/server/`, `src/server/.env.example`, `package.json` | `src/platform/cloudflare/src/` when cloud/proxy parity matters. |
| Cloudflare platform | `src/platform/cloudflare/src/`, `src/platform/cloudflare/wrangler.jsonc`, `src/platform/cloudflare/.dev.vars.example` | `src/platform/cloudflare/tests/`, `src/platform/cloudflare/sql/`, `.github/workflows/`. |
| Relay-lite | `src/platform/relay-lite/src/`, `src/platform/relay-lite/wrangler.jsonc` | Cloudflare docs/workflows if deploy behavior is involved. |
| Web companion | `src/web/src/`, `src/web/public/`, `src/web/vite.config.ts`, `src/assets/astra-style1-tokens.css` | `src/server/` or relay config only for API/auth issues. |
| iOS/Safari shell | `ios/AstraShell/`, `ios/AstraShell Extension/SafariWebExtensionHandler.swift`, `ios/scripts/`, `ios/README.md` | `ios/AstraShell Extension/Resources/` only to verify committed generated Safari bundle drift. |
| Bench or optimizer | `script/bench/`, `script/bench-live/`, `script/bench-opt/`, `script/bench-opt/config/`, `docs/bench-opt*.md` | `data/bench-results*` only as generated evidence for a specific run. |
| Tests/fixtures | `test/`, relevant `*.test.ts(x)` beside touched source | `coverage/` only for coverage-report tasks. |
| CI/release | `.github/workflows/`, `script/maintenance/`, `package.json`, relevant docs under `docs/` | Generated `.output/` only as build output to inspect after a build. |

### Default source-priority bundle for broad AI exploration

If the user asks a broad product question and you need one compact bundle, start with:

```text
AGENTS.md
README.md
package.json
.gitignore
tsconfig.json
wxt.config.ts
vitest.config.ts
eslint.config.mjs
src/
src/server/
src/web/src/
src/web/public/
public/
src/assets/astra-style1-tokens.css
```

Then add only the task-specific paths from the table above. Platform source is source-bearing but task-specific, so add `src/platform/cloudflare/src/` or `src/platform/relay-lite/src/` only when platform work is relevant.

### Never default-read / default-exclude bundle

Avoid these unless the user specifically asks about generated artifacts, local caches, screenshots, release bundle drift, or measurement:

```text
node_modules/
.pnpm-store/
.output/
.wxt/
dist/
coverage/
logs/
data/bench-results/
data/bench-live-results/
data/bench-live-results-test/
data/bench-opt-results/
.bench-opt/
.wrangler/
data/server/
server/data/
ios/build/
DerivedData/
prompt-exports/
.playwright-mcp/
.codex/
.claude/
.git/
ios/AstraShell Extension/Resources/
store/screenshots/
astra (ui)/uploads/
docs/design-comparison/*.png
```

## Default exploration rule

For broad repo exploration, start with `source-priority/default-read` paths plus the minimum `task-specific-source` paths implied by the user request. Avoid bulk-reading `reference-artifact`, `generated-runtime`, and `local-tool-cache` paths unless the task specifically asks about those artifacts or measurements.

When the task is about tests, CI, benchmarks, iOS/Safari release verification, design assets, screenshots, or deployment tooling, promote only the relevant task-specific or reference paths for that task.

## Measurement command

Use the local read-only measurement script from repo root:

```bash
pnpm -s repo:size
```

The command reports top-level and depth-2 disk usage. It is a local measurement aid only; no production telemetry, runtime hook, CI gate, or build behavior change is implied.
