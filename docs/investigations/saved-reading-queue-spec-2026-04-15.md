# Saved reading queue — minimal spec (Month 3)

_Version: 2026-04-15_

## Tabs

| Tab | Rule |
|-----|------|
| **Recent** | Last N items from reading history (existing `getReadingHistory`) |
| **Saved** | User explicitly saved (star / “Save for later”) — requires `OwnedReadingItem.status === "saved"` store |
| **In progress** | `OwnedReadingItem.status === "in_progress"` OR study progress incomplete for URL |

## v0 (no new store)

- **Recent** = popup Study “recent translations” list semantics extended to vocabulary reader entrypoints where applicable.
- **Saved / In progress**: gated on `OwnedReadingItem` persistence (implementation task); schema in `owned-reading-item-spec-2026-04-15.md`.

## Reopen

- Click row → `openUrlInTab` for articles; for PDF/EPUB open reader URL with `?` params carrying `id` when store exists.

## Smoke

- Pair with `bench-live/pdf-reader-basic`, `bench-live/epub-reader-basic` (or packaged scenarios) for reopen proof once store exists.
