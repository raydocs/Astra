# Lifecycle operations — Month 5 runbook addendum

_Task **`M5-E-02`**_

_Links primary docs; does not replace Cloudflare ops runbooks._

## Scope

This runbook covers the current user-facing lifecycle controls in the web account console for:

- continuity export
- cloud collection delete
- manual sync repair
- remote device revoke

It documents **what each status means**, **what an operator can safely say**, and **what proof exists today**.

## Lifecycle contract

| Operation | API / surface | User-visible expectation | What the operator may safely say |
|-----------|---------------|---------------------------|----------------------------------|
| **Export** | `POST /v1/account/export`, `GET /v1/account/export/:jobId`, download route | `queued → running → completed/failed/expired` | Export is not ready until status is `completed`. If `expired`, a new export is required. |
| **Delete** | `POST /v1/account/cloud-data-delete`, status route | `scheduled → queued → running → completed/failed/canceled` | `scheduled` is **not deleted**. Only `completed` means delete mutations were appended; clients still need later sync pull to observe removal. |
| **Repair** | `POST /v1/sync/repair` | one-shot materialized repair payload or auth/error contract | Repair is a recovery snapshot, not a promise that every client is already healed. |
| **Revoke device** | `POST /v1/devices/:id/revoke` | target device revoked or explicit guarded failure/fallback | Current device must use local sign-out. Remote revoke applies only to other devices. |

## Status meanings and failure handling

### 1) Continuity export

| Status | Meaning | Operator action |
|---|---|---|
| `queued` | Worker accepted the job but has not built the bundle yet | Refresh status once or wait for polling. Do not call the export missing yet. |
| `running` | Bundle creation is in progress | Wait for terminal status. |
| `completed` | Artifact exists and can be downloaded until expiry | Safe to tell the user the export is ready. |
| `failed` | Export did not complete | Refresh once; if still failed, create a fresh export and keep the failed job for diagnostics. |
| `expired` | Prior export artifact aged out | Create a fresh export; never promise the old artifact can still be downloaded. |

Failure guidance:
- download errors can mean **not ready**, **expired**, or **artifact missing**
- if status is ambiguous after a failed refresh, treat the export as **pending / unknown**, not completed

### 2) Cloud collection delete

| Status | Meaning | Operator action |
|---|---|---|
| `scheduled` | Grace window active; no delete fanout yet | Say deletion is **scheduled**, not done. |
| `queued` | Grace window elapsed; worker queue accepted the delete | Wait for terminal status before claiming removal. |
| `running` | Delete mutation fanout is executing | Keep data treated as present until completion. |
| `completed` | Delete mutations were appended | Tell the user deletion has been scheduled/applied in cloud state, but clients still need a later sync pull to observe removal. |
| `failed` | Delete job did not complete | Keep the data treated as present. Retry only with a new successful job. |
| `canceled` | Delete was canceled before execution | No removal should be claimed from this job. |

Failure guidance:
- destructive delete must never be described as immediate
- if a create/status refresh fails, keep the delete in **pending / unconfirmed** language
- if the user asks whether data is gone, answer from the **job status + later client sync evidence**, not from intent alone

### 3) Manual sync repair

Success means:
- the server returned a fresh materialized snapshot of requested collections
- web can rebuild its current cloud view from that payload

Failure handling:
- refresh the cloud snapshot first
- if auth/cursor recovery still fails, escalate with request id / route rather than repeatedly re-running repair blindly
- `CURSOR_EXPIRED` is a valid reason to run repair; it is not, by itself, proof that every client has already recovered

### 4) Remote device revoke

Guardrails:
- current device must use **Sign out**, not remote revoke
- remote revoke is only for **other** active devices

Failure handling:
- refresh the device list once before retrying
- if the target device disappears or already shows revoked after refresh, trust the refreshed list over the stale click result
- native authoritative revoke can still hit mirror-back ambiguity; treat that as needing reconciliation, not as silent success

## Replayable proof today

Exact replayable proof commands:

```bash
pnpm exec vitest run web/src/app.test.tsx
pnpm exec vitest run \
  platform/cloudflare/src/handlers/account-lifecycle.test.ts \
  platform/cloudflare/src/handlers/device-revoke.test.ts \
  platform/cloudflare/src/handlers/sync-repair.test.ts
```

## Proven high-risk flows

| Flow | Proof path | Why it counts |
|---|---|---|
| Cloud delete scheduling + status semantics | `web/src/app.test.tsx`, `platform/cloudflare/src/handlers/account-lifecycle.test.ts` | Covers destructive scheduling language in UI and server-side lifecycle job/status contracts. |
| Device revoke failure / fallback / mirror-back ambiguity | `web/src/app.test.tsx`, `platform/cloudflare/src/handlers/device-revoke.test.ts` | Covers user-facing retry guidance and the highest-risk authoritative/fallback server branches. |
| Export queue/download lifecycle | `web/src/app.test.tsx`, `platform/cloudflare/src/handlers/account-lifecycle.test.ts` | Covers queued UI state, status/download contract, and artifact readiness boundaries. |
| Sync repair auth + materialized snapshot | `web/src/app.test.tsx`, `platform/cloudflare/src/handlers/sync-repair.test.ts` | Covers UI recovery language and native repair/auth contracts. |

## References

- `docs/investigations/control-plane-surface-inventory-2026-04-15.md`
- `docs/investigations/month-5-lifecycle-proof-2026-04-14.md`
- `docs/release-readiness-checklist.md`
- `docs/cloudflare-platform-ops-runbook.md`
