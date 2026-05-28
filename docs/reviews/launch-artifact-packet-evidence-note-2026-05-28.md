# Launch artifact packet evidence note — 2026-05-28

Source: macro product upgrade plan Sections 8, 21, 27, and 28 plus final-completion blocker `billingLegalStoreGtmArtifactsAttached`.

This note records repo-side launch artifact intake guardrails and points to the current repo-side boundary notes that feed the billing/legal/store/GTM packet. It is **not** billing checkout evidence, legal approval, browser-store submission evidence, GTM media capture evidence, paid-launch approval, or owner signoff.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Billing/free-beta boundary | `docs/runbooks/billing-free-policy.md`, `src/utils/product-strategy.ts`, `docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md` | Current public state is free beta; paid checkout, webhook, entitlement, cancellation/refund, and quota reconciliation remain blocked. The pricing note records why beta-safe trial interest and membership copy do not satisfy paid-launch evidence. | Needs production billing provider evidence before paid launch claims. |
| Legal/trust/store copy boundary | `docs/analysis/legal-trust-store-risk-checklist-2026-05-27.md`, `store/listing-copy.md`, `src/utils/trust/compliance.ts` | Repo copy and compliance contracts identify privacy, terms, AI notice, permission copy, and support/contact requirements. | Needs formal legal/privacy review and final public URLs/questionnaire evidence. |
| Store submission boundary | `docs/runbooks/browser-store-submission.md`, `store/listing-copy.md`, `docs/reviews/store-submission-evidence-note-2026-05-28.md` | Browser store copy/runbook and mobile Store/TestFlight/Play draft release-pack materials exist. The store submission note records why draft copy, reviewer templates, privacy drafts, screenshot plans, and signed-build QA templates are repo-side only. | Needs uploaded package/build hash, store-console form entries, submission/processing status, reviewer notes entered in consoles, approval/rejection evidence, and final signed-build screenshots/QA evidence. |
| GTM boundary | `docs/gtm/demos.md`, `src/utils/gtm-campaign.ts`, `docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md` | Demo scripts and launch-safe copy contracts exist. The GTM note records why scripts and copy decks are not target-build media capture evidence. | Needs final screenshots/storyboards, current sub-60s demo captures, hosted/uploaded launch media, and owner claim review. |
| Launch artifact packet intake | `evaluateAstraMacroLaunchArtifactPacket()` and `docs/reviews/macro-launch-artifact-packet-2026-05-28.json` | Requires all billing, legal/trust, store submission, and GTM artifact requirements to have artifact type, artifact id, stable artifact digest or version, target channel, claim boundary, owner/date with `YYYY-MM-DD`, real environment/channel context, and URL or repo artifact-path evidence links. Duplicate artifact ids/evidence links, placeholder values, weak all-zero/repeated/local/sample/test digest/version values, and mismatched claim boundaries are rejected. The current machine-readable packet is intentionally empty while external evidence is missing. | This validates supplied evidence; it does not create external launch artifacts. |

## Required packet rows

`billingLegalStoreGtmArtifactsAttached` may only be marked true when a packet satisfies `evaluateAstraMacroLaunchArtifactPacket()` and covers every row:

1. **Billing checkout** — production checkout success/cancel evidence.
2. **Billing webhook** — webhook receipt, signature validation, retry/idempotency, and event persistence evidence.
3. **Billing entitlement** — paid entitlement enforcement and quota reconciliation evidence.
4. **Billing cancellation/refund** — cancellation, refund, and post-cancel access behavior evidence.
5. **Legal privacy/terms approval** — approved privacy policy, terms, and data-processing review evidence.
6. **AI notice** — approved AI imperfection / learning-guidance notice evidence.
7. **Support/contact commitment** — monitored support/contact owner and incident escalation evidence.
8. **Store zip hash** — final uploaded package hash and build provenance evidence.
9. **Store upload/submission** — target browser/mobile store channel upload, submission, or processing status evidence.
10. **Reviewer notes** — reviewer notes, privacy questionnaire, or approval/rejection evidence.
11. **Store screenshots** — final store screenshot set tied to the uploaded build.
12. **GTM demo capture** — current sub-60s demo capture evidence.
13. **GTM storyboard/screenshots** — final screenshots/storyboards for launch media.
14. **GTM copy claim review** — claim review showing demo/store/landing copy uses allowed downgrade wording.

Every row needs artifact type, artifact id, stable non-weak artifact digest or version, target channel, claim boundary (`billing`, `legal_trust`, `store_submission`, or `gtm`), owner/date containing a real calendar `YYYY-MM-DD`, real environment/channel context, and a URL or repo artifact-path evidence link. Artifact ids, digest/version values, environment/channel context, and evidence links must be requirement-specific; placeholder/example/todo and weak all-zero/local/sample values are rejected.

## Downgrade copy

Billing/free-beta policy, legal/trust/store-copy contracts, store/GTM runbooks, repo-side pricing/GTM/store-submission evidence notes, and a launch artifact packet intake guard exist in repo. Paid-launch, store-submission-complete, legal-approved, and GTM-launch-complete claims still require external billing, legal, store-console, signed-build, owner-approved, and media artifacts for the target release.
