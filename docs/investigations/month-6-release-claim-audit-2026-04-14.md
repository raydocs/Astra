# Month 6 — Release gate + claims audit

_Task **`M6-F-02`**_

## Purpose

This is the Month 6 claim-audit companion to `docs/release-readiness-checklist.md`. Use it when an RC touches privacy, routing, glossary/terminology wording, or any release-facing claim that could outrun proof.

## Hard rule

If a claim has **no** linked command, artifact family, or explicit inventory-backed boundary, downgrade the wording in the same PR/RC note.

## Core contradictions resolved in this pass

1. **Provider path wording**
   Release-facing docs can no longer imply “relay only.” Current runtime supports:
   - direct provider transport
   - relay transport
   - direct → relay fallback

2. **Privacy wording**
   Release-facing docs can no longer imply “local-only translation” or broad end-to-end secrecy. Current honest statement:
   - privacy mode sanitizes request context on covered caller surfaces
   - translation content can still leave the device on direct or relay paths

3. **Glossary wording**
   Release-facing docs can no longer imply blanket guaranteed terminology enforcement. Current honest statement:
   - glossary-backed vocabulary storage is now the canonical source of truth for request-time terminology data
   - one canonical request-time glossary contract now exists
   - that still does **not** justify stronger wording than the available runtime/tests actually prove

## Documents that must reconcile each RC

1. `docs/release-readiness-checklist.md` — Gate 1–4 rows and blocking semantics
2. `docs/capability-matrix-v2.md` — capability progress wording vs actual proof depth
3. `docs/investigations/support-matrix-2026-q2.md` — platform/support wording plus claim-boundary statements
4. `README.md` — high-level release-facing product wording
5. `docs/investigations/workstream-a-live-coverage-matrix.md` — lane ↔ scenario mapping
6. `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` — authoritative Month 6 privacy/routing/glossary boundary map

## Month-by-month claim vs proof index

| Month | Key doc(s) | Optional / conditional proof path | Status |
|-------|------------|-----------------------------------|--------|
| 1 | `docs/investigations/month-1-closeout-2026-04-13.md`; `docs/investigations/workstream-a-live-coverage-matrix.md` | `pnpm bench:live:lane:release-proof`; optional `pnpm bench:live:lane:hover-selection` | **Partial** — closeout records partial score; hover/selection remain optional |
| 2 | `docs/investigations/month-2-closeout-2026-04-14.md`; `docs/investigations/month-2-evidence-registry-2026-04-14.md`; learning-loop investigation set | optional `pnpm bench:live:lane:learning-loop` / `pnpm bench:live:lane:popup-proof` | **Partial** — learning-loop credible but not promoted to Gate 2 |
| 3 | `docs/investigations/month-3-closeout-inputs-2026-04-14.md`; `docs/investigations/month-3-evidence-registry-2026-04-14.md` | reader/revisit scenarios per matrix and closeout inputs | **Partial** — implemented and proved in scoped slices, still not a required release lane |
| 4 | `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md`; `docs/investigations/support-matrix-video-addendum-2026-04-15.md` | YouTube + Bilibili smokes per matrix; subtitle-file controlled-path smokes | **Partial** — strongest paths documented; broad platform parity not claimed |
| 5 | `docs/investigations/control-plane-surface-inventory-2026-04-15.md`; `docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`; `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md` | lifecycle proof commands + manual mobile/iOS evidence rows | **Partial** — account/lifecycle aligned; mobile remains bridge-first / experimental |
| 6 | `docs/investigations/month-6-release-claim-audit-2026-04-14.md` (this file); `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`; `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` | same required lanes as earlier months; conditional privacy proof paths: `bench-live/privacy-mode-page-translation-source`, `bench-live/holdout/privacy-mode-should-not-leak` | **Partial** — inventory and downgrade rules are now explicit; fresh RC privacy artifacts are still optional unless the RC wants stronger privacy wording |

_Status labels:_ **Implemented** = present in code/runtime; **Proved** = linked to concrete commands/artifact families; **Partial** = real subsystem with explicit limits; **Unverified** = no attached proof bundle for the claim slice.

## Month 6 release decision notes

For Month 6, the release decision should use this logic:

- if the RC does **not** strengthen privacy/routing/glossary claims, the new inventory + downgraded wording are sufficient
- if the RC **does** strengthen those claims, attach fresh privacy live artifacts or downgrade the wording back to the inventory boundary
- do not let README/support/capability docs drift apart on provider-path ownership, privacy semantics, or glossary maturity
