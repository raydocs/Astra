# Learning Digest QA Evidence Note — 2026-05-28

## Scope

This note covers the repo-side Section 12 Learning Digest evidence currently available for a public-beta boundary claim. It does not claim production email, notification, inbox/device delivery, provider receipt ingestion, or completed target-build manual/browser QA.

## Current repo evidence

| Claim area | Current evidence | Verdict |
|---|---|---|
| Digest content contract | `src/utils/learning-digest-experience.ts` defines pages read, videos watched, new saved words/sentences, reviewed cards, common topics, repeated vocabulary, recommended review, and recommended continue. `src/utils/learning-digest-experience.test.ts` asserts the content IDs and privacy boundaries. | Repo-covered for the contract. |
| Low-interruption default surfaces | `ASTRA_DIGEST_SURFACES` keeps popup card and web companion as `now`; optional email and notification stay `later_optional` and require controls. | Repo-covered for default product boundary. |
| Rendered local digest | `src/entrypoints/vocabulary/VocabularyApp.tsx` renders `library-weekly-digest-card`; `VocabularyApp.test.tsx` verifies saved/reviewed/source counts, source breakdown, repeated vocabulary, and continue-source copy. | Repo-covered for local Library card. |
| Review action | `VocabularyApp.test.tsx` verifies the digest Review CTA records `digest_opened` and switches to Review. | Repo-covered for local Review action. |
| Continue action | `VocabularyApp.test.tsx` verifies continue-source copy from source progress; `src/utils/storage/learning-assets.test.ts` verifies `recommendedContinueTarget` is derived from metadata-safe source progress. | Repo-covered for local continue target. |
| Repeated vocabulary / common topics | `src/utils/storage/learning-assets.test.ts` verifies repeated vocabulary and common topic summaries from metadata-safe assets; `VocabularyApp.test.tsx` verifies repeated vocabulary is rendered in the digest card. | Repo-covered for local insights. |
| Source-level digest exclusion | `src/utils/storage/learning-assets.test.ts` verifies source-controlled items marked `excludedFromDigest` are omitted from digest metrics. | Repo-covered for local exclusion behavior. |
| Privacy-safe local content | `VocabularyApp.test.tsx` and `learning-assets.test.ts` verify raw sentences, explanations, and saved learning text are not present in digest view models, card text, or local telemetry summaries. | Repo-covered for local privacy boundary. |
| Local telemetry | `VocabularyApp.test.tsx` verifies `digest_viewed` is recorded once per visible card lifetime and `digest_opened` is metadata-only for the Review CTA. `docs/specs/metrics-dictionary.md` records the allowed metadata fields. | Repo-covered for local instrumentation boundary. |
| Relay email/push foundation | `src/server/index.ts` supports authenticated manual email, operator email delivery runs, operator push delivery runs, and `GET /v1/ops/weekly-digest/delivery-summary`. `src/server/index.test.ts` covers dry-run/Resend/push summary behavior. | Repo-covered as foundation only; not production deliverability proof. |

## Explicit non-claims

This note does not prove:

- current target-build browser walkthrough evidence for every Section 12 row;
- Privacy Mode outbound behavior in a signed target build;
- production Resend inbox delivery or event webhook ingestion;
- Expo/APNs/FCM receipt ingestion, device delivery, notification display, or open rates;
- owner-approved monitoring dashboards, alert thresholds, or on-call routing;
- production cohort metric exports for digest view/open targets.

## Required before stronger claim

Before stronger Learning Digest completion or production delivery claims, attach:

1. target-build Learning Digest QA evidence with owner, date, target build/environment, evidence links, and verdicts;
2. browser/mobile walkthrough evidence for rendered digest Review/continue behavior, repeated-vocabulary/common-topic display, optional outbound controls, and Privacy Mode outbound restrictions;
3. production Resend and Expo/APNs/FCM delivery-monitoring evidence with receipt source, dashboard/query links, and owner approval;
4. final downgrade/launch copy approval that distinguishes local digest value from production delivery maturity.

## Suggested focused verification

```bash
pnpm vitest run src/utils/learning-digest-experience.test.ts src/utils/storage/learning-assets.test.ts src/entrypoints/vocabulary/VocabularyApp.test.tsx -t "digest|Digest|weekly"
pnpm vitest run src/server/index.test.ts -t "weekly digest"
```
