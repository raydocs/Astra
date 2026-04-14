# Lifecycle operations — Month 5 runbook addendum

_Links primary docs; does not replace Cloudflare ops runbooks._

## Operations

| Operation | API / surface | User-visible expectation | Proof |
|-----------|---------------|---------------------------|-------|
| **Export** | `POST /v1/account/export` (platform) | Job queued → completed → download | Web continuity UI + `astra-web` tests |
| **Delete** | `POST /v1/account/cloud-data-delete` | Grace period → completed | Same |
| **Repair** | `POST /v1/sync/repair` | Per-collection repair payload | Extension + web when enabled |
| **Revoke device** | `POST /v1/devices/:id/revoke` | Device list refresh | `account.ts` + web devices |

## Copy rules (Month 5)

- Each flow: **idle → running → success / failed** with retry hint on transient network errors only.
- Do not promise immediate delete for cloud-data-delete; show `scheduledForAt` when API returns it.

## Smoke (minimal)

- Web: open account workspace → trigger export dry path or status poll (mocked in unit tests acceptable for CI).
- Extension: device revoke path covered by integration where present; else document manual QA.

## References

- `docs/cloudflare-platform-ops-runbook.md`
- `docs/release-readiness-checklist.md`
- `docs/investigations/control-plane-surface-inventory-2026-04-15.md`
