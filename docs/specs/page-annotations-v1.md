# Page annotations v1

Persistent Mark/Highlight/sticky-note annotations are extension-controlled local records. They are not account/cloud synced in v1.

## Record model

Each annotation stores:

- stable `id`
- `pageUrl` (current URL with hash removed) and `pageOrigin`
- optional `pageTitle`
- `quoteText` and optional `noteText`
- `type`: `mark`, `highlight`, or `sticky_note`
- `state`: `active` or `unresolved`
- anchors:
  - text-position offsets (`start`, `end`) against the page text snapshot
  - text-quote anchor (`exact`, with optional `prefix`/`suffix` context)
  - optional selector anchor for the nearest text container
- `createdAt` and `updatedAt`
- optional `unresolvedAnchor` details with reason and `lastTriedAt`

## Local persistence and cap

Records are stored in `browser.storage.local` under `astra.page_annotations.v1`.

V1 has a deterministic global cap of **500 annotations per browser profile**. On write, records are normalized, sorted by newest `updatedAt`/`createdAt`, and records beyond the cap are evicted oldest-first. When an action causes eviction, the selection toolbar reports how many older annotations were evicted and the cap that was applied.

## Rendering and unresolved anchors

On pages where `pageUrl` matches, Astra first tries the text-position anchor and verifies the saved quote text. If that fails, it falls back to quote + prefix/suffix matching. Resolved annotations render in-page; unresolved annotations remain saved and appear in the page annotation panel as `Anchor unresolved` until deleted or until the anchor resolves again on a later load.

Deletion from the page annotation panel removes both the stored record and the rendered page UI.
