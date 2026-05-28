# Support and After-Sales Experience Contract

Date: 2026-05-27

Source: macro product upgrade plan section 14.

Executable sources of truth: `src/utils/support-experience.ts` and `src/utils/support-response-macros.ts`.

## Scope

This contract defines Astra's user-facing support experience beyond the existing metadata-only report implementation. It covers support entry points, required support-bundle metadata, help-center topics, status/known-limitations boundaries, first-response macro coverage, and release readiness.

It does not choose a help-center vendor, support-desk vendor, SLA policy, customer-reply workflow, or production status-page host.

## Required support entries

| Entry | Priority | Purpose |
| --- | --- | --- |
| Report this page | P0 | Let users report page/video/content failures without devtools and without sending page text by default. |
| Send feedback | P1 | Capture confusion, quality feedback, and product friction with privacy-safe context. |
| Contact support | P0 | Give beta/paid users a clear human-support path when self-serve recovery is insufficient. |
| Copy support bundle | P0 | Allow local copy/download of metadata-only troubleshooting details. |
| Help center | P0 | Route common user questions to ordinary-language help. |
| Status page | P1 | Explain service incidents and degraded modes without exposing provider internals in ordinary UI. |
| Known limitations | P0 | Set public beta expectations for unsupported pages, captions, platform limits, and billing boundaries. |

## Metadata-only support bundle

A support bundle may include these metadata fields by default:

- extension version;
- browser;
- operating system;
- page hostname only, without path/query/full URL;
- feature surface;
- last action;
- error category;
- membership state category;
- Privacy Mode state;
- timestamp.

A support bundle must not include these fields by default:

- page text;
- selected text;
- saved snippet text;
- video transcript text;
- screenshot;
- user input text;
- prompt text;
- model output text;
- full URL;
- URL path;
- query string.

Users should see a preview before remote submission or local download. Authenticated submission is preferred when available; local JSON copy/download is the fallback when offline or unauthenticated.

## Help center topics

Minimum help-center topic set:

| Topic | Repo doc |
| --- | --- |
| How to translate your first page | `docs/help/translate-first-page.md` |
| Why some pages cannot be translated | `docs/help/pages-cannot-be-translated.md` |
| How Astra handles AI automatically | `docs/help/automatic-ai-handling.md` |
| How to save and review sentences | `docs/help/save-and-review-sentences.md` |
| How Privacy Mode works | `docs/help/privacy-mode.md` |
| How to delete your data | `docs/help/delete-your-data.md` |
| Why a video has no captions | `docs/help/video-has-no-captions.md` |
| How membership works | `docs/help/membership-works.md` |

Help copy should be ordinary-language and should not require developer tooling knowledge. The repo-side help index is `docs/help/index.md`.

## First-response support macros

Support first responses should start from ordinary user language and metadata-only context. The executable catalog in `src/utils/support-response-macros.ts` currently covers every `SupportBundleIssueCategory`:

- translation quality;
- page not working;
- video subtitles;
- file reader;
- review/library;
- account access;
- privacy question;
- other/general support.

`GET /v1/ops/support/reports/summary` includes `macroCoverage` so operators can see whether submitted report categories have a matching first-response macro. Coverage is aggregate-only: it uses support report issue categories and counts, not message bodies, page text, transcripts, screenshots, prompts, model output, emails, device ids, or session ids.

The V0 threshold is 80% first-response macro coverage. No submitted reports returns `reportedCoverage.coverageRate: null`; the static catalog still reports category coverage.

## Weekly known-issue visibility

`GET /v1/ops/support/reports/summary` also includes `weeklyTopIssues[]` so support can see the top aggregate issue for each UTC week. The weekly view groups by hostname, feature surface, issue category, and linked known issue id/status. It exists to make repeated failure patterns visible for backlog triage without exposing message bodies, page text, transcripts, screenshots, prompts, model output, emails, device ids, or session ids.

## Status page and known limitations

A status page or substitute release-note/status section should describe user-visible service incidents and degraded modes. Provider/model/operator diagnostics should remain internal unless translated into user-safe language. The repo-side status boundary is `docs/status.md`.

Known limitations should be published alongside beta/public claims so users understand page restrictions, dynamic pages, missing video captions, unsupported platforms, and beta billing boundaries. The repo-side known-limitations article is `docs/help/known-limitations.md`.

## Readiness

Use `evaluateAstraSupportExperienceReadiness()` with evidence from UI, docs, support-bundle schema, release notes, and help-center copy review.

Readiness blocks when:

- Report this page is missing;
- Contact support is missing;
- Copy support bundle is missing;
- Help center is missing;
- Known limitations are missing;
- metadata-only bundle fields are incomplete;
- sensitive content is included by default;
- bundle preview is missing;
- required help topics are missing;
- known limitations are not public;
- support copy requires devtools or technical internals;
- reporting lacks authenticated submission or local download fallback.

Readiness warns when:

- Send feedback is missing;
- Status page is missing;
- Status page/degraded-mode boundary is undefined.

## Boundary

This contract complements `src/utils/support-bundle.ts`, `src/utils/support-response-macros.ts`, `src/utils/data-retention-control.ts`, `src/utils/ops-console.ts`, and `src/utils/release-stage-gate.ts`. It does not claim that a full support desk, customer-reply workflow, SLA inbox, notification system, or public status service is complete.
