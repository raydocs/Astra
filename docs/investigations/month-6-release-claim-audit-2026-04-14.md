# Month 6 — Release gate + claims audit (checklist)

_Task **`M6-F-02`**_

## Documents to reconcile each RC

1. `docs/release-readiness-checklist.md` — Gate 1–4 rows must match CI job names.
2. `docs/capability-matrix-v2.md` — Capability rows must cite a proof path or be downgraded.
3. `docs/investigations/support-matrix-2026-q2.md` — Supported vs best-effort vs experimental language.
4. `docs/investigations/workstream-a-live-coverage-matrix.md` — Lane ↔ scenario mapping.

## Rule

If a claim has **no** linked command or artifact family, downgrade the wording in the same PR that touches release-facing docs.

## Month-by-month claim vs proof index

| Month | Key doc(s) | Optional live command | Status |
|-------|------------|------------------------|--------|
| 1 | `docs/investigations/month-1-closeout-2026-04-13.md`; `docs/investigations/workstream-a-live-coverage-matrix.md` | `pnpm bench:live:lane:release-proof` (includes required scenarios); optional `pnpm bench:live:lane:hover-selection` | **Partial** — closeout records partial score; hover/selection not required gates |
| 2 | `docs/investigations/month-2-closeout-2026-04-14.md`; `docs/investigations/month-2-evidence-registry-2026-04-14.md`; learning-loop investigation set | Required lanes unchanged (`source-core`, `extension-core`); optional `pnpm bench:live:lane:learning-loop` / `pnpm bench:live:lane:popup-proof` | **Partial** — learning-loop credible but not promoted to Gate 2 per checklist |
| 3 | `docs/investigations/month-3-closeout-inputs-2026-04-14.md` | Reader/revisit lanes as referenced in matrix / closeout inputs | **Unverified** at month-closeout level per task pack |
| 4 | `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md`; `support-matrix-video-addendum-2026-04-15.md` (when video RC) | Scenario smokes for YouTube + secondary adapters per matrix | **Partial** — strong paths documented; broad parity not claimed |
| 5 | `docs/investigations/control-plane-surface-inventory-2026-04-15.md`; `lifecycle-operations-runbook-month5-2026-04-15.md` | Web `/account` workspace + extension account flows; relay smoke via `AGENTS.md` curl pattern | **Partial** — bridge-first mobile; relay-backed web is canonical for account JSON |
| 6 | `docs/investigations/month-6-release-claim-audit-2026-04-14.md` (this file); `month-6-final-evidence-pack-2026-04-14.md`; `month-6-privacy-routing-failure-inventory-2026-04-14.md` | Same as Months 1–2 required lanes + Gate 3 artifact review; no new Month 6-only lane required in-repo | **Unverified** until RC attaches green artifacts and matrix matches |

_Status labels:_ **Implemented** = gated in CI + docs aligned; **Partial** = real subsystem with explicit scope limits; **Unverified** = no attached proof bundle for that month slice at task-pack time.
