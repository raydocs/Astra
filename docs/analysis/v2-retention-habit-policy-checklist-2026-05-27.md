# V2 Retention Habit Policy Checklist — 2026-05-27

Source: `/Users/ruirui/Downloads/astra-zero-config-saas-operating-model-2026-05-27.md`, section 11 and V2 roadmap.

## Scope

This slice makes Astra's retention/reminder policy executable without adding notification delivery, email delivery, or new UI surfaces.

## Coverage

| Requirement | Status | Evidence |
|---|---:|---|
| Today Review remains light and content-backed | ✅ Contracted | `ASTRA_RETENTION_LOOP_POLICIES` defines `today_review`; `evaluateAstraRetentionTouchpoint()` suppresses it when no reviewable cards exist and caps copy to a small card count. |
| Continue Reading/Watching requires an actionable target | ✅ Contracted | `continue_reading`, `continue_watching`, and `source_return` suppress with `no_continue_target` unless source/action metadata exists. |
| Weekly Digest must contain real learning value | ✅ Contracted + locally instrumented | `weekly_digest` suppresses empty summaries and the Library MVP emits `digest_viewed` only when the local digest card is visible with aggregate digest value. |
| Weekly Digest open is observable | ✅ Locally instrumented | The Library digest Open review CTA emits metadata-only `digest_opened` before switching to Review; no email, notification, or server delivery is added. |
| Reminder opt-out is respected | ✅ Contracted + locally instrumented | Reminder/digest/win-back loops with `respectsOptOut` return `user_opted_out` before display; source-level Reading queue digest exclusion emits metadata-only `reminder_disabled` when newly enabled. |
| Email reminders are optional and unsubscribeable | ✅ Contracted | Email channels are marked `optional_email`; Privacy Mode and unsubscribe remove optional email from eligible channels. |
| No shame/anxiety/streak pressure | ✅ Contracted | Policy guardrails explicitly ban shame, guilt, urgency, streak pressure, and fear-of-falling-behind copy. |
| Retention telemetry is privacy-safe | ✅ Contracted + locally tested | Canonical events now include `review_opened`, `continue_clicked`, `digest_viewed`, `digest_opened`, `reminder_dismissed`, `reminder_disabled`, and `winback_sent`; metrics docs define content-free property policies. Weekly Digest MVP tests assert source opt-out telemetry excludes source ids, titles, URLs, snippets, and raw content. |
| Pro value summary sells learning value, not tokens/models | ✅ Contracted | `pro_value_summary` only shows for trial/pro learning value and guardrails ban token/provider/model value framing. |

## Deferred

- Notification scheduler, browser permission prompts, email sending, and unsubscribe backend wiring.
- Production digest email/web delivery beyond the existing local Library digest card; current observability remains local-only.
- Cohort-level retention dashboard UI.
- Win-back lifecycle automation and deliverability controls.

## Validation

Completed in this slice:

- `pnpm test src/utils/retention-habits.test.ts src/utils/learning-loop-events.test.ts` → 2 files / 19 tests passed (`RETENTION_TEST_EXIT:0`).
- `pnpm type-check` → passed (`TYPECHECK_EXIT:0`).
- `pnpm check:repo-knowledge` → passed (`REPO_KNOWLEDGE_EXIT:0`).

- Oracle review for the multi-file policy/docs/event update → LGTM.
