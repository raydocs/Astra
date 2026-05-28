# GTM Release Packet Evidence Note — 2026-05-28

## Scope

This note covers repo-side Section 27 GTM release packet evidence. It does not claim final launch media, final screenshots, recorded demo captures, paid launch readiness, store submission approval, owner signoff, or production campaign performance.

## Current repo evidence

| Claim area | Current evidence | Verdict |
|---|---|---|
| First-version channels | `src/utils/gtm-campaign.ts` defines Chrome Web Store, Landing Page, YouTube/Bilibili short demo, and Share Card as first-version channels; `src/utils/gtm-campaign.test.ts` asserts the channel set. | Repo-covered for channel plan. |
| Deferred risky channels | `src/utils/gtm-campaign.ts` keeps Xiaohongshu, Twitter/X, SEO, and referral secondary/deferred as applicable; referral rewards are explicitly blocked until abuse controls exist. | Repo-covered for boundary. |
| Campaign set | `ASTRA_GTM_CAMPAIGNS` defines five scenario-led campaign messages around real-content learning. Tests assert the campaign IDs. | Repo-covered for copy/story plan. |
| Demo scripts | `ASTRA_GTM_DEMO_SCRIPTS` and `docs/gtm/demos.md` define five scripts, each estimated at 60 seconds or less, showing understand/save/review/continue learning loops. Tests assert sub-60 timing and learning-loop steps. | Repo-covered for script artifacts; not capture proof. |
| Landing/store/social/share copy | `ASTRA_GTM_COPY_DECK`, `docs/gtm/demos.md`, and `store/listing-copy.md` contain landing hero, store listing core copy, social posts, and share-card templates. | Repo-covered for draft copy. |
| No internal technical terms | `detectGrowthCopyTechnicalTerms()` and `gtm-campaign.test.ts` guard growth copy against provider/API-key/OpenAI/relay/token language. | Repo-covered for copy safety. |
| Release-gated capability boundary | `evaluateAstraGtmReadiness()` blocks readiness unless promoted capabilities are release-gated and referral rewards remain disabled until abuse controls exist. | Repo-covered for readiness rule. |
| Store screenshot learning-loop target | `evaluateAstraGtmReadiness()` warns when fewer than five store screenshots cover the learning loop. `store/listing-copy.md` includes a six-shot storyboard. | Repo-covered for storyboard requirement; not final screenshot evidence. |
| Launch artifact packet intake | `docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md` records the combined billing/legal/store/GTM packet rows required before launch-complete claims. | Repo-covered for intake guardrail. |

## Explicit non-claims

This note does not prove:

- actual sub-60-second demo videos were recorded for the target build;
- final store or landing screenshots/storyboards were captured from the target build;
- launch copy was owner-approved for the target release;
- paid launch, billing, legal, or store submission readiness;
- campaign distribution, conversion, retention, or performance metrics;
- hosted landing page publication or final public URL availability.

## Required before stronger claim

Before GTM launch-complete or campaign-ready claims, attach:

1. final target-build screenshots/storyboards for store, landing, social, and demo use;
2. current sub-60-second demo capture evidence for the target build/worktree;
3. owner/date/environment verdict rows for Section 27 in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` or the launch artifact packet;
4. claim review showing GTM, landing, store, release-note, and demo copy uses the required downgrade language unless stronger evidence is attached;
5. hosted landing/store/demo URLs or upload records when claiming public launch readiness.

## Suggested focused verification

```bash
pnpm vitest run src/utils/gtm-campaign.test.ts
pnpm vitest run src/utils/macro-operational-evidence.test.ts -t "GTM|RC evidence note|repo evidence entry"
```
