# Minimal support handoff checklist — 2026-05-27

## Scope implemented

- Support triage records include metadata-only `followUp` state for handoff path, status, selected first-response macro id, reason, and operator/timestamp metadata.
- Existing triage updates accept nested `followUp` patches without resetting unrelated triage fields.
- Support summaries expose aggregate follow-up handoff counts by path and status.
- Support summaries now include metadata-only `slaRisk` counters for unresolved, urgent unresolved, stale triage age buckets, follow-up overdue count, oldest unresolved age, and generated/current time.
- Operator support report payloads include a metadata-only recommended first-response macro derived from issue category.
- Follow-up handoff updates write a separate metadata-only `ops_support_handoff_updated` audit action.
- Web operator UI can view and update compact handoff path/status/macro/reason controls.

## Explicit exclusions

- No email sending.
- No customer reply capture.
- No per-ticket SLA clock workflow, reminders, or notifications; `slaRisk` is aggregate visibility only.
- No hosted support desk, CRM, or external queue integration.
- No raw tokens, emails, devices, sessions, user content, URLs, screenshots, transcripts, or page text in handoff audit metadata.

## Validation checklist

- Old triage records default to `not_selected` / `not_started` follow-up state.
- Invalid macro ids are rejected before retained support data is overwritten.
- Follow-up patches preserve unrelated triage status, priority, assignment, and resolution fields.
- Support summary `handoffSummary` counts match retained report metadata.
- Support summary `slaRisk` math uses only `submittedAt`, triage status/priority/updatedAt, and follow-up path/status/updatedAt.
- SLA risk output remains aggregate-only: no raw tokens, emails, devices, sessions, user content, URLs, screenshots, transcripts, page text, or report ids.
- Web normalization fills missing follow-up fields for older server payloads.
