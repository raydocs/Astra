# Support / Help Center Evidence Note — 2026-05-28

## Scope

This note covers repo-side Section 14 support, help-center, and status-boundary evidence for public-beta downgrade claims. It does not claim a hosted production help center, monitored support inbox, SLA, public status service, incident-response staffing, or completed target-build support-entrypoint walkthroughs.

## Current repo evidence

| Claim area | Current evidence | Verdict |
|---|---|---|
| Support entry contract | `src/utils/support-experience.ts` defines Report this page, Send feedback, Contact support, Copy support bundle, Help center, Status page, and Known limitations entries with P0/P1 priority. `src/utils/support-experience.test.ts` asserts the entry matrix. | Repo-covered for contract. |
| Metadata-only support bundle | `src/utils/support-experience.ts` and `src/utils/support-bundle.ts` define allowed metadata fields and forbidden content fields. Tests assert no page text, selected text, saved snippet text, transcript text, screenshots, prompts, model output, full URLs, paths, or query strings are included by default. | Repo-covered for privacy boundary. |
| Bundle preview / fallback requirement | `evaluateAstraSupportExperienceReadiness()` blocks readiness unless bundle preview and authenticated-submit-or-download fallback evidence are present. `docs/specs/support-experience.md` records the same requirement. | Repo-covered as readiness rule. |
| Required help topics | `ASTRA_SUPPORT_HELP_TOPICS` covers translate first page, pages cannot be translated, automatic AI handling, save/review sentences, Privacy Mode, delete data, video captions, and membership. `support-experience.test.ts` verifies every doc exists, has the expected title, has no TODO, and avoids devtools language. | Repo-covered for help topic inventory. |
| Help index | `docs/help/index.md` links every required help topic, known limitations, and the status boundary. | Repo-covered for repo help index. |
| Known limitations | `docs/help/known-limitations.md` exists and is guarded by `support-experience.test.ts`; it is also referenced from `docs/help/index.md`. | Repo-covered for beta limitation publication boundary. |
| Status boundary | `docs/status.md` documents user-safe degraded modes and explicitly says it is not a hosted production status page. | Repo-covered for status copy boundary. |
| First-response macros | `src/utils/support-response-macros.ts` and `src/utils/support-response-macros.test.ts` provide ordinary-language first-response coverage for support report categories; `docs/specs/support-experience.md` records macro coverage behavior. | Repo-covered for macro catalog boundary. |
| Server/operator support routes | `src/server/index.ts` includes support report submission, support summary, triage, handoff, known issue, and audit paths; macro evidence also includes server tests through existing support and ops coverage. | Repo-covered for route foundation, not hosted operations. |
| User-facing entrypoints | `src/entrypoints/options/OptionsApp.tsx`, `src/entrypoints/popup/App.tsx`, `src/entrypoints/content/components/FloatBall.tsx`, and `src/web/src/app.tsx` are current repo surfaces listed in macro evidence for support/report/help entrypoints. | Repo-covered as implementation references; target-build walkthrough remains external/manual. |

## Explicit non-claims

This note does not prove:

- hosted help-center URL availability;
- hosted production status-page availability;
- monitored support inbox ownership or staffing;
- SLA, escalation, on-call, or incident-response policy execution;
- target-build browser/mobile walkthrough evidence for support entrypoints;
- production support ticket workflow, customer replies, or notification routing.

## Required before stronger claim

Before stronger support maturity or launch-complete claims, attach:

1. filled Section 14 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` with owner, date, target build/environment, evidence links, and verdicts;
2. hosted help-center and status-page URL evidence for the target release;
3. monitored support owner/inbox evidence and incident/escalation path approval;
4. target-build support-entrypoint walkthroughs for popup, options, content error/report, web/help, and local support-bundle copy/download;
5. evidence that production support reports remain metadata-only and that support staff have a documented first-response path.

## Suggested focused verification

```bash
pnpm vitest run src/utils/support-experience.test.ts src/utils/support-bundle.test.ts src/utils/support-response-macros.test.ts
pnpm vitest run src/utils/macro-operational-evidence.test.ts -t "support|RC evidence note|repo evidence entry"
```
