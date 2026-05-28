# Error Experience and Recovery Contract

Date: 2026-05-27

Source: macro product upgrade plan section 10.

Executable source of truth: `src/utils/error-recovery.ts`.

## Scope

This contract defines how Astra should handle user-visible errors. An error is not a technical state; it is an interrupted user task.

Every visible P0 error should answer:

1. What happened?
2. What can the user do now?
3. Did Astra save or keep progress?

This contract complements the support, accessibility, brand, release-gate, and copy-dictionary contracts.

## Copy style

User-visible error copy should be short and actionable. Preferred examples:

- `Astra is taking longer than usual.`
- `Try again.`
- `Use faster mode.`
- `This page is protected.`
- `Try selecting text instead.`
- `No captions found for this video.`
- `Sign in to continue.`
- `Your progress was saved.`

Ordinary user-facing error UI should avoid technical blame terms such as provider, upstream, route, relay, token, stack trace, exception, cache key, and serviceMode.

## Situation-to-action mapping

| Situation | What happened copy | Recovery action | Progress copy |
| --- | --- | --- | --- |
| Content loading is slow | Astra is taking longer than usual. | Wait / Try again | Your progress was saved. |
| AI response is slow | Astra is taking longer than usual. | Use faster mode / Try again | Your progress was saved. |
| Page is protected | This page is protected. | Try selecting text / Open reader | Nothing was changed on this page. |
| No captions | No captions found for this video. | Explain no captions / Try another video | Saved video notes stay available. |
| Not signed in | Sign in to continue. | Sign in | Local learning data stays on this device. |
| Membership limit | You have reached this plan's current limit. | Upgrade / Continue with limited mode | Saved learning assets stay available. |
| Partial failure | Astra finished part of this task. | Retry failed items | Completed items were kept. |
| Large content | This content is long. | Translate visible part first | Continue from the visible part first. |
| Network offline | Astra could not connect right now. | Retry when online | Local progress was kept. |

## Unrecoverable fallback

When the user cannot recover directly, provide one or more of:

- Report this page;
- Copy support info;
- Contact support;
- Help center;
- Try sample page.

Support-related actions must preserve the metadata-only support boundary from `src/utils/support-experience.ts` and `src/utils/support-bundle.ts`.

## Readiness

Use `evaluateAstraErrorRecoveryReadiness()` with UI, copy, support, and release evidence.

Readiness blocks when:

- visible errors do not explain what happened;
- visible errors do not provide a next user action;
- visible errors do not explain whether progress was saved/kept/not-started;
- any Section 10 situation-to-action mapping is missing;
- unrecoverable errors lack support fallback paths;
- failed tasks can silently lose completed progress.

Readiness warns when:

- copy is not consistently short/actionable;
- ordinary user-facing copy exposes technical blame.

## Boundary

This contract does not implement every UI error card. It defines the release contract those cards must satisfy before a surface can claim production-grade error recovery.
