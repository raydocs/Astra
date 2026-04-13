# Popup ↔ Vocabulary ↔ Review ↔ History (minimal matrix)

| From → To | Mechanism | Notes |
|-----------|------------|-------|
| Popup → Vocabulary | `onOpenVocabulary` / `openVocabularyPage` | Full-page vocabulary UI |
| Popup → Review | `onOpenReview` / `openReviewPage` | `?tab=review` supported |
| Popup → History revisit | Recent list → `openUrlInTab(url)` | Same tab opens source URL |
| Vocabulary list → Source | Per-entry link **Open source page** | `target=_blank` |
| Review card back → Source | **Open source page** | Uses `entry.url` |
| Vocabulary ↔ Review | In-app tabs | Single `VocabularyApp` shell |

## Gaps (honest)

- No deep link from vocabulary list item → popup sentence deck (would need URL + sentence index protocol).
- Reading history surface is **popup-only** in this matrix; dedicated history page is out of scope for Month 2.
