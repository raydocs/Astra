# Revisit v1 contract — Popup ↔ Vocabulary ↔ Review ↔ History

## First supported revisit path (Month 2)

**Supported entry path:**

1. Translate/read an HTTP(S) article page.
2. Explain at least one sentence and/or save vocabulary from that page.
3. Open `vocabulary.html?tab=reading`.
4. Use the **Reading** tab row for that article.
5. Click **Open** to reopen the article in a normal browser tab.

This is the first supported revisit path for Month 2. It is intentionally narrow and replayable.

## What the Reading row must preserve

For article rows, the Reading queue now surfaces enough context to make revisit useful without guessing:

- **page identity**: title + host + canonical page URL
- **reading-history context**: translated word count from `reading-history`
- **study-progress context**: ordered completed steps + page counts from `study-progress`
- **next-step hint**: the next forward step from the furthest durable completed step

Example row contract:

- `Host: example.com`
- `Page: https://example.com/article`
- `Translated: 12 words translated`
- `Study loop: Read → Explain → Save words`
- `Counts: 1 explained · 1 saved · 0 reviewed`
- `Next: Review the saved card from this page to close the loop.`

## Mechanism matrix

| From → To | Mechanism | Supported in Month 2? | Notes |
|-----------|-----------|------------------------|-------|
| Popup → Vocabulary | `onOpenVocabulary` / `openVocabularyPage` | Yes | Full-page vocabulary UI |
| Popup → Review | `onOpenReview` / `openReviewPage` | Yes | `?tab=review` supported |
| Popup → History revisit | Recent list → `openUrlInTab(url)` | Yes, popup-only | Same-tab reopen from recent reading history |
| Vocabulary list → Source | **Open source page** / source anchor | Yes | Opens saved `entry.url` in a browser tab |
| Review card back → Source | **Open source page** | Yes | Uses saved `entry.url` |
| Vocabulary Reading → Article revisit | **Open** on article row | **Yes — canonical revisit v1** | Reopens stable article URL and shows reading-history + study-progress summary |
| Vocabulary ↔ Review | In-app tabs | Yes | Single `VocabularyApp` shell |

## Explicit boundaries

- No popup sentence-deck deep link from vocabulary/review yet.
- No scroll restoration, sentence index restoration, or resume cursor.
- No generalized resume center across popup / vocabulary / review.
- Query/hash stripping is still part of the stable article identity contract for this v1 path.
- Popup history list remains useful, but the **Vocabulary Reading tab** is the canonical replayed revisit surface for Month 2.

## Replayable smoke

- Scenario: `bench-live/learning-loop-revisit-smoke`
- Direct command: `CI=true pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke`
- Chained lane: `CI=true pnpm bench:live:lane:learning-loop`

The smoke now requires both:

1. the revisit row summary to render the expected source/progress fields, and
2. **Open** to launch the saved article URL in a new tab.

## Fresh replay artifact (2026-04-15)

Green rerun after the revisit v1 hardening work:

- popup proof: `bench-live-results/live-20260415T104021-y8rb0n/`
- vocabulary smoke: `bench-live-results/live-20260415T104027-zap15i/`
- revisit smoke: `bench-live-results/live-20260415T104030-y9lm8o/`

The revisit smoke artifact includes the Reading-tab screenshot and snapshot proving that the row showed page identity, translated-count context, ordered study steps, the next-step hint, and that **Open** launched the fixture article URL.
