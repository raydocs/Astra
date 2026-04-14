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
| Live bench (Playwright, extension-loaded) | `pnpm build` then `npx playwright install chromium` (or `npx playwright install --with-deps chromium` like CI). Run `pnpm bench:live:lane:release-proof` or a single scenario: `pnpm bench:live -- --scenario bench-live/site-automation-autostart`. On Linux without a real display, prefix with `xvfb-run -a` (matches `.github/workflows/ci.yml` `live-browser` job). |

### Non-obvious Caveats

- **Node 22 + pnpm 10** are required (matches CI in `.github/workflows/ci.yml`).
- **Extension-loaded live scenarios** (`bench-live/site-automation-autostart`, onboarding, vocabulary smoke, etc.) launch Chromium with `--load-extension`. They resolve the browser via `bench-live/driver.ts`, preferring **Playwright’s Chromium** (`chromium.executablePath()`) when installed. If that binary is missing, the driver falls back to system **Google Chrome**, which often returns **`net::ERR_BLOCKED_BY_CLIENT`** on `chrome-extension://…` URLs used to seed `chrome.storage` — not an extension logic bug. Fix: run `npx playwright install chromium` once per machine/CI image. In **`CI=true`**, the driver also avoids Playwright’s `channel: "chrome"` for the same reason.
- `pnpm install` may warn about ignored build scripts (esbuild, core-js, etc.). These do not block development — esbuild ships a pre-built WASM fallback.
- The relay server does **not** auto-load `server/.env`. It reads **`process.env` only** (see `server/config.ts`). Copy `server/.env.example` → `server/.env` for documentation, but to actually use keys you must either **export** them in the shell before `pnpm relay:start` or inject them via your host/CI secret store.
- **Managed translation keys**: When `OPENAI_API_KEY` and/or `OPENROUTER_API_KEY` are provided (e.g. Cursor Cloud user secrets), **restart the relay** after adding them so the Node process inherits the variables. A long-running relay started without keys will keep returning `OPENAI_API_KEY is not configured on the Astra relay` until restarted.
- **Hello world (translate) check** (terminal, relay on `127.0.0.1:8787`):

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8787/v1/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@astra.local","password":"astra-demo-pass","deviceId":"dev-check"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).sessionToken))")

curl -s -X POST http://127.0.0.1:8787/v1/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider":"openai","model":"gpt-4.1-nano","texts":["Hello, world."],"targetLang":"zh-CN","task":"translate"}'
```

Expect `{"translations":["…"]}` when keys are loaded.

- The default dev credentials are `demo@astra.local` / `astra-demo-pass` (port 8787).
- The web app at port 4173 communicates with the relay at `http://127.0.0.1:8787/v1`. In a headless Cloud Agent VM, **CORS blocks browser-initiated requests** from localhost:4173 to 127.0.0.1:8787. This is expected; the web app is primarily designed to work alongside the browser extension. For terminal-based API testing, use `curl` directly against the relay.
- **Lint has ~3900 pre-existing errors** (mostly `@typescript-eslint` strict rules). This is the current state of the codebase — lint exit code 1 is expected.
- **3 flaky/pre-existing test failures** are normal: a timing issue in `translation-cache.test.ts`, a Blob type mismatch in `astra-web.test.ts`, and a query ordering issue in `shadow-state.test.ts`. The remaining 116 test files (906 tests) pass.
- TypeScript type-check (`pnpm type-check`) passes cleanly.
- The lockfile may require `pnpm install` (without `--frozen-lockfile`) if `package.json` has been updated but `pnpm-lock.yaml` hasn't been regenerated.
