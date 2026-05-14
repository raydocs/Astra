# Future Checklist: Repository Four-Bucket Migration

This checklist is future-only. The current pass is docs/index normalization only: do not move directories, do not edit package scripts/config/source files, and do not change runtime behavior without a separate implementation plan.

## Conceptual model

The four buckets are conceptual, not a physical layout change in this pass:

- `src/` = product/runtime source roots.
- `script/` = automation, harness, deploy, build, and verification tooling.
- `docs/` = docs, plans, specs, investigations, reviews, ADRs, and analysis.
- `data/` = runtime/generated/reference/cache/result artifacts.

## Current root mapping

| Current root/path | Conceptual bucket | Move status |
|---|---|---|
| `src/` | `src` | No-move convention root. |
| `public/` | `src` / assets | No-move convention root. |
| `web/` | `src` | No move before Vite/root alias plan. |
| `server/` | `src`; `server/data/` is `data` | Future-only candidate. |
| `platform/` | `src` + `script` | Future-only candidate with Wrangler validation. |
| `.github/` | `script` | No-move convention root. |
| `.specify/` | `script` / specs tooling | No-move convention root. |
| `script/maintenance/` | `script` | Future-only candidate with wrappers first. |
| `script/bench/`, `script/bench-live/`, `script/bench-opt/` | `script` | Future-only candidate with artifact compatibility. |
| `ios/` | `src` + `script` + reference `data` | No-move convention root. |
| `docs/` | `docs` | Keep. |
| top-level `plans/` | `docs` | Legacy/transitional; index only. |
| `test/` | `script` / validation support | Future-only candidate. |
| `agent-config/` | `script` / agent configuration | Future-only candidate. |
| root configs (`package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `eslint.config.mjs`) | `script` / repo control | No-move convention roots. |
| `.output/`, `.wxt/`, `dist/` | `data` generated | Do not move manually. |
| `server/data/` | `data` runtime | Do not commit; configurable later. |
| `store/screenshots/` | `data` reference | Do not default-read. |
| `ios/AstraShell Extension/Resources/` | `data` reference/release | Do not treat as disposable. |

## No-move convention roots for any first physical migration

Do not move these without a dedicated plan and compatibility layer:

- `.github/`
- `.specify/`
- `src/`
- `public/`
- `web/` for this migration stage
- `ios/`
- root configs: `package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `eslint.config.mjs`
- generated WXT/Xcode-related outputs/resources by convention: `.output/`, `.wxt/`, `ios/AstraShell Extension/Resources/`

## Baseline validation commands for any later physical move

```bash
pnpm check:zod-entrypoints
pnpm type-check
pnpm test
pnpm build
pnpm build:web
pnpm build:firefox
pnpm build:safari
bash ios/scripts/verify-safari-build-sync.sh
pnpm bench:inventory
pnpm bench:live -- --list
pnpm bench:opt:list
```

## Targeted validation notes

- If moving WXT/extension paths, run `pnpm build`, `pnpm build:firefox`, `pnpm build:safari`, and content bundle verification.
- If moving web paths, run `pnpm build:web` and `pnpm type-check:web`.
- If moving iOS/Safari resources, run `pnpm ios:prepare` and `bash ios/scripts/verify-safari-build-sync.sh`.
- If moving bench paths, run the relevant `bench:live` lanes and `pnpm bench:opt:list`.
- If moving platform paths, run Wrangler deploy/dry-run validation separately with explicit environment assumptions, for example:

  ```bash
  pnpm dlx wrangler deploy --config platform/cloudflare/wrangler.jsonc --dry-run
  pnpm dlx wrangler deploy --config platform/relay-lite/wrangler.jsonc --dry-run
  ```

  These commands may require Cloudflare environment bindings or secrets to be configured before they can pass.

## Docs-only done-when criteria for this pass

- Only Markdown files changed.
- No package scripts changed.
- No source/runtime files changed.
- New indexes link to the canonical boundary.
- Source/UI/generated AI-context summaries state they are derived.
- Platform source is not in the broad default source bundle.
- This future migration checklist includes validation commands and no-move convention roots.
