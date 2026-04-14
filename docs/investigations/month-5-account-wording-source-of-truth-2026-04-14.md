# Month 5 — Account / usage wording source-of-truth note

_Task **`M5-E-01`** alignment_

## Principle

One visible metric should map to **one** origin: local extension storage, relay `/account` snapshot, or marketing copy — never two conflicting labels on different surfaces for the same field.

## Where values come from (high level)

| Surface | Primary sources |
|---------|-------------------|
| Extension popup | `readConfig`, `readAstraSession`, `getQuotaInfo` / continuity snapshot helpers in `App.tsx` |
| Options | Same storage + continuity collections |
| Web app | Relay-backed routes under `web/` (see `control-plane-surface-inventory-2026-04-15.md`) |

## Doc pointer

`docs/investigations/control-plane-surface-inventory-2026-04-15.md` + `docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md` for lifecycle (`M5-E-02`) and mobile wording tightening (`M5-E-03`).
