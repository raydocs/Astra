# Work item 5 deferred capabilities — web workspace and document/media readers

Implemented parity in this pass is limited to truthful visual shells over existing data and capabilities:

- Web `/text`, `/articles`, `/files/pdf`, `/files/epub`, `/files/subtitles`, `/video-notes`, and `/assets` use current local/import/cloud snapshots only.
- File/document empty states remain local upload/dropzone flows; file bytes are not implied to sync unless current handoff/storage code already does so.
- Reader progress indicators report current parser/translation/job state only.

Deferred as net-new product work:

- Multi-item article/file libraries with bulk select/delete and query-param filters.
- Billing lifecycle beyond existing checkout/portal handoff.
- Mobile companion surfaces.
- AI edge correction for OCR/overlays beyond current compare/fallback rows.
- Pronunciation recording and audio capture workflows.
- Sync conflict resolver and keyboard rebinding.
- Inbound shared-word import and cross-device local-file byte sync.
