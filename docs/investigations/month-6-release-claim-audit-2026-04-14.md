# Month 6 — Release gate + claims audit (checklist)

_Task **`M6-F-02`**_

## Documents to reconcile each RC

1. `docs/release-readiness-checklist.md` — Gate 1–4 rows must match CI job names.
2. `docs/capability-matrix-v2.md` — Capability rows must cite a proof path or be downgraded.
3. `docs/investigations/support-matrix-2026-q2.md` — Supported vs best-effort vs experimental language.
4. `docs/investigations/workstream-a-live-coverage-matrix.md` — Lane ↔ scenario mapping.

## Rule

If a claim has **no** linked command or artifact family, downgrade the wording in the same PR that touches release-facing docs.
