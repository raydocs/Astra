# Minimal Weekly Digest Delivery Ops Summary Checklist — 2026-05-28

## Repo-side evidence landed

- Operator-gated route: `GET /v1/ops/weekly-digest/delivery-summary`.
- Source data: retained `ops_weekly_digest_delivery_run` metadata from the ops audit log.
- Summary schema: `astra-weekly-digest-delivery-summary.v1`.
- Channels: email, push, and unknown fallback for older/malformed entries.
- Counts: run count, dry-run count, considered recipients, relay/provider API accepted count, unavailable count, failed count, and last run timestamp.
- Recent runs: bounded metadata-only recent run list without user rows.

## Privacy boundary

The summary is intentionally aggregate-only and metadata-only.

It must not include:

- Raw emails or email hashes.
- Raw push tokens or device IDs/hashes.
- Digest IDs.
- Saved words, saved sentences, notes, source URLs, page content, screenshots, or rendered digest text.
- Provider secrets, operator tokens, API keys, or per-user timelines.

The endpoint records its own metadata-only `ops_weekly_digest_delivery_summary_viewed` audit entry after the summary is generated.

## Product/ops limitation

`relayAcceptedCount` is the old delivery-run `deliveredCount` exposed with a narrower name. It means the relay/provider API accepted the request path used by the run; it is not proof of inbox delivery, APNs/FCM device delivery, push display, or user open.

The response therefore explicitly reports:

- `relayAcceptedOnly: true`
- `providerWebhookReceiptsIncluded: false`
- `inboxDeliveryConfirmed: false`
- `deviceDeliveryConfirmed: false`
- `apnsFcmReceiptsIncluded: false`
- `resendEventIngestionIncluded: false`

## Still required before stronger production delivery claims

- Production Resend event ingestion/webhook evidence.
- Production Expo/APNs/FCM receipt ingestion and device-level delivery evidence.
- Signed-device TestFlight/Play closed-test notification proof.
- Alert thresholds, on-call/owner routing, and dashboard exports.
- Owner-approved dated delivery-monitoring packet for the target release environment.

## Verification

Focused test added in `src/server/index.test.ts`:

- `summarizes weekly digest delivery runs as aggregate-only ops metadata`

Expected local command:

```bash
pnpm vitest run src/server/index.test.ts -t "weekly digest"
```
