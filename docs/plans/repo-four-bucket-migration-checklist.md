# Repository Four-Bucket Migration Checklist

This checklist records the current physical cleanup status for Astra's conceptual `data/script/docs/src` model. Public `pnpm` command names remain the compatibility surface; old owned root paths should not be reintroduced as tracked implementation shims.

## Conceptual model

- `src/` = product/runtime source roots.
- `script/` = automation, harness, deploy, build, verification tooling, and optimizer config.
- `docs/` = docs, plans, specs, investigations, reviews, ADRs, and analysis.
- `data/` = runtime/generated/reference/cache/result artifacts.

## Current root mapping

| Current root/path | Conceptual bucket | Move status |
|---|---|---|
| `src/` | `src` | No-move WXT convention root; now also contains `src/server/`, `src/web/`, and `src/platform/`. |
| `public/` | `src` / assets | No-move WXT convention root. |
| `src/web/` | `src` | Moved from top-level `web/`. |
| `src/server/` | `src`; `data/server/` is `data` | Moved from top-level `server/`; legacy local `server/data/` remains ignored only. |
| `src/platform/` | `src` + `script` | Moved from top-level `platform/`; Wrangler configs live with their platform packages. |
| `.github/` | `script` | No-move convention root. |
| `.specify/` | `script` / specs tooling | No-move convention root. |
| `script/maintenance/` | `script` | Canonical maintenance/checker script root; includes `check-repo-knowledge.ts`. |
| `script/bench/`, `script/bench-live/`, `script/bench-opt/` | `script` | Canonical bench harness roots. |
| `script/bench-opt/config/` | `script` / agent configuration | Moved from top-level `agent-config/`. |
| `ios/` | `src` + `script` + reference `data` | No-move convention root. |
| `docs/` | `docs` | Keep; historical plans live under `docs/plans/history/`. |
| `test/` | `script` / validation support | No-move convention root for now. |
| root configs (`package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `eslint.config.mjs`) | `script` / repo control | No-move convention roots. |
| `.output/`, `.wxt/`, `dist/` | `data` generated | Do not move manually. |
| `data/server/` | `data` runtime | Do not commit. |
| `data/bench-results/`, `data/bench-live-results/`, `data/bench-opt-results/` | `data` generated | Do not commit generated run outputs. |
| `store/screenshots/` | `data` reference | Do not default-read. |
| `ios/AstraShell Extension/Resources/` | `data` reference/release | Do not treat as disposable. |

## Removed owned legacy roots

`pnpm check:repo-knowledge` fails when tracked files remain under these old top-level roots:

- `server/`
- `web/`
- `platform/`
- `bench/`
- `bench-live/`
- `bench-opt/`
- `agent-config/`
- `scripts/`
- `plans/`

Do not create compatibility implementation shims under these roots. Update internal callers to canonical paths instead.

## No-move convention roots

Do not move these without a dedicated plan and compatibility layer:

- `.github/`
- `.specify/`
- `src/` WXT extension root
- `public/`
- `ios/`
- `test/`
- root configs: `package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `eslint.config.mjs`
- generated WXT/Xcode-related outputs/resources by convention: `.output/`, `.wxt/`, `ios/AstraShell Extension/Resources/`

## Baseline validation commands

```bash
pnpm check:repo-knowledge
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
- If moving bench paths or optimizer config, run the relevant `bench:live` lanes and `pnpm bench:opt:list`.
- If moving platform paths, run Wrangler deploy/dry-run validation separately with explicit environment assumptions, for example:

  ```bash
  pnpm dlx wrangler deploy --config src/platform/cloudflare/wrangler.jsonc --dry-run
  pnpm dlx wrangler deploy --config src/platform/relay-lite/wrangler.jsonc --dry-run
  ```

  These commands may require Cloudflare environment bindings or secrets to be configured before they can pass.

## Done-when criteria for this cleanup model

- No tracked files remain under removed owned legacy roots.
- Public package command names remain available.
- Source-of-truth docs, package scripts, and CI agree on canonical `src/`, `script/`, `docs/`, and generated `data/` paths.
- Generated/runtime outputs remain ignored or otherwise classified as non-default-read artifacts.
