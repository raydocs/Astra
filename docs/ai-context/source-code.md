# AI Context: Source Code Paths

Use this derived routing summary when deciding which source-code paths to hand to an AI agent. The canonical repository classification boundary is [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md).

Prefer the smallest task-specific bundle instead of giving the whole repository. Conceptual `src/` means source-bearing roots, not only the physical top-level `src/` directory.

## Broad product source bundle

For broad product or architecture work, start with:

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
server/
web/src/
web/public/
public/
src/assets/astra-style1-tokens.css
```

Platform source is real source, but it is task-specific; add `platform/cloudflare/src/` or `platform/relay-lite/src/` only when platform/deploy/parity work is in scope.

## Task-specific source bundles

| Task area | Give AI these first | Add only if needed |
|---|---|---|
| Browser extension core | `src/`, `wxt.config.ts`, `public/`, `package.json`, `tsconfig.json` | Relevant `src/**/*.test.*`, `test/`, `bench-live/` for browser/live regressions. |
| Extension background/auth/storage/translation | `src/entrypoints/background/`, `src/utils/`, `src/types/` | `server/` if relay behavior is involved. |
| In-page translation/content scripts | `src/entrypoints/content/`, `src/utils/dom/`, `src/utils/translate/`, `src/utils/storage/`, `src/types/` | `bench-live/scenarios/page-translation-*` for live proof. |
| Popup/options/UI | See [`source-ui.md`](./source-ui.md) | Relevant tests beside touched files. |
| Relay server/API | `server/`, `server/.env.example`, `package.json` | `platform/cloudflare/src/` when cloud/proxy parity matters. |
| Cloudflare platform | `platform/cloudflare/src/`, `platform/cloudflare/wrangler.jsonc`, `platform/cloudflare/.dev.vars.example` | `platform/cloudflare/tests/`, `platform/cloudflare/sql/`, `.github/workflows/`. |
| Relay-lite | `platform/relay-lite/src/`, `platform/relay-lite/wrangler.jsonc` | Cloudflare docs/workflows for deploy behavior. |
| Web companion | `web/src/`, `web/public/`, `web/vite.config.ts`, `src/assets/astra-style1-tokens.css` | `server/` or relay config only for API/auth issues. |
| iOS/Safari shell | `ios/AstraShell/`, `ios/AstraShell Extension/SafariWebExtensionHandler.swift`, `ios/scripts/`, `ios/README.md` | `ios/AstraShell Extension/Resources/` only to verify committed generated Safari bundle drift. |
| Bench or optimizer | `bench/`, `bench-live/`, `bench-opt/`, `agent-config/`, `docs/bench-opt*.md` | Generated `bench-results*` only for a specific run's evidence. |
| Tests/fixtures | `test/`, relevant `*.test.ts(x)` beside touched source | `coverage/` only for coverage-report tasks. |
| CI/release | `.github/workflows/`, `scripts/`, `package.json`, relevant docs under `docs/` | `.output/` only after a build when inspecting generated output. |

## Notes

- Do not include `pnpm-lock.yaml` by default. Include it only for dependency, install, lockfile, or vulnerability tasks.
- Do not include `node_modules/` or `.pnpm-store/`; use package metadata and source imports instead.
- Do not include generated bundles unless the task is specifically about build output or release verification.
