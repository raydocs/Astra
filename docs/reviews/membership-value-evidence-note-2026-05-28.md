# Membership Value Evidence Note — 2026-05-28

## Scope

This note covers repo-side Section 8 membership value evidence for a public-beta boundary claim. It does not claim paid launch readiness, production billing readiness, legal approval, in-app purchase readiness, entitlement correctness in production, or final Free/Pro launch behavior.

## Current repo evidence

| Claim area | Current evidence | Verdict |
|---|---|---|
| Value beyond usage | `src/utils/membership-value.ts` defines membership value around no setup, automatic capability choice, stability, faster/higher-quality understanding, unified content surfaces, saveable content, automatic Review, continuity, support, and maintenance. `src/utils/membership-value.test.ts` asserts this set. | Repo-covered for value framing. |
| Prompt timing | `ASTRA_MEMBERSHIP_VALUE_MOMENTS` keeps prompts near feature value moments and avoids opening hard-sell behavior in the readiness evaluator. | Repo-covered for strategy contract. |
| Preferred / forbidden copy | `ASTRA_MEMBERSHIP_COPY_EXAMPLES`, `ASTRA_MEMBERSHIP_FORBIDDEN_TERMS`, and `findMembershipForbiddenCopyTerms()` guard learning-first copy and provider/model/token/quota/relay leakage. | Repo-covered for copy guardrails. |
| Free / Pro / later boundaries | `ASTRA_MEMBERSHIP_TIERS` records Free, Pro, and deferred Premium/Family/Classroom boundaries; tests assert Pro includes video/file learning, Library, sync, and Learning Digest while later tiers stay deferred. | Repo-covered for strategy boundary. |
| Existing asset access after cancellation | `evaluateAstraMembershipValueReadiness()` blocks readiness unless cancellation keeps existing learning assets accessible. | Repo-covered as a readiness requirement. |
| Mobile status display | `apps/mobile/src/domain/mobileMembership.ts` derives Free, Trial, Pro active, Sync paused, Signed in, Sample review, and Sign in needed display states for Me. `apps/mobile/src/screens/MeScreen.tsx` renders that status card. | Repo-covered for mobile status copy. |
| Mobile no-technical-copy boundary | `apps/mobile/src/domain/mobileMembership.test.ts` verifies mobile membership copy excludes provider, model, quota, token, relay, API key, backend, route, checkout, subscribe, purchase, and upgrade language. | Repo-covered for mobile copy safety. |
| Mobile privacy boundary | `apps/mobile/src/domain/mobileMembership.test.ts` verifies signed-in email addresses are not exposed in membership copy and that session expiry is not treated as membership expiry. | Repo-covered for mobile privacy/status safety. |
| Public beta billing boundary | `docs/runbooks/billing-free-policy.md` and `docs/help/membership-works.md` keep current release wording at free public-beta unless billing, entitlement, cancellation/refund, legal, and store evidence are attached. | Repo-covered for downgrade boundary. |

## Explicit non-claims

This note does not prove:

- production checkout, portal, webhook, refund, tax, subscription, or entitlement behavior;
- App Store / Play in-app purchase or external purchase policy approval;
- final legal/privacy/terms approval for paid membership;
- owner-approved launch pricing or GTM copy;
- target-build manual QA for every paid value moment;
- paid features being launched in the current public beta.

## Required before stronger claim

Before stronger paid membership, Pro value, or launch-complete claims, attach:

1. production billing checkout/portal/webhook/cancellation/refund evidence;
2. entitlement tests and deployment evidence for the target release environment;
3. owner/legal approval for pricing, terms, privacy, and store policy wording;
4. target-build manual QA rows for Free/Trial/Pro/canceled/expired membership states and existing-asset access after cancellation;
5. store console approval evidence if native mobile paid/subscription claims are present.

## Suggested focused verification

```bash
pnpm vitest run src/utils/membership-value.test.ts apps/mobile/src/domain/mobileMembership.test.ts
pnpm --dir apps/mobile type-check
```
