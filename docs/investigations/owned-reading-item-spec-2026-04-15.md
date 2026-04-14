# Owned reading item spec companion (Month 3)

_Version: 2026-04-15 · Status: synced to implemented schema v1_

This file is the short companion to the canonical schema doc:

- `docs/investigations/owned-reading-schema-v1-2026-04-14.md`

## What is implemented now

`OwnedReadingItem` already exists in `src/utils/storage/owned-reading.ts` and is the shared persistence model for:

- article
- pdf
- epub
- subtitle-file

It already carries:

- stable row identity
- source metadata (`sourceUrl` / `localUri` / `reopenHint`)
- queue status (`in_progress` / `saved` / `archived`)
- optional per-item progress payload
- joins into reading history and study progress when available

## Important Month 3 boundaries

- Local-file items use synthetic `astra-local://...` identities derived from file name.
- Cross-device file sync is still out of scope; do not treat local-file identity as a cloud ingest contract.
- Queue/revisit work should consume the existing owned-reading store rather than inventing a parallel schema.
- Vocabulary/review back-links are intentionally narrow in v1: popup deep-read article saves and subtitle-reader saves now carry owned-reading source references; universal all-surface back-linking remains later work.
- New generalized resume payloads are not part of schema v1 unless a follow-up task lands them explicitly.

## Sync-safe note

For remote sources, the canonical sanitized URL is the portable identity.
For local files, the current v1 model is device-local metadata plus reopen guidance, not a full syncable file reference.
