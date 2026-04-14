# Month 3 — PDF reader pack closeout memo (2026-04-16)

**Ledger:** plan.md Month 3 rows **14–20** (PDF pack).

## Scope (what “done” means here)

- **Owned queue:** PDF rows are upserted into `OwnedReadingItem` storage after the extension PDF reader parses a document (`sourceType: "pdf"`), with remote URLs carried on `sourceUrl` where applicable and `reopenHint` for local-only reopen paths.
- **Revisit:** Vocabulary **Reading** tab **Open** launches `pdf-reader.html`, including `?url=` for remote PDFs and optional `?reopenHint=` when the user must re-pick a local file.
- **Proof:** Primary automated proof remains the live bench scenario **`bench-live/pdf-reader-basic`** (registry: `bench-live/scenarios/index.ts` → `pdfReaderBasicScenario`). It exercises the PDF reader harness + browser capture; it is **not** a full end-to-end substitute for every queue edge case.

## Boundaries / non-goals

- Does not certify every PDF engine or site-hosted PDF; failures outside the harness fixture are **best-effort** product behavior until covered by additional scenarios.
- Month 3 does not require a separate CI lane dedicated only to PDF; evidence is **scenario id +** `bench-live-results/<run-id>/` when a green run exists (see `month-3-bench-artifact-conventions-2026-04-16.md`).
