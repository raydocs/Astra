# Macro Operational Evidence Contract

Source plan: [`docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md), especially the operational evidence gaps surfaced while auditing sections 4, 6–9, 11–14, 21–22, 24, 26–28, 30, 32, and 34.

Executable contract:

- `src/utils/macro-operational-evidence.ts`
- `src/utils/macro-operational-evidence.test.ts`
- `renderAstraMacroOperationalEvidenceRcNote()` for release-note downgrade artifacts
- `renderAstraMacroPlanCompletionGateNote()` for the stricter final-completion gate note
- `docs/reviews/macro-final-completion-evidence-2026-05-28.json` as the committed input artifact for current final-completion evidence booleans and links
- `src/utils/macro-operational-evidence.test.ts` also compares the rendered note against `docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md`, compares the final-completion gate note against `docs/reviews/macro-final-completion-gate-2026-05-28.md`, verifies the committed final-completion evidence JSON schema/link rules, verifies every repo-local `currentEvidence` path exists, checks that `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` covers the manually gated sections, requires every `Beta-boundary` / `External-blocked` section in `docs/reviews/macro-plan-completion-audit-2026-05-27.md` to be tracked by the executable evidence model, validates the manual QA checklist row schema/verdict rules so `not-run` rows cannot masquerade as filled release evidence, asserts the completion audit covers every top-level source-plan section `0`–`34` exactly once with non-empty status/evidence/boundary cells, keeps the RC evidence packet plus Gate 4 review explicit that repo evidence is not final launch/RC signoff, and tests `evaluateAstraMacroPlanCompletion()` so the full objective cannot be marked complete until operational, CI, owner, manual QA, human-scored quality, billing/legal/store/GTM, and production metric evidence are all attached.

## Purpose

This contract prevents a common macro-plan failure mode: treating implemented code, strategy docs, or local fixtures as proof that an operational claim is ready for public/paid launch.

The helper intentionally classifies each remaining evidence area as one of:

- `proved` — evidence is sufficient for the intended claim;
- `beta_boundary` — acceptable for the current beta only if public copy stays downgraded;
- `blocked_until_external_evidence` — cannot be claimed complete until external or production evidence is attached.

## Current tracked evidence areas

The contract currently tracks:

1. First-success activation evidence.
2. Learning Library surface coverage.
3. Personalization behavior evidence.
4. Membership value surface evidence.
5. Product metrics operational evidence.
6. Learning Digest product evidence.
7. Human-scored AI quality report.
8. Brand and aesthetic surface audit.
9. Support/help-center/status evidence.
10. Pricing/trial/paywall launch boundary.
11. Learning-science Review compatibility boundary.
12. Data-retention and user-control evidence.
13. GTM release artifact packet.
14. Store listing and permission-trust submission packet.
15. Operations-console role boundary.
16. Accessibility manual evidence packet.

## Decision rule

`evaluateAstraMacroOperationalEvidence()` returns:

- `publicBetaReady` only when missing external evidence has explicit downgrade copy;
- `strongerClaimBlocked` whenever any tracked area is not `proved`;
- `missingEvidence` for areas blocked until production/external artifacts exist;
- `downgradeRequired` for all areas whose copy must stay beta/boundary-aware.

This means the repository may keep moving toward the macro plan while still refusing to mark paid launch, store submission, GTM launch artifacts, or broad compliance claims complete without stronger evidence. The stricter `evaluateAstraMacroPlanCompletion()` helper is the final-completion gate: it remains incomplete while any operational evidence still requires downgrade copy or while CI artifacts, owner approval, manual QA, human-scored quality, billing/legal/store/GTM evidence, or production metric exports are missing.

## Relation to release readiness

Use this helper alongside `docs/release-readiness-checklist.md` and stage gates. It does not replace CI, live-browser lanes, store upload artifacts, legal approval, production smoke, human-scored AI quality review, or manual accessibility evidence. It makes their absence explicit so release notes can downgrade claims instead of silently promoting them.

Current generated RC note: `docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md`. Current final-completion evidence artifact: `docs/reviews/macro-final-completion-evidence-2026-05-28.json`. Current final-completion gate note: `docs/reviews/macro-final-completion-gate-2026-05-28.md`. Update the evidence artifact and regenerate the notes with `renderAstraMacroOperationalEvidenceRcNote()` / `renderAstraMacroPlanCompletionGateNote()` whenever evidence, validation markers, or release claims change, then run `pnpm test src/utils/macro-operational-evidence.test.ts` to verify the committed artifacts match the executable model.
