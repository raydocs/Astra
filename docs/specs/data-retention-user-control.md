# Data Retention, Copyright, and User Control

Source plan: Section 26 from the macro product upgrade plan dated 2026-05-27.

Astra treats user-saved learning snippets as assets. Full third-party pages, full transcripts, and complete documents are not default learning assets.

## Executable policy source

- Policy and readiness helper: `src/utils/data-retention-control.ts`
- Export content boundary: `src/utils/storage/learning-data-export.ts`
- Source-level sync/digest controls: `src/utils/storage/owned-reading.ts` and Library source controls
- Support metadata-only schema: `src/utils/support-bundle.ts`
- Memory inventory/control visibility: `src/utils/storage/learning-memory.ts`

## Data retention categories

`ASTRA_DATA_RETENTION_POLICIES` defines the default policy for:

- account data;
- settings;
- source metadata;
- saved snippets;
- review cards;
- vocabulary;
- full page text;
- transcript full text;
- telemetry;
- support bundles.

The policy explicitly marks full page text as transient/not synced by default and full transcript text as cautious/limited, while saved snippets, vocabulary, and review cards are user-initiated assets.

## Copyright boundaries

`ASTRA_COPYRIGHT_BOUNDARIES` keeps the product conservative:

- Web articles: translate/display and save short learning snippets; do not default-export complete articles.
- YouTube transcripts: save chosen sentence/timecode snippets; do not bulk-export full transcripts by default.
- PDF/EPUB: let users read local files and save selected learning snippets; do not redistribute full documents.
- User input: rewrite/correct and save only by user choice; do not share/train without authorization.
- AI summaries: personal learning notes are allowed; public sharing should not replace the original work.

## User-control readiness checklist

`evaluateAstraDataControlReadiness()` checks current evidence for:

- Privacy Mode visibility and accurate copy;
- saved-item deletion;
- related review-card cascade handling;
- learning-data export;
- per-source sync disable;
- per-source digest exclusion;
- delete-account-data help path;
- support bundle preview;
- metadata-only support defaults;
- export copyright boundary;
- existing learning asset access after membership cancellation;
- explicit source-delete cascade choice.

P0 controls block readiness when missing. P1 controls produce warnings so they remain visible without pretending a convenience control is equivalent to a privacy/copyright blocker.

## Honest Privacy Mode copy

Privacy Mode copy must not promise local-only translation or total secrecy. Current approved boundary:

> Privacy Mode reduces page context and automatic memory use. Translation text may still leave the device on direct provider or relay paths.

## Remaining work boundary

This policy contract does not by itself prove every UI is production-grade. Repo-side account/delete foundations now include the Node relay account-delete path and Cloudflare collection-scoped continuity export/delete lifecycle. Remaining work includes deployed-route/queue/storage receipts for the target release, manual RC walkthroughs, complete account/billing/legal deletion orchestration evidence, signed legal copy, and final cancellation/access evidence for paid launch.
