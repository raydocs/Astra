# First 90 Growth Sharing + Referral MVP Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the smallest privacy-safe Product-Led Growth foundation for the First 90 days:

- Share sentence card: share → landing is trackable.
- Referral MVP: invite can be tracked without granting rewards before abuse controls exist.

This slice intentionally started from the authored sample lesson; the next focused user-content slice is limited to explicit user-initiated shares of short saved sentences in the Vocabulary/Library surface.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Growth event names | ✅ Done | Added canonical `share_card_created`, `referral_sent`, `referral_converted`, `landing_visited`, and `landing_install_clicked` events. |
| Sentence-card share helper | ✅ Done | `src/utils/share/sentence-card.ts` builds local share payloads and metadata-only telemetry. No public hosting is introduced. |
| Sample lesson share CTA | ✅ Done | After first review, sample lesson shows `Share sentence card` using authored sample content only. |
| Library saved-sentence share CTA | ✅ Done | Expanded Vocabulary/Library saved cards offer `Share sentence card` only for short, translated, non-local saved snippets; telemetry uses `contentOrigin: user_selected` and metadata only. |
| Referral CTA | ✅ Done | After first review, sample lesson shows `Invite a friend`; telemetry marks it as `non_rewarding` with `schema: astra-referral-readiness.v1`, `sampleContentOnly: true`, and `rewardAvailable: false`. |
| Referral readiness contract | ✅ Done | `src/utils/referral-readiness.ts` defines metadata shape, campaign sanitization, metadata safety checks, invite/conversion rate-limit policy constants, identity-risk evaluation, and readiness gates required before rewards can ever ship. |
| Landing tracking | ✅ Done | Astra Web landing recognizes sentence-card/referral UTM/hash params, stores metadata-only `landing_visited` events locally, sanitizes campaign values, and renders source-specific copy without shared text. |
| Oracle privacy/copy fixes | ✅ Done | Removed user-facing API/model wording from sample copy and added regression coverage for sanitized landing campaign telemetry. |
| Reward grants | Deferred | No Pro/trial rewards are granted; readiness evaluation always returns `rewardGrantsEnabled: false` in this slice. Rewards remain deferred until anti-abuse controls, idempotent ledger readiness, and operator audit readiness are all proven. |
| Broad user-content sharing | Deferred | Do not share all reading history, full page/PDF/subtitle content, local file snippets, or public-hosted user content; the shipped user-content slice is explicit short saved-sentence sharing only. |

## Privacy/copyright boundary

- No full page URL, article excerpt, content summary, prompt, provider, model, or API key appears in growth telemetry.
- Sentence-card telemetry stores only metadata such as `landingSource`, `contentOrigin`, `contentLengthBucket`, and whether a source title exists.
- Web landing does not host or reconstruct shared sentence text.
- Vocabulary/Library share-card creation records `share_card_created` with `contentOrigin: user_selected` but never source URLs, URL paths, query strings, or raw sentence/translation text.
- Referral MVP is non-rewarding to avoid shipping incentive abuse before server-side controls exist.
- Referral readiness is a contract/evaluator only: it must not create Pro/trial entitlements, start trials, change billing, add checkout/payment/subscription flows, grant rewards, or mutate account plans.

## Validation

```text
pnpm test src/utils/referral-readiness.test.ts src/utils/share/sentence-card.test.ts src/entrypoints/sample-lesson/SampleLessonApp.test.tsx src/utils/operating-review.test.ts
# 4 files / 18 tests passed

pnpm type-check
# Blocked by pre-existing ServerDeviceRecord expoPushToken/expoPushTokenUpdatedAt/expoPushTokenPlatform errors in src/server/index.ts and src/server/cloudflare-shadow-audit.test.ts

pnpm check:repo-knowledge
# [repo-knowledge-exit] code=0
```
