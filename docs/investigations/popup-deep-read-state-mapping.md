# Popup Deep-Read State Mapping

_Last updated: 2026-04-14 (thin study-context sentence deck fallback)_

This note is the explainer for the Month 1 popup deep-read close-out slice in plan.md section 8.3.

## Scope

This document covers only the popup deep-read chain for:

- article excerpt
- sentence drill
- explain
- save
- speak

It does **not** add:

- auto vocabulary extraction
- popup-internal review
- Month 4+ revisit/study-progress expansion

## Thin study context (no `articleExcerpt`)

When the active tab has **no** `articleExcerpt` but still has `contentSummary` or `metaDescription`, the popup builds the sentence drill deck from that fallback text (same `splitSentences` pipeline, still capped at three cards). This keeps explain/save/review flows usable on pages where the reader has not produced an excerpt yet.

## Sentence-card state semantics

Each popup sentence card now renders from one explicit view model with these semantics:

| State | Meaning | Source of truth |
|---|---|---|
| `selected` | The active sentence card in the popup deck | `selectedSentenceIndex` |
| `explaining` | The popup is currently requesting an explanation for that sentence | `sentenceStateById[id].explainStatus === "explaining"` |
| `explained` | The sentence has explanation text cached for the current popup deck | `sentenceStateById[id].explainStatus === "explained"` |
| `saving` | The popup is currently persisting that sentence into vocabulary | `sentenceStateById[id].saveStatus === "saving"` |
| `saved` | The sentence is already in vocabulary for the current page URL or was just saved in this popup session | persisted vocabulary lookup + `sentenceStateById[id].saveStatus === "saved"` |
| `speaking` | TTS is currently playing that sentence | `speakingSentenceId === id` |

## Behavior rules

### Selected

- The selected sentence is highlighted.
- Prev/next navigation only changes selection.
- Explain/save/speak actions all target the selected card or an explicitly clicked card.

### Explaining / explained

- Only one sentence explain request runs at a time.
- A completed explanation stays attached to that sentence card for the current page excerpt.
- Re-clicking explain on an already explained sentence reuses the cached result instead of re-requesting it.
- When the page URL or article excerpt changes, the popup deep-read deck revision changes and old explain state is discarded.

### Saving / saved

- Only one sentence save runs at a time.
- Save reads explanation text from the sentence card state, not from a separate “last explanation” buffer.
- Saved state is backed by both:
  - current popup session state
  - existing vocabulary entries for the current page URL
- After save, the selected sentence card shows an inline CTA to continue in Vocabulary or Review.

### Speaking

- Sentence speech is mutually exclusive with article-level study speech.
- Starting sentence speech clears article-level speaking state.
- Starting article-level study speech clears sentence-level speaking state.
- Popup deck reset stops active speech.

## Source-context persistence

Popup sentence saves now write additive `sourceContext` metadata into vocabulary entries:

```ts
sourceContext?: {
  surface: "popup_deep_read"
  pageTitle?: string
  contentSummary?: string
  articleExcerpt?: string
  sentenceText?: string
  sentenceIndex?: number
}
```

### Persistence rules

- `context` stays as the human-readable fallback snippet for older UI/export flows.
- `sourceContext` is additive and optional.
- Deduped resaves merge `sourceContext` instead of blindly replacing it.
- Sync upserts preserve existing `sourceContext` when an incoming payload omits it.

## Popup → assets join-up

After a popup save:

1. the sentence is persisted into vocabulary with richer source context
2. the popup sentence card shows `Saved`
3. the popup card exposes direct `Vocabulary` / `Review` continuation buttons
4. vocabulary list renders the popup source label/snippet
5. review back-side renders the popup source label/snippet

## Replayable proof

Optional standalone popup proof command:

```bash
pnpm bench:live:lane:popup-proof
```

Optional learning-loop command:

```bash
pnpm bench:live:lane:learning-loop
```

Current lane contents:

- `bench-live/popup-deep-read-proof`
- `bench-live/vocabulary-srs-smoke`

Both lanes are **optional** for now. They are evidence for popup deep-read credibility, not required release-proof gates yet.
