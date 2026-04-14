# Month 5 — Lifecycle smoke (deferred / not in CI)

**Purpose:** Tie the lifecycle **runbook** (`docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`) to **repeatable checks** without claiming these paths are automated in CI today.

**Honest scope:** End-to-end export / cloud-data-delete / sync-repair flows are implemented in **web + extension clients** against the **platform** API shape (see `src/utils/astra/account.ts`, `web/src/lib/astra-web.test.ts`). The **in-repo Node relay** (`server/index.ts`) currently exposes auth, account summary-style routes, devices, and sync bootstrap/push/pull — not the full platform export/delete/repair surface. Treat relay `curl` below as **session + devices + sync primitives** only; treat export/delete/repair as **UI + unit tests against platform base URL** until a relay stub or integration lane exists.

## Runbook-linked flows (manual or test-backed today)

| Flow | Primary doc | Today’s verification anchor |
|------|-------------|----------------------------|
| Export | Runbook § Export | Web: `web/src/lib/astra-web.test.ts` (mocked `POST /v1/account/export`, job poll, download URL). **Not** relay `curl`. |
| Cloud data delete | Runbook § Delete | Same file — mocked delete job lifecycle. **Not** relay `curl`. |
| Sync repair | Runbook § Repair | Same file — mocked `POST /v1/sync/repair`. **Not** relay `curl`. |
| Revoke device | Runbook § Revoke device | Relay: `GET /v1/devices` + `POST /v1/devices/:id/revoke` (see commands). Extension/server tests where present. |

## Suggested relay commands (local dev relay on `127.0.0.1:8787`)

Prerequisite: relay running (`pnpm relay:start` per `AGENTS.md`). Demo credentials: `demo@astra.local` / `astra-demo-pass`.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8787/v1/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@astra.local","password":"astra-demo-pass","deviceId":"lifecycle-smoke-doc"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).sessionToken))")

curl -sS http://127.0.0.1:8787/v1/account/summary -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8787/v1/account -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8787/v1/devices -H "Authorization: Bearer $TOKEN"
# Replace <deviceId> from the devices list when exercising revoke:
# curl -sS -X POST "http://127.0.0.1:8787/v1/devices/<deviceId>/revoke" \
#   -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'
```

Sync bootstrap (read-only sanity on signed-in session):

```bash
curl -sS "http://127.0.0.1:8787/v1/sync/bootstrap" -H "Authorization: Bearer $TOKEN"
```

Push/pull bodies are non-trivial; prefer **`pnpm test`** for sync client behavior or follow product QA from the runbook for full cycles.

## CI status

**These lifecycle smokes are not automated in CI yet** as a dedicated bench-live or e2e lane. Closeout should continue to cite this file until an owner adds a repeatable job (or extends relay with faithful stubs) and wires it into `.github/workflows/ci.yml`.
