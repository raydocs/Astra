# Month 6 — Final evidence pack (handoff)

_Task **`M6-FH-03`**_

**Task status:** complete for the Month 6 handoff/docs scope. This does **not** upgrade the Month 6 or roadmap verdict beyond `partial`.

## Purpose

This is the final Month 6 index for release-facing evidence. It is not a new product narrative. It tells a new reader what is **required**, what is **optional confidence only**, what was **proved**, and what remains **partial**.

## Release-facing bottom line

- **Current release-policy update:** required live lanes are now `source-core`, `extension-core`, `learning-loop`, `document-proof`, `youtube-proof`, and `youtube-holdout` per `docs/release-readiness-checklist.md` and `docs/investigations/workstream-f-live-lane-conventions.md`.
- **Optional confidence lanes remain optional only for non-required surfaces:** `hover-selection`, standalone `popup-proof`, Bilibili/generic video smokes, and broader reader/revisit slices outside controlled PDF / EPUB / SRT/VTT document-proof.
- **Month 6 did not close privacy/routing/glossary into a release-grade guarantee**.
- **Any RC that strengthens privacy/routing/glossary wording must attach fresh privacy artifacts or downgrade the wording back to the Month 6 inventory boundary.**

## Required-lane summary

| Gate | Canonical source | Current Month 6 reading |
|---|---|---|
| Gate 1 — deterministic quality | `docs/release-readiness-checklist.md` | Required. No Month 6 exception. |
| Gate 2 — required live lanes | `docs/release-readiness-checklist.md`, `docs/investigations/workstream-f-live-lane-conventions.md` | Required lanes are currently `source-core`, `extension-core`, `learning-loop`, `document-proof`, `youtube-proof`, and `youtube-holdout`. |
| Gate 3 — artifact clarity | `docs/release-readiness-checklist.md`, `docs/investigations/workstream-f-live-flaky-inventory.md` | Required. Evidence docs must stay current for the RC. |
| Gate 4A — core claim alignment | `docs/release-readiness-checklist.md`, `docs/investigations/support-matrix-2026-q2.md`, `docs/capability-matrix-v2.md`, `README.md` | Required for every RC. |
| Gate 4B — conditional evidence reviews | `docs/release-readiness-checklist.md` | Becomes blocking only when the RC touches that surface/claim family. |

## Open blockers / unresolved claim constraints

1. **Background/router is still not the authoritative privacy guardrail.**
2. **Month 6 closed with glossary/terminology still at plumbing-only status; next-window work has since established one canonical request-time contract, but not blanket guaranteed enforcement.**
3. **Month 6 closed with fallback disclosure weaker than the routing behavior itself; next-window work has since added one canonical popup-backed local last-event support/operator path for the most recent uncached request on the current device, but broader observability still remains partial.**
4. **Optional live slices remain optional** until they have required-lane ownership and flaky discipline; current required additions are limited to `learning-loop`, `document-proof`, `youtube-proof`, and `youtube-holdout`.
5. **Mobile/iOS shell parity is still unproven** and must stay outside parity language.

## Claim diff carried into the final state

### Claims downgraded or explicitly bounded

- “relay-only provider path” → runtime supports **direct**, **relay**, and **direct → relay fallback**
- “privacy mode means local-only translation” → privacy mode currently means **background transport-boundary request-context sanitization**, not local-only translation
- “glossary is fully wired” → Astra now has a **canonical vocabulary-backed request-time glossary contract**, but that still falls short of blanket guaranteed terminology enforcement
- generic “supports video” → **YouTube supported**, **Bilibili best-effort**, **subtitle-file experimental controlled surface**, others **code-only**
- “mobile/iOS supported with parity” → **mobile web portable control-plane only**, **iOS shell experimental**

### Claims left intentionally partial

- learning-loop as a required release lane
- reader/revisit as a required release lane
- production-watch-page video breadth
- strong privacy / routing / glossary guarantees

## Month-by-month evidence index

| Month | Best current evidence anchor | Scoped closeout reading | Release-facing status |
|---|---|---|---|
| 1 | `docs/investigations/month-1-closeout-2026-04-13.md`; `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md` | Core proof baseline exists; popup proof is credible but still outside required lanes | **Partial** |
| 2 | `docs/investigations/month-2-closeout-2026-04-14.md`; `docs/investigations/month-2-evidence-registry-2026-04-14.md` | Learning-loop is implemented and now required via the current `learning-loop` lane | **Pass with current required-lane proof; broader learning claims remain scoped** |
| 3 | `docs/investigations/month-3-closeout-inputs-2026-04-14.md`; `docs/investigations/month-3-evidence-registry-2026-04-14.md` | Owned-reading schema/queue/reopen baseline exists; controlled document/file flows are now required via `document-proof` | **Pass-with-scoped-claims; universal reopen remains partial** |
| 4 | `docs/investigations/month-4-evidence-registry-2026-04-14.md`; `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md` | YouTube proof/holdouts are now required; Bilibili/subtitle-file/other video boundaries remain bounded by support docs | **Pass-with-scoped-claims; broad platform parity remains partial** |
| 5 | `docs/investigations/control-plane-surface-inventory-2026-04-15.md`; `docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`; `docs/investigations/month-5-lifecycle-proof-2026-04-14.md` | Account/lifecycle wording and operator guidance are materially better; mobile/iOS remains carry | **Carry-but-acceptable / partial** |
| 6 | `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`; `docs/investigations/month-6-release-claim-audit-2026-04-14.md`; `docs/investigations/month-6-closeout-handoff-2026-04-14.md` | Inventory, claim audit, checklist tightening, and final handoff are complete | **Partial by design** |

## Canonical handoff docs

- `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
- `docs/investigations/month-6-release-claim-audit-2026-04-14.md`
- `docs/investigations/month-6-closeout-handoff-2026-04-14.md`
- `docs/release-readiness-checklist.md`
- `docs/capability-matrix-v2.md`
- `docs/investigations/support-matrix-2026-q2.md`
- `plan.md`

## Next-window candidates (non-binding)

1. Make privacy authority explicit at the background/router boundary, or permanently lock the caller-owned policy and keep claims downgraded.
2. Collapse glossary plumbing into one canonical request-time contract and serialization format.
3. Maintain the new canonical popup-backed support/operator path for transport/fallback handling unless a broader routing claim later requires more than that narrow observability surface.
4. Promote optional live slices only after they have required-lane ownership, CI discipline, and flake tracking.
5. Keep mobile/iOS shell claims bounded until device-backed runtime evidence exists.
