# Month 5 — lifecycle proof note

_Task **`M5-E-02`**_

## Proof commands used

```bash
pnpm exec vitest run web/src/app.test.tsx
pnpm exec vitest run \
  platform/cloudflare/src/handlers/account-lifecycle.test.ts \
  platform/cloudflare/src/handlers/device-revoke.test.ts \
  platform/cloudflare/src/handlers/sync-repair.test.ts
```

## What these prove

### Web account lifecycle surface

File:
- `web/src/app.test.tsx`

Current proof coverage:
- remote device revoke success path
- remote device revoke failure guidance
- continuity export queued state
- cloud delete scheduled state + destructive wording boundary
- manual sync repair success path + operator guidance copy

### Platform lifecycle contracts

Files:
- `platform/cloudflare/src/handlers/account-lifecycle.test.ts`
- `platform/cloudflare/src/handlers/device-revoke.test.ts`
- `platform/cloudflare/src/handlers/sync-repair.test.ts`

Current proof coverage:
- export job creation, idempotency linkage, and completed download artifact path
- cloud delete scheduling/status semantics
- device revoke native authoritative path
- device revoke fallback-to-proxy path
- device revoke guarded current-device forbid path
- device revoke mirror-back ambiguity / rollback branches
- sync repair materialized record-state return
- sync repair auth error contract

## High-risk flows called out explicitly

| Flow | Risk class | Current proof |
|---|---|---|
| Cloud collection delete | destructive / delayed execution | web lifecycle UI test + platform account-lifecycle handler test |
| Device revoke | user lockout / authority reconciliation | web revoke UI test + platform device-revoke handler test |
| Export download lifecycle | artifact readiness / expiry ambiguity | web lifecycle UI test + platform account-lifecycle handler test |
| Sync repair | recovery semantics / auth gate | web repair UI test + platform sync-repair handler test |

## Boundaries

- This is **replayable test proof**, not a browser-live artifact set.
- It is sufficient for Month 5 lifecycle contract confidence, but it does **not** yet promote control-plane lifecycle into a required live release lane.
