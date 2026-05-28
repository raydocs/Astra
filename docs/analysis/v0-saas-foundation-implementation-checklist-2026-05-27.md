# V0 SaaS Foundation Implementation Checklist

Source strategy document: `docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`.
Generated planning context: `prompt-exports/oracle-plan-2026-05-27-130314-v0-saas-foundation-1-15a3.md` (ignored; use this checklist for tracked handoff).

## Scope

Implement the V0 / first-30-days foundation only:

- Task cost class registry.
- Free / Trial / Pro entitlement matrix.
- Technical-to-human copy dictionary.
- Metadata-only support bundle / report-flow foundation.
- Cost/routing decision logging without body text.
- Feature flag / kill switch list.

Do **not** build full dashboards, a production ops console, remote report submission, or payment gateway workflows in this tranche.

## Privacy and copy constraints

Default ledgers/reports must not persist raw page text, selected text, transcripts, file text, prompts, user notes, or full URL path/query.

Ordinary user-facing copy must avoid these technical terms unless clearly internal/developer-only:

- provider
- model
- API key
- token
- quota
- upstream
- relay
- prompt
- rate limit

## Implementation order

1. Add shared operating-model schemas and helpers:
   - `src/types/operating-model.ts`
   - `src/utils/operating-model.ts`
   - tests in `src/utils/operating-model.test.ts`
2. Add copy dictionary and entitlement matrix:
   - `src/utils/copy-dictionary.ts`
   - `src/utils/entitlements.ts`
   - tests in `src/utils/copy-dictionary.test.ts` and `src/utils/entitlements.test.ts`
   - add `trial` to `AstraPlanSchema` in `src/types/auth.ts`
3. Extend local translation usage schema:
   - `src/utils/storage/translation-usage.ts`
   - `src/utils/storage/translation-usage.test.ts`
4. Extend provider routing metadata:
   - `src/utils/providers/routing-metadata.ts`
   - `src/utils/providers/router.ts`
5. Wire extension background logging:
   - `src/entrypoints/background/index.ts`
   - `src/entrypoints/background/index.test.ts`
   - include cached-only usage events.
6. Extend support bundle/report foundation:
   - `src/utils/support-bundle.ts`
   - `src/utils/support-bundle.test.ts`
7. Extend feature flags and kill switch list:
   - `src/utils/feature-flags.ts`
   - `src/utils/feature-flags.test.ts`
   - `docs/specs/feature-flags-kill-switches.md`
8. Extend server provider detailed metadata:
   - `src/server/providers.ts`
9. Extend server usage persistence:
   - `src/server/types.ts`
   - `src/server/user-store.ts`
   - `src/types/auth.ts` usage event metadata fields
   - `src/server/user-store.test.ts`
10. Wire `/v1/translate` server logging:
    - `src/server/index.ts`
    - `src/server/index.test.ts`
11. Update env/docs:
    - `src/server/config.ts`
    - `src/server/.env.example`
    - `docs/specs/metrics-dictionary.md`
12. Validate:
    - targeted tests for touched files
    - `pnpm type-check`
    - broader `pnpm test` if time permits

## Suggested primitives

Task classes: `instant_phrase`, `paragraph_understanding`, `context_explanation`, `deep_reading`, `video_summary`, `review_card`, `writing_assist`, `digest`.

Cost buckets: `low`, `medium`, `high`, `long_running`.

Latency buckets: `unknown`, `instant`, `fast`, `standard`, `slow`, `long_running`.

Cache statuses: `unknown`, `disabled`, `miss`, `partial`, `hit`.

Fallback reasons: `none`, `timeout`, `outage`, `cost`, `length`, `quality`, `unknown`.

Operating tiers: `free`, `trial`, `pro`, `unknown`.

Surfaces: `page`, `selection`, `video`, `file`, `review`, `library`, `account`, `onboarding`, `settings`, `writing`, `digest`.

## Current progress

- [x] Strategy document copied into `docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`.
- [x] Shared operating-model primitives.
- [x] Entitlement matrix and copy dictionary.
- [x] Local usage/routing ledger metadata.
- [x] Support/report foundation.
- [x] Feature flag/kill switch list.
- [x] Server usage/routing decision logging.
- [x] First 30 cost dashboard MVP follow-up: operator-only `GET /v1/ops/cost/usage-summary` aggregates retained usage events by tier/task/cost bucket without user/content/provider/model rows. See `docs/analysis/first-30-ops-cost-dashboard-checklist-2026-05-27.md`.
- [x] Targeted validation: `pnpm test` over V0 utilities/background/server config/server plus owned-reading/learning-assets compatibility tests (16 files / 192 tests passing on 2026-05-27).
- [x] Oracle review pass completed and P1/P2 fixes applied: preserve persisted plan tier, explicit support-report consent, local `surface` logging, improved task classification, selection support surface, feature/global kill switch rule, and Free < Trial < Pro example limits.
- [x] Full `pnpm type-check` passes on 2026-05-27 (`tsc --noEmit && tsc -p src/web/tsconfig.json --noEmit`).
- [x] Repo-knowledge guardrail passes on 2026-05-27 (`pnpm check:repo-knowledge`).
