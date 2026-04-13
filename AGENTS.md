# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

Astra is an AI-powered language learning browser extension with three main development surfaces:

1. **Browser Extension** (`src/`) — WXT-based Manifest V3 extension (Chrome/Firefox/Safari)
2. **Astra Relay Server** (`server/`) — Node.js backend for auth, translation relay, sync
3. **Web App** (`web/`) — React+Vite standalone web companion

### Quick Reference (commands in `package.json`)

| Task | Command |
|------|---------|
| Install deps | `pnpm install` (runs `wxt prepare` via postinstall) |
| Extension dev (Chrome) | `pnpm dev` |
| Web app dev | `pnpm dev:web` (port 4173) |
| Relay server | `pnpm relay:start` (port 8787) or `pnpm relay:dev` (watch) |
| Type check | `pnpm type-check` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| Build extension | `pnpm build` |

### Non-obvious Caveats

- **Node 22 + pnpm 10** are required (matches CI in `.github/workflows/ci.yml`).
- `pnpm install` may warn about ignored build scripts (esbuild, core-js, etc.). These do not block development — esbuild ships a pre-built WASM fallback.
- The relay server does **not** auto-load `server/.env`. It uses environment variable defaults defined in `server/config.ts`. The default dev credentials are `demo@astra.local` / `astra-demo-pass` (port 8787).
- The web app at port 4173 communicates with the relay at `http://127.0.0.1:8787/v1`. In a headless Cloud Agent VM, **CORS blocks browser-initiated requests** from localhost:4173 to 127.0.0.1:8787. This is expected; the web app is primarily designed to work alongside the browser extension. For terminal-based API testing, use `curl` directly against the relay.
- **Lint has ~3900 pre-existing errors** (mostly `@typescript-eslint` strict rules). This is the current state of the codebase — lint exit code 1 is expected.
- **3 flaky/pre-existing test failures** are normal: a timing issue in `translation-cache.test.ts`, a Blob type mismatch in `astra-web.test.ts`, and a query ordering issue in `shadow-state.test.ts`. The remaining 116 test files (906 tests) pass.
- TypeScript type-check (`pnpm type-check`) passes cleanly.
- The lockfile may require `pnpm install` (without `--frozen-lockfile`) if `package.json` has been updated but `pnpm-lock.yaml` hasn't been regenerated.
