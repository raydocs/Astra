# Popup ↔ Vocabulary ↔ Review ↔ History (minimal matrix)

| From → To | Mechanism | Notes |
|-----------|------------|-------|
| Popup → Vocabulary | `onOpenVocabulary` / `openVocabularyPage` | Full-page vocabulary UI |
| Popup → Review | `onOpenReview` / `openReviewPage` | `?tab=review` supported |
| Popup → History revisit | Recent list → `openUrlInTab(url)` | Same tab opens source URL；每项展示 **相对访问时间**（`visitedAt` → just now / min / h / d ago） |
| Vocabulary list → Source | **Open source page** button (http/https) or `source` anchor `target=_blank` | Extension tab uses `browser.tabs.create` for the button path |
| Review card back → Source | **Open source page** | Uses `entry.url` |
| Vocabulary ↔ Review | In-app tabs | Single `VocabularyApp` shell |

## Replayable revisit smoke (Month 2)

- Scenario: `bench-live/learning-loop-revisit-smoke`
- Command: `pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke`
- Chained optional lane: `pnpm bench:live:lane:learning-loop` (runs popup proof + vocabulary smoke + revisit smoke)

## Gaps (honest)

- No deep link from vocabulary list item → popup sentence deck (would need URL + sentence index protocol).
- Reading history surface is **popup-only** in this matrix; dedicated history page is out of scope for Month 2.
