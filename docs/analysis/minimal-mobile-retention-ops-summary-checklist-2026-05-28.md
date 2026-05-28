# Minimal Mobile Retention Ops Summary Checklist — 2026-05-28

## Scope

Add the smallest useful remote mobile-retention visibility slice: an operator-only aggregate API over retained, sanitized mobile retention events.

This is repo-side operational visibility. It is not a production cohort dashboard, warehouse export, release metrics packet, staff console, alerting workflow, or owner-approved launch evidence.

## Current implementation status

| Area | Status | Evidence |
|---|---|---|
| Mobile upload source | ✅ Done | Signed-in non-sample mobile clients can upload sanitized `astra-mobile-retention-events.v1` batches through `POST /v1/account/mobile-retention-events`. |
| Retained server store | ✅ Done | `FileUserStore.recordMobileRetentionEvents()` stores bounded events per authenticated user and strips unsafe metadata before storage. |
| Operator auth boundary | ✅ Done | `GET /v1/ops/mobile-retention/summary` requires an operator token and allows `support_lead`, `ops_engineer`, or `admin`. |
| Aggregate summary | ✅ Done | `FileUserStore.summarizeMobileRetention()` groups only by UTC day/week bucket and event name. |
| Privacy boundary | ✅ Done | The response is aggregate-only and omits email, owner id, device id, event id, session token, push token, raw metadata rows, and user timelines. |
| Ops audit | ✅ Done | Successful summary views record `ops_mobile_retention_summary_viewed` with metadata-only audit privacy. |
| Full production metrics export | Deferred | Production metric maturity still requires dated dashboard/query exports, cohort definitions, owner/date, evidence links, and privacy review. |

## Endpoint

```text
GET /v1/ops/mobile-retention/summary?grain=day|week
X-Astra-Operator-Token: <operator token>
```

`grain=day` is the default. `grain=week` uses UTC Monday week starts.

## Response schema

```ts
{
  schema: "astra-mobile-retention-summary.v1",
  generatedAt: string,
  source: "metadata_only_mobile_retention_events",
  retainedEventsPerUserLimit: number,
  grain: "day" | "week",
  totalEvents: number,
  buckets: Array<{
    bucket: string,
    eventName: string,
    count: number,
  }>,
  byEventName: Array<{
    eventName: string,
    count: number,
  }>,
  privacy: {
    metadataOnly: true,
    aggregateOnly: true,
    perUserRows: false,
    rawContentIncluded: false,
    identifiersIncluded: false,
  },
}
```

## Privacy boundary

Allowed in the response:

- event names from the existing mobile retention allowlist;
- UTC day/week buckets;
- aggregate counts;
- schema/source/retention-limit metadata;
- explicit privacy flags.

Not allowed in the response:

- raw saved words, sentences, card text, translations, explanations, source titles, URLs, page content, screenshots, prompts, model output, or transcripts;
- email addresses, billing emails, owner ids, device ids, event ids, session ids, push tokens, support identifiers, or per-user rows;
- raw metadata values such as failure reason strings, source types, pending counts, reminder times, or local status values.

## Source limitation

The source is the bounded retained server copy of sanitized mobile retention events. This makes remote mobile activity visible enough for operational smoke checks and directional release review, but it is not a durable warehouse, not a cohort-retention dashboard, and not production metric export evidence.

## Validation

Latest local validation after adding the endpoint:

```bash
pnpm vitest run src/server/index.test.ts -t "mobile retention"
```

Result: 1 file / 4 matching tests passed.

## Deferred

- Production dashboard or warehouse export.
- Cohort definitions and date-range locked metric packets.
- Alerting, paging, SLA workflow, or ops saved views.
- User-level drilldowns or per-device timelines.
- Owner-approved production metric evidence packet.