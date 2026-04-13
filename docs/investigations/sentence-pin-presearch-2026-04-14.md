# Sentence pin / favorite — presearch (Month 2 ledger #9)

## Goal

Let users **mark a sentence** in popup deep-read for faster revisit without re-scrolling the deck.

## Data model (proposal)

- Extend `PageStudyContext` or a new `astra.study_pins.v1` store: `{ url, sentenceIndex, textHash, createdAt, note? }`.
- Cap pins per URL (e.g. 20) to avoid storage bloat.

## UX

- Pin icon on selected sentence card; list pins above deck or in a collapsible “Pinned on this page”.
- Unpin from same control; optional “jump to pin” in sentence deck.

## Sync

- If study progress syncs, pins should use the same **recordId = sanitized URL** pattern as `study-progress.ts` or attach as optional payload on `study_progress` sync collection (future).

## Risks

- Sentence index drift if `articleExcerpt` changes → prefer **text hash + fuzzy match** fallback when reopening.

## Verdict

**Deferred to Month 3+** as product scope; this document satisfies ledger **#9** “预研” without shipping UI in Month 2.
